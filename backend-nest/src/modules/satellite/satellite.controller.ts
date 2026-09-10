import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Logger,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrbitCalculatorService } from './services/orbit-calculator.service';
import { SatelliteDataService } from './services/satellite-data.service';
import { SatelliteFavoriteService } from './services/satellite-favorite.service';
import { SatelliteMetadataService } from './services/satellite-metadata.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestWithUser } from '../../common/interfaces';
import type { ObserverPosition } from './interfaces/satellite.interface';

/**
 * 卫星控制器
 * 提供卫星数据的 HTTP API
 * 注意：具体路径必须在参数路径（:noradId）之前声明
 */
@Controller('satellites')
export class SatelliteController {
  private readonly logger = new Logger(SatelliteController.name);

  constructor(
    private readonly orbitCalculator: OrbitCalculatorService,
    private readonly satelliteDataService: SatelliteDataService,
    private readonly favoriteService: SatelliteFavoriteService,
    private readonly satelliteMetadataService: SatelliteMetadataService,
  ) {}

  /**
   * 搜索卫星
   * GET /api/satellites/search?name=xxx&limit=20
   */
  @Get('search')
  async searchSatellites(
    @Query('name') name?: string,
    @Query('limit') limit?: string,
  ) {
    const searchLimit = Math.min(
      Math.max(parseInt(limit || '50') || 50, 1),
      500,
    );
    const allTLEs = this.satelliteDataService.getCachedTLEs();

    let results = allTLEs;
    if (name) {
      const searchName = name.toLowerCase();
      results = allTLEs.filter(
        (tle) =>
          tle.name.toLowerCase().includes(searchName) ||
          tle.noradId.includes(searchName),
      );
    }

    const limitedResults = results.slice(0, searchLimit);

    // 批量获取元数据
    const satellites = await Promise.all(
      limitedResults.map(async (tle) => {
        const metadata = await this.satelliteDataService.getSatelliteMetadata(
          tle.noradId,
        );
        return {
          noradId: tle.noradId,
          name: tle.name,
          metadata,
        };
      }),
    );

    return {
      code: 0,
      data: {
        satellites,
        total: results.length,
        limit: searchLimit,
      },
      message: 'success',
    };
  }

  /**
   * 获取卫星统计信息
   * GET /api/satellites/stats
   */
  @Get('stats')
  async getStats() {
    const metadata = await this.satelliteDataService.getAllMetadata();
    return {
      code: 0,
      data: {
        total: this.orbitCalculator.getSatelliteCount(),
        lastUpdate: new Date().toISOString(),
        metadataCount: metadata.size,
      },
      message: 'success',
    };
  }

  /**
   * 获取全量TLE数据（用于前端本地计算）
   * GET /api/satellites/tle
   */
  @Get('tle')
  getAllTLEs() {
    this.logger.log('获取全量TLE数据');
    const tles = this.satelliteDataService.getAllTLEsForClient();
    return {
      code: 0,
      data: {
        tles,
        count: tles.length,
        updatedAt: new Date().toISOString(),
      },
      message: 'success',
    };
  }

  /**
   * 获取国家列表（含卫星数量）
   * GET /api/satellites/countries
   */
  @Get('countries')
  async getCountries() {
    this.logger.log('获取国家列表');

    // 获取 TLE 数据中的 NORAD ID 集合
    const tleData = this.satelliteDataService.getCachedTLEs();
    const tleNoradIds = new Set(tleData.map((tle) => tle.noradId));

    const metadata = await this.satelliteDataService.getAllMetadata();
    const countryCount = new Map<string, number>();
    let matchedCount = 0;
    let noCountryCount = 0;

    metadata.forEach((meta, noradId) => {
      // 只统计存在于 TLE 数据中的卫星
      if (tleNoradIds.has(noradId)) {
        matchedCount++;
        if (meta.countryCode) {
          const count = countryCount.get(meta.countryCode) || 0;
          countryCount.set(meta.countryCode, count + 1);
        } else {
          noCountryCount++;
        }
      }
    });

    // 调试日志
    this.logger.log(`TLE 数据: ${tleData.length} 条`);
    this.logger.log(`元数据: ${metadata.size} 条`);
    this.logger.log(`匹配成功: ${matchedCount} 条`);
    this.logger.log(`无国家代码: ${noCountryCount} 条`);

    // 转换为数组并排序
    const countries = Array.from(countryCount.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);

    this.logger.log(
      `返回 ${countries.length} 个国家，共 ${tleData.length} 颗卫星`,
    );
    return {
      code: 0,
      data: countries,
      message: 'success',
    };
  }

  /**
   * 获取任务分类列表（含卫星数量）
   * GET /api/satellites/missions
   */
  @Get('missions')
  async getMissions() {
    this.logger.log('获取任务分类列表');
    const missions = await this.satelliteDataService.getMissionCounts();
    return {
      code: 0,
      data: missions,
      message: 'success',
    };
  }

  /**
   * 获取运营商列表（含卫星数量）
   * GET /api/satellites/operators
   */
  @Get('operators')
  async getOperators() {
    this.logger.log('获取运营商列表');
    const operators = await this.satelliteDataService.getOperatorCounts();
    return {
      code: 0,
      data: operators,
      message: 'success',
    };
  }

  /**
   * 获取用户关注的卫星列表
   * GET /api/satellites/favorites
   */
  @Get('favorites')
  @UseGuards(JwtAuthGuard)
  async getUserFavorites(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    const favorites = await this.favoriteService.getUserFavorites(userId);

    // 获取卫星元数据
    const result = await Promise.all(
      favorites.map(async (fav) => {
        const metadata = await this.satelliteDataService.getSatelliteMetadata(
          fav.targetId,
        );
        return {
          noradId: fav.targetId,
          name: metadata?.name || `卫星 ${fav.targetId}`,
          followedAt: fav.createdAt,
          metadata,
        };
      }),
    );

    return {
      code: 0,
      data: result,
      message: 'success',
    };
  }

  // ==================== 以下为参数路由 ====================

  /**
   * 获取卫星详细信息（推荐使用）
   * GET /api/satellites/:noradId/detail
   * 一次性返回位置、元数据（含 ESA DISCOS 扩展）、轨道预测
   */
  @Get(':noradId/detail')
  async getSatelliteDetail(@Param('noradId') noradId: string) {
    this.logger.log(`获取卫星 ${noradId} 的详细信息`);

    // 1. 获取卫星基本信息
    const sat = this.orbitCalculator.getSatelliteInfo(noradId);
    if (!sat) {
      return {
        code: -1,
        data: null,
        message: '卫星不存在',
      };
    }

    // 2. 获取完整元数据
    const metadata =
      await this.satelliteMetadataService.enrichSatelliteMetadata(noradId);

    // 3. 计算轨道预测（默认一个轨道周期）
    const orbit = this.orbitCalculator.calculateSatelliteOrbit(
      noradId,
      100, // 轨道点数
      new Date(),
      150, // 约 2.5 小时
    );

    return {
      code: 0,
      data: {
        noradId,
        name: sat.name,
        metadata,
        orbit: {
          noradId,
          name: sat.name,
          startTime: new Date().toISOString(),
          duration: 150,
          steps: 100,
          orbitPoints: orbit,
        },
      },
      message: 'success',
    };
  }

  /**
   * 获取卫星元数据（含 ESA DISCOS 扩展信息）
   * GET /api/satellites/:noradId/metadata
   */
  @Get(':noradId/metadata')
  async getSatelliteMetadata(@Param('noradId') noradId: string) {
    this.logger.log(`获取卫星 ${noradId} 的元数据`);

    // 尝试从 ESA DISCOS 获取扩展信息
    const enrichedMetadata =
      await this.satelliteMetadataService.enrichSatelliteMetadata(noradId);

    if (!enrichedMetadata) {
      return {
        code: -1,
        data: null,
        message: '卫星元数据不存在',
      };
    }

    return {
      code: 0,
      data: enrichedMetadata,
      message: 'success',
    };
  }

  /**
   * 获取单个卫星的轨道数据
   * GET /api/satellites/:noradId/orbit
   * @param noradId 卫星 NORAD ID
   * @param steps 轨道点数（默认50，最大500）
   * @param startTime 开始时间（ISO格式，默认当前）
   * @param duration 持续时间（分钟，默认150，最大1440）
   */
  @Get(':noradId/orbit')
  getSatelliteOrbit(
    @Param('noradId') noradId: string,
    @Query('steps') steps?: string,
    @Query('startTime') startTime?: string,
    @Query('duration') duration?: string,
  ) {
    this.logger.log(`获取卫星 ${noradId} 的轨道数据`);

    const sat = this.orbitCalculator.getSatelliteInfo(noradId);
    if (!sat) {
      return {
        code: -1,
        data: null,
        message: '卫星不存在',
      };
    }

    // 解析参数
    const orbitSteps = Math.min(
      Math.max(parseInt(steps || '50') || 50, 10),
      500,
    );
    const durationMinutes = Math.min(
      Math.max(parseInt(duration || '150') || 150, 10),
      1440,
    );
    const start = startTime ? new Date(startTime) : new Date();

    // 验证时间
    if (isNaN(start.getTime())) {
      return {
        code: -1,
        data: null,
        message: '无效的开始时间格式',
      };
    }

    const orbit = this.orbitCalculator.calculateSatelliteOrbit(
      noradId,
      orbitSteps,
      start,
      durationMinutes,
    );

    return {
      code: 0,
      data: {
        noradId,
        name: sat.name,
        startTime: start.toISOString(),
        duration: durationMinutes,
        steps: orbitSteps,
        orbitPoints: orbit,
      },
      message: 'success',
    };
  }

  /**
   * 轨道预测（完整版）
   * GET /api/satellites/:noradId/predict
   * @param noradId 卫星 NORAD ID
   * @param startTime 开始时间（ISO格式，默认当前）
   * @param duration 持续时间（分钟，默认360，最大1440）
   * @param steps 轨道点数（默认100，最大500）
   * @param intervalSeconds 固定采样间隔（秒），优先级高于 steps
   */
  @Get(':noradId/predict')
  predictOrbit(
    @Param('noradId') noradId: string,
    @Query('startTime') startTime?: string,
    @Query('duration') duration?: string,
    @Query('steps') steps?: string,
    @Query('intervalSeconds') intervalSeconds?: string,
  ) {
    this.logger.log(`预测卫星 ${noradId} 的轨道`);

    const sat = this.orbitCalculator.getSatelliteInfo(noradId);
    if (!sat) {
      return {
        code: -1,
        data: null,
        message: '卫星不存在',
      };
    }

    // 解析参数
    const orbitSteps = Math.min(
      Math.max(parseInt(steps || '100') || 100, 10),
      500,
    );
    const durationMinutes = Math.min(
      Math.max(parseInt(duration || '360') || 360, 10),
      1440,
    );
    const start = startTime ? new Date(startTime) : new Date();
    const actualIntervalSeconds = intervalSeconds
      ? parseInt(intervalSeconds)
      : undefined;

    // 验证时间
    if (isNaN(start.getTime())) {
      return {
        code: -1,
        data: null,
        message: '无效的开始时间格式',
      };
    }

    const prediction = this.orbitCalculator.predictOrbit(
      noradId,
      start,
      durationMinutes,
      orbitSteps,
      actualIntervalSeconds,
    );

    return {
      code: 0,
      data: prediction,
      message: 'success',
    };
  }

  /**
   * 预测指定时间点的卫星位置
   * GET /api/satellites/:noradId/position
   * @param noradId 卫星 NORAD ID
   * @param time 预测时间（ISO格式，默认当前）
   */
  @Get(':noradId/position')
  predictPosition(
    @Param('noradId') noradId: string,
    @Query('time') time?: string,
  ) {
    this.logger.log(`预测卫星 ${noradId} 在指定时间的位置`);

    const sat = this.orbitCalculator.getSatelliteInfo(noradId);
    if (!sat) {
      return {
        code: -1,
        data: null,
        message: '卫星不存在',
      };
    }

    const targetTime = time ? new Date(time) : new Date();

    // 验证时间
    if (isNaN(targetTime.getTime())) {
      return {
        code: -1,
        data: null,
        message: '无效的时间格式',
      };
    }

    const prediction = this.orbitCalculator.predictPosition(
      noradId,
      targetTime,
    );

    return {
      code: 0,
      data: prediction,
      message: 'success',
    };
  }

  /**
   * 日照分析
   * GET /api/satellites/:noradId/sunlight
   * @param noradId 卫星 NORAD ID
   * @param startTime 分析开始时间（ISO格式，默认当前）
   * @param duration 分析时长（分钟，默认一个轨道周期，最大1440）
   */
  @Get(':noradId/sunlight')
  analyzeSunlight(
    @Param('noradId') noradId: string,
    @Query('startTime') startTime?: string,
    @Query('duration') duration?: string,
  ) {
    this.logger.log(`分析卫星 ${noradId} 的日照情况`);

    const sat = this.orbitCalculator.getSatelliteInfo(noradId);
    if (!sat) {
      return {
        code: -1,
        data: null,
        message: '卫星不存在',
      };
    }

    const start = startTime ? new Date(startTime) : new Date();

    // 验证时间
    if (isNaN(start.getTime())) {
      return {
        code: -1,
        data: null,
        message: '无效的开始时间格式',
      };
    }

    // 默认分析一个轨道周期（约90分钟），最多24小时
    const defaultDuration = 90;
    const durationMinutes = Math.min(
      Math.max(
        parseInt(duration || String(defaultDuration)) || defaultDuration,
        10,
      ),
      1440,
    );

    const analysis = this.orbitCalculator.analyzeSunlight(
      noradId,
      start,
      durationMinutes,
    );

    return {
      code: 0,
      data: analysis,
      message: 'success',
    };
  }

  /**
   * 实时日照状态
   * GET /api/satellites/:noradId/sunlight/status
   */
  @Get(':noradId/sunlight/status')
  getSunlightStatus(@Param('noradId') noradId: string) {
    this.logger.log(`获取卫星 ${noradId} 的实时日照状态`);

    const sat = this.orbitCalculator.getSatelliteInfo(noradId);
    if (!sat) {
      return {
        code: -1,
        data: null,
        message: '卫星不存在',
      };
    }

    const status = this.orbitCalculator.getCurrentSunlightStatus(noradId);

    return {
      code: 0,
      data: status,
      message: 'success',
    };
  }

  /**
   * 预测卫星过境
   * GET /api/satellites/:noradId/passes
   * @param noradId 卫星 NORAD ID
   * @param lat 观察者纬度（度）
   * @param lng 观察者经度（度）
   * @param alt 观察者海拔（米，默认0）
   * @param days 预测天数（默认7，最大30）
   * @param minElevation 最小高度角（度，默认10）
   */
  @Get(':noradId/passes')
  predictPasses(
    @Param('noradId') noradId: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('alt') alt?: string,
    @Query('days') days?: string,
    @Query('minElevation') minElevation?: string,
  ) {
    this.logger.log(`预测卫星 ${noradId} 的过境`);

    const sat = this.orbitCalculator.getSatelliteInfo(noradId);
    if (!sat) {
      return {
        code: -1,
        data: null,
        message: '卫星不存在',
      };
    }

    // 验证必需参数
    if (!lat || !lng) {
      return {
        code: -1,
        data: null,
        message: '缺少观察者位置参数（lat, lng）',
      };
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return {
        code: -1,
        data: null,
        message: '无效的经纬度参数',
      };
    }

    if (latitude < -90 || latitude > 90) {
      return {
        code: -1,
        data: null,
        message: '纬度必须在 -90 到 90 之间',
      };
    }

    if (longitude < -180 || longitude > 180) {
      return {
        code: -1,
        data: null,
        message: '经度必须在 -180 到 180 之间',
      };
    }

    const observer: ObserverPosition = {
      lat: latitude,
      lng: longitude,
      alt: parseFloat(alt || '0') || 0,
    };

    const predictionDays = Math.min(
      Math.max(parseInt(days || '7') || 7, 1),
      30,
    );
    const minElev = Math.min(
      Math.max(parseFloat(minElevation || '10') || 10, 0),
      90,
    );

    const prediction = this.orbitCalculator.predictPasses(
      noradId,
      observer,
      predictionDays,
      minElev,
    );

    return {
      code: 0,
      data: prediction,
      message: 'success',
    };
  }

  // ==================== 关注功能 ====================

  /**
   * 关注/取消关注卫星
   * POST /api/satellites/:noradId/favorite
   */
  @Post(':noradId/favorite')
  @UseGuards(JwtAuthGuard)
  async toggleFavorite(
    @Param('noradId') noradId: string,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    const result = await this.favoriteService.toggleFavorite(userId, noradId);

    return {
      code: 0,
      data: result,
      message: result.favorited ? '关注成功' : '已取消关注',
    };
  }

  /**
   * 检查是否关注了卫星
   * GET /api/satellites/:noradId/favorite
   */
  @Get(':noradId/favorite')
  @UseGuards(JwtAuthGuard)
  async checkFavorite(
    @Param('noradId') noradId: string,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    const favorited = await this.favoriteService.isFavorited(userId, noradId);

    return {
      code: 0,
      data: { favorited },
      message: 'success',
    };
  }
}
