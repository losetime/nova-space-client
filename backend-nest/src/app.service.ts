import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from './db/drizzle.module';
import type { DrizzleClient } from './db';
import * as schema from './db/schema';
import { eq, sql, and, isNotNull, ne } from 'drizzle-orm';

@Injectable()
export class AppService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  getHello(): string {
    return '星瞰 API v1.0.0';
  }

  async getStats() {
    const [{ satelliteCount }] = await this.db
      .select({ satelliteCount: sql<number>`count(*)` })
      .from(schema.satelliteTle);

    const [{ countryCount }] = await this.db
      .select({
        countryCount: sql<number>`count(distinct ${schema.satelliteMetadata.countryCode})`,
      })
      .from(schema.satelliteMetadata)
      .where(
        and(
          isNotNull(schema.satelliteMetadata.countryCode),
          ne(schema.satelliteMetadata.countryCode, ''),
        ),
      );

    const [{ articleCount }] = await this.db
      .select({ articleCount: sql<number>`count(*)` })
      .from(schema.educationArticles)
      .where(eq(schema.educationArticles.isPublished, true));

    const [{ intelligenceCount }] = await this.db
      .select({ intelligenceCount: sql<number>`count(*)` })
      .from(schema.intelligences);

    const [{ userCount }] = await this.db
      .select({ userCount: sql<number>`count(*)` })
      .from(schema.users)
      .where(eq(schema.users.isActive, true));

    return {
      satellites: Number(satelliteCount),
      countries: Number(countryCount),
      articles: Number(articleCount),
      intelligences: Number(intelligenceCount),
      users: Number(userCount),
    };
  }
}
