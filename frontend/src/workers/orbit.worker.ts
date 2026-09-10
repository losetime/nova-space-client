import * as satellite from "satellite.js";
import {
  BulkPropagator,
  EciBaseCalculator,
  GmstCalculator,
  EcfPositionCalculator,
  createSingleThreadRuntime,
} from "satellite.js";

type PropagatorRuntime = Awaited<ReturnType<typeof createSingleThreadRuntime>>;

export type SatelliteStatus = 'ok' | 'error';

export interface TLEData {
  noradId: string;
  name: string;
  line1: string;
  line2: string;
  countryCode?: string;
  mission?: string;
  operator?: string;
}

export interface SatelliteMetadata {
  name: string;
  countryCode?: string;
  mission?: string;
  operator?: string;
}

export interface FailedSatellite {
  noradId: string;
  name: string;
  reason: string;
  countryCode?: string;
  mission?: string;
  operator?: string;
}

// ECEF 位置批次（零拷贝 transferable 输出，Float32Array 单位：米）
export interface PositionsPayload {
  ecef: Float32Array;
  validMask: Uint8Array;
  errorCount: number;
}

export interface PositionsBatch extends PositionsPayload {
  timestamp: string;
}

interface SatelliteCache {
  noradId: string;
  name: string;
  satrec: satellite.SatRec;
  countryCode?: string;
  mission?: string;
  operator?: string;
}

const satellites: Map<string, SatelliteCache> = new Map();
const failedSatCache: Map<string, FailedSatellite> = new Map();
const allNoradIds: string[] = [];
const validSatrecIds: string[] = [];
const satrecs: satellite.SatRec[] = [];
// noradId -> WASM 传播池索引（与 validSatrecIds/satrecs 对齐）
const satIndexMap: Map<string, number> = new Map();
let propagator: BulkPropagator<[EciBaseCalculator, GmstCalculator, EcfPositionCalculator], PropagatorRuntime> | null = null;
let isInitialized = false;
let lastErrorCount = 0;

// SGP4 长间隔传播发散防护：距地心超过该距离视为无效（正常卫星 < ~15万 km）
const MAX_ECEF_RADIUS_M = 200_000_000;
const MAX_ECEF_RADIUS_SQ = MAX_ECEF_RADIUS_M * MAX_ECEF_RADIUS_M;

// TLE ndot 单位换算：satrec.ndot 为 rad/min²，转为 rev/day²
const NDOT_TO_REV_DAY2 = (1440 * 1440) / (2 * Math.PI);
// TLE ndot 阈值：超过该值判定为衰减/再入物体（正常卫星 < ~0.0001），长间隔传播会发散
const DEGENERATE_NDOT_REV_DAY2 = 0.001;

// 把距离超限的卫星置为无效，返回被过滤的数量
const applyDistanceFilter = (ecef: Float32Array, validMask: Uint8Array): number => {
  let filtered = 0;
  const count = Math.min(Math.floor(ecef.length / 3), validMask.length);
  for (let i = 0; i < count; i++) {
    if (validMask[i] === 0) continue;
    const base = i * 3;
    const x = ecef[base]!;
    const y = ecef[base + 1]!;
    const z = ecef[base + 2]!;
    if (x * x + y * y + z * z > MAX_ECEF_RADIUS_SQ) {
      validMask[i] = 0;
      filtered++;
    }
  }
  return filtered;
};

// self 的 postMessage 在 DOM lib 下只有 Window 签名，封装以便传 transferable
const postWorkerMessage = (message: unknown, transfer?: Transferable[]) => {
  const scope = self as unknown as {
    postMessage(message: unknown, transfer?: Transferable[]): void;
  };
  scope.postMessage(message, transfer);
};

self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data;

  if (type === "init") {
    initSatellites(data.tles);
  } else if (type === "compute") {
    computePositions(data.timestamp);
  }
};

async function initSatellites(tles: TLEData[]) {
  satellites.clear();
  failedSatCache.clear();
  satIndexMap.clear();
  allNoradIds.length = 0;
  validSatrecIds.length = 0;
  satrecs.length = 0;

  const metadata: Record<string, SatelliteMetadata | null> = {};
  let successCount = 0;

  tles.forEach((tle) => {
    allNoradIds.push(tle.noradId);

    try {
      const satrec = satellite.twoline2satrec(tle.line1, tle.line2);

      // 衰减/再入物体（ndot 过大）判定：其 TLE 长间隔传播发散，直接标记为无效
      if (
        Number.isFinite(satrec.ndot) &&
        Math.abs(satrec.ndot * NDOT_TO_REV_DAY2) >= DEGENERATE_NDOT_REV_DAY2
      ) {
        failedSatCache.set(tle.noradId, {
          noradId: tle.noradId,
          name: tle.name,
          reason: 'TLE 轨道衰减/再入（ndot 过大）',
          countryCode: tle.countryCode,
          mission: tle.mission,
          operator: tle.operator,
        });
        metadata[tle.noradId] = null;
        return;
      }

      satellites.set(tle.noradId, {
        noradId: tle.noradId,
        name: tle.name,
        satrec,
        countryCode: tle.countryCode,
        mission: tle.mission,
        operator: tle.operator,
      });

      metadata[tle.noradId] = {
        name: tle.name,
        countryCode: tle.countryCode,
        mission: tle.mission,
        operator: tle.operator,
      };

      validSatrecIds.push(tle.noradId);
      satrecs.push(satrec);
      successCount++;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      failedSatCache.set(tle.noradId, {
        noradId: tle.noradId,
        name: tle.name,
        reason,
        countryCode: tle.countryCode,
        mission: tle.mission,
        operator: tle.operator,
      });
      metadata[tle.noradId] = null;
      console.warn(`[OrbitWorker] TLE解析失败 - noradId: ${tle.noradId}, name: ${tle.name}, error:`, reason);
    }
  });

  // 有效卫星索引映射（noradId -> 传播池索引）
  validSatrecIds.forEach((id, index) => {
    satIndexMap.set(id, index);
  });

  const initialValidMask = new Uint8Array(satrecs.length);
  try {
    const runtime = await createSingleThreadRuntime();
    propagator = new BulkPropagator({
      runtime,
      calculators: [
        new EciBaseCalculator(),
        new GmstCalculator(),
        new EcfPositionCalculator(),
      ],
      satRecsCount: satrecs.length,
      datesCount: 1,
    });
    if (satrecs.length > 0) {
      propagator.setSatRecs(satrecs);
      propagator.setDates([new Date()]);
      propagator.run();
      const raw = propagator.getRawOutput();
      const errs = raw.eci.error as Int8Array;
      const ecfKm = raw.ecfPosition as Float64Array;
      const initEcef = new Float32Array(ecfKm.length);
      for (let i = 0; i < ecfKm.length; i++) {
        initEcef[i] = ecfKm[i]! * 1000; // km -> m
      }
      for (let i = 0; i < satrecs.length; i++) {
        initialValidMask[i] = errs[i] === 0 ? 1 : 0;
      }
      applyDistanceFilter(initEcef, initialValidMask);
    }
  } catch (error) {
    console.warn("[OrbitWorker] WASM 批量传播初始化失败，回退到 JS 传播:", error);
    propagator = null;
    initialValidMask.fill(1);
  }

  isInitialized = true;

  postWorkerMessage(
    {
      type: "ready",
      data: {
        total: tles.length,
        successCount,
        errorCount: failedSatCache.size,
        ids: allNoradIds,
        validIds: validSatrecIds,
        validMask: initialValidMask,
        failedSatellites: Array.from(failedSatCache.values()),
      },
    },
    [initialValidMask.buffer],
  );

  postWorkerMessage({
    type: "metadata",
    data: metadata,
  });
}

function computePositions(timestamp: number) {
  if (!isInitialized) {
    postWorkerMessage({
      type: "positions",
      data: { ecef: new Float32Array(0), validMask: new Uint8Array(0), errorCount: 0 },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const now = new Date(timestamp);
  let ecef: Float32Array;
  let validMask: Uint8Array;
  let computeErrorCount = 0;

  if (propagator && satrecs.length > 0) {
    try {
      propagator.setDates([now]);
      propagator.run();
      const raw = propagator.getRawOutput();
      const ecfKm = raw.ecfPosition as Float64Array;
      const errs = raw.eci.error as Int8Array;

      ecef = new Float32Array(ecfKm.length);
      for (let i = 0; i < ecfKm.length; i++) {
        ecef[i] = ecfKm[i]! * 1000; // km -> m
      }
      validMask = new Uint8Array(errs.length);
      for (let i = 0; i < errs.length; i++) {
        validMask[i] = errs[i] === 0 ? 1 : 0;
        if (errs[i] !== 0) computeErrorCount++;
      }
      computeErrorCount += applyDistanceFilter(ecef, validMask);
    } catch (error) {
      console.error("[OrbitWorker] WASM 批量传播失败:", error);
      ecef = new Float32Array(0);
      validMask = new Uint8Array(0);
      computeErrorCount = satrecs.length;
    }
  } else {
    // JS 回退路径
    const gmst = satellite.gstime(now);
    ecef = new Float32Array(satrecs.length * 3);
    validMask = new Uint8Array(satrecs.length);
    for (let i = 0; i < satrecs.length; i++) {
      const sat = satellites.get(validSatrecIds[i]!);
      if (!sat) {
        validMask[i] = 0;
        computeErrorCount++;
        continue;
      }
      try {
        const pv = satellite.propagate(sat.satrec, now);
        if (pv.position) {
          const ecf = satellite.eciToEcf(pv.position, gmst);
          ecef[i * 3] = ecf.x * 1000; // km -> m
          ecef[i * 3 + 1] = ecf.y * 1000;
          ecef[i * 3 + 2] = ecf.z * 1000;
          validMask[i] = 1;
        } else {
          validMask[i] = 0;
          computeErrorCount++;
        }
      } catch {
        validMask[i] = 0;
        computeErrorCount++;
      }
    }
    computeErrorCount += applyDistanceFilter(ecef, validMask);
  }

  if (computeErrorCount > 0 && computeErrorCount !== lastErrorCount) {
    console.warn(`[OrbitWorker] 轨道计算失败 ${computeErrorCount}/${satrecs.length} 颗卫星`);
    lastErrorCount = computeErrorCount;
  }

  postWorkerMessage(
    {
      type: "positions",
      data: { ecef, validMask, errorCount: computeErrorCount },
      timestamp: now.toISOString(),
    },
    [ecef.buffer, validMask.buffer],
  );
}
