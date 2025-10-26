import { z } from 'zod';

// API Response Base
export const ApiResponseSchema = z.object({
    success: z.boolean(),
    data: z.any().optional(),
    error: z.string().optional(),
    timestamp: z.string().datetime(),
    requestId: z.string().uuid(),
});

export type ApiResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: string;
    requestId: string;
};

// Pagination
export const PaginationSchema = z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(10),
    total: z.number().min(0),
    hasMore: z.boolean(),
});

export type Pagination = z.infer<typeof PaginationSchema>;

// Paginated Response
export const PaginatedResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(z.any()),
    pagination: PaginationSchema,
    error: z.string().optional(),
    timestamp: z.string().datetime(),
    requestId: z.string().uuid(),
});

export type PaginatedResponse<T = any> = {
    success: boolean;
    data: T[];
    pagination: Pagination;
    error?: string;
    timestamp: string;
    requestId: string;
};

// Health Check
export const HealthCheckSchema = z.object({
    status: z.enum(['healthy', 'unhealthy', 'degraded']),
    timestamp: z.string().datetime(),
    services: z.record(z.object({
        status: z.enum(['healthy', 'unhealthy', 'degraded']),
        lastCheck: z.string().datetime(),
        details: z.record(z.any()).optional(),
    })),
    version: z.string(),
    uptime: z.number(),
});

export type HealthCheck = z.infer<typeof HealthCheckSchema>;

// Error Response
export const ErrorResponseSchema = z.object({
    success: z.literal(false),
    error: z.string(),
    code: z.string().optional(),
    details: z.record(z.any()).optional(),
    timestamp: z.string().datetime(),
    requestId: z.string().uuid(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Authentication
export const AuthTokenSchema = z.object({
    token: z.string(),
    type: z.enum(['bearer', 'api_key']),
    expiresAt: z.string().datetime().optional(),
    scopes: z.array(z.string()).optional(),
});

export type AuthToken = z.infer<typeof AuthTokenSchema>;

// API Key
export const ApiKeySchema = z.object({
    keyId: z.string().uuid(),
    name: z.string(),
    key: z.string(),
    scopes: z.array(z.string()),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime().optional(),
    lastUsed: z.string().datetime().optional(),
});

export type ApiKey = z.infer<typeof ApiKeySchema>;
