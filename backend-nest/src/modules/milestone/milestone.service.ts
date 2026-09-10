import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../db/drizzle.module';
import type { DrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { eq, and, desc, sql, gte, asc, type SQL } from 'drizzle-orm';
import {
  CreateMilestoneDto,
  UpdateMilestoneDto,
  QueryMilestoneDto,
} from './dto/milestone.dto';

@Injectable()
export class MilestoneService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  async findAll(query: QueryMilestoneDto) {
    const {
      category,
      page = 1,
      pageSize = 12,
      sortBy = 'eventDate',
      sortOrder = 'DESC',
    } = query;

    const offset = (page - 1) * pageSize;

    const conditions = [eq(schema.milestones.isPublished, true)];

    if (category) {
      conditions.push(
        eq(
          schema.milestones.category,
          category as 'launch' | 'recovery' | 'orbit' | 'mission' | 'other',
        ),
      );
    }

    const list = await this.db
      .select()
      .from(schema.milestones)
      .where(and(...conditions))
      .orderBy(
        sortOrder === 'DESC'
          ? desc(
              schema.milestones[
                sortBy as keyof typeof schema.milestones.$inferSelect
              ] as unknown as SQL,
            )
          : asc(
              schema.milestones[
                sortBy as keyof typeof schema.milestones.$inferSelect
              ] as unknown as SQL,
            ),
      )
      .limit(pageSize)
      .offset(offset);

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.milestones)
      .where(and(...conditions));

    return {
      list,
      total: count,
      page,
      pageSize,
    };
  }

  async getTimelineByDecade() {
    const milestones = await this.db
      .select()
      .from(schema.milestones)
      .where(eq(schema.milestones.isPublished, true))
      .orderBy(desc(schema.milestones.eventDate));

    const decadeMap = new Map<string, schema.Milestone[]>();

    milestones.forEach((milestone) => {
      const year = new Date(milestone.eventDate).getFullYear();
      const decade = `${Math.floor(year / 10) * 10}s`;
      if (!decadeMap.has(decade)) {
        decadeMap.set(decade, []);
      }
      decadeMap.get(decade)!.push(milestone);
    });

    const sortedDecades = Array.from(decadeMap.keys()).sort((a, b) => {
      const aDecade = parseInt(a.replace('s', ''));
      const bDecade = parseInt(b.replace('s', ''));
      return bDecade - aDecade;
    });

    return sortedDecades.map((decade) => ({
      decade,
      items: decadeMap.get(decade)!,
    }));
  }

  async findOne(id: number) {
    const [milestone] = await this.db
      .select()
      .from(schema.milestones)
      .where(eq(schema.milestones.id, id));

    if (!milestone) {
      throw new NotFoundException(`里程碑 ${id} 不存在`);
    }

    return milestone;
  }

  async create(dto: CreateMilestoneDto) {
    const [milestone] = await this.db
      .insert(schema.milestones)
      .values({
        ...dto,
        eventDate: dto.eventDate,
      })
      .returning();
    return milestone;
  }

  async update(id: number, dto: UpdateMilestoneDto) {
    await this.findOne(id);

    const [milestone] = await this.db
      .update(schema.milestones)
      .set({
        ...dto,
        eventDate: dto.eventDate,
        updatedAt: new Date(),
      })
      .where(eq(schema.milestones.id, id))
      .returning();

    return milestone;
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.db.delete(schema.milestones).where(eq(schema.milestones.id, id));
    return { success: true };
  }

  async getCategories() {
    const categories = await this.db
      .select({
        category: schema.milestones.category,
        count: sql<number>`count(*)`,
      })
      .from(schema.milestones)
      .where(eq(schema.milestones.isPublished, true))
      .groupBy(schema.milestones.category);

    return categories.map((c) => ({
      category: c.category,
      count: c.count,
    }));
  }

  async getFeatured(limit = 5) {
    return this.db
      .select()
      .from(schema.milestones)
      .where(
        and(
          eq(schema.milestones.isPublished, true),
          gte(schema.milestones.importance, 4),
        ),
      )
      .orderBy(
        desc(schema.milestones.importance),
        desc(schema.milestones.eventDate),
      )
      .limit(limit);
  }
}
