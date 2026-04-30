# 卫星态势渲染性能分析报告

**分析日期**: 2026-04-30
**分析工具**: Chrome DevTools Performance Profiler
**对比对象**: KeepTrack (keeptrack.space) - 60k 卫星 60fps

---

## 一、问题描述

当前项目加载约 **16,000 颗卫星**时出现明显卡顿（1-2fps），而 KeepTrack 网站可以流畅渲染 **60,000+ 卫星**。

## 二、Trace 分析结果

### 2.1 核心性能指标

| 指标 | 数值 | 评价 |
|------|------|------|
| FireAnimationFrame | 1,200 - 1,700ms/帧 | ❌ 严重卡顿 (正常应 <16ms) |
| UpdateLayoutTree | 150 - 327ms/帧 | ❌ DOM 布局频繁重算 |
| Layout | 150 - 357ms | ❌ 重排时间过长 |
| Paint | 130 - 250ms/帧 | ❌ 绘制耗时 |

### 2.2 发现的问题

#### 问题 1: COMPUTE_INTERVAL 设置过长

```typescript
// useOrbitWorker.ts:28
const COMPUTE_INTERVAL = 3600000  // = 1小时！

// useOrbitWorker.ts:101
if (now - lastComputeTime < COMPUTE_INTERVAL) return
```

**影响**: 轨道位置每 1 小时才重新计算一次，而非预期的 3 秒。

#### 问题 2: Cesium PointPrimitiveCollection 性能瓶颈

Cesium 的 `PointPrimitiveCollection` 不是为大规模点云设计的：
- 每帧需要遍历所有 16,000 个点进行状态检查
- 与 Vue 响应式系统竞争主线程
- 无法利用 GPU 批量渲染优势

#### 问题 3: Vue 响应式过度更新

- `positions` 使用 `ref` 而非 `shallowRef`，导致深度响应
- 卫星列表组件可能在每帧都进行不必要的重新渲染
- 侧边栏数据更新触发连锁的 CSS 重算

#### 问题 4: UpdateLayoutTree 耗时过长

每帧 150-327ms 的布局计算表明：
- DOM 结构频繁变化
- CSS 样式计算量过大
- 可能存在 layout thrashing

## 三、KeepTrack 架构分析

### 3.1 技术选型对比

| 维度 | KeepTrack (60k+) | 当前项目 (16k) |
|------|-----------------|---------------|
| 渲染引擎 | 原生 WebGL 2.0 + 自定义 GLSL | Cesium (GIS框架) |
| 点渲染方式 | `GL_POINTS` + Shader | `PointPrimitiveCollection` |
| 轨道计算 | Web Worker (positionCruncher.ts) | Web Worker (orbit.worker.ts) |
| 数据传输 | Structured Clone / 批量传输 | 每次全量 JSON postMessage |
| 帧率 | **60fps** | **1-2fps** |

### 3.2 KeepTrack 关键优化技术

#### 1. Web Workers 完全隔离
```typescript
// positionCruncher.ts - 962行专门处理位置计算
// 所有 SGP4/SDP4 轨道计算完全在 Worker 中
// 主线程只接收计算结果，不参与任何计算
```

#### 2. BufferGeometry 批量更新
```typescript
// KeepTrack 风格
const positions = new Float32Array(numSats * 3);
const colors = new Float32Array(numSats * 4);

// 批量更新所有位置，一次性上传 GPU
bufferGeometry.attributes.position.array = positions;
bufferGeometry.attributes.position.needsUpdate = true;
```

#### 3. Shader 层做视锥裁剪
```glsl
// 在 vertex shader 中直接丢弃远距离卫星
if (eciDist > 1.0e7) {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = 0.0;
  return;
}
```

#### 4. 单一 Draw Call
- 所有 60,000 个卫星点通过一次 `gl.drawArrays(GL_POINTS, 0, numSats)` 渲染
- 不存在多次 draw call 的开销

#### 5. 对象池复用
- 预分配 `Float32Array` 避免每帧创建新对象
- 减少 GC 压力

## 四、优化方案

### 方案 A：快速修复 (1-2天)

**目标**: 立即改善当前卡顿问题

#### A1. 修复 COMPUTE_INTERVAL
```typescript
// useOrbitWorker.ts
const COMPUTE_INTERVAL = 10000  // 10 秒更新一次
```

#### A2. Cesium 渲染优化
```typescript
// useCesium.ts
viewer.value.resolutionScale = 0.5;  // 从 0.8 降至 0.5
viewer.value.scene.requestRenderMode = true;  // 启用请求渲染模式
```

#### A3. Vue 响应式优化
```typescript
// useOrbitWorker.ts
const positions = shallowRef<PositionData[]>([])  // 使用 shallowRef
```

#### A4. 卫星列表虚拟滚动
- 使用 `vue-virtual-scroller` 仅渲染可见项
- 避免 16,000 个列表项全部渲染

**预期效果**: 3-5 倍性能提升，FPS 提升至 5-10

---

### 方案 B：混合架构 (1周)

**目标**: 支持 50,000+ 卫星，60fps

**核心思路**: Cesium 地球 + Three.js 点云

```
┌─────────────────────────────────────┐
│  Cesium Globe                        │
│  - 轨道线 (PolylineCollection)       │
│  - 选中卫星 3D 模型 (Entity)          │
│  - 地形/影像/大气效果                 │
├─────────────────────────────────────┤
│  Three.js Points (新增)              │
│  - BufferGeometry                    │
│  - 50,000 点 60fps                   │
│  - GPU 实例化                        │
│  - 位置通过 Worker 计算              │
└─────────────────────────────────────┘
```

#### B1. 架构改动

```typescript
// 1. 保留 Cesium Viewer 作为地球底图
const cesiumViewer = new Cesium.Viewer('cesium-container', {...})

// 2. 新增 Three.js 渲染器，叠加在 Cesium 上
const threeRenderer = new THREE.WebGLRenderer()
threeRenderer.domElement.style.position = 'absolute'
threeRenderer.domElement.style.pointerEvents = 'none'  // 透传点击事件

// 3. 创建 Points 用于卫星点云
const satelliteGeometry = new THREE.BufferGeometry()
const positions = new Float32Array(50000 * 3)
const colors = new Float32Array(50000 * 3)
satelliteGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
satelliteGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

const satelliteMaterial = new THREE.PointsMaterial({
  size: 2,
  vertexColors: true,
  sizeAttenuation: true
})

const satellitePoints = new THREE.Points(satelliteGeometry, satelliteMaterial)

// 4. 位置更新时批量修改 Float32Array
function updateSatellitePositions(positions: PositionData[]) {
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]
    // 计算 Cesium Cartesian3 转换为 Three.js 坐标
    const cesiumPos = Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, pos.alt)
    satelliteGeometry.attributes.position.array[i * 3] = cesiumPos.x
    satelliteGeometry.attributes.position.array[i * 3 + 1] = cesiumPos.y
    satelliteGeometry.attributes.position.array[i * 3 + 2] = cesiumPos.z
  }
  satelliteGeometry.attributes.position.needsUpdate = true
}
```

#### B2. 坐标同步
需要将 Cesium 相机状态同步到 Three.js，确保两者视角一致。

#### B3. 交互处理
- 点击选择卫星: 需要从 Three.js 坐标转换回 Cesium 选择
- 悬停提示: 使用 CSS2DRenderer 或独立的提示层

**预期效果**: 支持 50,000-100,000 点，60fps

---

### 方案 C：参考 KeepTrack 完全自研 (2-3周)

**目标**: 极致性能，60k+ 点 60fps

完全放弃 Cesium，参考 KeepTrack 架构：

1. **原生 WebGL 2.0 + GLSL shaders**
2. **自定义渲染管线**
3. **Web Workers 计算轨道**
4. **Logarithmic depth buffer** (解决地球到深空的精度问题)
5. **World Shift System** (坐标系统转换)

推荐优先参考 KeepTrack 的开源代码：
- GitHub: https://github.com/thkruz/keeptrack.space
- ootk (轨道计算库): https://github.com/thkruz/ootk

## 五、推荐路径

```
当前状态 ──────────────────────────────────────────────────► 目标状态
   │                                                          │
   ▼                                                          ▼
┌─────────┐    ┌─────────┐    ┌─────────┐           ┌─────────────────┐
│ 方案 A  │ -> │ 方案 B  │ -> │ 方案 C  │           │ 60k+ 卫星 60fps │
│ 1-2天   │    │ 1周     │    │ 2-3周   │           │                 │
└─────────┘    └─────────┘    └─────────┘           └─────────────────┘
```

**建议**:
1. **立即**: 实施方案 A 快速改善现状
2. **短期**: 实施方案 B 达到生产可用级别
3. **长期**: 参考 KeepTrack 持续优化或切换自研方案

## 六、待确认问题

1. **卫星数量预期**: 2万？5万？10万？
2. **更新频率**: 3-10 秒更新一次是否可以接受？
3. **功能保留**: 哪些 Cesium 功能是必须的（轨道线/3D模型/地形）？
4. **卡顿阈值**: FPS 低于多少算不可接受？

---

## 附录：Trace 原始数据摘要

```
最大帧时间:
- RunTask: 163,279ms (CPU Profiler 采样期间)
- FireAnimationFrame: 162,358ms
- v8.callFunction: 162,330ms

常规帧时间:
- FireAnimationFrame: 1,200 - 1,700ms
- UpdateLayoutTree: 150 - 327ms
- Layout: 150 - 357ms
- Paint: 130 - 250ms

GC 相关:
- V8.GC_TIME_TO_SAFEPOINT: 2-4ms (少量 GC，未见大范围 GC 暂停)
```

---

*分析完成时间: 2026-04-30*