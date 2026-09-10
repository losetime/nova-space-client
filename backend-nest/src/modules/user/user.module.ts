import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PointsModule } from '../points/points.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [PointsModule, UploadModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
