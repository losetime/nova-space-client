import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SendRegisterCodeDto,
} from '../user/dto';
import type { RequestWithUser } from '../../common/interfaces';
import type { schema } from '../../db';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
  ) {}

  private omitPassword(user: schema.User): Omit<schema.User, 'password'> {
    const { password: _, ...rest } = user;
    return rest;
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const { user, token } = await this.authService.register(registerDto);
    return {
      code: 0,
      data: {
        user: this.omitPassword(user),
        token,
      },
      message: '注册成功',
    };
  }

  @Post('send-register-code')
  async sendRegisterCode(@Body() sendRegisterCodeDto: SendRegisterCodeDto) {
    const { email } = sendRegisterCodeDto;

    const existingUser = await this.authService.findByEmail(email);
    if (existingUser) {
      throw new BadRequestException('该邮箱已被注册');
    }

    const existingCode = await this.authService.getValidRegisterCode(email);
    if (existingCode) {
      return {
        code: 0,
        data: null,
        message: '验证码已发送，请稍后再试',
      };
    }

    const code = await this.authService.generateRegisterCode(email);
    // 异步发送，避免阻塞响应（SMTP 网络波动不影响主流程）
    void this.emailService.sendRegisterCode(email, code);

    return {
      code: 0,
      data: null,
      message: '验证码已发送，请查收邮箱',
    };
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const { user, token } = await this.authService.login(loginDto);
    return {
      code: 0,
      data: {
        user: this.omitPassword(user),
        token,
      },
      message: '登录成功',
    };
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  async refreshToken(@Request() req: RequestWithUser) {
    const token = await this.authService.refreshToken(req.user.id);
    return {
      code: 0,
      data: { token },
      message: 'Token 刷新成功',
    };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const user = await this.authService.findByEmail(forgotPasswordDto.email);
    if (user && user.resetPasswordCode && user.resetPasswordExpiry) {
      const remaining = user.resetPasswordExpiry.getTime() - Date.now();
      if (remaining > 4 * 60 * 1000) {
        return {
          code: 0,
          data: null,
          message: '验证码已发送，请稍后再试',
        };
      }
    }

    const code = await this.authService.generateResetCode(
      forgotPasswordDto.email,
    );
    if (code) {
      // 异步发送，避免阻塞响应（SMTP 网络波动不影响主流程）
      void this.emailService.sendResetCode(forgotPasswordDto.email, code);
    }

    return {
      code: 0,
      data: null,
      message: '如果该邮箱已注册，验证码将发送至对应邮箱',
    };
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const success = await this.authService.resetPassword(
      resetPasswordDto.email,
      resetPasswordDto.code,
      resetPasswordDto.newPassword,
    );

    if (!success) {
      throw new BadRequestException('验证码无效或已过期');
    }

    return {
      code: 0,
      data: null,
      message: '密码重置成功',
    };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: RequestWithUser) {
    const user = await this.authService.validateUserById(req.user.id);
    if (!user) {
      return {
        code: -1,
        data: null,
        message: '用户不存在',
      };
    }
    return {
      code: 0,
      data: this.omitPassword(user),
    };
  }
}
