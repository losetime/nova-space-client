import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DRIZZLE } from '../../db/drizzle.module';
import type { DrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { eq, and, lt, gte } from 'drizzle-orm';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class MembershipSchedulerService {
  private readonly logger = new Logger(MembershipSchedulerService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkExpiredSubscriptions() {
    this.logger.log('开始检查过期订阅...');
    const now = new Date();

    const expiredSubscriptions = await this.db
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.status, 'active'),
          lt(schema.subscriptions.endDate, now),
        ),
      );

    for (const subscription of expiredSubscriptions) {
      try {
        await this.db
          .update(schema.subscriptions)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(schema.subscriptions.id, subscription.id));

        await this.db
          .update(schema.users)
          .set({ level: 'basic', updatedAt: new Date() })
          .where(eq(schema.users.id, subscription.userId));

        await this.notificationService.sendMembershipNotification(
          subscription.userId,
          'expired',
          { subscriptionId: subscription.id },
        );

        this.logger.log(`订阅 ${subscription.id} 已过期，用户等级降为 basic`);
      } catch (error) {
        this.logger.error(`处理过期订阅 ${subscription.id} 失败:`, error);
      }
    }

    this.logger.log(`共处理 ${expiredSubscriptions.length} 个过期订阅`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async sendExpiryReminders() {
    this.logger.log('开始发送到期提醒...');
    const now = new Date();

    const reminderDays = [7, 3, 1];

    for (const days of reminderDays) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);

      const startOfTargetDay = new Date(targetDate);
      startOfTargetDay.setHours(0, 0, 0, 0);

      const endOfTargetDay = new Date(targetDate);
      endOfTargetDay.setHours(23, 59, 59, 999);

      const subscriptions = await this.db
        .select()
        .from(schema.subscriptions)
        .where(
          and(
            eq(schema.subscriptions.status, 'active'),
            gte(schema.subscriptions.endDate, startOfTargetDay),
            lt(schema.subscriptions.endDate, endOfTargetDay),
          ),
        );

      for (const subscription of subscriptions) {
        try {
          await this.notificationService.sendMembershipNotification(
            subscription.userId,
            'expiring_soon',
            {
              daysLeft: days,
              subscriptionId: subscription.id,
            },
          );

          this.logger.log(
            `已发送到期提醒给用户 ${subscription.userId}，剩余 ${days} 天`,
          );
        } catch (error) {
          this.logger.error(
            `发送到期提醒给用户 ${subscription.userId} 失败:`,
            error,
          );
        }
      }

      this.logger.log(`发送 ${days} 天到期提醒 ${subscriptions.length} 条`);
    }
  }

  @Cron('0 */3 * * *')
  async processAutoRenew() {
    this.logger.log('开始检查自动续费...');
    const now = new Date();
    const renewThreshold = new Date(now);
    renewThreshold.setDate(renewThreshold.getDate() + 7);

    const subscriptionsToRenew = await this.db
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.status, 'active'),
          eq(schema.subscriptions.autoRenew, true),
          lt(schema.subscriptions.endDate, renewThreshold),
        ),
      );

    for (const subscription of subscriptionsToRenew) {
      try {
        const [plan] = await this.db
          .select()
          .from(schema.membershipPlans)
          .where(eq(schema.membershipPlans.planCode, subscription.plan))
          .limit(1);

        if (!plan) {
          this.logger.warn(`找不到套餐 ${subscription.plan}`);
          continue;
        }

        const newEndDate = new Date(subscription.endDate);
        newEndDate.setMonth(newEndDate.getMonth() + plan.durationMonths);

        await this.db
          .update(schema.subscriptions)
          .set({
            endDate: newEndDate,
            updatedAt: new Date(),
          })
          .where(eq(schema.subscriptions.id, subscription.id));

        await this.notificationService.sendMembershipNotification(
          subscription.userId,
          'renewed',
          {
            endDate: newEndDate,
            planName: plan.name,
            subscriptionId: subscription.id,
          },
        );

        this.logger.log(`自动续费成功：订阅 ${subscription.id}`);
      } catch (error) {
        this.logger.error(`自动续费失败：订阅 ${subscription.id}`, error);

        await this.db
          .update(schema.subscriptions)
          .set({ autoRenew: false, updatedAt: new Date() })
          .where(eq(schema.subscriptions.id, subscription.id));

        await this.notificationService.sendMembershipNotification(
          subscription.userId,
          'renew_failed',
          { subscriptionId: subscription.id },
        );
      }
    }

    this.logger.log(`处理自动续费 ${subscriptionsToRenew.length} 条`);
  }
}
