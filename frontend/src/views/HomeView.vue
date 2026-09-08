<template>
  <div class="home-view">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-bg">
        <div class="stars stars-layer-1"></div>
        <div class="stars stars-layer-2"></div>
        <div class="stars stars-layer-3"></div>
        <div class="planet"></div>
      </div>
      <div class="hero-content">
        <h1 class="hero-title">
          <span class="gradient-text">探索宇宙</span>
          <br />
          <span class="subtitle">从这里开始</span>
        </h1>
        <p class="hero-desc">
          星揽 —— 集卫星数据态势展示、航天知识科普、航天情报分级服务于一体的综合航天信息平台
        </p>
        <div class="hero-actions">
          <a-button type="primary" size="large" class="cta-btn" @click="$router.push('/satellite')">
            开始探索
            <RightOutlined />
          </a-button>
          <a-button size="large" class="secondary-btn" @click="$router.push('/education')">
            了解更多
          </a-button>
        </div>
      </div>
      <div class="scroll-indicator">
        <div class="mouse"></div>
        <span>向下滚动</span>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features-section">
      <div class="section-container">
        <h2 class="section-title">
          <span class="gradient-text">三大核心服务</span>
        </h2>
        <div class="features-grid">
          <div
            v-for="(feature, index) in features"
            :key="index"
            class="feature-card"
            :style="{ animationDelay: `${index * 0.1}s` }"
          >
            <div class="feature-icon">
              <component :is="feature.icon" />
            </div>
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.desc }}</p>
            <a-button type="link" class="learn-more" @click="$router.push(feature.path)">
              进入服务 <ArrowRightOutlined />
            </a-button>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats Section -->
    <section class="stats-section">
      <div class="section-container">
        <div class="stats-grid">
          <div v-for="(stat, index) in stats" :key="index" class="stat-item">
            <div class="stat-number">{{ stat.number }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Latest Intelligence -->
    <section class="intelligence-preview">
      <div class="section-container">
        <div class="section-header">
          <h2 class="section-title">
            <span class="gradient-text">最新情报</span>
          </h2>
          <a-button type="link" @click="$router.push('/intelligence')">
            查看全部 <RightOutlined />
          </a-button>
        </div>
        <div class="intelligence-list">
          <div
            v-for="(item, index) in latestIntelligence"
            :key="index"
            :class="['intelligence-card', { locked: item.isLocked }]"
            @click="handleIntelligenceClick(item)"
          >
            <div class="card-tag" :class="item.type">
              {{ item.tag }}
              <LockOutlined v-if="item.isLocked" class="lock-icon" />
            </div>
            <h4>{{ item.title }}</h4>
            <p>{{ item.summary }}</p>
            <div class="card-meta">
              <span>{{ item.date }}</span>
              <span class="source">{{ item.source }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { message } from "ant-design-vue";
import { useUserStore } from "@/stores/user";
import {
  RightOutlined,
  ArrowRightOutlined,
  GlobalOutlined,
  BookOutlined,
  FileTextOutlined,
  LockOutlined,
} from "@ant-design/icons-vue";
import { statsApi, intelligenceApi } from "@/api";

const router = useRouter();
const userStore = useUserStore();

const features = [
  {
    icon: GlobalOutlined,
    title: "卫星态势总览",
    desc: "实时追踪全球在轨卫星，提供轨道预测、关联分析等专业功能",
    path: "/satellite",
  },
  {
    icon: BookOutlined,
    title: "航天知识科普",
    desc: "体系化航天知识库，从入门到进阶，让每个人都能读懂航天",
    path: "/education",
  },
  {
    icon: FileTextOutlined,
    title: "航天动态中心",
    desc: "精选航天领域最新动态，深度解读行业发展趋势",
    path: "/intelligence",
  },
];

// 格式化数字显示
const formatNumber = (num: number): string => {
  return `${num.toLocaleString()}+`;
};

const stats = ref([
  { number: "-", label: "在轨卫星" },
  { number: "-", label: "国家/地区" },
  { number: "-", label: "知识条目" },
  { number: "-", label: "活跃用户" },
]);

// 加载统计数据
const loadStats = async () => {
  try {
    const res = await statsApi.getHomeStats();
    if (res.data.code === 0) {
      const data = res.data.data;
      stats.value = [
        { number: formatNumber(data.satellites), label: "在轨卫星" },
        { number: `${data.countries}+`, label: "国家/地区" },
        {
          number: formatNumber((data.articles || 0) + (data.intelligences || 0)),
          label: "知识条目",
        },
        { number: "4000+", label: "活跃用户" },
      ];
    }
  } catch {
    // 加载失败时使用默认显示
  }
};

const latestIntelligence = ref<any[]>([]);
const intelligenceLoading = ref(false);

const categoryMap: Record<string, { tag: string; type: string }> = {
  launch: { tag: "发射任务", type: "launch" },
  satellite: { tag: "卫星动态", type: "satellite" },
  industry: { tag: "行业动态", type: "industry" },
  research: { tag: "科研进展", type: "research" },
  environment: { tag: "空间环境", type: "environment" },
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "";
  return dateStr.split("T")[0] || "";
};

const loadIntelligence = async () => {
  try {
    intelligenceLoading.value = true;
    const res = await intelligenceApi.getList({ pageSize: 3 });
    if (res.data.code === 0 && res.data.data?.list) {
      latestIntelligence.value = res.data.data.list.map((item) => {
        const map = categoryMap[item.category] || { tag: item.category, type: item.category };
        return {
          type: map.type,
          tag: map.tag,
          title: item.title,
          summary: item.summary,
          date: formatDate(item.createdAt),
          source: item.source,
          isLocked: item.isLocked,
        };
      });
    }
  } catch {
    message.error("加载情报失败");
  } finally {
    intelligenceLoading.value = false;
  }
};

const handleIntelligenceClick = (item: any) => {
  if (item.isLocked) {
    if (!userStore.isLoggedIn) {
      message.warning("请先登录");
    } else {
      message.warning("请升级会员后查看");
    }
    return;
  }
  router.push(`/intelligence/${item.id}`);
};

onMounted(() => {
  loadStats();
  loadIntelligence();
});
</script>

<style scoped lang="scss">
.home-view {
  color: #ffffff;
}

// Hero Section
.hero-section {
  position: relative;
  height: 100vh;
  min-height: 700px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;

  .stars {
    position: absolute;
    inset: 0;
    background-repeat: repeat;
  }

  // 第一层星星 - 小而密集，缓慢漂移
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

  // 第二层星星 - 中等大小，反向漂移
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

  // 第三层星星 - 大而稀疏，缓慢闪烁
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
    width: 600px;
    height: 600px;
    right: -200px;
    top: 50%;
    transform: translateY(-50%);
    background: radial-gradient(circle at 30% 30%, #7b2cbf 0%, #16213e 50%, transparent 70%);
    border-radius: 50%;
    opacity: 0.6;
    filter: blur(60px);
  }
}

// 星星漂移动画
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

// 闪烁动画 - 不同频率
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

.hero-content {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 800px;
  padding: 0 24px;
}

.hero-title {
  font-size: 72px;
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 24px;

  .gradient-text {
    background: linear-gradient(135deg, #00d4ff 0%, #7b2cbf 50%, #00d4ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    background-size: 200% auto;
    animation: shine 3s linear infinite;
  }

  .subtitle {
    color: rgba(255, 255, 255, 0.9);
  }
}

@keyframes shine {
  to {
    background-position: 200% center;
  }
}

.hero-desc {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.8;
  margin-bottom: 40px;
}

.hero-actions {
  display: flex;
  gap: 16px;
  justify-content: center;

  .cta-btn {
    height: 48px;
    padding: 0 32px;
    font-size: 16px;
    background: linear-gradient(135deg, #00d4ff 0%, #7b2cbf 100%);
    border: none;
    border-radius: 24px;

    &:hover {
      opacity: 0.9;
      transform: translateY(-2px);
    }
  }

  .secondary-btn {
    height: 48px;
    padding: 0 32px;
    font-size: 16px;
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.3);
    border-radius: 24px;

    &:hover {
      border-color: #00d4ff;
      color: #00d4ff;
    }
  }
}

.scroll-indicator {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;

  .mouse {
    width: 24px;
    height: 40px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 12px;
    position: relative;

    &::before {
      content: "";
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: 4px;
      height: 8px;
      background: #00d4ff;
      border-radius: 2px;
      animation: scroll 2s ease-in-out infinite;
    }
  }
}

@keyframes scroll {
  0%,
  100% {
    opacity: 1;
    top: 8px;
  }
  50% {
    opacity: 0.3;
    top: 20px;
  }
}

// Section Common Styles
.section-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.section-title {
  font-size: 42px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 60px;

  .gradient-text {
    background: linear-gradient(135deg, #00d4ff 0%, #7b2cbf 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

// Features Section
.features-section {
  padding: 120px 0;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
}

.feature-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(0, 212, 255, 0.1);
  border-radius: 16px;
  padding: 40px 32px;
  text-align: center;
  transition: all 0.3s ease;
  animation: fadeInUp 0.6s ease forwards;
  opacity: 0;

  &:hover {
    transform: translateY(-8px);
    border-color: rgba(0, 212, 255, 0.3);
    box-shadow: 0 20px 40px rgba(0, 212, 255, 0.1);
  }

  .feature-icon {
    width: 80px;
    height: 80px;
    margin: 0 auto 24px;
    background: linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(123, 44, 191, 0.1) 100%);
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    color: #00d4ff;
  }

  h3 {
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #ffffff;
  }

  p {
    font-size: 15px;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.7;
    margin-bottom: 24px;
  }

  .learn-more {
    color: #00d4ff;
    font-size: 14px;

    &:hover {
      color: #7b2cbf;
    }
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// Stats Section
.stats-section {
  padding: 80px 0;
  background: rgba(0, 0, 0, 0.2);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 40px;
}

.stat-item {
  text-align: center;

  .stat-number {
    font-size: 48px;
    font-weight: 800;
    background: linear-gradient(135deg, #00d4ff 0%, #7b2cbf 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 8px;
  }

  .stat-label {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.6);
  }
}

// Intelligence Preview
.intelligence-preview {
  padding: 120px 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;

  .section-title {
    margin-bottom: 0;
    text-align: left;
  }
}

.intelligence-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.intelligence-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(0, 212, 255, 0.1);
  border-radius: 12px;
  padding: 24px;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;

  &:hover {
    border-color: rgba(0, 212, 255, 0.3);
    transform: translateY(-4px);
  }

  &.locked {
    opacity: 0.6;
    cursor: pointer;

    &:hover {
      transform: none;
      border-color: rgba(0, 212, 255, 0.1);
    }
  }

  .card-tag {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    margin-bottom: 16px;
    align-self: flex-start;

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
      background: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
    }

    &.environment {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
    }

    .lock-icon {
      margin-left: 6px;
      font-size: 10px;
    }
  }

  h4 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #ffffff;
    line-height: 1.4;
  }

  p {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1.6;
    margin-bottom: 16px;
    flex: 1;
  }

  .card-meta {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    margin-top: auto;

    .source {
      color: #00d4ff;
    }
  }
}

// Responsive
@media (max-width: 1024px) {
  .features-grid,
  .intelligence-list {
    grid-template-columns: repeat(2, 1fr);
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 48px;
  }

  .features-grid,
  .intelligence-list,
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .hero-actions {
    flex-direction: column;
    align-items: center;
  }
}
</style>
