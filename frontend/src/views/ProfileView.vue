<template>
  <div class="profile-view">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="bg-blob blob-1"></div>
      <div class="bg-blob blob-2"></div>
      <div class="bg-grid"></div>
    </div>

    <div class="profile-container">
      <!-- 用户信息区域 -->
      <div class="profile-header">
        <!-- 头像和基本信息 -->
        <div class="user-hero">
          <div class="avatar-wrapper">
            <UserAvatar :user="userStore.user" :size="72" glow />
          </div>
          <div class="user-basic">
            <div class="user-name-row">
              <h1 class="username">
                {{ userStore.user?.nickname || userStore.user?.username || "用户" }}
              </h1>
              <span class="level-badge" :class="userStore.user?.level || 'basic'">
                {{ getLevelText(userStore.user?.level) }}
              </span>
            </div>
            <p class="user-meta">
              <span class="user-email">{{ userStore.user?.email }}</span>
              <span class="divider">·</span>
              <span class="user-points">💎 {{ userStore.user?.points || 0 }} 积分</span>
            </p>
          </div>
          <a-button class="settings-btn" @click="router.push('/settings')">
            <SettingOutlined />
            设置
          </a-button>
        </div>
        
        <!-- 会员信息卡片 -->
        <div class="membership-card" v-if="userStore.isLoggedIn">
          <div class="membership-info">
            <div class="info-item">
              <span class="info-label">会员等级</span>
              <span class="info-value level" :class="userStore.user?.level || 'basic'">
                {{ getLevelText(userStore.user?.level) }}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">可用积分</span>
              <span class="info-value points">💎 {{ userStore.user?.points || 0 }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">累计积分</span>
              <span class="info-value total">📊 {{ userStore.user?.totalPoints || 0 }}</span>
            </div>
          </div>
          <div class="membership-actions">
            <a-button 
              class="checkin-btn" 
              :class="{ checked: hasCheckedIn }"
              :disabled="checkinLoading || hasCheckedIn"
              @click="handleCheckin"
            >
              <template v-if="checkinLoading">
                <LoadingOutlined class="spin" />
              </template>
              <template v-else-if="hasCheckedIn">
                <CheckOutlined />
                已签到
              </template>
              <template v-else>
                <ThunderboltOutlined />
                签到
              </template>
            </a-button>
            <a-button type="primary" class="membership-btn" @click="router.push('/membership')">
              <CrownOutlined />
              会员中心
            </a-button>
          </div>
        </div>
      </div>

      <!-- 内容区域 -->
      <div class="profile-content">
        <a-tabs v-model:activeKey="activeTab" class="profile-tabs">
          <!-- 情报收藏 -->
          <a-tab-pane key="intelligence-collects" tab="情报收藏">
            <div class="collects-section">
              <a-spin :spinning="intelligenceCollectLoading">
                <div v-if="intelligenceCollectList.length === 0 && !intelligenceCollectLoading" class="empty-collects">
                  <BookOutlined class="empty-icon" />
                  <p>暂无情报收藏</p>
                  <a-button type="primary" @click="router.push('/intelligence')">
                    去收藏情报
                  </a-button>
                </div>
                <div v-else class="collect-list">
                  <div
                    v-for="item in intelligenceCollectList"
                    :key="'intel-' + item.id"
                    class="collect-item"
                    @click="goToIntelligenceDetail(item.id)"
                  >
                    <div class="collect-tag" :class="item.category">
                      {{ getCategoryLabel(item.category) }}
                    </div>
                    <div class="collect-content">
                      <h4>{{ item.title }}</h4>
                      <p>{{ item.summary }}</p>
                    </div>
                    <div class="collect-meta">
                      <span>{{ formatCollectDate(item.collectedAt) }}</span>
                    </div>
                  </div>
                </div>
              </a-spin>
            </div>
          </a-tab-pane>

          <!-- 科普收藏 -->
          <a-tab-pane key="education-collects" tab="科普收藏">
            <div class="collects-section">
              <a-spin :spinning="educationCollectLoading">
                <div v-if="educationCollectList.length === 0 && !educationCollectLoading" class="empty-collects">
                  <BookOutlined class="empty-icon" />
                  <p>暂无科普收藏</p>
                  <a-button type="primary" @click="router.push('/education')">
                    去收藏科普
                  </a-button>
                </div>
                <div v-else class="collect-list">
                  <div
                    v-for="item in educationCollectList"
                    :key="'edu-' + item.id"
                    class="collect-item"
                    @click="goToEducationDetail(item.id)"
                  >
                    <div class="collect-tag" :class="item.category">
                      {{ getEducationCategoryLabel(item.category) }}
                    </div>
                    <div class="collect-content">
                      <h4>{{ item.title }}</h4>
                      <p>{{ item.summary }}</p>
                    </div>
                    <div class="collect-meta">
                      <span>{{ formatCollectDate(item.collectedAt) }}</span>
                    </div>
                  </div>
                </div>
              </a-spin>
            </div>
          </a-tab-pane>

          <!-- 卫星收藏 -->
          <a-tab-pane key="satellites" tab="卫星收藏">
            <div class="satellites-section">
              <a-spin :spinning="satelliteCollectLoading">
                <div v-if="satelliteCollectList.length === 0 && !satelliteCollectLoading" class="empty-satellites">
                  <GlobalOutlined class="empty-icon" />
                  <p>暂无卫星收藏</p>
                  <a-button type="primary" @click="router.push('/satellite')">
                    去收藏卫星
                  </a-button>
                </div>
                <div v-else class="satellite-list">
                  <div
                    v-for="item in satelliteCollectList"
                    :key="item.noradId"
                    class="satellite-item"
                    @click="router.push('/satellite')"
                  >
                    <div class="satellite-icon">
                      <RocketOutlined />
                    </div>
                    <div class="satellite-content">
                      <h4>{{ item.name }}</h4>
                      <p>NORAD #{{ item.noradId }}</p>
                    </div>
                    <div class="satellite-meta">
                      <span>{{ formatFollowDate(item.followedAt) }}</span>
                    </div>
                  </div>
                </div>
              </a-spin>
            </div>
          </a-tab-pane>
        </a-tabs>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { message } from "ant-design-vue";
import {
  BookOutlined,
  LoadingOutlined,
  GlobalOutlined,
  RocketOutlined,
  CrownOutlined,
  CheckOutlined,
  ThunderboltOutlined,
  SettingOutlined,
} from "@ant-design/icons-vue";
import { emitter } from "@/utils/emitter";
import { useUserStore } from "@/stores/user";
import UserAvatar from "@/components/UserAvatar.vue";
import { intelligenceApi, satelliteApi, pointsApi, educationApi, type Intelligence, type SatelliteFavorite, type Article } from "@/api";

// 类型扩展
declare module "@/api" {
  interface Intelligence {
    collectedAt?: string;
  }
  interface Article {
    collectedAt?: string;
  }
}

const router = useRouter();
const userStore = useUserStore();

const activeTab = ref("intelligence-collects");

// 我的收藏
const intelligenceCollectList = ref<Intelligence[]>([]);
const intelligenceCollectLoading = ref(false);

// 科普收藏
const educationCollectList = ref<Article[]>([]);
const educationCollectLoading = ref(false);

// 关注的卫星
const satelliteCollectList = ref<SatelliteFavorite[]>([]);
const satelliteCollectLoading = ref(false);

// 签到
const checkinLoading = ref(false);
const hasCheckedIn = ref(false);

// 签到
async function handleCheckin() {
  checkinLoading.value = true;
  try {
    const res = await pointsApi.dailyCheckin();
    if (res.data.code === 0) {
      hasCheckedIn.value = true;
      message.success(res.data.message || "签到成功");
      emitter.emit('notification:refresh')
      await userStore.fetchUser();
    } else {
      hasCheckedIn.value = true;
      message.warning(res.data.message || "今日已签到");
    }
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 400) {
      hasCheckedIn.value = true;
      message.warning("今日已签到");
    } else {
      message.error("签到失败");
    }
  } finally {
    checkinLoading.value = false;
  }
}

// 获取收藏列表
async function fetchIntelligenceCollects() {
  intelligenceCollectLoading.value = true;
  try {
    const response = await intelligenceApi.getUserCollects();
    intelligenceCollectList.value = response.data.data || [];
  } catch {
    // 忽略错误
  } finally {
    intelligenceCollectLoading.value = false;
  }
}

// 获取科普收藏列表
async function fetchEducationCollects() {
  educationCollectLoading.value = true;
  try {
    const response = await educationApi.getUserCollects();
    educationCollectList.value = response.data.data || [];
  } catch {
    // 忽略错误
  } finally {
    educationCollectLoading.value = false;
  }
}

// 分类标签
function getCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    launch: "发射任务",
    satellite: "卫星运行",
    industry: "行业动态",
    research: "科研成果",
    environment: "空间环境",
  };
  return labels[category] || category;
}

// 科普分类标签
function getEducationCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    basic: "基础入门",
    advanced: "专业进阶",
    mission: "经典任务",
    people: "人物/机构",
  };
  return labels[category] || category;
}

// 格式化日期
function formatCollectDate(dateStr?: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 跳转详情
function goToIntelligenceDetail(id: number) {
  router.push(`/intelligence/${id}`);
}

// 跳转科普详情
function goToEducationDetail(id: number) {
  router.push(`/education/${id}`);
}

// 获取关注的卫星列表
async function fetchSatelliteCollects() {
  satelliteCollectLoading.value = true;
  try {
    const response = await satelliteApi.getFavorites();
    satelliteCollectList.value = response.data.data || [];
  } catch {
    // 忽略错误
  } finally {
    satelliteCollectLoading.value = false;
  }
}

// 格式化关注日期
function formatFollowDate(dateStr?: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 获取等级显示文本
function getLevelText(level?: string) {
  const levelMap: Record<string, string> = {
    basic: "普通会员",
    advanced: "高级会员",
    professional: "专业会员",
  };
  return levelMap[level || "basic"] || "普通会员";
}

onMounted(async () => {
  if (!userStore.user) {
    await userStore.fetchUser();
  }
  hasCheckedIn.value = userStore.user?.todayCheckedIn || false;
  await Promise.all([fetchIntelligenceCollects(), fetchSatelliteCollects(), fetchEducationCollects()]);
});
</script>

<style scoped lang="scss">
// 主题色
$primary: #00d4ff;
$primary-light: #7dd3fc;
$accent: #a855f7;

// 背景色
$bg-dark: #0a0a0f;
$bg-card: rgba(255, 255, 255, 0.03);
$bg-elevated: rgba(255, 255, 255, 0.06);

// 文字色
$text-primary: rgba(255, 255, 255, 0.95);
$text-secondary: rgba(255, 255, 255, 0.6);
$text-muted: rgba(255, 255, 255, 0.4);

.profile-view {
  min-height: calc(100vh - 64px);
  background: $bg-dark;
  position: relative;
  overflow: hidden;
}

// 背景装饰
.bg-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;

  .bg-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
    opacity: 0.4;
  }

  .blob-1 {
    width: 600px;
    height: 600px;
    background: linear-gradient(135deg, $primary 0%, $accent 100%);
    top: -200px;
    right: -200px;
  }

  .blob-2 {
    width: 400px;
    height: 400px;
    background: linear-gradient(135deg, $accent 0%, $primary 100%);
    bottom: -100px;
    left: -100px;
  }

  .bg-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
    background-size: 60px 60px;
  }
}

.profile-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
  position: relative;
  z-index: 1;
}

// 用户卡片
.profile-header {
  margin-bottom: 24px;
}

// 用户英雄区
.user-hero {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  background: $bg-card;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  backdrop-filter: blur(20px);
}

.avatar-wrapper {
  flex-shrink: 0;
}

.user-basic {
  flex: 1;
}

.settings-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: $text-secondary;
  border-radius: 8px;

  &:hover {
    color: $primary;
    border-color: rgba(0, 212, 255, 0.4);
    background: rgba(0, 212, 255, 0.08);
  }
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.username {
  font-size: 22px;
  font-weight: 700;
  color: $text-primary;
  margin: 0;
  letter-spacing: -0.02em;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: $text-muted;
  font-size: 13px;
  margin: 0;

  .divider {
    opacity: 0.4;
  }

  .user-points {
    color: #ffd700;
  }
}

// 等级徽章
.level-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;

  &.basic {
    background: rgba(255, 255, 255, 0.1);
    color: $text-secondary;
  }

  &.advanced {
    background: rgba(0, 212, 255, 0.15);
    color: #00d4ff;
    border: 1px solid rgba(0, 212, 255, 0.3);
  }

  &.professional {
    background: rgba(255, 215, 0, 0.15);
    color: #ffd700;
    border: 1px solid rgba(255, 215, 0, 0.3);
  }
}

// 会员信息卡片
.membership-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding: 20px;
  background: $bg-elevated;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
}

.membership-info {
  display: flex;
  gap: 32px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .info-label {
    font-size: 12px;
    color: $text-muted;
  }

  .info-value {
    font-size: 16px;
    font-weight: 600;
    color: $text-primary;

    &.level.basic {
      color: $text-secondary;
    }

    &.level.advanced {
      color: #00d4ff;
    }

    &.level.professional {
      color: #ffd700;
    }

    &.points {
      color: #ffd700;
    }

    &.total {
      color: $text-secondary;
    }
  }
}

.membership-btn {
  background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
  border: none;

  &:hover {
    opacity: 0.9;
  }
}

.checkin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  background: linear-gradient(135deg, #00d4ff 0%, #0080ff 100%);
  border: none;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:disabled {
    cursor: not-allowed;
  }

  &.checked {
    background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  }

  .spin {
    animation: spin 1s linear infinite;
  }
}

.membership-actions {
  display: flex;
  gap: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 内容区域
.profile-content {
  background: $bg-card;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  padding: 24px;
  backdrop-filter: blur(20px);
}

.profile-tabs {
  :deep(.ant-tabs-nav) {
    margin-bottom: 24px;

    .ant-tabs-tab {
      color: $text-secondary;

      &.ant-tabs-tab-active .ant-tabs-tab-btn {
        color: $primary;
      }
    }

    .ant-tabs-ink-bar {
      background: $primary;
    }
  }
}

// 收藏列表
.collects-section {
  min-height: 200px;
  padding-top: 16px;
}

.collects-subsection {
  margin-bottom: 24px;
}

.subsection-title {
  font-size: 14px;
  font-weight: 600;
  color: $text-secondary;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
}

.empty-collects {
  text-align: center;
  padding: 60px 20px;

  .empty-icon {
    font-size: 48px;
    color: $text-muted;
    margin-bottom: 16px;
  }

  p {
    color: $text-secondary;
    margin-bottom: 20px;
  }
}

.collect-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.collect-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(0, 212, 255, 0.2);
  }
}

.collect-tag {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;

  &.launch {
    background: rgba(0, 212, 255, 0.15);
    color: #00d4ff;
  }

  &.satellite {
    background: rgba(168, 85, 247, 0.15);
    color: #a855f7;
  }

  &.industry {
    background: rgba(255, 193, 7, 0.15);
    color: #ffc107;
  }

  &.research {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  &.environment {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }
}

.collect-content {
  flex: 1;
  min-width: 0;

  h4 {
    font-size: 15px;
    font-weight: 500;
    color: $text-primary;
    margin: 0 0 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  p {
    font-size: 13px;
    color: $text-muted;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.collect-meta {
  flex-shrink: 0;
  font-size: 12px;
  color: $text-muted;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// 关注的卫星
.satellites-section {
  min-height: 200px;
}

.empty-satellites {
  text-align: center;
  padding: 60px 20px;

  .empty-icon {
    font-size: 48px;
    color: $text-muted;
    margin-bottom: 16px;
  }

  p {
    color: $text-secondary;
    margin-bottom: 20px;
  }
}

.satellite-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.satellite-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(0, 212, 255, 0.2);
  }
}

.satellite-icon {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: $primary;
}

.satellite-content {
  flex: 1;
  min-width: 0;

  h4 {
    font-size: 15px;
    font-weight: 500;
    color: $text-primary;
    margin: 0 0 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  p {
    font-size: 13px;
    color: $text-muted;
    margin: 0;
  }
}

.satellite-meta {
  flex-shrink: 0;
  font-size: 12px;
  color: $text-muted;
}

// 响应式
@media (max-width: 768px) {
  .user-hero {
    flex-direction: column;
    text-align: center;
  }

  .user-meta {
    justify-content: center;
    flex-wrap: wrap;
  }

  .collect-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .satellite-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .collect-meta {
    align-self: flex-end;
  }

  .satellite-meta {
    align-self: flex-end;
  }
}
</style>
