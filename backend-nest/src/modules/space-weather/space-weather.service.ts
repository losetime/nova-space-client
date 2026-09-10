import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

// NOAA API 基础 URL
const NOAA_BASE_URL = 'https://services.swpc.noaa.gov';

interface NoaaScaleNotice {
  Scale?: string;
  Text?: string;
  MinorProb?: string | number | null;
  MajorProb?: string | number | null;
}

interface NoaaScaleDay {
  DateStamp?: string | null;
  TimeStamp?: string | null;
  R?: NoaaScaleNotice;
  S?: NoaaScaleNotice;
  G?: NoaaScaleNotice;
}

interface NoaaSolarWind {
  WindSpeed?: string;
  TimeStamp?: string;
}

interface NoaaAlert {
  product_id: string;
  issue_datetime: string;
  message: string;
}

export interface ParsedAlert {
  id: string;
  issueTime: string;
  title: string;
  type: string;
  level: number;
  message: string;
}

interface XrayFluxItem {
  time_tag: string;
  flux: number | string | null;
  observed_flux: number | string | null;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

@Injectable()
export class SpaceWeatherService {
  private readonly logger = new Logger(SpaceWeatherService.name);

  /**
   * 获取当前空间天气状态
   */
  async getCurrentStatus() {
    try {
      // 并行获取多个数据源
      const [scalesRes, solarWindRes] = await Promise.all([
        axios.get<Record<string, NoaaScaleDay>>(
          `${NOAA_BASE_URL}/products/noaa-scales.json`,
        ),
        axios.get<NoaaSolarWind>(
          `${NOAA_BASE_URL}/products/summary/solar-wind-speed.json`,
        ),
      ]);

      const scales = scalesRes.data;
      const solarWind = solarWindRes.data;

      return {
        dateStamp: scales['0']?.DateStamp || null,
        timeStamp: scales['0']?.TimeStamp || null,
        // 辐射风暴等级 R
        radiation: {
          scale: parseInt(scales['0']?.R?.Scale ?? '') || 0,
          text: scales['0']?.R?.Text || 'none',
          minorProb: scales['0']?.R?.MinorProb,
          majorProb: scales['0']?.R?.MajorProb,
        },
        // 太阳耀斑等级 S
        solarFlare: {
          scale: parseInt(scales['0']?.S?.Scale ?? '') || 0,
          text: scales['0']?.S?.Text || 'none',
          minorProb: scales['0']?.S?.MinorProb,
          majorProb: scales['0']?.S?.MajorProb,
        },
        // 地磁暴等级 G
        geomagnetic: {
          scale: parseInt(scales['0']?.G?.Scale ?? '') || 0,
          text: scales['0']?.G?.Text || 'none',
          minorProb: scales['0']?.G?.MinorProb,
          majorProb: scales['0']?.G?.MajorProb,
        },
        // 太阳风速度
        solarWind: {
          speed: parseInt(solarWind.WindSpeed ?? '') || 0,
          timeStamp: solarWind.TimeStamp,
        },
      };
    } catch (error: unknown) {
      this.logger.error(
        'Failed to fetch current space weather status',
        toError(error),
      );
      throw error;
    }
  }

  /**
   * 获取预警列表
   */
  async getAlerts(limit: number = 20): Promise<ParsedAlert[]> {
    try {
      const response = await axios.get<NoaaAlert[]>(
        `${NOAA_BASE_URL}/products/alerts.json`,
      );
      const alerts = response.data;

      // 解析预警信息
      const parsedAlerts = alerts.slice(0, limit).map((alert) => {
        return this.parseAlert(alert);
      });

      return parsedAlerts;
    } catch (error: unknown) {
      this.logger.error('Failed to fetch space weather alerts', toError(error));
      throw error;
    }
  }

  /**
   * 解析预警信息
   */
  private parseAlert(alert: NoaaAlert): ParsedAlert {
    const message = alert.message || '';

    // 提取预警类型
    let type = 'unknown';
    let level = 0;

    if (message.includes('Geomagnetic Storm')) {
      type = 'geomagnetic';
      const gMatch = message.match(/Category G(\d)/);
      if (gMatch) level = parseInt(gMatch[1]);
    } else if (message.includes('Solar Radiation Storm')) {
      type = 'radiation';
      const rMatch = message.match(/Category R(\d)/);
      if (rMatch) level = parseInt(rMatch[1]);
    } else if (message.includes('Radio Blackout')) {
      type = 'radio_blackout';
      const rMatch = message.match(/Category R(\d)/);
      if (rMatch) level = parseInt(rMatch[1]);
    } else if (message.includes('X-Ray Flux')) {
      type = 'xray_flux';
    }

    // 提取标题
    const titleMatch = message.match(/WATCH:\s*(.+?)\r?\n/);
    const title = titleMatch ? titleMatch[1].trim() : alert.product_id;

    return {
      id: alert.product_id,
      issueTime: alert.issue_datetime,
      title: title,
      type: type,
      level: level,
      message: message,
    };
  }

  /**
   * 获取 X 射线通量数据（最近6小时）
   */
  async getXrayFlux(hours: number = 6) {
    try {
      const response = await axios.get<XrayFluxItem[]>(
        `${NOAA_BASE_URL}/json/goes/primary/xrays-6-hour.json`,
      );
      const data = response.data;

      // 过滤最近指定小时的数据
      const now = new Date();
      const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);

      const filteredData = data
        .filter((item) => new Date(item.time_tag) >= cutoff)
        .map((item) => ({
          time: item.time_tag,
          flux: item.flux,
          observedFlux: item.observed_flux,
        }));

      return {
        data: filteredData,
        unit: 'W/m²',
        description: 'X-Ray flux (0.1-0.8 nm)',
      };
    } catch (error: unknown) {
      this.logger.error('Failed to fetch X-ray flux data', toError(error));
      throw error;
    }
  }
}
