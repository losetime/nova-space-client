<template>
  <div class="intelligence-detail-view">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <a-spin size="large" />
      <p>加载中...</p>
    </div>

    <div v-else-if="detail" class="detail-container">
        <!-- 返回按钮 -->
        <div class="back-nav">
          <a-button type="text" @click="router.push('/intelligence')">
            <LeftOutlined /> 返回情报列表
          </a-button>
        </div>

        <!-- 文章头部 -->
        <div class="detail-header">
          <div class="detail-tags">
            <div class="detail-tag" :class="detail.category">
              {{ getCategoryLabel(detail.category) }}
            </div>
            <div class="detail-level-tag" :class="detail.level">
              {{ detail.level === "free" ? "免费" : levelMap[detail.level] || detail.level }}
            </div>
          </div>
          <h1>{{ detail.title }}</h1>
          <div class="detail-meta">
            <span><ClockCircleOutlined /> {{ formatDate(detail.createdAt) }}</span>
            <span><UserOutlined /> {{ detail.source }}</span>
            <span><EyeOutlined /> {{ formatViews(detail.views) }}</span>
          </div>
        </div>

        <!-- 摘要 -->
        <div class="summary-box">
          <p>{{ detail.summary }}</p>
        </div>

        <!-- 正文 -->
        <div class="content-text" v-html="renderMarkdown(displayedContent)"></div>

        <!-- 阅读更多按钮（内容被截断时显示） -->
        <div v-if="!canViewFullContent" class="read-more-container">
          <a-button type="primary" @click="handleReadMore">阅读更多</a-button>
        </div>

        <!-- 深度解读 -->
        <div v-if="detail.analysis" class="analysis-box">
          <h4><BulbOutlined /> 深度解读</h4>
          <p>{{ detail.analysis }}</p>
        </div>

        <!-- 趋势预判 -->
        <div v-if="detail.trend" class="trend-box">
          <h4><LineChartOutlined /> 趋势预判</h4>
          <p>{{ detail.trend }}</p>
        </div>

        <!-- 标签 -->
        <div v-if="detail.tags?.length" class="tags-box">
          <a-tag v-for="tag in detail.tags" :key="tag" color="blue">{{ tag }}</a-tag>
        </div>

        <!-- 来源 -->
        <div v-if="detail.sourceUrl" class="source-box">
          <LinkOutlined />
          <a :href="detail.sourceUrl" target="_blank" rel="noopener">查看原文</a>
        </div>

        <!-- 操作栏 -->
        <div class="action-bar">
          <a-button
            :type="detail.isCollected ? 'primary' : 'default'"
            size="large"
            @click="handleCollect"
          >
            <StarFilled v-if="detail.isCollected" />
            <StarOutlined v-else />
            {{ detail.isCollected ? "已收藏" : "收藏" }}
          </a-button>
          <a-button size="large" @click="handleShare">
            <ShareAltOutlined />
            分享
          </a-button>
        </div>
      </div>

      <!-- 加载失败 -->
      <div v-else class="error-state">
        <a-result status="404" title="情报不存在" sub-title="该情报可能已被删除或您没有访问权限">
          <template #extra>
            <a-button type="primary" @click="router.push('/intelligence')"> 返回情报列表 </a-button>
          </template>
        </a-result>
      </div>

    <!-- 阅读更多确认弹窗 -->
    <ActionConfirmModal
      v-model:visible="readMoreConfirmVisible"
      :type="userStore.isLoggedIn ? 'upgrade' : 'login'"
      :redirect="`/intelligence/${route.params.id}`"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { message } from "ant-design-vue";
import {
  LeftOutlined,
  ClockCircleOutlined,
  UserOutlined,
  EyeOutlined,
  StarOutlined,
  StarFilled,
  BulbOutlined,
  LineChartOutlined,
  LinkOutlined,
  ShareAltOutlined,
} from "@ant-design/icons-vue";
import { intelligenceApi, subscriptionApi, type Intelligence } from "@/api";
import { useUserStore } from "@/stores/user";
import ActionConfirmModal from "@/components/ActionConfirmModal.vue";
import { marked } from "marked";
import truncate from "truncate-html";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const loading = ref(false);
const detail = ref<Intelligence | null>(null);
const levelMap = ref<Record<string, string>>({});
const readMoreConfirmVisible = ref(false);

const canViewFullContent = computed(() => {
  if (!userStore.isLoggedIn) return false;
  if (userStore.isVip) return true;
  if (detail.value?.level === "basic") return true;
  return false;
});

const displayedContent = computed(() => {
  if (!detail.value?.content) return "";
  if (canViewFullContent.value) return marked(detail.value.content);
  return truncate(detail.value.content, 100, { ellipsis: "...", byWords: false });
});

const categoryLabels: Record<string, string> = {
  launch: "发射任务",
  satellite: "卫星运行",
  industry: "行业动态",
  research: "科研成果",
  environment: "空间环境",
};

const getCategoryLabel = (category: string) => {
  return categoryLabels[category] || category;
};

const fetchLevelMap = async () => {
  try {
    const res = await subscriptionApi.getPlans();
    if (res.data.code === 0) {
      const map: Record<string, string> = {};
      for (const item of res.data.data) {
        map[item.level] = item.levelName;
      }
      levelMap.value = map;
    }
  } catch (error) {
    console.error("获取会员等级映射失败:", error);
  }
};

const formatDate = (dateStr: string | Date | null | undefined) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatViews = (views: number) => {
  if (views >= 10000) {
    return (views / 10000).toFixed(1) + "万";
  }
  return views?.toString() || "0";
};

const renderMarkdown = (content: string) => {
  if (!content) return "";
  return marked(content);
};

const fetchDetail = async () => {
  const id = Number(route.params.id);
  if (!id) {
    router.push("/intelligence");
    return;
  }

  loading.value = true;
  try {
    const res = await intelligenceApi.getDetail(id);
    if (res.data.code === 0) {
      detail.value = res.data.data;

      // 单独检查收藏状态（如果已登录）
      if (userStore.isLoggedIn) {
        try {
          const collectRes = await intelligenceApi.isCollected(id);
          detail.value.isCollected = collectRes.data.data.isCollected;
        } catch {
          /* silent fail */
        }
      }
    }
  } catch (error) {
    console.error("获取情报详情失败:", error);
  } finally {
    loading.value = false;
  }
};

const handleCollect = async () => {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    message.warning("请先登录");
    return;
  }

  if (!detail.value) return;

  try {
    const res = await intelligenceApi.toggleCollect(detail.value.id);
    if (res.data.code === 0) {
      const collected = res.data.data.collected;
      message.success(collected ? "收藏成功" : "已取消收藏");
      if (detail.value) {
        detail.value.isCollected = collected;
        detail.value.collects += collected ? 1 : -1;
      }
    }
  } catch (error) {
    console.error("收藏操作失败:", error);
    message.error("操作失败");
  }
};

const handleReadMore = () => {
  readMoreConfirmVisible.value = true;
};

const handleShare = () => {
  const url = window.location.href;
  navigator.clipboard
    .writeText(url)
    .then(() => {
      message.success("链接已复制到剪贴板");
    })
    .catch(() => {
      message.info("分享链接: " + url);
    });
};

onMounted(() => {
  fetchLevelMap();
  fetchDetail();
});
</script>

<style scoped lang="scss">
.intelligence-detail-view {
  min-height: calc(100vh - 64px);
  background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
  padding: 40px 24px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 64px - 80px);
  gap: 16px;
  color: rgba(255, 255, 255, 0.5);
}

.loading-container p {
  margin: 0;
}

.detail-container {
  max-width: 900px;
  margin: 0 auto;
}

.back-nav {
  margin-bottom: 24px;

  :deep(.ant-btn) {
    color: rgba(255, 255, 255, 0.6);

    &:hover {
      color: #00d4ff;
    }
  }
}

.detail-header {
  margin-bottom: 32px;

  .detail-tags {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .detail-tag {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;

    &.launch {
      background: rgba(0, 212, 255, 0.15);
      color: #00d4ff;
    }

    &.satellite {
      background: rgba(123, 44, 191, 0.15);
      color: #9d4edd;
    }

    &.industry {
      background: rgba(255, 193, 7, 0.15);
      color: #ffc107;
    }

    &.research {
      background: rgba(0, 255, 136, 0.15);
      color: #00ff88;
    }

    &.environment {
      background: rgba(255, 107, 53, 0.15);
      color: #ff6b35;
    }
  }

  .detail-level-tag {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;

    &.professional {
      background: rgba(0, 255, 136, 0.15);
      color: #00ff88;
    }

    &.basic {
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.5);
    }

    &.free {
      background: rgba(0, 212, 255, 0.15);
      color: #00d4ff;
    }

    &.advanced {
      background: rgba(123, 44, 191, 0.15);
      color: #9d4edd;
    }
  }

  h1 {
    font-size: 32px;
    font-weight: 700;
    color: #fff;
    line-height: 1.4;
    margin-bottom: 16px;
  }

  .detail-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.5);

    span {
      display: flex;
      align-items: center;
      gap: 6px;
    }
  }
}

.summary-box {
  background: rgba(0, 212, 255, 0.1);
  border-left: 3px solid #00d4ff;
  padding: 20px 24px;
  margin-bottom: 32px;
  border-radius: 0 12px 12px 0;

  p {
    color: rgba(255, 255, 255, 0.85);
    font-size: 16px;
    line-height: 1.8;
    margin: 0;
  }
}

.content-text {
  color: rgba(255, 255, 255, 0.85);
  font-size: 16px;
  line-height: 1.9;
  margin-bottom: 32px;

  :deep(h1),
  :deep(h2),
  :deep(h3) {
    color: #fff;
    margin-top: 32px;
    margin-bottom: 16px;
  }

  :deep(h1) {
    font-size: 28px;
  }
  :deep(h2) {
    font-size: 24px;
  }
  :deep(h3) {
    font-size: 20px;
  }

  :deep(p) {
    margin-bottom: 20px;
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 28px;
    margin-bottom: 20px;
  }

  :deep(li) {
    margin-bottom: 10px;
  }

  :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 16px 0;
  }

  :deep(code) {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 14px;
  }

  :deep(pre) {
    background: rgba(0, 0, 0, 0.3);
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin-bottom: 20px;

    code {
      background: none;
      padding: 0;
    }
  }

  :deep(blockquote) {
    border-left: 3px solid #00d4ff;
    padding-left: 16px;
    margin: 20px 0;
    color: rgba(255, 255, 255, 0.7);
  }
}

.analysis-box,
.trend-box {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(0, 212, 255, 0.15);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;

  h4 {
    color: #00d4ff;
    font-size: 16px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  p {
    color: rgba(255, 255, 255, 0.75);
    font-size: 15px;
    line-height: 1.8;
    margin: 0;
  }
}

.trend-box {
  border-color: rgba(123, 44, 191, 0.3);

  h4 {
    color: #9d4edd;
  }
}

.tags-box {
  margin: 24px 0;

  :deep(.ant-tag) {
    margin-bottom: 8px;
    padding: 4px 12px;
    font-size: 13px;
  }
}

.source-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  margin-bottom: 32px;
  color: rgba(255, 255, 255, 0.6);

  a {
    color: #00d4ff;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.action-bar {
  display: flex;
  gap: 16px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.read-more-container {
  text-align: center;
  padding: 16px;
  margin-bottom: 32px;
}

.error-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;

  :deep(.ant-result-title) {
    color: #fff;
  }

  :deep(.ant-result-subtitle) {
    color: rgba(255, 255, 255, 0.5);
  }
}

@media (max-width: 768px) {
  .detail-header {
    h1 {
      font-size: 24px;
    }

    .detail-meta {
      gap: 12px;
      font-size: 13px;
    }
  }

  .summary-box {
    padding: 16px;

    p {
      font-size: 15px;
    }
  }

  .content-text {
    font-size: 15px;
  }
}
</style>
