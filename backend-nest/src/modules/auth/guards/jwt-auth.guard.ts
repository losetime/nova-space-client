import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const result = super.canActivate(context);
    if (result instanceof Promise) {
      return result
        .then((res) => {
          if (isPublic) return true;
          return res;
        })
        .catch(() => {
          return isPublic ? true : false;
        });
    }
    if (isPublic) return true;
    return result;
  }

  handleRequest<TUser = unknown>(
    err: any,
    user: TUser,
    _info: any,
    _context: ExecutionContext,
    _status?: any,
  ): TUser | null {
    if (err || !user) {
      return null;
    }
    return user;
  }
}
