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
        <h2 class="auth-title">登录</h2>
        <a-form :model="loginForm" :rules="loginRules" layout="vertical" @finish="handleLogin">
          <a-form-item name="email" label="邮箱">
            <a-input v-model:value="loginForm.email" placeholder="请输入邮箱" size="large">
              <template #prefix>
                <MailOutlined />
              </template>
            </a-input>
          </a-form-item>

          <a-form-item name="password" label="密码">
            <a-input-password
              v-model:value="loginForm.password"
              placeholder="请输入密码"
              size="large"
            >
              <template #prefix>
                <LockOutlined />
              </template>
            </a-input-password>
          </a-form-item>

          <a-form-item>
            <a-button type="primary" html-type="submit" size="large" block :loading="loading">
              登录
            </a-button>
          </a-form-item>

          <div class="forgot-password">
            <a @click="router.push('/forgot-password')">忘记密码？</a>
          </div>
        </a-form>

        <div class="auth-footer">
          <p>
            还没有账号？
            <a @click="router.push('/register')">立即注册</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { message } from "ant-design-vue";
import { MailOutlined, LockOutlined } from "@ant-design/icons-vue";
import { useUserStore } from "@/stores/user";

const router = useRouter();
const userStore = useUserStore();

const loading = ref(false);

const loginForm = reactive({
  email: "",
  password: "",
});

const loginRules = {
  email: [
    { required: true, message: "请输入邮箱" },
    { type: "email", message: "请输入有效的邮箱地址" },
  ],
  password: [{ required: true, message: "请输入密码" }],
};

async function handleLogin() {
  loading.value = true;
  try {
    const result = await userStore.login(loginForm.email, loginForm.password);
    if (result.success) {
      message.success("登录成功");
      const redirect = router.currentRoute.value.query.redirect as string;
      router.push(redirect || "/");
    } else {
      message.error(result.message || "登录失败");
    }
  } finally {
    loading.value = false;
  }
}
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

.forgot-password {
  text-align: right;
  margin-top: -8px;
  margin-bottom: 4px;

  a {
    cursor: pointer;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);

    &:hover {
      color: #00d4ff;
    }
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