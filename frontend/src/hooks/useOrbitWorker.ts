import { ref, onUnmounted, shallowRef } from "vue";
import type { PositionsBatch, SatelliteMetadata, TLEData } from "@/workers/orbit.worker";

export interface OrbitWorkerState {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  satelliteCount: number;
  errorCount: number;
  lastUpdate: string | null;
}

export function useOrbitWorker() {
  const worker = shallowRef<Worker | null>(null);
  const metadata = shallowRef<Record<string, SatelliteMetadata | null>>({});
  const positions = shallowRef<PositionsBatch | null>(null);
  const ids = shallowRef<string[]>([]);
  const validIds = shallowRef<string[]>([]);
  const validMask = shallowRef<Uint8Array>(new Uint8Array());
  const state = ref<OrbitWorkerState>({
    isReady: false,
    isLoading: false,
    error: null,
    satelliteCount: 0,
    errorCount: 0,
    lastUpdate: null,
  });

  let computeInterval: ReturnType<typeof setInterval> | null = null;
  let lastComputeTime = 0;
  const COMPUTE_INTERVAL = 250;

  const initWorker = () => {
    if (worker.value) return;

    worker.value = new Worker(new URL("../workers/orbit.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.value.onmessage = (e: MessageEvent) => {
      const { type, data } = e.data;

      if (type === "ready") {
        state.value.isReady = true;
        state.value.isLoading = false;
        state.value.satelliteCount = data.total;
        state.value.errorCount = data.errorCount || 0;
        ids.value = data.ids || [];
        validIds.value = data.validIds || [];
        validMask.value = data.validMask || new Uint8Array();
        console.log(
          `[OrbitWorker] 初始化完成，加载 ${data.total} 颗卫星，失败 ${data.errorCount || 0} 颗`,
        );
        startComputeLoop();
      } else if (type === "metadata") {
        metadata.value = data;
        console.log(`[OrbitWorker] 收到元数据，${Object.keys(data).length} 颗卫星`);
      } else if (type === "positions") {
        positions.value = {
          ecef: data.ecef,
          validMask: data.validMask,
          errorCount: data.errorCount || 0,
          timestamp: e.data.timestamp,
        };
        state.value.lastUpdate = e.data.timestamp;
      }
    };

    worker.value.onerror = (error) => {
      state.value.error = error.message;
      state.value.isLoading = false;
      console.error("[OrbitWorker] 错误:", error);
    };
  };

  const initSatellites = (tles: TLEData[]) => {
    if (!worker.value) {
      initWorker();
    }

    state.value.isLoading = true;
    state.value.error = null;
    worker.value?.postMessage({ type: "init", data: { tles } });
  };

  const startComputeLoop = (intervalMs: number = COMPUTE_INTERVAL) => {
    if (computeInterval) {
      clearInterval(computeInterval);
    }

    computePositions();

    computeInterval = setInterval(() => {
      computePositions();
    }, intervalMs);
  };

  const stopComputeLoop = () => {
    if (computeInterval) {
      clearInterval(computeInterval);
      computeInterval = null;
    }
  };

  const computePositions = (timestamp?: number) => {
    if (!worker.value || !state.value.isReady) return;

    const now = timestamp ?? Date.now();

    if (now - lastComputeTime < COMPUTE_INTERVAL) return;

    lastComputeTime = now;
    worker.value.postMessage({
      type: "compute",
      data: { timestamp: now },
    });
  };

  const terminate = () => {
    stopComputeLoop();
    worker.value?.terminate();
    worker.value = null;
    state.value.isReady = false;
    state.value.isLoading = false;
    metadata.value = {};
    positions.value = null;
    ids.value = [];
    validIds.value = [];
    validMask.value = new Uint8Array();
  };

  onUnmounted(() => {
    terminate();
  });

  return {
    metadata,
    positions,
    ids,
    validIds,
    validMask,
    state,
    initWorker,
    initSatellites,
    computePositions,
    startComputeLoop,
    stopComputeLoop,
    terminate,
  };
}
