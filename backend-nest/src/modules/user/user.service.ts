import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { DRIZZLE } from '../../db/drizzle.module';
import type { DrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { eq, or, sql, desc } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { UserRole, UserLevel } from '../../common/enums/user.enum';
import {
  RegisterDto,
  UpdateUserDto,
  ChangePasswordDto,
  AdminUpdateUserDto,
} from './dto';

@Injectable()
export class UserService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  async create(registerDto: RegisterDto): Promise<schema.User> {
    const { username, password, email, phone, nickname, code } = registerDto;

    // 提供邮箱时，必须通过邮箱验证码
    if (email) {
      const verified = await this.verifyRegisterCode(email, code);
      if (!verified) {
        throw new BadRequestException('邮箱验证码无效或已过期');
      }
    }

    // 未提供用户名时，由邮箱前缀自动生成（冲突时追加数字后缀）
    let resolvedUsername = username;
    if (!resolvedUsername) {
      if (!email) {
        throw new BadRequestException('用户名或邮箱不能为空');
      }
      resolvedUsername = await this.generateUsername(email);
    }

    const conditions = [eq(schema.users.username, resolvedUsername)];
    if (email) conditions.push(eq(schema.users.email, email));
    if (phone) conditions.push(eq(schema.users.phone, phone));

    const existingUsers = await this.db
      .select()
      .from(schema.users)
      .where(or(...conditions));

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      if (existingUser.username === resolvedUsername) {
        throw new ConflictException('用户名已存在');
      }
      if (email && existingUser.email === email) {
        throw new ConflictException('邮箱已被注册');
      }
      if (phone && existingUser.phone === phone) {
        throw new ConflictException('手机号已被注册');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [user] = await this.db
      .insert(schema.users)
      .values({
        username: resolvedUsername,
        password: hashedPassword,
        email,
        phone,
        nickname: nickname || resolvedUsername,
        role: UserRole.USER,
        level: UserLevel.BASIC,
        points: 100,
        totalPoints: 100,
      })
      .returning();

    return user;
  }

  private async generateUsername(email: string): Promise<string> {
    const base = (email.split('@')[0] || '').slice(0, 30) || 'user';
    let candidate = base;
    let n = 1;
    for (;;) {
      const [existing] = await this.db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.username, candidate));
      if (!existing) return candidate;
      candidate = `${base}${n++}`;
    }
  }

  async findByUsername(username: string): Promise<schema.User | null> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username));
    return user || null;
  }

  async findByEmail(email: string): Promise<schema.User | null> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email));
    return user || null;
  }

  async getValidRegisterCode(email: string): Promise<string | null> {
    const [record] = await this.db
      .select()
      .from(schema.registrationCodes)
      .where(eq(schema.registrationCodes.email, email));

    if (
      !record ||
      record.usedAt != null ||
      record.expiresAt.getTime() < Date.now() ||
      record.expiresAt.getTime() - Date.now() <= 4 * 60 * 1000
    ) {
      return null;
    }

    return record.code;
  }

  async generateRegisterCode(email: string): Promise<string> {
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('该邮箱已被注册');
    }

    const code = randomInt(0, 1000000).toString().padStart(6, '0');

    const [existingCode] = await this.db
      .select()
      .from(schema.registrationCodes)
      .where(eq(schema.registrationCodes.email, email));

    if (existingCode) {
      await this.db
        .update(schema.registrationCodes)
        .set({
          code,
          attempts: 0,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          usedAt: null,
        })
        .where(eq(schema.registrationCodes.email, email));
    } else {
      await this.db.insert(schema.registrationCodes).values({
        email,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });
    }

    return code;
  }

  async verifyRegisterCode(email: string, code?: string): Promise<boolean> {
    if (!code) {
      return false;
    }

    const [record] = await this.db
      .select()
      .from(schema.registrationCodes)
      .where(eq(schema.registrationCodes.email, email));

    if (
      !record ||
      record.usedAt != null ||
      record.expiresAt.getTime() < Date.now()
    ) {
      return false;
    }
    if (record.attempts >= 5) {
      return false;
    }
    if (record.code !== code) {
      await this.db
        .update(schema.registrationCodes)
        .set({ attempts: record.attempts + 1 })
        .where(eq(schema.registrationCodes.email, email));
      return false;
    }

    await this.db
      .update(schema.registrationCodes)
      .set({ usedAt: new Date() })
      .where(eq(schema.registrationCodes.email, email));

    return true;
  }

  async generateResetCode(email: string): Promise<string | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    const code = randomInt(0, 1000000).toString().padStart(6, '0');
    await this.db
      .update(schema.users)
      .set({
        resetPasswordCode: code,
        resetPasswordAttempts: 0,
        resetPasswordExpiry: new Date(Date.now() + 5 * 60 * 1000),
      })
      .where(eq(schema.users.id, user.id));

    return code;
  }

  async verifyResetCode(
    email: string,
    code: string,
  ): Promise<schema.User | null> {
    const user = await this.findByEmail(email);
    if (!user || !user.resetPasswordCode || !user.resetPasswordExpiry) {
      return null;
    }
    if (user.resetPasswordExpiry.getTime() < Date.now()) {
      return null;
    }
    if (user.resetPasswordAttempts >= 5) {
      return null;
    }
    if (user.resetPasswordCode !== code) {
      await this.db
        .update(schema.users)
        .set({ resetPasswordAttempts: user.resetPasswordAttempts + 1 })
        .where(eq(schema.users.id, user.id));
      return null;
    }
    return user;
  }

  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<boolean> {
    const user = await this.verifyResetCode(email, code);
    if (!user) {
      return false;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.db
      .update(schema.users)
      .set({
        password: hashedPassword,
        resetPasswordCode: null,
        resetPasswordAttempts: 0,
        resetPasswordExpiry: null,
      })
      .where(eq(schema.users.id, user.id));

    return true;
  }

  async findById(id: string): Promise<schema.User | null> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id));
    return user || null;
  }

  async findByIdWithSubscription(
    id: string,
  ): Promise<
    (schema.User & { subscription: schema.Subscription | undefined }) | null
  > {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id));
    if (!user) return null;

    const [subscription] = await this.db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, id));

    return { ...user, subscription };
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<schema.User | null> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email));

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    await this.db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, user.id));

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<schema.User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const [existingEmail] = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, updateUserDto.email));
      if (existingEmail) {
        throw new ConflictException('邮箱已被使用');
      }
    }

    if (updateUserDto.phone && updateUserDto.phone !== user.phone) {
      const [existingPhone] = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.phone, updateUserDto.phone));
      if (existingPhone) {
        throw new ConflictException('手机号已被使用');
      }
    }

    const [updatedUser] = await this.db
      .update(schema.users)
      .set(updateUserDto)
      .where(eq(schema.users.id, id))
      .returning();

    return updatedUser;
  }

  async changePassword(
    id: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id));

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.oldPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new BadRequestException('原密码错误');
    }

    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);
    await this.db
      .update(schema.users)
      .set({ password: hashedPassword })
      .where(eq(schema.users.id, id));
  }

  async findAll(
    page = 1,
    limit = 10,
  ): Promise<{ users: any[]; total: number }> {
    const offset = (page - 1) * limit;

    const users = await this.db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        phone: schema.users.phone,
        nickname: schema.users.nickname,
        avatar: schema.users.avatar,
        role: schema.users.role,
        level: schema.users.level,
        points: schema.users.points,
        isActive: schema.users.isActive,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users);

    return { users, total: count };
  }

  async adminUpdate(
    id: string,
    adminUpdateDto: AdminUpdateUserDto,
  ): Promise<schema.User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const [updatedUser] = await this.db
      .update(schema.users)
      .set(adminUpdateDto)
      .where(eq(schema.users.id, id))
      .returning();

    return updatedUser;
  }

  async delete(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    await this.db.delete(schema.users).where(eq(schema.users.id, id));
  }

  async updatePoints(id: string, points: number): Promise<schema.User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const newPoints = user.points + points;
    const newTotalPoints =
      points > 0 ? user.totalPoints + points : user.totalPoints;

    const [updatedUser] = await this.db
      .update(schema.users)
      .set({
        points: newPoints,
        totalPoints: newTotalPoints,
      })
      .where(eq(schema.users.id, id))
      .returning();

    return updatedUser;
  }
}
