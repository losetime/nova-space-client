import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../db/drizzle.module';
import type { DrizzleClient } from '../../../db';
import * as schema from '../../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { Cron, CronExpression } from '@nestjs/schedule';
import type {
  TLEData,
  SatelliteMetadata,
} from '../interfaces/satellite.interface';

type SatelliteMetadataEntity = typeof schema.satelliteMetadata.$inferSelect;
type SatelliteMetadataInsert = typeof schema.satelliteMetadata.$inferInsert;

@Injectable()
export class SatelliteDataService implements OnModuleInit {
  private readonly logger = new Logger(SatelliteDataService.name);
  private cachedTLEs: TLEData[] = [];
  private cachedMetadata: Map<
    string,
    { countryCode?: string; mission?: string; operator?: string }
  > = new Map();

  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  async onModuleInit() {
    await this.refreshFromDatabase();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async refreshFromDatabase(): Promise<void> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.satelliteTle);
    if (Number(count) > 0) {
      this.logger.log(`从数据库刷新卫星数据: ${count} TLE`);
      await this.loadFromDatabase();
    } else {
      this.logger.warn('数据库中没有卫星数据');
    }
  }

  private async loadFromDatabase(): Promise<void> {
    const metadataEntities = await this.db
      .select()
      .from(schema.satelliteMetadata);

    const completenessScores = new Map<string, number>();
    metadataEntities.forEach((entity) => {
      const score = Object.values(entity).filter(
        (v) => v !== null && v !== undefined,
      ).length;
      completenessScores.set(entity.noradId, score);
    });

    const tleEntities = await this.db.select().from(schema.satelliteTle);

    tleEntities.sort((a, b) => {
      const scoreA = completenessScores.get(a.noradId) ?? 0;
      const scoreB = completenessScores.get(b.noradId) ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const timeA = a.updatedAt?.getTime() ?? 0;
      const timeB = b.updatedAt?.getTime() ?? 0;
      return timeB - timeA;
    });

    this.cachedTLEs = tleEntities.map((entity) => ({
      name: entity.name,
      noradId: entity.noradId,
      line1: entity.line1,
      line2: entity.line2,
      epoch: entity.epoch?.toISOString(),
      inclination: entity.inclination ?? undefined,
      raan: entity.raan ?? undefined,
      eccentricity: entity.eccentricity ?? undefined,
      argOfPerigee: entity.argOfPerigee ?? undefined,
      meanMotion: entity.meanMotion ?? undefined,
    }));

    this.cachedMetadata.clear();
    metadataEntities.forEach((entity) => {
      this.cachedMetadata.set(entity.noradId, {
        countryCode: entity.countryCode || undefined,
        mission: entity.mission || undefined,
        operator: entity.operator || undefined,
      });
    });
    this.logger.log(`已加载 ${this.cachedTLEs.length} 条 TLE 数据`);
  }

  getCachedMetadata() {
    return this.cachedMetadata;
  }
  getCachedTLEs(): TLEData[] {
    return this.cachedTLEs;
  }

  getAllTLEsForClient() {
    return this.cachedTLEs.map((tle) => ({
      noradId: tle.noradId,
      name: tle.name,
      line1: tle.line1,
      line2: tle.line2,
      countryCode: this.cachedMetadata.get(tle.noradId)?.countryCode,
      mission: this.cachedMetadata.get(tle.noradId)?.mission,
      operator: this.cachedMetadata.get(tle.noradId)?.operator,
    }));
  }

  async getSatelliteMetadata(
    noradId: string,
  ): Promise<SatelliteMetadata | null> {
    const [entity] = await this.db
      .select()
      .from(schema.satelliteMetadata)
      .where(eq(schema.satelliteMetadata.noradId, noradId));
    if (!entity) return null;
    return this.entityToMetadata(entity);
  }

  async getAllMetadata(): Promise<Map<string, SatelliteMetadata>> {
    const entities = await this.db.select().from(schema.satelliteMetadata);
    const map = new Map<string, SatelliteMetadata>();
    entities.forEach((entity) =>
      map.set(entity.noradId, this.entityToMetadata(entity)),
    );
    return map;
  }

  private entityToMetadata(entity: SatelliteMetadataEntity): SatelliteMetadata {
    let tleAge: number | undefined;
    if (entity.tleEpoch) {
      const ageMs = Date.now() - entity.tleEpoch.getTime();
      tleAge = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    }
    return {
      noradId: entity.noradId,
      name: entity.name ?? undefined,
      objectId: entity.objectId ?? undefined,
      altName: entity.altName ?? undefined,
      objectType: entity.objectType ?? undefined,
      status: entity.status ?? undefined,
      countryCode: entity.countryCode ?? undefined,
      launchDate: entity.launchDate?.toISOString(),
      launchSite: entity.launchSite ?? undefined,
      launchVehicle: entity.launchVehicle ?? undefined,
      decayDate: entity.decayDate?.toISOString(),
      period: entity.period ?? undefined,
      inclination: entity.inclination ?? undefined,
      apogee: entity.apogee ?? undefined,
      perigee: entity.perigee ?? undefined,
      eccentricity: entity.eccentricity ?? undefined,
      raan: entity.raan ?? undefined,
      argOfPerigee: entity.argOfPerigee ?? undefined,
      rcs: entity.rcs ?? undefined,
      stdMag: entity.stdMag ?? undefined,
      tleEpoch: entity.tleEpoch?.toISOString(),
      tleAge,
      cosparId: entity.cosparId ?? undefined,
      objectClass: entity.objectClass ?? undefined,
      launchMass: entity.launchMass ?? undefined,
      shape: entity.shape ?? undefined,
      dimensions: entity.dimensions ?? undefined,
      span: entity.span ?? undefined,
      mission: entity.mission ?? undefined,
      firstEpoch: entity.firstEpoch?.toISOString(),
      operator: entity.operator ?? undefined,
      manufacturer: entity.manufacturer ?? undefined,
      contractor: entity.contractor ?? undefined,
      bus: entity.bus ?? undefined,
      configuration: entity.configuration ?? undefined,
      purpose: entity.purpose ?? undefined,
      power: entity.power ?? undefined,
      motor: entity.motor ?? undefined,
      length: entity.length ?? undefined,
      diameter: entity.diameter ?? undefined,
      dryMass: entity.dryMass ?? undefined,
      equipment: entity.equipment ?? undefined,
      adcs: entity.adcs ?? undefined,
      payload: entity.payload ?? undefined,
      constellationName: entity.constellationName ?? undefined,
      lifetime: entity.lifetime ?? undefined,
      predDecayDate: entity.predDecayDate?.toISOString(),
      flightNo: entity.flightNo ?? undefined,
      cosparLaunchNo: entity.cosparLaunchNo ?? undefined,
      launchFailure: entity.launchFailure ?? undefined,
      launchSiteName: entity.launchSiteName ?? undefined,
      summary: entity.summary ?? undefined,
      stable_date: entity.stableDate?.toISOString(),
      launch_pad: entity.launchPad ?? undefined,
      material_composition: entity.materialComposition ?? undefined,
      major_events: entity.majorEvents ?? undefined,
      related_satellites: entity.relatedSatellites ?? undefined,
      transmitter_frequencies: entity.transmitterFrequencies ?? undefined,
    };
  }

  async updateSatelliteMetadata(
    noradId: string,
    data: SatelliteMetadataInsert,
  ): Promise<void> {
    await this.db
      .update(schema.satelliteMetadata)
      .set(data)
      .where(eq(schema.satelliteMetadata.noradId, noradId));
  }

  async getMissionCounts(): Promise<{ name: string; count: number }[]> {
    const tleNoradIds = new Set(this.cachedTLEs.map((tle) => tle.noradId));
    const metadata = await this.getAllMetadata();
    const missionCount = new Map<string, number>();
    metadata.forEach((meta, noradId) => {
      if (tleNoradIds.has(noradId)) {
        const category = meta.mission
          ? this.categorizeMission(meta.mission)
          : '其他';
        missionCount.set(category, (missionCount.get(category) || 0) + 1);
      }
    });
    return Array.from(missionCount.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getOperatorCounts(): Promise<{ name: string; count: number }[]> {
    const tleNoradIds = new Set(this.cachedTLEs.map((tle) => tle.noradId));
    const metadata = await this.getAllMetadata();
    const operatorCount = new Map<string, number>();
    metadata.forEach((meta, noradId) => {
      if (tleNoradIds.has(noradId) && meta.operator) {
        operatorCount.set(
          meta.operator,
          (operatorCount.get(meta.operator) || 0) + 1,
        );
      }
    });
    return Array.from(operatorCount.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  private readonly MISSION_CATEGORIES: Record<string, string> = {
    // 通信类
    'Civil Communications': '通信',
    'Defense Communications': '通信',
    'Commercial Communications': '通信',
    Communications: '通信',
    Telecommunications: '通信',
    Broadcasting: '通信',
    'Mobile Communications': '通信',
    'Fixed Satellite Services': '通信',

    // 导航类
    'Civil Navigation': '导航',
    'Defense Navigation': '导航',
    'Commercial Navigation': '导航',
    Navigation: '导航',
    Positioning: '导航',
    GNSS: '导航',
    GPS: '导航',
    GLONASS: '导航',
    Galileo: '导航',
    BeiDou: '导航',

    // 遥感/对地观测类
    'Civil Imaging': '遥感',
    'Civil Earth Observation': '遥感',
    'Civil Remote Sensing': '遥感',
    'Defense Imaging': '遥感',
    'Defense Earth Observation': '遥感',
    'Defense Reconnaissance': '遥感',
    'Commercial Imaging': '遥感',
    'Commercial Remote Sensing': '遥感',
    'Earth Observation': '遥感',
    'Remote Sensing': '遥感',
    Imaging: '遥感',
    Reconnaissance: '遥感',
    Surveillance: '遥感',
    Mapping: '遥感',
    Cartography: '遥感',
    'Terrain Mapping': '遥感',
    Oceanography: '遥感',
    'Marine Observation': '遥感',
    'Land Observation': '遥感',

    // 气象类
    'Civil Weather': '气象',
    'Defense Weather': '气象',
    'Commercial Weather': '气象',
    Weather: '气象',
    Meteorological: '气象',
    Meteorology: '气象',
    Climate: '气象',
    'Climate Research': '气象',
    'Environmental Monitoring': '气象',

    // 科学研究类
    'Civil Science': '科学',
    'Civil Technology': '科学',
    'Defense Science': '科学',
    'Scientific Research': '科学',
    'Space Science': '科学',
    'Earth Science': '科学',
    Astronomy: '科学',
    Astrophysics: '科学',
    Geodetic: '科学',
    Geodesy: '科学',
    Geophysical: '科学',
    Geophysics: '科学',
    Biological: '科学',
    Biology: '科学',
    Materials: '科学',
    'Materials Science': '科学',
    Physics: '科学',
    'Solar Physics': '科学',
    'Space Physics': '科学',
    'Plasma Physics': '科学',
    'Cosmic Ray': '科学',
    'Particle Physics': '科学',

    // 技术试验类
    'Technology Demonstration': '技术试验',
    'Civil Experimental': '技术试验',
    'Defense Technology': '技术试验',
    Experimental: '技术试验',
    Test: '技术试验',
    'Technology Development': '技术试验',
    Technology: '技术试验',
    Demonstration: '技术试验',
    Prototype: '技术试验',
    Engineering: '技术试验',

    // 国防军事类
    'Defense Sigint': '国防',
    'Defense Early Warning': '国防',
    Defense: '国防',
    Military: '国防',
    'Missile Warning': '国防',
    'Nuclear Detection': '国防',
    'Electronic Intelligence': '国防',
    'Signals Intelligence': '国防',
    ELINT: '国防',
    SIGINT: '国防',

    // 载人航天类
    'Space Station': '载人航天',
    Manned: '载人航天',
    Crewed: '载人航天',
    Cargo: '载人航天',
    Supply: '载人航天',
    'Human Spaceflight': '载人航天',
    'Space Tourism': '载人航天',

    // 数据中继类
    'Data Relay': '数据中继',
    'Tracking and Data Relay': '数据中继',
    TDRS: '数据中继',
    'Satellite Inter-satellite Link': '数据中继',

    // 其他
    'Civil Education': '教育',
    Education: '教育',
    Academic: '教育',
    Amateur: '业余无线电',
    'Amateur Radio': '业余无线电',
    Rescue: '搜救',
    'Search and Rescue': '搜救',
    SAR: '搜救',
    Training: '训练',
    Calibration: '校准',
    Tracking: '跟踪',
    'Space Debris': '碎片',
    Debris: '碎片',
  };

  private categorizeMission(mission: string): string {
    return this.MISSION_CATEGORIES[mission] || '其他';
  }
}
