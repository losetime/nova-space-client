import { ref, onUnmounted, computed } from 'vue'
import { useOrbitWorker } from './useOrbitWorker'
import { satelliteApi } from '@/api'
import type { TLEData } from '@/api'

export interface Satellite {
  noradId: string
  name: string
  position: {
    lng: number | null
    lat: number | null
    alt: number | null
  } | null
  status: 'ok' | 'error'
  timestamp: string
  countryCode?: string
  mission?: string
  operator?: string
}

export interface LocalSatellitesState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  isLoading: boolean
  error: string | null
  satelliteCount: number
  errorCount: number
  lastUpdate: string | null
}

export function useLocalSatellites() {
  const { metadata, positions, state: workerState, initSatellites, terminate } = useOrbitWorker()

  const state = ref<LocalSatellitesState>({
    status: 'idle',
    isLoading: false,
    error: null,
    satelliteCount: 0,
    errorCount: 0,
    lastUpdate: null,
  })

  // 卫星对象缓存 - 避免每次更新都创建新对象
  const satelliteCache = new Map<string, Satellite>()
  // 记录上次更新时的时间戳，用于检测是否有实际更新
  let lastUpdateTime = ''

  const satellites = computed<Satellite[]>(() => {
    const meta = metadata.value
    const pos = positions.value
    const currentUpdateTime = workerState.value.lastUpdate || ''

    if (Object.keys(meta).length === 0 || pos.length === 0) {
      return []
    }

    // 检查是否有实际更新 - 如果时间戳没变且缓存已存在，直接返回缓存
    if (currentUpdateTime === lastUpdateTime && satelliteCache.size > 0) {
      return Array.from(satelliteCache.values())
    }

    pos.forEach((p) => {
      const m = meta[p.noradId]
      const existing = satelliteCache.get(p.noradId)

      if (existing) {
        // 更新现有卫星 - 只修改需要更新的字段，保持对象引用稳定
        existing.position = p.status === 'ok' ? {
          lat: p.lat,
          lng: p.lng,
          alt: p.alt,
        } : null
        existing.status = p.status
        existing.timestamp = currentUpdateTime || new Date().toISOString()

        // metadata 变化时也更新
        if (m) {
          existing.name = m.name || `卫星 ${p.noradId}`
          existing.countryCode = m.countryCode
          existing.mission = m.mission
          existing.operator = m.operator
        }
      } else {
        // 创建新卫星对象
        const newSat: Satellite = {
          noradId: p.noradId,
          name: m?.name || `卫星 ${p.noradId}`,
          position: p.status === 'ok' ? {
            lat: p.lat,
            lng: p.lng,
            alt: p.alt,
          } : null,
          status: p.status,
          timestamp: currentUpdateTime || new Date().toISOString(),
          countryCode: m?.countryCode,
          mission: m?.mission,
          operator: m?.operator,
        }
        satelliteCache.set(p.noradId, newSat)
      }
    })

    lastUpdateTime = currentUpdateTime
    return Array.from(satelliteCache.values())
  })

  const satelliteCount = computed(() => {
    return positions.value.length
  })

  const errorCount = computed(() => {
    return positions.value.filter(p => p.status === 'error').length
  })

  const lastUpdate = computed(() => {
    return workerState.value.lastUpdate
  })

  const CACHE_KEY = 'satellite_tle_cache'
  const CACHE_DURATION = 60 * 60 * 1000 // 1小时

  const getCache = (): { tles: TLEData[]; count: number } | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (!cached) return null

      const { data, timestamp } = JSON.parse(cached)
      const now = Date.now()

      if (now - timestamp > CACHE_DURATION) {
        localStorage.removeItem(CACHE_KEY)
        return null
      }

      console.log('[LocalSatellites] 使用缓存数据，卫星数量:', data.count)
      return data
    } catch {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
  }

  const setCache = (tleData: { tles: TLEData[]; count: number }) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: tleData,
        timestamp: Date.now()
      }))
      console.log('[LocalSatellites] TLE 数据已缓存，卫星数量:', tleData.count)
    } catch (e) {
      console.warn('[LocalSatellites] 缓存写入失败:', e)
    }
  }

  const loadTLEData = async () => {
    if (state.value.isLoading) return

    // 尝试从缓存读取
    const cached = getCache()
    if (cached && cached.tles && cached.tles.length > 0) {
      initSatellites(cached.tles as TLEData[])
      state.value.satelliteCount = cached.count
      state.value.status = 'ready'
      state.value.isLoading = false
      return
    }

    // 缓存不存在或过期，从服务器获取
    state.value.isLoading = true
    state.value.status = 'loading'
    state.value.error = null

    try {
      const response = await satelliteApi.getTLEs()
      const { tles, count } = response.data.data

      if (tles && tles.length > 0) {
        initSatellites(tles as TLEData[])
        state.value.satelliteCount = count
        state.value.status = 'ready'
        // 写入缓存
        setCache({ tles: tles as TLEData[], count })
      } else {
        state.value.status = 'error'
        state.value.error = '没有可用的卫星数据'
      }
    } catch (error: unknown) {
      state.value.status = 'error'
      const err = error as { message?: string }
      state.value.error = err.message || '加载卫星数据失败'
      console.error('[LocalSatellites] 加载 TLE 数据失败:', error)
    } finally {
      state.value.isLoading = false
    }
  }

  const refresh = async () => {
    satelliteCache.clear()
    lastUpdateTime = ''
    terminate()
    await loadTLEData()
  }

  const cleanupSatelliteImageMap = (_currentNoradIds: string[]) => {
    // 兼容旧接口，不再需要清理
  }

  const connect = async () => {
    await loadTLEData()
  }

  const disconnect = () => {
    terminate()
    satelliteCache.clear()
    lastUpdateTime = ''
    state.value.status = 'idle'
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    state,
    satellites,
    satelliteCount,
    errorCount,
    lastUpdate,
    status: computed(() => state.value.status),
    isInitialized: computed(() => workerState.value.isReady),
    loadTLEData,
    refresh,
    connect,
    disconnect,
    fetchSatellites: loadTLEData,
    cleanupSatelliteImageMap,
  }
}