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

// Audit Event Types
export const AuditEventTypeSchema = z.enum([
    'policy_created',
    'policy_updated',
    'policy_revoked',
    'policy_evaluated',
    'delegation_created',
    'delegation_revoked',
    'payment_processed',
    'payment_denied',
    'violation_detected',
    'system_error',
]);

export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

// Audit Event Severity
export const AuditEventSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type AuditEventSeverity = z.infer<typeof AuditEventSeveritySchema>;

// Base Audit Event
export const BaseAuditEventSchema = z.object({
    id: z.string().uuid(),
    type: AuditEventTypeSchema,
    severity: AuditEventSeveritySchema,
    timestamp: z.string().datetime(),
    userId: z.string(),
    agentId: z.string().optional(),
    sessionId: z.string().optional(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

export type BaseAuditEvent = z.infer<typeof BaseAuditEventSchema>;

// Policy Audit Event
export const PolicyAuditEventSchema = BaseAuditEventSchema.extend({
    type: z.literal('policy_created').or(z.literal('policy_updated')).or(z.literal('policy_revoked')),
    policyId: z.string().uuid(),
    policyName: z.string(),
    changes: z.record(z.any()).optional(),
    reason: z.string().optional(),
});

export type PolicyAuditEvent = z.infer<typeof PolicyAuditEventSchema>;

// Delegation Audit Event
export const DelegationAuditEventSchema = BaseAuditEventSchema.extend({
    type: z.literal('delegation_created').or(z.literal('delegation_revoked')),
    delegationId: z.string().uuid(),
    delegator: z.string(),
    delegatee: z.string(),
    scope: z.record(z.any()),
    reason: z.string().optional(),
});

export type DelegationAuditEvent = z.infer<typeof DelegationAuditEventSchema>;

// Payment Audit Event
export const PaymentAuditEventSchema = BaseAuditEventSchema.extend({
    type: z.literal('payment_processed').or(z.literal('payment_denied')),
    transactionHash: z.string().optional(),
    amount: z.string(),
    currency: z.string(),
    network: z.nativeEnum(Network),
    endpoint: z.string(),
    policyResults: z.array(z.record(z.any())).optional(),
    reason: z.string().optional(),
});

export type PaymentAuditEvent = z.infer<typeof PaymentAuditEventSchema>;

// Policy Evaluation Audit Event
export const PolicyEvaluationAuditEventSchema = BaseAuditEventSchema.extend({
    type: z.literal('policy_evaluated'),
    policyId: z.string().uuid(),
    policyName: z.string(),
    allowed: z.boolean(),
    reason: z.string().optional(),
    remainingAmount: z.string().optional(),
    violations: z.array(z.record(z.any())).optional(),
});

export type PolicyEvaluationAuditEvent = z.infer<typeof PolicyEvaluationAuditEventSchema>;

// Violation Audit Event
export const ViolationAuditEventSchema = BaseAuditEventSchema.extend({
    type: z.literal('violation_detected'),
    policyId: z.string().uuid(),
    policyName: z.string(),
    violationType: z.string(),
    violationMessage: z.string(),
    action: z.string(),
    context: z.record(z.any()),
});

export type ViolationAuditEvent = z.infer<typeof ViolationAuditEventSchema>;

// System Error Audit Event
export const SystemErrorAuditEventSchema = BaseAuditEventSchema.extend({
    type: z.literal('system_error'),
    errorCode: z.string(),
    errorMessage: z.string(),
    stackTrace: z.string().optional(),
    component: z.string(),
    context: z.record(z.any()).optional(),
});

export type SystemErrorAuditEvent = z.infer<typeof SystemErrorAuditEventSchema>;

// Union of all audit events
export const AuditEventSchema = z.discriminatedUnion('type', [
    PolicyAuditEventSchema,
    DelegationAuditEventSchema,
    PaymentAuditEventSchema,
    PolicyEvaluationAuditEventSchema,
    ViolationAuditEventSchema,
    SystemErrorAuditEventSchema,
]);

export type AuditEvent = z.infer<typeof AuditEventSchema>;

// Audit Query Parameters
export const AuditQuerySchema = z.object({
    userId: z.string().optional(),
    agentId: z.string().optional(),
    type: AuditEventTypeSchema.optional(),
    severity: AuditEventSeveritySchema.optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    limit: z.number().min(1).max(1000).default(100),
    offset: z.number().min(0).default(0),
    sortBy: z.enum(['timestamp', 'severity', 'type']).default('timestamp'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type AuditQuery = z.infer<typeof AuditQuerySchema>;

// Audit Summary
export const AuditSummarySchema = z.object({
    totalEvents: z.number(),
    eventsByType: z.record(z.number()),
    eventsBySeverity: z.record(z.number()),
    recentViolations: z.number(),
    totalSpent: z.string(),
    totalTransactions: z.number(),
    timeRange: z.object({
        start: z.string().datetime(),
        end: z.string().datetime(),
    }),
});

export type AuditSummary = z.infer<typeof AuditSummarySchema>;
