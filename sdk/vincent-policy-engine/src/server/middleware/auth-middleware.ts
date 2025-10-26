import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../types';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  agentId?: string;
  user?: {
    id: string;
    email?: string;
    wallet?: string;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    // Extract user ID from various sources
    const userId = req.headers['x-user-id'] as string || 
                   req.headers['x-user-id'] as string ||
                   req.body?.userId ||
                   req.query?.userId;

    // Extract agent ID if present
    const agentId = req.headers['x-agent-id'] as string ||
                    req.body?.agentId ||
                    req.query?.agentId;

    if (!userId) {
      const errorResponse: ApiResponse = {
        success: false,
        error: 'Authentication required',
        message: 'User ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(401).json(errorResponse);
      return;
    }

    // Set user context
    req.userId = userId;
    req.agentId = agentId;
    req.user = {
      id: userId,
      wallet: req.headers['x-wallet-address'] as string,
    };

    next();
  } catch (error) {
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
    };

    res.status(401).json(errorResponse);
  }
}

export function optionalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    // Extract user ID from various sources (optional)
    const userId = req.headers['x-user-id'] as string || 
                   req.headers['x-user-id'] as string ||
                   req.body?.userId ||
                   req.query?.userId;

    // Extract agent ID if present
    const agentId = req.headers['x-agent-id'] as string ||
                    req.body?.agentId ||
                    req.query?.agentId;

    // Set user context if available
    if (userId) {
      req.userId = userId;
      req.agentId = agentId;
      req.user = {
        id: userId,
        wallet: req.headers['x-wallet-address'] as string,
      };
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
}
