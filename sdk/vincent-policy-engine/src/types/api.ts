import { z } from 'zod';
import {
    PolicyDefinitionSchema,
    PolicyWithStatsSchema,
    DelegationDefinitionSchema,
    EnforcementResultSchema,
    AuditEventSchema,
    AuditSummarySchema,
    AuditQuerySchema
} from './index';

// API Response Base
export const ApiResponseSchema = z.object({
    success: z.boolean(),
    data: z.any().optional(),
    error: z.string().optional(),
    message: z.string().optional(),
    timestamp: z.string().datetime(),
    requestId: z.string().uuid(),
});

export type ApiResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    timestamp: string;
    requestId: string;
};

// Policy API Requests
export const CreatePolicyRequestSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    type: z.enum(['spending_limit', 'rate_limit', 'access_control', 'time_based']),
    config: z.any(),
    expiresAt: z.string().datetime().optional(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
});

export type CreatePolicyRequest = z.infer<typeof CreatePolicyRequestSchema>;

export const UpdatePolicyRequestSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    config: z.any().optional(),
    status: z.enum(['active', 'paused', 'revoked', 'expired']).optional(),
    expiresAt: z.string().datetime().optional(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
});

export type UpdatePolicyRequest = z.infer<typeof UpdatePolicyRequestSchema>;

export const GetPolicyResponseSchema = ApiResponseSchema.extend({
    data: PolicyWithStatsSchema.optional(),
});

export type GetPolicyResponse = ApiResponse<PolicyWithStatsSchema>;

export const ListPoliciesResponseSchema = ApiResponseSchema.extend({
    data: z.object({
        policies: z.array(PolicyWithStatsSchema),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
    }).optional(),
});

export type ListPoliciesResponse = ApiResponse<{
    policies: PolicyWithStatsSchema[];
    total: number;
    page: number;
    limit: number;
}>;

// Delegation API Requests
export const CreateDelegationRequestSchema = z.object({
    delegatee: z.string(),
    scope: z.object({
        policies: z.array(z.string().uuid()).optional(),
        maxAmount: z.string().optional(),
        timeLimit: z.number().optional(),
        allowedActions: z.array(z.string()).optional(),
        allowedNetworks: z.array(z.string()).optional(),
    }),
    expiresAt: z.string().datetime().optional(),
    metadata: z.record(z.any()).optional(),
});

export type CreateDelegationRequest = z.infer<typeof CreateDelegationRequestSchema>;

export const GetDelegationResponseSchema = ApiResponseSchema.extend({
    data: DelegationDefinitionSchema.optional(),
});

export type GetDelegationResponse = ApiResponse<DelegationDefinitionSchema>;

export const ListDelegationsResponseSchema = ApiResponseSchema.extend({
    data: z.object({
        delegations: z.array(DelegationDefinitionSchema),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
    }).optional(),
});

export type ListDelegationsResponse = ApiResponse<{
    delegations: DelegationDefinitionSchema[];
    total: number;
    page: number;
    limit: number;
}>;

// Enforcement API Requests
export const CheckSpendingRequestSchema = z.object({
    userId: z.string(),
    agentId: z.string().optional(),
    amount: z.string(),
    currency: z.string(),
    network: z.string(),
    endpoint: z.string(),
    metadata: z.record(z.any()).optional(),
});

export type CheckSpendingRequest = z.infer<typeof CheckSpendingRequestSchema>;

export const CheckSpendingResponseSchema = ApiResponseSchema.extend({
    data: EnforcementResultSchema.optional(),
});

export type CheckSpendingResponse = ApiResponse<EnforcementResultSchema>;

export const ProcessPaymentRequestSchema = z.object({
    userId: z.string(),
    agentId: z.string().optional(),
    amount: z.string(),
    currency: z.string(),
    network: z.string(),
    endpoint: z.string(),
    transactionHash: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

export type ProcessPaymentRequest = z.infer<typeof ProcessPaymentRequestSchema>;

export const ProcessPaymentResponseSchema = ApiResponseSchema.extend({
    data: EnforcementResultSchema.optional(),
});

export type ProcessPaymentResponse = ApiResponse<EnforcementResultSchema>;

// Audit API Requests
export const GetAuditEventsResponseSchema = ApiResponseSchema.extend({
    data: z.object({
        events: z.array(AuditEventSchema),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
    }).optional(),
});

export type GetAuditEventsResponse = ApiResponse<{
    events: AuditEventSchema[];
    total: number;
    page: number;
    limit: number;
}>;

export const GetAuditSummaryResponseSchema = ApiResponseSchema.extend({
    data: AuditSummarySchema.optional(),
});

export type GetAuditSummaryResponse = ApiResponse<AuditSummarySchema>;

// Health Check Response
export const HealthCheckResponseSchema = ApiResponseSchema.extend({
    data: z.object({
        status: z.enum(['healthy', 'degraded', 'unhealthy']),
        version: z.string(),
        uptime: z.number(),
        services: z.record(z.object({
            status: z.enum(['up', 'down', 'degraded']),
            lastCheck: z.string().datetime(),
            responseTime: z.number().optional(),
        })),
    }).optional(),
});

export type HealthCheckResponse = ApiResponse<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    uptime: number;
    services: Record<string, {
        status: 'up' | 'down' | 'degraded';
        lastCheck: string;
        responseTime?: number;
    }>;
}>;

// Error Response
export const ErrorResponseSchema = ApiResponseSchema.extend({
    success: z.literal(false),
    error: z.string(),
    code: z.string().optional(),
    details: z.record(z.any()).optional(),
});

export type ErrorResponse = {
    success: false;
    error: string;
    code?: string;
    details?: Record<string, any>;
    message?: string;
    timestamp: string;
    requestId: string;
};

// Pagination Query
export const PaginationQuerySchema = z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// Policy Query
export const PolicyQuerySchema = PaginationQuerySchema.extend({
    userId: z.string().optional(),
    agentId: z.string().optional(),
    type: z.enum(['spending_limit', 'rate_limit', 'access_control', 'time_based']).optional(),
    status: z.enum(['active', 'paused', 'revoked', 'expired']).optional(),
    tags: z.array(z.string()).optional(),
    search: z.string().optional(),
});

export type PolicyQuery = z.infer<typeof PolicyQuerySchema>;

// Delegation Query
export const DelegationQuerySchema = PaginationQuerySchema.extend({
    delegator: z.string().optional(),
    delegatee: z.string().optional(),
    status: z.enum(['active', 'revoked', 'expired', 'pending']).optional(),
    search: z.string().optional(),
});

export type DelegationQuery = z.infer<typeof DelegationQuerySchema>;
