import { z } from 'zod';

// Service Configuration
export const ServiceConfigSchema = z.object({
    port: z.number().min(1).max(65535).default(3000),
    grpcPort: z.number().min(1).max(65535).default(50051),
    wsPort: z.number().min(1).max(65535).default(8080),
    nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
    logLevel: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
    enableTelemetry: z.boolean().default(true),
    telemetryEndpoint: z.string().url().optional(),
});

export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;

// Hedera Configuration
export const HederaServiceConfigSchema = z.object({
    network: z.enum(['testnet', 'previewnet', 'mainnet']),
    mirrorNodeUrl: z.string().url(),
    consensusNodeUrl: z.string().url(),
    operatorId: z.string(),
    operatorKey: z.string(),
    maxTransactionFee: z.string().default('2'),
    maxQueryPayment: z.string().default('1'),
    policyRegistryContractId: z.string(),
    policyTopicId: z.string(),
    paymentSettlementContractId: z.string(),
    paymentTopicId: z.string(),
});

export type HederaServiceConfig = z.infer<typeof HederaServiceConfigSchema>;

// Security Configuration
export const SecurityConfigSchema = z.object({
    jwtSecret: z.string(),
    apiKeySecret: z.string(),
    enableCors: z.boolean().default(true),
    corsOrigins: z.array(z.string()).default(['*']),
    enableHelmet: z.boolean().default(true),
    rateLimitWindowMs: z.number().default(900000), // 15 minutes
    rateLimitMax: z.number().default(100),
});

export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

// Database Configuration
export const DatabaseConfigSchema = z.object({
    url: z.string().optional(),
    type: z.enum(['postgresql', 'mysql', 'sqlite', 'memory']).default('memory'),
    host: z.string().optional(),
    port: z.number().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    database: z.string().optional(),
    ssl: z.boolean().default(false),
    poolSize: z.number().min(1).default(10),
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

// Complete Configuration
export const ConfigSchema = z.object({
    service: ServiceConfigSchema,
    hedera: HederaServiceConfigSchema,
    security: SecurityConfigSchema,
    database: DatabaseConfigSchema,
});

export type Config = z.infer<typeof ConfigSchema>;
