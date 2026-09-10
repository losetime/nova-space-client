import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Inject,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { PointsService } from '../points/points.service';
import { UploadService } from '../upload/upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user.enum';
import { UpdateUserDto, ChangePasswordDto, AdminUpdateUserDto } from './dto';
import type { RequestWithUser } from '../../common/interfaces';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    @Inject(PointsService) private readonly pointsService: PointsService,
    private readonly uploadService: UploadService,
  ) {}

  // 获取当前用户信息
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Request() req: RequestWithUser) {
    const user = await this.userService.findByIdWithSubscription(req.user.id);
    if (!user) {
      return { code: 404, message: '用户不存在' };
    }
    const todayCheckedIn = await this.pointsService.isCheckedInToday(
      req.user.id,
    );
    const { password: _password, ...result } = user;
    return { code: 0, data: { ...result, todayCheckedIn } };
  }

  // 更新当前用户信息
  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateCurrentUser(
    @Request() req: RequestWithUser,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.userService.update(req.user.id, updateUserDto);
    const { password: _password, ...result } = user;
    return { code: 0, data: result, message: '更新成功' };
  }

  // 修改密码
  @Put('me/password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request() req: RequestWithUser,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.userService.changePassword(req.user.id, changePasswordDto);
    return { code: 0, message: '密码修改成功' };
  }

  // 上传头像
  @Put('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Request() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('请上传图片文件');
    }
    const { url } = await this.uploadService.uploadImage(file, 'avatars');
    await this.userService.update(req.user.id, { avatar: url });
    return { code: 0, data: { url }, message: '头像更新成功' };
  }

  // 管理员：获取用户列表
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    const result = await this.userService.findAll(+page, +limit);
    return { code: 0, data: result };
  }

  // 管理员：更新用户
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async adminUpdate(
    @Param('id') id: string,
    @Body() adminUpdateDto: AdminUpdateUserDto,
  ) {
    const user = await this.userService.adminUpdate(id, adminUpdateDto);
    const { password: _password, ...result } = user;
    return { code: 0, data: result, message: '更新成功' };
  }

  // 管理员：删除用户
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async delete(@Param('id') id: string) {
    await this.userService.delete(id);
    return { code: 0, message: '删除成功' };
  }
}
