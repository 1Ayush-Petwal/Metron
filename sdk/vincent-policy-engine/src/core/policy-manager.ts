import { v4 as uuidv4 } from 'uuid';
import {
    PolicyDefinition,
    PolicyDefinitionSchema,
    PolicyWithStats,
    PolicyWithStatsSchema,
    PolicyStatus,
    PolicyType,
    PolicyConfig,
    PolicyEvaluationResult,
    PolicyUsageStats,
    CreatePolicyRequest,
    UpdatePolicyRequest,
    PolicyQuery
} from '../types';
import { HederaRegistry } from './hedera-registry';
import { VincentPolicyEngine } from './vincent-policy-engine';
import { AuditLogger } from './audit-logger';

export interface PolicyManagerConfig {
    hederaRegistry: HederaRegistry;
    vincentEngine: VincentPolicyEngine;
    auditLogger: AuditLogger;
    cacheEnabled?: boolean;
    cacheTTL?: number;
}

export class PolicyManager {
    private policies: Map<string, PolicyDefinition> = new Map();
    private policyStats: Map<string, PolicyUsageStats> = new Map();
    private hederaRegistry: HederaRegistry;
    private vincentEngine: VincentPolicyEngine;
    private auditLogger: AuditLogger;
    private cacheEnabled: boolean;
    private cacheTTL: number;

    constructor(config: PolicyManagerConfig) {
        this.hederaRegistry = config.hederaRegistry;
        this.vincentEngine = config.vincentEngine;
        this.auditLogger = config.auditLogger;
        this.cacheEnabled = config.cacheEnabled ?? true;
        this.cacheTTL = config.cacheTTL ?? 300; // 5 minutes
    }

    /**
     * Create a new policy
     */
    async createPolicy(
        request: CreatePolicyRequest,
        userId: string,
        agentId?: string
    ): Promise<PolicyDefinition> {
        try {
            // Validate request
            const validatedRequest = CreatePolicyRequestSchema.parse(request);

            // Generate policy ID
            const policyId = uuidv4();
            const now = new Date().toISOString();

            // Create policy definition
            const policy: PolicyDefinition = {
                id: policyId,
                name: validatedRequest.name,
                description: validatedRequest.description,
                type: validatedRequest.type as PolicyType,
                config: validatedRequest.config as PolicyConfig,
                status: 'active',
                createdAt: now,
                updatedAt: now,
                expiresAt: validatedRequest.expiresAt,
                createdBy: userId,
                tags: validatedRequest.tags,
                metadata: validatedRequest.metadata,
            };

            // Validate policy definition
            const validatedPolicy = PolicyDefinitionSchema.parse(policy);

            // Store policy locally
            this.policies.set(policyId, validatedPolicy);

            // Initialize usage stats
            const initialStats: PolicyUsageStats = {
                totalSpent: '0',
                totalTransactions: 0,
                lastUsed: undefined,
                currentPeriodSpent: '0',
                currentPeriodTransactions: 0,
                violations: 0,
            };
            this.policyStats.set(policyId, initialStats);

            // Register policy on Hedera
            await this.hederaRegistry.registerPolicy(validatedPolicy);

            // Log audit event
            await this.auditLogger.logPolicyCreated({
                policyId,
                policyName: validatedPolicy.name,
                userId,
                agentId,
                changes: validatedPolicy,
            });

            return validatedPolicy;
        } catch (error) {
            await this.auditLogger.logSystemError({
                errorCode: 'POLICY_CREATE_ERROR',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                component: 'PolicyManager',
                context: { request, userId, agentId },
            });
            throw error;
        }
    }

    /**
     * Update an existing policy
     */
    async updatePolicy(
        policyId: string,
        request: UpdatePolicyRequest,
        userId: string,
        agentId?: string
    ): Promise<PolicyDefinition> {
        try {
            // Get existing policy
            const existingPolicy = this.policies.get(policyId);
            if (!existingPolicy) {
                throw new Error(`Policy ${policyId} not found`);
            }

            // Validate request
            const validatedRequest = UpdatePolicyRequestSchema.parse(request);

            // Create updated policy
            const updatedPolicy: PolicyDefinition = {
                ...existingPolicy,
                ...validatedRequest,
                updatedAt: new Date().toISOString(),
            };

            // Validate updated policy
            const validatedPolicy = PolicyDefinitionSchema.parse(updatedPolicy);

            // Store updated policy
            this.policies.set(policyId, validatedPolicy);

            // Update policy on Hedera
            await this.hederaRegistry.updatePolicy(validatedPolicy);

            // Log audit event
            await this.auditLogger.logPolicyUpdated({
                policyId,
                policyName: validatedPolicy.name,
                userId,
                agentId,
                changes: validatedRequest,
            });

            return validatedPolicy;
        } catch (error) {
            await this.auditLogger.logSystemError({
                errorCode: 'POLICY_UPDATE_ERROR',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                component: 'PolicyManager',
                context: { policyId, request, userId, agentId },
            });
            throw error;
        }
    }

    /**
     * Revoke a policy
     */
    async revokePolicy(
        policyId: string,
        userId: string,
        agentId?: string,
        reason?: string
    ): Promise<PolicyDefinition> {
        try {
            // Get existing policy
            const existingPolicy = this.policies.get(policyId);
            if (!existingPolicy) {
                throw new Error(`Policy ${policyId} not found`);
            }

            // Update policy status
            const updatedPolicy: PolicyDefinition = {
                ...existingPolicy,
                status: 'revoked',
                updatedAt: new Date().toISOString(),
            };

            // Store updated policy
            this.policies.set(policyId, updatedPolicy);

            // Update policy on Hedera
            await this.hederaRegistry.updatePolicy(updatedPolicy);

            // Log audit event
            await this.auditLogger.logPolicyRevoked({
                policyId,
                policyName: updatedPolicy.name,
                userId,
                agentId,
                reason,
            });

            return updatedPolicy;
        } catch (error) {
            await this.auditLogger.logSystemError({
                errorCode: 'POLICY_REVOKE_ERROR',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                component: 'PolicyManager',
                context: { policyId, userId, agentId, reason },
            });
            throw error;
        }
    }

    /**
     * Get a policy by ID
     */
    async getPolicy(policyId: string): Promise<PolicyWithStats | null> {
        try {
            const policy = this.policies.get(policyId);
            if (!policy) {
                return null;
            }

            const stats = this.policyStats.get(policyId) || {
                totalSpent: '0',
                totalTransactions: 0,
                lastUsed: undefined,
                currentPeriodSpent: '0',
                currentPeriodTransactions: 0,
                violations: 0,
            };

            const policyWithStats: PolicyWithStats = {
                ...policy,
                usage: stats,
            };

            return PolicyWithStatsSchema.parse(policyWithStats);
        } catch (error) {
            await this.auditLogger.logSystemError({
                errorCode: 'POLICY_GET_ERROR',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                component: 'PolicyManager',
                context: { policyId },
            });
            throw error;
        }
    }

    /**
     * List policies with optional filtering
     */
    async listPolicies(query: PolicyQuery): Promise<{
        policies: PolicyWithStats[];
        total: number;
        page: number;
        limit: number;
    }> {
        try {
            let filteredPolicies = Array.from(this.policies.values());

            // Apply filters
            if (query.userId) {
                filteredPolicies = filteredPolicies.filter(p => p.createdBy === query.userId);
            }

            if (query.agentId) {
                // This would need to be implemented based on how agent-policy relationships are stored
                // For now, we'll skip this filter
            }

            if (query.type) {
                filteredPolicies = filteredPolicies.filter(p => p.type === query.type);
            }

            if (query.status) {
                filteredPolicies = filteredPolicies.filter(p => p.status === query.status);
            }

            if (query.tags && query.tags.length > 0) {
                filteredPolicies = filteredPolicies.filter(p =>
                    p.tags && query.tags!.some(tag => p.tags!.includes(tag))
                );
            }

            if (query.search) {
                const searchLower = query.search.toLowerCase();
                filteredPolicies = filteredPolicies.filter(p =>
                    p.name.toLowerCase().includes(searchLower) ||
                    (p.description && p.description.toLowerCase().includes(searchLower))
                );
            }

            // Apply sorting
            if (query.sortBy) {
                filteredPolicies.sort((a, b) => {
                    const aValue = a[query.sortBy as keyof PolicyDefinition];
                    const bValue = b[query.sortBy as keyof PolicyDefinition];

                    if (aValue < bValue) return query.sortOrder === 'asc' ? -1 : 1;
                    if (aValue > bValue) return query.sortOrder === 'asc' ? 1 : -1;
                    return 0;
                });
            }

            // Apply pagination
            const total = filteredPolicies.length;
            const startIndex = (query.page - 1) * query.limit;
            const endIndex = startIndex + query.limit;
            const paginatedPolicies = filteredPolicies.slice(startIndex, endIndex);

            // Add usage stats to policies
            const policiesWithStats: PolicyWithStats[] = paginatedPolicies.map(policy => {
                const stats = this.policyStats.get(policy.id) || {
                    totalSpent: '0',
                    totalTransactions: 0,
                    lastUsed: undefined,
                    currentPeriodSpent: '0',
                    currentPeriodTransactions: 0,
                    violations: 0,
                };

                return {
                    ...policy,
                    usage: stats,
                };
            });

            return {
                policies: policiesWithStats,
                total,
                page: query.page,
                limit: query.limit,
            };
        } catch (error) {
            await this.auditLogger.logSystemError({
                errorCode: 'POLICY_LIST_ERROR',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                component: 'PolicyManager',
                context: { query },
            });
            throw error;
        }
    }

    /**
     * Evaluate a policy against a spending request
     */
    async evaluatePolicy(
        policyId: string,
        context: any
    ): Promise<PolicyEvaluationResult> {
        try {
            const policy = this.policies.get(policyId);
            if (!policy) {
                throw new Error(`Policy ${policyId} not found`);
            }

            if (policy.status !== 'active') {
                return {
                    allowed: false,
                    reason: `Policy is ${policy.status}`,
                };
            }

            // Check if policy has expired
            if (policy.expiresAt && new Date(policy.expiresAt) < new Date()) {
                return {
                    allowed: false,
                    reason: 'Policy has expired',
                };
            }

            // Use Vincent engine to evaluate policy
            const result = await this.vincentEngine.evaluatePolicy(policy, context);

            // Log policy evaluation
            await this.auditLogger.logPolicyEvaluated({
                policyId,
                policyName: policy.name,
                userId: context.userId,
                agentId: context.agentId,
                allowed: result.allowed,
                reason: result.reason,
                remainingAmount: result.remainingAmount,
                violations: result.violations,
            });

            return result;
        } catch (error) {
            await this.auditLogger.logSystemError({
                errorCode: 'POLICY_EVALUATE_ERROR',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                component: 'PolicyManager',
                context: { policyId, context },
            });
            throw error;
        }
    }

    /**
     * Update policy usage statistics
     */
    async updatePolicyUsage(
        policyId: string,
        amount: string,
        transactionCount: number = 1
    ): Promise<void> {
        try {
            const stats = this.policyStats.get(policyId);
            if (!stats) {
                return;
            }

            const newStats: PolicyUsageStats = {
                ...stats,
                totalSpent: (BigInt(stats.totalSpent) + BigInt(amount)).toString(),
                totalTransactions: stats.totalTransactions + transactionCount,
                lastUsed: new Date().toISOString(),
                currentPeriodSpent: (BigInt(stats.currentPeriodSpent) + BigInt(amount)).toString(),
                currentPeriodTransactions: stats.currentPeriodTransactions + transactionCount,
            };

            this.policyStats.set(policyId, newStats);
        } catch (error) {
            await this.auditLogger.logSystemError({
                errorCode: 'POLICY_USAGE_UPDATE_ERROR',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                component: 'PolicyManager',
                context: { policyId, amount, transactionCount },
            });
            throw error;
        }
    }

    /**
     * Reset period usage for a policy
     */
    async resetPolicyPeriod(policyId: string): Promise<void> {
        try {
            const stats = this.policyStats.get(policyId);
            if (!stats) {
                return;
            }

            const newStats: PolicyUsageStats = {
                ...stats,
                currentPeriodSpent: '0',
                currentPeriodTransactions: 0,
            };

            this.policyStats.set(policyId, newStats);
        } catch (error) {
            await this.auditLogger.logSystemError({
                errorCode: 'POLICY_PERIOD_RESET_ERROR',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                component: 'PolicyManager',
                context: { policyId },
            });
            throw error;
        }
    }
}
