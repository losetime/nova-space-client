import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RegisterDto, LoginDto } from '../user/dto';
import * as schema from '../../db/schema';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async register(
    registerDto: RegisterDto,
  ): Promise<{ user: schema.User; token: string }> {
    const user = await this.userService.create(registerDto);
    const token = this.generateToken(user);
    return { user, token };
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ user: schema.User; token: string }> {
    const user = await this.userService.validateUser(
      loginDto.username,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('账号已被禁用');
    }

    const token = this.generateToken(user);
    return { user, token };
  }

  async validateUserById(userId: string): Promise<schema.User | null> {
    return this.userService.findById(userId);
  }

  async generateRegisterCode(email: string): Promise<string> {
    return this.userService.generateRegisterCode(email);
  }

  async getValidRegisterCode(email: string): Promise<string | null> {
    return this.userService.getValidRegisterCode(email);
  }

  async findByEmail(email: string): Promise<schema.User | null> {
    return this.userService.findByEmail(email);
  }

  async generateResetCode(email: string): Promise<string | null> {
    return this.userService.generateResetCode(email);
  }

  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<boolean> {
    return this.userService.resetPassword(email, code, newPassword);
  }

  private generateToken(user: schema.User): string {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      level: user.level,
    };
    return this.jwtService.sign(payload);
  }

  async refreshToken(userId: string): Promise<string> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    return this.generateToken(user);
  }
}
