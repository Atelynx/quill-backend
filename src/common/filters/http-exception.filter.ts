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

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Ha ocurrido un error inesperado.';
    let errorLabel: string | undefined;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse) {
        const responseMessage =
          'message' in exceptionResponse
            ? exceptionResponse.message
            : undefined;
        const responseError =
          'error' in exceptionResponse ? exceptionResponse.error : undefined;

        if (
          typeof responseMessage === 'string' ||
          Array.isArray(responseMessage)
        ) {
          message = responseMessage;
        }

        if (typeof responseError === 'string') {
          errorLabel = responseError;
        }
      }
    }

    if (!(exception instanceof HttpException)) {
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
}
