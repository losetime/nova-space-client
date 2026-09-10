import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { UploadModule } from './modules/upload/upload.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { PointsModule } from './modules/points/points.module';
import { SatelliteModule } from './modules/satellite/satellite.module';
import { AllExceptionsFilter } from './common/filters';
import { TransformInterceptor } from './common/interceptors';
import { EducationModule } from './modules/education/education.module';
import { IntelligenceModule } from './modules/intelligence/intelligence.module';
import { NotificationModule } from './modules/notification/notification.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { SpaceWeatherModule } from './modules/space-weather/space-weather.module';
import { PushModule } from './modules/push/push.module';
import { MilestoneModule } from './modules/milestone/milestone.module';
import { CompanyModule } from './modules/company/company.module';
import { MembershipSchedulerModule } from './modules/membership-scheduler/membership-scheduler.module';
import { MembershipModule } from './modules/membership/membership.module';
import { DrizzleModule } from './db/drizzle.module';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    ScheduleModule.forRoot(),
    DrizzleModule,
    UserModule,
    AuthModule,
    UploadModule,
    SubscriptionModule,
    PointsModule,
    SatelliteModule,
    EducationModule,
    IntelligenceModule,
    NotificationModule,
    FeedbackModule,
    SpaceWeatherModule,
    PushModule,
    MilestoneModule,
    CompanyModule,
    MembershipSchedulerModule,
    MembershipModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
