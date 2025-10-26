import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PolicyManager } from '../core/policy-manager';
import { HederaRegistry } from '../core/hedera-registry';
import { VincentPolicyEngine } from '../core/vincent-policy-engine';
import { AuditLogger } from '../core/audit-logger';
import { CreatePolicyRequest } from '../types';

// Mock dependencies
const mockHederaRegistry = {
  registerPolicy: vi.fn(),
  updatePolicy: vi.fn(),
} as unknown as HederaRegistry;

const mockVincentEngine = {
  evaluatePolicy: vi.fn(),
} as unknown as VincentPolicyEngine;

const mockAuditLogger = {
  logPolicyCreated: vi.fn(),
  logPolicyUpdated: vi.fn(),
  logPolicyRevoked: vi.fn(),
  logPolicyEvaluated: vi.fn(),
  logSystemError: vi.fn(),
} as unknown as AuditLogger;

describe('PolicyManager', () => {
  let policyManager: PolicyManager;

  beforeEach(() => {
    vi.clearAllMocks();
    policyManager = new PolicyManager({
      hederaRegistry: mockHederaRegistry,
      vincentEngine: mockVincentEngine,
      auditLogger: mockAuditLogger,
    });
  });

  describe('createPolicy', () => {
    it('should create a policy successfully', async () => {
      const request: CreatePolicyRequest = {
        name: 'Test Policy',
        description: 'A test policy',
        type: 'spending_limit',
        config: {
          type: 'spending_limit',
          config: {
            maxAmount: '1000000',
            currency: 'USDC',
            network: 'base-sepolia',
            timeWindow: { type: 'daily' },
          },
        },
      };

      const userId = 'user123';
      const result = await policyManager.createPolicy(request, userId);

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Policy');
      expect(result.type).toBe('spending_limit');
      expect(result.status).toBe('active');
      expect(result.createdBy).toBe(userId);
      expect(mockHederaRegistry.registerPolicy).toHaveBeenCalledWith(result);
      expect(mockAuditLogger.logPolicyCreated).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const request = {
        name: '',
        type: 'invalid_type',
      } as any;

      const userId = 'user123';

      await expect(policyManager.createPolicy(request, userId)).rejects.toThrow();
    });
  });

  describe('getPolicy', () => {
    it('should return null for non-existent policy', async () => {
      const result = await policyManager.getPolicy('non-existent');
      expect(result).toBeNull();
    });

    it('should return policy with stats', async () => {
      // First create a policy
      const request: CreatePolicyRequest = {
        name: 'Test Policy',
        type: 'spending_limit',
        config: {
          type: 'spending_limit',
          config: {
            maxAmount: '1000000',
            currency: 'USDC',
            network: 'base-sepolia',
            timeWindow: { type: 'daily' },
          },
        },
      };

      const userId = 'user123';
      const policy = await policyManager.createPolicy(request, userId);

      const result = await policyManager.getPolicy(policy.id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(policy.id);
      expect(result?.usage).toBeDefined();
    });
  });

  describe('listPolicies', () => {
    it('should return empty list initially', async () => {
      const result = await policyManager.listPolicies({
        page: 1,
        limit: 20,
      });

      expect(result.policies).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should filter by userId', async () => {
      const request: CreatePolicyRequest = {
        name: 'Test Policy',
        type: 'spending_limit',
        config: {
          type: 'spending_limit',
          config: {
            maxAmount: '1000000',
            currency: 'USDC',
            network: 'base-sepolia',
            timeWindow: { type: 'daily' },
          },
        },
      };

      const userId = 'user123';
      await policyManager.createPolicy(request, userId);

      const result = await policyManager.listPolicies({
        userId,
        page: 1,
        limit: 20,
      });

      expect(result.policies).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('updatePolicy', () => {
    it('should update a policy successfully', async () => {
      // First create a policy
      const request: CreatePolicyRequest = {
        name: 'Test Policy',
        type: 'spending_limit',
        config: {
          type: 'spending_limit',
          config: {
            maxAmount: '1000000',
            currency: 'USDC',
            network: 'base-sepolia',
            timeWindow: { type: 'daily' },
          },
        },
      };

      const userId = 'user123';
      const policy = await policyManager.createPolicy(request, userId);

      // Update the policy
      const updateRequest = {
        name: 'Updated Policy',
        description: 'Updated description',
      };

      const result = await policyManager.updatePolicy(policy.id, updateRequest, userId);

      expect(result.name).toBe('Updated Policy');
      expect(result.description).toBe('Updated description');
      expect(mockHederaRegistry.updatePolicy).toHaveBeenCalledWith(result);
      expect(mockAuditLogger.logPolicyUpdated).toHaveBeenCalled();
    });

    it('should throw error for non-existent policy', async () => {
      const updateRequest = {
        name: 'Updated Policy',
      };

      const userId = 'user123';

      await expect(
        policyManager.updatePolicy('non-existent', updateRequest, userId)
      ).rejects.toThrow('Policy non-existent not found');
    });
  });

  describe('revokePolicy', () => {
    it('should revoke a policy successfully', async () => {
      // First create a policy
      const request: CreatePolicyRequest = {
        name: 'Test Policy',
        type: 'spending_limit',
        config: {
          type: 'spending_limit',
          config: {
            maxAmount: '1000000',
            currency: 'USDC',
            network: 'base-sepolia',
            timeWindow: { type: 'daily' },
          },
        },
      };

      const userId = 'user123';
      const policy = await policyManager.createPolicy(request, userId);

      // Revoke the policy
      const result = await policyManager.revokePolicy(policy.id, userId, undefined, 'Test reason');

      expect(result.status).toBe('revoked');
      expect(mockHederaRegistry.updatePolicy).toHaveBeenCalledWith(result);
      expect(mockAuditLogger.logPolicyRevoked).toHaveBeenCalled();
    });
  });

  describe('evaluatePolicy', () => {
    it('should evaluate a policy successfully', async () => {
      // First create a policy
      const request: CreatePolicyRequest = {
        name: 'Test Policy',
        type: 'spending_limit',
        config: {
          type: 'spending_limit',
          config: {
            maxAmount: '1000000',
            currency: 'USDC',
            network: 'base-sepolia',
            timeWindow: { type: 'daily' },
          },
        },
      };

      const userId = 'user123';
      const policy = await policyManager.createPolicy(request, userId);

      // Mock evaluation result
      const mockResult = {
        allowed: true,
        reason: 'Policy passed',
        remainingAmount: '900000',
      };

      vi.mocked(mockVincentEngine.evaluatePolicy).mockResolvedValue(mockResult);

      const context = {
        userId,
        amount: '100000',
        currency: 'USDC',
        network: 'base-sepolia',
      };

      const result = await policyManager.evaluatePolicy(policy.id, context);

      expect(result).toEqual(mockResult);
      expect(mockVincentEngine.evaluatePolicy).toHaveBeenCalledWith(policy, context);
      expect(mockAuditLogger.logPolicyEvaluated).toHaveBeenCalled();
    });

    it('should handle non-existent policy', async () => {
      const context = {
        userId: 'user123',
        amount: '100000',
      };

      await expect(
        policyManager.evaluatePolicy('non-existent', context)
      ).rejects.toThrow('Policy non-existent not found');
    });
  });
});
