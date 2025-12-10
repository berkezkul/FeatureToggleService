import { Response } from 'express';
import { ApiResponse } from '../types';
import { AppError } from './errors';

export const sendSuccess = <T>(res: Response, data: T, statusCode: number = 200): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  res.status(statusCode).json(response);
};

export const sendError = (res: Response, error: AppError | Error): void => {
  if (error instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: (error as any).details,
      },
    };
    res.status(error.statusCode).json(response);
  } else {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An unexpected error occurred',
      },
    };
    res.status(500).json(response);
  }
};

