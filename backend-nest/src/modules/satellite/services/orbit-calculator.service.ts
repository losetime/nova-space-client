import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as satellite from 'satellite.js';
import type {
  SatellitePosition,
  OrbitPoint,
  SatelliteData,
  OrbitPrediction,
  PositionPrediction,
  ObserverPosition,
  PassEvent,
  PassPrediction,
  SunlightAnalysis,
  SunlightStatus,
  OrbitSegment,
} from '../interfaces/satellite.interface';
import { SatelliteDataService } from './satellite-data.service';

// 常量定义
const EARTH_RADIUS_KM = 6371; // 地球半径 (km)
const AU_TO_KM = 149597870.7; // 天文单位转千米

/**
 * 轨道计算服务
 * 使用 satellite.js 计算卫星位置和轨道
 */
@Injectable()
export class OrbitCalculatorService implements OnModuleInit {
  private readonly logger = new Logger(OrbitCalculatorService.name);
  private satellites: Map<string, SatelliteData> = new Map();

  constructor(private readonly satelliteDataService: SatelliteDataService) {}

  async onModuleInit() {
    // 等待 SatelliteDataService 加载完数据后初始化
    const maxWaitMs = 30000; // 最多等待 30 秒
    const checkIntervalMs = 1000;
    let waited = 0;

    while (waited < maxWaitMs) {
      const tles = this.satelliteDataService.getCachedTLEs();
      if (tles.length > 0) {
        this.loadSatellites();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
      waited += checkIntervalMs;
      if (waited % 5000 === 0) {
        this.logger.log(
          `等待 SatelliteDataService 数据加载... (${waited / 1000}s)`,
        );
      }
    }

    this.logger.warn('数据库中没有卫星数据');
    this.loadSatellites();
  }

  /**
   * 每小时刷新卫星数据（在整点后 1 分钟执行）
   */
  @Cron('1 * * * *')
  refreshSatellites(): void {
    this.logger.log('定时刷新卫星数据');
    this.loadSatellites();
  }

  /**
   * 加载卫星数据
   */
  loadSatellites(): void {
    const tles = this.satelliteDataService.getCachedTLEs();
    this.satellites.clear();

    tles.forEach((tle) => {
      try {
        const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
        this.satellites.set(tle.noradId, {
          name: tle.name,
          noradId: tle.noradId,
          satrec,
        });
      } catch (error) {
        this.logger.error(`解析卫星 ${tle.noradId} TLE 错误: ${error.message}`);
      }
    });

    this.logger.log(`已加载 ${this.satellites.size} 颗卫星`);
  }

  /**
   * 获取卫星数量
   */
  getSatelliteCount(): number {
    return this.satellites.size;
  }

  /**
   * 计算单个卫星的轨道（增强版）
   * 计算单个卫星的轨道（增强版）
   * @param noradId 卫星 NORAD ID
   * @param steps 轨道点数（默认50）
   * @param startTime 开始时间（默认当前）
   * @param durationMinutes 持续时间（分钟，默认150）
   */
  calculateSatelliteOrbit(
    noradId: string,
    steps: number = 50,
    startTime?: Date,
    durationMinutes: number = 150,
  ): OrbitPoint[] {
    const sat = this.satellites.get(noradId);
    if (!sat) {
      return [];
    }

    const orbit: OrbitPoint[] = [];
    const start = startTime || new Date();
    const intervalMs = (durationMinutes * 60 * 1000) / steps;

    for (let i = 0; i < steps; i++) {
      const time = new Date(start.getTime() + i * intervalMs);
      const point = this.calculateOrbitPoint(sat, time);
      if (point) {
        orbit.push(point);
      }
    }

    return orbit;
  }

  /**
   * 计算轨道点
   */
  private calculateOrbitPoint(
    sat: SatelliteData,
    time: Date,
  ): OrbitPoint | null {
    try {
      const gmst = satellite.gstime(time);
      const eci = satellite.propagate(sat.satrec, time);

      if (eci && eci.position) {
        const gdPos = satellite.eciToGeodetic(eci.position, gmst);
        const latitude = satellite.radiansToDegrees(gdPos.latitude);
        const longitude = satellite.radiansToDegrees(gdPos.longitude);
        const altitude = gdPos.height * 1000; // 米（Cesium 需要米作为高度单位）

        const point: OrbitPoint = {
          lat: latitude,
          lng: longitude,
          alt: altitude,
          timestamp: time.toISOString(),
        };

        // 添加速度信息
        if (eci.velocity) {
          point.velocity = {
            x: eci.velocity.x,
            y: eci.velocity.y,
            z: eci.velocity.z,
          };
        }

        return point;
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  /**
   * 轨道预测（完整版）
   * @param noradId 卫星 NORAD ID
   * @param startTime 开始时间
   * @param durationMinutes 持续时间（分钟）
   * @param steps 轨道点数
   * @param intervalSeconds 固定采样间隔（秒），优先级高于 steps
   */
  predictOrbit(
    noradId: string,
    startTime: Date,
    durationMinutes: number,
    steps: number = 100,
    intervalSeconds?: number,
  ): OrbitPrediction | null {
    const sat = this.satellites.get(noradId);
    if (!sat) {
      return null;
    }

    const orbit: OrbitPoint[] = [];
    let actualSteps: number;
    let intervalMs: number;

    if (intervalSeconds !== undefined) {
      actualSteps = Math.floor((durationMinutes * 60 * 1000) / (intervalSeconds * 1000));
      intervalMs = intervalSeconds * 1000;
    } else {
      actualSteps = steps;
      intervalMs = (durationMinutes * 60 * 1000) / steps;
    }

    for (let i = 0; i <= actualSteps; i++) {
      const time = new Date(startTime.getTime() + i * intervalMs);
      const point = this.calculateOrbitPoint(sat, time);
      if (point) {
        orbit.push(point);
      }
    }

    // 计算轨道周期（近似）
    const orbitalPeriod = this.calculateOrbitalPeriod(sat);

    return {
      noradId: sat.noradId,
      name: sat.name,
      startTime: startTime.toISOString(),
      endTime: new Date(
        startTime.getTime() + durationMinutes * 60 * 1000,
      ).toISOString(),
      duration: durationMinutes,
      steps: orbit.length,
      orbit,
      orbitalPeriod,
    };
  }

  /**
   * 预测指定时间点的卫星位置
   * @param noradId 卫星 NORAD ID
   * @param time 预测时间
   */
  predictPosition(noradId: string, time: Date): PositionPrediction | null {
    const sat = this.satellites.get(noradId);
    if (!sat) {
      return null;
    }

    try {
      const gmst = satellite.gstime(time);
      const eci = satellite.propagate(sat.satrec, time);

      if (eci && eci.position && eci.velocity) {
        const gdPos = satellite.eciToGeodetic(eci.position, gmst);
        const latitude = satellite.radiansToDegrees(gdPos.latitude);
        const longitude = satellite.radiansToDegrees(gdPos.longitude);
        const altitude = gdPos.height * 1000; // 米（Cesium 需要米作为高度单位）

        // 计算总速度
        const totalVelocity = Math.sqrt(
          eci.velocity.x ** 2 + eci.velocity.y ** 2 + eci.velocity.z ** 2,
        );

        // 获取轨道信息
        const orbitalInfo = this.getOrbitalInfo(sat);

        return {
          noradId: sat.noradId,
          name: sat.name,
          timestamp: time.toISOString(),
          position: {
            lat: latitude,
            lng: longitude,
            alt: altitude,
          },
          velocity: {
            x: eci.velocity.x,
            y: eci.velocity.y,
            z: eci.velocity.z,
            total: totalVelocity,
          },
          orbitalInfo,
        };
      }
    } catch (error) {
      this.logger.error(`预测卫星 ${noradId} 位置错误: ${error.message}`);
      return null;
    }

    return null;
  }

  /**
   * 计算轨道周期（分钟）
   */
  private calculateOrbitalPeriod(sat: SatelliteData): number {
    try {
      // 使用 satellite.js 获取轨道参数
      const now = new Date();
      const positionAndVelocity = satellite.propagate(sat.satrec, now);

      if (positionAndVelocity && positionAndVelocity.position) {
        const positionEci = positionAndVelocity.position;
        const velocityEci = positionAndVelocity.velocity;

        // 计算轨道半径（km）
        const r = Math.sqrt(
          positionEci.x ** 2 + positionEci.y ** 2 + positionEci.z ** 2,
        );

        // 地球标准引力参数 (km³/s²)
        const mu = 398600.4418;

        // 轨道周期 T = 2π * sqrt(r³/μ) 秒
        const periodSeconds = 2 * Math.PI * Math.sqrt(r ** 3 / mu);

        // 转换为分钟
        return Math.round(periodSeconds / 60);
      }
    } catch (error) {
      // 默认返回约 90 分钟（LEO 卫星典型值）
      return 90;
    }

    return 90;
  }

  /**
   * 获取轨道信息
   */
  private getOrbitalInfo(
    sat: SatelliteData,
  ): { period: number; inclination: number; eccentricity: number } | undefined {
    try {
      // 从 TLE 数据中提取轨道参数
      // satellite.js 的 satrec 对象包含这些信息
      const satrec = sat.satrec;

      // 轨道倾角（弧度转角度）
      const inclination = satellite.radiansToDegrees(satrec.inclo || 0);

      // 离心率
      const eccentricity = satrec.ecco || 0;

      // 轨道周期
      const period = this.calculateOrbitalPeriod(sat);

      return {
        period,
        inclination: Math.round(inclination * 100) / 100,
        eccentricity: Math.round(eccentricity * 10000) / 10000,
      };
    } catch (error) {
      return undefined;
    }
  }

  /**
   * 获取所有卫星的 NORAD ID 列表
   */
  getAllSatelliteIds(): string[] {
    return Array.from(this.satellites.keys());
  }

  /**
   * 获取卫星信息
   */
  getSatelliteInfo(noradId: string): SatelliteData | undefined {
    return this.satellites.get(noradId);
  }

  /**
   * 预测卫星过境
   * @param noradId 卫星 NORAD ID
   * @param observer 观察者位置
   * @param days 预测天数
   * @param minElevation 最小高度角（度）
   */
  predictPasses(
    noradId: string,
    observer: ObserverPosition,
    days: number = 7,
    minElevation: number = 10,
  ): PassPrediction | null {
    const sat = this.satellites.get(noradId);
    if (!sat) {
      return null;
    }

    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const passes: PassEvent[] = [];

    // 每分钟检查一次
    const stepMs = 60 * 1000;
    let currentPass: Partial<PassEvent> | null = null;
    let maxElevInPass = 0;
    let maxElevTime: Date | null = null;
    let maxAzimuth = 0;

    for (let t = now.getTime(); t < endDate.getTime(); t += stepMs) {
      const time = new Date(t);
      const lookAngles = this.calculateLookAngles(sat, observer, time);

      if (!lookAngles) continue;

      const elevation = lookAngles.elevation;
      const azimuth = lookAngles.azimuth;

      if (elevation >= minElevation) {
        // 卫星可见
        if (!currentPass) {
          // 开始新的过境
          currentPass = {
            startTime: time.toISOString(),
            startAzimuth: azimuth,
          };
          maxElevInPass = elevation;
          maxElevTime = time;
          maxAzimuth = azimuth;
        } else {
          // 更新最大高度角
          if (elevation > maxElevInPass) {
            maxElevInPass = elevation;
            maxElevTime = time;
            maxAzimuth = azimuth;
          }
        }
      } else {
        // 卫星不可见
        if (currentPass && currentPass.startTime) {
          // 结束过境
          const startTime = new Date(currentPass.startTime);
          const duration = Math.round((t - startTime.getTime()) / 1000);

          // 只记录持续超过1分钟的过境
          if (duration >= 60) {
            // 检查是否肉眼可见（太阳在地平线下，卫星被照亮）
            const visible = this.isVisuallyVisible(
              sat,
              observer,
              maxElevTime || time,
            );

            passes.push({
              startTime: currentPass.startTime,
              endTime: time.toISOString(),
              maxElevationTime:
                maxElevTime?.toISOString() || time.toISOString(),
              maxElevation: Math.round(maxElevInPass * 10) / 10,
              startAzimuth: Math.round(currentPass.startAzimuth || 0),
              endAzimuth: Math.round(azimuth),
              maxAzimuth: Math.round(maxAzimuth),
              duration,
              visible,
            });
          }
          currentPass = null;
          maxElevInPass = 0;
          maxElevTime = null;
        }
      }
    }

    return {
      noradId: sat.noradId,
      name: sat.name,
      observer,
      passes,
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      totalPasses: passes.length,
    };
  }

  /**
   * 计算卫星相对于观察者的方位角和高度角
   */
  private calculateLookAngles(
    sat: SatelliteData,
    observer: ObserverPosition,
    time: Date,
  ): { azimuth: number; elevation: number; range: number } | null {
    try {
      // 观察者位置（地心坐标系）
      const observerGd = {
        latitude: satellite.degreesToRadians(observer.lat),
        longitude: satellite.degreesToRadians(observer.lng),
        height: observer.alt / 1000, // 转换为 km
      };

      // 计算 GMST
      const gmst = satellite.gstime(time);

      // 计算卫星 ECI 位置
      const eci = satellite.propagate(sat.satrec, time);
      if (!eci || !eci.position) return null;

      // 计算观察者的 ECF 位置
      const observerEcf = satellite.geodeticToEcf(observerGd);

      // 计算卫星的 ECF 位置
      const satelliteEcf = satellite.eciToEcf(eci.position, gmst);

      // 计算观察角度
      const lookAngles = satellite.ecfToLookAngles(observerGd, satelliteEcf);

      return {
        azimuth: satellite.radiansToDegrees(lookAngles.azimuth),
        elevation: satellite.radiansToDegrees(lookAngles.elevation),
        range: lookAngles.rangeSat || 0,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 检查卫星是否肉眼可见（太阳在地平线下，卫星被照亮）
   * @param sat 卫星数据
   * @param observer 观察者位置
   * @param time 预测时间
   */
  private isVisuallyVisible(
    sat: SatelliteData,
    observer: ObserverPosition,
    time: Date,
  ): boolean {
    try {
      // 1. 计算太阳位置
      const jday = satellite.jday(time);
      const sunPosition = satellite.sunPos(jday);

      // 将太阳位置从天文单位转换为千米
      const sunPosKm = {
        x: sunPosition.rsun.x * AU_TO_KM,
        y: sunPosition.rsun.y * AU_TO_KM,
        z: sunPosition.rsun.z * AU_TO_KM,
      };

      // 2. 检查太阳是否在地平线下（观察者在黑暗中）
      const gmst = satellite.gstime(time);
      const sunEcf = satellite.eciToEcf(sunPosKm, gmst);

      const observerGd = {
        latitude: satellite.degreesToRadians(observer.lat),
        longitude: satellite.degreesToRadians(observer.lng),
        height: observer.alt / 1000, // 转换为 km
      };

      const sunLookAngles = satellite.ecfToLookAngles(observerGd, sunEcf);
      const sunElevation = satellite.radiansToDegrees(sunLookAngles.elevation);

      // 太阳高度角需低于 -6 度（民用晨昏线以下）
      // 此时天空足够暗，能看到被照亮的卫星
      const isSunBelowHorizon = sunElevation < -6;

      if (!isSunBelowHorizon) {
        return false; // 白天或天空太亮，无法看到卫星
      }

      // 3. 检查卫星是否被太阳照亮
      const eci = satellite.propagate(sat.satrec, time);
      if (!eci || !eci.position) {
        return false;
      }

      const isIlluminated = this.isSatelliteIlluminated(eci.position, sunPosKm);

      return isIlluminated;
    } catch (error) {
      this.logger.error(`计算卫星可见性错误: ${error}`);
      return false;
    }
  }

  /**
   * 检查卫星是否被太阳照亮（不在地球阴影中）
   * @param satPositionEci 卫星 ECI 坐标 (km)
   * @param sunPositionEci 太阳 ECI 坐标 (km)
   */
  private isSatelliteIlluminated(
    satPositionEci: { x: number; y: number; z: number },
    sunPositionEci: { x: number; y: number; z: number },
  ): boolean {
    // 计算卫星到太阳的向量
    const satToSun = {
      x: sunPositionEci.x - satPositionEci.x,
      y: sunPositionEci.y - satPositionEci.y,
      z: sunPositionEci.z - satPositionEci.z,
    };

    const distToSun = Math.sqrt(
      satToSun.x ** 2 + satToSun.y ** 2 + satToSun.z ** 2,
    );

    // 归一化的太阳方向向量（从卫星指向太阳）
    const sunDir = {
      x: satToSun.x / distToSun,
      y: satToSun.y / distToSun,
      z: satToSun.z / distToSun,
    };

    // 卫星到地心的距离
    const satMag = Math.sqrt(
      satPositionEci.x ** 2 + satPositionEci.y ** 2 + satPositionEci.z ** 2,
    );

    // 归一化的卫星位置向量（从地心指向卫星）
    const satDir = {
      x: satPositionEci.x / satMag,
      y: satPositionEci.y / satMag,
      z: satPositionEci.z / satMag,
    };

    // 点积：判断卫星在地球的向阳面还是背阳面
    // 正值表示卫星在向阳面，负值表示在背阳面（可能在阴影中）
    const dotProduct =
      satDir.x * sunDir.x + satDir.y * sunDir.y + satDir.z * sunDir.z;

    // 如果点积为正，卫星在向阳面，肯定被照亮
    if (dotProduct >= 0) {
      return true;
    }

    // 卫星在背阳面，需要检查是否在地球阴影锥内
    // 计算卫星到地心-太阳连线的垂直距离
    const sinTheta = Math.sqrt(1 - dotProduct ** 2);
    const perpDist = satMag * sinTheta;

    // 如果垂直距离大于地球半径，卫星在阴影锥之外，仍被照亮
    // 否则卫星在地球阴影中（本影区）
    return perpDist > EARTH_RADIUS_KM;
  }

  /**
   * 计算太阳位置（ECI坐标系，单位km）
   */
  private calculateSunPosition(time: Date): {
    x: number;
    y: number;
    z: number;
  } {
    const jday = satellite.jday(time);
    const sunPosAU = satellite.sunPos(jday);
    return {
      x: sunPosAU.rsun.x * AU_TO_KM,
      y: sunPosAU.rsun.y * AU_TO_KM,
      z: sunPosAU.rsun.z * AU_TO_KM,
    };
  }

  /**
   * 日照分析
   * @param noradId 卫星 NORAD ID
   * @param startTime 分析开始时间
   * @param durationMinutes 分析时长（分钟）
   */
  analyzeSunlight(
    noradId: string,
    startTime: Date,
    durationMinutes: number,
  ): SunlightAnalysis | null {
    const sat = this.satellites.get(noradId);
    if (!sat) return null;

    const orbitalPeriod = this.calculateOrbitalPeriod(sat);
    const steps = Math.min(durationMinutes * 2, 200); // 每分钟2个采样点，最多200点
    const intervalMs = (durationMinutes * 60 * 1000) / steps;

    const orbitSegments: OrbitSegment[] = [];
    let currentSegment: OrbitSegment | null = null;
    let sunlightCount = 0;
    let eclipseCount = 0;

    const now = new Date();
    let currentStatus: 'sunlight' | 'eclipse' = 'sunlight';
    let nextEntryTime: Date | null = null;
    let nextExitTime: Date | null = null;
    let foundCurrentStatus = false;

    for (let i = 0; i <= steps; i++) {
      const time = new Date(startTime.getTime() + i * intervalMs);
      const point = this.calculateOrbitPoint(sat, time);
      if (!point) continue;

      // 计算日照状态
      const sunPos = this.calculateSunPosition(time);
      const eci = satellite.propagate(sat.satrec, time);

      if (!eci?.position) continue;

      const isIlluminated = this.isSatelliteIlluminated(eci.position, sunPos);
      const status = isIlluminated ? 'sunlight' : 'eclipse';

      // 更新当前状态（找到当前时间点）
      if (!foundCurrentStatus && time >= now) {
        currentStatus = status;
        foundCurrentStatus = true;
      }

      // 统计日照/阴影点数
      if (isIlluminated) sunlightCount++;
      else eclipseCount++;

      // 预测下次阴影事件（从当前时间开始找第一个状态变化）
      if (time >= now) {
        if (
          status === 'eclipse' &&
          !nextEntryTime &&
          currentStatus === 'sunlight'
        ) {
          nextEntryTime = time;
        }
        if (status === 'sunlight' && nextEntryTime && !nextExitTime) {
          nextExitTime = time;
        }
      }

      // 构建轨道段
      if (!currentSegment) {
        currentSegment = {
          startTime: time.toISOString(),
          endTime: time.toISOString(),
          status,
          points: [point],
        };
      } else if (currentSegment.status === status) {
        currentSegment.endTime = time.toISOString();
        currentSegment.points.push(point);
      } else {
        // 状态切换，保存当前段，开始新段
        orbitSegments.push(currentSegment);
        currentSegment = {
          startTime: time.toISOString(),
          endTime: time.toISOString(),
          status,
          points: [point],
        };
      }
    }

    // 保存最后一个段
    if (currentSegment) {
      orbitSegments.push(currentSegment);
    }

    const totalPoints = sunlightCount + eclipseCount;
    const sunlightRatio = totalPoints > 0 ? sunlightCount / totalPoints : 0;
    const sunlightDuration = Math.round(sunlightRatio * durationMinutes);
    const eclipseDuration = Math.round((1 - sunlightRatio) * durationMinutes);

    // 计算到下次事件的时间
    let timeToNextEvent: number | undefined;
    if (nextEntryTime && currentStatus === 'sunlight') {
      timeToNextEvent = Math.round(
        (nextEntryTime.getTime() - now.getTime()) / 60000,
      );
    } else if (nextExitTime && currentStatus === 'eclipse') {
      timeToNextEvent = Math.round(
        (nextExitTime.getTime() - now.getTime()) / 60000,
      );
    }

    return {
      noradId: sat.noradId,
      name: sat.name,
      analysisStartTime: startTime.toISOString(),
      analysisEndTime: new Date(
        startTime.getTime() + durationMinutes * 60 * 1000,
      ).toISOString(),
      orbitalPeriod,
      sunlightRatio: Math.round(sunlightRatio * 1000) / 1000,
      sunlightDuration,
      eclipseDuration,
      currentStatus,
      nextEclipseEntry: nextEntryTime?.toISOString(),
      nextEclipseExit: nextExitTime?.toISOString(),
      timeToNextEvent,
      orbitSegments,
    };
  }

  /**
   * 获取当前日照状态（实时）
   * @param noradId 卫星 NORAD ID
   */
  getCurrentSunlightStatus(noradId: string): SunlightStatus | null {
    const sat = this.satellites.get(noradId);
    if (!sat) return null;

    const now = new Date();
    const sunPos = this.calculateSunPosition(now);
    const eci = satellite.propagate(sat.satrec, now);

    if (!eci?.position) return null;

    const isIlluminated = this.isSatelliteIlluminated(eci.position, sunPos);

    // 计算太阳方向向量（从卫星指向太阳，归一化）
    const satToSun = {
      x: sunPos.x - eci.position.x,
      y: sunPos.y - eci.position.y,
      z: sunPos.z - eci.position.z,
    };
    const distToSun = Math.sqrt(
      satToSun.x ** 2 + satToSun.y ** 2 + satToSun.z ** 2,
    );

    return {
      noradId: sat.noradId,
      name: sat.name,
      timestamp: now.toISOString(),
      status: isIlluminated ? 'sunlight' : 'eclipse',
      sunDirection: {
        x: satToSun.x / distToSun,
        y: satToSun.y / distToSun,
        z: satToSun.z / distToSun,
      },
    };
  }
}
