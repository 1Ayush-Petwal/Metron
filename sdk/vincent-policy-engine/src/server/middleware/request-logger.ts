import { Request, Response, NextFunction } from 'express';
// Note: In a real implementation, you would install and import uuid
// import { v4 as uuidv4 } from 'uuid';

// Mock UUID function for now
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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
