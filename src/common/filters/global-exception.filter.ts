import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApplicationError } from '../errors/application-error';
import { ZodError } from 'zod';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'Internal server error';
    let code: string = 'INTERNAL_SERVER_ERROR';
    let details: unknown = undefined;

    if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Validation failed';
      code = 'VALIDATION_ERROR';
      details = exception.issues;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();
      message = typeof responseBody === 'string' ? responseBody : exception.message;
    } else if (exception instanceof ApplicationError) {
      status = exception.statusCode;
      message = exception.message;
      code = exception.code || code;
      details = exception.details;
    }

    const errorResponse = {
      statusCode: status,
      message,
      code,
      details,
      path: request.url,
    };

    // Only log non-validation errors at error level
    const logLevel = exception instanceof ZodError ? 'warn' : 'error';
    this.logger[logLevel](`${request.method} ${request.url}`, errorResponse);

    response.status(status).json(errorResponse);
  }
}
