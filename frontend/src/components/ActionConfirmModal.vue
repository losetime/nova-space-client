<template>
  <a-modal
    :open="visible"
    :title="modalTitle"
    :ok-text="computedOkText"
    :cancel-text="cancelText"
    centered
    @ok="handleConfirm"
    @cancel="handleCancel"
  >
    <div class="modal-content">
      <div class="modal-icon" :class="type">
        <LockOutlined v-if="type === 'login'" />
        <CrownOutlined v-else-if="type === 'upgrade'" />
        <ExclamationCircleOutlined v-else />
      </div>
      <p class="modal-message">{{ modalContent }}</p>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { LockOutlined, CrownOutlined, ExclamationCircleOutlined } from "@ant-design/icons-vue";

export interface ActionConfirmModalProps {
  visible: boolean;
  type: "login" | "upgrade";
  title?: string;
  content?: string;
  okText?: string;
  cancelText?: string;
  redirect?: string;
}

const props = withDefaults(defineProps<ActionConfirmModalProps>(), {
  title: "",
  content: "",
  okText: "确认",
  cancelText: "取消",
  redirect: "",
});

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

const router = useRouter();

const modalTitle = computed(() => {
  if (props.title) return props.title;
  return props.type === "login" ? "请先登录" : "升级会员";
});

const modalContent = computed(() => {
  if (props.content) return props.content;
  return props.type === "login"
    ? "该功能需要登录后才能使用，是否前往登录？"
    : "该功能需要订阅会员才能使用，是否前往升级？";
});

const computedOkText = computed(() => {
  return props.okText || (props.type === "login" ? "去登录" : "去升级");
});

const getRedirectPath = () => {
  if (props.type === "login") {
    const target = props.redirect || "/satellite";
    return `/login?redirect=${encodeURIComponent(target)}`;
  }
  return "/membership";
};

function handleConfirm() {
  emit("confirm");
  emit("update:visible", false);
  setTimeout(() => {
    router.push(getRedirectPath());
  }, 100);
}

function handleCancel() {
  emit("cancel");
  emit("update:visible", false);
}

defineExpose({
  show: () => {
    emit("update:visible", true);
  },
  hide: () => {
    emit("update:visible", false);
  },
});
</script>

<style scoped lang="scss">
.modal-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;
}

.modal-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-bottom: 20px;

  &.login {
    background: rgba(0, 212, 255, 0.12);
    color: #00d4ff;
  }

  &.upgrade {
    background: rgba(255, 193, 7, 0.12);
    color: #ffc107;
  }
}

.modal-message {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
  line-height: 1.6;
  margin: 0;
}
</style>
