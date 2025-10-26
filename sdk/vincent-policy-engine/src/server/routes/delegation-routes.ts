import { Router, Request, Response } from 'express';
import { DelegationManager } from '../../core/delegation-manager';
import { AuditLogger } from '../../core/audit-logger';
import { 
  CreateDelegationRequest,
  DelegationQuery,
  ApiResponse,
  GetDelegationResponse,
  ListDelegationsResponse,
  WalletInfo
} from '../../types';
import { AuthenticatedRequest } from '../middleware/auth-middleware';

export interface DelegationRoutesConfig {
  delegationManager: DelegationManager;
  auditLogger: AuditLogger;
}

export function createDelegationRoutes(config: DelegationRoutesConfig): Router {
  const router = Router();
  const { delegationManager, auditLogger } = config;

  // Create delegation
  router.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const request = CreateDelegationRequest.parse(req.body);
      const userId = req.userId!;
      const agentId = req.agentId;

      // Extract wallet information from headers or body
      const delegatorWallet: WalletInfo = {
        address: req.headers['x-delegator-wallet'] as string || req.body.delegatorWallet,
        network: req.headers['x-delegator-network'] as string || req.body.delegatorNetwork || 'base-sepolia',
        type: req.headers['x-delegator-type'] as 'evm' | 'svm' | 'hedera' || req.body.delegatorType || 'evm',
        publicKey: req.headers['x-delegator-public-key'] as string || req.body.delegatorPublicKey,
        did: req.headers['x-delegator-did'] as string || req.body.delegatorDid,
      };

      const delegateeWallet: WalletInfo = {
        address: req.headers['x-delegatee-wallet'] as string || req.body.delegateeWallet,
        network: req.headers['x-delegatee-network'] as string || req.body.delegateeNetwork || 'base-sepolia',
        type: req.headers['x-delegatee-type'] as 'evm' | 'svm' | 'hedera' || req.body.delegateeType || 'evm',
        publicKey: req.headers['x-delegatee-public-key'] as string || req.body.delegateePublicKey,
        did: req.headers['x-delegatee-did'] as string || req.body.delegateeDid,
      };

      if (!delegatorWallet.address || !delegateeWallet.address) {
        const response: ApiResponse = {
          success: false,
          error: 'Missing wallet information',
          message: 'Delegator and delegatee wallet addresses are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };

        res.status(400).json(response);
        return;
      }

      const delegation = await delegationManager.createDelegation(
        request,
        delegatorWallet,
        delegateeWallet,
        userId,
        agentId
      );

      const response: GetDelegationResponse = {
        success: true,
        data: delegation.delegation,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create delegation',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(400).json(response);
    }
  });

  // Get delegation by ID
  router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const delegation = await delegationManager.getDelegation(id);

      if (!delegation) {
        const response: ApiResponse = {
          success: false,
          error: 'Delegation not found',
          message: `Delegation with ID ${id} not found`,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };

        res.status(404).json(response);
        return;
      }

      const response: GetDelegationResponse = {
        success: true,
        data: delegation,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get delegation',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(500).json(response);
    }
  });

  // List delegations
  router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const query: DelegationQuery = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
        delegator: req.query.delegator as string,
        delegatee: req.query.delegatee as string,
        status: req.query.status as any,
        search: req.query.search as string,
      };

      const result = await delegationManager.listDelegations(query);

      const response: ListDelegationsResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list delegations',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(500).json(response);
    }
  });

  // Revoke delegation
  router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const agentId = req.agentId;
      const reason = req.query.reason as string;

      const delegation = await delegationManager.revokeDelegation(id, userId, agentId, reason);

      const response: GetDelegationResponse = {
        success: true,
        data: delegation,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke delegation',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(400).json(response);
    }
  });

  // Verify delegation
  router.post('/:id/verify', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const delegatee = req.body.delegatee || req.headers['x-delegatee'] as string;
      const context = req.body.context || {};

      if (!delegatee) {
        const response: ApiResponse = {
          success: false,
          error: 'Missing delegatee',
          message: 'Delegatee address is required for verification',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
        };

        res.status(400).json(response);
        return;
      }

      const result = await delegationManager.verifyDelegation(id, delegatee, context);

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
        error: error instanceof Error ? error.message : 'Failed to verify delegation',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(400).json(response);
    }
  });

  // Get user-agent delegations
  router.get('/user/:userId/agent/:agentId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, agentId } = req.params;

      const delegations = await delegationManager.getUserAgentDelegations(userId, agentId);

      const response: ApiResponse = {
        success: true,
        data: { delegations },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user-agent delegations',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      };

      res.status(500).json(response);
    }
  });

  return router;
}
