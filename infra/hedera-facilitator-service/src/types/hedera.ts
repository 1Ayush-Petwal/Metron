import { z } from 'zod';

// Hedera Network Configuration
export const HederaConfigSchema = z.object({
    network: z.enum(['testnet', 'previewnet', 'mainnet']),
    mirrorNodeUrl: z.string().url(),
    consensusNodeUrl: z.string().url(),
    operatorId: z.string(),
    operatorKey: z.string(),
    maxTransactionFee: z.string().default('2'),
    maxQueryPayment: z.string().default('1'),
});

export type HederaConfig = z.infer<typeof HederaConfigSchema>;

// Hedera Account Information
export const HederaAccountSchema = z.object({
    accountId: z.string(),
    balance: z.string(),
    key: z.string(),
    isDeleted: z.boolean(),
    autoRenewPeriod: z.string(),
    proxyAccountId: z.string().optional(),
    proxyReceived: z.string().optional(),
});

export type HederaAccount = z.infer<typeof HederaAccountSchema>;

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

// Hedera Topic Message
export const HederaTopicMessageSchema = z.object({
    topicId: z.string(),
    sequenceNumber: z.number(),
    runningHash: z.string(),
    consensusTimestamp: z.string(),
    message: z.string(),
    chunkInfo: z.object({
        initialTransactionId: z.string(),
        number: z.number(),
        total: z.number(),
    }).optional(),
});

export type HederaTopicMessage = z.infer<typeof HederaTopicMessageSchema>;
