import { z } from 'zod';

// Payment Proof Verification
export const PaymentProofVerificationSchema = z.object({
    paymentId: z.string(),
    proof: z.string(),
    amount: z.string(),
    currency: z.string(),
    payer: z.string(),
    payee: z.string(),
    timestamp: z.string().datetime(),
    signature: z.string(),
});

export type PaymentProofVerification = z.infer<typeof PaymentProofVerificationSchema>;

// Verification Request
export const VerificationRequestSchema = z.object({
    type: z.enum(['payment_proof', 'policy_compliance', 'transaction_authenticity']),
    data: z.record(z.any()),
    proof: z.string().optional(),
    signature: z.string().optional(),
});

export type VerificationRequest = z.infer<typeof VerificationRequestSchema>;

// Verification Response
export const VerificationResponseSchema = z.object({
    success: z.boolean(),
    isValid: z.boolean(),
    verificationId: z.string().uuid(),
    timestamp: z.string().datetime(),
    details: z.record(z.any()).optional(),
    error: z.string().optional(),
});

export type VerificationResponse = z.infer<typeof VerificationResponseSchema>;

// Policy Compliance Verification
export const PolicyComplianceVerificationSchema = z.object({
    policyId: z.string().uuid(),
    userId: z.string(),
    action: z.string(),
    resource: z.string(),
    context: z.record(z.any()),
    timestamp: z.string().datetime(),
});

export type PolicyComplianceVerification = z.infer<typeof PolicyComplianceVerificationSchema>;

// Transaction Authenticity Verification
export const TransactionAuthenticityVerificationSchema = z.object({
    transactionId: z.string(),
    transactionHash: z.string(),
    consensusTimestamp: z.string(),
    payer: z.string(),
    payee: z.string(),
    amount: z.string(),
    currency: z.string(),
    signature: z.string(),
    timestamp: z.string().datetime(),
});

export type TransactionAuthenticityVerification = z.infer<typeof TransactionAuthenticityVerificationSchema>;

// Verification Event
export const VerificationEventSchema = z.object({
    eventType: z.enum(['verification_requested', 'verification_completed', 'verification_failed']),
    verificationId: z.string().uuid(),
    type: z.enum(['payment_proof', 'policy_compliance', 'transaction_authenticity']),
    timestamp: z.string().datetime(),
    data: z.record(z.any()),
});

export type VerificationEvent = z.infer<typeof VerificationEventSchema>;
