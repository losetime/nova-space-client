<template>
  <div class="intelligence-view">
    <!-- 顶部 Tab -->
    <div class="intel-header">
      <h1>航天动态中心</h1>
      <p>精选航天领域最新动态，深度解读行业发展趋势</p>
    </div>

    <div class="intel-tabs">
      <a-tabs v-model:activeKey="activeTab" type="card" size="large" @change="handleTabChange">
        <a-tab-pane key="all" tab="全部" />
        <a-tab-pane key="launch" tab="发射任务" />
        <a-tab-pane key="satellite" tab="卫星运行" />
        <a-tab-pane key="industry" tab="行业动态" />
        <a-tab-pane key="research" tab="科研成果" />
        <a-tab-pane key="environment" tab="空间环境" />
      </a-tabs>
    </div>

    <!-- 内容区 -->
    <div class="intel-content">
      <!-- 左侧文章列表 -->
      <div class="article-list">
        <a-spin :spinning="loading" tip="加载中...">
          <div v-if="intelligenceList.length === 0 && !loading" class="empty-state">
            <p>暂无情报数据</p>
          </div>

          <div
            v-for="item in intelligenceList"
            :key="item.id"
            :class="['article-card']"
            @click="handleCardClick(item)"
          >
            <div class="article-main">
              <div class="article-tags">
                <div class="article-tag" :class="item.category">
                  {{ getCategoryLabel(item.category) }}
                </div>
                <div class="article-level-tag" :class="item.level">
                  {{ levelMap[item.level] || item.level }}
                </div>
              </div>
              <h3>{{ item.title }}</h3>
              <p>{{ item.summary }}</p>
              <div class="article-meta">
                <span><ClockCircleOutlined /> {{ formatDate(item.createdAt) }}</span>
                <span><UserOutlined /> {{ item.source }}</span>
                <span><EyeOutlined /> {{ formatViews(item.views) }}</span>
              </div>
            </div>
            <div class="article-action">
              <a-button type="primary" ghost> 阅读全文 </a-button>
            </div>
          </div>
        </a-spin>

        <!-- 分页 -->
        <div class="pagination-wrapper" v-if="total > pageSize">
          <a-pagination
            v-model:current="currentPage"
            :total="total"
            :pageSize="pageSize"
            @change="handlePageChange"
          />
        </div>
      </div>

      <!-- 右侧边栏 -->
      <aside class="sidebar">
        <!-- 热门排行 -->
        <div class="sidebar-section">
          <h3><FireOutlined /> 热门排行</h3>
          <a-spin :spinning="hotLoading">
            <div class="rank-list">
              <div
                v-for="(item, index) in hotList"
                :key="item.id"
                class="rank-item"
                @click="handleHotClick(item.id)"
              >
                <span :class="['rank-num', { top: index < 3 }]">{{ index + 1 }}</span>
                <span class="rank-title">{{ item.title }}</span>
                <span class="rank-views">{{ formatViews(item.views) }}</span>
              </div>
            </div>
          </a-spin>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  ClockCircleOutlined,
  UserOutlined,
  EyeOutlined,
  FireOutlined,
} from "@ant-design/icons-vue";
import { intelligenceApi, subscriptionApi, type Intelligence } from "@/api";

const router = useRouter();
const activeTab = ref("all");
const currentPage = ref(1);
const pageSize = ref(12);
const total = ref(0);
const loading = ref(false);
const hotLoading = ref(false);

const intelligenceList = ref<Intelligence[]>([]);
const hotList = ref<{ id: number; title: string; views: number }[]>([]);
const levelMap = ref<Record<string, string>>({});

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

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatViews = (views: number) => {
  if (views >= 10000) {
    return (views / 10000).toFixed(1) + "万";
  }
  return views?.toString() || "0";
};

// 获取情报列表
const fetchIntelligenceList = async () => {
  loading.value = true;
  try {
    const params: { category?: string; page: number; pageSize: number } = {
      page: currentPage.value,
      pageSize: pageSize.value,
    };
    if (activeTab.value !== "all") {
      params.category = activeTab.value;
    }

    const res = await intelligenceApi.getList(params);
    if (res.data.code === 0) {
      intelligenceList.value = res.data.data.list;
      total.value = res.data.data.total;
    }
  } catch (error) {
    console.error("获取情报列表失败:", error);
  } finally {
    loading.value = false;
  }
};

// 获取热门排行
const fetchHotList = async () => {
  hotLoading.value = true;
  try {
    const res = await intelligenceApi.getHotList();
    if (res.data.code === 0) {
      hotList.value = res.data.data;
    }
  } catch (error) {
    console.error("获取热门排行失败:", error);
  } finally {
    hotLoading.value = false;
  }
};

const handleTabChange = () => {
  currentPage.value = 1;
  fetchIntelligenceList();
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  fetchIntelligenceList();
};

const handleCardClick = (item: Intelligence) => {
  router.push(`/intelligence/${item.id}`);
};

const handleHotClick = (id: number) => {
  router.push(`/intelligence/${id}`);
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

onMounted(() => {
  fetchLevelMap();
  fetchIntelligenceList();
  fetchHotList();
});
</script>

<style scoped lang="scss">
.intelligence-view {
  min-height: calc(100vh - 64px);
  background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
  padding: 40px 24px;
}

.intel-header {
  text-align: center;
  margin-bottom: 40px;

  h1 {
    font-size: 48px;
    font-weight: 700;
    background: linear-gradient(135deg, #00d4ff 0%, #7b2cbf 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 12px;
  }

  p {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.6);
  }
}

.intel-tabs {
  max-width: 1000px;
  margin: 0 auto 40px;

  :deep(.ant-tabs) {
    .ant-tabs-nav {
      margin: 0;
    }

    .ant-tabs-tab {
      background: rgba(255, 255, 255, 0.03);
      border-color: rgba(0, 212, 255, 0.1) !important;
      color: rgba(255, 255, 255, 0.7);
      font-size: 15px;
      padding: 12px 24px;
      transition: all 0.3s;

      &:hover {
        color: #00d4ff;
      }

      &.ant-tabs-tab-active {
        background: linear-gradient(
          135deg,
          rgba(0, 212, 255, 0.2) 0%,
          rgba(123, 44, 191, 0.2) 100%
        );
        border-color: rgba(0, 212, 255, 0.3) !important;
        color: #00d4ff;
      }
    }
  }
}

.intel-content {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 32px;
  max-width: 1440px;
  margin: 0 auto;
}

.article-list {
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: rgba(255, 255, 255, 0.5);
  }

  .article-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(0, 212, 255, 0.1);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    gap: 24px;
    transition: all 0.3s ease;
    cursor: pointer;

    &:hover {
      border-color: rgba(0, 212, 255, 0.3);
      transform: translateX(4px);
    }

    &.locked {
      opacity: 0.7;
    }

    .article-main {
      flex: 1;

      .article-tags {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }

      .article-tag {
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

      .article-level-tag {
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
      }

      h3 {
        font-size: 18px;
        font-weight: 600;
        color: #fff;
        margin-bottom: 12px;
        line-height: 1.4;
      }

      p {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.5);
        line-height: 1.7;
        margin-bottom: 16px;
      }

      .article-meta {
        display: flex;
        gap: 20px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.4);

        span {
          display: flex;
          align-items: center;
          gap: 6px;
        }
      }
    }

    .article-action {
      display: flex;
      align-items: center;

      .unlock-btn {
        background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
        border: none;
        color: #000;

        &:hover {
          opacity: 0.9;
        }
      }
    }
  }

  .pagination-wrapper {
    display: flex;
    justify-content: center;
    margin-top: 40px;

    :deep(.ant-pagination) {
      .ant-pagination-item {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(0, 212, 255, 0.2);

        a {
          color: #fff;
        }

        &.ant-pagination-item-active {
          background: linear-gradient(135deg, #00d4ff 0%, #7b2cbf 100%);
          border-color: transparent;
        }
      }
    }
  }
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.sidebar-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(0, 212, 255, 0.1);
  border-radius: 12px;
  padding: 20px;

  h3 {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;

    .anticon {
      color: #ff6b35;
    }
  }

  p {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 16px;
  }
}

.rank-list {
  .rank-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    cursor: pointer;

    &:last-child {
      border-bottom: none;
    }

    &:hover .rank-title {
      color: #00d4ff;
    }

    .rank-num {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;

      &.top {
        background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
        color: #000;
      }
    }

    .rank-title {
      flex: 1;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.8);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: color 0.3s;
    }

    .rank-views {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
    }
  }
}

@media (max-width: 1024px) {
  .intel-content {
    grid-template-columns: 1fr;
  }

  .sidebar {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .sidebar {
    grid-template-columns: 1fr;
  }

  .article-card {
    flex-direction: column;
  }
}
</style>
