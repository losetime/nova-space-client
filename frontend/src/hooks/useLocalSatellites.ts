import { ref, onUnmounted, computed, watch } from 'vue'
import { useOrbitWorker } from './useOrbitWorker'
import { satelliteApi } from '@/api'
import type { TLEData } from '@/api'

export interface Satellite {
  noradId: string
  name: string
  position: {
    lng: number | null
    lat: number | null
    alt: number
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

const EARTH_RADIUS_M = 6378137
// 每 ~3s（250ms × 12）更新一次列表高度，用于轨道类型筛选与列表展示
const ALT_UPDATE_INTERVAL_TICKS = 12

export function useLocalSatellites() {
  const { metadata, positions, ids, validIds, validMask, state: workerState, initSatellites, terminate } = useOrbitWorker()

  const state = ref<LocalSatellitesState>({
    status: 'idle',
    isLoading: false,
    error: null,
    satelliteCount: 0,
    errorCount: 0,
    lastUpdate: null,
  })

  // 有效卫星索引（noradId -> ECEF 缓冲索引），与 worker validIds 对齐
  const validIndexByNoradId = new Map<string, number>()
  watch(validIds, (list) => {
    validIndexByNoradId.clear()
    list.forEach((id, index) => validIndexByNoradId.set(id, index))
  })

  // 有效卫星集合（用于稳定列表的 status 标记）
  const validIdSet = computed(() => {
    const mask = validMask.value
    const list = validIds.value
    const set = new Set<string>()
    for (let i = 0; i < list.length; i++) {
      if (mask[i] !== 0) set.add(list[i]!)
    }
    return set
  })

  // 稳定的卫星列表：仅在 ids/metadata/validMask 变化时重建（init/refresh 时）
  let listBuildTime = ''
  const satellites = computed<Satellite[]>(() => {
    const idsList = ids.value
    const meta = metadata.value
    if (idsList.length === 0 || Object.keys(meta).length === 0) return []

    if (!listBuildTime) {
      listBuildTime = new Date().toISOString()
    }
    const validSet = validIdSet.value
    const result: Satellite[] = []
    for (let i = 0; i < idsList.length; i++) {
      const id = idsList[i]!
      const m = meta[id]
      result.push({
        noradId: id,
        name: m?.name || `卫星 ${id}`,
        position: { lng: null, lat: null, alt: 0 },
        status: validSet.has(id) ? 'ok' : 'error',
        timestamp: listBuildTime,
        countryCode: m?.countryCode,
        mission: m?.mission,
        operator: m?.operator,
      })
    }
    return result
  })

  // 节流更新列表高度（从 ECEF 求到地心距离，避免 per-frame 响应式更新）
  let altUpdateTick = 0
  const updateSatelliteAlts = (ecef: Float32Array) => {
    const list = satellites.value
    if (list.length === 0) return
    for (let i = 0; i < list.length; i++) {
      const sat = list[i]!
      if (sat.status !== 'ok' || !sat.position) continue
      const idx = validIndexByNoradId.get(sat.noradId)
      if (idx === undefined) continue
      const base = idx * 3
      if (base + 2 >= ecef.length) continue
      const x = ecef[base]!
      const y = ecef[base + 1]!
      const z = ecef[base + 2]!
      const alt = Math.sqrt(x * x + y * y + z * z) - EARTH_RADIUS_M
      sat.position.alt = Math.max(0, Math.round(alt))
    }
  }

  // 位置批次到达：节流更新列表高度（alt）
  watch(positions, (batch) => {
    if (!batch || batch.ecef.length === 0) return
    altUpdateTick++
    if (altUpdateTick % ALT_UPDATE_INTERVAL_TICKS === 0) {
      updateSatelliteAlts(batch.ecef)
    }
  })

  const satelliteCount = computed(() => {
    return ids.value.length
  })

  const errorCount = computed(() => {
    return satellites.value.filter((s) => s.status === 'error').length
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
    listBuildTime = ''
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
    positions,
    ids,
    validIds,
    validMask,
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
