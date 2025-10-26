import { Router, Request, Response } from 'express';
import { AuditLogger } from '../../core/audit-logger';
import { 
  AuditQuery,
  ApiResponse,
  GetAuditEventsResponse,
  GetAuditSummaryResponse
} from '../../types';
import { AuthenticatedRequest } from '../middleware/auth-middleware';

export interface AuditRoutesConfig {
  auditLogger: AuditLogger;
}

export function createAuditRoutes(config: AuditRoutesConfig): Router {
  const router = Router();
  const { auditLogger } = config;

  // Get audit events
  router.get('/events', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const query: AuditQuery = {
        userId: req.query.userId as string,
        agentId: req.query.agentId as string,
        type: req.query.type as any,
        severity: req.query.severity as any,
        startTime: req.query.startTime as string,
        endTime: req.query.endTime as string,
        limit: parseInt(req.query.limit as string) || 100,
        offset: parseInt(req.query.offset as string) || 0,
        sortBy: (req.query.sortBy as 'timestamp' | 'severity' | 'type') || 'timestamp',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const result = await auditLogger.queryEvents(query);

      const response: GetAuditEventsResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get audit events',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(500).json(response);
    }
  });

  // Get audit summary
  router.get('/summary', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const startTime = req.query.startTime as string;
      const endTime = req.query.endTime as string;

      if (!startTime || !endTime) {
        const response: ApiResponse = {
          success: false,
          error: 'Missing time range',
          message: 'startTime and endTime query parameters are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };

        res.status(400).json(response);
        return;
      }

      const summary = await auditLogger.getAuditSummary(startTime, endTime);

      const response: GetAuditSummaryResponse = {
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get audit summary',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(500).json(response);
    }
  });

  // Get audit statistics
  router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const eventCount = auditLogger.getEventCount();

      const response: ApiResponse = {
        success: true,
        data: {
          totalEvents: eventCount,
          logLevel: 'info',
          hederaLogging: true,
          consoleLogging: true,
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get audit statistics',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(500).json(response);
    }
  });

  // Clear audit events (for testing)
  router.post('/clear', async (req: AuthenticatedRequest, res: Response) => {
    try {
      auditLogger.clearEvents();

      const response: ApiResponse = {
        success: true,
        message: 'Audit events cleared',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear audit events',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(500).json(response);
    }
  });

  return router;
}
