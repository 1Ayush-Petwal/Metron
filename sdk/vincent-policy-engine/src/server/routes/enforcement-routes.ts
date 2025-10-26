import { Router, Request, Response } from 'express';
import { EnforcementEngine } from '../../core/enforcement-engine';
import { AuditLogger } from '../../core/audit-logger';
import { 
  CheckSpendingRequest,
  ProcessPaymentRequest,
  ApiResponse,
  CheckSpendingResponse,
  ProcessPaymentResponse
} from '../../types';
import { AuthenticatedRequest } from '../middleware/auth-middleware';

export interface EnforcementRoutesConfig {
  enforcementEngine: EnforcementEngine;
  auditLogger: AuditLogger;
}

export function createEnforcementRoutes(config: EnforcementRoutesConfig): Router {
  const router = Router();
  const { enforcementEngine, auditLogger } = config;

  // Check spending limits
  router.post('/spending/check', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const request = CheckSpendingRequest.parse(req.body);
      const userId = req.userId!;
      const agentId = req.agentId;

      const result = await enforcementEngine.checkSpending({
        ...request,
        userId,
        agentId,
      });

      const response: CheckSpendingResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check spending',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(400).json(response);
    }
  });

  // Process payment request
  router.post('/payment/process', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const request = ProcessPaymentRequest.parse(req.body);
      const userId = req.userId!;
      const agentId = req.agentId;

      const result = await enforcementEngine.processPaymentRequest({
        requestId: req.headers['x-request-id'] as string || 'unknown',
        userId,
        agentId,
        endpoint: req.body.endpoint || req.headers['x-endpoint'] as string || '/unknown',
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: req.body,
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        network: request.network,
        amount: request.amount,
        currency: request.currency,
        transactionHash: request.transactionHash,
      });

      const response: ProcessPaymentResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process payment',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(400).json(response);
    }
  });

  // Check rate limits
  router.post('/rate-limit/check', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { endpoint } = req.body;
      const userId = req.userId!;
      const agentId = req.agentId;

      const result = await enforcementEngine.checkRateLimit({
        userId,
        agentId,
        endpoint: endpoint || req.headers['x-endpoint'] as string || '/unknown',
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check rate limits',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(400).json(response);
    }
  });

  // Check access control
  router.post('/access-control/check', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { endpoint, method } = req.body;
      const userId = req.userId!;
      const agentId = req.agentId;

      const result = await enforcementEngine.checkAccessControl({
        userId,
        agentId,
        endpoint: endpoint || req.headers['x-endpoint'] as string || '/unknown',
        method: method || req.method,
        headers: req.headers as Record<string, string>,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check access control',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(400).json(response);
    }
  });

  // Check time-based restrictions
  router.post('/time-based/check', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { timezone } = req.body;
      const userId = req.userId!;
      const agentId = req.agentId;

      const result = await enforcementEngine.checkTimeBased({
        userId,
        agentId,
        timestamp: new Date().toISOString(),
        timezone: timezone || 'UTC',
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check time-based restrictions',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(400).json(response);
    }
  });

  // Get enforcement statistics
  router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const cacheStats = enforcementEngine.getCacheStats();

      const response: ApiResponse = {
        success: true,
        data: {
          cache: cacheStats,
          enforcement: {
            enabled: true,
            strictMode: false,
            requireDelegation: true,
          },
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get enforcement statistics',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(500).json(response);
    }
  });

  // Clear enforcement cache
  router.post('/cache/clear', async (req: AuthenticatedRequest, res: Response) => {
    try {
      enforcementEngine.clearCache();

      const response: ApiResponse = {
        success: true,
        message: 'Enforcement cache cleared',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear enforcement cache',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(500).json(response);
    }
  });

  return router;
}
