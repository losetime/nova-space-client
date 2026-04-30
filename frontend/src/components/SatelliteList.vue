<template>
  <div class="satellite-list">
    <!-- 搜索区域 -->
    <div class="search-section">
      <div class="search-wrapper">
        <SearchOutlined class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索卫星名称或 ID"
          class="search-input"
        />
        <transition name="fade">
          <div v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
            <CloseCircleOutlined />
          </div>
        </transition>
      </div>
      <SatelliteFilters
        v-if="showFilters"
        v-model:filter-type="filterType"
        v-model:selected-country="selectedCountry"
        v-model:selected-mission="selectedMission"
        v-model:favorite-filter="favoriteFilter"
        :countries="props.countries"
        :missions="props.missions"
      />
      <div class="search-meta">
        <span class="result-count">
          <span class="count">{{ filteredSatellites.length }}</span>
          <span class="divider">/</span>
          <span class="total">{{ satellites.length }}</span>
        </span>
        <div class="meta-actions">
          <transition name="fade">
            <button v-if="hasActiveFilters" class="reset-btn" @click="handleReset">
              <ReloadOutlined />
              重置
            </button>
          </transition>
          <button class="filter-toggle-btn" @click="showFilters = !showFilters">
            {{ showFilters ? "收起" : "更多筛选" }}
          </button>
        </div>
      </div>
    </div>

    <!-- 卫星列表 -->
    <div class="list-container" v-bind="containerProps">
      <div v-bind="wrapperProps" class="satellite-items">
        <div
          v-for="{ data: satellite } in list"
          :key="satellite.noradId"
          :class="[
            'satellite-item',
            {
              active: selectedSatellite?.noradId === satellite.noradId,
              error: satellite.status === 'error',
            },
          ]"
          @click="$emit('select-satellite', satellite)"
        >
          <!-- 卫星图标 -->
          <div class="sat-icon">
            <div class="orbit-ring"></div>
            <div class="sat-dot"></div>
          </div>

          <!-- 卫星信息 -->
          <div class="sat-content">
            <div class="sat-header">
              <span class="sat-name">{{ satellite.name }}</span>
              <span class="sat-id">#{{ satellite.noradId }}</span>
            </div>
            <div class="sat-meta">
              <template v-if="satellite.status === 'error'">
                <span class="orbit-badge error-badge">数据异常</span>
              </template>
              <template v-else>
                <span :class="['orbit-badge', getOrbitClass(satellite.position?.alt ?? 0)]">
                  {{ getOrbitType(satellite.position?.alt ?? 0) }}
                </span>
                <span class="alt-value">
                  <ArrowUpOutlined class="alt-icon" />
                  {{ formatAlt(satellite.position?.alt ?? 0) }} km
                </span>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="filteredSatellites.length === 0" class="empty-state">
        <div class="empty-icon">
          <GlobalOutlined />
        </div>
        <p>没有找到匹配的卫星</p>
        <span>尝试使用其他关键词搜索</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useVirtualList } from "@vueuse/core";
import {
  SearchOutlined,
  CloseCircleOutlined,
  GlobalOutlined,
  ArrowUpOutlined,
  ReloadOutlined,
} from "@ant-design/icons-vue";
import type { Satellite } from "@/hooks/useLocalSatellites";
import SatelliteFilters from "./SatelliteFilters.vue";
import { MISSION_CATEGORIES } from "@/constants/satellite";
interface Country {
  code: string;
  count: number;
}

interface Mission {
  name: string;
  count: number;
}

interface Props {
  satellites: Satellite[];
  selectedSatellite: Satellite | null;
  countries?: Country[];
  missions?: Mission[];
  favoritedIds?: Set<string>;
  filterType?: string | null;
  selectedCountry?: string | null;
  selectedMission?: string | null;
  favoriteFilter?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  countries: () => [],
  missions: () => [],
  favoritedIds: () => new Set(),
  filterType: null,
  selectedCountry: null,
  selectedMission: null,
  favoriteFilter: null,
});

const emit = defineEmits<{
  "select-satellite": [satellite: Satellite];
  "update:filterType": [value: string | null];
  "update:selectedCountry": [value: string | null];
  "update:selectedMission": [value: string | null];
  "update:favoriteFilter": [value: string | null];
  "reset-camera": [];
}>();

const filterType = computed({
  get: () => props.filterType,
  set: (val) => emit("update:filterType", val),
});

const selectedCountry = computed({
  get: () => props.selectedCountry,
  set: (val) => emit("update:selectedCountry", val),
});

const selectedMission = computed({
  get: () => props.selectedMission,
  set: (val) => emit("update:selectedMission", val),
});

const favoriteFilter = computed({
  get: () => props.favoriteFilter,
  set: (val) => emit("update:favoriteFilter", val),
});

const searchQuery = ref("");
const showFilters = ref(false);

const hasActiveFilters = computed(() => {
  return (
    !!filterType.value ||
    !!selectedCountry.value ||
    !!selectedMission.value ||
    favoriteFilter.value !== null ||
    !!searchQuery.value
  );
});

const resetAllFilters = () => {
  searchQuery.value = "";
  filterType.value = null;
  selectedCountry.value = null;
  selectedMission.value = null;
  favoriteFilter.value = null;
};

const handleReset = () => {
  resetAllFilters();
  emit("reset-camera");
};

const filteredSatellites = computed(() => {
  let result = props.satellites;

  // 按轨道类型筛选（排除status为error的，因为没有位置数据）
  if (filterType.value) {
    result = result.filter((sat) => {
      if (sat.status === "error") return false;
      const alt = sat.position?.alt ?? 0;
      if (filterType.value === "leo") return alt < 2000000;
      if (filterType.value === "meo") return alt >= 2000000 && alt < 35000000;
      if (filterType.value === "geo") return alt >= 35000000 && alt < 45000000;
      if (filterType.value === "heo") return alt >= 45000000;
      return true;
    });
  }

  // 按国家筛选
  if (selectedCountry.value) {
    result = result.filter((sat) => sat.countryCode === selectedCountry.value);
  }

  // 按任务筛选
  if (selectedMission.value) {
    result = result.filter((sat) => {
      const categorizeMission = (mission: string | undefined): string => {
        if (!mission) return "其他";
        return MISSION_CATEGORIES[mission] || "其他";
      };
      return categorizeMission(sat.mission) === selectedMission.value;
    });
  }

  // 按收藏筛选
  if (favoriteFilter.value === "favorited") {
    result = result.filter((sat) => props.favoritedIds?.has(sat.noradId));
  } else if (favoriteFilter.value === "unfavorited") {
    result = result.filter((sat) => !props.favoritedIds?.has(sat.noradId));
  }

  // 按搜索关键词筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (sat) => sat.name.toLowerCase().includes(query) || sat.noradId.toLowerCase().includes(query),
    );
  }

  return result;
});

// 虚拟滚动配置
const ITEM_HEIGHT = 72; // 列表项高度（包含 margin）
const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(filteredSatellites, {
  itemHeight: ITEM_HEIGHT,
  overscan: 10, // 预渲染可见区域外的项目数
});

// 搜索时滚动到顶部
watch(searchQuery, () => {
  scrollTo(0);
});

const getOrbitType = (alt: number): string => {
  if (alt < 2000000) return "LEO"; // < 2000 km
  if (alt < 35000000) return "MEO"; // < 35000 km
  return "GEO";
};

const getOrbitClass = (alt: number): string => {
  if (alt < 2000000) return "leo";
  if (alt < 35000000) return "meo";
  return "geo";
};

const formatAlt = (alt: number): string => {
  return (alt / 1000).toFixed(0); // 转换为公里
};
</script>

<style scoped lang="scss">
.satellite-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// 搜索区域
.search-section {
  padding: 16px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.08);
  flex-shrink: 0;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;

  .search-icon {
    position: absolute;
    left: 14px;
    color: rgba(255, 255, 255, 0.35);
    font-size: 14px;
    transition: all 0.3s;
  }

  .search-input {
    width: 100%;
    padding: 12px 40px;
    background: rgba(0, 212, 255, 0.04);
    border: 1px solid rgba(0, 212, 255, 0.12);
    border-radius: 14px;
    color: #fff;
    font-size: 13px;
    outline: none;
    transition: all 0.3s ease;

    &::placeholder {
      color: rgba(255, 255, 255, 0.3);
    }

    &:hover {
      border-color: rgba(0, 212, 255, 0.25);
    }

    &:focus {
      border-color: #00d4ff;
      background: rgba(0, 212, 255, 0.08);
      box-shadow:
        0 0 0 3px rgba(0, 212, 255, 0.1),
        0 0 20px rgba(0, 212, 255, 0.1);

      & + .search-icon,
      & ~ .search-icon {
        color: #00d4ff;
      }
    }
  }

  .search-clear {
    position: absolute;
    right: 12px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;

    &:hover {
      color: #00d4ff;
      background: rgba(0, 212, 255, 0.15);
    }
  }
}

.search-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;

  .result-count {
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;

    .count {
      color: #00d4ff;
      font-weight: 600;
    }

    .divider {
      color: rgba(255, 255, 255, 0.3);
    }

    .total {
      color: rgba(255, 255, 255, 0.5);
    }
  }

  .filter-toggle-btn {
    padding: 4px 12px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    background: rgba(0, 212, 255, 0.08);
    border: 1px solid rgba(0, 212, 255, 0.2);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: #00d4ff;
      background: rgba(0, 212, 255, 0.12);
      border-color: rgba(0, 212, 255, 0.35);
    }
  }

  .meta-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .reset-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 77, 77, 0.08);
    border: 1px solid rgba(255, 77, 77, 0.2);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: #ff4d4d;
      background: rgba(255, 77, 77, 0.12);
      border-color: rgba(255, 77, 77, 0.35);
    }

    .anticon {
      font-size: 11px;
    }
  }
}

// 列表容器
.list-container {
  flex: 1;
  min-height: 0; // 关键：允许 flex 子元素缩小
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 212, 255, 0.15);
    border-radius: 3px;

    &:hover {
      background: rgba(0, 212, 255, 0.3);
    }
  }
}

.satellite-items {
  padding: 12px;
}

.satellite-items .satellite-item {
  margin-bottom: 8px;
}

// 卫星列表项
.satellite-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid transparent;
  transition: all 0.3s ease;
  position: relative;

  &:hover {
    background: rgba(0, 212, 255, 0.06);
    border-color: rgba(0, 212, 255, 0.15);
    transform: translateX(4px);

    .orbit-ring {
      border-color: rgba(0, 212, 255, 0.3);
    }

    .sat-dot {
      box-shadow: 0 0 12px rgba(0, 255, 136, 0.6);
    }
  }

  &.active {
    background: rgba(0, 212, 255, 0.1);
    border-color: rgba(0, 212, 255, 0.3);
    box-shadow: 0 0 30px rgba(0, 212, 255, 0.1);

    .sat-name {
      color: #00d4ff;
    }

    .orbit-ring {
      border-color: rgba(0, 212, 255, 0.5);
      animation: spin 8s linear infinite;
    }

    .sat-dot {
      background: #00d4ff;
      box-shadow: 0 0 15px rgba(0, 212, 255, 0.8);
    }
  }

  &.error {
    opacity: 0.6;

    .sat-dot {
      background: #ff4d4d;
      animation: none;
    }

    .orbit-ring {
      border-color: rgba(255, 77, 77, 0.3);
    }
  }
}

// 卫星图标
.sat-icon {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  .orbit-ring {
    position: absolute;
    width: 36px;
    height: 36px;
    border: 2px solid rgba(0, 212, 255, 0.15);
    border-radius: 50%;
    transition: all 0.3s;
  }

  .sat-dot {
    width: 10px;
    height: 10px;
    background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
    border-radius: 50%;
    position: relative;
    z-index: 1;
    animation: pulse 2.5s ease-in-out infinite;
    box-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.7;
  }
}

// 卫星内容
.sat-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sat-header {
  display: flex;
  align-items: center;
  gap: 8px;

  .sat-name {
    font-size: 14px;
    font-weight: 500;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.3s;
  }

  .sat-id {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
    flex-shrink: 0;
  }
}

.sat-meta {
  display: flex;
  align-items: center;
  gap: 10px;

  .orbit-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    &.leo {
      background: rgba(0, 255, 136, 0.12);
      color: #00ff88;
    }

    &.meo {
      background: rgba(0, 212, 255, 0.12);
      color: #00d4ff;
    }

    &.geo {
      background: rgba(123, 44, 191, 0.12);
      color: #b366e8;
    }

    &.error-badge {
      background: rgba(255, 77, 77, 0.12);
      color: #ff4d4d;
    }
  }

  .alt-value {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);

    .alt-icon {
      font-size: 10px;
      color: rgba(0, 212, 255, 0.6);
    }
  }
}

// 空状态
.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;

  .empty-icon {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 212, 255, 0.05);
    border-radius: 50%;
    margin-bottom: 20px;

    .anticon {
      font-size: 36px;
      color: rgba(0, 212, 255, 0.3);
      animation: float 3s ease-in-out infinite;
    }
  }

  p {
    font-size: 15px;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 6px;
  }

  span {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

// fade 过渡
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
