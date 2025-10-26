import { v4 as uuidv4 } from 'uuid';
import { HederaClient } from '../core/hedera-client.js';
import { 
  PolicyRegistryEntry, 
  PolicyCreationRequest, 
  PolicyUpdateRequest,
  PolicyResponse,
  PolicyQueryRequest,
  PolicyQueryResponse,
  PolicyEvent,
  PolicyAuditEntry
} from '../types/policy.js';
import { HederaConfig } from '../types/hedera.js';
import { logger } from '../core/logger.js';
import { EventEmitter } from 'events';

export class PolicyRegistryService extends EventEmitter {
  private hederaClient: HederaClient;
  private policies: Map<string, PolicyRegistryEntry> = new Map();
  private auditLog: PolicyAuditEntry[] = [];
  private config: HederaConfig;

  constructor(hederaClient: HederaClient, config: HederaConfig) {
    super();
    this.hederaClient = hederaClient;
    this.config = config;
  }

  /**
   * Create a new policy
   */
  async createPolicy(request: PolicyCreationRequest): Promise<PolicyResponse> {
    try {
      const policyId = uuidv4();
      const now = new Date().toISOString();

      // Create policy entry
      const policy: PolicyRegistryEntry = {
        policyId,
        policyHash: request.policyHash,
        owner: request.owner,
        createdAt: now,
        updatedAt: now,
        status: 'active',
        transactionId: '',
        consensusTimestamp: '',
        metadata: request.metadata,
      };

      // Store policy locally
      this.policies.set(policyId, policy);

      // Emit policy created event
      this.emitPolicyEvent('policy_created', policy);

      // Submit policy to Hedera topic
      const topicMessage = JSON.stringify({
        type: 'policy_created',
        policyId,
        policyHash: request.policyHash,
        owner: request.owner,
        timestamp: now,
        metadata: request.metadata,
      });

      const topicResult = await this.hederaClient.submitTopicMessage(
        this.config.policyTopicId,
        topicMessage
      );

      if (topicResult.success) {
        policy.transactionId = topicResult.transactionId;
        policy.consensusTimestamp = topicResult.consensusTimestamp;

        this.policies.set(policyId, policy);

        // Log audit entry
        this.logAuditEntry(policyId, 'policy_created', request.owner, topicResult.transactionId, topicResult.consensusTimestamp);

        logger.info('Policy created and submitted to Hedera', {
          policyId,
          owner: request.owner,
          transactionId: topicResult.transactionId,
        });

        return {
          success: true,
          policyId,
          transactionId: topicResult.transactionId,
          consensusTimestamp: topicResult.consensusTimestamp,
        };
      } else {
        // Remove policy if Hedera submission failed
        this.policies.delete(policyId);

        logger.error('Failed to submit policy to Hedera', {
          policyId,
          error: topicResult.error,
        });

        return {
          success: false,
          policyId,
          error: topicResult.error,
        };
      }
    } catch (error) {
      logger.error('Failed to create policy', { error, request });
      return {
        success: false,
        policyId: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update an existing policy
   */
  async updatePolicy(request: PolicyUpdateRequest): Promise<PolicyResponse> {
    try {
      const policy = this.policies.get(request.policyId);
      if (!policy) {
        return {
          success: false,
          policyId: request.policyId,
          error: 'Policy not found',
        };
      }

      const now = new Date().toISOString();
      const oldPolicy = { ...policy };

      // Update policy fields
      if (request.policyHash) {
        policy.policyHash = request.policyHash;
      }
      if (request.status) {
        policy.status = request.status;
      }
      if (request.metadata) {
        policy.metadata = { ...policy.metadata, ...request.metadata };
      }
      policy.updatedAt = now;

      this.policies.set(request.policyId, policy);

      // Emit policy updated event
      this.emitPolicyEvent('policy_updated', policy);

      // Submit update to Hedera topic
      const topicMessage = JSON.stringify({
        type: 'policy_updated',
        policyId: request.policyId,
        changes: {
          policyHash: request.policyHash,
          status: request.status,
          metadata: request.metadata,
        },
        timestamp: now,
      });

      const topicResult = await this.hederaClient.submitTopicMessage(
        this.config.policyTopicId,
        topicMessage
      );

      if (topicResult.success) {
        policy.transactionId = topicResult.transactionId;
        policy.consensusTimestamp = topicResult.consensusTimestamp;

        this.policies.set(request.policyId, policy);

        // Log audit entry
        this.logAuditEntry(
          request.policyId, 
          'policy_updated', 
          policy.owner, 
          topicResult.transactionId, 
          topicResult.consensusTimestamp,
          { oldPolicy, newPolicy: policy }
        );

        logger.info('Policy updated and submitted to Hedera', {
          policyId: request.policyId,
          transactionId: topicResult.transactionId,
        });

        return {
          success: true,
          policyId: request.policyId,
          transactionId: topicResult.transactionId,
          consensusTimestamp: topicResult.consensusTimestamp,
        };
      } else {
        // Revert changes if Hedera submission failed
        this.policies.set(request.policyId, oldPolicy);

        logger.error('Failed to submit policy update to Hedera', {
          policyId: request.policyId,
          error: topicResult.error,
        });

        return {
          success: false,
          policyId: request.policyId,
          error: topicResult.error,
        };
      }
    } catch (error) {
      logger.error('Failed to update policy', { error, request });
      return {
        success: false,
        policyId: request.policyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get policy by ID
   */
  async getPolicy(policyId: string): Promise<PolicyRegistryEntry | null> {
    return this.policies.get(policyId) || null;
  }

  /**
   * Query policies with filters
   */
  async queryPolicies(request: PolicyQueryRequest): Promise<PolicyQueryResponse> {
    try {
      let policies = Array.from(this.policies.values());

      // Apply filters
      if (request.policyId) {
        policies = policies.filter(p => p.policyId === request.policyId);
      }
      if (request.owner) {
        policies = policies.filter(p => p.owner === request.owner);
      }
      if (request.status) {
        policies = policies.filter(p => p.status === request.status);
      }

      const total = policies.length;
      const startIndex = request.offset;
      const endIndex = startIndex + request.limit;
      const paginatedPolicies = policies
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(startIndex, endIndex);

      return {
        success: true,
        policies: paginatedPolicies,
        total,
        hasMore: endIndex < total,
      };
    } catch (error) {
      logger.error('Failed to query policies', { error, request });
      return {
        success: false,
        policies: [],
        total: 0,
        hasMore: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Archive a policy
   */
  async archivePolicy(policyId: string, actor: string): Promise<PolicyResponse> {
    return this.updatePolicy({
      policyId,
      status: 'archived',
    });
  }

  /**
   * Activate a policy
   */
  async activatePolicy(policyId: string, actor: string): Promise<PolicyResponse> {
    return this.updatePolicy({
      policyId,
      status: 'active',
    });
  }

  /**
   * Deactivate a policy
   */
  async deactivatePolicy(policyId: string, actor: string): Promise<PolicyResponse> {
    return this.updatePolicy({
      policyId,
      status: 'inactive',
    });
  }

  /**
   * Get audit log for a policy
   */
  async getPolicyAuditLog(policyId: string): Promise<PolicyAuditEntry[]> {
    return this.auditLog.filter(entry => entry.policyId === policyId);
  }

  /**
   * Get all audit logs
   */
  async getAllAuditLogs(): Promise<PolicyAuditEntry[]> {
    return [...this.auditLog].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Emit policy event
   */
  private emitPolicyEvent(eventType: PolicyEvent['eventType'], policy: PolicyRegistryEntry): void {
    const event: PolicyEvent = {
      eventType,
      policyId: policy.policyId,
      owner: policy.owner,
      timestamp: new Date().toISOString(),
      data: {
        policy,
      },
    };

    this.emit('policy_event', event);
    logger.debug('Policy event emitted', { eventType, policyId: policy.policyId });
  }

  /**
   * Log audit entry
   */
  private logAuditEntry(
    policyId: string,
    action: string,
    actor: string,
    transactionId: string,
    consensusTimestamp: string,
    details?: any
  ): void {
    const auditEntry: PolicyAuditEntry = {
      auditId: uuidv4(),
      policyId,
      action,
      actor,
      timestamp: new Date().toISOString(),
      transactionId,
      consensusTimestamp,
      details,
    };

    this.auditLog.push(auditEntry);

    // Keep only last 1000 audit entries to prevent memory issues
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }

    logger.debug('Audit entry logged', { auditId: auditEntry.auditId, action, policyId });
  }

  /**
   * Sync policies from Hedera topic
   */
  async syncPoliciesFromHedera(): Promise<number> {
    try {
      // Query recent topic messages
      const messagesResult = await this.hederaClient.queryTopicMessages(
        this.config.policyTopicId,
        undefined, // startTime
        undefined, // endTime
        100 // limit
      );

      if (!messagesResult.success || !messagesResult.data) {
        logger.error('Failed to query topic messages for policy sync', {
          error: messagesResult.error,
        });
        return 0;
      }

      let syncedCount = 0;
      for (const message of messagesResult.data) {
        try {
          const messageData = JSON.parse(message.message);
          
          if (messageData.type === 'policy_created' && messageData.policyId) {
            // Check if policy already exists
            if (!this.policies.has(messageData.policyId)) {
              const policy: PolicyRegistryEntry = {
                policyId: messageData.policyId,
                policyHash: messageData.policyHash,
                owner: messageData.owner,
                createdAt: messageData.timestamp,
                updatedAt: messageData.timestamp,
                status: 'active',
                transactionId: message.consensusTimestamp, // Using consensus timestamp as transaction reference
                consensusTimestamp: message.consensusTimestamp,
                metadata: messageData.metadata,
              };

              this.policies.set(messageData.policyId, policy);
              syncedCount++;
            }
          }
        } catch (parseError) {
          logger.warn('Failed to parse policy message', { 
            message: message.message, 
            error: parseError 
          });
        }
      }

      logger.info('Synced policies from Hedera', { syncedCount });
      return syncedCount;
    } catch (error) {
      logger.error('Failed to sync policies from Hedera', { error });
      return 0;
    }
  }

  /**
   * Get policy statistics
   */
  async getPolicyStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    archived: number;
    byOwner: Record<string, number>;
  }> {
    const policies = Array.from(this.policies.values());
    
    const stats = {
      total: policies.length,
      active: policies.filter(p => p.status === 'active').length,
      inactive: policies.filter(p => p.status === 'inactive').length,
      archived: policies.filter(p => p.status === 'archived').length,
      byOwner: {} as Record<string, number>,
    };

    // Count by owner
    for (const policy of policies) {
      stats.byOwner[policy.owner] = (stats.byOwner[policy.owner] || 0) + 1;
    }

    return stats;
  }
}
