import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SsrfError } from '../../security/ssrf.service';

/** Uniform JSON error envelope; maps SSRF rejections to 400. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';

    if (exception instanceof SsrfError) {
      status = HttpStatus.BAD_REQUEST;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      message =
        typeof r === 'string' ? r : ((r as { message: unknown }).message ?? r);
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${status}: ${String(message)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    res.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
