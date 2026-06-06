import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Ha ocurrido un error inesperado.';
    let errorLabel: string | undefined;

    if (isHttpException) {
      const details = this.getExceptionDetails(exception);
      message = details.message;
      errorLabel = details.errorLabel;
    } else {
      this.logger.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
      error: errorLabel,
    });
  }

  private getExceptionDetails(exception: HttpException): {
    message: string | string[];
    errorLabel?: string;
  } {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return { message: response };
    }

    const defaultMsg = 'Ha ocurrido un error inesperado.';
    if (typeof response === 'object' && response !== null) {
      const msg = (response as Record<string, unknown>).message;
      const err = (response as Record<string, unknown>).error;

      const message =
        typeof msg === 'string' || Array.isArray(msg) ? msg : defaultMsg;
      const errorLabel = typeof err === 'string' ? err : undefined;

      return { message, errorLabel };
    }

    return { message: defaultMsg };
  }
}
