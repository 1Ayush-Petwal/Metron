import { z } from 'zod';
import { Address } from 'viem';

// Delegation Status
export const DelegationStatusSchema = z.enum(['active', 'revoked', 'expired', 'pending']);
export type DelegationStatus = z.infer<typeof DelegationStatusSchema>;

// Delegation Scope
export const DelegationScopeSchema = z.object({
    policies: z.array(z.string().uuid()).optional(), // Specific policy IDs
    maxAmount: z.string().optional(), // Maximum delegation amount
    timeLimit: z.number().optional(), // Time limit in seconds
    allowedActions: z.array(z.string()).optional(), // Allowed actions
    allowedNetworks: z.array(z.string()).optional(), // Allowed networks
});

export type DelegationScope = z.infer<typeof DelegationScopeSchema>;

// Delegation Definition
export const DelegationDefinitionSchema = z.object({
    id: z.string().uuid(),
    delegator: z.string(), // User wallet address or DID
    delegatee: z.string(), // Agent wallet address or DID
    scope: DelegationScopeSchema,
    status: DelegationStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    expiresAt: z.string().datetime().optional(),
    signature: z.string(), // Cryptographic signature
    nonce: z.string(), // Nonce for replay protection
    metadata: z.record(z.any()).optional(),
});

export type DelegationDefinition = z.infer<typeof DelegationDefinitionSchema>;

// Delegation Request
export const DelegationRequestSchema = z.object({
    delegatee: z.string(),
    scope: DelegationScopeSchema,
    expiresAt: z.string().datetime().optional(),
    metadata: z.record(z.any()).optional(),
});

export type DelegationRequest = z.infer<typeof DelegationRequestSchema>;

// Delegation Response
export const DelegationResponseSchema = z.object({
    delegation: DelegationDefinitionSchema,
    signature: z.string(),
    transactionHash: z.string().optional(),
});

export type DelegationResponse = z.infer<typeof DelegationResponseSchema>;

// Delegation Verification Result
export const DelegationVerificationResultSchema = z.object({
    valid: z.boolean(),
    reason: z.string().optional(),
    delegation: DelegationDefinitionSchema.optional(),
    expired: z.boolean().default(false),
    revoked: z.boolean().default(false),
});

export type DelegationVerificationResult = z.infer<typeof DelegationVerificationResultSchema>;

// Wallet Information
export const WalletInfoSchema = z.object({
    address: z.string(),
    network: z.string(),
    type: z.enum(['evm', 'svm', 'hedera']),
    publicKey: z.string().optional(),
    did: z.string().optional(),
});

export type WalletInfo = z.infer<typeof WalletInfoSchema>;

// User-Agent Delegation Mapping
export const UserAgentDelegationSchema = z.object({
    userId: z.string(),
    agentId: z.string(),
    delegations: z.array(z.string().uuid()), // Delegation IDs
    activePolicies: z.array(z.string().uuid()), // Active policy IDs
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export type UserAgentDelegation = z.infer<typeof UserAgentDelegationSchema>;
