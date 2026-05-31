import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { url: string };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockRequest = { url: '/test' };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ArgumentsHost;
  });

  beforeAll(() => {
    Logger.overrideLogger(false); // disable all logging
  });

  it('returns 500 for non-HttpException errors', () => {
    filter.catch(new Error('unexpected'), mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      path: '/test',
      timestamp: expect.any(String),
      message: 'Ha ocurrido un error inesperado.',
      error: undefined,
    });
  });

  it('logs non-HttpException errors', () => {
    const errorSpy = jest.spyOn((filter as any).logger, 'error');
    const error = new Error('something broke');

    filter.catch(error, mockHost);

    expect(errorSpy).toHaveBeenCalledWith(error);
  });

  it('does not log HttpException errors', () => {
    const errorSpy = jest.spyOn((filter as any).logger, 'error');

    filter.catch(new BadRequestException('bad input'), mockHost);

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('uses HttpException status code', () => {
    filter.catch(new BadRequestException('bad input'), mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
  });

  it('extracts string message from HttpException', () => {
    filter.catch(new BadRequestException('bad input'), mockHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'bad input' }),
    );
  });

  it('extracts message and error from object response', () => {
    filter.catch(
      new HttpException(
        { message: ['field is required'], error: 'ValidationError' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
      mockHost,
    );

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 422,
        message: ['field is required'],
        error: 'ValidationError',
      }),
    );
  });

  it('extracts array message from object response', () => {
    filter.catch(
      new BadRequestException(['email is invalid', 'password too short']),
      mockHost,
    );

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: ['email is invalid', 'password too short'],
      }),
    );
  });

  it('falls back to default message when no message in response', () => {
    filter.catch(
      new HttpException({ statusCode: 400 }, 400),
      mockHost,
    );

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Ha ocurrido un error inesperado.',
      }),
    );
  });
});
