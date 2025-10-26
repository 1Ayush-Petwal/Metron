import { Router, Request, Response } from 'express';
import { HederaRegistry } from '../../core/hedera-registry';
import { AuditLogger } from '../../core/audit-logger';
import { 
  ApiResponse,
  HealthCheckResponse
} from '../../types';

export interface HealthRoutesConfig {
  hederaRegistry: HederaRegistry;
  auditLogger: AuditLogger;
}

export function createHealthRoutes(config: HealthRoutesConfig): Router {
  const router = Router();
  const { hederaRegistry, auditLogger } = config;

  // Basic health check
  router.get('/', async (req: Request, res: Response) => {
    try {
      const hederaHealthy = await hederaRegistry.isHealthy();
      const auditHealthy = true; // Audit logger is always healthy

      const overallStatus = hederaHealthy && auditHealthy ? 'healthy' : 'degraded';

      const response: HealthCheckResponse = {
        success: true,
        data: {
          status: overallStatus,
          version: '1.0.0',
          uptime: process.uptime(),
          services: {
            hedera: {
              status: hederaHealthy ? 'up' : 'down',
              lastCheck: new Date().toISOString(),
            },
            audit: {
              status: 'up',
              lastCheck: new Date().toISOString(),
            },
          },
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(500).json(response);
    }
  });

  // Detailed health check
  router.get('/detailed', async (req: Request, res: Response) => {
    try {
      const hederaHealthy = await hederaRegistry.isHealthy();
      const auditHealthy = true;
      const auditEventCount = auditLogger.getEventCount();

      const overallStatus = hederaHealthy && auditHealthy ? 'healthy' : 'degraded';

      const response: HealthCheckResponse = {
        success: true,
        data: {
          status: overallStatus,
          version: '1.0.0',
          uptime: process.uptime(),
          services: {
            hedera: {
              status: hederaHealthy ? 'up' : 'down',
              lastCheck: new Date().toISOString(),
              details: {
                network: hederaRegistry.getNetworkInfo().network,
                mirrorNodeUrl: hederaRegistry.getNetworkInfo().mirrorNodeUrl,
                consensusNodeUrl: hederaRegistry.getNetworkInfo().consensusNodeUrl,
              },
            },
            audit: {
              status: 'up',
              lastCheck: new Date().toISOString(),
              details: {
                eventCount: auditEventCount,
                logLevel: 'info',
                hederaLogging: true,
                consoleLogging: true,
              },
            },
          },
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Detailed health check failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(500).json(response);
    }
  });

  // Readiness check
  router.get('/ready', async (req: Request, res: Response) => {
    try {
      const hederaHealthy = await hederaRegistry.isHealthy();
      const auditHealthy = true;

      if (hederaHealthy && auditHealthy) {
        const response: ApiResponse = {
          success: true,
          message: 'Service is ready',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };

        res.json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          error: 'Service not ready',
          message: 'One or more services are not healthy',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };

        res.status(503).json(response);
      }
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Readiness check failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(500).json(response);
    }
  });

  // Liveness check
  router.get('/live', async (req: Request, res: Response) => {
    try {
      const response: ApiResponse = {
        success: true,
        message: 'Service is alive',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Liveness check failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(500).json(response);
    }
  });

  return router;
}
