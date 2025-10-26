import { PolicyDefinition, PolicyConfig } from '../types';

/**
 * Calculate hash for a policy
 */
export function calculatePolicyHash(policy: PolicyDefinition): string {
  const policyData = {
    id: policy.id,
    name: policy.name,
    type: policy.type,
    config: policy.config,
    status: policy.status,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };

  // Simple hash calculation (in real implementation, use proper cryptographic hash)
  const dataString = JSON.stringify(policyData);
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Validate policy configuration
 */
export function validatePolicyConfig(config: PolicyConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (config.type) {
    case 'spending_limit':
      if (!config.config.maxAmount || config.config.maxAmount === '0') {
        errors.push('Max amount is required for spending limit policy');
      }
      if (!config.config.currency) {
        errors.push('Currency is required for spending limit policy');
      }
      if (!config.config.network) {
        errors.push('Network is required for spending limit policy');
      }
      break;

    case 'rate_limit':
      if (!config.config.requestsPerMinute || config.config.requestsPerMinute <= 0) {
        errors.push('Requests per minute must be greater than 0');
      }
      if (config.config.requestsPerHour && config.config.requestsPerHour <= 0) {
        errors.push('Requests per hour must be greater than 0');
      }
      if (config.config.requestsPerDay && config.config.requestsPerDay <= 0) {
        errors.push('Requests per day must be greater than 0');
      }
      break;

    case 'access_control':
      // Access control policies are optional, no required fields
      break;

    case 'time_based':
      if (!config.config.startTime) {
        errors.push('Start time is required for time-based policy');
      }
      if (!config.config.endTime) {
        errors.push('End time is required for time-based policy');
      }
      if (config.config.startTime && config.config.endTime) {
        const start = new Date(config.config.startTime);
        const end = new Date(config.config.endTime);
        if (start >= end) {
          errors.push('Start time must be before end time');
        }
      }
      break;

    default:
      errors.push(`Unknown policy type: ${(config as any).type}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if policy is expired
 */
export function isPolicyExpired(policy: PolicyDefinition): boolean {
  if (!policy.expiresAt) {
    return false;
  }

  return new Date(policy.expiresAt) < new Date();
}

/**
 * Check if policy is active
 */
export function isPolicyActive(policy: PolicyDefinition): boolean {
  return policy.status === 'active' && !isPolicyExpired(policy);
}

/**
 * Get policy summary
 */
export function getPolicySummary(policy: PolicyDefinition): string {
  const parts: string[] = [];

  parts.push(`${policy.type.replace('_', ' ')} policy`);

  switch (policy.type) {
    case 'spending_limit':
      const spendingConfig = policy.config as any;
      parts.push(`max ${spendingConfig.config.maxAmount} ${spendingConfig.config.currency}`);
      if (spendingConfig.config.timeWindow) {
        parts.push(`per ${spendingConfig.config.timeWindow.type}`);
      }
      break;

    case 'rate_limit':
      const rateConfig = policy.config as any;
      parts.push(`${rateConfig.config.requestsPerMinute} req/min`);
      if (rateConfig.config.requestsPerHour) {
        parts.push(`${rateConfig.config.requestsPerHour} req/hour`);
      }
      if (rateConfig.config.requestsPerDay) {
        parts.push(`${rateConfig.config.requestsPerDay} req/day`);
      }
      break;

    case 'access_control':
      const accessConfig = policy.config as any;
      if (accessConfig.config.allowedOrigins?.length > 0) {
        parts.push(`${accessConfig.config.allowedOrigins.length} origins`);
      }
      if (accessConfig.config.requireAuthentication) {
        parts.push('auth required');
      }
      break;

    case 'time_based':
      const timeConfig = policy.config as any;
      parts.push(`${timeConfig.config.startTime} to ${timeConfig.config.endTime}`);
      if (timeConfig.config.allowedDays?.length > 0) {
        parts.push(`${timeConfig.config.allowedDays.length} days`);
      }
      break;
  }

  if (policy.status !== 'active') {
    parts.push(`(${policy.status})`);
  }

  return parts.join(' ');
}

/**
 * Merge policy configurations
 */
export function mergePolicyConfigs(
  base: PolicyConfig,
  override: Partial<PolicyConfig>
): PolicyConfig {
  if (base.type !== override.type) {
    throw new Error('Cannot merge policies of different types');
  }

  return {
    type: base.type,
    config: {
      ...base.config,
      ...override.config,
    },
  } as PolicyConfig;
}

/**
 * Get policy usage percentage
 */
export function getPolicyUsagePercentage(
  totalSpent: string,
  maxAmount: string
): number {
  try {
    const spent = BigInt(totalSpent);
    const max = BigInt(maxAmount);
    
    if (max === 0n) {
      return 0;
    }

    const percentage = Number((spent * 100n) / max);
    return Math.min(percentage, 100);
  } catch (error) {
    return 0;
  }
}
