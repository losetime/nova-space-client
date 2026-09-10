import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { DRIZZLE } from '../../db/drizzle.module';
import type { DrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { eq, and, desc, lt, sql, asc } from 'drizzle-orm';
import { CreateSubscriptionDto } from './dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class SubscriptionService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private notificationService: NotificationService,
  ) {}

  async getPlans() {
    const plans = await this.db
      .select()
      .from(schema.membershipPlans)
      .where(eq(schema.membershipPlans.isActive, true))
      .orderBy(asc(schema.membershipPlans.sortOrder));

    const levels = await this.db
      .select()
      .from(schema.memberLevels)
      .orderBy(asc(schema.memberLevels.sortOrder));

    const levelBenefitsData = await this.db
      .select({
        levelId: schema.levelBenefits.levelId,
        levelCode: schema.memberLevels.code,
        benefitId: schema.benefits.id,
        benefitName: schema.benefits.name,
        benefitDescription: schema.benefits.description,
        benefitValueType: schema.benefits.valueType,
        benefitUnit: schema.benefits.unit,
        benefitValue: schema.levelBenefits.value,
        benefitDisplayText: schema.levelBenefits.displayText,
      })
      .from(schema.levelBenefits)
      .innerJoin(
        schema.benefits,
        eq(schema.levelBenefits.benefitId, schema.benefits.id),
      )
      .innerJoin(
        schema.memberLevels,
        eq(schema.levelBenefits.levelId, schema.memberLevels.id),
      );

    const benefitsByLevel: Record<string, any[]> = {};
    for (const lb of levelBenefitsData) {
      if (!benefitsByLevel[lb.levelCode]) {
        benefitsByLevel[lb.levelCode] = [];
      }
      benefitsByLevel[lb.levelCode].push({
        id: lb.benefitId,
        name: lb.benefitName,
        description: lb.benefitDescription,
        valueType: lb.benefitValueType,
        unit: lb.benefitUnit,
        value: lb.benefitValue,
        displayText: lb.benefitDisplayText,
      });
    }

    const plansByLevel: Record<string, any[]> = {};
    for (const plan of plans) {
      if (!plansByLevel[plan.level]) {
        plansByLevel[plan.level] = [];
      }
      plansByLevel[plan.level].push(plan);
    }

    const levelInfoByCode: Record<string, any> = {};
    for (const level of levels) {
      levelInfoByCode[level.code] = {
        id: level.id,
        code: level.code,
        name: level.name,
        icon: level.icon,
      };
    }

    return levels.map((level) => ({
      level: level.code,
      levelName: level.name,
      icon: level.icon,
      benefits: benefitsByLevel[level.code] || [],
      plans: plansByLevel[level.code] || [],
    }));
  }

  async getMembershipStatus(userId: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const subscription = await this.getCurrentSubscription(userId);

    const [levelInfo] = await this.db
      .select()
      .from(schema.memberLevels)
      .where(eq(schema.memberLevels.code, user.level));

    const benefits = await this.db
      .select({
        id: schema.benefits.id,
        name: schema.benefits.name,
        description: schema.benefits.description,
        valueType: schema.benefits.valueType,
        unit: schema.benefits.unit,
        value: schema.levelBenefits.value,
        displayText: schema.levelBenefits.displayText,
      })
      .from(schema.levelBenefits)
      .innerJoin(
        schema.benefits,
        eq(schema.levelBenefits.benefitId, schema.benefits.id),
      )
      .innerJoin(
        schema.memberLevels,
        eq(schema.levelBenefits.levelId, schema.memberLevels.id),
      )
      .where(eq(schema.memberLevels.code, user.level));

    return {
      level: user.level,
      points: user.points,
      totalPoints: user.totalPoints,
      levelInfo: levelInfo
        ? {
            id: levelInfo.id,
            code: levelInfo.code,
            name: levelInfo.name,
            icon: levelInfo.icon,
          }
        : null,
      subscription: subscription
        ? {
            id: subscription.id,
            plan: subscription.plan,
            status: subscription.status,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            autoRenew: subscription.autoRenew,
            daysLeft: Math.max(
              0,
              Math.ceil(
                (new Date(subscription.endDate).getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24),
              ),
            ),
          }
        : null,
      benefits,
    };
  }

  async create(
    userId: string,
    createDto: CreateSubscriptionDto,
  ): Promise<schema.Subscription> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const [existingSubscription] = await this.db
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.userId, userId),
          eq(schema.subscriptions.status, 'active'),
        ),
      );

    if (existingSubscription) {
      throw new BadRequestException('已有有效订阅');
    }

    const [subscription] = await this.db
      .insert(schema.subscriptions)
      .values({
        userId,
        status: 'active',
        plan: createDto.plan,
        price: String(createDto.price),
        startDate: new Date(createDto.startDate),
        endDate: new Date(createDto.endDate),
        paymentMethod: createDto.paymentMethod,
        paymentId: createDto.paymentId,
        autoRenew: createDto.autoRenew ?? false,
      })
      .returning();

    const levelMap: Record<string, 'basic' | 'advanced' | 'professional'> = {
      monthly: 'advanced',
      quarterly: 'advanced',
      yearly: 'advanced',
      lifetime: 'professional',
      custom: 'professional',
    };

    const newLevel = levelMap[createDto.plan] || 'advanced';

    await this.db
      .update(schema.users)
      .set({ level: newLevel })
      .where(eq(schema.users.id, userId));

    await this.notificationService.sendMembershipNotification(
      userId,
      'activated',
      {
        planName: createDto.plan,
        endDate: subscription.endDate,
        subscriptionId: subscription.id,
      },
    );

    return subscription;
  }

  async getCurrentSubscription(
    userId: string,
  ): Promise<schema.Subscription | null> {
    const [subscription] = await this.db
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.userId, userId),
          eq(schema.subscriptions.status, 'active'),
        ),
      )
      .orderBy(desc(schema.subscriptions.endDate));
    return subscription || null;
  }

  async getSubscriptionHistory(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ subscriptions: schema.Subscription[]; total: number }> {
    const offset = (page - 1) * limit;

    const subscriptions = await this.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .orderBy(desc(schema.subscriptions.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId));

    return { subscriptions, total: count };
  }

  async cancel(
    userId: string,
    cancelReason?: string,
  ): Promise<schema.Subscription> {
    const subscription = await this.getCurrentSubscription(userId);
    if (!subscription) {
      throw new NotFoundException('没有有效订阅');
    }

    const [updated] = await this.db
      .update(schema.subscriptions)
      .set({
        autoRenew: false,
        cancelledAt: new Date(),
        cancelReason: cancelReason || '',
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptions.id, subscription.id))
      .returning();

    return updated;
  }

  async checkExpiredSubscriptions(): Promise<void> {
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
      await this.db
        .update(schema.subscriptions)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(schema.subscriptions.id, subscription.id));

      await this.db
        .update(schema.users)
        .set({ level: 'basic' })
        .where(eq(schema.users.id, subscription.userId));

      await this.notificationService.sendMembershipNotification(
        subscription.userId,
        'expired',
        { subscriptionId: subscription.id },
      );
    }
  }

  async renew(
    userId: string,
    createDto: CreateSubscriptionDto,
  ): Promise<schema.Subscription> {
    const currentSubscription = await this.getCurrentSubscription(userId);

    if (currentSubscription) {
      const newEndDate = new Date(currentSubscription.endDate);

      switch (createDto.plan) {
        case 'monthly':
          newEndDate.setMonth(newEndDate.getMonth() + 1);
          break;
        case 'quarterly':
          newEndDate.setMonth(newEndDate.getMonth() + 3);
          break;
        case 'yearly':
          newEndDate.setFullYear(newEndDate.getFullYear() + 1);
          break;
        case 'lifetime':
          newEndDate.setFullYear(newEndDate.getFullYear() + 100);
          break;
      }

      const [updated] = await this.db
        .update(schema.subscriptions)
        .set({
          endDate: newEndDate,
          plan: createDto.plan,
          price: String(
            parseFloat(currentSubscription.price) + createDto.price,
          ),
          updatedAt: new Date(),
        })
        .where(eq(schema.subscriptions.id, currentSubscription.id))
        .returning();

      await this.notificationService.sendMembershipNotification(
        userId,
        'renewed',
        {
          endDate: newEndDate,
          subscriptionId: updated.id,
        },
      );

      return updated;
    }

    return this.create(userId, createDto);
  }
}
