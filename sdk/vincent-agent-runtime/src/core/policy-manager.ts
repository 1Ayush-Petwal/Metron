import type { 
  PolicyManager, 
  PolicyContext, 
  PolicyEvaluationResult,
  PolicyViolation 
} from '../types/policy';
import type { VincentPolicyEngine } from '@metron/vincent-policy-engine';

export class VincentPolicyManager implements PolicyManager {
  private policyEngine: VincentPolicyEngine;

  constructor(policyEngine: VincentPolicyEngine) {
    this.policyEngine = policyEngine;
  }

  async evaluatePolicies(context: PolicyContext): Promise<PolicyEvaluationResult> {
    try {
      // Convert context to Vincent policy evaluation format
      const vincentContext = {
        abilityParams: {
          amount: context.amount || '0',
          currency: context.currency || 'USDC',
          network: context.network || 'ethereum',
          endpoint: context.requestUrl,
        },
        userParams: {
          maxAmount: '1000000', // Default 1 USDC
          timeWindow: {
            type: 'daily',
          },
        },
        delegation: {
          delegator: context.delegatorId,
          delegatee: context.agentId,
          scope: {},
        },
        metadata: context.metadata,
      };

      // Create a mock policy definition for evaluation
      const policyDef = {
        id: 'default-spending-limit',
        type: 'spending_limit',
        config: {
          maxAmount: '1000000',
          timeWindow: { type: 'daily' },
        },
      };

      // Evaluate policy using Vincent engine
      const result = await this.policyEngine.evaluatePolicy(policyDef, vincentContext);

      return {
        allowed: result.allowed,
        reason: result.reason,
        remainingAmount: result.remainingAmount,
        resetTime: result.resetTime,
        violations: result.violations,
        metadata: {
          policyId: policyDef.id,
          evaluationTime: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : 'Policy evaluation failed',
        violations: [{
          type: 'evaluation_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          severity: 'high',
        }],
        metadata: {
          error: true,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async getActivePolicies(agentId: string): Promise<any[]> {
    // In a real implementation, this would fetch active policies for the agent
    // For now, return a default policy
    return [{
      id: 'default-spending-limit',
      type: 'spending_limit',
      config: {
        maxAmount: '1000000',
        timeWindow: { type: 'daily' },
      },
    }];
  }

  async updatePolicy(policyId: string, policy: any): Promise<void> {
    // In a real implementation, this would update the policy in storage
    console.log(`Updating policy ${policyId}:`, policy);
  }

  async removePolicy(policyId: string): Promise<void> {
    // In a real implementation, this would remove the policy from storage
    console.log(`Removing policy ${policyId}`);
  }
}
