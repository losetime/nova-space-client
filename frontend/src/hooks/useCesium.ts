import { ref, shallowRef, onUnmounted } from "vue";
import * as Cesium from "cesium";
import satelliteModelUrl from "@/assets/satellite.glb";
import { GlobeAutoRotate } from "./useGlobeAutoRotate";

interface Satellite {
  noradId: string;
  name: string;
  position: {
    lng: number | null;
    lat: number | null;
    alt: number | null;
  } | null;
  status?: "ok" | "error";
}

// 颜色分类类型
export type ColorSchemeType = "orbit" | "mission" | "country" | "objectType";

// 图例项
export interface LegendItem {
  color: string;
  label: string;
}

// 轨道类型颜色配置
const ORBIT_COLORS: Record<string, { color: Cesium.Color; label: string }> = {
  LEO: { color: Cesium.Color.fromCssColorString("#00ff88"), label: "低轨 LEO" },
  MEO: { color: Cesium.Color.fromCssColorString("#00d4ff"), label: "中轨 MEO" },
  GEO: { color: Cesium.Color.fromCssColorString("#b366e8"), label: "地球同步 GEO" },
  HEO: { color: Cesium.Color.fromCssColorString("#ffaa00"), label: "高轨" },
};

// 地球平均半径（米），用于从 ECEF 求轨道高度
const EARTH_RADIUS_M = 6378137;

// 轨道类型判断（基于高度，单位：米）
function getOrbitType(alt: number): string {
  if (alt < 2000000) return "LEO"; // < 2000 km
  if (alt < 35000000) return "MEO"; // 2000-35000 km
  if (alt < 45000000) return "GEO"; // 35000-45000 km
  return "HEO";
}

// 轨道类型图例
const ORBIT_LEGEND: LegendItem[] = [
  { color: "#00ff88", label: "低轨 LEO (<2000km)" },
  { color: "#00d4ff", label: "中轨 MEO (2000-35000km)" },
  { color: "#b366e8", label: "地球同步 GEO (35000-45000km)" },
  { color: "#ffaa00", label: "高轨 HEO (>45000km)" },
];

// 卫星渲染器 - PointPrimitive + Model 混合方案
class SatelliteRenderer {
  private viewer: Cesium.Viewer;
  private pointCollection: Cesium.PointPrimitiveCollection | null = null;
  private labelCollection: Cesium.LabelCollection | null = null;

  private pointMap: Map<string, Cesium.PointPrimitive> = new Map();
  private selectedNoradId: string | null = null;
  private focusedNoradId: string | null = null; // 焦点卫星ID，非焦点卫星将被隐藏
  private selectedModel: Cesium.Entity | null = null;
  private selectedLabel: Cesium.Label | null = null;
  private satellitePositions: Map<
    string,
    { name: string; position: Cesium.Cartesian3; alt: number }
  > = new Map();
  private clickHandler: Cesium.ScreenSpaceEventHandler | null = null;
  private onSatelliteClick: ((noradId: string, name: string) => void) | null = null;

  // 悬停相关
  private hoverHandler: Cesium.ScreenSpaceEventHandler | null = null;
  private hoveredNoradId: string | null = null;
  private hoverLabel: Cesium.Label | null = null;

  // 默认卫星样式
  private readonly DEFAULT_PIXEL_SIZE = 3;
  private readonly HOVER_PIXEL_SIZE = 8;
  private readonly DEFAULT_COLOR = Cesium.Color.fromCssColorString("#00ff9d");
  private readonly HOVER_COLOR = Cesium.Color.fromCssColorString("#00ffff");

  // 颜色分类
  private colorScheme: ColorSchemeType = "orbit";

  // 轨道类型缓存（避免每次更新都重新计算）
  private orbitTypeCache: Map<string, string> = new Map();

  // 待补色的卫星（首帧 ECEF 未就绪时创建，等首个位置批次到达后一次性补算）
  private pendingRecolor: Set<string> = new Set();

  // 悬停延迟检测
  private hoverDelayFrameCount = 0;
  private readonly HOVER_DELAY_FRAMES = 3;
  private lastMousePosition: Cesium.Cartesian2 | null = null;
  private hoverCheckScheduled = false;

  // 缓存上一次的卫星 ID 集合（用于增量更新）
  private lastSatelliteIds: Set<string> = new Set();

  // 卫星 ECEF 缓冲索引（noradId -> 批次内索引），与 worker 的 validIds 顺序对齐
  private bufferIndexByNoradId: Map<string, number> = new Map();
  // 卫星位置临时对象池，避免每帧创建新 Cartesian3
  private scratchByNoradId: Map<string, Cesium.Cartesian3> = new Map();
  // 最近一次 ECEF 位置缓冲（结构更新时用于初始位置）
  private lastEcef: Float32Array | null = null;
  private selectedScratch: Cesium.Cartesian3 | null = null;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.initialize();
  }

  // 初始化 - 创建两个集合
  initialize() {
    // 1. PointPrimitiveCollection - 所有卫星点
    this.pointCollection = new Cesium.PointPrimitiveCollection();
    this.viewer.scene.primitives.add(this.pointCollection);

    // 2. LabelCollection - 选中的卫星标签
    this.labelCollection = new Cesium.LabelCollection();
    this.viewer.scene.primitives.add(this.labelCollection);

    // 3. 设置点击事件处理
    this.setupClickHandler();

    // 4. 设置悬停事件处理
    this.setupHoverHandler();
  }

  // 设置点击事件处理
  private setupClickHandler() {
    if (this.clickHandler) {
      this.clickHandler.destroy();
    }

    this.clickHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    // 处理点击事件
    this.clickHandler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const pickedObject = this.viewer.scene.pick(event.position);

      if (pickedObject?.id) {
        const satInfo = this.satellitePositions.get(pickedObject.id);
        if (satInfo && this.onSatelliteClick) {
          this.onSatelliteClick(pickedObject.id, satInfo.name);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  // 设置卫星点击回调
  setOnSatelliteClick(callback: (noradId: string, name: string) => void) {
    this.onSatelliteClick = callback;
  }

  // 设置悬停事件处理（GPU Picking + 延迟检测）
  private setupHoverHandler() {
    if (this.hoverHandler) {
      this.hoverHandler.destroy();
    }

    this.hoverHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    this.hoverHandler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      this.lastMousePosition = movement.endPosition;
      this.hoverDelayFrameCount = 0;

      if (!this.hoverCheckScheduled) {
        this.hoverCheckScheduled = true;
        requestAnimationFrame(this.checkHover);
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }

  // 延迟检测：等待鼠标停下来
  private checkHover = () => {
    this.hoverDelayFrameCount++;

    if (this.hoverDelayFrameCount >= this.HOVER_DELAY_FRAMES) {
      if (this.lastMousePosition) {
        this.performHoverPick(this.lastMousePosition);
      }
      this.hoverCheckScheduled = false;
    } else {
      requestAnimationFrame(this.checkHover);
    }
  };

  // GPU Picking 执行
  private performHoverPick(screenPosition: Cesium.Cartesian2) {
    const pickedObject = this.viewer.scene.pick(screenPosition);
    const nearbySatellite: string | null = pickedObject?.id || null;

    if (nearbySatellite !== this.hoveredNoradId) {
      if (this.hoveredNoradId) {
        this.unhighlightSatellite(this.hoveredNoradId);
      }
      if (nearbySatellite) {
        this.highlightSatellite(nearbySatellite);
        this.hoveredNoradId = nearbySatellite;
      } else {
        this.hoveredNoradId = null;
      }
    }
  }

  // 高亮卫星（变大、改变颜色、发光效果）
  private highlightSatellite(noradId: string) {
    const point = this.pointMap.get(noradId);
    if (point && noradId !== this.selectedNoradId) {
      point.pixelSize = this.HOVER_PIXEL_SIZE;
      point.color = this.HOVER_COLOR;
      // 发光效果
      point.outlineWidth = 4;
      point.outlineColor = Cesium.Color.fromCssColorString("#00ffff").withAlpha(0.6);
    }

    // 显示悬停标签（卫星下方居中）
    const satInfo = this.satellitePositions.get(noradId);
    if (satInfo && this.labelCollection) {
      this.hoverLabel = this.labelCollection.add({
        position: satInfo.position,
        text: satInfo.name,
        font: "12px sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.TOP, // 标签顶部对齐卫星
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER, // 水平居中
        pixelOffset: new Cesium.Cartesian2(0, 15), // 向下偏移
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString("rgba(0, 0, 0, 0.7)"),
      });
    }
  }

  // 取消高亮卫星
  private unhighlightSatellite(noradId: string) {
    const point = this.pointMap.get(noradId);
    if (point && noradId !== this.selectedNoradId) {
      point.pixelSize = this.DEFAULT_PIXEL_SIZE;
      // 恢复原来的轨道类型颜色（从缓存获取）
      const orbitType = this.orbitTypeCache.get(noradId);
      const color = orbitType
        ? ORBIT_COLORS[orbitType]?.color || this.DEFAULT_COLOR
        : this.DEFAULT_COLOR;
      point.color = color;
      // 移除发光效果
      point.outlineWidth = 0;
    }

    // 移除悬停标签
    if (this.hoverLabel && this.labelCollection) {
      this.labelCollection.remove(this.hoverLabel);
      this.hoverLabel = null;
    }
  }

  // 设置有效卫星的 ECEF 缓冲索引（与 worker 的 validIds 顺序一致）
  setValidSatelliteIds(validIds: string[]) {
    this.bufferIndexByNoradId.clear();
    validIds.forEach((id, index) => {
      this.bufferIndexByNoradId.set(id, index);
    });
  }

  // 结构更新：仅在筛选/首帧等列表变化时执行增删，位置交由 updatePositions 驱动
  updateSatellites(satellites: Satellite[]) {
    const currentIds = new Set<string>();
    for (let i = 0; i < satellites.length; i++) {
      currentIds.add(satellites[i]!.noradId);
    }

    // 1. 同步删除不在新列表中的卫星（数量通常很少）
    this.lastSatelliteIds.forEach((id) => {
      if (!currentIds.has(id)) {
        const point = this.pointMap.get(id);
        if (point && this.pointCollection) {
          this.pointCollection.remove(point);
        }
        this.pointMap.delete(id);
        this.scratchByNoradId.delete(id);
        this.satellitePositions.delete(id);
        this.orbitTypeCache.delete(id);
      }
    });

    // 2. 新增卫星（位置从 ECEF 缓存读取，避免经纬度换算）
    for (let i = 0; i < satellites.length; i++) {
      const sat = satellites[i]!;
      if (this.pointMap.has(sat.noradId)) continue;

      const bufferIdx = this.bufferIndexByNoradId.get(sat.noradId);
      // 解析失败或不在传播池中的卫星不渲染
      if (bufferIdx === undefined) continue;

      const initialPosition = this.createInitialPosition(bufferIdx, sat);
      const altFromEcef = this.ecefAltM(bufferIdx);
      const orbitType = getOrbitType(altFromEcef ?? sat.position?.alt ?? 0);
      this.orbitTypeCache.set(sat.noradId, orbitType);
      if (altFromEcef === null) {
        // ECEF 批次未就绪，等首个位置批次到达后补色
        this.pendingRecolor.add(sat.noradId);
      }
      const color = ORBIT_COLORS[orbitType]?.color || this.DEFAULT_COLOR;

      const point = this.pointCollection!.add({
        position: initialPosition,
        pixelSize: this.DEFAULT_PIXEL_SIZE,
        color,
        id: sat.noradId,
        show: this.lastEcef !== null,
      });
      this.pointMap.set(sat.noradId, point);
      this.scratchByNoradId.set(sat.noradId, initialPosition);
      this.satellitePositions.set(sat.noradId, {
        name: sat.name,
        position: point.position,
        alt: sat.position?.alt ?? 0,
      });
    }

    this.lastSatelliteIds = currentIds;
  }

  // 从 ECEF 缓存或经纬度构造初始位置（ECEF 优先，单位：米）
  private createInitialPosition(bufferIdx: number, sat: Satellite): Cesium.Cartesian3 {
    const ecef = this.lastEcef;
    const base = bufferIdx * 3;
    if (ecef && base + 2 < ecef.length) {
      return new Cesium.Cartesian3(ecef[base], ecef[base + 1], ecef[base + 2]);
    }
    if (sat.position && sat.position.lng !== null && sat.position.lat !== null) {
      return Cesium.Cartesian3.fromDegrees(
        sat.position.lng,
        sat.position.lat,
        sat.position.alt ?? 0,
      );
    }
    return new Cesium.Cartesian3(0, 0, 0);
  }

  // 从 ECEF 缓存求卫星轨道高度（米），缓存未就绪返回 null
  private ecefAltM(bufferIdx: number): number | null {
    const ecef = this.lastEcef;
    const base = bufferIdx * 3;
    if (!ecef || base + 2 >= ecef.length) return null;
    const x = ecef[base]!;
    const y = ecef[base + 1]!;
    const z = ecef[base + 2]!;
    return Math.sqrt(x * x + y * y + z * z) - EARTH_RADIUS_M;
  }

  // 解析待补色卫星（首帧 ECEF 就绪后一次性补算轨道类型颜色）
  private resolvePendingRecolor() {
    if (this.pendingRecolor.size === 0) return;
    const indexMap = this.bufferIndexByNoradId;
    this.pendingRecolor.forEach((noradId) => {
      const idx = indexMap.get(noradId);
      if (idx === undefined) {
        this.pendingRecolor.delete(noradId);
        return;
      }
      const alt = this.ecefAltM(idx);
      if (alt === null) return; // 仍未就绪，保留待补
      this.pendingRecolor.delete(noradId);
      const point = this.pointMap.get(noradId);
      if (!point) return;
      const orbitType = getOrbitType(alt);
      this.orbitTypeCache.set(noradId, orbitType);
      if (
        this.colorScheme === "orbit" &&
        noradId !== this.selectedNoradId &&
        noradId !== this.hoveredNoradId
      ) {
        point.color = ORBIT_COLORS[orbitType]?.color || this.DEFAULT_COLOR;
      }
    });
  }

  // 高频位置热路径：直接将 ECEF 批量写入 PointPrimitive（只写坐标，无重建）
  updatePositions(ecef: Float32Array, validMask: Uint8Array) {
    this.lastEcef = ecef;
    this.resolvePendingRecolor();
    if (this.pointMap.size === 0) return;

    const indexMap = this.bufferIndexByNoradId;
    const selectedIdx = this.selectedNoradId
      ? indexMap.get(this.selectedNoradId)
      : undefined;

    this.pointMap.forEach((point, noradId) => {
      const idx = indexMap.get(noradId);
      if (idx === undefined) return;
      const base = idx * 3;
      if (base + 2 >= ecef.length) return;

      const valid = validMask[idx] === 1;
      if (valid !== point.show) {
        point.show = valid;
      }
      if (!valid) return;

      const scratch = this.scratchByNoradId.get(noradId);
      if (!scratch) return;
      scratch.x = ecef[base]!;
      scratch.y = ecef[base + 1]!;
      scratch.z = ecef[base + 2]!;
      point.position = scratch;
    });

    // 选中的卫星（3D 模型 + 标签）同步跟随
    if (selectedIdx !== undefined && validMask[selectedIdx] === 1) {
      const base = selectedIdx * 3;
      if (base + 2 >= ecef.length) return;
      if (!this.selectedScratch) {
        this.selectedScratch = new Cesium.Cartesian3();
      }
      this.selectedScratch.x = ecef[base]!;
      this.selectedScratch.y = ecef[base + 1]!;
      this.selectedScratch.z = ecef[base + 2]!;
      if (this.selectedModel) {
        (this.selectedModel.position as Cesium.ConstantPositionProperty).setValue(
          this.selectedScratch,
        );
      }
      if (this.selectedLabel) {
        this.selectedLabel.position = this.selectedScratch;
      }
    }
  }

  // 获取卫星颜色（基于分类方式）
  private getSatelliteColor(sat: Satellite): Cesium.Color {
    if (this.colorScheme === "orbit") {
      const orbitType = getOrbitType(sat.position?.alt ?? 0);
      return ORBIT_COLORS[orbitType]?.color || this.DEFAULT_COLOR;
    }
    // 其他分类方式可以在这里扩展
    return this.DEFAULT_COLOR;
  }

  // 设置颜色分类方式
  setColorScheme(scheme: ColorSchemeType) {
    this.colorScheme = scheme;
    // 更新所有卫星的颜色
    this.refreshAllColors();
  }

  // 刷新所有卫星颜色（切换颜色方案时调用）
  private refreshAllColors() {
    this.satellitePositions.forEach((satInfo, noradId) => {
      const point = this.pointMap.get(noradId);
      if (point && noradId !== this.selectedNoradId && noradId !== this.hoveredNoradId) {
        // 使用缓存的轨道类型
        const orbitType = this.orbitTypeCache.get(noradId) || getOrbitType(satInfo.alt);
        const color = ORBIT_COLORS[orbitType]?.color || this.DEFAULT_COLOR;
        point.color = color;
      }
    });
  }

  // 获取当前分类的图例
  getLegend(): LegendItem[] {
    if (this.colorScheme === "orbit") {
      return ORBIT_LEGEND;
    }
    // 其他分类方式的图例
    return [];
  }

  // 选中卫星 - 切换为 3D 模型
  selectSatellite(noradId: string, name: string) {
    const point = this.pointMap.get(noradId);
    if (!point) return;

    // 取消之前的选中
    this.deselectSatellite();

    // 清除悬停效果（如果正在悬停的是当前卫星）
    if (this.hoveredNoradId === noradId) {
      this.hoveredNoradId = null;
      // 移除悬停标签
      if (this.hoverLabel && this.labelCollection) {
        this.labelCollection.remove(this.hoverLabel);
        this.hoverLabel = null;
      }
    }

    // 清除点的样式（防止之前 hover 的发光效果残留）
    point.pixelSize = this.DEFAULT_PIXEL_SIZE;
    point.outlineWidth = 0;
    // 隐藏点（设为透明）
    point.color = Cesium.Color.TRANSPARENT;

    // 创建 3D 模型 Entity
    this.selectedModel = this.viewer.entities.add({
      id: `selected_model_${noradId}`,
      position: point.position.clone(),
      orientation: Cesium.Transforms.headingPitchRollQuaternion(
        point.position.clone(),
        new Cesium.HeadingPitchRoll(
          Cesium.Math.toRadians(120),
          Cesium.Math.toRadians(-20),
          Cesium.Math.toRadians(30),
        ),
      ),
      model: {
        uri: satelliteModelUrl,
        minimumPixelSize: 64,
        maximumScale: 50000,
        scale: 500,
      },
    });

    // 创建标签（模型下方居中）
    this.selectedLabel = this.labelCollection!.add({
      position: point.position.clone(),
      text: name,
      font: "14px sans-serif",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.TOP,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      pixelOffset: new Cesium.Cartesian2(0, 50),
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString("rgba(0, 0, 0, 0.7)"),
    });

    this.selectedNoradId = noradId;
    this.setFocusedSatellite(noradId);
  }

  // 取消选中 - 恢复为点
  deselectSatellite() {
    if (this.selectedNoradId) {
      // 恢复点的样式
      const point = this.pointMap.get(this.selectedNoradId);
      if (point) {
        point.pixelSize = this.DEFAULT_PIXEL_SIZE;
        // 恢复原来的轨道类型颜色（从缓存获取）
        const orbitType = this.orbitTypeCache.get(this.selectedNoradId);
        const color = orbitType
          ? ORBIT_COLORS[orbitType]?.color || this.DEFAULT_COLOR
          : this.DEFAULT_COLOR;
        point.color = color;
        // 移除发光效果
        point.outlineWidth = 0;
      }
    }

    // 移除 3D 模型
    if (this.selectedModel) {
      this.viewer.entities.remove(this.selectedModel);
      this.selectedModel = null;
    }

    // 移除标签
    if (this.selectedLabel) {
      this.labelCollection!.remove(this.selectedLabel);
      this.selectedLabel = null;
    }

    this.selectedNoradId = null;
    this.setFocusedSatellite(null);
  }

  // 设置焦点卫星 - 隐藏其他所有卫星
  setFocusedSatellite(noradId: string | null) {
    this.focusedNoradId = noradId;
    this.pointMap.forEach((point, id) => {
      if (noradId === null) {
        // 取消焦点，显示所有卫星（选中的卫星会由deselectSatellite恢复）
        point.color = this.getColorForSatellite(id);
      } else if (id !== noradId) {
        // 非焦点卫星设为透明
        point.color = Cesium.Color.TRANSPARENT;
      }
      // 焦点卫星不改变颜色（如果是选中状态，保持透明，由3D模型显示）
    });
  }

  // 获取卫星颜色
  private getColorForSatellite(noradId: string): Cesium.Color {
    const orbitType = this.orbitTypeCache.get(noradId);
    if (orbitType) {
      return ORBIT_COLORS[orbitType]?.color || this.DEFAULT_COLOR;
    }
    return this.DEFAULT_COLOR;
  }

  // 设置点大小（根据相机高度）
  setPointSize(pixelSize: number) {
    if (!this.pointCollection) return;
    // PointPrimitiveCollection 没有forEach，使用 pointMap 遍历
    this.pointMap.forEach((point) => {
      point.pixelSize = pixelSize;
    });
  }

  // 清除所有卫星
  clearAllSatellites() {
    this.pointCollection?.removeAll();
    this.pointMap.clear();
    this.scratchByNoradId.clear();
    this.satellitePositions.clear();
    this.lastSatelliteIds.clear();
    this.orbitTypeCache.clear();
    this.pendingRecolor.clear();
    this.deselectSatellite();
  }

  // 获取卫星位置
  getSatellitePosition(noradId: string): Cesium.Cartesian3 | null {
    const point = this.pointMap.get(noradId);
    return point ? point.position.clone() : null;
  }

  // 获取卫星数量
  getSatelliteCount(): number {
    return this.pointMap.size;
  }

  // 销毁
  destroy() {
    if (this.clickHandler) {
      this.clickHandler.destroy();
      this.clickHandler = null;
    }
    if (this.hoverHandler) {
      this.hoverHandler.destroy();
      this.hoverHandler = null;
    }
    this.pointCollection?.removeAll();
    this.labelCollection?.removeAll();
    if (this.selectedModel) {
      this.viewer.entities.remove(this.selectedModel);
      this.selectedModel = null;
    }
    this.pointMap.clear();
    this.scratchByNoradId.clear();
    this.satellitePositions.clear();
    this.lastSatelliteIds.clear();
    this.orbitTypeCache.clear();
    this.pendingRecolor.clear();
  }
}

export function useCesium() {
  const viewer = shallowRef<Cesium.Viewer | null>(null);
  const satelliteRenderer = shallowRef<SatelliteRenderer | null>(null);
  const predictedOrbitEntities = new Map();
  const isInitialized = ref(false);

  // 轨道线集合（使用 PolylineCollection 提升性能）
  let orbitCollection: Cesium.PolylineCollection | null = null;
  const orbitPolylines: Map<string, Cesium.Polyline> = new Map();

  // 自动旋转器实例
  let globeAutoRotate: GlobeAutoRotate | null = null;

  // 初始化 Cesium 场景
  const initCesium = () => {
    if (isInitialized.value) return;

    viewer.value = new Cesium.Viewer("cesium-container", {
      baseLayerPicker: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      geocoder: false,
      vrButton: false,
      selectionIndicator: false,
      shadows: false,
      scene3DOnly: true,
      useDefaultRenderLoop: true,
      targetFrameRate: 60,
      contextOptions: {
        webgl: {
          alpha: false,
          preserveDrawingBuffer: false,
        },
      },
      // imageryProvider: new Cesium.UrlTemplateImageryProvider({
      //   url: "https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
      //   subdomains: ["1", "2", "3", "4"],
      //   credit: "© 高德地图",
      //   maximumLevel: 18,
      // }),
      // terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    });

    // 分辨率缩放因子，值越小性能越好(0.5=一半分辨率)
    viewer.value.resolutionScale = 1.0;

    // 调试：显示 FPS 与帧间隔（左上角）
    viewer.value.scene.debugShowFramesPerSecond = true;

    // 地球底图-天地图
    const gaodeProvider = new Cesium.WebMapTileServiceImageryProvider({
      url: "https://t0.tianditu.gov.cn/img_w/wmts?tk=" + "a4106e02d1c9fdf59cff2dbde5b9e4c8",
      layer: "img",
      style: "default",
      format: "tiles",
      tileMatrixSetID: "w",
      subdomains: ["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7"],
      maximumLevel: 18,
    });
    viewer.value.imageryLayers.addImageryProvider(gaodeProvider);

    // 设置相机视角 - 拉远到能看到整个地球
    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(116.39, 39.9, 140000000),
      orientation: {
        heading: Cesium.Math.toRadians(20),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
    });

    // 启用地球自动旋转
    globeAutoRotate = new GlobeAutoRotate(viewer.value, { speed: 0.001 });
    globeAutoRotate.start();

    // 初始化轨道线集合
    orbitCollection = new Cesium.PolylineCollection();
    viewer.value.scene.primitives.add(orbitCollection);

    // 初始化卫星渲染器
    satelliteRenderer.value = new SatelliteRenderer(viewer.value);

    isInitialized.value = true;
  };

  // 切换自动旋转
  const toggleAutoRotate = (enabled: boolean) => {
    if (!globeAutoRotate) return;
    if (enabled) {
      globeAutoRotate.start();
    } else {
      globeAutoRotate.stop();
    }
  };

  // 批量更新卫星位置（高性能版本）
  const updateSatellites = (satellites: Satellite[]) => {
    if (!satelliteRenderer.value) return;
    satelliteRenderer.value.updateSatellites(satellites);
  };

  // 清除所有卫星
  const clearAllSatellites = () => {
    if (!satelliteRenderer.value) return;
    satelliteRenderer.value.clearAllSatellites();
  };

  // 下发有效卫星索引（ECEF 缓冲索引映射）
  const setValidSatelliteIds = (validIds: string[]) => {
    if (!satelliteRenderer.value) return;
    satelliteRenderer.value.setValidSatelliteIds(validIds);
  };

  // 高频更新所有卫星位置（ECEF 直接写入，最热路径）
  const updatePositions = (ecef: Float32Array, validMask: Uint8Array) => {
    if (!satelliteRenderer.value) return;
    satelliteRenderer.value.updatePositions(ecef, validMask);
  };

  // 更新卫星轨道（使用 PolylineCollection 优化）
  const updateOrbit = (
    noradId: string,
    orbitPoints: Array<{ lng: number; lat: number; alt: number }>,
  ) => {
    if (!viewer.value || !orbitCollection) return;

    const orbitId = `orbit_${noradId}`;

    // 如果已存在，先移除
    const existingOrbit = orbitPolylines.get(orbitId);
    if (existingOrbit) {
      orbitCollection.remove(existingOrbit);
      orbitPolylines.delete(orbitId);
    }

    // 创建新的轨道线
    const positions = orbitPoints.map((point) =>
      Cesium.Cartesian3.fromDegrees(point.lng, point.lat, point.alt),
    );

    const polyline = orbitCollection.add({
      show: true,
      positions: positions,
      width: 1,
      material: Cesium.Material.fromType("Color", {
        color: Cesium.Color.CYAN,
      }),
    });

    orbitPolylines.set(orbitId, polyline);
  };

  // 删除详情轨道（开始预测时调用，之后由调用方重新创建）
  const removeOrbit = (noradId: string) => {
    if (!viewer.value || !orbitCollection) return;

    const orbitId = `orbit_${noradId}`;
    const existingOrbit = orbitPolylines.get(orbitId);
    if (existingOrbit) {
      orbitCollection.remove(existingOrbit);
      orbitPolylines.delete(orbitId);
    }
  };

  // 显示预测轨道
  const showPredictedOrbit = (
    noradId: string,
    orbitPoints: Array<{ lat: number; lng: number; alt: number }>,
  ) => {
    if (!viewer.value || !orbitPoints.length) return;

    // 清除该卫星之前的预测轨道
    clearPredictedOrbit(noradId);

    // 创建轨道点位置数组
    const positions = orbitPoints.map((point) =>
      Cesium.Cartesian3.fromDegrees(point.lng, point.lat, point.alt),
    );

    // 创建预测轨道线（紫色渐变）
    const orbitEntityId = `predicted_orbit_${noradId}`;
    const orbitEntity = viewer.value.entities.add({
      id: orbitEntityId,
      polyline: {
        positions: positions,
        width: 1,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          color: Cesium.Color.fromCssColorString("#a855f7"),
        }),
        clampToGround: false,
      },
    });

    predictedOrbitEntities.set(noradId, orbitEntity);

    // 添加轨道点标记（每隔一定间隔显示一个点）
    const step = Math.max(1, Math.floor(orbitPoints.length / 20));
    for (let i = 0; i < orbitPoints.length; i += step) {
      const point = orbitPoints[i];
      if (!point) continue;

      const pointEntityId = `predicted_point_${noradId}_${i}`;

      viewer.value.entities.add({
        id: pointEntityId,
        position: Cesium.Cartesian3.fromDegrees(point.lng, point.lat, point.alt),
        point: {
          pixelSize: 3,
          color: Cesium.Color.fromCssColorString("#a855f7").withAlpha(0.6),
          outlineColor: Cesium.Color.WHITE.withAlpha(0.3),
          outlineWidth: 1,
        },
      });

      predictedOrbitEntities.set(pointEntityId, true);
    }

    // 不自动飞行，保持相机当前位置
  };

  // 飞到预测轨道视图（拉远相机，确保能看到整体轨道）
  const flyToOrbit = (orbitPoints: Array<{ lat: number; lng: number; alt: number }>) => {
    if (!viewer.value || !orbitPoints.length) return;

    const camera = viewer.value.camera;

    // 计算轨道点的包围球
    const allPoints = orbitPoints.map((p) => Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.alt));
    const boundingSphere = Cesium.BoundingSphere.fromPoints(allPoints);

    // 根据包围球半径计算合适的距离（5倍半径确保轨道完整可见）
    const targetDistance = boundingSphere.radius * 5;

    // 计算当前相机到目标中心的距离
    const center = boundingSphere.center;
    const currentDistance = Cesium.Cartesian3.distance(camera.position, center);

    if (targetDistance > currentDistance) {
      // 需要拉远，使用 camera.flyTo 实现动画效果
      const currentHeading = camera.heading;
      const currentPitch = camera.pitch;

      // 计算新位置：沿当前视线方向拉远
      const direction = new Cesium.Cartesian3();
      Cesium.Cartesian3.subtract(camera.position, center, direction);
      Cesium.Cartesian3.normalize(direction, direction);

      const newPosition = new Cesium.Cartesian3();
      Cesium.Cartesian3.multiplyByScalar(direction, targetDistance, newPosition);
      Cesium.Cartesian3.add(center, newPosition, newPosition);

      camera.flyTo({
        destination: newPosition,
        orientation: {
          heading: currentHeading,
          pitch: currentPitch,
          roll: 0,
        },
        duration: 1.5,
      });
    }
  };

  // 清除预测轨道
  const clearPredictedOrbit = (noradId: string) => {
    if (!viewer.value) return;

    // 删除预测轨道线
    const orbitEntityId = `predicted_orbit_${noradId}`;
    const orbitEntity = viewer.value.entities.getById(orbitEntityId);
    if (orbitEntity) {
      viewer.value.entities.remove(orbitEntity);
      predictedOrbitEntities.delete(orbitEntityId);
    }

    // 删除所有预测轨道点
    const keysToRemove: string[] = [];
    predictedOrbitEntities.forEach((_, key) => {
      if (key.toString().startsWith(`predicted_point_${noradId}_`)) {
        const pointEntity = viewer.value!.entities.getById(key);
        if (pointEntity) {
          viewer.value!.entities.remove(pointEntity);
        }
        keysToRemove.push(key as string);
      }
    });
    keysToRemove.forEach((key) => predictedOrbitEntities.delete(key));
  };

  // 清除所有预测轨道
  const clearAllPredictedOrbits = () => {
    if (!viewer.value) return;

    const entitiesToRemove: Cesium.Entity[] = [];
    viewer.value.entities.values.forEach((entity) => {
      if (
        entity.id &&
        (entity.id.toString().startsWith("predicted_orbit_") ||
          entity.id.toString().startsWith("predicted_point_"))
      ) {
        entitiesToRemove.push(entity);
      }
    });

    entitiesToRemove.forEach((entity) => {
      viewer.value!.entities.remove(entity);
    });

    predictedOrbitEntities.clear();
  };

  // 过境轨迹实体存储
  const passTrajectoryEntities = new Map<string, boolean>();

  // 显示过境轨迹
  const showPassTrajectory = (
    noradId: string,
    orbitPoints: Array<{ lat: number; lng: number; alt: number; timestamp?: string }>,
    observer: { lat: number; lng: number; alt: number },
    _passInfo?: { startTime: string; endTime: string; maxElevationTime?: string },
  ) => {
    if (!viewer.value || !orbitPoints.length) return;

    // 清除之前的过境轨迹
    clearPassTrajectory();

    // 1. 绘制过境轨迹线（渐变色）
    const trajectoryId = `pass_trajectory_${noradId}`;

    // 创建渐变颜色的轨迹线
    const positions: Cesium.Cartesian3[] = [];
    const colors: Cesium.Color[] = [];

    orbitPoints.forEach((point, index) => {
      positions.push(Cesium.Cartesian3.fromDegrees(point.lng, point.lat, point.alt));

      // 颜色根据位置渐变：开始(蓝) -> 中间(青) -> 结束(蓝)
      const ratio = index / (orbitPoints.length - 1);
      const color =
        ratio < 0.5
          ? Cesium.Color.lerp(
              Cesium.Color.fromCssColorString("#3b82f6"), // 蓝色
              Cesium.Color.fromCssColorString("#00ff88"), // 青绿色
              ratio * 2,
              new Cesium.Color(),
            )
          : Cesium.Color.lerp(
              Cesium.Color.fromCssColorString("#00ff88"),
              Cesium.Color.fromCssColorString("#3b82f6"),
              (ratio - 0.5) * 2,
              new Cesium.Color(),
            );
      colors.push(color);
    });

    // 使用 PolylineOutlineMaterialProperty 创建轨迹线
    viewer.value.entities.add({
      id: trajectoryId,
      polyline: {
        positions: positions,
        width: 1,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.4,
          color: Cesium.Color.fromCssColorString("#00ff88"),
        }),
        clampToGround: false,
      },
    });
    passTrajectoryEntities.set(trajectoryId, true);

    // 2. 标记观察者位置
    const observerId = `pass_observer_${noradId}`;
    viewer.value.entities.add({
      id: observerId,
      position: Cesium.Cartesian3.fromDegrees(observer.lng, observer.lat, observer.alt),
      point: {
        pixelSize: 12,
        color: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      label: {
        text: "观察者",
        font: "14px sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -15),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
    passTrajectoryEntities.set(observerId, true);

    // 3. 标记起始点
    if (orbitPoints.length > 0) {
      const startPoint = orbitPoints[0];
      if (startPoint) {
        const startId = `pass_start_${noradId}`;
        viewer.value.entities.add({
          id: startId,
          position: Cesium.Cartesian3.fromDegrees(startPoint.lng, startPoint.lat, startPoint.alt),
          point: {
            pixelSize: 8,
            color: Cesium.Color.fromCssColorString("#3b82f6"),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1,
          },
          label: {
            text: "开始",
            font: "12px sans-serif",
            fillColor: Cesium.Color.fromCssColorString("#3b82f6"),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -10),
          },
        });
        passTrajectoryEntities.set(startId, true);
      }
    }

    // 4. 标记结束点
    if (orbitPoints.length > 1) {
      const endPoint = orbitPoints[orbitPoints.length - 1];
      if (endPoint) {
        const endId = `pass_end_${noradId}`;
        viewer.value.entities.add({
          id: endId,
          position: Cesium.Cartesian3.fromDegrees(endPoint.lng, endPoint.lat, endPoint.alt),
          point: {
            pixelSize: 8,
            color: Cesium.Color.fromCssColorString("#3b82f6"),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1,
          },
          label: {
            text: "结束",
            font: "12px sans-serif",
            fillColor: Cesium.Color.fromCssColorString("#3b82f6"),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -10),
          },
        });
        passTrajectoryEntities.set(endId, true);
      }
    }

    // 5. 标记最高点（轨道中点附近）
    const midIndex = Math.floor(orbitPoints.length / 2);
    if (midIndex > 0 && midIndex < orbitPoints.length) {
      const maxPoint = orbitPoints[midIndex];
      if (maxPoint) {
        const maxId = `pass_max_${noradId}`;
        viewer.value.entities.add({
          id: maxId,
          position: Cesium.Cartesian3.fromDegrees(maxPoint.lng, maxPoint.lat, maxPoint.alt),
          point: {
            pixelSize: 10,
            color: Cesium.Color.fromCssColorString("#00ff88"),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
          },
          label: {
            text: "最高点",
            font: "12px sans-serif",
            fillColor: Cesium.Color.fromCssColorString("#00ff88"),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -10),
          },
        });
        passTrajectoryEntities.set(maxId, true);
      }
    }

    // 6. 飞到轨迹正上方视图
    const trajectoryPoints = orbitPoints.map((p) =>
      Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.alt),
    );
    const boundingSphere = Cesium.BoundingSphere.fromPoints(trajectoryPoints);
    const camera = viewer.value.camera;

    // 将笛卡尔坐标转换为经纬度
    const centerCartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(
      boundingSphere.center,
    );
    const centerLng = Cesium.Math.toDegrees(centerCartographic.longitude);
    const centerLat = Cesium.Math.toDegrees(centerCartographic.latitude);

    // 计算合适的视角高度：确保能看到整个轨迹
    const targetDistance = boundingSphere.radius * 5;

    // 飞行到轨迹正上方，heading=0(北), pitch=-85(接近正俯视)
    camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, targetDistance),
      orientation: {
        heading: 0, // 北向
        pitch: Cesium.Math.toRadians(-85), // 接近正俯视
        roll: 0,
      },
      duration: 1.5,
    });
  };

  // 清除过境轨迹
  const clearPassTrajectory = () => {
    if (!viewer.value) return;

    passTrajectoryEntities.forEach((_, key) => {
      const entity = viewer.value!.entities.getById(key);
      if (entity) {
        viewer.value!.entities.remove(entity);
      }
    });
    passTrajectoryEntities.clear();
  };

  // ==================== 日照分析可视化 ====================

  // 日照轨道实体集合
  const sunlightOrbitEntities: Map<string, boolean> = new Map();

  // 日照轨道段接口
  interface OrbitSegment {
    startTime: string;
    endTime: string;
    status: "sunlight" | "eclipse";
    points: Array<{ lat: number; lng: number; alt: number }>;
  }

  /**
   * 显示日照分析轨道（按日照状态分段绘制）
   */
  const showSunlightOrbit = (noradId: string, segments: OrbitSegment[]) => {
    if (!viewer.value || !segments.length) return;

    // 清除该卫星之前的日照轨道
    clearSunlightOrbit(noradId);

    // 日照段颜色：金黄色
    const sunlightColor = Cesium.Color.fromCssColorString("#fbbf24");
    // 阴影段颜色：深蓝色
    const eclipseColor = Cesium.Color.fromCssColorString("#3b82f6");

    // 收集所有轨道点用于计算包围球
    const allPoints: Cesium.Cartesian3[] = [];

    // 按段绘制轨道
    segments.forEach((segment, index) => {
      if (!segment.points || segment.points.length < 2) return;

      const positions = segment.points.map((p) =>
        Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.alt),
      );

      // 收集点用于包围球计算
      allPoints.push(...positions);

      const color = segment.status === "sunlight" ? sunlightColor : eclipseColor;

      // 添加轨道线
      const orbitId = `sunlight_orbit_${noradId}_${index}`;
      viewer.value!.entities.add({
        id: orbitId,
        polyline: {
          positions,
          width: 3,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color,
          }),
        },
      });
      sunlightOrbitEntities.set(orbitId, true);

      // 添加段端点标记
      const startPoint = segment.points[0];
      if (startPoint) {
        const startMarkerId = `sunlight_marker_${noradId}_${index}_start`;
        viewer.value!.entities.add({
          id: startMarkerId,
          position: Cesium.Cartesian3.fromDegrees(startPoint.lng, startPoint.lat, startPoint.alt),
          point: {
            pixelSize: 6,
            color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1,
          },
        });
        sunlightOrbitEntities.set(startMarkerId, true);
      }
    });

    // 启用地球光照效果
    viewer.value.scene.globe.enableLighting = true;

    // 飞到日照轨道视图（保持当前视角，只拉远确保能看到整体）
    if (allPoints.length > 0) {
      const boundingSphere = Cesium.BoundingSphere.fromPoints(allPoints);
      const camera = viewer.value.camera;
      const currentHeading = camera.heading;
      const currentPitch = camera.pitch;
      const targetDistance = boundingSphere.radius * 3;

      const center = boundingSphere.center;
      const direction = new Cesium.Cartesian3();
      Cesium.Cartesian3.subtract(camera.position, center, direction);
      Cesium.Cartesian3.normalize(direction, direction);

      const newPosition = new Cesium.Cartesian3();
      Cesium.Cartesian3.multiplyByScalar(direction, targetDistance, newPosition);
      Cesium.Cartesian3.add(center, newPosition, newPosition);

      camera.flyTo({
        destination: newPosition,
        orientation: {
          heading: currentHeading,
          pitch: currentPitch,
          roll: 0,
        },
        duration: 1.5,
      });
    }
  };

  /**
   * 清除日照分析轨道
   */
  const clearSunlightOrbit = (noradId: string) => {
    if (!viewer.value) return;

    sunlightOrbitEntities.forEach((_, key) => {
      if (key.includes(noradId)) {
        const entity = viewer.value!.entities.getById(key);
        if (entity) {
          viewer.value!.entities.remove(entity);
        }
      }
    });

    // 从 Map 中移除
    const keysToRemove = Array.from(sunlightOrbitEntities.keys()).filter((k) =>
      k.includes(noradId),
    );
    keysToRemove.forEach((k) => sunlightOrbitEntities.delete(k));

    // 关闭地球光照效果
    viewer.value.scene.globe.enableLighting = false;
  };

  /**
   * 清除所有日照轨道
   */
  const clearAllSunlightOrbits = () => {
    if (!viewer.value) return;

    sunlightOrbitEntities.forEach((_, key) => {
      const entity = viewer.value!.entities.getById(key);
      if (entity) {
        viewer.value!.entities.remove(entity);
      }
    });
    sunlightOrbitEntities.clear();

    // 关闭地球光照效果
    viewer.value.scene.globe.enableLighting = false;
  };

  // ==================== 时间轴动画 ====================

  // 动画状态
  const animationState = ref({
    isPlaying: false,
    progress: 0, // 0-100
    currentTime: "",
    startTime: "",
    endTime: "",
    duration: 0, // 秒
  });

  // 动画相关实体
  let animationEntity: Cesium.Entity | null = null;
  let animationClockCallback: (() => void) | null = null;

  // 播放过境动画
  const playPassAnimation = (
    noradId: string,
    orbitPoints: Array<{ lat: number; lng: number; alt: number; timestamp?: string }>,
    options?: {
      speed?: number; // 播放速度倍数，默认 60（1秒=1分钟）
    },
  ) => {
    if (!viewer.value || !orbitPoints.length) return;

    // 停止之前的动画
    stopPassAnimation();

    const speed = options?.speed || 60; // 默认 60 倍速

    // 创建时间采样位置属性
    const positionProperty = new Cesium.SampledPositionProperty();

    orbitPoints.forEach((point) => {
      if (point && point.timestamp) {
        const time = Cesium.JulianDate.fromIso8601(point.timestamp);
        const position = Cesium.Cartesian3.fromDegrees(point.lng, point.lat, point.alt);
        positionProperty.addSample(time, position);
      }
    });

    // 获取时间范围
    const firstPoint = orbitPoints[0];
    const lastPoint = orbitPoints[orbitPoints.length - 1];
    if (!firstPoint?.timestamp || !lastPoint?.timestamp) return;

    const startTime = Cesium.JulianDate.fromIso8601(firstPoint.timestamp);
    const stopTime = Cesium.JulianDate.fromIso8601(lastPoint.timestamp);

    // 设置时钟
    const clock = viewer.value.clock;
    clock.startTime = startTime.clone();
    clock.stopTime = stopTime.clone();
    clock.currentTime = startTime.clone();
    clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    clock.multiplier = speed;
    clock.shouldAnimate = true;

    // 创建移动的卫星实体
    animationEntity = viewer.value.entities.add({
      id: `pass_animation_${noradId}`,
      availability: new Cesium.TimeIntervalCollection([
        new Cesium.TimeInterval({
          start: startTime,
          stop: stopTime,
        }),
      ]),
      position: positionProperty,
      model: {
        uri: satelliteModelUrl,
        minimumPixelSize: 32,
        maximumScale: 50000,
        scale: 20000,
      },
      path: {
        resolution: 60,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          color: Cesium.Color.fromCssColorString("#00ff88"),
        }),
        width: 1,
        leadTime: 0,
        trailTime: 300, // 显示5分钟的轨迹
      },
    });

    // 更新动画状态
    animationState.value.isPlaying = true;
    animationState.value.progress = 0;
    animationState.value.startTime = Cesium.JulianDate.toIso8601(startTime);
    animationState.value.endTime = Cesium.JulianDate.toIso8601(stopTime);
    animationState.value.duration = Cesium.JulianDate.secondsDifference(stopTime, startTime);

    // 设置时钟回调更新进度
    animationClockCallback = () => {
      if (!viewer.value) return;

      const currentTime = viewer.value.clock.currentTime;
      const progress =
        Cesium.JulianDate.secondsDifference(currentTime, startTime) /
        Cesium.JulianDate.secondsDifference(stopTime, startTime);

      animationState.value.progress = Math.max(0, Math.min(100, progress * 100));
      animationState.value.currentTime = Cesium.JulianDate.toIso8601(currentTime);

      // 动画结束时停止
      if (progress >= 1) {
        stopPassAnimation();
      }
    };

    viewer.value.clock.onTick.addEventListener(animationClockCallback);

    // 飞到轨迹视图（保持地球居中，不再自动飞行）
    // 动画播放时保持当前视角，避免相机跳动
  };

  // 停止动画
  const stopPassAnimation = () => {
    if (!viewer.value) return;

    // 移除时钟回调
    if (animationClockCallback) {
      viewer.value.clock.onTick.removeEventListener(animationClockCallback);
      animationClockCallback = null;
    }

    // 移除动画实体
    if (animationEntity) {
      viewer.value.entities.remove(animationEntity);
      animationEntity = null;
    }

    // 停止时钟动画
    viewer.value.clock.shouldAnimate = false;

    // 更新状态
    animationState.value.isPlaying = false;
  };

  // 暂停/继续动画
  const toggleAnimationPause = () => {
    if (!viewer.value) return;
    viewer.value.clock.shouldAnimate = !viewer.value.clock.shouldAnimate;
    animationState.value.isPlaying = viewer.value.clock.shouldAnimate;
  };

  // 设置动画进度（0-100）
  const setAnimationProgress = (progress: number) => {
    if (!viewer.value) return;

    const startTime = viewer.value.clock.startTime;
    const stopTime = viewer.value.clock.stopTime;
    const totalSeconds = Cesium.JulianDate.secondsDifference(stopTime, startTime);
    const targetSeconds = (progress / 100) * totalSeconds;

    const newTime = Cesium.JulianDate.addSeconds(startTime, targetSeconds, new Cesium.JulianDate());
    viewer.value.clock.currentTime = newTime;
    animationState.value.progress = progress;
    animationState.value.currentTime = Cesium.JulianDate.toIso8601(newTime);
  };

  // 设置播放速度
  const setAnimationSpeed = (speed: number) => {
    if (!viewer.value) return;
    viewer.value.clock.multiplier = speed;
  };

  // 飞到指定位置
  const flyToPosition = (
    position: { lat: number; lng: number; alt: number },
    distance?: number,
  ) => {
    if (!viewer.value) return;

    const { lat, lng, alt } = position;
    const flyDistance = distance || alt + 10000000;

    viewer.value.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, flyDistance),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-60),
        roll: 0,
      },
      duration: 1.5,
    });
  };

  // 飞到指定位置并标记
  const flyToAndMarkPoint = (
    position: { lat: number; lng: number; alt: number },
    pointId?: string,
    label?: string,
  ) => {
    if (!viewer.value) return;

    const { lat, lng, alt } = position;
    const id = pointId || `mark_point_${Date.now()}`;
    const labelText = label || "目标点";

    // 清除之前的标记
    const existingMark = viewer.value.entities.getById(id);
    if (existingMark) {
      viewer.value.entities.remove(existingMark);
    }

    // 飞到该位置（视角与点击详情卫星保持一致）
    viewer.value.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, alt + 500000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
      duration: 1.5,
    });

    // 添加标记点
    viewer.value.entities.add({
      id: id,
      position: Cesium.Cartesian3.fromDegrees(lng, lat, alt),
      point: {
        pixelSize: 15,
        color: Cesium.Color.fromCssColorString("#ff6b6b"),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.NONE,
      },
      label: {
        text: labelText,
        font: "12px sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString("rgba(255, 107, 107, 0.8)"),
      },
    });
  };

  // 清除标记点
  const clearMarkPoint = (pointId?: string) => {
    if (!viewer.value) return;

    if (pointId) {
      // 清除指定标记点
      const entity = viewer.value.entities.getById(pointId);
      if (entity) {
        viewer.value.entities.remove(entity);
      }
    } else {
      // 清除所有标记点（包括轨道点标记和时间位置标记）
      const idsToRemove: string[] = [];
      viewer.value.entities.values.forEach((entity) => {
        const id = entity.id?.toString() || "";
        if (id.startsWith("mark_point_") || id.startsWith("position_point_")) {
          idsToRemove.push(id);
        }
      });
      idsToRemove.forEach((id) => {
        const entity = viewer.value.entities.getById(id);
        if (entity) {
          viewer.value.entities.remove(entity);
        }
      });
    }
  };

  // 显示指定卫星标签（选中卫星）
  const showSatelliteLabel = (noradId: string, name?: string) => {
    if (!satelliteRenderer.value) return;

    // 先取消之前的选中
    satelliteRenderer.value.deselectSatellite();

    // 如果有名称，则选中该卫星
    if (name) {
      satelliteRenderer.value.selectSatellite(noradId, name);
    }
  };

  // 清除焦点卫星 - 只恢复其他卫星显示，不移除选中卫星的3D模型
  const clearFocusedSatellite = () => {
    if (satelliteRenderer.value) {
      satelliteRenderer.value.setFocusedSatellite(null);
    }
  };

  // 隐藏卫星标签（取消选中）
  const hideSatelliteLabel = () => {
    if (!satelliteRenderer.value) return;
    satelliteRenderer.value.deselectSatellite();
  };

  // 切换视角到卫星（最近距离查看）
  const flyToSatellite = (satellite: Satellite) => {
    if (!satellite || !viewer.value) return;

    const { position } = satellite;
    let destination: Cesium.Cartesian3 | null = null;

    if (
      position &&
      position.lng !== null &&
      position.lat !== null &&
      position.alt !== null &&
      !isNaN(position.lng) &&
      !isNaN(position.lat) &&
      !isNaN(position.alt)
    ) {
      destination = Cesium.Cartesian3.fromDegrees(
        position.lng,
        position.lat,
        position.alt + 20000000,
      );
    } else {
      // 列表卫星不再携带经纬度，从渲染器读取实时 ECEF 位置
      const ecef = satelliteRenderer.value?.getSatellitePosition(satellite.noradId);
      if (ecef) {
        const magnitude = Cesium.Cartesian3.magnitude(ecef);
        destination = Cesium.Cartesian3.normalize(
          ecef,
          new Cesium.Cartesian3(),
        );
        destination = Cesium.Cartesian3.multiplyByScalar(
          destination,
          magnitude + 20000000,
          destination,
        );
      }
    }

    if (!destination) return;

    viewer.value.camera.flyTo({
      destination: destination,
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
      duration: 1.5,
    });
  };

  // 清除所有轨道
  const clearAllOrbits = () => {
    if (!orbitCollection) return;

    orbitCollection.removeAll();
    orbitPolylines.clear();
  };

  // 清理卫星（兼容旧接口）
  const cleanupSatellites = (_currentNoradIds: string[]) => {
    // 新方案中 updateSatellites 已经处理了清理逻辑
  };

  // 设置卫星点击回调
  const setOnSatelliteClick = (callback: (noradId: string, name: string) => void) => {
    if (satelliteRenderer.value) {
      satelliteRenderer.value.setOnSatelliteClick(callback);
    }
  };

  // 设置颜色分类方式
  const setColorScheme = (scheme: ColorSchemeType) => {
    if (satelliteRenderer.value) {
      satelliteRenderer.value.setColorScheme(scheme);
    }
  };

  // 获取图例
  const getLegend = (): LegendItem[] => {
    if (satelliteRenderer.value) {
      return satelliteRenderer.value.getLegend();
    }
    return [];
  };

  // 销毁
  const destroyCesium = () => {
    if (satelliteRenderer.value) {
      satelliteRenderer.value.destroy();
      satelliteRenderer.value = null;
    }
    if (orbitCollection) {
      viewer.value?.scene.primitives.remove(orbitCollection);
      orbitCollection = null;
      orbitPolylines.clear();
    }
    if (globeAutoRotate) {
      globeAutoRotate.stop();
      globeAutoRotate = null;
    }
    if (viewer.value) {
      viewer.value.destroy();
      viewer.value = null;
    }
    predictedOrbitEntities.clear();
    isInitialized.value = false;
  };

  onUnmounted(() => {
    destroyCesium();
  });

  return {
    viewer,
    isInitialized,
    initCesium,
    updateSatellites,
    setValidSatelliteIds,
    updatePositions,
    clearAllSatellites,
    updateOrbit,
    removeOrbit,
    clearAllOrbits,
    flyToSatellite,
    showSatelliteLabel,
    hideSatelliteLabel,
    cleanupSatellites,
    showPredictedOrbit,
    flyToOrbit,
    clearPredictedOrbit,
    clearAllPredictedOrbits,
    showPassTrajectory,
    clearPassTrajectory,
    showSunlightOrbit,
    clearSunlightOrbit,
    clearAllSunlightOrbits,
    animationState,
    playPassAnimation,
    stopPassAnimation,
    toggleAnimationPause,
    setAnimationProgress,
    setAnimationSpeed,
    flyToPosition,
    flyToAndMarkPoint,
    clearMarkPoint,
    destroyCesium,
    setOnSatelliteClick,
    setColorScheme,
    getLegend,
    toggleAutoRotate,
    clearFocusedSatellite,
  };
}
