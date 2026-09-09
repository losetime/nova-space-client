import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
    // 发件人必须与SMTP登录用户一致（邮件服务商限制）
    this.fromEmail =
      this.configService.get<string>('app.email.user') ||
      'noreply@nova-space.com';
  }

  private initializeTransporter() {
    const host = this.configService.get<string>('app.email.host');
    const port = this.configService.get<number>('app.email.port');
    const user = this.configService.get<string>('app.email.user');
    const pass = this.configService.get<string>('app.email.pass');

    if (!host || !user || !pass) {
      this.logger.warn(
        'Email configuration not complete. Email sending will be disabled.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: port || 587,
      secure: (port || 587) === 465,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
    });
  }

  async sendRegisterCode(email: string, code: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(
        'Email transporter not configured. Skipping email send.',
      );
      return false;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; padding: 30px; border-radius: 12px;">
        <h1 style="color: #00d4ff; text-align: center; margin-bottom: 30px;">星揽 账号注册</h1>
        <p style="color: #ccc; font-size: 14px; text-align: center;">您正在注册星揽账号，本次验证码为：</p>
        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <span style="color: #00d4ff; font-size: 32px; font-weight: bold; letter-spacing: 8px;">${code}</span>
        </div>
        <p style="color: #aaa; font-size: 13px; text-align: center;">验证码 5 分钟内有效，请尽快完成注册。</p>
        <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
          此邮件由 星揽 自动发送，请勿直接回复。<br>
          如果这不是您本人的操作，请忽略此邮件。
        </p>
      </div>
    `;

    const text = `星揽 账号注册\n\n您正在注册星揽账号，本次验证码为：${code}\n\n验证码 5 分钟内有效，请尽快完成注册。\n\n如果这不是您本人的操作，请忽略此邮件。`;

    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: '星揽 注册验证码',
        html,
        text,
      });
      this.logger.log(`Register code sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send register code to ${email}`, error);
      return false;
    }
  }

  async sendResetCode(email: string, code: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(
        'Email transporter not configured. Skipping email send.',
      );
      return false;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; padding: 30px; border-radius: 12px;">
        <h1 style="color: #00d4ff; text-align: center; margin-bottom: 30px;">星揽 密码重置</h1>
        <p style="color: #ccc; font-size: 14px; text-align: center;">您正在重置密码，本次验证码为：</p>
        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <span style="color: #00d4ff; font-size: 32px; font-weight: bold; letter-spacing: 8px;">${code}</span>
        </div>
        <p style="color: #aaa; font-size: 13px; text-align: center;">验证码 5 分钟内有效，请尽快完成重置。</p>
        <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
          此邮件由 星揽 自动发送，请勿直接回复。<br>
          如果这不是您本人的操作，请忽略此邮件。
        </p>
      </div>
    `;

    const text = `星揽 密码重置\n\n您正在重置密码，本次验证码为：${code}\n\n验证码 5 分钟内有效，请尽快完成重置。\n\n如果这不是您本人的操作，请忽略此邮件。`;

    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: '星揽 密码重置验证码',
        html,
        text,
      });
      this.logger.log(`Reset code sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send reset code to ${email}`, error);
      return false;
    }
  }
}
