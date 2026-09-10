<template>
  <div class="settings-view">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="bg-blob blob-1"></div>
      <div class="bg-blob blob-2"></div>
      <div class="bg-grid"></div>
    </div>

    <div class="settings-container">
      <div class="settings-header">
        <a-button class="back-btn" @click="router.push('/profile')">
          <ArrowLeftOutlined />
          返回个人中心
        </a-button>
        <h1 class="page-title">账号设置</h1>
      </div>

      <div class="settings-card">
        <!-- 修改头像 -->
        <div class="settings-group">
          <h3>修改头像</h3>
          <div class="avatar-row">
            <UserAvatar :user="userStore.user" :size="96" glow />
            <div class="avatar-actions">
              <a-upload
                :show-upload-list="false"
                :before-upload="beforeUpload"
                :custom-request="customRequest"
                accept="image/jpeg,image/png,image/gif,image/webp"
              >
                <a-button type="primary" ghost :loading="avatarLoading">
                  <UploadOutlined />
                  上传新头像
                </a-button>
              </a-upload>
              <p class="avatar-tip">支持 jpg / png / gif / webp 格式，不超过 5MB</p>
            </div>
          </div>
        </div>

        <!-- 账号信息 -->
        <div class="settings-group">
          <h3>账号信息</h3>
          <div class="settings-form">
            <div class="form-row">
              <div class="form-item">
                <label>用户名</label>
                <input type="text" :value="userStore.user?.username" disabled />
              </div>
              <div class="form-item">
                <label>邮箱</label>
                <input type="email" :value="userStore.user?.email" disabled />
              </div>
            </div>
            <div class="form-item">
              <label>昵称</label>
              <input type="text" v-model="editForm.nickname" placeholder="设置一个昵称" />
            </div>
            <button class="save-btn" :disabled="updateLoading" @click="handleUpdateProfile">
              <template v-if="updateLoading">
                <LoadingOutlined class="spin" />
                <span>保存中...</span>
              </template>
              <template v-else>
                <SaveOutlined />
                <span>保存修改</span>
              </template>
            </button>
          </div>
        </div>

        <!-- 修改密码 -->
        <div class="settings-group">
          <h3>修改密码</h3>
          <div class="settings-form">
            <div class="form-item">
              <label>当前密码</label>
              <input
                type="password"
                v-model="passwordForm.oldPassword"
                placeholder="请输入当前密码"
              />
            </div>
            <div class="form-row">
              <div class="form-item">
                <label>新密码</label>
                <input
                  type="password"
                  v-model="passwordForm.newPassword"
                  placeholder="请输入新密码"
                  autocomplete="new-password"
                />
              </div>
              <div class="form-item">
                <label>确认密码</label>
                <input
                  type="password"
                  v-model="passwordForm.confirmPassword"
                  placeholder="再次输入新密码"
                  autocomplete="new-password"
                />
              </div>
            </div>
            <button class="save-btn" :disabled="passwordLoading" @click="handleChangePassword">
              <template v-if="passwordLoading">
                <LoadingOutlined class="spin" />
                <span>修改中...</span>
              </template>
              <template v-else>
                <LockOutlined />
                <span>修改密码</span>
              </template>
            </button>
          </div>
        </div>

        <!-- 账号操作 -->
        <div class="settings-group danger">
          <h3>账号操作</h3>
          <button class="logout-btn" @click="handleLogout">
            <LogoutOutlined />
            <span>退出登录</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { message, type UploadProps } from "ant-design-vue";
import {
  ArrowLeftOutlined,
  LoadingOutlined,
  SaveOutlined,
  LockOutlined,
  LogoutOutlined,
  UploadOutlined,
} from "@ant-design/icons-vue";
import { useUserStore } from "@/stores/user";
import UserAvatar from "@/components/UserAvatar.vue";
import { userApi } from "@/api";

const router = useRouter();
const userStore = useUserStore();

// 头像上传
const avatarLoading = ref(false);

// 编辑资料
const editForm = reactive({
  nickname: "",
});
const updateLoading = ref(false);

// 修改密码
const passwordForm = reactive({
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
});
const passwordLoading = ref(false);

// 上传前校验
const beforeUpload = (file: File) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    message.error("只支持 jpg, png, gif, webp 格式的图片");
    return false;
  }
  if (file.size > 5 * 1024 * 1024) {
    message.error("图片大小不能超过 5MB");
    return false;
  }
  return true;
};

// 自定义上传
const customRequest: UploadProps["customRequest"] = async ({ file, onSuccess, onError }) => {
  avatarLoading.value = true;
  try {
    const formData = new FormData();
    formData.append("file", file as Blob);
    const res = await userApi.uploadAvatar(formData);
    message.success("头像更新成功");
    await userStore.fetchUser();
    onSuccess?.(res.data);
  } catch (error) {
    message.error("头像上传失败");
    onError?.(error as Error);
  } finally {
    avatarLoading.value = false;
  }
};

// 更新资料
async function handleUpdateProfile() {
  updateLoading.value = true;
  try {
    const result = await userStore.updateUser({ nickname: editForm.nickname });
    if (result.success) {
      message.success("更新成功");
    } else {
      message.error(result.message || "更新失败");
    }
  } finally {
    updateLoading.value = false;
  }
}

// 修改密码
async function handleChangePassword() {
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    message.error("两次输入的密码不一致");
    return;
  }
  if (passwordForm.newPassword.length < 6) {
    message.error("密码至少6个字符");
    return;
  }

  passwordLoading.value = true;
  try {
    const result = await userStore.changePassword(
      passwordForm.oldPassword,
      passwordForm.newPassword,
    );
    if (result.success) {
      message.success("密码修改成功，请重新登录");
      handleLogout();
    } else {
      message.error(result.message || "修改密码失败");
    }
  } finally {
    passwordLoading.value = false;
  }
}

// 退出登录
function handleLogout() {
  userStore.logout();
  message.success("已退出登录");
  router.push("/login");
}

onMounted(async () => {
  if (!userStore.user) {
    await userStore.fetchUser();
  }
  editForm.nickname = userStore.user?.nickname || "";
});
</script>

<style scoped lang="scss">
$primary: #00d4ff;
$accent: #a855f7;

$bg-dark: #0a0a0f;
$bg-card: rgba(255, 255, 255, 0.03);
$bg-elevated: rgba(255, 255, 255, 0.06);

$text-primary: rgba(255, 255, 255, 0.95);
$text-secondary: rgba(255, 255, 255, 0.6);
$text-muted: rgba(255, 255, 255, 0.4);

.settings-view {
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

.settings-container {
  max-width: 760px;
  margin: 0 auto;
  padding: 32px 24px;
  position: relative;
  z-index: 1;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;

  .back-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: $text-secondary;
    border-radius: 8px;

    &:hover {
      color: $primary;
      border-color: rgba(0, 212, 255, 0.4);
    }
  }

  .page-title {
    font-size: 22px;
    font-weight: 700;
    color: $text-primary;
    margin: 0;
    letter-spacing: -0.02em;
  }
}

.settings-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.settings-group {
  padding: 24px;
  background: $bg-card;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  backdrop-filter: blur(20px);

  h3 {
    font-size: 16px;
    font-weight: 600;
    color: $text-primary;
    margin: 0 0 20px;
  }

  &.danger {
    border-color: rgba(239, 68, 68, 0.2);
  }
}

// 头像区域
.avatar-row {
  display: flex;
  align-items: center;
  gap: 24px;

  .avatar-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .avatar-tip {
    font-size: 12px;
    color: $text-muted;
    margin: 0;
  }
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 13px;
    color: $text-secondary;
  }

  input {
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.04) !important;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: $text-primary;
    font-size: 14px;
    transition: all 0.3s;

    &:focus {
      outline: none;
      border-color: $primary;
      background: rgba(255, 255, 255, 0.06) !important;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &::placeholder {
      color: $text-muted;
    }
  }
}

.save-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, $primary 0%, $accent 100%);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  align-self: flex-start;

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
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

.logout-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #ef4444;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
  }
}

// 响应式
@media (max-width: 768px) {
  .avatar-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .settings-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>