import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../db/drizzle.module';
import type { DrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  async create(createFeedbackDto: CreateFeedbackDto): Promise<schema.Feedback> {
    const [feedback] = await this.db
      .insert(schema.feedback)
      .values(createFeedbackDto)
      .returning();
    return feedback;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: schema.Feedback[]; total: number }> {
    const offset = (page - 1) * limit;

    const data = await this.db
      .select()
      .from(schema.feedback)
      .orderBy(desc(schema.feedback.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.feedback);

    return { data, total: count };
  }

  async findOne(id: string): Promise<schema.Feedback | null> {
    const [feedback] = await this.db
      .select()
      .from(schema.feedback)
      .where(eq(schema.feedback.id, id));
    return feedback || null;
  }

  async updateStatus(
    id: string,
    status: string,
  ): Promise<schema.Feedback | null> {
    await this.db
      .update(schema.feedback)
      .set({
        status: status as 'pending' | 'processing' | 'resolved' | 'closed',
        updatedAt: new Date(),
      })
      .where(eq(schema.feedback.id, id));
    return this.findOne(id);
  }
}
