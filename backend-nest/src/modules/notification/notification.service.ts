import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../db/drizzle.module';
import type { DrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  CreateNotificationDto,
  NotificationQueryDto,
} from './dto/notification.dto';

@Injectable()
export class NotificationService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  async create(dto: CreateNotificationDto): Promise<schema.Notification> {
    const [notification] = await this.db
      .insert(schema.notifications)
      .values(dto)
      .returning();
    return notification;
  }

  async createBatch(
    userIds: string[],
    dto: Omit<CreateNotificationDto, 'userId'>,
  ): Promise<void> {
    const notifications = userIds.map((userId) => ({
      userId,
      type: dto.type,
      title: dto.title,
      content: dto.content,
      isRead: false,
      relatedId: dto.relatedId,
      relatedType: dto.relatedType,
    }));

    await this.db.insert(schema.notifications).values(notifications);
  }

  async findByUser(userId: string, query: NotificationQueryDto) {
    const { isRead, type, page = 1, limit = 20 } = query;
    const offset = (page - 1) * limit;

    const conditions = [eq(schema.notifications.userId, userId)];

    if (isRead !== undefined) {
      conditions.push(eq(schema.notifications.isRead, isRead));
    }

    if (type) {
      conditions.push(eq(schema.notifications.type, type));
    }

    const list = await this.db
      .select()
      .from(schema.notifications)
      .where(and(...conditions))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.notifications)
      .where(and(...conditions));

    return {
      list,
      total: count,
      page,
      pageSize: limit,
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.isRead, false),
        ),
      );
    return count;
  }

  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(schema.notifications.id, notificationId),
          eq(schema.notifications.userId, userId),
        ),
      );
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.isRead, false),
        ),
      );
    return (result as unknown as { rowCount: number }).rowCount;
  }

  async delete(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.notifications)
      .where(
        and(
          eq(schema.notifications.id, notificationId),
          eq(schema.notifications.userId, userId),
        ),
      );
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  async clearRead(userId: string): Promise<number> {
    const result = await this.db
      .delete(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.isRead, true),
        ),
      );
    return (result as unknown as { rowCount: number }).rowCount;
  }

  async notifyIntelligencePublish(
    intelligenceId: string,
    intelligenceTitle: string,
    subscriberIds: string[],
  ): Promise<void> {
    await this.createBatch(subscriberIds, {
      type: 'intelligence',
      title: '新情报发布',
      content: `您关注的领域有新情报发布：${intelligenceTitle}`,
      relatedId: intelligenceId,
      relatedType: 'intelligence',
    });
  }

  async sendSystemNotification(
    userIds: string[] | 'all',
    title: string,
    content: string,
  ): Promise<void> {
    if (userIds === 'all') {
      return;
    }
    await this.createBatch(userIds, {
      type: 'system',
      title,
      content,
    });
  }

  async sendAchievementNotification(
    userId: string,
    title: string,
    content: string,
  ): Promise<schema.Notification> {
    return this.create({
      userId,
      type: 'achievement',
      title,
      content,
    });
  }

  async sendMembershipNotification(
    userId: string,
    action: MembershipAction,
    data: MembershipNotificationData,
  ): Promise<schema.Notification> {
    const { title, content } = this.getMembershipMessage(action, data);
    return this.create({
      userId,
      type: 'membership',
      title,
      content,
      relatedId: data.subscriptionId,
      relatedType: 'subscription',
    });
  }

  async sendPointsNotification(
    userId: string,
    action: 'earned' | 'consumed',
    points: number,
    source: string,
  ): Promise<schema.Notification> {
    const title = action === 'earned' ? '积分获得' : '积分消费';
    const content =
      action === 'earned'
        ? `您获得了 ${points} 积分（来源：${source}）`
        : `您消费了 ${points} 积分用于：${source}`;
    return this.create({
      userId,
      type: 'membership',
      title,
      content,
    });
  }

  private getMembershipMessage(
    action: MembershipAction,
    data: MembershipNotificationData,
  ): { title: string; content: string } {
    const messages: Record<
      MembershipAction,
      { title: string; contentFn: () => string }
    > = {
      activated: {
        title: '会员开通成功',
        contentFn: () =>
          `您已成功开通${data.planName || '会员'}，有效期至 ${this.formatDate(data.endDate)}`,
      },
      expiring_soon: {
        title: '会员即将到期',
        contentFn: () =>
          `您的会员将在 ${data.daysLeft} 天后到期，请及时续费以保留权益`,
      },
      expired: {
        title: '会员已过期',
        contentFn: () => '您的会员已过期，部分权益已降级。点击续费恢复',
      },
      renewed: {
        title: '续费成功',
        contentFn: () =>
          `您的会员已续费成功，新有效期至 ${this.formatDate(data.endDate)}`,
      },
      renew_failed: {
        title: '续费失败',
        contentFn: () => '自动续费扣款失败，请手动续费或更新支付方式',
      },
      points_exchange: {
        title: '积分兑换成功',
        contentFn: () =>
          `您已使用 ${data.points} 积分兑换${data.planName || '会员'}，有效期至 ${this.formatDate(data.endDate)}`,
      },
      admin_adjusted: {
        title: '会员权益变更',
        contentFn: () =>
          `您的会员权益已由管理员调整，当前等级：${data.newLevel || '高级会员'}`,
      },
      level_changed: {
        title: '会员等级变更',
        contentFn: () => `您的会员等级已变更为 ${data.newLevel || '高级会员'}`,
      },
    };
    return {
      title: messages[action].title,
      content: messages[action].contentFn(),
    };
  }

  private formatDate(date?: Date | string): string {
    if (!date) return '未知';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

export type MembershipAction =
  | 'activated'
  | 'expiring_soon'
  | 'expired'
  | 'renewed'
  | 'renew_failed'
  | 'points_exchange'
  | 'admin_adjusted'
  | 'level_changed';

export interface MembershipNotificationData {
  planName?: string;
  endDate?: Date | string;
  daysLeft?: number;
  points?: number;
  newLevel?: string;
  subscriptionId?: string;
}
