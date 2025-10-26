import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Generate request ID if not present
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = uuidv4();
  }

  const requestId = req.headers['x-request-id'] as string;
  const startTime = Date.now();

  // Log request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${requestId}`);

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${statusCode} - ${duration}ms - ${requestId}`);
    
    // Call original end
    originalEnd.call(this, chunk, encoding);
  };

  next();
}
