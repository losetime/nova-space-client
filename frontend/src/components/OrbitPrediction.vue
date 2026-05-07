<template>
  <div class="orbit-prediction">
    <div v-if="!satellite" class="no-satellite">
      <span>请先选择一颗卫星</span>
    </div>

    <template v-else>
      <!-- 预测参数设置 -->
      <div class="prediction-params">
        <div class="param-group">
          <label>预测时长</label>
          <a-select v-model:value="duration" class="param-select">
            <a-select-option :value="90">1.5 小时（约1圈）</a-select-option>
            <a-select-option :value="180">3 小时（约2圈）</a-select-option>
            <a-select-option :value="360">6 小时（约4圈）</a-select-option>
            <a-select-option :value="720">12 小时（约8圈）</a-select-option>
            <a-select-option :value="1440">24 小时（约16圈）</a-select-option>
          </a-select>
        </div>

        <div class="param-group">
          <label>开始时间</label>
          <a-date-picker
            v-model:value="startTime"
            show-time
            format="YYYY-MM-DD HH:mm"
            class="param-datepicker"
            :disabled-date="disabledDate"
          />
        </div>
      </div>

      <!-- 预测按钮 -->
      <div class="predict-btn-wrapper">
        <a-button type="primary" class="predict-btn" :loading="loading" @click="handlePredict">
          <template #icon><CalculatorOutlined /></template>
          开始预测
        </a-button>
        <a-button class="clear-btn" dashed @click="handleClearOrbit">
          <template #icon><DeleteOutlined /></template>
          清除轨道
        </a-button>
      </div>

      <!-- 预测结果 -->
      <div v-if="prediction" class="prediction-result">
        <div class="result-header">
          <span class="result-title">预测结果</span>
          <a-tag color="cyan">{{ prediction.orbit.length }} 个轨道点</a-tag>
        </div>

        <div class="result-stats">
          <div class="stat-item">
            <span class="stat-label">轨道周期</span>
            <span class="stat-value">{{ prediction.orbitalPeriod || "--" }} 分钟</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">预测时长</span>
            <span class="stat-value">{{ prediction.duration }} 分钟</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">开始时间</span>
            <span class="stat-value">{{ formatTime(prediction.startTime) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">结束时间</span>
            <span class="stat-value">{{ formatTime(prediction.endTime) }}</span>
          </div>
        </div>

        <!-- 轨道点列表 -->
        <div class="orbit-points">
          <div class="points-header" @click="showPoints = !showPoints">
            <span>轨道点详情</span>
            <DownOutlined :class="{ rotated: showPoints }" />
          </div>
          <transition name="slide">
            <div v-show="showPoints" class="points-list">
              <div
                v-for="(point, index) in displayPoints"
                :key="index"
                class="point-item"
                @click="handlePointClick(point)"
              >
                <div class="point-index">{{ index + 1 }}</div>
                <div class="point-info">
                  <span class="point-time">{{ formatTime(point.timestamp) }}</span>
                  <span class="point-coords">
                    纬度:{{ point.lat.toFixed(2) }}°, 经度:{{ point.lng.toFixed(2) }}°
                  </span>
                </div>
                <div class="point-alt">{{ (point.alt / 1000).toFixed(2) }} km</div>
                <!-- <div class="point-alt">{{ point.alt }} km</div> -->
              </div>
              <div
                v-if="prediction.orbit.length > 10"
                class="show-more"
                @click="showAllPoints = !showAllPoints"
              >
                {{ showAllPoints ? "收起" : `显示全部 ${prediction.orbit.length} 个点` }}
              </div>
            </div>
          </transition>
        </div>
      </div>

      <!-- 单点位置预测 -->
      <div class="position-prediction">
        <div class="section-title">
          <EnvironmentOutlined />
          <span>指定时间位置</span>
        </div>
        <div class="position-input">
          <a-date-picker
            v-model:value="positionTime"
            show-time
            format="YYYY-MM-DD HH:mm"
            class="position-datepicker"
            :disabled-date="disabledDate"
          />
          <a-button
            type="default"
            size="small"
            :loading="positionLoading"
            @click="handlePositionPredict"
          >
            查询
          </a-button>
        </div>

        <div v-if="positionResult" class="position-result">
          <div class="pos-item">
            <span class="pos-label">经度</span>
            <span class="pos-value">{{ positionResult.position.lng.toFixed(4) }}°</span>
          </div>
          <div class="pos-item">
            <span class="pos-label">纬度</span>
            <span class="pos-value">{{ positionResult.position.lat.toFixed(4) }}°</span>
          </div>
          <div class="pos-item">
            <span class="pos-label">高度</span>
            <span class="pos-value">{{ (positionResult.position.alt / 1000).toFixed(1) }} km</span>
          </div>
          <div class="pos-item">
            <span class="pos-label">速度</span>
            <span class="pos-value">{{ positionResult.velocity.total.toFixed(2) }} km/s</span>
          </div>
          <div v-if="positionResult.orbitalInfo" class="orbital-info">
            <div class="orbital-item">
              <span>轨道周期: {{ positionResult.orbitalInfo.period }} 分钟</span>
            </div>
            <div class="orbital-item">
              <span>轨道倾角: {{ positionResult.orbitalInfo.inclination }}°</span>
            </div>
            <div class="orbital-item">
              <span>离心率: {{ positionResult.orbitalInfo.eccentricity }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import dayjs, { type Dayjs } from "dayjs";
import {
  CalculatorOutlined,
  DeleteOutlined,
  DownOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import { satelliteApi, type OrbitPrediction, type PositionPrediction } from "@/api";
import type { Satellite } from "@/hooks/useLocalSatellites";

const props = defineProps<{
  satellite: Satellite | null;
}>();

const emit = defineEmits<{
  (e: "showOrbit", points: Array<{ lat: number; lng: number; alt: number }>): void;
  (e: "flyTo", position: { lat: number; lng: number; alt: number }): void;
  (e: "clearOrbit", noradId: string): void;
  (e: "removeOrbit", noradId: string): void;
  (e: "restoreOrbit", noradId: string): void;
  (e: "markPoint", position: { lat: number; lng: number; alt: number }, label: string): void;
}>();

// 重置预测数据
const reset = () => {
  prediction.value = null;
  positionResult.value = null;
  showPoints.value = false;
  showAllPoints.value = false;
};

// 暴露给父组件调用
defineExpose({ reset });

// 预测参数
const duration = ref(360);
const startTime = ref<Dayjs>(dayjs());
const loading = ref(false);
const prediction = ref<OrbitPrediction | null>(null);
const showPoints = ref(false);
const showAllPoints = ref(false);

// 单点位置预测
const positionTime = ref<Dayjs>(dayjs());
const positionLoading = ref(false);
const positionResult = ref<PositionPrediction | null>(null);

// 显示的轨道点（默认只显示前10个）
const displayPoints = computed(() => {
  if (!prediction.value) return [];
  if (showAllPoints.value) return prediction.value.orbit;
  return prediction.value.orbit.slice(0, 10);
});

// 禁用过去的日期
const disabledDate = (current: Dayjs) => {
  return current && current < dayjs().startOf("day");
};

// 格式化时间
const formatTime = (time: string | undefined) => {
  if (!time) return "--";
  return dayjs(time).format("MM-DD HH:mm:ss");
};

// 清除轨道
const handleClearOrbit = () => {
  if (props.satellite) {
    emit("clearOrbit", props.satellite.noradId);
    // 恢复详情轨道
    emit("restoreOrbit", props.satellite.noradId);
    prediction.value = null;
  }
};

// 开始预测
const handlePredict = async () => {
  if (!props.satellite) return;

  // 清除之前的预测结果
  prediction.value = null;
  positionResult.value = null;
  showPoints.value = false;
  showAllPoints.value = false;

  // 删除详情轨道（避免干扰预测轨道显示）
  emit("removeOrbit", props.satellite.noradId);
  // 清除之前的预测轨道
  emit("clearOrbit", props.satellite.noradId);

  loading.value = true;
  try {
    const res = await satelliteApi.predictOrbit(props.satellite.noradId, {
      startTime: startTime.value.toISOString(),
      duration: duration.value,
      steps: Math.min(duration.value, 200),
      intervalSeconds: 60, // 60秒采样间隔，与SpaceMapper对齐
    });

    if (res.data.code === 0) {
      prediction.value = res.data.data;
      // 通知父组件显示轨道
      emit("showOrbit", prediction.value.orbit);
    } else {
      message.error(res.data.message || "轨道预测失败");
    }
  } catch (error: unknown) {
    console.error("轨道预测失败:", error);
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    message.error(err.response?.data?.message || err.message || "轨道预测请求失败，请稍后重试");
  } finally {
    loading.value = false;
  }
};

// 单点位置预测
const handlePositionPredict = async () => {
  if (!props.satellite) return;

  positionLoading.value = true;
  try {
    const res = await satelliteApi.predictPosition(
      props.satellite.noradId,
      positionTime.value.toISOString(),
    );

    if (res.data.code === 0) {
      positionResult.value = res.data.data;
      // 标记这个位置
      emit("markPoint", res.data.data.position, positionTime.value.format("MM-DD HH:mm"));
    } else {
      message.error(res.data.message || "位置预测失败");
    }
  } catch (error: unknown) {
    console.error("位置预测失败:", error);
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    message.error(err.response?.data?.message || err.message || "位置预测请求失败，请稍后重试");
  } finally {
    positionLoading.value = false;
  }
};

// 点击轨道点
const handlePointClick = (point: { lat: number; lng: number; alt: number; timestamp?: string }) => {
  emit("flyTo", point);
};
</script>

<style scoped lang="scss">
$primary: #00d4ff;
$primary-light: #7dd3fc;
$accent: #a855f7;
$bg-card: rgba(255, 255, 255, 0.03);
$bg-elevated: rgba(255, 255, 255, 0.06);
$text-primary: rgba(255, 255, 255, 0.95);
$text-secondary: rgba(255, 255, 255, 0.6);
$text-muted: rgba(255, 255, 255, 0.4);

.orbit-prediction {
  // padding 由父组件控制
}

.no-satellite {
  text-align: center;
  padding: 24px;
  color: $text-muted;
  font-size: 13px;
}

.prediction-params {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.param-group {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 12px;
    color: $text-secondary;
  }
}

.param-select,
.param-datepicker,
.position-datepicker {
  width: 100%;

  :deep(.ant-select-selector),
  :deep(.ant-picker) {
    background: rgba(20, 20, 28, 1) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    border-radius: 8px !important;
    color: $text-primary !important;

    &:hover {
      border-color: rgba($primary, 0.4) !important;
    }
  }

  :deep(.ant-select-arrow),
  :deep(.ant-picker-suffix) {
    color: $text-muted;
  }
}

.predict-btn-wrapper {
  display: flex;
  gap: 8px;

  .predict-btn {
    flex: 1;
    width: 100%;
    height: 40px;
    background: linear-gradient(135deg, $primary 0%, $accent 100%);
    border: none;
    border-radius: 8px;
    font-weight: 600;

    &:hover {
      opacity: 0.9;
    }
  }

  .clear-btn {
    height: 40px;
    border-radius: 8px;
    font-weight: 500;
  }
}

.prediction-result {
  margin-top: 20px;
  padding: 16px;
  background: $bg-card;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.result-title {
  font-size: 13px;
  font-weight: 600;
  color: $text-primary;
}

.result-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;

  .stat-label {
    font-size: 11px;
    color: $text-muted;
  }

  .stat-value {
    font-size: 13px;
    color: $text-primary;
  }
}

.orbit-points {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 12px;
}

.points-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  font-size: 12px;
  color: $text-secondary;
  padding: 4px 0;

  .anticon {
    transition: transform 0.2s;

    &.rotated {
      transform: rotate(180deg);
    }
  }
}

.points-list {
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }
}

.point-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba($primary, 0.1);
  }
}

.point-index {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba($primary, 0.15);
  border-radius: 4px;
  font-size: 11px;
  color: $primary;
}

.point-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.point-time {
  font-size: 11px;
  color: $text-secondary;
}

.point-coords {
  font-size: 10px;
  color: $text-muted;
}

.point-alt {
  font-size: 12px;
  color: $primary;
}

.show-more {
  text-align: center;
  padding: 8px;
  font-size: 12px;
  color: $primary;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.position-prediction {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 12px;

  .anticon {
    color: $accent;
  }
}

.position-input {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;

  .position-datepicker {
    flex: 1;
  }
}

.position-result {
  padding: 12px;
  background: $bg-card;
  border-radius: 8px;
}

.pos-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);

  &:last-child {
    border-bottom: none;
  }

  .pos-label {
    font-size: 12px;
    color: $text-muted;
  }

  .pos-value {
    font-size: 12px;
    color: $text-primary;
    font-weight: 500;
  }
}

.orbital-info {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.orbital-item {
  font-size: 11px;
  color: $text-secondary;
  padding: 4px 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
