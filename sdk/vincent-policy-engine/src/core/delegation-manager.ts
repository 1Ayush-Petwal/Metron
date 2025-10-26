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
import { 
  DelegationDefinition, 
  DelegationDefinitionSchema,
  DelegationRequest,
  DelegationResponse,
  DelegationVerificationResult,
  UserAgentDelegation,
  WalletInfo,
  CreateDelegationRequest
} from '../types';
import { HederaRegistry } from './hedera-registry';
import { AuditLogger } from './audit-logger';
import { VincentDelegationManager } from './vincent-delegation-manager';

export interface DelegationManagerConfig {
  hederaRegistry: HederaRegistry;
  auditLogger: AuditLogger;
  vincentDelegationManager: VincentDelegationManager;
}

export class DelegationManager {
  private delegations: Map<string, DelegationDefinition> = new Map();
  private userAgentDelegations: Map<string, UserAgentDelegation> = new Map();
  private hederaRegistry: HederaRegistry;
  private auditLogger: AuditLogger;
  private vincentDelegationManager: VincentDelegationManager;

  constructor(config: DelegationManagerConfig) {
    this.hederaRegistry = config.hederaRegistry;
    this.auditLogger = config.auditLogger;
    this.vincentDelegationManager = config.vincentDelegationManager;
  }

  /**
   * Create a new delegation
   */
  async createDelegation(
    request: CreateDelegationRequest,
    delegatorWallet: WalletInfo,
    delegateeWallet: WalletInfo,
    userId: string,
    agentId?: string
  ): Promise<DelegationResponse> {
    try {
      // Validate request
      const validatedRequest = CreateDelegationRequestSchema.parse(request);

      // Generate delegation ID and nonce
      const delegationId = uuidv4();
      const nonce = uuidv4();
      const now = new Date().toISOString();

      // Create delegation definition
      const delegation: DelegationDefinition = {
        id: delegationId,
        delegator: delegatorWallet.address,
        delegatee: delegateeWallet.address,
        scope: validatedRequest.scope,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        expiresAt: validatedRequest.expiresAt,
        signature: '', // Will be set after signing
        nonce,
        metadata: validatedRequest.metadata,
      };

      // Create Vincent delegation
      const vincentDelegation = await this.vincentDelegationManager.createDelegation({
        delegator: delegatorWallet.address,
        delegatee: delegateeWallet.address,
        scope: validatedRequest.scope,
        expiresAt: validatedRequest.expiresAt,
        signature: '', // Will be set after signing
        nonce,
        metadata: validatedRequest.metadata,
      });

      // Update delegation with signature
      delegation.signature = vincentDelegation.signature;
      delegation.status = 'active';

      // Validate delegation
      const validatedDelegation = DelegationDefinitionSchema.parse(delegation);

      // Store delegation locally
      this.delegations.set(delegationId, validatedDelegation);

      // Update user-agent delegation mapping
      await this.updateUserAgentDelegation(userId, agentId || '', [delegationId]);

      // Register delegation on Hedera
      await this.hederaRegistry.registerDelegation(validatedDelegation);

      // Log audit event
      await this.auditLogger.logDelegationCreated({
        delegationId,
        delegator: validatedDelegation.delegator,
        delegatee: validatedDelegation.delegatee,
        scope: validatedDelegation.scope,
        userId,
        agentId,
      });

      return {
        delegation: validatedDelegation,
        signature: vincentDelegation.signature,
        transactionHash: vincentDelegation.transactionHash,
      };
    } catch (error) {
      await this.auditLogger.logSystemError({
        errorCode: 'DELEGATION_CREATE_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        component: 'DelegationManager',
        context: { request, delegatorWallet, delegateeWallet, userId, agentId },
      });
      throw error;
    }
  }

  /**
   * Revoke a delegation
   */
  async revokeDelegation(
    delegationId: string,
    userId: string,
    agentId?: string,
    reason?: string
  ): Promise<DelegationDefinition> {
    try {
      // Get existing delegation
      const existingDelegation = this.delegations.get(delegationId);
      if (!existingDelegation) {
        throw new Error(`Delegation ${delegationId} not found`);
      }

      // Update delegation status
      const updatedDelegation: DelegationDefinition = {
        ...existingDelegation,
        status: 'revoked',
        updatedAt: new Date().toISOString(),
      };

      // Store updated delegation
      this.delegations.set(delegationId, updatedDelegation);

      // Update user-agent delegation mapping
      await this.removeUserAgentDelegation(userId, agentId || '', delegationId);

      // Update delegation on Hedera
      await this.hederaRegistry.updateDelegation(updatedDelegation);

      // Log audit event
      await this.auditLogger.logDelegationRevoked({
        delegationId,
        delegator: updatedDelegation.delegator,
        delegatee: updatedDelegation.delegatee,
        scope: updatedDelegation.scope,
        userId,
        agentId,
        reason,
      });

      return updatedDelegation;
    } catch (error) {
      await this.auditLogger.logSystemError({
        errorCode: 'DELEGATION_REVOKE_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        component: 'DelegationManager',
        context: { delegationId, userId, agentId, reason },
      });
      throw error;
    }
  }

  /**
   * Get a delegation by ID
   */
  async getDelegation(delegationId: string): Promise<DelegationDefinition | null> {
    try {
      const delegation = this.delegations.get(delegationId);
      if (!delegation) {
        return null;
      }

      // Check if delegation has expired
      if (delegation.expiresAt && new Date(delegation.expiresAt) < new Date()) {
        const expiredDelegation: DelegationDefinition = {
          ...delegation,
          status: 'expired',
          updatedAt: new Date().toISOString(),
        };
        this.delegations.set(delegationId, expiredDelegation);
        return expiredDelegation;
      }

      return delegation;
    } catch (error) {
      await this.auditLogger.logSystemError({
        errorCode: 'DELEGATION_GET_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        component: 'DelegationManager',
        context: { delegationId },
      });
      throw error;
    }
  }

  /**
   * List delegations with optional filtering
   */
  async listDelegations(query: any): Promise<{
    delegations: DelegationDefinition[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      let filteredDelegations = Array.from(this.delegations.values());

      // Apply filters
      if (query.delegator) {
        filteredDelegations = filteredDelegations.filter(d => d.delegator === query.delegator);
      }

      if (query.delegatee) {
        filteredDelegations = filteredDelegations.filter(d => d.delegatee === query.delegatee);
      }

      if (query.status) {
        filteredDelegations = filteredDelegations.filter(d => d.status === query.status);
      }

      if (query.search) {
        const searchLower = query.search.toLowerCase();
        filteredDelegations = filteredDelegations.filter(d => 
          d.delegator.toLowerCase().includes(searchLower) ||
          d.delegatee.toLowerCase().includes(searchLower)
        );
      }

      // Apply sorting
      if (query.sortBy) {
        filteredDelegations.sort((a, b) => {
          const aValue = a[query.sortBy as keyof DelegationDefinition];
          const bValue = b[query.sortBy as keyof DelegationDefinition];
          
          if (aValue < bValue) return query.sortOrder === 'asc' ? -1 : 1;
          if (aValue > bValue) return query.sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
      }

      // Apply pagination
      const total = filteredDelegations.length;
      const startIndex = (query.page - 1) * query.limit;
      const endIndex = startIndex + query.limit;
      const paginatedDelegations = filteredDelegations.slice(startIndex, endIndex);

      return {
        delegations: paginatedDelegations,
        total,
        page: query.page,
        limit: query.limit,
      };
    } catch (error) {
      await this.auditLogger.logSystemError({
        errorCode: 'DELEGATION_LIST_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        component: 'DelegationManager',
        context: { query },
      });
      throw error;
    }
  }

  /**
   * Verify a delegation
   */
  async verifyDelegation(
    delegationId: string,
    delegatee: string,
    context: any
  ): Promise<DelegationVerificationResult> {
    try {
      const delegation = this.delegations.get(delegationId);
      if (!delegation) {
        return {
          valid: false,
          reason: 'Delegation not found',
        };
      }

      // Check if delegation is active
      if (delegation.status !== 'active') {
        return {
          valid: false,
          reason: `Delegation is ${delegation.status}`,
          delegation,
          expired: delegation.status === 'expired',
          revoked: delegation.status === 'revoked',
        };
      }

      // Check if delegation has expired
      if (delegation.expiresAt && new Date(delegation.expiresAt) < new Date()) {
        const expiredDelegation: DelegationDefinition = {
          ...delegation,
          status: 'expired',
          updatedAt: new Date().toISOString(),
        };
        this.delegations.set(delegationId, expiredDelegation);

        return {
          valid: false,
          reason: 'Delegation has expired',
          delegation: expiredDelegation,
          expired: true,
        };
      }

      // Check if delegatee matches
      if (delegation.delegatee !== delegatee) {
        return {
          valid: false,
          reason: 'Delegatee mismatch',
          delegation,
        };
      }

      // Verify signature using Vincent delegation manager
      const isValidSignature = await this.vincentDelegationManager.verifyDelegation(delegation);
      if (!isValidSignature) {
        return {
          valid: false,
          reason: 'Invalid signature',
          delegation,
        };
      }

      // Check scope restrictions
      if (delegation.scope.policies && delegation.scope.policies.length > 0) {
        const requestedPolicy = context.policyId;
        if (requestedPolicy && !delegation.scope.policies.includes(requestedPolicy)) {
          return {
            valid: false,
            reason: 'Policy not in delegation scope',
            delegation,
          };
        }
      }

      if (delegation.scope.maxAmount) {
        const requestedAmount = context.amount || '0';
        if (BigInt(requestedAmount) > BigInt(delegation.scope.maxAmount)) {
          return {
            valid: false,
            reason: 'Amount exceeds delegation scope',
            delegation,
          };
        }
      }

      if (delegation.scope.timeLimit) {
        const delegationAge = Date.now() - new Date(delegation.createdAt).getTime();
        const timeLimitMs = delegation.scope.timeLimit * 1000;
        if (delegationAge > timeLimitMs) {
          return {
            valid: false,
            reason: 'Delegation time limit exceeded',
            delegation,
          };
        }
      }

      return {
        valid: true,
        delegation,
      };
    } catch (error) {
      await this.auditLogger.logSystemError({
        errorCode: 'DELEGATION_VERIFY_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        component: 'DelegationManager',
        context: { delegationId, delegatee, context },
      });
      throw error;
    }
  }

  /**
   * Get delegations for a user-agent pair
   */
  async getUserAgentDelegations(userId: string, agentId: string): Promise<DelegationDefinition[]> {
    try {
      const key = `${userId}:${agentId}`;
      const userAgentDelegation = this.userAgentDelegations.get(key);
      
      if (!userAgentDelegation) {
        return [];
      }

      const delegations: DelegationDefinition[] = [];
      for (const delegationId of userAgentDelegation.delegations) {
        const delegation = this.delegations.get(delegationId);
        if (delegation && delegation.status === 'active') {
          delegations.push(delegation);
        }
      }

      return delegations;
    } catch (error) {
      await this.auditLogger.logSystemError({
        errorCode: 'USER_AGENT_DELEGATIONS_GET_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        component: 'DelegationManager',
        context: { userId, agentId },
      });
      throw error;
    }
  }

  /**
   * Update user-agent delegation mapping
   */
  private async updateUserAgentDelegation(
    userId: string,
    agentId: string,
    delegationIds: string[]
  ): Promise<void> {
    try {
      const key = `${userId}:${agentId}`;
      const existing = this.userAgentDelegations.get(key);
      const now = new Date().toISOString();

      if (existing) {
        const updatedDelegations = [...new Set([...existing.delegations, ...delegationIds])];
        this.userAgentDelegations.set(key, {
          ...existing,
          delegations: updatedDelegations,
          updatedAt: now,
        });
      } else {
        this.userAgentDelegations.set(key, {
          userId,
          agentId,
          delegations: delegationIds,
          activePolicies: [],
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (error) {
      await this.auditLogger.logSystemError({
        errorCode: 'USER_AGENT_DELEGATION_UPDATE_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        component: 'DelegationManager',
        context: { userId, agentId, delegationIds },
      });
      throw error;
    }
  }

  /**
   * Remove delegation from user-agent mapping
   */
  private async removeUserAgentDelegation(
    userId: string,
    agentId: string,
    delegationId: string
  ): Promise<void> {
    try {
      const key = `${userId}:${agentId}`;
      const existing = this.userAgentDelegations.get(key);
      
      if (existing) {
        const updatedDelegations = existing.delegations.filter(id => id !== delegationId);
        this.userAgentDelegations.set(key, {
          ...existing,
          delegations: updatedDelegations,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      await this.auditLogger.logSystemError({
        errorCode: 'USER_AGENT_DELEGATION_REMOVE_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        component: 'DelegationManager',
        context: { userId, agentId, delegationId },
      });
      throw error;
    }
  }

  /**
   * Clean up expired delegations
   */
  async cleanupExpiredDelegations(): Promise<number> {
    try {
      let cleanedCount = 0;
      const now = new Date();

      for (const [delegationId, delegation] of this.delegations.entries()) {
        if (delegation.expiresAt && new Date(delegation.expiresAt) < now && delegation.status === 'active') {
          const expiredDelegation: DelegationDefinition = {
            ...delegation,
            status: 'expired',
            updatedAt: now.toISOString(),
          };
          this.delegations.set(delegationId, expiredDelegation);
          cleanedCount++;
        }
      }

      return cleanedCount;
    } catch (error) {
      await this.auditLogger.logSystemError({
        errorCode: 'DELEGATION_CLEANUP_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        component: 'DelegationManager',
        context: {},
      });
      throw error;
    }
  }
}
