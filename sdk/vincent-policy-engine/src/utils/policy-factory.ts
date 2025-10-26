import { PolicyDefinition, PolicyType, PolicyConfig } from '../types';

/**
 * Create a spending limit policy
 */
export function createSpendingLimitPolicy(
  name: string,
  maxAmount: string,
  currency: string = 'USDC',
  network: string = 'base-sepolia',
  timeWindow: 'daily' | 'weekly' | 'monthly' | 'custom' = 'daily',
  customHours?: number
): Partial<PolicyDefinition> {
  return {
    name,
    type: 'spending_limit' as PolicyType,
    config: {
      type: 'spending_limit',
      config: {
        maxAmount,
        currency,
        network: network as any,
        timeWindow: {
          type: timeWindow,
          value: customHours,
        },
      },
    } as PolicyConfig,
  };
}

/**
 * Create a rate limit policy
 */
export function createRateLimitPolicy(
  name: string,
  requestsPerMinute: number,
  requestsPerHour?: number,
  requestsPerDay?: number,
  burstLimit?: number
): Partial<PolicyDefinition> {
  return {
    name,
    type: 'rate_limit' as PolicyType,
    config: {
      type: 'rate_limit',
      config: {
        requestsPerMinute,
        requestsPerHour,
        requestsPerDay,
        burstLimit,
      },
    } as PolicyConfig,
  };
}

/**
 * Create an access control policy
 */
export function createAccessControlPolicy(
  name: string,
  allowedOrigins?: string[],
  allowedUserAgents?: string[],
  requireAuthentication: boolean = true,
  allowedIPRanges?: string[]
): Partial<PolicyDefinition> {
  return {
    name,
    type: 'access_control' as PolicyType,
    config: {
      type: 'access_control',
      config: {
        allowedOrigins,
        allowedUserAgents,
        requireAuthentication,
        allowedIPRanges,
      },
    } as PolicyConfig,
  };
}

/**
 * Create a time-based policy
 */
export function createTimeBasedPolicy(
  name: string,
  startTime: string,
  endTime: string,
  timezone: string = 'UTC',
  allowedDays?: number[],
  allowedHours?: { start: number; end: number }
): Partial<PolicyDefinition> {
  return {
    name,
    type: 'time_based' as PolicyType,
    config: {
      type: 'time_based',
      config: {
        startTime,
        endTime,
        timezone,
        allowedDays,
        allowedHours,
      },
    } as PolicyConfig,
  };
}
