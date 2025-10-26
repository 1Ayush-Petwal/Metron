import { z } from 'zod';

// x402 Payment Settlement
export const PaymentSettlementSchema = z.object({
    settlementId: z.string().uuid(),
    paymentId: z.string(),
    amount: z.string(),
    currency: z.string(),
    payer: z.string(),
    payee: z.string(),
    status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
    transactionId: z.string().optional(),
    consensusTimestamp: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    metadata: z.record(z.any()).optional(),
});

export type PaymentSettlement = z.infer<typeof PaymentSettlementSchema>;

// Settlement Request
export const SettlementRequestSchema = z.object({
    paymentId: z.string(),
    amount: z.string(),
    currency: z.string(),
    payer: z.string(),
    payee: z.string(),
    metadata: z.record(z.any()).optional(),
});

export type SettlementRequest = z.infer<typeof SettlementRequestSchema>;

// Settlement Response
export const SettlementResponseSchema = z.object({
    success: z.boolean(),
    settlementId: z.string().uuid(),
    transactionId: z.string().optional(),
    consensusTimestamp: z.string().optional(),
    error: z.string().optional(),
});

export type SettlementResponse = z.infer<typeof SettlementResponseSchema>;

// Settlement Verification
export const SettlementVerificationSchema = z.object({
    settlementId: z.string().uuid(),
    isValid: z.boolean(),
    transactionId: z.string(),
    consensusTimestamp: z.string(),
    verificationTimestamp: z.string().datetime(),
    details: z.record(z.any()).optional(),
});

export type SettlementVerification = z.infer<typeof SettlementVerificationSchema>;

// Settlement Event
export const SettlementEventSchema = z.object({
    eventType: z.enum(['settlement_created', 'settlement_processing', 'settlement_completed', 'settlement_failed']),
    settlementId: z.string().uuid(),
    paymentId: z.string(),
    timestamp: z.string().datetime(),
    data: z.record(z.any()),
});

export type SettlementEvent = z.infer<typeof SettlementEventSchema>;
