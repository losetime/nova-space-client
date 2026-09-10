<template>
  <div class="membership-page">
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
    </div>

    <div v-else class="page-container">
      <header class="page-header">
        <h1 class="title">会员中心</h1>
        <p class="subtitle">解锁专属权益，探索更多航天奥秘</p>
        <p class="contact-line">会员咨询电话：029-85641930</p>
      </header>

      <section v-if="status" class="status-card">
        <div class="status-card-header">
          <span class="level-icon">{{ status.level === "professional" ? "👑" : "💎" }}</span>
          <span class="level-name" :class="status.level">{{ getLevelText(status.level) }}</span>
        </div>
        <div class="status-divider"></div>
        <div class="status-info">
          <div class="info-item">
            <span class="info-label">套餐</span>
            <span class="info-colon">：</span>
            <span class="info-value">{{
              status.subscription ? getPlanText(status.subscription.plan) : "未开通"
            }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">到期</span>
            <span class="info-colon">：</span>
            <span class="info-value">{{
              status.subscription ? formatDate(status.subscription.endDate) : "--"
            }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">积分</span>
            <span class="info-colon">：</span>
            <span class="info-value points">{{ status.points ?? 0 }}</span>
          </div>
        </div>
        <div class="status-divider"></div>
        <div v-if="status.benefits?.length" class="benefits-list">
          <span v-for="benefit in status.benefits" :key="benefit.id" class="benefit-tag">
            {{ benefit.name }}：{{ benefit.displayText || benefit.value }}
          </span>
        </div>
      </section>

      <section class="levels-section">
        <h2 class="section-title">会员版本</h2>
        <div class="levels-grid">
          <div
            v-for="level in memberLevels"
            :key="level.level"
            class="level-card"
            :class="{
              current: status?.level === level.level,
              recommended: level.level === 'professional',
            }"
          >
            <div v-if="level.level === 'professional'" class="recommend-tag">推荐</div>

            <div class="level-header">
              <h3 class="level-name">{{ level.levelName }}</h3>
            </div>

            <ul class="level-benefits">
              <li v-for="benefit in level.benefits" :key="benefit.id">
                {{ benefit.name }}: {{ benefit.displayText || benefit.value }}
                {{ benefit.unit || "" }}
              </li>
            </ul>

            <!-- <div class="plans-list">
              <div
                v-for="plan in level.plans"
                :key="plan.id"
                class="plan-item"
                :class="{
                  recommended: plan.planCode === 'yearly' && level.level === 'professional',
                }"
              >
                <div class="plan-info">
                  <span class="plan-name">{{ plan.name }}</span>
                  <span class="plan-duration"
                    >({{
                      plan.durationMonths === 1200 ? "永久" : `${plan.durationMonths}个月`
                    }})</span
                  >
                </div>
                <div class="plan-right">
                  <span class="plan-price">¥{{ plan.price }}</span>
                  <button class="btn-buy" @click="handleBuy(level, plan)">购买</button>
                </div>
              </div>
            </div> -->
          </div>
        </div>
      </section>

      <section class="earn-section">
        <h2 class="section-title">获取积分</h2>
        <div class="earn-grid">
          <div class="earn-item">
            <span class="earn-name">每日签到</span>
            <span class="earn-points">+2</span>
          </div>
          <div class="earn-item">
            <span class="earn-name">答题挑战</span>
            <span class="earn-points">+2</span>
          </div>
          <div class="earn-item">
            <span class="earn-name">分享内容</span>
            <span class="earn-points">+5</span>
          </div>
          <div class="earn-item">
            <span class="earn-name">邀请好友</span>
            <span class="earn-points">+10</span>
          </div>
        </div>
      </section>
    </div>

    <a-modal v-model:open="showBuyDialog" :closable="false" :footer="null" :width="380" centered>
      <div class="modal-box">
        <h3 class="modal-title">选择支付方式</h3>
        <p class="modal-subtitle">
          {{ selectedLevel?.levelName }} · {{ selectedPlan?.name }} ¥{{ selectedPlan?.price }}
        </p>

        <div class="payment-select">
          <div
            class="payment-option"
            :class="{ selected: selectedPayment === 'wechat' }"
            @click="selectedPayment = 'wechat'"
          >
            <div class="payment-icon wechat">💚</div>
            <span class="payment-name">微信支付</span>
          </div>
          <div
            class="payment-option"
            :class="{ selected: selectedPayment === 'alipay' }"
            @click="selectedPayment = 'alipay'"
          >
            <div class="payment-icon alipay">💙</div>
            <span class="payment-name">支付宝</span>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="showBuyDialog = false">取消</button>
          <button class="btn-confirm" @click="confirmBuy">确认支付</button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { message } from "ant-design-vue";
import { emitter } from "@/utils/emitter";
import {
  subscriptionApi,
  type MemberLevelData,
  type MembershipPlan,
  type MembershipStatus,
} from "@/api";

const loading = ref(true);
const showBuyDialog = ref(false);
const selectedLevel = ref<MemberLevelData | null>(null);
const selectedPlan = ref<MembershipPlan | null>(null);
const selectedPayment = ref<string>("wechat");

const status = ref<MembershipStatus | null>(null);
const memberLevels = ref<MemberLevelData[]>([]);

const levelMap = {
  basic: "普通会员",
  advanced: "高级会员",
  professional: "专业会员",
};

const planMap = {
  monthly: "月卡",
  quarterly: "季卡",
  yearly: "年卡",
  lifetime: "永久卡",
  custom: "自定义",
};

function getLevelText(level?: string) {
  return levelMap[level as keyof typeof levelMap] || "普通会员";
}

function getPlanText(plan?: string) {
  return planMap[plan as keyof typeof planMap] || "未知";
}

function formatDate(date?: string) {
  if (!date) return "未知";
  return new Date(date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function fetchData() {
  loading.value = true;
  try {
    const [statusRes, plansRes] = await Promise.all([
      subscriptionApi.getStatus(),
      subscriptionApi.getPlans(),
    ]);
    status.value = statusRes.data.data;
    memberLevels.value = plansRes.data.data;
  } catch {
    message.error("获取会员信息失败");
  } finally {
    loading.value = false;
  }
}

function confirmBuy() {
  if (!selectedPlan.value) return;
  const paymentName = selectedPayment.value === "wechat" ? "微信支付" : "支付宝";
  showBuyDialog.value = false;
  message.success(
    `已选择 ${selectedLevel.value?.levelName} ${selectedPlan.value.name}（${paymentName}），支付功能即将上线`,
  );
  emitter.emit("notification:refresh");
  selectedPlan.value = null;
  selectedLevel.value = null;
  selectedPayment.value = "wechat";
}

onMounted(() => fetchData());
</script>

<style scoped lang="scss">
$text-dark: rgba(255, 255, 255, 0.95);
$text-gray: rgba(255, 255, 255, 0.7);
$text-light: rgba(255, 255, 255, 0.45);
$bg-page: #0a0a0f;
$bg-card: rgba(255, 255, 255, 0.05);
$bg-elevated: rgba(255, 255, 255, 0.08);
$border: rgba(255, 255, 255, 0.1);

$color-basic: rgba(255, 255, 255, 0.5);
$color-advanced: #00d4ff;
$color-professional: #ffd700;
$color-points: #ffd700;

.membership-page {
  min-height: calc(100vh - 70px);
  background: $bg-page;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: $color-advanced;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.page-container {
  max-width: 1120px;
  margin: 0 auto;
  padding: 64px 48px;
}

.page-header {
  margin-bottom: 32px;

  .title {
    font-size: 28px;
    font-weight: 600;
    color: $text-dark;
    margin: 0 0 8px;
  }

  .subtitle {
    font-size: 14px;
    color: $text-gray;
    margin: 0;
  }

  .contact-line {
    font-size: 16px;
    font-weight: 600;
    color: #00d4ff;
    margin: 12px 0 0;
    text-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
  }
}

.status-card {
  background: $bg-card;
  border: 1px solid $border;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 40px;
}

.status-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;

  .level-icon {
    font-size: 24px;
  }

  .level-name {
    font-size: 20px;
    font-weight: 600;
    color: $text-dark;

    &.basic {
      color: $color-basic;
    }

    &.advanced {
      color: $color-advanced;
    }

    &.professional {
      color: $color-professional;
    }
  }
}

.status-divider {
  height: 1px;
  background: $border;
  margin: 12px 0;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  align-items: center;

  .info-label {
    font-size: 14px;
    color: $text-light;
  }

  .info-colon {
    color: $text-gray;
    font-size: 14px;
  }

  .info-value {
    font-size: 14px;
    font-weight: 500;
    color: $text-dark;

    &.points {
      color: $color-points;
    }
  }
}

.level-tag {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;

  &.basic {
    background: rgba(255, 255, 255, 0.1);
    color: $color-basic;
  }

  &.advanced {
    background: rgba(0, 212, 255, 0.15);
    color: $color-advanced;
  }

  &.professional {
    background: rgba(255, 215, 0, 0.15);
    color: $color-professional;
  }
}

.sub-info {
  font-size: 13px;
  color: $text-gray;
}

.status-right {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.points-num {
  font-size: 18px;
  font-weight: 600;
  color: $color-points;
}

.points-label {
  font-size: 12px;
  color: $text-light;
}

.section-title {
  font-size: 18px;
  font-weight: 500;
  color: $text-dark;
  margin: 0 0 20px;
}

.levels-section {
  margin-bottom: 48px;
}

.levels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 20px;
}

.level-card {
  position: relative;
  background: $bg-card;
  border: 1px solid $border;
  border-radius: 12px;
  padding: 24px;
  transition: border-color 0.2s;

  &:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  &.current {
    border-color: rgba(0, 212, 255, 0.3);
  }

  &.recommended {
    border-color: rgba(255, 215, 0, 0.3);
  }
}

.recommend-tag {
  position: absolute;
  top: -1px;
  right: 20px;
  padding: 4px 12px;
  background: $color-professional;
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  border-radius: 0 0 4px 4px;
}

.level-header {
  margin-bottom: 16px;
}

.level-name {
  font-size: 18px;
  font-weight: 500;
  color: $text-dark;
  margin: 0;
}

.level-benefits {
  list-style: none;
  padding: 0;
  margin: 0 0 20px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);

  li {
    font-size: 13px;
    color: $text-gray;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    display: flex;
    align-items: center;
    gap: 8px;

    &::before {
      content: "✓";
      color: #00ff88;
      font-weight: 600;
      flex-shrink: 0;
    }

    &:last-child {
      border-bottom: none;
    }
  }
}

.plans-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid $border;
}

.plan-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid transparent;
  transition: border-color 0.2s;

  &:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  &.recommended {
    border-color: rgba(255, 215, 0, 0.2);
  }

  .plan-info {
    display: flex;
    gap: 6px;
  }

  .plan-name {
    font-size: 14px;
    font-weight: 500;
    color: $text-dark;
  }

  .plan-duration {
    font-size: 13px;
    color: $text-light;
  }

  .plan-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .plan-price {
    font-size: 16px;
    font-weight: 600;
    color: $text-dark;
  }
}

.btn-buy {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: rgba(0, 212, 255, 0.15);
  color: $color-advanced;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.85;
  }
}

.earn-section {
  margin-bottom: 48px;
}

.earn-grid {
  display: flex;
  gap: 16px;
}

.earn-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: $bg-card;
  border-radius: 6px;
  border: 1px solid $border;

  .earn-name {
    font-size: 14px;
    color: $text-gray;
  }

  .earn-points {
    font-size: 14px;
    font-weight: 500;
    color: $color-points;
  }
}

.benefits-list {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.benefit-tag {
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  border: 1px solid $border;
  font-size: 13px;
  color: $text-gray;
}

.modal-box {
  padding: 24px;
}

.modal-title {
  font-size: 18px;
  font-weight: 500;
  color: $text-dark;
  margin: 0 0 8px;
  text-align: center;
}

.modal-subtitle {
  font-size: 14px;
  color: $text-gray;
  margin: 0 0 20px;
  text-align: center;
}

.plans-select {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.payment-select {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.payment-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid $border;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  &.selected {
    border-color: $color-advanced;
    background: rgba(0, 212, 255, 0.08);
  }

  .payment-icon {
    font-size: 24px;
  }

  .payment-name {
    font-size: 14px;
    font-weight: 500;
    color: $text-dark;
  }
}

.plan-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid $border;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  &.selected {
    border-color: $color-advanced;
    background: rgba(0, 212, 255, 0.08);
  }

  &.recommended {
    .option-tag {
      display: block;
    }
  }

  .option-left {
    display: flex;
    gap: 6px;
  }

  .option-name {
    font-size: 14px;
    font-weight: 500;
    color: $text-dark;
  }

  .option-duration {
    font-size: 13px;
    color: $text-light;
  }

  .option-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .option-price {
    font-size: 16px;
    font-weight: 600;
    color: $text-dark;
  }

  .option-tag {
    display: none;
    padding: 2px 8px;
    background: $color-professional;
    color: #fff;
    font-size: 11px;
    border-radius: 3px;
  }
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.85;
  }
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.1);
  color: $text-gray;
}

.btn-confirm {
  background: $color-advanced;
  color: #fff;
}

@media (max-width: 900px) {
  .page-container {
    padding: 40px 24px;
  }

  .levels-grid {
    grid-template-columns: 1fr;
  }

  .earn-grid {
    flex-wrap: wrap;
  }
}

@media (max-width: 600px) {
  .page-container {
    padding: 24px 16px;
  }

  .page-header .title {
    font-size: 24px;
  }

  .status-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .earn-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }

  .benefits-list {
    flex-wrap: wrap;
  }

  .level-card {
    padding: 20px;
  }

  .plans-list {
    gap: 10px;
  }

  .plan-item {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
}
</style>
