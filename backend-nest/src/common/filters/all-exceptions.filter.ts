import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

interface ExceptionResponseObject {
  message?: string | string[];
  code?: number;
  error?: string;
}

interface DatabaseError {
  code: string;
  message: string;
  detail?: string;
}

const DATABASE_ERRORS: DatabaseError[] = [
  {
    code: 'ECONNREFUSED',
    message: '数据库连接失败',
  },
  {
    code: 'ETIMEDOUT',
    message: '数据库连接超时',
  },
  {
    code: 'ENOTFOUND',
    message: '数据库地址解析失败',
  },
  {
    code: 'CONNECTION_POOL_EXHAUSTED',
    message: '服务繁忙，请稍后重试',
  },
  {
    code: 'MAX_CONNECTION_REACHED',
    message: '服务繁忙，请稍后重试',
  },
  {
    code: 'QUERY_TIMEOUT',
    message: '查询执行超时',
  },
  {
    code: 'CONNECTION_LOST',
    message: '数据库连接中断',
  },
  {
    code: 'CANT_PERSIST_FRAME',
    message: '数据库写入失败',
  },
  {
    code: 'STARTUP_PACKET_RECEIVED',
    message: '数据库认证失败',
  },
  {
    code: 'ENCODE',
    message: '数据编码错误',
  },
];

function detectDatabaseError(exception: unknown): DatabaseError | null {
  if (!(exception instanceof Error)) return null;

  const errorMessage = exception.message || '';
  const errorCode = (exception as Error & { code?: string }).code || '';

  for (const dbError of DATABASE_ERRORS) {
    if (errorMessage.includes(dbError.code) || errorCode === dbError.code) {
      return dbError;
    }
  }

  if (
    errorMessage.includes('connect ECONNREFUSED') ||
    errorMessage.includes('ECONNREFUSED')
  ) {
    return DATABASE_ERRORS[0];
  }
  if (
    errorMessage.includes('connect ETIMEDOUT') ||
    errorMessage.includes('ETIMEDOUT')
  ) {
    return DATABASE_ERRORS[1];
  }
  if (
    errorMessage.includes('connection pool') ||
    errorMessage.includes('pool exhausted') ||
    errorMessage.includes('too many clients')
  ) {
    return DATABASE_ERRORS[4];
  }
  if (
    errorMessage.includes('query timeout') ||
    errorMessage.includes('canceling statement')
  ) {
    return DATABASE_ERRORS[6];
  }
  if (
    errorMessage.includes('Connection terminated') ||
    errorMessage.includes('connection lost')
  ) {
    return DATABASE_ERRORS[7];
  }
  if (
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('fetch failed')
  ) {
    return DATABASE_ERRORS[0];
  }

  return null;
}

function getFriendlyMessage(exception: unknown): {
  message: string;
  detail?: string;
} {
  const dbError = detectDatabaseError(exception);
  if (dbError) {
    return {
      message: dbError.message,
      detail:
        process.env.NODE_ENV !== 'production'
          ? (exception as Error).message
          : undefined,
    };
  }

  if (exception instanceof Error) {
    return {
      message:
        process.env.NODE_ENV !== 'production'
          ? exception.message
          : '服务器内部错误',
      detail:
        process.env.NODE_ENV !== 'production' ? exception.stack : undefined,
    };
  }

  return { message: '服务器内部错误' };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let code = -1;
    let detail: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const res = exceptionResponse as ExceptionResponseObject;
        message = Array.isArray(res.message)
          ? res.message[0]
          : res.message || message;
        code = res.code || -1;
      }
    } else {
      const friendly = getFriendlyMessage(exception);
      message = friendly.message;
      detail = friendly.detail;
    }

    const body: Record<string, any> = {
      code,
      message,
      data: null,
      timestamp: new Date().toISOString(),
    };

    if (detail) {
      body.detail = detail;
    }

    response.status(status).json(body);
  }
}
