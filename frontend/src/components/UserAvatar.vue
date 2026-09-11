<template>
  <div
    class="user-avatar"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${fontSize}px` }"
  >
    <img
      v-if="user?.avatar"
      :src="getFullImageUrl(user.avatar)"
      alt="avatar"
      class="avatar-img"
    />
    <span v-else class="avatar-initial">{{ initial }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { User } from '@/api'
import { getFullImageUrl } from '@/utils/image-url'

const props = withDefaults(
  defineProps<{
    user?: User | null
    size?: number
  }>(),
  {
    size: 36,
  },
)

const initial = computed(() =>
  (props.user?.nickname || props.user?.username || 'U').charAt(0).toUpperCase(),
)

const fontSize = computed(() => Math.round(props.size * 0.4))
</script>

<style scoped lang="scss">
.user-avatar {
  position: relative;
  flex-shrink: 0;
  background: linear-gradient(135deg, #00d4ff 0%, #7b2cbf 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #fff;
}

.avatar-img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-initial {
  position: relative;
  z-index: 1;
  line-height: 1;
}
</style>