import { Router, Request, Response } from 'express';
import { PolicyManager } from '../../core/policy-manager';
import { AuditLogger } from '../../core/audit-logger';
import { 
  CreatePolicyRequest,
  UpdatePolicyRequest,
  PolicyQuery,
  ApiResponse,
  GetPolicyResponse,
  ListPoliciesResponse
} from '../../types';
import { AuthenticatedRequest } from '../middleware/auth-middleware';

export interface PolicyRoutesConfig {
  policyManager: PolicyManager;
  auditLogger: AuditLogger;
}

export function createPolicyRoutes(config: PolicyRoutesConfig): Router {
  const router = Router();
  const { policyManager, auditLogger } = config;

  // Create policy
  router.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const request = CreatePolicyRequest.parse(req.body);
      const userId = req.userId!;
      const agentId = req.agentId;

      const policy = await policyManager.createPolicy(request, userId, agentId);

      const response: GetPolicyResponse = {
        success: true,
        data: policy,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create policy',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(400).json(response);
    }
  });

  // Get policy by ID
  router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const policy = await policyManager.getPolicy(id);

      if (!policy) {
        const response: ApiResponse = {
          success: false,
          error: 'Policy not found',
          message: `Policy with ID ${id} not found`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };

        res.status(404).json(response);
        return;
      }

      const response: GetPolicyResponse = {
        success: true,
        data: policy,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get policy',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(500).json(response);
    }
  });

  // List policies
  router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const query: PolicyQuery = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
        userId: req.query.userId as string,
        agentId: req.query.agentId as string,
        type: req.query.type as any,
        status: req.query.status as any,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        search: req.query.search as string,
      };

      const result = await policyManager.listPolicies(query);

      const response: ListPoliciesResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list policies',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(500).json(response);
    }
  });

  // Update policy
  router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const request = UpdatePolicyRequest.parse(req.body);
      const userId = req.userId!;
      const agentId = req.agentId;

      const policy = await policyManager.updatePolicy(id, request, userId, agentId);

      const response: GetPolicyResponse = {
        success: true,
        data: policy,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update policy',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(400).json(response);
    }
  });

  // Revoke policy
  router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const agentId = req.agentId;
      const reason = req.query.reason as string;

      const policy = await policyManager.revokePolicy(id, userId, agentId, reason);

      const response: GetPolicyResponse = {
        success: true,
        data: policy,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke policy',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(400).json(response);
    }
  });

  // Evaluate policy
  router.post('/:id/evaluate', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const context = req.body;

      const result = await policyManager.evaluatePolicy(id, context);

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
        error: error instanceof Error ? error.message : 'Failed to evaluate policy',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(400).json(response);
    }
  });

  return router;
}
