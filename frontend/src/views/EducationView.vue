<template>
  <div class="education-view">
    <!-- Hero Banner -->
    <div class="edu-hero">
      <div class="hero-content">
        <h1>航天知识科普中心</h1>
        <p>从入门到进阶，探索宇宙的奥秘</p>
      </div>
    </div>

    <!-- 分类导航 -->
    <div class="category-nav">
      <a-tabs
        v-model:activeKey="activeCategory"
        centered
        size="large"
        @change="handleCategoryChange"
      >
        <a-tab-pane key="all" tab="全部">
          <template #icon><AppstoreOutlined /></template>
        </a-tab-pane>
        <a-tab-pane key="basic" tab="基础入门">
          <template #icon><RocketOutlined /></template>
        </a-tab-pane>
        <a-tab-pane key="advanced" tab="专业进阶">
          <template #icon><ExperimentOutlined /></template>
        </a-tab-pane>
        <a-tab-pane key="mission" tab="经典任务">
          <template #icon><SendOutlined /></template>
        </a-tab-pane>
        <a-tab-pane key="people" tab="人物/机构">
          <template #icon><TeamOutlined /></template>
        </a-tab-pane>
      </a-tabs>
    </div>

    <!-- 内容区域 -->
    <div class="content-area">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <a-spin size="large" />
        <p>加载中...</p>
      </div>

      <!-- 文章列表 -->
      <div v-else class="content-grid">
        <div
          v-for="item in articles"
          :key="item.id"
          class="content-card"
          @click="openArticle(item)"
        >
          <div class="card-cover">
            <img
              v-lazy="getCoverUrl(item.cover)"
              :alt="item.title"
              src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
              @error="handleImageError"
            />
            <div class="card-type">{{ item.type === "video" ? "视频" : "图文" }}</div>
          </div>
          <div class="card-body">
            <h3>{{ item.title }}</h3>
            <p>{{ item.summary }}</p>
            <div class="card-meta">
              <span><EyeOutlined /> {{ formatViews(item.views) }}</span>
              <span><ClockCircleOutlined /> {{ item.duration }} 分钟</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!loading && articles.length === 0" class="empty-state">
        <p>暂无内容</p>
      </div>

      <!-- 分页 -->
      <div class="pagination-wrapper" v-if="total > pageSize">
        <a-pagination
          v-model:current="currentPage"
          :total="total"
          :pageSize="pageSize"
          @change="handlePageChange"
        />
      </div>

      <!-- 每日问答 -->
      <div class="daily-quiz">
        <div class="quiz-header">
          <h2><FireOutlined /> 每日问答</h2>
          <span v-if="quizStats">连续答对 {{ quizStats.streak }} 天</span>
        </div>

        <!-- 未登录提示 -->
        <div v-if="!isLoggedIn" class="quiz-login-prompt">
          <p>登录后参与每日问答</p>
          <a-button type="primary" @click="$router.push('/login')">立即登录</a-button>
        </div>

        <!-- 加载中 -->
        <div v-else-if="quizLoading" class="quiz-loading">
          <a-spin />
        </div>

        <!-- 答题卡片 -->
        <div v-if="quizData?.quiz" class="quiz-card">
          <div v-if="quizData.hasAnsweredToday" class="quiz-answered-hint">
            <CheckCircleOutlined /> 今日已作答
          </div>
          <div class="quiz-question">
            <span class="question-label">问题：</span>
            <p>{{ quizData.quiz.question }}</p>
          </div>
          <div class="quiz-options">
            <a-button
              v-for="(option, index) in quizData.quiz.options"
              :key="index"
              block
              class="quiz-option"
              :class="{
                selected: selectedOption === index,
                correct: showResult && index === quizData.quiz.correctIndex,
                wrong: showResult && selectedOption === index && !quizResult?.isCorrect,
              }"
              :disabled="showResult"
              @click="selectOption(index)"
            >
              {{ ["A", "B", "C", "D"][index] }}. {{ option }}
            </a-button>
          </div>

          <!-- 答案解析 -->
          <div v-if="showResult && quizResult" class="quiz-result">
            <div class="result-header" :class="quizResult.isCorrect ? 'success' : 'error'">
              <CheckCircleOutlined v-if="quizResult.isCorrect" />
              <CloseCircleOutlined v-else />
              <span>{{ quizResult.isCorrect ? "回答正确！" : "回答错误" }}</span>
            </div>
            <p class="explanation">{{ quizResult.explanation }}</p>
          </div>

          <a-button
            v-if="!showResult"
            type="primary"
            block
            size="large"
            class="submit-btn"
            :disabled="selectedOption === null"
            :loading="submitting"
            @click="submitAnswer"
          >
            提交答案
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import {
  RocketOutlined,
  ExperimentOutlined,
  SendOutlined,
  TeamOutlined,
  FireOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import { emitter } from "@/utils/emitter";
import { educationApi, type Article, type DailyQuizResponse, type QuizResult, type QuizStats } from "@/api";
import { useUserStore } from "@/stores/user";
import { getFullImageUrl } from "@/utils/image-url";

const userStore = useUserStore();
const isLoggedIn = computed(() => userStore.isLoggedIn);

// 默认封面图
const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&h=225&fit=crop";

// 获取封面 URL
const getCoverUrl = (cover?: string) => {
  return getFullImageUrl(cover) || DEFAULT_COVER;
};

// 懒加载指令：仅当图片接近视口时才加载真实地址（比 loading="lazy" 更严格）
const vLazy = {
  mounted(el: HTMLImageElement, binding: { value: string }) {
    const url = binding.value;
    if (!url) return;
    if (!("IntersectionObserver" in window)) {
      el.src = url;
      return;
    }
    if (el.dataset.observed) return;
    el.dataset.observed = "1";
    const io = new IntersectionObserver(
      (entries, obs) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.src = url;
          obs.disconnect();
        }
      },
      { rootMargin: "300px 0px" }
    );
    io.observe(el);
  },
  updated(el: HTMLImageElement, binding: { value: string; oldValue?: string }) {
    if (binding.oldValue !== binding.value) {
      el.src = binding.value;
    }
  },
};

const activeCategory = ref("all");
const loading = ref(false);
const articles = ref<Article[]>([]);
const currentPage = ref(1);
const pageSize = 12;
const total = ref(0);

const quizLoading = ref(false);
const quizData = ref<DailyQuizResponse | null>(null);
const selectedOption = ref<number | null>(null);
const showResult = ref(false);
const submitting = ref(false);
const quizResult = ref<QuizResult | null>(null);
const quizStats = ref<QuizStats | null>(null);

// 加载文章列表
const loadArticles = async () => {
  loading.value = true;
  try {
    const category = activeCategory.value === "all" ? undefined : activeCategory.value;
    const res = await educationApi.getArticles({
      category,
      page: currentPage.value,
      limit: pageSize,
    });
    // 后端返回格式: { code, data: { list: Article[], total: number }, timestamp }
    articles.value = res.data.data?.list || [];
    total.value = res.data.data?.total || 0;
  } catch (error) {
    console.error("加载文章失败:", error);
  } finally {
    loading.value = false;
  }
};

// 加载每日问答
const loadDailyQuiz = async () => {
  if (!isLoggedIn.value) return;

  quizLoading.value = true;
  try {
    const [quizRes, statsRes] = await Promise.all([
      educationApi.getDailyQuiz(),
      educationApi.getQuizStats(),
    ]);
    quizData.value = quizRes.data.data;
    quizStats.value = statsRes.data.data;

    // 如果今日已作答，自动显示答题结果状态
    if (quizData.value?.hasAnsweredToday && quizData.value?.previousAnswer) {
      selectedOption.value = quizData.value.previousAnswer.selectedIndex;
      quizResult.value = {
        isCorrect: quizData.value.previousAnswer.isCorrect,
        correctIndex: quizData.value.quiz?.correctIndex || 0,
        explanation: quizData.value.quiz?.explanation || '',
        pointsEarned: quizData.value.previousAnswer.isCorrect ? (quizData.value.quiz?.points || 0) : 0,
      };
      showResult.value = true;
    }
  } catch (error) {
    console.error("加载问答失败:", error);
  } finally {
    quizLoading.value = false;
  }
};

// 切换分类
const handleCategoryChange = () => {
  currentPage.value = 1;
  loadArticles();
};

// 分页变化
const handlePageChange = (page: number) => {
  currentPage.value = page;
  loadArticles();
  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// 选择答案
const selectOption = (index: number) => {
  if (!showResult.value) {
    selectedOption.value = index;
  }
};

// 提交答案
const submitAnswer = async () => {
  if (selectedOption.value === null || !quizData.value?.quiz) return;

  submitting.value = true;
  try {
    const res = await educationApi.submitAnswer({
      quizId: quizData.value.quiz.id,
      selectedIndex: selectedOption.value,
    });
    quizResult.value = res.data.data;
    showResult.value = true;
    if (quizResult.value.isCorrect) {
      emitter.emit("notification:refresh");
    }
    // 提交成功后刷新答题统计
    const statsRes = await educationApi.getQuizStats();
    quizStats.value = statsRes.data.data;
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } };
    message.error(err.response?.data?.message || "提交失败");
  } finally {
    submitting.value = false;
  }
};

// 格式化浏览量
const formatViews = (views: number) => {
  if (views >= 10000) {
    return (views / 10000).toFixed(1) + "w";
  }
  if (views >= 1000) {
    return (views / 1000).toFixed(1) + "k";
  }
  return views.toString();
};

// 图片加载失败处理
const handleImageError = (e: Event) => {
  const target = e.target as HTMLImageElement;
  target.src = DEFAULT_COVER;
};

// 打开文章详情
const openArticle = (article: Article) => {
  window.location.href = `/education/${article.id}`;
};

onMounted(() => {
  loadArticles();
  loadDailyQuiz();
});
</script>

<style scoped lang="scss">
.education-view {
  min-height: calc(100vh - 64px);
  background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
}

.edu-hero {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at center, rgba(0, 212, 255, 0.1) 0%, transparent 70%);
  border-bottom: 1px solid rgba(0, 212, 255, 0.1);

  .hero-content {
    text-align: center;

    h1 {
      font-size: 48px;
      font-weight: 700;
      background: linear-gradient(135deg, #00d4ff 0%, #7b2cbf 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 16px;
    }

    p {
      font-size: 18px;
      color: rgba(255, 255, 255, 0.6);
    }
  }
}

.category-nav {
  padding: 24px 0;
  border-bottom: 1px solid rgba(0, 212, 255, 0.1);

  :deep(.ant-tabs) {
    .ant-tabs-nav {
      margin: 0;
    }

    .ant-tabs-tab {
      color: rgba(255, 255, 255, 0.7);
      font-size: 16px;
      padding: 12px 24px;

      &:hover {
        color: #00d4ff;
      }

      &.ant-tabs-tab-active {
        color: #00d4ff;
      }
    }

    .ant-tabs-ink-bar {
      background: linear-gradient(135deg, #00d4ff 0%, #7b2cbf 100%);
    }
  }
}

.content-area {
  padding: 40px 24px;
  max-width: 1440px;
  margin: 0 auto;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: rgba(255, 255, 255, 0.5);

  p {
    margin-top: 16px;
  }
}

.content-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 60px;
}

.content-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(0, 212, 255, 0.1);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    transform: translateY(-8px);
    border-color: rgba(0, 212, 255, 0.3);
    box-shadow: 0 20px 40px rgba(0, 212, 255, 0.1);
  }

  .card-cover {
    position: relative;
    height: 250px;
    overflow: hidden;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(0, 212, 255, 0.06) 100%);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: 50% 4%;
    }

    .card-type {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(0, 0, 0, 0.7);
      color: #00d4ff;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
    }
  }

  .card-body {
    padding: 20px;

    h3 {
      font-size: 18px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 12px;
    }

    p {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.5);
      line-height: 1.6;
      margin-bottom: 16px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-meta {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.4);

      span {
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }
  }
}

.empty-state {
  text-align: center;
  padding: 80px 0;
  color: rgba(255, 255, 255, 0.5);
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 40px;

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

    .ant-pagination-prev,
    .ant-pagination-next {
      .ant-pagination-item-link {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(0, 212, 255, 0.2);
        color: #fff;
      }
    }
  }
}

.daily-quiz {
  max-width: 600px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(0, 212, 255, 0.1);
  border-radius: 16px;
  padding: 32px;

  .quiz-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    h2 {
      font-size: 24px;
      font-weight: 600;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;

      .anticon {
        color: #ff6b35;
      }
    }

    span {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.5);
    }
  }

  .quiz-login-prompt {
    text-align: center;
    padding: 40px 0;

    p {
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 16px;
    }
  }

  .quiz-loading {
    display: flex;
    justify-content: center;
    padding: 40px 0;
  }

  .quiz-done {
    text-align: center;
    padding: 40px 0;

    .done-icon {
      font-size: 48px;
      color: #52c41a;
      margin-bottom: 16px;
    }

    p {
      color: rgba(255, 255, 255, 0.7);
      margin: 0;

      &.done-sub {
        color: rgba(255, 255, 255, 0.4);
        font-size: 14px;
        margin-top: 8px;
      }
    }
  }

  .quiz-answered-hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(82, 196, 26, 0.15);
    border: 1px solid rgba(82, 196, 26, 0.3);
    border-radius: 20px;
    color: #52c41a;
    font-size: 13px;
    margin-bottom: 16px;

    :deep(.anticon) {
      font-size: 14px;
    }
  }

  .quiz-card {
    .quiz-question {
      margin-bottom: 24px;

      .question-label {
        color: #00d4ff;
        font-weight: 600;
        margin-right: 8px;
      }

      p {
        display: inline;
        font-size: 18px;
        color: #fff;
      }
    }

    .quiz-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 24px;

      .quiz-option {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(0, 212, 255, 0.2);
        color: #fff;
        height: 48px;
        font-size: 15px;

        &:hover:not(:disabled) {
          border-color: #00d4ff;
          background: rgba(0, 212, 255, 0.1);
        }

        &.selected {
          border-color: #00d4ff;
          background: rgba(0, 212, 255, 0.2);
        }

        &.correct {
          border-color: #52c41a;
          background: rgba(82, 196, 26, 0.2);
          color: #52c41a;
        }

        &.wrong {
          border-color: #ff4d4f;
          background: rgba(255, 77, 79, 0.2);
          color: #ff4d4f;
        }
      }
    }

    .quiz-result {
      margin-bottom: 24px;
      padding: 16px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.03);

      .result-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 12px;

        &.success {
          color: #52c41a;
        }

        &.error {
          color: #ff4d4f;
        }
      }

      .explanation {
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
        line-height: 1.6;
        margin: 0;
      }
    }

    .submit-btn {
      height: 48px;
      font-size: 16px;
      background: linear-gradient(135deg, #00d4ff 0%, #7b2cbf 100%);
      border: none;

      &:disabled {
        opacity: 0.5;
      }
    }
  }
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .quiz-options {
    grid-template-columns: 1fr !important;
  }
}
</style>
