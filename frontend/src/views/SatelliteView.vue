<template>
  <div class="satellite-view">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <p class="loading-text">正在加载卫星数据...</p>
      </div>
    </div>

    <!-- 浮动状态指示器 -->
    <div v-show="!loading" class="floating-stats">
      <div class="stat-card">
        <div class="stat-icon satellites">
          <GlobalOutlined />
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ satelliteCount }}</span>
          <span class="stat-label">在轨卫星</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon time">
          <ClockCircleOutlined />
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ formattedLastUpdate }}</span>
          <span class="stat-label">最后更新</span>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-area">
      <!-- 左侧面板 - 可折叠 -->
      <transition name="slide-left">
        <aside v-if="activeLeftPanel === 'satellite-list'" class="sidebar">
          <div class="sidebar-header">
            <div class="header-title">
              <ThunderboltOutlined class="title-icon" />
              <span>卫星列表</span>
            </div>
            <a-button type="text" class="close-btn" @click="toggleLeftPanel('satellite-list')">
              <CloseOutlined />
            </a-button>
          </div>
          <SatelliteList
            :satellites="satellites"
            :selected-satellite="selectedSatellite"
            :countries="countries"
            :missions="missions"
            :favorited-ids="favoritedIds"
            v-model:filter-type="filterType"
            v-model:selected-country="selectedCountry"
            v-model:selected-mission="selectedMission"
            v-model:favorite-filter="favoriteFilter"
            @select-satellite="handleSelectSatellite"
            @reset-camera="handleResetCamera"
          />
        </aside>
      </transition>

      <!-- 左侧筛选面板 -->
      <transition name="slide-left">
        <aside v-if="activeLeftPanel === 'filter'" class="sidebar filter-panel">
          <div class="sidebar-header">
            <div class="header-title">
              <FilterOutlined class="title-icon" />
              <span>筛选</span>
            </div>
            <a-button type="text" class="close-btn" @click="toggleLeftPanel('filter')">
              <CloseOutlined />
            </a-button>
          </div>
          <div class="filter-content">
            <!-- 国家筛选 -->
            <div class="filter-section">
              <div class="filter-section-header" @click="toggleFilterSection('country')">
                <span class="section-title">
                  国家/地区
                  <span class="selected-tag">
                    <template v-if="selectedCountry">
                      <FlagIcon
                        :code="selectedCountry"
                        :country-name="getCountryName(selectedCountry)"
                        class="tag-flag"
                      />
                    </template>
                    {{ getCountryLabel(selectedCountry) }}
                  </span>
                </span>
                <DownOutlined :class="['expand-icon', { expanded: expandedSections.country }]" />
              </div>
              <transition name="collapse">
                <div v-show="expandedSections.country" class="filter-options country-options">
                  <div class="filter-search">
                    <input
                      v-model="countrySearch"
                      type="text"
                      placeholder="搜索国家..."
                      class="country-search-input"
                    />
                  </div>
                  <div
                    class="filter-option"
                    :class="{ active: !selectedCountry }"
                    @click="selectedCountry = ''"
                  >
                    <GlobalOutlined class="option-icon" />
                    <span>全部</span>
                  </div>
                  <div
                    v-for="country in filteredCountries"
                    :key="country.code"
                    class="filter-option"
                    :class="{ active: selectedCountry === country.code }"
                    @click="selectedCountry = country.code"
                  >
                    <FlagIcon
                      :code="country.code"
                      :country-name="getCountryName(country.code)"
                      class="country-flag"
                    />
                    <span class="country-name"
                      >{{ getCountryName(country.code) }}({{ country.code }})</span
                    >
                    <!-- <span class="country-count">{{ country.count }}</span> -->
                  </div>
                  <div v-if="filteredCountries.length === 0 && countrySearch" class="no-result">
                    未找到匹配的国家
                  </div>
                  <div v-if="countries.length === 0 && !countrySearch" class="no-result">
                    暂无国家数据
                  </div>
                </div>
              </transition>
            </div>

            <!-- 轨道类型筛选 -->
            <div class="filter-section">
              <div class="filter-section-header" @click="toggleFilterSection('orbit')">
                <span class="section-title">
                  轨道类型
                  <span class="selected-tag">{{ getOrbitTypeLabel(filterType) }}</span>
                </span>
                <DownOutlined :class="['expand-icon', { expanded: expandedSections.orbit }]" />
              </div>
              <transition name="collapse">
                <div v-show="expandedSections.orbit" class="filter-options">
                  <div
                    class="filter-option"
                    :class="{ active: filterType === 'all' }"
                    @click="filterType = 'all'"
                  >
                    <GlobalOutlined class="option-icon" />
                    <span>全部轨道</span>
                  </div>
                  <div
                    class="filter-option"
                    :class="{ active: filterType === 'leo' }"
                    @click="filterType = 'leo'"
                  >
                    <RocketOutlined class="option-icon leo" />
                    <span>低轨 (LEO)</span>
                  </div>
                  <div
                    class="filter-option"
                    :class="{ active: filterType === 'meo' }"
                    @click="filterType = 'meo'"
                  >
                    <RocketOutlined class="option-icon meo" />
                    <span>中轨 (MEO)</span>
                  </div>
                  <div
                    class="filter-option"
                    :class="{ active: filterType === 'geo' }"
                    @click="filterType = 'geo'"
                  >
                    <RocketOutlined class="option-icon geo" />
                    <span>地球同步 (GEO)</span>
                  </div>
                  <div
                    class="filter-option"
                    :class="{ active: filterType === 'heo' }"
                    @click="filterType = 'heo'"
                  >
                    <RocketOutlined class="option-icon heo" />
                    <span>高轨 (HEO)</span>
                  </div>
                </div>
              </transition>
            </div>

            <!-- 任务筛选 -->
            <div class="filter-section">
              <div class="filter-section-header" @click="toggleFilterSection('mission')">
                <span class="section-title">
                  用途分类
                  <span class="selected-tag">{{ getMissionLabel(selectedMission) }}</span>
                </span>
                <DownOutlined :class="['expand-icon', { expanded: expandedSections.mission }]" />
              </div>
              <transition name="collapse">
                <div v-show="expandedSections.mission" class="filter-options mission-options">
                  <div class="filter-search">
                    <input
                      v-model="missionSearch"
                      type="text"
                      placeholder="搜索任务..."
                      class="mission-search-input"
                    />
                  </div>
                  <div
                    class="filter-option"
                    :class="{ active: !selectedMission }"
                    @click="selectedMission = ''"
                  >
                    <GlobalOutlined class="option-icon" />
                    <span>全部</span>
                  </div>
                  <div
                    v-for="mission in filteredMissions"
                    :key="mission.name"
                    class="filter-option"
                    :class="{ active: selectedMission === mission.name }"
                    @click="selectedMission = mission.name"
                  >
                    <span class="option-name">{{ mission.name }}</span>
                    <!-- <span class="option-count">{{ mission.count }}</span> -->
                  </div>
                  <div v-if="filteredMissions.length === 0 && missionSearch" class="no-result">
                    未找到匹配的任务
                  </div>
                  <div v-else-if="missions.length === 0" class="no-result">暂无任务数据</div>
                </div>
              </transition>
            </div>

            <!-- 收藏筛选 -->
            <div class="filter-section">
              <div class="filter-section-header" @click="toggleFilterSection('favorite')">
                <span class="section-title">
                  收藏状态
                  <span class="selected-tag">{{ getFavoriteLabel(favoriteFilter) }}</span>
                </span>
                <DownOutlined :class="['expand-icon', { expanded: expandedSections.favorite }]" />
              </div>
              <transition name="collapse">
                <div v-show="expandedSections.favorite" class="filter-options">
                  <div
                    class="filter-option"
                    :class="{ active: favoriteFilter === 'all' }"
                    @click="favoriteFilter = 'all'"
                  >
                    <GlobalOutlined class="option-icon" />
                    <span>全部</span>
                  </div>
                  <div
                    class="filter-option"
                    :class="{ active: favoriteFilter === 'favorited' }"
                    @click="favoriteFilter = 'favorited'"
                  >
                    <StarFilled class="option-icon favorited" />
                    <span>已收藏</span>
                  </div>
                  <div
                    class="filter-option"
                    :class="{ active: favoriteFilter === 'unfavorited' }"
                    @click="favoriteFilter = 'unfavorited'"
                  >
                    <StarOutlined class="option-icon unfavorited" />
                    <span>未收藏</span>
                  </div>
                </div>
              </transition>
            </div>

            <!-- 颜色分类 -->
            <!-- <div class="filter-section">
              <div class="filter-section-header" @click="toggleFilterSection('color')">
                <span class="section-title">
                  颜色分类
                  <span class="selected-tag">{{ getColorSchemeLabel(colorScheme) }}</span>
                </span>
                <DownOutlined :class="['expand-icon', { expanded: expandedSections.color }]" />
              </div>
              <transition name="collapse">
                <div v-show="expandedSections.color" class="filter-options">
                  <div
                    class="filter-option"
                    :class="{ active: colorScheme === 'orbit' }"
                    @click="colorScheme = 'orbit'"
                  >
                    <RocketOutlined class="option-icon leo" />
                    <span>轨道分类</span>
                  </div>
                </div>
              </transition>
            </div> -->
          </div>
        </aside>
      </transition>

      <!-- 中央可视化区 -->
      <div class="visualization-area">
        <div id="cesium-container" class="cesium-container"></div>

        <!-- 图例 -->
        <SatelliteLegend />

        <!-- 底部功能栏 -->
        <div class="bottom-toolbar">
          <div class="toolbar-inner">
            <!-- <div
              class="tool-btn"
              :class="{ active: activeLeftPanel === 'filter' }"
              @click="toggleLeftPanel('filter')"
            >
              <FilterOutlined class="tool-icon" />
              <span class="tool-text hide-on-mobile">筛选</span>
            </div> -->
            <div
              class="tool-btn"
              :class="{ active: activeLeftPanel === 'satellite-list' }"
              @click="toggleLeftPanel('satellite-list')"
            >
              <UnorderedListOutlined class="tool-icon" />
              <span class="tool-text hide-on-mobile">卫星列表</span>
            </div>
            <div
              class="tool-btn"
              :class="{ active: activeRightPanel === 'orbit', disabled: !canUseAdvancedFeature }"
              @click="handleAdvancedFeatureClick('orbit', 'satellite_orbit')"
            >
              <RocketOutlined class="tool-icon" />
              <span class="tool-text hide-on-mobile">轨道预测</span>
            </div>
            <div
              class="tool-btn"
              :class="{ active: activeRightPanel === 'transit', disabled: !canUseAdvancedFeature }"
              @click="handleAdvancedFeatureClick('transit', 'satellite_passes')"
            >
              <EyeOutlined class="tool-icon" />
              <span class="tool-text hide-on-mobile">过境预测</span>
            </div>
            <div
              class="tool-btn"
              :class="{ active: activeRightPanel === 'sunlight', disabled: !canUseAdvancedFeature }"
              @click="handleAdvancedFeatureClick('sunlight', 'satellite_sunlight')"
            >
              <BulbOutlined class="tool-icon" />
              <span class="tool-text hide-on-mobile">日照分析</span>
            </div>
            <div class="tool-divider"></div>
            <a-tooltip title="全屏模式">
              <div class="tool-btn icon-only" @click="toggleFullscreen">
                <FullscreenOutlined class="tool-icon" />
              </div>
            </a-tooltip>
          </div>
        </div>
      </div>

      <!-- 右侧面板 - 可折叠 -->
      <transition name="slide-right">
        <aside v-if="activeRightPanel !== 'none'" class="detail-sidebar">
          <div class="sidebar-header">
            <div class="header-title">
              <component :is="getRightPanelIcon()" class="title-icon" />
              <span>{{ getRightPanelTitle() }}</span>
            </div>
            <a-button type="text" class="close-btn" @click="toggleRightPanel(activeRightPanel)">
              <CloseOutlined />
            </a-button>
          </div>

          <!-- 卫星详情 -->
          <SatelliteDetail
            v-if="activeRightPanel === 'detail'"
            :satellite="selectedSatellite"
            :metadata="selectedMetadata"
            @favorite-change="handleFavoriteChange"
          />

          <!-- 轨道预测 -->
          <div v-else-if="activeRightPanel === 'orbit'" class="panel-content">
            <OrbitPrediction
              ref="orbitPredictionRef"
              :satellite="selectedSatellite"
              @show-orbit="handleShowPredictedOrbit"
              @fly-to="handleFlyToPosition"
              @clear-orbit="handleClearOrbit"
              @remove-orbit="handleRemoveOrbit"
              @restore-orbit="handleRestoreOrbit"
              @mark-point="handleMarkPoint"
            />
          </div>

          <!-- 过境预测 -->
          <div v-else-if="activeRightPanel === 'transit'" class="panel-content">
            <PassPrediction
              ref="passPredictionRef"
              :satellite="selectedSatellite"
              @show-trajectory="handleShowPassTrajectory"
              @play-animation="handlePlayPassAnimation"
              @remove-orbit="handleRemoveOrbit"
              @restore-orbit="handleRestoreOrbit"
            />
          </div>

          <!-- 日照分析 -->
          <div v-else-if="activeRightPanel === 'sunlight'" class="panel-content">
            <SunlightAnalysis
              ref="sunlightAnalysisRef"
              :satellite="selectedSatellite"
              @show-sunlight-orbit="handleShowSunlightOrbit"
              @clear-sunlight-orbit="handleClearSunlightOrbit"
              @remove-orbit="handleRemoveOrbit"
              @restore-orbit="handleRestoreOrbit"
            />
          </div>
        </aside>
      </transition>
    </div>

    <!-- 登录确认弹窗 -->
    <ActionConfirmModal v-model:visible="loginConfirmVisible" type="login" redirect="/satellite" />

    <!-- 升级会员确认弹窗 -->
    <ActionConfirmModal
      v-model:visible="upgradeConfirmVisible"
      type="upgrade"
      redirect="/membership"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";
import {
  GlobalOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  FullscreenOutlined,
  UnorderedListOutlined,
  RocketOutlined,
  EyeOutlined,
  FilterOutlined,
  InfoCircleOutlined,
  DownOutlined,
  StarFilled,
  StarOutlined,
  BulbOutlined,
} from "@ant-design/icons-vue";
import ActionConfirmModal from "@/components/ActionConfirmModal.vue";
import SatelliteList from "@/components/SatelliteList.vue";
import SatelliteDetail from "@/components/SatelliteDetail.vue";
import OrbitPrediction from "@/components/OrbitPrediction.vue";
import PassPrediction from "@/components/PassPrediction.vue";
import SunlightAnalysis from "@/components/SunlightAnalysis.vue";
import FlagIcon from "@/components/FlagIcon.vue";
import SatelliteLegend from "@/components/SatelliteLegend.vue";
import * as Cesium from "cesium";
import { useCesium, type ColorSchemeType } from "@/hooks/useCesium";
import { useLocalSatellites } from "@/hooks/useLocalSatellites";
import { usePanel } from "@/hooks/usePanel";
import { useSatellite } from "@/hooks/useSatellite";
import { satelliteApi } from "@/api";
import { useUserStore } from "@/stores/user";
import { COUNTRY_NAMES, MISSION_CATEGORIES } from "@/constants/satellite";

const filterType = ref<string | null>(null);
const selectedCountry = ref<string | null>(null);
const selectedMission = ref<string | null>(null);
const favoriteFilter = ref<string | null>(null);
const loading = ref(true);
const userStore = useUserStore();

// 确认弹窗状态
const loginConfirmVisible = ref(false);
const upgradeConfirmVisible = ref(false);

// 颜色分类
const colorScheme = ref<ColorSchemeType>("orbit");

// 收藏的卫星 ID 集合
const favoritedIds = ref<Set<string>>(new Set());

// 高级功能权限检查
const canUseAdvancedFeature = computed(() => {
  // 未登录用户不能使用高级功能
  if (!userStore.isLoggedIn) return false;
  // 有任意一个高级功能权限即可使用
  return (
    userStore.hasFeature("satellite_orbit") ||
    userStore.hasFeature("satellite_sunlight") ||
    userStore.hasFeature("satellite_passes")
  );
});

// 处理高级功能按钮点击
function handleAdvancedFeatureClick(panel: string, featureCode: string) {
  if (!userStore.isLoggedIn) {
    loginConfirmVisible.value = true;
    return;
  }
  if (!userStore.hasFeature(featureCode)) {
    upgradeConfirmVisible.value = true;
    return;
  }
  toggleRightPanel(panel);
}

// 可折叠筛选区域状态
const expandedSections = ref({
  country: false,
  orbit: false,
  mission: false,
  favorite: false,
  color: false,
});

// 国家列表
const countries = ref<{ code: string; count: number }[]>([]);
const countrySearch = ref("");

// 任务列表
const missions = ref<{ name: string; count: number }[]>([]);
const missionSearch = ref("");

// 过滤后的国家列表
const filteredCountries = computed(() => {
  const list = countries.value;

  const nameToEntry = new Map<string, { code: string; count: number }>();

  list.forEach((c) => {
    const name = getCountryName(c.code);
    if (nameToEntry.has(name)) {
      const entry = nameToEntry.get(name)!;
      entry.count += c.count;
      if (name === "中国" && c.code === "CN") {
        entry.code = "CN";
      }
    } else {
      const code = name === "其他" ? "OTHER" : c.code;
      nameToEntry.set(name, { code, count: c.count });
    }
  });

  let result = Array.from(nameToEntry.values());

  // 自定义排序：中国 > 美国 > 俄罗斯 > 其他 > 其他按字母排序
  const priorityOrder: Record<string, number> = {
    中国: 0,
    美国: 1,
    俄罗斯: 2,
    其他: 100,
  };

  result.sort((a, b) => {
    const nameA = getCountryName(a.code);
    const nameB = getCountryName(b.code);
    const priorityA = priorityOrder[nameA] ?? 50;
    const priorityB = priorityOrder[nameB] ?? 50;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    if (priorityA === 50) {
      return b.count - a.count;
    }
    return 0;
  });

  if (countrySearch.value) {
    const search = countrySearch.value.toLowerCase();
    result = result.filter((c) => {
      const codeMatch = c.code.toLowerCase().includes(search);
      const nameMatch = getCountryName(c.code).includes(countrySearch.value);
      return codeMatch || nameMatch;
    });
  }

  return result;
});

// 过滤后的任务列表
const filteredMissions = computed(() => {
  let result = missions.value;

  // 排序：其他放到最后，其他按字母排序
  result = [...result].sort((a, b) => {
    if (a.name === "其他") return 1;
    if (b.name === "其他") return -1;
    return a.name.localeCompare(b.name);
  });

  if (missionSearch.value) {
    const search = missionSearch.value.toLowerCase();
    result = result.filter((m) => m.name.toLowerCase().includes(search));
  }

  return result;
});

// 任务分类函数
const categorizeMission = (mission: string | undefined): string => {
  if (!mission) return "其他";
  return MISSION_CATEGORIES[mission] || "其他";
};

// 获取国家中文名称
const getCountryName = (code: string): string => {
  return COUNTRY_NAMES[code] || "其他";
};

// 轨道类型标签（与列表格式一致）
const getOrbitTypeLabel = (type: string | null): string => {
  if (!type) return "全部轨道";
  const labels: Record<string, string> = {
    leo: "低轨(LEO)",
    meo: "中轨(MEO)",
    geo: "地球同步(GEO)",
    heo: "高轨(HEO)",
  };
  return labels[type] || "全部轨道";
};

// 收藏筛选标签
const getFavoriteLabel = (type: string | null): string => {
  if (!type) return "全部";
  const labels: Record<string, string> = {
    favorited: "已收藏",
    unfavorited: "未收藏",
  };
  return labels[type] || "全部";
};

// 颜色分类标签
const getColorSchemeLabel = (scheme: ColorSchemeType): string => {
  const labels: Record<ColorSchemeType, string> = {
    orbit: "轨道分类",
    mission: "任务分类",
    country: "国家分类",
    objectType: "类型分类",
  };
  return labels[scheme] || "轨道分类";
};

// 获取国家选择标签文本（不含国旗）
const getCountryLabel = (code: string | null): string => {
  if (!code) return "全部";
  // const country = countries.value.find((c) => c.code === code);
  // const count = country ? country.count : 0;
  return `${getCountryName(code)}(${code})`;
};

// 获取任务选择标签文本
const getMissionLabel = (mission: string | null): string => {
  if (!mission) return "全部";
  // const missionItem = missions.value.find((m) => m.name === mission);
  // const count = missionItem ? missionItem.count : 0;
  return `${mission}`;
};

// 切换筛选区域展开/折叠（同时关闭其他区域）
const toggleFilterSection = (section: "orbit" | "country" | "mission" | "favorite" | "color") => {
  // 如果当前区域是折叠状态，则展开它并关闭其他区域
  if (!expandedSections.value[section]) {
    expandedSections.value.orbit = section === "orbit";
    expandedSections.value.country = section === "country";
    expandedSections.value.mission = section === "mission";
    expandedSections.value.favorite = section === "favorite";
    expandedSections.value.color = section === "color";
  } else {
    // 如果当前区域是展开状态，则折叠它
    expandedSections.value[section] = false;
  }
};

// 初始化 hooks
const cesium = useCesium();
const localSatellites = useLocalSatellites();
const {
  activeLeftPanel,
  activeRightPanel,
  toggleLeftPanel,
  toggleRightPanel,
  showSatelliteDetail,
} = usePanel();

// 解构本地卫星数据
const { satellites, satelliteCount, lastUpdate } = localSatellites;

// 格式化最后更新时间
const formattedLastUpdate = computed(() => {
  if (!lastUpdate.value) return "--";

  const updateTime = new Date(lastUpdate.value);
  const hours = updateTime.getHours().toString().padStart(2, "0");
  const minutes = updateTime.getMinutes().toString().padStart(2, "0");
  const seconds = updateTime.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
});

// 筛选后的卫星列表
const filteredSatellites = computed(() => {
  let result = satellites.value;

  // 按轨道类型筛选（alt 单位是米）
  if (filterType.value) {
    result = result.filter((sat) => {
      if (sat.status === "error") return false;
      const alt = sat.position?.alt ?? 0;
      if (filterType.value === "leo") return alt < 2000000; // < 2000 km
      if (filterType.value === "meo") return alt >= 2000000 && alt < 35000000; // 2000-35000 km
      if (filterType.value === "geo") return alt >= 35000000 && alt < 45000000; // 35000-45000 km
      if (filterType.value === "heo") return alt >= 45000000; // >= 45000 km
      return true;
    });
  }

  // 按国家筛选（直接使用卫星数据中的字段）
  if (selectedCountry.value) {
    result = result.filter((sat) => sat.countryCode === selectedCountry.value);
  }

  // 按任务筛选（使用分类后的值进行比较）
  if (selectedMission.value) {
    result = result.filter((sat) => categorizeMission(sat.mission) === selectedMission.value);
  }

  // 按收藏筛选
  if (favoriteFilter.value === "favorited") {
    result = result.filter((sat) => favoritedIds.value.has(sat.noradId));
  } else if (favoriteFilter.value === "unfavorited") {
    result = result.filter((sat) => !favoritedIds.value.has(sat.noradId));
  }

  return result;
});

// 卫星选择逻辑
const {
  selectedSatellite,
  selectedMetadata,
  handleSelectSatellite: baseHandleSelectSatellite,
  clearSelection,
} = useSatellite(cesium, localSatellites);

// 子组件引用
const orbitPredictionRef = ref<InstanceType<typeof OrbitPrediction> | null>(null);
const passPredictionRef = ref<InstanceType<typeof PassPrediction> | null>(null);
const sunlightAnalysisRef = ref<InstanceType<typeof SunlightAnalysis> | null>(null);

// 获取右侧面板标题
const getRightPanelTitle = () => {
  switch (activeRightPanel.value) {
    case "detail":
      return "卫星详情";
    case "orbit":
      return "轨道预测";
    case "transit":
      return "过境预测";
    case "sunlight":
      return "日照分析";
    default:
      return "";
  }
};

// 获取右侧面板图标
const getRightPanelIcon = () => {
  switch (activeRightPanel.value) {
    case "detail":
      return InfoCircleOutlined;
    case "orbit":
      return RocketOutlined;
    case "transit":
      return EyeOutlined;
    case "sunlight":
      return BulbOutlined;
    default:
      return InfoCircleOutlined;
  }
};

// 选择卫星后显示详情
const handleSelectSatellite = (satellite: typeof selectedSatellite.value) => {
  if (!satellite) return;

  // 清除之前预测的轨道和过境轨迹
  if (cesium) {
    cesium.clearAllPredictedOrbits();
    cesium.clearPassTrajectory();
    cesium.stopPassAnimation();
    cesium.clearAllSunlightOrbits();
  }
  // 重置预测组件状态
  orbitPredictionRef.value?.reset();
  passPredictionRef.value?.reset();
  sunlightAnalysisRef.value?.reset();

  baseHandleSelectSatellite(satellite);
  showSatelliteDetail();
};

// 重置相机到初始位置（不旋转）
const handleResetCamera = () => {
  if (cesium.viewer?.value && cesium.isInitialized.value) {
    cesium.toggleAutoRotate(false);
    cesium.viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(116.39, 39.9, 140000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
    });
  }
};

// 处理 Cesium 点击卫星事件
const handleSatelliteClick = (noradId: string, _name: string) => {
  // 从卫星列表中找到对应的卫星
  const satellite = satellites.value.find((s) => s.noradId === noradId);
  if (satellite) {
    // 如果卫星列表面板未打开，才打开它
    if (activeLeftPanel.value !== "satellite-list") {
      toggleLeftPanel("satellite-list");
    }
    // 选中卫星并显示详情
    handleSelectSatellite(satellite);
  }
};

// 显示预测轨道
const handleShowPredictedOrbit = (points: Array<{ lat: number; lng: number; alt: number }>) => {
  if (cesium && selectedSatellite.value) {
    cesium.showPredictedOrbit(selectedSatellite.value.noradId, points);
    // 飞行到能看到整体轨道的位置
    cesium.flyToOrbit(points);
  }
};

// 飞到指定位置
const handleFlyToPosition = (position: { lat: number; lng: number; alt: number }) => {
  if (cesium) {
    cesium.flyToAndMarkPoint(position);
  }
};

// 清除预测轨道
const handleClearOrbit = (noradId: string) => {
  if (cesium && noradId) {
    cesium.clearPredictedOrbit(noradId);
    // 清除标记点
    cesium.clearMarkPoint();
  }
};

// 删除详情轨道（开始预测时）
const handleRemoveOrbit = (noradId: string) => {
  if (cesium && noradId) {
    cesium.removeOrbit(noradId);
  }
};

// 恢复详情轨道（清除预测时，重新获取最新数据）
const handleRestoreOrbit = async (noradId: string) => {
  if (!cesium || !selectedSatellite.value) return;

  try {
    const res = await satelliteApi.getDetail(noradId);
    if (res.data.code === 0 && res.data.data.orbit?.orbitPoints) {
      cesium.updateOrbit(noradId, res.data.data.orbit.orbitPoints);
    }
  } catch (error) {
    console.error("恢复详情轨道失败:", error);
  }
};

// 标记指定时间位置
const handleMarkPoint = (position: { lat: number; lng: number; alt: number }, label: string) => {
  if (cesium) {
    cesium.flyToAndMarkPoint(position, `position_point_${Date.now()}`, label);
  }
};

// 显示日照分析轨道
const handleShowSunlightOrbit = (
  segments: Array<{
    startTime: string;
    endTime: string;
    status: "sunlight" | "eclipse";
    points: Array<{ lat: number; lng: number; alt: number }>;
  }>,
) => {
  if (!cesium || !selectedSatellite.value) return;

  // 清除之前的日照轨道
  cesium.clearSunlightOrbit(selectedSatellite.value.noradId);

  // 显示新的日照轨道
  cesium.showSunlightOrbit(selectedSatellite.value.noradId, segments);
};

// 清除日照分析轨道
const handleClearSunlightOrbit = (noradId: string) => {
  if (cesium && noradId) {
    cesium.clearSunlightOrbit(noradId);
  }
};

// 显示过境轨迹
const handleShowPassTrajectory = async (data: {
  noradId: string;
  startTime: string;
  endTime: string;
  observer: { lat: number; lng: number; alt: number };
}) => {
  if (!cesium) return;

  try {
    // 停止任何正在播放的动画
    cesium.stopPassAnimation();

    // 清除之前的过境轨迹
    cesium.clearPassTrajectory();

    // 计算过境时段的轨道数据
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    const durationMinutes = Math.ceil((endTime.getTime() - startTime.getTime()) / 60000);

    const res = await satelliteApi.getOrbit(data.noradId, {
      startTime: data.startTime,
      duration: durationMinutes,
      steps: Math.min(durationMinutes * 2, 200), // 每分钟2个点，最多200点
    });

    if (res.data.code === 0 && res.data.data?.orbitPoints) {
      cesium.showPassTrajectory(data.noradId, res.data.data.orbitPoints, data.observer, {
        startTime: data.startTime,
        endTime: data.endTime,
      });
    }
  } catch (error) {
    console.error("获取过境轨迹失败:", error);
  }
};

// 播放过境动画
const handlePlayPassAnimation = async (data: {
  noradId: string;
  startTime: string;
  endTime: string;
  observer: { lat: number; lng: number; alt: number };
}) => {
  if (!cesium) return;

  try {
    // 停止之前的动画
    cesium.stopPassAnimation();

    // 清除之前的轨迹
    cesium.clearPassTrajectory();

    // 计算过境时段的轨道数据
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    const durationMinutes = Math.ceil((endTime.getTime() - startTime.getTime()) / 60000);

    const res = await satelliteApi.getOrbit(data.noradId, {
      startTime: data.startTime,
      duration: durationMinutes,
      steps: Math.min(durationMinutes * 2, 200),
    });

    if (res.data.code === 0 && res.data.data?.orbitPoints) {
      // 显示过境轨迹
      cesium.showPassTrajectory(data.noradId, res.data.data.orbitPoints, data.observer, {
        startTime: data.startTime,
        endTime: data.endTime,
      });

      // 播放动画
      cesium.playPassAnimation(data.noradId, res.data.data.orbitPoints, {
        speed: 60, // 60倍速播放
      });
    }
  } catch (error) {
    console.error("播放过境动画失败:", error);
  }
};

// 监听筛选后的卫星数据变化，更新 Cesium（移除 deep watch，只监听数组引用变化）
watch(filteredSatellites, (newSatellites) => {
  if (newSatellites && newSatellites.length > 0) {
    // 使用批量更新替代逐个更新，大幅提升性能
    cesium.updateSatellites(newSatellites);
  } else {
    // 当筛选结果为空时，清除所有卫星
    cesium.clearAllSatellites?.();
  }
});

// 监听颜色分类变化
watch(colorScheme, (newScheme) => {
  cesium.setColorScheme?.(newScheme);
});

// 监听右侧面板变化，当轨道预测或过境预测面板关闭时恢复详情轨道
watch(activeRightPanel, (newPanel, oldPanel) => {
  if (!selectedSatellite.value) return;

  if (oldPanel === "orbit" && newPanel !== "orbit") {
    // 清除预测轨道
    cesium.clearPredictedOrbit(selectedSatellite.value.noradId);
    // 清除标记点
    cesium.clearMarkPoint();
    // 恢复详情轨道
    handleRestoreOrbit(selectedSatellite.value.noradId);
  }

  if (oldPanel === "transit" && newPanel !== "transit") {
    // 清除过境轨迹
    cesium.clearPassTrajectory();
    // 停止过境动画
    cesium.stopPassAnimation();
    // 恢复详情轨道
    handleRestoreOrbit(selectedSatellite.value.noradId);
  }

  if (oldPanel === "sunlight" && newPanel !== "sunlight") {
    // 清除日照轨道
    cesium.clearSunlightOrbit(selectedSatellite.value.noradId);
    // 恢复详情轨道
    handleRestoreOrbit(selectedSatellite.value.noradId);
  }

  if (oldPanel === "detail" && newPanel === "none") {
    // 关闭详情面板时，恢复显示所有卫星（保留选中状态和轨道）
    cesium.clearFocusedSatellite();
  }
});

// 获取用户收藏的卫星
async function fetchFavorites() {
  if (!userStore.isLoggedIn) return;
  try {
    const res = await satelliteApi.getFavorites();
    if (res.data.code === 0 && res.data.data) {
      favoritedIds.value = new Set(res.data.data.map((fav: { noradId: string }) => fav.noradId));
    }
  } catch {
    // 忽略错误
  }
}

// 处理收藏状态变化
function handleFavoriteChange(noradId: string, favorited: boolean) {
  if (favorited) {
    favoritedIds.value.add(noradId);
  } else {
    favoritedIds.value.delete(noradId);
  }
  // 触发响应式更新
  favoritedIds.value = new Set(favoritedIds.value);
}

// 监听卫星数据加载状态，当就绪时关闭 loading
watch(
  () => localSatellites.state.value.status,
  (status) => {
    if (status === "ready" || status === "error") {
      loading.value = false;
    }
  },
);

// 延迟初始化 - 先渲染页面，再加载数据
onMounted(async () => {
  // 使用 requestAnimationFrame 确保 DOM 已渲染
  requestAnimationFrame(() => {
    // 初始化 Cesium
    cesium.initCesium();

    // 设置卫星点击回调
    cesium.setOnSatelliteClick(handleSatelliteClick);

    // 加载 TLE 数据并初始化本地计算
    localSatellites.loadTLEData();
  });

  // 加载国家列表
  try {
    const res = await satelliteApi.getCountries();
    if (res.data.code === 0) {
      countries.value = res.data.data || [];
    }
  } catch (err) {
    console.error("加载国家列表失败:", err);
  }

  // 加载任务列表
  try {
    const missionRes = await satelliteApi.getMissions();
    if (missionRes.data.code === 0) {
      missions.value = missionRes.data.data || [];
    }
  } catch (err) {
    console.error("加载任务列表失败:", err);
  }

  // 加载收藏列表
  await fetchFavorites();
});

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};
</script>

<style scoped lang="scss">
.satellite-view {
  height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  background: #0a0a0f;
  position: relative;
  overflow: hidden;
}

// 加载状态
.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 15, 0.95);
  z-index: 1000;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(0, 212, 255, 0.2);
  border-top-color: #00d4ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin: 0;
}

// 浮动状态指示器
.floating-stats {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 16px;
  z-index: 100;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: rgba(15, 15, 25, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 212, 255, 0.12);
  border-radius: 16px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(0, 212, 255, 0.25);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.5),
      0 0 30px rgba(0, 212, 255, 0.1);
  }

  .stat-icon {
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    font-size: 18px;
    transition: all 0.3s;

    &.satellites {
      background: linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(0, 212, 255, 0.05) 100%);
      color: #00d4ff;
      box-shadow: 0 0 20px rgba(0, 212, 255, 0.2);
    }

    &.connection {
      background: linear-gradient(135deg, rgba(255, 77, 77, 0.15) 0%, rgba(255, 77, 77, 0.05) 100%);
      color: #ff4d4d;

      &.connected {
        background: linear-gradient(
          135deg,
          rgba(0, 255, 136, 0.15) 0%,
          rgba(0, 255, 136, 0.05) 100%
        );
        color: #00ff88;
        box-shadow: 0 0 20px rgba(0, 255, 136, 0.2);
        animation: pulse-glow 2s ease-in-out infinite;
      }
    }

    &.time {
      background: linear-gradient(
        135deg,
        rgba(123, 44, 191, 0.15) 0%,
        rgba(123, 44, 191, 0.05) 100%
      );
      color: #7b2cbf;
    }

    &.filter {
      background: linear-gradient(135deg, rgba(255, 170, 0, 0.15) 0%, rgba(255, 170, 0, 0.05) 100%);
      color: #ffaa00;
    }
  }

  .stat-info {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .stat-value {
      font-size: 15px;
      font-weight: 600;
      color: #fff;
      letter-spacing: 0.5px;
    }

    .stat-label {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.45);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: 0 0 20px rgba(0, 255, 136, 0.2);
  }
  50% {
    box-shadow: 0 0 30px rgba(0, 255, 136, 0.4);
  }
}

// 颜色分类选择卡片（已移动到筛选面板）

// 主内容区
.main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

// 侧边栏通用样式 - 绝对定位
.sidebar,
.detail-sidebar {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 320px;
  background: rgba(12, 12, 20, 0.95);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  z-index: 50;
}

.sidebar {
  left: 0;
  border-right: 1px solid rgba(0, 212, 255, 0.08);
}

.detail-sidebar {
  right: 0;
  border-left: 1px solid rgba(0, 212, 255, 0.08);
}

.sidebar-header {
  height: 56px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(0, 212, 255, 0.08);
  flex-shrink: 0;

  .header-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 600;
    color: #fff;

    .title-icon {
      font-size: 16px;
      color: #00d4ff;
    }
  }

  .close-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.5);
    border-radius: 8px;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 77, 77, 0.1);
      color: #ff4d4d;
    }
  }
}

// 面板内容
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 212, 255, 0.15);
    border-radius: 2px;
  }
}

// 可视化区域
.visualization-area {
  flex: 1;
  position: relative;
  background: radial-gradient(ellipse at center, #0f1628 0%, #0a0a0f 70%);
}

.cesium-container {
  position: absolute;
  inset: 0;

  // 隐藏 Cesium 底部信息栏
  :deep(.cesium-viewer-bottom) {
    display: none !important;
  }

  :deep(.cesium-widget-credits) {
    display: none !important;
  }

  :deep(.cesium-credit-logoContainer) {
    display: none !important;
  }

  :deep(.cesium-credit-textContainer) {
    display: none !important;
  }

  // 隐藏 Cesium 右侧工具栏（包含搜索按钮）
  :deep(.cesium-viewer-toolbar) {
    display: none !important;
  }

  :deep(.cesium-toolbar-button) {
    display: none !important;
  }

  // 隐藏地理编码器/搜索框
  :deep(.cesium-geocoder) {
    display: none !important;
  }

  :deep(.cesium-geocoder-input) {
    display: none !important;
  }

  // 隐藏所有 Cesium 按钮
  :deep(.cesium-button) {
    display: none !important;
  }
}

// 底部功能栏
.bottom-toolbar {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
}

.toolbar-inner {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: rgba(15, 15, 25, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 212, 255, 0.15);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.6);

  &:hover {
    background: rgba(0, 212, 255, 0.1);
    color: #00d4ff;
  }

  &.active {
    background: linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 212, 255, 0.1) 100%);
    color: #00d4ff;
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.2);
  }

  &.disabled {
    opacity: 0.4;
    cursor: not-allowed;

    &:hover {
      background: transparent;
      color: rgba(255, 255, 255, 0.4);
    }
  }

  &.icon-only {
    padding: 10px;
  }

  .tool-icon {
    font-size: 16px;
  }

  .tool-text {
    font-size: 13px;
    font-weight: 500;
  }
}

.tool-divider {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 8px;
}

// 筛选面板样式
.filter-panel {
  .filter-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .filter-section {
    margin-bottom: 8px;
    background: rgba(0, 212, 255, 0.02);
    border: 1px solid rgba(0, 212, 255, 0.06);
    border-radius: 12px;
    overflow: hidden;
  }

  .filter-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(0, 212, 255, 0.04);
    }

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.85);
      display: flex;
      align-items: center;
      gap: 8px;

      .selected-tag {
        font-size: 11px;
        font-weight: 500;
        color: #00d4ff;
        background: rgba(0, 212, 255, 0.15);
        padding: 2px 8px;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        gap: 4px;

        .tag-flag {
          width: 14px;
          height: 10px;
        }
      }
    }

    .expand-icon {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
      transition: transform 0.3s ease;

      &.expanded {
        transform: rotate(180deg);
      }
    }
  }

  .filter-options {
    padding: 0 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;

    .mission-search-input {
      width: 100%;
      padding: 8px 12px;
      background: rgba(0, 212, 255, 0.04);
      border: 1px solid rgba(0, 212, 255, 0.1);
      border-radius: 8px;
      color: #fff;
      font-size: 12px;
      outline: none;
      transition: all 0.2s;

      &::placeholder {
        color: rgba(255, 255, 255, 0.3);
      }

      &:focus {
        border-color: rgba(0, 212, 255, 0.3);
        background: rgba(0, 212, 255, 0.06);
      }
    }
  }

  .filter-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: rgba(0, 212, 255, 0.02);
    border: 1px solid transparent;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: rgba(255, 255, 255, 0.65);
    font-size: 13px;

    &:hover {
      background: rgba(0, 212, 255, 0.06);
      border-color: rgba(0, 212, 255, 0.1);
    }

    &.active {
      background: linear-gradient(135deg, rgba(0, 212, 255, 0.12) 0%, rgba(0, 212, 255, 0.06) 100%);
      border-color: rgba(0, 212, 255, 0.25);
      color: #00d4ff;
    }

    .option-icon {
      font-size: 15px;
      color: rgba(0, 212, 255, 0.6);

      &.leo {
        color: #00ff88;
      }
      &.meo {
        color: #00d4ff;
      }
      &.geo {
        color: #b366e8;
      }
      &.heo {
        color: #ffaa00;
      }
      &.favorited {
        color: #ffc107;
      }
      &.unfavorited {
        color: rgba(255, 255, 255, 0.4);
      }
    }

    .country-flag {
      width: 20px;
      height: 15px;
      margin-right: 4px;
      flex-shrink: 0;
    }

    .country-name {
      flex: 1;
    }

    .country-count {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.4);
      background: rgba(255, 255, 255, 0.05);
      padding: 2px 6px;
      border-radius: 4px;
    }
  }

  // 国家搜索
  .country-options {
    .filter-search {
      padding: 0 0 8px;
    }

    .country-search-input {
      width: 100%;
      padding: 8px 12px;
      background: rgba(0, 212, 255, 0.04);
      border: 1px solid rgba(0, 212, 255, 0.1);
      border-radius: 8px;
      color: #fff;
      font-size: 12px;
      outline: none;
      transition: all 0.2s;

      &::placeholder {
        color: rgba(255, 255, 255, 0.3);
      }

      &:focus {
        border-color: rgba(0, 212, 255, 0.3);
        background: rgba(0, 212, 255, 0.06);
      }
    }

    .no-result {
      text-align: center;
      padding: 16px;
      color: rgba(255, 255, 255, 0.4);
      font-size: 12px;
    }
  }
}

// 折叠动画
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 500px;
}

// 过渡动画
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.35s ease;
}

.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.35s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// 移动端响应式 - 底部功能栏
@media (max-width: 768px) {
  .bottom-toolbar {
    bottom: 16px;
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    max-width: calc(100vw + 20px);
  }

  .toolbar-inner {
    justify-content: space-around;
    padding: 6px 8px;
    border-radius: 12px;
  }

  .tool-btn {
    padding: 10px;

    &.icon-only {
      padding: 10px;
    }

    .tool-text {
      display: none;
    }

    .hide-on-mobile {
      display: none;
    }
  }

  .tool-divider {
    display: none;
  }

  .floating-stats {
    display: none;
  }
}
</style>
