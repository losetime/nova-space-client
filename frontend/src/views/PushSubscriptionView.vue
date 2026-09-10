<template>
  <div class="push-subscription-view">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="bg-blob blob-1"></div>
      <div class="bg-blob blob-2"></div>
      <div class="bg-grid"></div>
    </div>

    <div class="subscription-container">
      <!-- 标题区域 -->
      <div class="page-header">
        <div class="header-icon">
          <BellOutlined />
        </div>
        <h1>订阅推送</h1>
        <p>订阅后，您将收到每日太空资讯汇总邮件</p>
      </div>

      <!-- 主内容区域 -->
      <div class="subscription-content">
        <a-spin :spinning="loading">
          <!-- 未订阅状态 -->
          <div v-if="!subscription" class="empty-state">
            <MailOutlined class="empty-icon" />
            <h3>尚未订阅推送服务</h3>
            <p>订阅后可接收每日太空资讯汇总邮件</p>
          </div>

          <!-- 订阅表单 -->
          <div class="subscription-form">
            <!-- 邮箱输入 -->
            <div class="form-section">
              <h3><MailOutlined /> 推送邮箱</h3>
              <div class="email-input">
                <input
                  type="email"
                  v-model="form.email"
                  placeholder="请输入接收推送的邮箱地址"
                  :disabled="subscription && subscription.status !== 'cancelled'"
                />
              </div>
            </div>

            <!-- 订阅内容选择 -->
            <div class="form-section">
              <h3><SettingOutlined /> 选择推送内容</h3>
              <div class="subscription-options">
                <!-- <div
                  class="option-card"
                  :class="{ active: form.subscribeSpaceWeather }"
                  @click="form.subscribeSpaceWeather = !form.subscribeSpaceWeather"
                >
                  <div class="option-icon">
                    <ThunderboltOutlined />
                  </div>
                  <div class="option-content">
                    <h4>空间天气预警</h4>
                    <p>接收太阳风暴、地磁暴等预警通知</p>
                  </div>
                  <div class="option-check">
                    <CheckOutlined v-if="form.subscribeSpaceWeather" />
                  </div>
                </div> -->

                <div
                  class="option-card"
                  :class="{ active: form.subscribeIntelligence }"
                  @click="form.subscribeIntelligence = !form.subscribeIntelligence"
                >
                  <div class="option-icon">
                    <ReadOutlined />
                  </div>
                  <div class="option-content">
                    <h4>航天动态</h4>
                    <p>接收最新航天资讯和行业动态</p>
                  </div>
                  <div class="option-check">
                    <CheckOutlined v-if="form.subscribeIntelligence" />
                  </div>
                </div>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="action-buttons">
              <!-- 未订阅状态 -->
              <template v-if="!subscription || subscription.status === 'cancelled'">
                <button class="primary-btn" :disabled="submitting" @click="handleSubscribe">
                  <template v-if="submitting">
                    <LoadingOutlined class="spin" />
                    <span>订阅中...</span>
                  </template>
                  <template v-else>
                    <BellOutlined />
                    <span>订阅推送</span>
                  </template>
                </button>
              </template>

              <!-- 已订阅状态 -->
              <template v-else-if="subscription.status === 'active'">
                <button class="primary-btn" :disabled="submitting" @click="handleUpdate">
                  <template v-if="submitting">
                    <LoadingOutlined class="spin" />
                    <span>保存中...</span>
                  </template>
                  <template v-else>
                    <SaveOutlined />
                    <span>保存设置</span>
                  </template>
                </button>
                <button class="outline-btn" :disabled="submitting" @click="handlePause">
                  <PauseCircleOutlined />
                  <span>暂停推送</span>
                </button>
                <button class="danger-btn" :disabled="submitting" @click="handleCancel">
                  <CloseCircleOutlined />
                  <span>取消订阅</span>
                </button>
              </template>

              <!-- 已暂停状态 -->
              <template v-else-if="subscription.status === 'paused'">
                <button class="primary-btn" :disabled="submitting" @click="handleResume">
                  <template v-if="submitting">
                    <LoadingOutlined class="spin" />
                    <span>恢复中...</span>
                  </template>
                  <template v-else>
                    <PlayCircleOutlined />
                    <span>恢复推送</span>
                  </template>
                </button>
                <button class="danger-btn" :disabled="submitting" @click="handleCancel">
                  <CloseCircleOutlined />
                  <span>取消订阅</span>
                </button>
              </template>
            </div>

            <!-- 状态信息 -->
            <div v-if="subscription && subscription.status !== 'cancelled'" class="status-info">
              <div class="status-item">
                <span class="status-label">订阅状态</span>
                <span class="status-value" :class="subscription.status">
                  {{ getStatusText(subscription.status) }}
                </span>
              </div>
              <div v-if="subscription.lastPushAt" class="status-item">
                <span class="status-label">上次推送</span>
                <span class="status-value">{{ formatDate(subscription.lastPushAt) }}</span>
              </div>
            </div>
          </div>
        </a-spin>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { message } from "ant-design-vue";
import {
  BellOutlined,
  MailOutlined,
  SettingOutlined,
  ReadOutlined,
  CheckOutlined,
  LoadingOutlined,
  SaveOutlined,
  PauseCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons-vue";
import { pushApi, type PushSubscription } from "@/api";

const loading = ref(true);
const submitting = ref(false);
const subscription = ref<PushSubscription | null>(null);

const form = reactive({
  email: "",
  subscribeSpaceWeather: true,
  subscribeIntelligence: true,
});

const SUBSCRIPTION_TYPES = {
  SPACE_WEATHER: "space_weather",
  INTELLIGENCE: "intelligence",
} as const;

async function fetchSubscription() {
  loading.value = true;
  try {
    const response = await pushApi.getSubscription();
    subscription.value = response.data.data;

    if (subscription.value) {
      form.email = subscription.value.email;
      form.subscribeSpaceWeather = subscription.value.subscriptionTypes.includes(
        SUBSCRIPTION_TYPES.SPACE_WEATHER,
      );
      form.subscribeIntelligence = subscription.value.subscriptionTypes.includes(
        SUBSCRIPTION_TYPES.INTELLIGENCE,
      );
    }
  } catch {
    // 忽略错误
  } finally {
    loading.value = false;
  }
}

function getSubscriptionTypes(): string[] {
  const types: string[] = [];
  if (form.subscribeSpaceWeather) types.push(SUBSCRIPTION_TYPES.SPACE_WEATHER);
  if (form.subscribeIntelligence) types.push(SUBSCRIPTION_TYPES.INTELLIGENCE);
  return types;
}

async function handleSubscribe() {
  if (!form.email) {
    message.error("请输入邮箱地址");
    return;
  }

  if (!form.subscribeSpaceWeather && !form.subscribeIntelligence) {
    message.error("请至少选择一项订阅内容");
    return;
  }

  submitting.value = true;
  try {
    const response = await pushApi.createSubscription({
      email: form.email,
      subscriptionTypes: getSubscriptionTypes(),
    });
    subscription.value = response.data.data;
    message.success("订阅成功");
  } catch {
    message.error("订阅失败，请稍后重试");
  } finally {
    submitting.value = false;
  }
}

async function handleUpdate() {
  submitting.value = true;
  try {
    const response = await pushApi.updateSubscription({
      subscriptionTypes: getSubscriptionTypes(),
    });
    subscription.value = response.data.data;
    message.success("设置已保存");
  } catch {
    message.error("保存失败，请稍后重试");
  } finally {
    submitting.value = false;
  }
}

async function handlePause() {
  submitting.value = true;
  try {
    const response = await pushApi.pauseSubscription();
    subscription.value = response.data.data;
    message.success("已暂停推送");
  } catch {
    message.error("操作失败，请稍后重试");
  } finally {
    submitting.value = false;
  }
}

async function handleResume() {
  submitting.value = true;
  try {
    const response = await pushApi.resumeSubscription();
    subscription.value = response.data.data;
    message.success("已恢复推送");
  } catch {
    message.error("操作失败，请稍后重试");
  } finally {
    submitting.value = false;
  }
}

async function handleCancel() {
  submitting.value = true;
  try {
    await pushApi.cancelSubscription();
    subscription.value = null;
    message.success("已取消订阅");
  } catch {
    message.error("操作失败，请稍后重试");
  } finally {
    submitting.value = false;
  }
}

function getStatusText(status: string) {
  const statusMap: Record<string, string> = {
    active: "已订阅",
    paused: "已暂停",
    cancelled: "已取消",
  };
  return statusMap[status] || status;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

onMounted(() => {
  fetchSubscription();
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

.push-subscription-view {
  min-height: calc(100vh - 70px);
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

.subscription-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 24px;
  position: relative;
  z-index: 1;
}

.page-header {
  text-align: center;
  margin-bottom: 32px;

  .header-icon {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, $primary 0%, $accent 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    font-size: 28px;
    color: #fff;
    box-shadow: 0 0 40px rgba(0, 212, 255, 0.4);
  }

  h1 {
    font-size: 28px;
    font-weight: 700;
    color: $text-primary;
    margin: 0 0 8px;
  }

  p {
    color: $text-secondary;
    margin: 0;
  }
}

.subscription-content {
  background: $bg-card;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  padding: 32px;
  backdrop-filter: blur(20px);
}

.empty-state {
  text-align: center;
  padding: 20px 0 32px;

  .empty-icon {
    font-size: 48px;
    color: $text-muted;
    margin-bottom: 16px;
  }

  h3 {
    font-size: 18px;
    color: $text-secondary;
    margin: 0 0 8px;
  }

  p {
    color: $text-muted;
    margin: 0;
  }
}

.subscription-form {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.form-section {
  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: $text-primary;
    margin: 0 0 16px;
  }
}

.email-input {
  input {
    width: 100%;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: $text-primary;
    font-size: 15px;
    transition: all 0.3s;

    &:focus {
      outline: none;
      border-color: $primary;
      background: rgba(255, 255, 255, 0.06);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &::placeholder {
      color: $text-muted;
    }
  }
}

.subscription-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(0, 212, 255, 0.2);
  }

  &.active {
    background: rgba(0, 212, 255, 0.08);
    border-color: rgba(0, 212, 255, 0.3);

    .option-icon {
      background: linear-gradient(135deg, $primary 0%, $accent 100%);
      color: #fff;
    }
  }

  .option-icon {
    width: 44px;
    height: 44px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    color: $text-secondary;
    transition: all 0.3s;
  }

  .option-content {
    flex: 1;

    h4 {
      font-size: 15px;
      font-weight: 600;
      color: $text-primary;
      margin: 0 0 4px;
    }

    p {
      font-size: 13px;
      color: $text-muted;
      margin: 0;
    }
  }

  .option-check {
    width: 24px;
    height: 24px;
    background: rgba(0, 212, 255, 0.2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: $primary;
    font-size: 12px;
  }
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.primary-btn,
.secondary-btn,
.outline-btn,
.danger-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spin {
    animation: spin 1s linear infinite;
  }
}

.primary-btn {
  background: linear-gradient(135deg, $primary 0%, $accent 100%);
  border: none;
  color: #fff;

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }
}

.secondary-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: $text-primary;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
  }
}

.outline-btn {
  background: transparent;
  border: 1px solid rgba(0, 212, 255, 0.3);
  color: $primary;

  &:hover:not(:disabled) {
    background: rgba(0, 212, 255, 0.1);
    border-color: rgba(0, 212, 255, 0.5);
  }
}

.danger-btn {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;

  &:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
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

.status-info {
  display: flex;
  gap: 24px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;

  .status-label {
    color: $text-muted;
    font-size: 13px;
  }

  .status-value {
    color: $text-primary;
    font-size: 13px;
    font-weight: 500;

    &.active {
      color: #22c55e;
    }

    &.paused {
      color: #ffc107;
    }

    &.cancelled {
      color: #ef4444;
    }
  }
}

// 响应式
@media (max-width: 768px) {
  .subscription-container {
    padding: 24px 16px;
  }

  .subscription-content {
    padding: 20px;
  }

  .action-buttons {
    flex-direction: column;

    button {
      width: 100%;
    }
  }

  .status-info {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
