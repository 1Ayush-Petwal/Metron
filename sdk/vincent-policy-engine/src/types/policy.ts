import { z } from 'zod';
import { Network } from '@metron/x402';

// Policy Status
export const PolicyStatusSchema = z.enum(['active', 'paused', 'revoked', 'expired']);
export type PolicyStatus = z.infer<typeof PolicyStatusSchema>;

// Policy Types
export const PolicyTypeSchema = z.enum(['spending_limit', 'rate_limit', 'access_control', 'time_based']);
export type PolicyType = z.infer<typeof PolicyTypeSchema>;

// Spending Policy Configuration
export const SpendingPolicyConfigSchema = z.object({
    maxAmount: z.string(), // Amount in atomic units (e.g., "5000000" for $5 USDC)
    currency: z.string().default('USDC'),
    network: z.nativeEnum(Network),
    timeWindow: z.object({
        type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
        value: z.number().optional(), // For custom time windows in hours
    }),
    perTransactionLimit: z.string().optional(), // Max per single transaction
    allowedEndpoints: z.array(z.string()).optional(), // Specific API endpoints
    blockedEndpoints: z.array(z.string()).optional(), // Blocked API endpoints
});

export type SpendingPolicyConfig = z.infer<typeof SpendingPolicyConfigSchema>;

// Rate Limiting Policy Configuration
export const RateLimitPolicyConfigSchema = z.object({
    requestsPerMinute: z.number().positive(),
    requestsPerHour: z.number().positive().optional(),
    requestsPerDay: z.number().positive().optional(),
    burstLimit: z.number().positive().optional(),
});

export type RateLimitPolicyConfig = z.infer<typeof RateLimitPolicyConfigSchema>;

// Time-based Policy Configuration
export const TimeBasedPolicyConfigSchema = z.object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    timezone: z.string().default('UTC'),
    allowedDays: z.array(z.number().min(0).max(6)).optional(), // 0 = Sunday, 6 = Saturday
    allowedHours: z.object({
        start: z.number().min(0).max(23),
        end: z.number().min(0).max(23),
    }).optional(),
});

export type TimeBasedPolicyConfig = z.infer<typeof TimeBasedPolicyConfigSchema>;

// Access Control Policy Configuration
export const AccessControlPolicyConfigSchema = z.object({
    allowedOrigins: z.array(z.string()).optional(),
    allowedUserAgents: z.array(z.string()).optional(),
    requireAuthentication: z.boolean().default(true),
    allowedIPRanges: z.array(z.string()).optional(),
});

export type AccessControlPolicyConfig = z.infer<typeof AccessControlPolicyConfigSchema>;

// Policy Configuration Union
export const PolicyConfigSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('spending_limit'),
        config: SpendingPolicyConfigSchema,
    }),
    z.object({
        type: z.literal('rate_limit'),
        config: RateLimitPolicyConfigSchema,
    }),
    z.object({
        type: z.literal('time_based'),
        config: TimeBasedPolicyConfigSchema,
    }),
    z.object({
        type: z.literal('access_control'),
        config: AccessControlPolicyConfigSchema,
    }),
]);

export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

// Policy Definition
export const PolicyDefinitionSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    type: PolicyTypeSchema,
    config: PolicyConfigSchema,
    status: PolicyStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    expiresAt: z.string().datetime().optional(),
    createdBy: z.string(), // User/Agent ID
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
});

export type PolicyDefinition = z.infer<typeof PolicyDefinitionSchema>;

// Policy Evaluation Result
export const PolicyEvaluationResultSchema = z.object({
    allowed: z.boolean(),
    reason: z.string().optional(),
    remainingAmount: z.string().optional(),
    resetTime: z.string().datetime().optional(),
    violations: z.array(z.object({
        type: z.string(),
        message: z.string(),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
    })).optional(),
});

export type PolicyEvaluationResult = z.infer<typeof PolicyEvaluationResultSchema>;

// Policy Usage Statistics
export const PolicyUsageStatsSchema = z.object({
    totalSpent: z.string(),
    totalTransactions: z.number(),
    lastUsed: z.string().datetime().optional(),
    currentPeriodSpent: z.string(),
    currentPeriodTransactions: z.number(),
    violations: z.number().default(0),
});

export type PolicyUsageStats = z.infer<typeof PolicyUsageStatsSchema>;

// Policy with Usage Stats
export const PolicyWithStatsSchema = PolicyDefinitionSchema.extend({
    usage: PolicyUsageStatsSchema,
});

export type PolicyWithStats = z.infer<typeof PolicyWithStatsSchema>;
