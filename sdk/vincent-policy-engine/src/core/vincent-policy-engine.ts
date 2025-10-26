import { 
  PolicyDefinition, 
  PolicyEvaluationResult,
  VincentPolicyContext,
  VincentPolicyResult,
  VincentPolicyDefinition,
  VincentAbilityDefinition,
  VincentClientConfig,
  VincentPolicyEvaluationRequest,
  VincentPolicyEvaluationResponse
} from '../types';
import { createVincentPolicy, createVincentAbility } from '@lit-protocol/vincent-ability-sdk';

export interface VincentPolicyEngineConfig {
  clientConfig: VincentClientConfig;
  policies: Map<string, VincentPolicyDefinition>;
  abilities: Map<string, VincentAbilityDefinition>;
}

export class VincentPolicyEngine {
  private clientConfig: VincentClientConfig;
  private policies: Map<string, VincentPolicyDefinition>;
  private abilities: Map<string, VincentAbilityDefinition;

  constructor(config: VincentPolicyEngineConfig) {
    this.clientConfig = config.clientConfig;
    this.policies = config.policies;
    this.abilities = config.abilities;
  }

  /**
   * Create a Vincent policy from a policy definition
   */
  createVincentPolicyFromDefinition(policyDef: PolicyDefinition): VincentPolicyDefinition {
    const policyType = policyDef.type;
    const config = policyDef.config;

    switch (policyType) {
      case 'spending_limit':
        return this.createSpendingLimitPolicy(policyDef, config);
      case 'rate_limit':
        return this.createRateLimitPolicy(policyDef, config);
      case 'access_control':
        return this.createAccessControlPolicy(policyDef, config);
      case 'time_based':
        return this.createTimeBasedPolicy(policyDef, config);
      default:
        throw new Error(`Unsupported policy type: ${policyType}`);
    }
  }

  /**
   * Create a spending limit policy
   */
  private createSpendingLimitPolicy(policyDef: PolicyDefinition, config: any): VincentPolicyDefinition {
    const { z } = require('zod');

    return createVincentPolicy({
      ipfsCid: `policy-${policyDef.id}`,
      packageName: `@metron/spending-limit-policy-${policyDef.id}`,

      abilityParamsSchema: z.object({
        amount: z.string(),
        currency: z.string(),
        network: z.string(),
        endpoint: z.string(),
      }),

      userParamsSchema: z.object({
        maxAmount: z.string(),
        timeWindow: z.object({
          type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
          value: z.number().optional(),
        }),
        perTransactionLimit: z.string().optional(),
        allowedEndpoints: z.array(z.string()).optional(),
        blockedEndpoints: z.array(z.string()).optional(),
      }),

      evalAllowResultSchema: z.object({
        allowed: z.boolean(),
        remainingAmount: z.string(),
        resetTime: z.string().datetime().optional(),
      }),

      evalDenyResultSchema: z.union([
        z.object({
          reason: z.literal('Amount exceeds maximum allowed'),
          requestedAmount: z.string(),
          maxAmount: z.string(),
        }),
        z.object({
          reason: z.literal('Amount exceeds per-transaction limit'),
          requestedAmount: z.string(),
          perTransactionLimit: z.string(),
        }),
        z.object({
          reason: z.literal('Endpoint not allowed'),
          endpoint: z.string(),
          allowedEndpoints: z.array(z.string()),
        }),
        z.object({
          reason: z.literal('Endpoint is blocked'),
          endpoint: z.string(),
          blockedEndpoints: z.array(z.string()),
        }),
        z.object({
          reason: z.literal('Time window exceeded'),
          timeWindow: z.string(),
          resetTime: z.string().datetime(),
        }),
      ]),

      commitParamsSchema: z.object({
        amount: z.string(),
        transactionHash: z.string().optional(),
      }),

      commitAllowResultSchema: z.object({
        transactionId: z.string(),
        timestamp: z.string().datetime(),
        remainingAmount: z.string(),
      }),

      commitDenyResultSchema: z.object({
        errorCode: z.string(),
        message: z.string(),
      }),

      evaluate: async ({ abilityParams, userParams }, context) => {
        const { amount, currency, network, endpoint } = abilityParams;
        const { maxAmount, timeWindow, perTransactionLimit, allowedEndpoints, blockedEndpoints } = userParams;

        // Check per-transaction limit
        if (perTransactionLimit && BigInt(amount) > BigInt(perTransactionLimit)) {
          return context.deny({
            reason: 'Amount exceeds per-transaction limit',
            requestedAmount: amount,
            perTransactionLimit,
          });
        }

        // Check endpoint restrictions
        if (allowedEndpoints && allowedEndpoints.length > 0 && !allowedEndpoints.includes(endpoint)) {
          return context.deny({
            reason: 'Endpoint not allowed',
            endpoint,
            allowedEndpoints,
          });
        }

        if (blockedEndpoints && blockedEndpoints.includes(endpoint)) {
          return context.deny({
            reason: 'Endpoint is blocked',
            endpoint,
            blockedEndpoints,
          });
        }

        // Check spending limit
        if (BigInt(amount) > BigInt(maxAmount)) {
          return context.deny({
            reason: 'Amount exceeds maximum allowed',
            requestedAmount: amount,
            maxAmount,
          });
        }

        // Calculate remaining amount and reset time
        const remainingAmount = (BigInt(maxAmount) - BigInt(amount)).toString();
        const resetTime = this.calculateResetTime(timeWindow);

        return context.allow({
          allowed: true,
          remainingAmount,
          resetTime,
        });
      },

      commit: async ({ amount, transactionHash }, context) => {
        try {
          // Here you would typically update the spending records
          // For now, we'll just return success
          return context.allow({
            transactionId: transactionHash || `tx_${Date.now()}`,
            timestamp: new Date().toISOString(),
            remainingAmount: '0', // This would be calculated based on current usage
          });
        } catch (error) {
          return context.deny({
            errorCode: 'COMMIT_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },
    });
  }

  /**
   * Create a rate limit policy
   */
  private createRateLimitPolicy(policyDef: PolicyDefinition, config: any): VincentPolicyDefinition {
    const { z } = require('zod');

    return createVincentPolicy({
      ipfsCid: `policy-${policyDef.id}`,
      packageName: `@metron/rate-limit-policy-${policyDef.id}`,

      abilityParamsSchema: z.object({
        endpoint: z.string(),
        timestamp: z.string().datetime(),
      }),

      userParamsSchema: z.object({
        requestsPerMinute: z.number().positive(),
        requestsPerHour: z.number().positive().optional(),
        requestsPerDay: z.number().positive().optional(),
        burstLimit: z.number().positive().optional(),
      }),

      evalAllowResultSchema: z.object({
        allowed: z.boolean(),
        remainingRequests: z.number(),
        resetTime: z.string().datetime(),
      }),

      evalDenyResultSchema: z.object({
        reason: z.string(),
        limitType: z.string(),
        limit: z.number(),
        resetTime: z.string().datetime(),
      }),

      evaluate: async ({ abilityParams, userParams }, context) => {
        const { endpoint, timestamp } = abilityParams;
        const { requestsPerMinute, requestsPerHour, requestsPerDay, burstLimit } = userParams;

        // This is a simplified rate limiting check
        // In a real implementation, you would check against actual usage records
        const currentTime = new Date(timestamp);
        const minuteStart = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), currentTime.getHours(), currentTime.getMinutes());
        const hourStart = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), currentTime.getHours());
        const dayStart = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());

        // Simulate checking current usage (in real implementation, query from storage)
        const currentMinuteUsage = 0; // This would be fetched from storage
        const currentHourUsage = 0;
        const currentDayUsage = 0;

        // Check minute limit
        if (currentMinuteUsage >= requestsPerMinute) {
          const resetTime = new Date(minuteStart.getTime() + 60000).toISOString();
          return context.deny({
            reason: 'Rate limit exceeded',
            limitType: 'per_minute',
            limit: requestsPerMinute,
            resetTime,
          });
        }

        // Check hour limit
        if (requestsPerHour && currentHourUsage >= requestsPerHour) {
          const resetTime = new Date(hourStart.getTime() + 3600000).toISOString();
          return context.deny({
            reason: 'Rate limit exceeded',
            limitType: 'per_hour',
            limit: requestsPerHour,
            resetTime,
          });
        }

        // Check day limit
        if (requestsPerDay && currentDayUsage >= requestsPerDay) {
          const resetTime = new Date(dayStart.getTime() + 86400000).toISOString();
          return context.deny({
            reason: 'Rate limit exceeded',
            limitType: 'per_day',
            limit: requestsPerDay,
            resetTime,
          });
        }

        const remainingRequests = requestsPerMinute - currentMinuteUsage - 1;
        const resetTime = new Date(minuteStart.getTime() + 60000).toISOString();

        return context.allow({
          allowed: true,
          remainingRequests,
          resetTime,
        });
      },
    });
  }

  /**
   * Create an access control policy
   */
  private createAccessControlPolicy(policyDef: PolicyDefinition, config: any): VincentPolicyDefinition {
    const { z } = require('zod');

    return createVincentPolicy({
      ipfsCid: `policy-${policyDef.id}`,
      packageName: `@metron/access-control-policy-${policyDef.id}`,

      abilityParamsSchema: z.object({
        endpoint: z.string(),
        method: z.string(),
        headers: z.record(z.string()),
        ipAddress: z.string().optional(),
        userAgent: z.string().optional(),
      }),

      userParamsSchema: z.object({
        allowedOrigins: z.array(z.string()).optional(),
        allowedUserAgents: z.array(z.string()).optional(),
        requireAuthentication: z.boolean().default(true),
        allowedIPRanges: z.array(z.string()).optional(),
      }),

      evalAllowResultSchema: z.object({
        allowed: z.boolean(),
        reason: z.string().optional(),
      }),

      evalDenyResultSchema: z.object({
        reason: z.string(),
        details: z.record(z.any()).optional(),
      }),

      evaluate: async ({ abilityParams, userParams }, context) => {
        const { endpoint, method, headers, ipAddress, userAgent } = abilityParams;
        const { allowedOrigins, allowedUserAgents, requireAuthentication, allowedIPRanges } = userParams;

        // Check origin restrictions
        if (allowedOrigins && allowedOrigins.length > 0) {
          const origin = headers['origin'] || headers['Origin'];
          if (!origin || !allowedOrigins.includes(origin)) {
            return context.deny({
              reason: 'Origin not allowed',
              details: { origin, allowedOrigins },
            });
          }
        }

        // Check user agent restrictions
        if (allowedUserAgents && allowedUserAgents.length > 0) {
          if (!userAgent || !allowedUserAgents.some(ua => userAgent.includes(ua))) {
            return context.deny({
              reason: 'User agent not allowed',
              details: { userAgent, allowedUserAgents },
            });
          }
        }

        // Check IP range restrictions
        if (allowedIPRanges && allowedIPRanges.length > 0) {
          if (!ipAddress || !this.isIPInRanges(ipAddress, allowedIPRanges)) {
            return context.deny({
              reason: 'IP address not allowed',
              details: { ipAddress, allowedIPRanges },
            });
          }
        }

        // Check authentication requirement
        if (requireAuthentication) {
          const authHeader = headers['authorization'] || headers['Authorization'];
          if (!authHeader) {
            return context.deny({
              reason: 'Authentication required',
              details: { requireAuthentication },
            });
          }
        }

        return context.allow({
          allowed: true,
          reason: 'Access granted',
        });
      },
    });
  }

  /**
   * Create a time-based policy
   */
  private createTimeBasedPolicy(policyDef: PolicyDefinition, config: any): VincentPolicyDefinition {
    const { z } = require('zod');

    return createVincentPolicy({
      ipfsCid: `policy-${policyDef.id}`,
      packageName: `@metron/time-based-policy-${policyDef.id}`,

      abilityParamsSchema: z.object({
        timestamp: z.string().datetime(),
        timezone: z.string().default('UTC'),
      }),

      userParamsSchema: z.object({
        startTime: z.string().datetime(),
        endTime: z.string().datetime(),
        timezone: z.string().default('UTC'),
        allowedDays: z.array(z.number().min(0).max(6)).optional(),
        allowedHours: z.object({
          start: z.number().min(0).max(23),
          end: z.number().min(0).max(23),
        }).optional(),
      }),

      evalAllowResultSchema: z.object({
        allowed: z.boolean(),
        reason: z.string().optional(),
      }),

      evalDenyResultSchema: z.object({
        reason: z.string(),
        details: z.record(z.any()).optional(),
      }),

      evaluate: async ({ abilityParams, userParams }, context) => {
        const { timestamp, timezone } = abilityParams;
        const { startTime, endTime, allowedDays, allowedHours } = userParams;

        const currentTime = new Date(timestamp);
        const start = new Date(startTime);
        const end = new Date(endTime);

        // Check if current time is within allowed time range
        if (currentTime < start || currentTime > end) {
          return context.deny({
            reason: 'Outside allowed time range',
            details: { currentTime: currentTime.toISOString(), startTime, endTime },
          });
        }

        // Check allowed days
        if (allowedDays && allowedDays.length > 0) {
          const dayOfWeek = currentTime.getDay();
          if (!allowedDays.includes(dayOfWeek)) {
            return context.deny({
              reason: 'Day not allowed',
              details: { dayOfWeek, allowedDays },
            });
          }
        }

        // Check allowed hours
        if (allowedHours) {
          const currentHour = currentTime.getHours();
          if (currentHour < allowedHours.start || currentHour > allowedHours.end) {
            return context.deny({
              reason: 'Hour not allowed',
              details: { currentHour, allowedHours },
            });
          }
        }

        return context.allow({
          allowed: true,
          reason: 'Time-based access granted',
        });
      },
    });
  }

  /**
   * Evaluate a policy using Vincent engine
   */
  async evaluatePolicy(
    policyDef: PolicyDefinition,
    context: any
  ): Promise<PolicyEvaluationResult> {
    try {
      // Get or create Vincent policy
      let vincentPolicy = this.policies.get(policyDef.id);
      if (!vincentPolicy) {
        vincentPolicy = this.createVincentPolicyFromDefinition(policyDef);
        this.policies.set(policyDef.id, vincentPolicy);
      }

      // Create evaluation request
      const request: VincentPolicyEvaluationRequest = {
        policyId: policyDef.id,
        abilityParams: context.abilityParams || {},
        userParams: context.userParams || {},
        delegation: context.delegation || {
          delegator: context.userId || '',
          delegatee: context.agentId || '',
          scope: {},
        },
        metadata: context.metadata || {},
      };

      // Evaluate policy
      const result = await vincentPolicy.evaluate(
        { abilityParams: request.abilityParams, userParams: request.userParams },
        {
          delegation: request.delegation,
          allow: (data: any) => ({ allow: true, result: data }),
          deny: (data: any) => ({ allow: false, result: data }),
        }
      );

      return {
        allowed: result.allow,
        reason: result.allow ? undefined : result.result.reason,
        remainingAmount: result.allow ? result.result.remainingAmount : undefined,
        resetTime: result.allow ? result.result.resetTime : undefined,
        violations: result.allow ? undefined : [{
          type: 'policy_violation',
          message: result.result.reason || 'Policy violation',
          severity: 'medium' as const,
        }],
      };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : 'Policy evaluation failed',
        violations: [{
          type: 'evaluation_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          severity: 'high' as const,
        }],
      };
    }
  }

  /**
   * Calculate reset time for time windows
   */
  private calculateResetTime(timeWindow: any): string | undefined {
    const now = new Date();
    
    switch (timeWindow.type) {
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString();
      case 'custom':
        return new Date(now.getTime() + (timeWindow.value || 0) * 60 * 60 * 1000).toISOString();
      default:
        return undefined;
    }
  }

  /**
   * Check if IP address is in allowed ranges
   */
  private isIPInRanges(ip: string, ranges: string[]): boolean {
    // Simplified IP range checking
    // In a real implementation, you would use a proper IP range library
    return ranges.some(range => {
      if (range.includes('/')) {
        // CIDR notation
        // This would need proper CIDR implementation
        return false;
      } else if (range.includes('-')) {
        // IP range
        const [start, end] = range.split('-');
        return this.compareIPs(ip, start) >= 0 && this.compareIPs(ip, end) <= 0;
      } else {
        // Exact match
        return ip === range;
      }
    });
  }

  /**
   * Compare two IP addresses
   */
  private compareIPs(ip1: string, ip2: string): number {
    const parts1 = ip1.split('.').map(Number);
    const parts2 = ip2.split('.').map(Number);
    
    for (let i = 0; i < 4; i++) {
      if (parts1[i] < parts2[i]) return -1;
      if (parts1[i] > parts2[i]) return 1;
    }
    
    return 0;
  }
}
