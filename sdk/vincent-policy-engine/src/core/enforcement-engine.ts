import { 
  EnforcementResult,
  EnforcementResultSchema,
  PolicyCheckResult,
  SpendingCheckContext,
  RateLimitCheckContext,
  AccessControlCheckContext,
  TimeBasedCheckContext,
  PaymentRequestContext,
  EnforcementMiddlewareConfig,
  PolicyDefinition,
  DelegationDefinition
} from '../types';
import { PolicyManager } from './policy-manager';
import { DelegationManager } from './delegation-manager';
import { AuditLogger } from './audit-logger';

export interface EnforcementEngineConfig {
  policyManager: PolicyManager;
  delegationManager: DelegationManager;
  auditLogger: AuditLogger;
  config: EnforcementMiddlewareConfig;
}

export class EnforcementEngine {
  private policyManager: PolicyManager;
  private delegationManager: DelegationManager;
  private auditLogger: AuditLogger;
  private config: EnforcementMiddlewareConfig;
  private policyResultCache: Map<string, { result: PolicyCheckResult; timestamp: number }> = new Map();

  constructor(config: EnforcementEngineConfig) {
    this.policyManager = config.policyManager;
    this.delegationManager = config.delegationManager;
    this.auditLogger = config.auditLogger;
    this.config = config.config;
  }

  /**
   * Check spending limits for a payment request
   */
  async checkSpending(context: SpendingCheckContext): Promise<EnforcementResult> {
    try {
      const { userId, agentId, amount, currency, network, endpoint } = context;

      // Get user's active policies
      const policies = await this.policyManager.listPolicies({
        userId,
        agentId,
        type: 'spending_limit',
        status: 'active',
        page: 1,
        limit: 100,
      });

      if (policies.policies.length === 0) {
        return {
          allowed: true,
          action: 'allow',
          reason: 'No spending policies configured',
          policyResults: [],
        };
      }

      // Check delegation if required
      if (this.config.requireDelegation && agentId) {
        const delegations = await this.delegationManager.getUserAgentDelegations(userId, agentId);
        if (delegations.length === 0) {
          return {
            allowed: false,
            action: 'deny',
            reason: 'No delegation found for agent',
            policyResults: [],
          };
        }

        // Verify delegation
        const delegationVerification = await this.delegationManager.verifyDelegation(
          delegations[0].id,
          agentId,
          { amount, currency, network, endpoint }
        );

        if (!delegationVerification.valid) {
          return {
            allowed: false,
            action: 'deny',
            reason: delegationVerification.reason || 'Delegation verification failed',
            policyResults: [],
          };
        }
      }

      // Evaluate each policy
      const policyResults: PolicyCheckResult[] = [];
      let totalRemainingAmount: string | undefined;
      let nextResetTime: string | undefined;

      for (const policy of policies.policies) {
        const policyResult = await this.evaluatePolicy(policy, context);
        policyResults.push(policyResult);

        if (!policyResult.action || policyResult.action === 'deny') {
          // Policy denied the request
          return {
            allowed: false,
            action: 'deny',
            reason: policyResult.reason || 'Policy violation',
            policyResults,
            totalRemainingAmount,
            nextResetTime,
          };
        }

        // Update remaining amount and reset time
        if (policyResult.remainingAmount) {
          totalRemainingAmount = policyResult.remainingAmount;
        }
        if (policyResult.resetTime) {
          nextResetTime = policyResult.resetTime;
        }
      }

      // Log successful spending check
      await this.auditLogger.logPaymentProcessed({
        userId,
        agentId,
        amount,
        currency,
        network,
        endpoint,
        policyResults,
      });

      return {
        allowed: true,
        action: 'allow',
        reason: 'All policies passed',
        policyResults,
        totalRemainingAmount,
        nextResetTime,
      };
    } catch (error) {
      await this.auditLogger.logSystemError({
        errorCode: 'SPENDING_CHECK_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        component: 'EnforcementEngine',
        context,
      });

      return {
        allowed: false,
        action: 'deny',
        reason: 'Spending check failed',
        policyResults: [],
      };
    }
  }

  /**
   * Check rate limits for a request
   */
  async checkRateLimit(context: RateLimitCheckContext): Promise<EnforcementResult> {
    try {
      const { userId, agentId, endpoint } = context;

      // Get user's rate limit policies
      const policies = await this.policyManager.listPolicies({
        userId,
        agentId,
        type: 'rate_limit',
        status: 'active',
        page: 1,
        limit: 100,
      });

      if (policies.policies.length === 0) {
        return {
          allowed: true,
          action: 'allow',
          reason: 'No rate limit policies configured',
          policyResults: [],
        };
      }

      // Evaluate each policy
      const policyResults: PolicyCheckResult[] = [];

      for (const policy of policies.policies) {
        const policyResult = await this.evaluatePolicy(policy, context);
        policyResults.push(policyResult);

        if (!policyResult.action || policyResult.action === 'deny') {
          return {
            allowed: false,
            action: 'rate_limit',
            reason: policyResult.reason || 'Rate limit exceeded',
            policyResults,
          };
        }
      }

      return {
        allowed: true,
        action: 'allow',
        reason: 'Rate limits passed',
        policyResults,
      };
    } catch (error) {
      await this.auditLogger.logSystemError({
        errorCode: 'RATE_LIMIT_CHECK_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        component: 'EnforcementEngine',
        context,
      });

      return {
        allowed: false,
        action: 'deny',
        reason: 'Rate limit check failed',
        policyResults: [],
      };
    }
  }

  /**
   * Check access control for a request
   */
  async checkAccessControl(context: AccessControlCheckContext): Promise<EnforcementResult> {
    try {
      const { userId, agentId, endpoint, method, headers, ipAddress, userAgent } = context;

      // Get user's access control policies
      const policies = await this.policyManager.listPolicies({
        userId,
        agentId,
        type: 'access_control',
        status: 'active',
        page: 1,
        limit: 100,
      });

      if (policies.policies.length === 0) {
        return {
          allowed: true,
          action: 'allow',
          reason: 'No access control policies configured',
          policyResults: [],
        };
      }

      // Evaluate each policy
      const policyResults: PolicyCheckResult[] = [];

      for (const policy of policies.policies) {
        const policyResult = await this.evaluatePolicy(policy, context);
        policyResults.push(policyResult);

        if (!policyResult.action || policyResult.action === 'deny') {
          return {
            allowed: false,
            action: 'deny',
            reason: policyResult.reason || 'Access denied',
            policyResults,
          };
        }
      }

      return {
        allowed: true,
        action: 'allow',
        reason: 'Access control passed',
        policyResults,
      };
    } catch (error) {
      await this.auditLogger.logSystemError({
        errorCode: 'ACCESS_CONTROL_CHECK_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        component: 'EnforcementEngine',
        context,
      });

      return {
        allowed: false,
        action: 'deny',
        reason: 'Access control check failed',
        policyResults: [],
      };
    }
  }

  /**
   * Check time-based restrictions for a request
   */
  async checkTimeBased(context: TimeBasedCheckContext): Promise<EnforcementResult> {
    try {
      const { userId, agentId } = context;

      // Get user's time-based policies
      const policies = await this.policyManager.listPolicies({
        userId,
        agentId,
        type: 'time_based',
        status: 'active',
        page: 1,
        limit: 100,
      });

      if (policies.policies.length === 0) {
        return {
          allowed: true,
          action: 'allow',
          reason: 'No time-based policies configured',
          policyResults: [],
        };
      }

      // Evaluate each policy
      const policyResults: PolicyCheckResult[] = [];

      for (const policy of policies.policies) {
        const policyResult = await this.evaluatePolicy(policy, context);
        policyResults.push(policyResult);

        if (!policyResult.action || policyResult.action === 'deny') {
          return {
            allowed: false,
            action: 'deny',
            reason: policyResult.reason || 'Time-based restriction',
            policyResults,
          };
        }
      }

      return {
        allowed: true,
        action: 'allow',
        reason: 'Time-based checks passed',
        policyResults,
      };
    } catch (error) {
      await this.auditLogger.logSystemError({
        errorCode: 'TIME_BASED_CHECK_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        component: 'EnforcementEngine',
        context,
      });

      return {
        allowed: false,
        action: 'deny',
        reason: 'Time-based check failed',
        policyResults: [],
      };
    }
  }

  /**
   * Process a complete payment request with all checks
   */
  async processPaymentRequest(context: PaymentRequestContext): Promise<EnforcementResult> {
    try {
      // Check if endpoint should be bypassed
      if (this.config.bypassEndpoints?.includes(context.endpoint)) {
        return {
          allowed: true,
          action: 'allow',
          reason: 'Endpoint bypassed',
          policyResults: [],
        };
      }

      // Run all checks in sequence
      const checks = [
        this.checkTimeBased({
          userId: context.userId,
          agentId: context.agentId,
          timestamp: context.timestamp,
          timezone: 'UTC',
        }),
        this.checkAccessControl({
          userId: context.userId,
          agentId: context.agentId,
          endpoint: context.endpoint,
          method: context.method,
          headers: context.headers,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
        this.checkRateLimit({
          userId: context.userId,
          agentId: context.agentId,
          endpoint: context.endpoint,
          timestamp: context.timestamp,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
        this.checkSpending({
          userId: context.userId,
          agentId: context.agentId,
          amount: context.amount,
          currency: context.currency || 'USDC',
          network: context.network,
          endpoint: context.endpoint,
        }),
      ];

      const results = await Promise.all(checks);
      const allPolicyResults: PolicyCheckResult[] = results.flatMap(r => r.policyResults);

      // Check if any check failed
      const failedCheck = results.find(r => !r.allowed);
      if (failedCheck) {
        // Log payment denial
        await this.auditLogger.logPaymentDenied({
          userId: context.userId,
          agentId: context.agentId,
          amount: context.amount,
          currency: context.currency || 'USDC',
          network: context.network,
          endpoint: context.endpoint,
          reason: failedCheck.reason,
          policyResults: allPolicyResults,
        });

        return {
          allowed: false,
          action: failedCheck.action,
          reason: failedCheck.reason,
          policyResults: allPolicyResults,
        };
      }

      // All checks passed
      return {
        allowed: true,
        action: 'allow',
        reason: 'All enforcement checks passed',
        policyResults: allPolicyResults,
      };
    } catch (error) {
      await this.auditLogger.logSystemError({
        errorCode: 'PAYMENT_REQUEST_PROCESS_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        component: 'EnforcementEngine',
        context,
      });

      return {
        allowed: false,
        action: 'deny',
        reason: 'Payment request processing failed',
        policyResults: [],
      };
    }
  }

  /**
   * Evaluate a single policy
   */
  private async evaluatePolicy(
    policy: PolicyDefinition,
    context: any
  ): Promise<PolicyCheckResult> {
    try {
      // Check cache if enabled
      if (this.config.cachePolicyResults) {
        const cacheKey = `${policy.id}:${JSON.stringify(context)}`;
        const cached = this.policyResultCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.config.cacheTTL * 1000) {
          return cached.result;
        }
      }

      // Evaluate policy
      const result = await this.policyManager.evaluatePolicy(policy.id, context);

      const policyResult: PolicyCheckResult = {
        policyId: policy.id,
        action: result.allowed ? 'allow' : 'deny',
        reason: result.reason,
        remainingAmount: result.remainingAmount,
        resetTime: result.resetTime,
        violations: result.violations,
      };

      // Cache result if enabled
      if (this.config.cachePolicyResults) {
        const cacheKey = `${policy.id}:${JSON.stringify(context)}`;
        this.policyResultCache.set(cacheKey, {
          result: policyResult,
          timestamp: Date.now(),
        });
      }

      return policyResult;
    } catch (error) {
      return {
        policyId: policy.id,
        action: 'deny',
        reason: error instanceof Error ? error.message : 'Policy evaluation failed',
        violations: [{
          type: 'evaluation_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          severity: 'high',
        }],
      };
    }
  }

  /**
   * Clear policy result cache
   */
  clearCache(): void {
    this.policyResultCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.policyResultCache.size,
      hitRate: 0, // This would be calculated in a real implementation
    };
  }
}
