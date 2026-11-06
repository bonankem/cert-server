import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, HttpException, NotFoundException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client.js';

/** Map known Prisma errors to HTTP errors; anything else falls through to Nest's handler. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const mapped = this.toHttp(exception);
    super.catch(mapped ?? exception, host);
  }

  private toHttp(error: Prisma.PrismaClientKnownRequestError): HttpException | null {
    switch (error.code) {
      case 'P2025':
        return new NotFoundException('Record not found.');
      case 'P2002':
        return new ConflictException('A record with these details already exists.');
      default:
        return null;
    }
  }
}
