import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiResponse, ErrorResponse } from '../../types';

export interface ErrorWithCode extends Error {
  code?: string;
  statusCode?: number;
}

export function errorHandler(
  error: ErrorWithCode,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string || 'unknown';
  const timestamp = new Date().toISOString();

  // Log error
  console.error(`[${timestamp}] Error ${requestId}:`, error);

  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'Internal server error';
  let details: any = undefined;

  // Handle different error types
  if (error instanceof ZodError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation error';
    details = {
      issues: error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
    };
  } else if (error.statusCode) {
    statusCode = error.statusCode;
    errorCode = error.code || 'HTTP_ERROR';
    message = error.message;
  } else if (error.code) {
    errorCode = error.code;
    message = error.message;
  }

  // Create error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: message,
    code: errorCode,
    details,
    timestamp,
    requestId,
  };

  // Send error response
  res.status(statusCode).json(errorResponse);
}

export function notFoundHandler(req: Request, res: Response): void {
  const requestId = req.headers['x-request-id'] as string || 'unknown';
  const timestamp = new Date().toISOString();

  const errorResponse: ErrorResponse = {
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
    details: {
      method: req.method,
      url: req.originalUrl,
    },
    timestamp,
    requestId,
  };

  res.status(404).json(errorResponse);
}
