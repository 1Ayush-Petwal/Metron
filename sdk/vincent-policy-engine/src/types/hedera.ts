import { z } from 'zod';

// Hedera Network Configuration
export const HederaNetworkConfigSchema = z.object({
    network: z.enum(['testnet', 'previewnet', 'mainnet']),
    mirrorNodeUrl: z.string().url(),
    consensusNodeUrl: z.string().url(),
    operatorId: z.string(),
    operatorKey: z.string(),
    maxTransactionFee: z.string().default('2'), // HBAR
    maxQueryPayment: z.string().default('1'), // HBAR
});

export type HederaNetworkConfig = z.infer<typeof HederaNetworkConfigSchema>;

// Hedera Account Information
export const HederaAccountInfoSchema = z.object({
    accountId: z.string(),
    balance: z.string(),
    key: z.string(),
    isDeleted: z.boolean(),
    autoRenewPeriod: z.string(),
    proxyAccountId: z.string().optional(),
    proxyReceived: z.string().optional(),
});

export type HederaAccountInfo = z.infer<typeof HederaAccountInfoSchema>;

// Hedera Transaction Record
export const HederaTransactionRecordSchema = z.object({
    transactionId: z.string(),
    consensusTimestamp: z.string(),
    transactionHash: z.string(),
    transactionFee: z.string(),
    status: z.string(),
    memo: z.string().optional(),
    transfers: z.array(z.object({
        accountId: z.string(),
        amount: z.string(),
    })),
    tokenTransfers: z.array(z.object({
        tokenId: z.string(),
        accountId: z.string(),
        amount: z.string(),
    })).optional(),
    nftTransfers: z.array(z.object({
        tokenId: z.string(),
        senderAccountId: z.string(),
        receiverAccountId: z.string(),
        serialNumber: z.string(),
    })).optional(),
});

export type HederaTransactionRecord = z.infer<typeof HederaTransactionRecordSchema>;

// Policy Registry Entry
export const PolicyRegistryEntrySchema = z.object({
    policyId: z.string().uuid(),
    policyHash: z.string(),
    owner: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    status: z.enum(['active', 'inactive', 'archived']),
    transactionId: z.string(),
    consensusTimestamp: z.string(),
    metadata: z.record(z.any()).optional(),
});

export type PolicyRegistryEntry = z.infer<typeof PolicyRegistryEntrySchema>;

// Delegation Registry Entry
export const DelegationRegistryEntrySchema = z.object({
    delegationId: z.string().uuid(),
    delegator: z.string(),
    delegatee: z.string(),
    scope: z.record(z.any()),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime().optional(),
    status: z.enum(['active', 'revoked', 'expired']),
    transactionId: z.string(),
    consensusTimestamp: z.string(),
    signature: z.string(),
    metadata: z.record(z.any()).optional(),
});

export type DelegationRegistryEntry = z.infer<typeof DelegationRegistryEntrySchema>;

// Audit Registry Entry
export const AuditRegistryEntrySchema = z.object({
    eventId: z.string().uuid(),
    eventType: z.string(),
    userId: z.string(),
    agentId: z.string().optional(),
    timestamp: z.string().datetime(),
    data: z.record(z.any()),
    transactionId: z.string(),
    consensusTimestamp: z.string(),
    metadata: z.record(z.any()).optional(),
});

export type AuditRegistryEntry = z.infer<typeof AuditRegistryEntrySchema>;

// Hedera Topic Configuration
export const HederaTopicConfigSchema = z.object({
    topicId: z.string(),
    adminKey: z.string().optional(),
    submitKey: z.string().optional(),
    autoRenewAccountId: z.string().optional(),
    autoRenewPeriod: z.string().optional(),
    memo: z.string().optional(),
});

export type HederaTopicConfig = z.infer<typeof HederaTopicConfigSchema>;

// Hedera Smart Contract Configuration
export const HederaSmartContractConfigSchema = z.object({
    contractId: z.string(),
    adminKey: z.string().optional(),
    bytecode: z.string(),
    constructorParameters: z.array(z.string()).optional(),
    gas: z.number().default(100000),
    initialBalance: z.string().default('0'),
    autoRenewAccountId: z.string().optional(),
    autoRenewPeriod: z.string().optional(),
    memo: z.string().optional(),
});

export type HederaSmartContractConfig = z.infer<typeof HederaSmartContractConfigSchema>;

// Hedera File Configuration
export const HederaFileConfigSchema = z.object({
    fileId: z.string(),
    adminKey: z.string().optional(),
    contents: z.string(),
    autoRenewAccountId: z.string().optional(),
    autoRenewPeriod: z.string().optional(),
    memo: z.string().optional(),
});

export type HederaFileConfig = z.infer<typeof HederaFileConfigSchema>;

// Hedera Query Result
export const HederaQueryResultSchema = z.object({
    success: z.boolean(),
    data: z.any(),
    error: z.string().optional(),
    transactionId: z.string().optional(),
    consensusTimestamp: z.string().optional(),
});

export type HederaQueryResult = z.infer<typeof HederaQueryResultSchema>;

// Hedera Transaction Result
export const HederaTransactionResultSchema = z.object({
    success: z.boolean(),
    transactionId: z.string(),
    consensusTimestamp: z.string(),
    transactionHash: z.string(),
    error: z.string().optional(),
    receipt: z.any().optional(),
    record: z.any().optional(),
});

export type HederaTransactionResult = z.infer<typeof HederaTransactionResultSchema>;
