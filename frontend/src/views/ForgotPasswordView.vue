<template>
  <div class="auth-view">
    <div class="stars stars-layer-1"></div>
    <div class="stars stars-layer-2"></div>
    <div class="stars stars-layer-3"></div>
    <div class="planet"></div>

    <div class="auth-left">
      <div class="brand-content">
        <div class="logo">
          <img src="/favicon.svg?v=2" alt="星揽" class="logo-icon" />
        </div>
        <h1 class="brand-title">
          <span class="gradient-text">星揽</span>
        </h1>
        <p class="brand-desc">探索宇宙，从这里开始</p>
      </div>
    </div>

    <div class="auth-right">
      <div class="auth-card">
        <h2 class="auth-title">找回密码</h2>

        <!-- 第一步：输入邮箱发送验证码 -->
        <a-form
          v-if="step === 1"
          :model="emailForm"
          :rules="emailRules"
          layout="vertical"
          @finish="handleSendCode"
        >
          <a-form-item name="email" label="邮箱">
            <a-input v-model:value="emailForm.email" placeholder="请输入注册邮箱" size="large">
              <template #prefix>
                <MailOutlined />
              </template>
            </a-input>
          </a-form-item>

          <a-form-item>
            <a-button type="primary" html-type="submit" size="large" block :loading="sending">
              获取验证码
            </a-button>
          </a-form-item>
        </a-form>

        <!-- 第二步：输入验证码 + 新密码 -->
        <a-form
          v-else
          :model="resetForm"
          :rules="resetRules"
          layout="vertical"
          @finish="handleReset"
        >
          <a-form-item name="code" label="验证码">
            <a-input
              v-model:value="resetForm.code"
              placeholder="请输入6位验证码"
              size="large"
              :maxlength="6"
            >
              <template #prefix>
                <SafetyCertificateOutlined />
              </template>
              <template #suffix>
                <span v-if="countdown > 0" class="countdown">{{ countdown }}s</span>
                <a v-else class="resend" @click="handleSendCode">重新获取</a>
              </template>
            </a-input>
          </a-form-item>

          <a-form-item name="newPassword" label="新密码">
            <a-input-password
              v-model:value="resetForm.newPassword"
              placeholder="请输入新密码（至少6位）"
              size="large"
            >
              <template #prefix>
                <LockOutlined />
              </template>
            </a-input-password>
          </a-form-item>

          <a-form-item name="confirmPassword" label="确认密码">
            <a-input-password
              v-model:value="resetForm.confirmPassword"
              placeholder="请再次输入新密码"
              size="large"
            >
              <template #prefix>
                <LockOutlined />
              </template>
            </a-input-password>
          </a-form-item>

          <a-form-item>
            <a-button type="primary" html-type="submit" size="large" block :loading="resetting">
              重置密码
            </a-button>
          </a-form-item>
        </a-form>

        <div class="auth-footer">
          <p>
            <a @click="router.push('/login')">返回登录</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { message } from "ant-design-vue";
import {
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons-vue";
import { authApi } from "@/api";

const router = useRouter();

const step = ref(1);
const sending = ref(false);
const resetting = ref(false);
const countdown = ref(0);
let countdownTimer: ReturnType<typeof setInterval> | null = null;

const emailForm = reactive({
  email: "",
});

const emailRules = {
  email: [
    { required: true, message: "请输入邮箱" },
    { type: "email", message: "请输入有效的邮箱地址" },
  ],
};

const resetForm = reactive({
  code: "",
  newPassword: "",
  confirmPassword: "",
});

const resetRules = {
  code: [
    { required: true, message: "请输入验证码" },
    { len: 6, message: "验证码为6位数字" },
  ],
  newPassword: [
    { required: true, message: "请输入新密码" },
    { min: 6, message: "密码至少6个字符" },
  ],
  confirmPassword: [
    { required: true, message: "请确认新密码" },
    {
      validator: (_rule: unknown, value: string) => {
        if (value !== resetForm.newPassword) {
          return Promise.reject("两次输入的密码不一致");
        }
        return Promise.resolve();
      },
    },
  ],
};

function startCountdown() {
  countdown.value = 60;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      if (countdownTimer) clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }, 1000);
}

async function handleSendCode() {
  if (step.value === 1 && !emailForm.email) {
    message.warning("请输入邮箱");
    return;
  }
  sending.value = true;
  try {
    const res = await authApi.forgotPassword({ email: emailForm.email });
    if (res.data.code === 0) {
      message.success(res.data.message || "验证码已发送");
      step.value = 2;
      startCountdown();
    } else {
      message.error(res.data.message || "发送失败，请稍后重试");
    }
  } catch {
    message.error("发送失败，请检查网络后重试");
  } finally {
    sending.value = false;
  }
}

async function handleReset() {
  resetting.value = true;
  try {
    const res = await authApi.resetPassword({
      email: emailForm.email,
      code: resetForm.code,
      newPassword: resetForm.newPassword,
    });
    if (res.data.code === 0) {
      message.success(res.data.message || "密码重置成功");
      router.push("/login");
    } else {
      message.error(res.data.message || "重置失败，请检查验证码");
    }
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string | string[] } } };
    const msg = err.response?.data?.message;
    message.error(Array.isArray(msg) ? msg[0] : msg || "重置失败，请检查验证码");
  } finally {
    resetting.value = false;
  }
}

onBeforeUnmount(() => {
  if (countdownTimer) clearInterval(countdownTimer);
});
</script>

<style scoped lang="scss">
.auth-view {
  min-height: 100vh;
  display: flex;
  background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%);
  position: relative;
  overflow: hidden;
}

.stars {
  position: absolute;
  inset: 0;
  background-repeat: repeat;
  z-index: 0;
}

.auth-left {
  position: relative;
  flex: 0 0 60%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.stars-layer-1 {
  background-image:
    radial-gradient(1px 1px at 10px 20px, rgba(255, 255, 255, 0.8), rgba(0, 0, 0, 0)),
    radial-gradient(1px 1px at 50px 80px, rgba(255, 255, 255, 0.6), rgba(0, 0, 0, 0)),
    radial-gradient(1px 1px at 90px 40px, rgba(255, 255, 255, 0.7), rgba(0, 0, 0, 0)),
    radial-gradient(1px 1px at 130px 120px, rgba(255, 255, 255, 0.5), rgba(0, 0, 0, 0)),
    radial-gradient(1px 1px at 170px 60px, rgba(255, 255, 255, 0.6), rgba(0, 0, 0, 0));
  background-size: 200px 200px;
  animation:
    starDrift1 60s linear infinite,
    twinkle1 3s ease-in-out infinite;
}

.stars-layer-2 {
  background-image:
    radial-gradient(2px 2px at 20px 30px, #fff, rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 60px 90px, #eee, rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 100px 50px, #fff, rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 140px 130px, #ddd, rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 180px 70px, #fff, rgba(0, 0, 0, 0));
  background-size: 250px 250px;
  animation:
    starDrift2 80s linear infinite,
    twinkle2 4s ease-in-out infinite;
}

.stars-layer-3 {
  background-image:
    radial-gradient(3px 3px at 30px 60px, #00d4ff, rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 80px 150px, #fff, rgba(0, 0, 0, 0)),
    radial-gradient(3px 3px at 150px 30px, #7b2cbf, rgba(0, 0, 0, 0)),
    radial-gradient(2px 2px at 200px 100px, #fff, rgba(0, 0, 0, 0));
  background-size: 300px 300px;
  animation:
    starDrift3 100s linear infinite,
    twinkle3 5s ease-in-out infinite;
}

.planet {
  position: absolute;
  width: 500px;
  height: 500px;
  left: 10%;
  top: 50%;
  transform: translateY(-50%);
  background: radial-gradient(circle at 30% 30%, #7b2cbf 0%, #16213e 50%, transparent 70%);
  border-radius: 50%;
  opacity: 0.5;
  filter: blur(60px);
  z-index: 0;
}

@keyframes starDrift1 {
  from {
    transform: translateX(0) translateY(0);
  }
  to {
    transform: translateX(-200px) translateY(-200px);
  }
}

@keyframes starDrift2 {
  from {
    transform: translateX(0) translateY(0);
  }
  to {
    transform: translateX(250px) translateY(-250px);
  }
}

@keyframes starDrift3 {
  from {
    transform: translateX(0) translateY(0);
  }
  to {
    transform: translateX(-150px) translateY(-150px);
  }
}

@keyframes twinkle1 {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.8;
  }
}

@keyframes twinkle2 {
  0%,
  100% {
    opacity: 0.5;
  }
  30% {
    opacity: 1;
  }
  70% {
    opacity: 0.3;
  }
}

@keyframes twinkle3 {
  0%,
  100% {
    opacity: 0.6;
  }
  25% {
    opacity: 0.2;
  }
  50% {
    opacity: 1;
  }
  75% {
    opacity: 0.4;
  }
}

.brand-content {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 0 24px;

  .logo {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;

    .logo-icon {
      width: 64px;
      height: 64px;
      filter: drop-shadow(0 0 12px rgba(0, 212, 255, 0.6));
    }
  }

  .brand-title {
    font-size: 48px;
    font-weight: 700;
    margin-bottom: 16px;

    .gradient-text {
      background: linear-gradient(135deg, #00d4ff 0%, #7b2cbf 50%, #00d4ff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      background-size: 200% auto;
      animation: shine 3s linear infinite;
    }
  }

  .brand-desc {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.6;
  }
}

@keyframes shine {
  to {
    background-position: 200% center;
  }
}

.auth-right {
  position: relative;
  flex: 0 0 40%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 1;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 32px;
  backdrop-filter: blur(10px);

  .auth-title {
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    text-align: center;
    margin-bottom: 32px;
  }

  :deep(.ant-form) {
    .ant-form-item-label > label {
      color: rgba(255, 255, 255, 0.8);
    }

    .ant-input,
    .ant-input-password {
      background: rgba(255, 255, 255, 0.05) !important;
      border-color: rgba(255, 255, 255, 0.1);
      color: #fff;

      &::placeholder {
        color: rgba(255, 255, 255, 0.3);
      }

      &:hover,
      &:focus {
        border-color: #00d4ff;
        box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.1);
        background: rgba(255, 255, 255, 0.08) !important;
      }
    }

    .ant-input-affix-wrapper {
      background: rgba(255, 255, 255, 0.05) !important;
      border-color: rgba(255, 255, 255, 0.1);

      &:hover,
      &:focus,
      &.ant-input-affix-wrapper-focused {
        border-color: #00d4ff;
        box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.1);
        background: rgba(255, 255, 255, 0.08) !important;
      }

      .ant-input {
        background: transparent !important;
      }
    }

    .ant-input-prefix {
      color: rgba(255, 255, 255, 0.4);
    }

    .ant-btn-primary {
      background: linear-gradient(135deg, #00d4ff 0%, #7b2cbf 100%);
      border: none;
      height: 48px;
      font-size: 16px;
      font-weight: 500;

      &:hover {
        opacity: 0.9;
      }
    }
  }
}

.auth-footer {
  text-align: center;
  margin-top: 24px;

  p {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);

    a {
      cursor: pointer;
      color: #00d4ff;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}

.countdown {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  margin-right: 8px;
}

.resend {
  cursor: pointer;
  color: #00d4ff;
  font-size: 13px;
  margin-right: 4px;

  &:hover {
    text-decoration: underline;
  }
}

@media (max-width: 768px) {
  .auth-view {
    flex-direction: column;
  }

  .auth-left {
    flex: 0 0 40vh;
    min-height: 280px;
  }

  .planet {
    width: 300px;
    height: 300px;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .brand-content {
    .brand-title {
      font-size: 36px;
    }
  }

  .auth-right {
    flex: 1;
    padding: 16px;
  }
}
</style>