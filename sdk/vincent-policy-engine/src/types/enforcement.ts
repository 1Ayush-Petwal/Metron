import { z } from 'zod';

// Define Network enum locally since we can't import from @metron/x402 in this context
const NetworkSchema = z.enum([
    'base-sepolia',
    'base',
    'avalanche-fuji',
    'avalanche',
    'iotex',
    'solana-devnet',
    'solana',
    'sei',
    'sei-testnet',
    'polygon'
]);
export type Network = z.infer<typeof NetworkSchema>;

// Enforcement Action
export const EnforcementActionSchema = z.enum(['allow', 'deny', 'challenge', 'rate_limit']);
export type EnforcementAction = z.infer<typeof EnforcementActionSchema>;

// Payment Request Context
export const PaymentRequestContextSchema = z.object({
    requestId: z.string().uuid(),
    userId: z.string(),
    agentId: z.string().optional(),
    endpoint: z.string(),
    method: z.string(),
    headers: z.record(z.string()),
    body: z.any().optional(),
    timestamp: z.string().datetime(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    network: z.nativeEnum(Network),
    amount: z.string(),
    currency: z.string(),
    transactionHash: z.string().optional(),
});

export type PaymentRequestContext = z.infer<typeof PaymentRequestContextSchema>;

// Policy Check Result
export const PolicyCheckResultSchema = z.object({
    policyId: z.string().uuid(),
    action: EnforcementActionSchema,
    reason: z.string().optional(),
    remainingAmount: z.string().optional(),
    resetTime: z.string().datetime().optional(),
    violations: z.array(z.object({
        type: z.string(),
        message: z.string(),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
    })).optional(),
    metadata: z.record(z.any()).optional(),
});

export type PolicyCheckResult = z.infer<typeof PolicyCheckResultSchema>;

// Enforcement Result
export const EnforcementResultSchema = z.object({
    allowed: z.boolean(),
    action: EnforcementActionSchema,
    reason: z.string().optional(),
    policyResults: z.array(PolicyCheckResultSchema),
    totalRemainingAmount: z.string().optional(),
    nextResetTime: z.string().datetime().optional(),
    challengeRequired: z.boolean().default(false),
    challengeData: z.any().optional(),
    metadata: z.record(z.any()).optional(),
});

export type EnforcementResult = z.infer<typeof EnforcementResultSchema>;

// Spending Check Context
export const SpendingCheckContextSchema = z.object({
    userId: z.string(),
    agentId: z.string().optional(),
    amount: z.string(),
    currency: z.string(),
    network: z.nativeEnum(Network),
    endpoint: z.string(),
    timestamp: z.string().datetime(),
    metadata: z.record(z.any()).optional(),
});

export type SpendingCheckContext = z.infer<typeof SpendingCheckContextSchema>;

// Rate Limit Check Context
export const RateLimitCheckContextSchema = z.object({
    userId: z.string(),
    agentId: z.string().optional(),
    endpoint: z.string(),
    timestamp: z.string().datetime(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

export type RateLimitCheckContext = z.infer<typeof RateLimitCheckContextSchema>;

// Access Control Check Context
export const AccessControlCheckContextSchema = z.object({
    userId: z.string(),
    agentId: z.string().optional(),
    endpoint: z.string(),
    method: z.string(),
    headers: z.record(z.string()),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    timestamp: z.string().datetime(),
    metadata: z.record(z.any()).optional(),
});

export type AccessControlCheckContext = z.infer<typeof AccessControlCheckContextSchema>;

// Time-based Check Context
export const TimeBasedCheckContextSchema = z.object({
    userId: z.string(),
    agentId: z.string().optional(),
    timestamp: z.string().datetime(),
    timezone: z.string().default('UTC'),
    metadata: z.record(z.any()).optional(),
});

export type TimeBasedCheckContext = z.infer<typeof TimeBasedCheckContextSchema>;

// Enforcement Middleware Configuration
export const EnforcementMiddlewareConfigSchema = z.object({
    enabled: z.boolean().default(true),
    strictMode: z.boolean().default(false), // Fail fast on any policy violation
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    cachePolicyResults: z.boolean().default(true),
    cacheTTL: z.number().default(300), // 5 minutes
    bypassEndpoints: z.array(z.string()).optional(),
    requireDelegation: z.boolean().default(true),
    challengeTimeout: z.number().default(300), // 5 minutes
});

export type EnforcementMiddlewareConfig = z.infer<typeof EnforcementMiddlewareConfigSchema>;
