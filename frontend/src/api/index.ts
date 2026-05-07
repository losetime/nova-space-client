import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import { useUserStore } from '@/stores/user'

// API 响应格式（与后端 TransformInterceptor 一致）
export interface ApiResponse<T = unknown> {
  code: number
  data: T
  message?: string
  timestamp?: string
}

// 用户信息
export interface User {
  id: number
  username: string
  email: string
  nickname?: string
  avatar?: string
  role: string
  level: string
  points: number
  totalPoints?: number
  todayCheckedIn?: boolean
  createdAt: string
  updatedAt: string
}

// 登录响应
export interface LoginResponse {
  user: User
  accessToken: string
  refreshToken: string
}

// 积分统计
export interface PointsStats {
  currentPoints: number
  totalPoints: number
  totalEarned: number
  totalConsumed: number
  checkinDays: number
}

// 积分记录
export interface PointsRecord {
  id: string
  userId: string
  action: string
  points: number
  balance: number
  description: string
  createdAt: string
}

// 订阅信息
export interface Subscription {
  id: number
  plan: string
  status: string
  startDate: string
  endDate: string
  autoRenew: boolean
}

// 创建 API 实例
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器 - 添加 Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// 响应拦截器 - 处理错误和 Token 刷新
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config

    // 如果是 401 错误且不是刷新 Token 的请求
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          const response = await axios.post('/api/auth/refresh', {
            refreshToken,
          })

          const { accessToken, refreshToken: newRefreshToken } = response.data.data
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', newRefreshToken)

          // 重试原请求
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        }
      } catch {
        // 刷新失败，清除登录状态
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        const userStore = useUserStore()
        userStore.logout()
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)

// 认证 API
export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post<ApiResponse<LoginResponse>>('/auth/register', data),

  login: (data: { username: string; password: string }) =>
    api.post<ApiResponse<LoginResponse>>('/auth/login', data),

  profile: () => api.get<ApiResponse<User>>('/auth/profile'),

  refresh: (refreshToken: string) =>
    api.post<ApiResponse<{ accessToken: string; refreshToken: string }>>('/auth/refresh', {
      refreshToken,
    }),
}

// 用户 API
export const userApi = {
  getMe: () => api.get<ApiResponse<User>>('/users/me'),

  updateMe: (data: Partial<User>) => api.put<ApiResponse<User>>('/users/me', data),

  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    api.put<ApiResponse<void>>('/users/me/password', data),
}

// 积分 API
export const pointsApi = {
  dailyCheckin: () => api.post<ApiResponse<{ points: number; message: string }>>('/points/daily-checkin'),

  getStats: () => api.get<ApiResponse<PointsStats>>('/points/stats'),

  getHistory: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<{ records: PointsRecord[]; total: number }>>('/points/history', { params }),

  exchangeMembership: (planCode: string) =>
    api.post<ApiResponse<{ subscription: Subscription; newLevel: string; pointsConsumed: number }>>('/points/exchange-membership', { planCode }),
}

// 订阅 API
export const subscriptionApi = {
  getPlans: () => api.get<ApiResponse<MemberLevelData[]>>('/subscriptions/plans'),

  getStatus: () => api.get<ApiResponse<MembershipStatus>>('/subscriptions/status'),

  getCurrent: () => api.get<ApiResponse<Subscription | null>>('/subscriptions/current'),

  getHistory: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<{ subscriptions: Subscription[]; total: number }>>('/subscriptions/history', { params }),

  create: (data: { plan: string; price: number; startDate: string; endDate: string }) =>
    api.post<ApiResponse<Subscription>>('/subscriptions', data),

  renew: (data: { plan: string; price: number; startDate: string; endDate: string }) =>
    api.post<ApiResponse<Subscription>>('/subscriptions/renew', data),

  cancel: (cancelReason?: string) =>
    api.put<ApiResponse<void>>('/subscriptions/cancel', { cancelReason }),
}

// 会员套餐
export interface MembershipPlan {
  id: string
  name: string
  planCode: string
  durationMonths: number
  level: string
  price: number
  pointsPrice: number | null
  description: string | null
  features: Record<string, any> | null
  isActive: boolean
  sortOrder: number
  levelInfo: {
    id: string
    code: string
    name: string
    icon: string | null
  } | null
  benefits: Benefit[]
  createdAt: string
  updatedAt: string
}

// 权益（新结构）
export interface Benefit {
  id: string
  name: string
  description: string | null
  valueType: string
  unit: string | null
  value: string
  displayText?: string
}

// 会员版本（含权益和套餐）
export interface MemberLevelData {
  level: string
  levelName: string
  icon: string | null
  benefits: Benefit[]
  plans: MembershipPlan[]
}

// 会员状态
export interface MembershipStatus {
  level: string
  points: number
  totalPoints: number
  levelInfo: {
    id: string
    code: string
    name: string
    icon: string | null
  } | null
  subscription: {
    id: string
    plan: string
    status: string
    startDate: string
    endDate: string
    autoRenew: boolean
    daysLeft: number
  } | null
  benefits: Benefit[]
}

// 科普文章
export interface Article {
  id: number
  title: string
  content: string
  summary: string
  cover: string
  category: 'basic' | 'advanced' | 'mission' | 'people'
  type: 'article' | 'video'
  views: number
  likes: number
  duration: number
  tags: string[]
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

// 每日问答
export interface Quiz {
  id: number
  question: string
  options: string[]
  correctIndex: number
  explanation: string
  category: string
  points: number
}

// 答题结果
export interface QuizResult {
  isCorrect: boolean
  correctIndex: number
  explanation: string
  pointsEarned: number
}

// 答题统计
export interface QuizStats {
  totalAnswered: number
  correctCount: number
  totalPoints: number
  streak: number
}

// 每日问答响应
export interface DailyQuizResponse {
  quiz: Quiz | null
  hasAnsweredToday: boolean
  previousAnswer?: { selectedIndex: number; isCorrect: boolean }
}

// 科普 API
export const educationApi = {
  // 获取文章列表
  getArticles: (params?: { category?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<{ list: Article[]; total: number }>>('/education/articles', { params }),

  // 获取文章详情
  getArticle: (id: string | number) => api.get<ApiResponse<Article>>(`/education/articles/${id}`),

  // 收藏/取消收藏文章
  toggleCollect: (id: string | number) =>
    api.post<ApiResponse<{ isCollected: boolean }>>(`/education/articles/${id}/collect`),

  // 检查文章是否已收藏
  isCollected: (id: string | number) =>
    api.get<ApiResponse<{ isCollected: boolean }>>(`/education/articles/${id}/collected`),

  // 获取用户收藏的文章列表
  getUserCollects: () =>
    api.get<ApiResponse<Article[]>>('/education/articles/user/collects'),

  // 点赞/取消点赞文章
  toggleLike: (id: string | number) =>
    api.post<ApiResponse<{ isLiked: boolean; likes: number }>>(`/education/articles/${id}/like`),

  // 检查文章是否已点赞
  isLiked: (id: string | number) =>
    api.get<ApiResponse<{ isLiked: boolean }>>(`/education/articles/${id}/liked`),

  // 获取每日问答
  getDailyQuiz: () => api.get<ApiResponse<DailyQuizResponse>>('/education/quiz/daily'),

  // 提交答案
  submitAnswer: (data: { quizId: number; selectedIndex: number }) =>
    api.post<ApiResponse<QuizResult>>('/education/quiz/submit', data),

  // 获取答题统计
  getQuizStats: () => api.get<ApiResponse<QuizStats>>('/education/quiz/stats'),
}

// 情报
export interface Intelligence {
  id: number
  title: string
  summary: string
  content: string
  cover?: string
  category: 'launch' | 'satellite' | 'industry' | 'research' | 'environment'
  level: 'basic' | 'professional'
  views: number
  likes: number
  collects: number
  source: string
  sourceUrl?: string
  tags: string[]
  analysis?: string
  trend?: string
  createdAt: string
  isLocked?: boolean
  isCollected?: boolean
}

// 卫星轨道点
export interface OrbitPoint {
  lng: number
  lat: number
  alt: number
  timestamp?: string
  velocity?: {
    x: number
    y: number
    z: number
  }
}

// 卫星轨道数据
export interface SatelliteOrbit {
  noradId: string
  name: string
  startTime?: string
  duration?: number
  steps?: number
  orbitPoints: OrbitPoint[]
}

// 轨道预测结果
export interface OrbitPrediction {
  noradId: string
  name: string
  startTime: string
  endTime: string
  duration: number
  steps: number
  orbit: OrbitPoint[]
  orbitalPeriod?: number
}

// 位置预测结果
export interface PositionPrediction {
  noradId: string
  name: string
  timestamp: string
  position: {
    lat: number
    lng: number
    alt: number
  }
  velocity: {
    x: number
    y: number
    z: number
    total: number
  }
  orbitalInfo?: {
    period: number
    inclination: number
    eccentricity: number
  }
}

// 过境事件
export interface PassEvent {
  startTime: string
  endTime: string
  maxElevationTime: string
  maxElevation: number
  startAzimuth: number
  endAzimuth: number
  maxAzimuth: number
  duration: number
  visible: boolean
}

// 过境预测结果
export interface PassPrediction {
  noradId: string
  name: string
  observer: {
    lat: number
    lng: number
    alt: number
  }
  passes: PassEvent[]
  startDate: string
  endDate: string
  totalPasses: number
}

// 轨道段（按日照状态分段）
export interface OrbitSegment {
  startTime: string
  endTime: string
  status: 'sunlight' | 'eclipse'
  points: OrbitPoint[]
}

// 日照分析结果
export interface SunlightAnalysis {
  noradId: string
  name: string
  analysisStartTime: string
  analysisEndTime: string
  orbitalPeriod: number
  sunlightRatio: number
  sunlightDuration: number
  eclipseDuration: number
  currentStatus: 'sunlight' | 'eclipse'
  nextEclipseEntry?: string
  nextEclipseExit?: string
  timeToNextEvent?: number
  orbitSegments: OrbitSegment[]
}

// 实时日照状态
export interface SunlightStatus {
  noradId: string
  name: string
  timestamp: string
  status: 'sunlight' | 'eclipse'
  sunDirection?: {
    x: number
    y: number
    z: number
  }
  nextEvent?: {
    type: 'entry' | 'exit'
    time: string
    minutesUntil: number
  }
}

// 卫星详情数据
export interface SatelliteDetail {
  noradId: string
  name: string
  position: {
    noradId: string
    name: string
    lat: number
    lng: number
    alt: number
    velocity?: number
  } | null
  metadata: {
    noradId: string
    name?: string
    objectId?: string
    altName?: string
    objectType?: string
    status?: string
    countryCode?: string
    launchDate?: string
    launchSite?: string
    launchVehicle?: string
    decayDate?: string
    period?: number
    inclination?: number
    apogee?: number
    perigee?: number
    eccentricity?: number
    raan?: number
    argOfPerigee?: number
    rcs?: string
    stdMag?: number
    tleEpoch?: string
    // ESA DISCOS 扩展字段
    cosparId?: string
    objectClass?: string
    launchMass?: number
    dimensions?: string
    span?: number
    shape?: string
    mission?: string
    operator?: string
    firstEpoch?: string
    predDecayDate?: string
    hasDiscosData?: boolean
    // 发射扩展信息
    flightNo?: string
    cosparLaunchNo?: string
    launchFailure?: boolean
    launchSiteName?: string
  } | null
  orbit: SatelliteOrbit
}

// TLE 数据（用于前端本地计算）
export interface TLEData {
  noradId: string
  name: string
  line1: string
  line2: string
  countryCode?: string
  mission?: string
  operator?: string
}

// TLE 响应
export interface TLEResponse {
  tles: TLEData[]
  count: number
  updatedAt: string
}

// 卫星 API
export const satelliteApi = {
  // 获取全量 TLE 数据（用于前端本地计算）
  // 注意：TLE 数据量较大（约 4.5MB），需要更长的超时时间
  getTLEs: () =>
    api.get<ApiResponse<TLEResponse>>('/satellites/tle', { timeout: 60000 }),

  // 获取卫星详细信息（推荐）
  getDetail: (noradId: string | number) =>
    api.get<ApiResponse<SatelliteDetail>>(`/satellites/${noradId}/detail`),

  // 获取卫星轨道数据
  getOrbit: (noradId: string | number, params?: {
    steps?: number
    startTime?: string
    duration?: number
  }) =>
    api.get<ApiResponse<SatelliteOrbit>>(`/satellites/${noradId}/orbit`, { params }),

  // 轨道预测（完整版）
  predictOrbit: (noradId: string | number, params?: {
    startTime?: string
    duration?: number
    steps?: number
    intervalSeconds?: number
  }) =>
    api.get<ApiResponse<OrbitPrediction>>(`/satellites/${noradId}/predict`, { params }),

  // 预测指定时间点的位置
  predictPosition: (noradId: string | number, time?: string) =>
    api.get<ApiResponse<PositionPrediction>>(`/satellites/${noradId}/position`, {
      params: time ? { time } : undefined,
    }),

  // 预测卫星过境
  predictPasses: (noradId: string | number, params: {
    lat: number
    lng: number
    alt?: number
    days?: number
    minElevation?: number
  }) =>
    api.get<ApiResponse<PassPrediction>>(`/satellites/${noradId}/passes`, { params }),

  // 获取国家列表
  getCountries: () =>
    api.get<ApiResponse<{ code: string; count: number }[]>>('/satellites/countries'),

  // 获取任务列表
  getMissions: () =>
    api.get<ApiResponse<{ name: string; count: number }[]>>('/satellites/missions'),

  // 获取运营商列表
  getOperators: () =>
    api.get<ApiResponse<{ name: string; count: number }[]>>('/satellites/operators'),

  // 关注/取消关注卫星
  toggleFavorite: (noradId: string | number) =>
    api.post<ApiResponse<{ favorited: boolean }>>(`/satellites/${noradId}/favorite`),

  // 检查是否关注
  checkFavorite: (noradId: string | number) =>
    api.get<ApiResponse<{ favorited: boolean }>>(`/satellites/${noradId}/favorite`),

  // 获取用户关注的卫星列表
  getFavorites: () =>
    api.get<ApiResponse<SatelliteFavorite[]>>('/satellites/favorites'),

  // 日照分析
  analyzeSunlight: (noradId: string | number, params?: {
    startTime?: string
    duration?: number
  }) =>
    api.get<ApiResponse<SunlightAnalysis>>(`/satellites/${noradId}/sunlight`, { params }),

  // 实时日照状态
  getSunlightStatus: (noradId: string | number) =>
    api.get<ApiResponse<SunlightStatus>>(`/satellites/${noradId}/sunlight/status`),
}

// 关注的卫星
export interface SatelliteFavorite {
  noradId: string
  name: string
  followedAt: string
  metadata?: {
    name?: string
    objectId?: string
    altName?: string
    objectType?: string
    status?: string
    countryCode?: string
    launchDate?: string
    launchSite?: string
    launchVehicle?: string
    decayDate?: string
    period?: number
    inclination?: number
    apogee?: number
    perigee?: number
    eccentricity?: number
    raan?: number
    argOfPerigee?: number
    rcs?: string
    stdMag?: number
    tleEpoch?: string
    tleAge?: number
  }
}

// 情报 API
export const intelligenceApi = {
  // 获取情报列表
  getList: (params?: { category?: string; page?: number; pageSize?: number }) =>
    api.get<ApiResponse<{ list: Intelligence[]; total: number; page: number; pageSize: number }>>('/intelligence', { params }),

  // 获取情报详情
  getDetail: (id: number) => api.get<ApiResponse<Intelligence>>(`/intelligence/${id}`),

  // 获取热门排行
  getHotList: () => api.get<ApiResponse<{ id: number; title: string; views: number }[]>>('/intelligence/hot'),

  // 收藏/取消收藏
  toggleCollect: (id: number) => api.post<ApiResponse<{ collected: boolean }>>(`/intelligence/${id}/collect`),

  // 检查收藏状态
  isCollected: (id: number) => api.get<ApiResponse<{ isCollected: boolean }>>(`/intelligence/${id}/collected`),

  // 获取用户收藏列表
  getUserCollects: () => api.get<ApiResponse<Intelligence[]>>('/intelligence/user/collects'),
}

// 反馈
export interface Feedback {
  id: string
  userId?: string
  type: 'bug' | 'feature' | 'suggestion' | 'other'
  title: string
  content: string
  status: 'pending' | 'processing' | 'resolved' | 'closed'
  createdAt: string
}

// 反馈 API
export const feedbackApi = {
  submit: (data: { type: string; title: string; content: string }) =>
    api.post<ApiResponse<Feedback>>('/feedback', data),
}

// 通知
export interface Notification {
  id: string
  userId: string
  type: 'intelligence' | 'system' | 'achievement' | 'membership'
  title: string
  content: string
  isRead: boolean
  relatedId?: string
  relatedType?: string
  createdAt: string
}

// 通知 API
export const notificationApi = {
  getList: () => api.get<ApiResponse<Notification[]>>('/notifications'),

  markRead: (id: string) => api.put<ApiResponse<void>>(`/notifications/${id}/read`),

  markAllRead: () => api.put<ApiResponse<void>>('/notifications/read-all'),

  getUnreadCount: () => api.get<ApiResponse<{ count: number }>>('/notifications/unread-count'),
}

// 空间天气状态
export interface SpaceWeatherStatus {
  dateStamp: string | null
  timeStamp: string | null
  radiation: {
    scale: number
    text: string
    minorProb: number | null
    majorProb: number | null
  }
  solarFlare: {
    scale: number
    text: string
    minorProb: number | null
    majorProb: number | null
  }
  geomagnetic: {
    scale: number
    text: string
    minorProb: number | null
    majorProb: number | null
  }
  solarWind: {
    speed: number
    timeStamp: string
  }
}

// 空间天气预警
export interface SpaceWeatherAlert {
  id: string
  issueTime: string
  title: string
  type: 'geomagnetic' | 'radiation' | 'radio_blackout' | 'xray_flux' | 'unknown'
  level: number
  message: string
}

// X射线通量数据
export interface XrayFluxData {
  data: Array<{
    time: string
    flux: number
    observedFlux: number
  }>
  unit: string
  description: string
}

// 空间天气 API
export const spaceWeatherApi = {
  // 获取当前空间天气状态
  getCurrentStatus: () => api.get<ApiResponse<SpaceWeatherStatus>>('/space-weather/current'),

  // 获取预警列表
  getAlerts: (limit?: number) =>
    api.get<ApiResponse<{ list: SpaceWeatherAlert[]; total: number }>>('/space-weather/alerts', {
      params: { limit },
    }),

  // 获取X射线通量数据
  getXrayFlux: (hours?: number) =>
    api.get<ApiResponse<XrayFluxData>>('/space-weather/xray-flux', {
      params: { hours },
    }),
}

// 推送订阅
export interface PushSubscription {
  id: string
  email: string
  subscriptionTypes: string[]
  enabled: boolean
  status: 'active' | 'paused' | 'cancelled'
  lastPushAt: string | null
  createdAt: string
  updatedAt: string
}

// 首页统计数据
export interface HomeStats {
  satellites: number
  countries: number
  articles: number
  intelligences: number
  users: number
}

// 统计 API
export const statsApi = {
  // 获取首页统计数据
  getHomeStats: () => api.get<ApiResponse<HomeStats>>('/stats'),
}

// 推送订阅 API
export const pushApi = {
  // 获取订阅配置
  getSubscription: () => api.get<ApiResponse<PushSubscription | null>>('/push/subscription'),

  // 创建订阅
  createSubscription: (data: {
    email: string
    subscriptionTypes?: string[]
  }) => api.post<ApiResponse<PushSubscription>>('/push/subscription', data),

  // 更新订阅配置
  updateSubscription: (data: {
    email?: string
    subscriptionTypes?: string[]
  }) => api.put<ApiResponse<PushSubscription>>('/push/subscription', data),

  // 暂停推送
  pauseSubscription: () => api.post<ApiResponse<PushSubscription>>('/push/subscription/pause'),

  // 恢复推送
  resumeSubscription: () => api.post<ApiResponse<PushSubscription>>('/push/subscription/resume'),

  // 取消订阅
  cancelSubscription: () => api.delete<ApiResponse<{ success: boolean }>>('/push/subscription'),
}

// 里程碑
export interface Milestone {
  id: number
  title: string
  description: string
  content?: string
  eventDate: string
  category: 'launch' | 'recovery' | 'orbit' | 'mission' | 'other'
  cover?: string
  media?: Array<{ type: 'image' | 'video'; url: string; caption?: string }>
  relatedSatelliteNoradId?: string
  importance: number
  location?: string
  organizer?: string
  createdAt: string
  updatedAt: string
}

// 里程碑 API
export const milestoneApi = {
  // 获取里程碑列表
  getList: (params?: { category?: string; page?: number; pageSize?: number }) =>
    api.get<ApiResponse<{ list: Milestone[]; total: number; page: number; pageSize: number }>>('/milestones', { params }),

  // 获取时间线数据（按年代分组）
  getTimeline: () => api.get<ApiResponse<{ decade: string; items: Milestone[] }[]>>('/milestones/timeline'),

  // 获取重要里程碑
  getFeatured: (limit?: number) =>
    api.get<ApiResponse<Milestone[]>>('/milestones/featured', { params: { limit } }),

  // 获取分类统计
  getCategories: () => api.get<ApiResponse<{ category: string; count: number }[]>>('/milestones/categories'),

  // 获取里程碑详情
  getDetail: (id: number) => api.get<ApiResponse<Milestone>>(`/milestones/${id}`),

  // 创建里程碑（管理员）
  create: (data: Partial<Milestone>) => api.post<ApiResponse<Milestone>>('/milestones', data),

  // 更新里程碑（管理员）
  update: (id: number, data: Partial<Milestone>) =>
    api.put<ApiResponse<Milestone>>(`/milestones/${id}`, data),

  // 删除里程碑（管理员）
  delete: (id: number) => api.delete<ApiResponse<{ success: boolean }>>(`/milestones/${id}`),
}

// 公司
export interface CompanyStats {
  operatorCount: number
  contractorCount: number
  manufacturerCount: number
}

export interface SatelliteBrief {
  noradId: string
  name: string
}

export interface CompanyDetail {
  name: string
  country: string | null
  foundedYear: number | null
  website: string | null
  logoUrl: string | null
  description: string | null
  stats: CompanyStats
  satellites: {
    asOperator: SatelliteBrief[]
    asContractor: SatelliteBrief[]
    asManufacturer: SatelliteBrief[]
  }
}

// 公司 API
export const companyApi = {
  // 获取公司详情
  getDetail: (name: string) => api.get<ApiResponse<CompanyDetail>>(`/companies/${encodeURIComponent(name)}`),
}

// 功能权限
export interface FeaturePermission {
  code: string
  name: string
  hasAccess: boolean
  value?: string
  displayText?: string
}

export interface UserPermissions {
  level: string
  levelName: string
  features: FeaturePermission[]
}

// 会员 API
export const membershipApi = {
  // 获取用户功能权限
  getPermissions: () => api.get<ApiResponse<UserPermissions>>('/membership/permissions'),
}

export default api