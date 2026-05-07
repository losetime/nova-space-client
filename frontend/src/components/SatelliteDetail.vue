<template>
  <div class="satellite-detail" v-if="satellite">
    <!-- 卫星头部 -->
    <div class="detail-header">
      <div class="sat-visual">
        <div class="orbit-container">
          <div class="orbit-path"></div>
          <div class="satellite-marker">
            <div class="marker-dot"></div>
            <div class="marker-glow"></div>
          </div>
        </div>
      </div>
      <div class="sat-title">
        <h3>{{ satellite.name }}</h3>
        <div class="sat-ids">
          <span class="norad-id">NORAD #{{ satellite.noradId }}</span>
          <span v-if="metadata?.objectId" class="object-id">{{ metadata.objectId }}</span>
        </div>
      </div>
      <!-- 关注按钮 -->
      <button
        class="follow-btn"
        :class="{ followed: isFavorited }"
        :disabled="followLoading"
        @click="handleToggleFavorite"
      >
        <template v-if="followLoading">
          <LoadingOutlined class="spin" />
        </template>
        <template v-else>
          <StarFilled v-if="isFavorited" />
          <StarOutlined v-else />
        </template>
      </button>
    </div>

    <!-- 基本信息 -->
    <div class="section" v-if="metadata">
      <div class="section-header" @click="toggleSection('basic')">
        <div class="header-left">
          <InfoCircleOutlined class="section-icon" />
          <span>基本信息</span>
        </div>
        <DownOutlined :class="['expand-icon', { expanded: expandedSections.basic }]" />
      </div>
      <transition name="collapse">
        <div v-show="expandedSections.basic" class="section-content">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">别名</span>
              <span class="info-value alt-names">{{ metadata.altName || "--" }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">NORAD编号</span>
              <span class="info-value alt-names">{{ satellite.noradId || "--" }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">所属国家/组织</span>
              <span class="info-value">
                <template v-if="metadata.countryCode">
                  <FlagIcon
                    :code="metadata.countryCode"
                    :country-name="getCountryName(metadata.countryCode)"
                    class="country-flag"
                  />
                  {{ getCountryName(metadata.countryCode) }}
                </template>
                <template v-else>--</template>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">在轨状态</span>
              <span class="info-value">
                {{ getStatusLabel(metadata.status) }}
              </span>
            </div>
            <!-- <div class="info-item">
              <span class="info-label">对象类型</span>
              <span :class="['info-value', 'type-badge', getObjectTypeClass(metadata.objectType)]">
                {{ getObjectTypeLabel(metadata.objectType) }}
              </span>
            </div> -->
            <div class="info-item">
              <span class="info-label">COSPAR编号</span>
              <span class="info-value">{{ metadata.cosparId || "--" }}</span>
            </div>
            <!-- <div class="info-item">
              <span class="info-label">ESA分类</span>
              <span class="info-value">{{ metadata.objectClass || "--" }}</span>
            </div> -->
            <!-- <div class="info-item">
              <span class="info-label">预测衰减日期</span>
              <span class="info-value">{{
                metadata.predDecayDate ? formatDate(metadata.predDecayDate) : "--"
              }}</span>
            </div> -->
          </div>
        </div>
      </transition>
    </div>

    <!-- 轨道参数 -->
    <div class="section" v-if="satellite?.position">
      <div
        class="section-header"
        :class="{ disabled: !canViewOrbit }"
        @click="toggleSection('orbit')"
      >
        <div class="header-left">
          <CompassOutlined class="section-icon" />
          <span>轨道参数</span>
        </div>
        <DownOutlined :class="['expand-icon', { expanded: expandedSections.orbit }]" />
      </div>
      <transition name="collapse">
        <div v-show="expandedSections.orbit" class="section-content">
          <div class="param-grid">
            <div class="param-card">
              <div class="param-icon lng">
                <EnvironmentOutlined />
              </div>
              <div class="param-content">
                <label>经度</label>
                <span class="param-value">{{ formatLongitude(satellite.position?.lng ?? 0) }}</span>
              </div>
            </div>
            <div class="param-card">
              <div class="param-icon lat">
                <EnvironmentOutlined />
              </div>
              <div class="param-content">
                <label>纬度</label>
                <span class="param-value">{{ formatLatitude(satellite.position?.lat ?? 0) }}</span>
              </div>
            </div>
            <div class="param-card">
              <div class="param-icon alt">
                <RocketOutlined />
              </div>
              <div class="param-content">
                <label>轨道高度</label>
                <span class="param-value"
                  >{{ formatNumber((satellite.position?.alt ?? 0) / 1000, 2) }} km</span
                >
              </div>
            </div>
            <div class="param-card">
              <div class="param-icon orbit">
                <GlobalOutlined />
              </div>
              <div class="param-content">
                <label>轨道类型</label>
                <span
                  :class="[
                    'param-value',
                    'orbit-type',
                    getOrbitClass(satellite.position?.alt ?? 0),
                  ]"
                >
                  {{ getOrbitType(satellite.position?.alt ?? 0) }}
                </span>
              </div>
            </div>
          </div>
          <!-- 轨道特征 -->
          <div class="orbit-features" v-if="metadata">
            <div class="feature-item">
              <div class="feature-icon"><ThunderboltOutlined /></div>
              <div class="feature-content">
                <div class="feature-labels">
                  <span>近地点</span>
                  <span>远地点</span>
                </div>
                <div class="feature-values">
                  <span>{{
                    metadata.perigee ? `${metadata.perigee.toLocaleString()} km` : "--"
                  }}</span>
                  <span>{{
                    metadata.apogee ? `${metadata.apogee.toLocaleString()} km` : "--"
                  }}</span>
                </div>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon"><ClockCircleOutlined /></div>
              <div class="feature-content">
                <div class="feature-row">
                  <span class="feature-label">轨道周期</span>
                  <span class="feature-value">{{
                    metadata.period != null ? `${metadata.period.toFixed(1)} 分钟` : "--"
                  }}</span>
                </div>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon"><AimOutlined /></div>
              <div class="feature-content">
                <div class="feature-row">
                  <span class="feature-label">轨道倾角</span>
                  <span class="feature-value">{{
                    metadata.inclination != null ? `${metadata.inclination.toFixed(2)}°` : "--"
                  }}</span>
                </div>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon"><RadiusSettingOutlined /></div>
              <div class="feature-content">
                <div class="feature-row">
                  <span class="feature-label">偏心率</span>
                  <span class="feature-value">{{
                    metadata.eccentricity != null ? metadata.eccentricity.toFixed(6) : "--"
                  }}</span>
                </div>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon"><CompassOutlined /></div>
              <div class="feature-content">
                <div class="feature-row">
                  <span class="feature-label">升交点赤经</span>
                  <span class="feature-value">{{
                    metadata.raan != null ? `${metadata.raan.toFixed(2)}°` : "--"
                  }}</span>
                </div>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon"><AimOutlined /></div>
              <div class="feature-content">
                <div class="feature-row">
                  <span class="feature-label">近地点幅角</span>
                  <span class="feature-value">{{
                    metadata.argOfPerigee != null ? `${metadata.argOfPerigee.toFixed(2)}°` : "--"
                  }}</span>
                </div>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon"><ClockCircleOutlined /></div>
              <div class="feature-content">
                <div class="feature-row">
                  <span class="feature-label">TLE历元时间</span>
                  <span class="feature-value">{{
                    metadata.tleEpoch ? formatDateTime(metadata.tleEpoch) : "--"
                  }}</span>
                </div>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon"><ClockCircleOutlined /></div>
              <div class="feature-content">
                <div class="feature-row">
                  <span class="feature-label">TLE数据年龄</span>
                  <span
                    :class="[
                      'feature-value',
                      {
                        warning: computedTleAge != null && computedTleAge > 7,
                        old: computedTleAge != null && computedTleAge > 14,
                      },
                    ]"
                  >
                    {{ computedTleAge != null ? `${computedTleAge} 天` : "--" }}
                  </span>
                </div>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon"><CompassOutlined /></div>
              <div class="feature-content">
                <div class="feature-row">
                  <span class="feature-label">标准星等</span>
                  <span class="feature-value">{{
                    metadata.stdMag != null ? `${metadata.stdMag.toFixed(2)}` : "--"
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- 发射信息 -->
    <div class="section" v-if="metadata">
      <div
        class="section-header"
        :class="{ disabled: !canViewLaunch }"
        @click="toggleSection('launch')"
      >
        <div class="header-left">
          <RocketOutlined class="section-icon" />
          <span>发射信息</span>
        </div>
        <DownOutlined :class="['expand-icon', { expanded: expandedSections.launch }]" />
      </div>
      <transition name="collapse">
        <div v-show="expandedSections.launch" class="section-content">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">发射日期</span>
              <span class="info-value">{{
                metadata.launchDate ? formatDate(metadata.launchDate) : "--"
              }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">首次轨道历元</span>
              <span class="info-value">{{
                metadata.firstEpoch ? formatDate(metadata.firstEpoch) : "--"
              }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">发射地点</span>
              <span class="info-value">{{
                metadata.launchSite ? getLaunchSiteName(metadata.launchSite) : "--"
              }}</span>
            </div>
            <!-- <div class="info-item">
              <span class="info-label">发射场</span>
              <span class="info-value">{{ metadata.launchSiteName || "--" }}</span>
            </div> -->
            <div class="info-item">
              <span class="info-label">发射工位</span>
              <span class="info-value">{{ metadata.launch_pad || "--" }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">运载工具</span>
              <span class="info-value">{{ metadata.launchVehicle || "--" }}</span>
            </div>
            <!-- <div class="info-item">
              <span class="info-label">发射序号</span>
              <span class="info-value">{{ metadata.flightNo || "--" }}</span>
            </div> -->
            <!-- <div class="info-item">
              <span class="info-label">COSPAR发射编号</span>
              <span class="info-value">{{ metadata.cosparLaunchNo || "--" }}</span>
            </div> -->
            <!-- <div class="info-item">
              <span class="info-label">发射状态</span>
              <span
                :class="[
                  'info-value',
                  'status-badge',
                  metadata.launchFailure ? 'decayed' : 'active',
                ]"
              >
                {{ metadata.launchFailure ? "发射失败" : "发射成功" }}
              </span>
            </div> -->
            <div class="info-item">
              <span class="info-label">衰减日期</span>
              <span class="info-value">{{
                metadata.decayDate ? formatDate(metadata.decayDate) : "--"
              }}</span>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- 技术规格 -->
    <div class="section" v-if="metadata">
      <div
        class="section-header"
        :class="{ disabled: !canViewTechnical }"
        @click="toggleSection('technical')"
      >
        <div class="header-left">
          <ToolOutlined class="section-icon" />
          <span>技术规格</span>
        </div>
        <DownOutlined :class="['expand-icon', { expanded: expandedSections.technical }]" />
      </div>
      <transition name="collapse">
        <div v-show="expandedSections.technical" class="section-content">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">发射质量</span>
              <span class="info-value">{{
                metadata.launchMass ? `${metadata.launchMass.toLocaleString()} kg` : "--"
              }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">干质量</span>
              <span class="info-value">{{
                metadata.dryMass ? `${metadata.dryMass.toLocaleString()} kg` : "--"
              }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">形状</span>
              <span class="info-value">{{ metadata.shape || "--" }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">尺寸</span>
              <span class="info-value">{{
                metadata.dimensions ? `${metadata.dimensions} m` : "--"
              }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">翼展</span>
              <span class="info-value">{{ metadata.span ? `${metadata.span} m` : "--" }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">长度</span>
              <span class="info-value">{{ metadata.length ? `${metadata.length} m` : "--" }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">直径</span>
              <span class="info-value">{{
                metadata.diameter ? `${metadata.diameter} m` : "--"
              }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">平台</span>
              <span class="info-value">{{ metadata.bus || "--" }}</span>
            </div>
            <!-- -->
            <div class="info-item full-width">
              <span class="info-label">载荷</span>
              <span class="info-value text-left">{{ metadata.payload || "--" }}</span>
            </div>
            <div class="info-item full-width">
              <span class="info-label">设备信息</span>
              <span class="info-value text-left">{{ metadata.equipment || "--" }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">姿态控制</span>
              <span class="info-value">{{ metadata.adcs || "--" }}</span>
            </div>
            <div class="info-item full-width">
              <span class="info-label">电源系统</span>
              <span class="info-value text-left">{{ metadata.power || "--" }}</span>
            </div>
            <div class="info-item full-width">
              <span class="info-label">推进系统</span>
              <span class="info-value text-left">{{ metadata.motor || "--" }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">雷达截面</span>
              <span class="info-value">{{ metadata.rcs || "--" }}㎡</span>
            </div>
            <div class="info-item">
              <span class="info-label">配置</span>
              <span class="info-value">{{ metadata.configuration || "--" }}</span>
            </div>
            <div class="info-item full-width">
              <span class="info-label">材料组成</span>
              <span class="info-value text-left">{{ metadata.material_composition || "--" }}</span>
            </div>
            <div class="info-item full-width">
              <span class="info-label">发射频率</span>
              <span class="info-value text-left">{{
                metadata.transmitter_frequencies || "--"
              }}</span>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- 任务与运营 -->
    <div class="section" v-if="metadata">
      <div
        class="section-header"
        :class="{ disabled: !canViewMission }"
        @click="toggleSection('mission')"
      >
        <div class="header-left">
          <TeamOutlined class="section-icon" />
          <span>任务与运营</span>
        </div>
        <DownOutlined :class="['expand-icon', { expanded: expandedSections.mission }]" />
      </div>
      <transition name="collapse">
        <div v-show="expandedSections.mission" class="section-content">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">任务用途</span>
              <span class="info-value mission">{{ metadata.mission || "--" }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">运营商</span>
              <span
                v-if="metadata.operator"
                class="info-value clickable-company"
                @click="openCompanyDetail(metadata.operator)"
              >
                {{ metadata.operator }}
              </span>
              <span v-else class="info-value">--</span>
            </div>
            <div class="info-item">
              <span class="info-label">承包商</span>
              <span
                v-if="metadata.contractor"
                class="info-value clickable-company"
                @click="openCompanyDetail(metadata.contractor)"
              >
                {{ metadata.contractor }}
              </span>
              <span v-else class="info-value">--</span>
            </div>
            <div class="info-item">
              <span class="info-label">制造商</span>
              <span
                v-if="metadata.manufacturer"
                class="info-value clickable-company"
                @click="openCompanyDetail(metadata.manufacturer)"
              >
                {{ metadata.manufacturer }}
              </span>
              <span v-else class="info-value">--</span>
            </div>
            <div class="info-item">
              <span class="info-label">星座名称</span>
              <span class="info-value">{{ metadata.constellationName || "--" }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">设计寿命</span>
              <span class="info-value">{{ metadata.lifetime || "--" }}</span>
            </div>
            <div class="info-item full-width">
              <span class="info-label">主要事件</span>
              <span class="info-value text-left">{{ metadata.major_events || "--" }}</span>
            </div>
            <div class="info-item full-width">
              <span class="info-label">相关卫星</span>
              <span class="info-value text-left">{{ metadata.related_satellites || "--" }}</span>
            </div>
            <div class="info-item full-width">
              <span class="info-label">摘要</span>
              <span class="info-value text-left summary">{{ metadata.summary || "--" }}</span>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- 运行状态 -->
    <!-- <div class="section" v-if="metadata || satellite?.position">
      <div
        class="section-header"
        :class="{ disabled: !canViewStatus }"
        @click="toggleSection('status')"
      >
        <div class="header-left">
          <DashboardOutlined class="section-icon" />
          <span>运行状态</span>
        </div>
        <DownOutlined :class="['expand-icon', { expanded: expandedSections.status }]" />
      </div>
      <transition name="collapse">
        <div v-show="expandedSections.status" class="section-content">
          <div class="status-panel">
            <div
              class="status-indicator"
              :class="{ active: !metadata?.decayDate, decayed: !!metadata?.decayDate }"
            >
              <span class="indicator-dot"></span>
              <span class="indicator-text">{{ metadata?.decayDate ? "已衰减" : "运行中" }}</span>
            </div>
            <div class="status-time-row">
              <span class="status-label">数据更新时间</span>
              <span class="status-time">{{ formatTime(satellite.timestamp) }}</span>
            </div>
            <div class="status-time-row" v-if="metadata">
              <span class="status-label">稳定日期</span>
              <span class="status-time">{{
                metadata.stable_date ? formatDate(metadata.stable_date) : "--"
              }}</span>
            </div>
            <div class="decay-warning" v-if="metadata?.decayDate">
              <WarningOutlined />
              <span>该卫星已于 {{ formatDate(metadata.decayDate) }} 坠落大气层</span>
            </div>
          </div>
        </div>
      </transition>
    </div> -->
  </div>

  <!-- 空状态 -->
  <div class="empty-state" v-else>
    <div class="empty-visual">
      <div class="empty-orbit">
        <div class="empty-dot"></div>
      </div>
      <GlobalOutlined class="empty-globe" />
    </div>
    <p>请选择一颗卫星</p>
    <span>从左侧列表中选择卫星查看详细信息</span>
  </div>

  <!-- 公司详情弹窗 -->
  <CompanyDetailModal
    :company-name="selectedCompanyName"
    :open="companyDetailVisible"
    @update:open="companyDetailVisible = $event"
  />

  <!-- 登录确认弹窗 -->
  <ActionConfirmModal v-model:visible="loginConfirmVisible" type="login" redirect="/satellite" />
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { message } from "ant-design-vue";
import CompanyDetailModal from "./CompanyDetailModal.vue";
import ActionConfirmModal from "./ActionConfirmModal.vue";
import {
  GlobalOutlined,
  CompassOutlined,
  EnvironmentOutlined,
  RocketOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
  AimOutlined,
  ThunderboltOutlined,
  StarOutlined,
  StarFilled,
  LoadingOutlined,
  RadiusSettingOutlined,
  DownOutlined,
  TeamOutlined,
  ToolOutlined,
} from "@ant-design/icons-vue";
import type { Satellite } from "@/hooks/useLocalSatellites";
import FlagIcon from "@/components/FlagIcon.vue";
import { satelliteApi } from "@/api";
import { useUserStore } from "@/stores/user";
import { COUNTRY_NAMES, LAUNCH_SITES, OBJECT_TYPES, STATUS_LABELS } from "@/constants/satellite";

// 元数据接口
interface SatelliteMetadata {
  noradId: string;
  name?: string;
  objectId?: string;
  altName?: string;
  objectType?: string;
  status?: string;
  countryCode?: string;
  launchDate?: string;
  launchSite?: string;
  launchVehicle?: string;
  decayDate?: string;
  period?: number;
  inclination?: number;
  apogee?: number;
  perigee?: number;
  eccentricity?: number;
  raan?: number;
  argOfPerigee?: number;
  rcs?: string;
  stdMag?: number;
  tleEpoch?: string;
  cosparId?: string;
  objectClass?: string;
  mission?: string;
  operator?: string;
  contractor?: string;
  launchMass?: number;
  shape?: string;
  dimensions?: string;
  span?: number;
  lifetime?: string;
  firstEpoch?: string;
  predDecayDate?: string;
  flightNo?: string;
  cosparLaunchNo?: string;
  launchFailure?: boolean;
  launchSiteName?: string;
  bus?: string;
  length?: number;
  diameter?: number;
  dryMass?: number;
  constellationName?: string;
  equipment?: string;
  adcs?: string;
  payload?: string;
  stable_date?: string;
  launch_pad?: string;
  manufacturer?: string;
  configuration?: string;
  power?: string;
  motor?: string;
  material_composition?: string;
  major_events?: string;
  related_satellites?: string;
  transmitter_frequencies?: string;
  summary?: string;
}

interface Props {
  satellite: Satellite | null;
  metadata: SatelliteMetadata | null;
}

const props = defineProps<Props>();

// 折叠状态
const expandedSections = ref({
  basic: false,
  launch: false,
  mission: false,
  technical: false,
  orbit: false,
  status: false,
});

const emit = defineEmits<{
  (e: "favorite-change", noradId: string, favorited: boolean): void;
}>();

const userStore = useUserStore();
const isFavorited = ref(false);
const followLoading = ref(false);
const loginConfirmVisible = ref(false);

// 权限检查
const canViewTechnical = computed(() => userStore.hasFeature("satellite_technical"));
const canViewLaunch = computed(() => userStore.hasFeature("satellite_launch"));
const canViewMission = computed(() => userStore.hasFeature("satellite_mission"));
const canViewStatus = computed(() => userStore.hasFeature("satellite_status"));
const canViewOrbit = computed(() => userStore.hasFeature("satellite_orbit_params"));

// TLE 年龄实时计算
const computedTleAge = computed(() => {
  if (!props.metadata?.tleEpoch) return null;
  const epochDate = new Date(props.metadata?.tleEpoch);
  return Math.floor((Date.now() - epochDate.getTime()) / (1000 * 60 * 60 * 24));
});

// 公司详情弹窗状态
const companyDetailVisible = ref(false);
const selectedCompanyName = ref("");

// 切换区块展开状态
function toggleSection(section: keyof typeof expandedSections.value) {
  const hasPermission = {
    basic: true,
    technical: canViewTechnical.value,
    orbit: canViewOrbit.value,
    launch: canViewLaunch.value,
    mission: canViewMission.value,
    status: canViewStatus.value,
  }[section];

  if (!hasPermission) {
    loginConfirmVisible.value = true;
    return;
  }

  expandedSections.value[section] = !expandedSections.value[section];
}

// 打开公司详情弹窗
function openCompanyDetail(companyName: string) {
  selectedCompanyName.value = companyName;
  companyDetailVisible.value = true;
}

// 检查是否已关注
async function checkFavorite() {
  if (!props.satellite || !userStore.isLoggedIn) return;
  try {
    const res = await satelliteApi.checkFavorite(props.satellite.noradId);
    isFavorited.value = res.data.data.favorited;
  } catch {
    // 忽略错误
  }
}

// 切换关注状态
async function handleToggleFavorite() {
  if (!userStore.isLoggedIn) {
    message.warning("请先登录");
    return;
  }
  if (!props.satellite) return;

  followLoading.value = true;
  try {
    const res = await satelliteApi.toggleFavorite(props.satellite.noradId);
    isFavorited.value = res.data.data.favorited;
    message.success(res.data.message);
    // 通知父组件收藏状态变化
    emit("favorite-change", props.satellite.noradId, isFavorited.value);
  } catch {
    message.error("操作失败");
  } finally {
    followLoading.value = false;
  }
}

// 监听卫星变化
watch(
  () => props.satellite,
  () => {
    checkFavorite();
  },
  { immediate: true },
);

// 格式化函数
const formatNumber = (num: number | undefined | null, decimals: number): string => {
  if (num == null) return "--";
  return num.toFixed(decimals);
};

const formatTime = (timestamp: string): string => {
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatDateTime = (datetime: string): string => {
  return new Date(datetime).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getOrbitType = (alt: number): string => {
  if (alt < 2000000) return "低轨 LEO";
  if (alt < 35000000) return "中轨 MEO";
  if (alt < 45000000) return "地球同步 GEO";
  return "高轨 HEO";
};

const getOrbitClass = (alt: number): string => {
  if (alt < 2000000) return "leo";
  if (alt < 35000000) return "meo";
  if (alt < 45000000) return "geo";
  return "heo";
};

const getCountryName = (code: string): string => {
  return COUNTRY_NAMES[code] || code;
};

const formatLatitude = (lat: number): string => {
  if (lat > 0) return `${lat.toFixed(4)}°北`;
  if (lat < 0) return `${Math.abs(lat).toFixed(4)}°南`;
  return `0.0000°`;
};

const formatLongitude = (lng: number): string => {
  if (lng > 0) return `${lng.toFixed(4)}°东`;
  if (lng < 0) return `${Math.abs(lng).toFixed(4)}°西`;
  return `0.0000°`;
};

const getLaunchSiteName = (code: string): string => {
  return LAUNCH_SITES[code] || code;
};

const getObjectTypeLabel = (type: string | undefined): string => {
  if (!type) return "--";
  return OBJECT_TYPES[type]?.label || type;
};

const getObjectTypeClass = (type: string | undefined): string => {
  if (!type) return "";
  return OBJECT_TYPES[type]?.class || "";
};

const getStatusLabel = (status: string | undefined): string => {
  if (!status) return "--";
  return STATUS_LABELS[status] || status;
};
</script>

<style scoped lang="scss">
.satellite-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 212, 255, 0.15);
    border-radius: 2px;
  }
}

// 头部
.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.08);
  margin-bottom: 20px;
}

.sat-visual {
  width: 64px;
  height: 64px;
  flex-shrink: 0;

  .orbit-container {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;

    .orbit-path {
      width: 50px;
      height: 50px;
      border: 2px solid rgba(0, 212, 255, 0.2);
      border-radius: 50%;
      animation: orbit-spin 10s linear infinite;
    }

    .satellite-marker {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      animation: orbit-motion 4s linear infinite;

      .marker-dot {
        width: 10px;
        height: 10px;
        background: linear-gradient(135deg, #00d4ff 0%, #00ff88 100%);
        border-radius: 50%;
        box-shadow: 0 0 15px rgba(0, 212, 255, 0.6);
      }

      .marker-glow {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 24px;
        height: 24px;
        background: radial-gradient(circle, rgba(0, 212, 255, 0.3) 0%, transparent 70%);
        border-radius: 50%;
      }
    }
  }
}

@keyframes orbit-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes orbit-motion {
  0% {
    transform: translate(calc(-50% + 25px), -50%);
  }
  25% {
    transform: translate(-50%, calc(-50% + 25px));
  }
  50% {
    transform: translate(calc(-50% - 25px), -50%);
  }
  75% {
    transform: translate(-50%, calc(-50% - 25px));
  }
  100% {
    transform: translate(calc(-50% + 25px), -50%);
  }
}

.sat-title {
  flex: 1;
  min-width: 0;

  h3 {
    font-size: 17px;
    font-weight: 600;
    color: #fff;
    margin: 0 0 8px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sat-ids {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .norad-id,
  .object-id {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.45);
    background: rgba(0, 212, 255, 0.08);
    padding: 3px 8px;
    border-radius: 6px;
  }

  .object-id {
    background: rgba(123, 44, 191, 0.15);
    color: rgba(255, 255, 255, 0.6);
  }
}

// 区块
.section {
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(0, 212, 255, 0.04);
  border: 1px solid rgba(0, 212, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;

  &.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:hover:not(.disabled) {
    background: rgba(0, 212, 255, 0.08);
    border-color: rgba(0, 212, 255, 0.15);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
  }

  .section-icon {
    font-size: 14px;
    color: #00d4ff;
  }

  .expand-icon {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    transition: transform 0.2s ease;

    &.expanded {
      transform: rotate(180deg);
    }
  }
}

.section-content {
  padding-top: 12px;
}

// 基本信息网格
.info-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(0, 212, 255, 0.04);
  border: 1px solid rgba(0, 212, 255, 0.08);
  border-radius: 10px;

  &.full-width {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .info-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    flex-shrink: 0;
  }

  .info-value {
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 6px;
    text-align: right;
    margin-left: 12px;

    &.text-left {
      text-align: left;
      margin-left: 0;
      word-break: break-all;
      line-height: 1.5;
    }

    &.summary {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
    }

    &.mission {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &.clickable-company {
      cursor: pointer;
      color: #a855f7;
      transition: all 0.2s ease;
      padding: 2px 8px;
      border-radius: 6px;
      background: rgba(168, 85, 247, 0.1);
      border: 1px solid rgba(168, 85, 247, 0.2);

      &:hover {
        color: #c084fc;
        background: rgba(168, 85, 247, 0.2);
        border-color: #a855f7;
      }

      &.disabled {
        cursor: not-allowed;
        opacity: 0.5;
        pointer-events: none;
      }
    }
  }

  .country-flag {
    width: 20px;
    height: 15px;
    margin-right: 6px;
    display: inline-block;
    vertical-align: middle;
  }
}

// 类型标签
.type-badge {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;

  &.payload {
    background: rgba(0, 255, 136, 0.15);
    color: #00ff88;
  }

  &.rocket {
    background: rgba(255, 170, 0, 0.15);
    color: #ffaa00;
  }

  &.debris {
    background: rgba(255, 107, 107, 0.15);
    color: #ff6b6b;
  }
}

// 状态标签
.status-badge {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;

  &.active {
    background: rgba(0, 255, 136, 0.15);
    color: #00ff88;
  }

  &.decayed {
    background: rgba(255, 107, 107, 0.15);
    color: #ff6b6b;
  }

  &.partial {
    background: rgba(255, 193, 7, 0.15);
    color: #ffc107;
  }

  &.na {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.5);
  }
}

// 别名样式
.alt-names {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// 参数网格
.param-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.param-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(0, 212, 255, 0.04);
  border: 1px solid rgba(0, 212, 255, 0.08);
  border-radius: 12px;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(0, 212, 255, 0.08);
    border-color: rgba(0, 212, 255, 0.15);
  }

  .param-icon {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    font-size: 14px;

    &.lng {
      background: rgba(0, 212, 255, 0.12);
      color: #00d4ff;
    }
    &.lat {
      background: rgba(0, 255, 136, 0.12);
      color: #00ff88;
    }
    &.alt {
      background: rgba(123, 44, 191, 0.12);
      color: #b366e8;
    }
    &.orbit {
      background: rgba(255, 170, 0, 0.12);
      color: #ffaa00;
    }
  }

  .param-content {
    flex: 1;
    min-width: 0;

    label {
      display: block;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
      margin-bottom: 3px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .param-value {
      font-size: 13px;
      font-weight: 600;
      color: #fff;

      &.orbit-type {
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
      }
    }
  }
}

// 轨道特征
.orbit-features {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(0, 212, 255, 0.04);
  border: 1px solid rgba(0, 212, 255, 0.08);
  border-radius: 12px;

  .feature-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: rgba(0, 212, 255, 0.12);
    color: #00d4ff;
    font-size: 14px;
  }

  .feature-content {
    flex: 1;
  }

  .feature-labels,
  .feature-values {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }

  .feature-labels {
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 4px;
  }

  .feature-values {
    color: #fff;
    font-weight: 500;
  }

  .feature-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .feature-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  .feature-value {
    font-size: 13px;
    font-weight: 500;
    color: #fff;

    &.warning {
      color: #ffc107;
    }
    &.old {
      color: #ff6b6b;
    }
  }
}

// 状态面板
.status-panel {
  background: rgba(0, 212, 255, 0.04);
  border: 1px solid rgba(0, 212, 255, 0.08);
  border-radius: 14px;
  padding: 14px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;

  .indicator-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ff4d4d;
  }

  &.active .indicator-dot {
    background: #00ff88;
    box-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
    animation: pulse-dot 2s ease-in-out infinite;
  }

  &.decayed .indicator-dot {
    background: #ff6b6b;
  }

  .indicator-text {
    font-size: 13px;
    font-weight: 500;
    color: #ff6b6b;
  }

  &.active .indicator-text {
    color: #00ff88;
  }
}

.status-time-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;

  .status-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .status-time {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }
}

@keyframes pulse-dot {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.7;
  }
}

.decay-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(255, 107, 107, 0.1);
  border-radius: 8px;
  color: #ff6b6b;
  font-size: 12px;
}

// 空状态
.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 24px;
}

.empty-visual {
  position: relative;
  width: 100px;
  height: 100px;
  margin-bottom: 24px;

  .empty-orbit {
    width: 80px;
    height: 80px;
    border: 2px dashed rgba(0, 212, 255, 0.2);
    border-radius: 50%;
    animation: slow-spin 15s linear infinite;

    .empty-dot {
      position: absolute;
      top: -6px;
      left: 50%;
      transform: translateX(-50%);
      width: 12px;
      height: 12px;
      background: rgba(0, 212, 255, 0.3);
      border-radius: 50%;
    }
  }

  .empty-globe {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 28px;
    color: rgba(0, 212, 255, 0.25);
  }
}

@keyframes slow-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.empty-state p {
  font-size: 16px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 8px;
}

.empty-state span {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
}

// 关注按钮
.follow-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(0, 212, 255, 0.2);
  background: rgba(0, 212, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: rgba(0, 212, 255, 0.15);
    border-color: rgba(0, 212, 255, 0.3);
    color: #00d4ff;
  }

  &.followed {
    background: rgba(255, 193, 7, 0.15);
    border-color: rgba(255, 193, 7, 0.3);
    color: #ffc107;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spin {
    animation: spin 1s linear infinite;
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
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 2000px;
}
</style>
