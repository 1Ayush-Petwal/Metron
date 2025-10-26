import { z } from 'zod';
import type { Signer, MultiNetworkSigner } from 'x402/types';

// Signing Configuration
export const SigningConfigSchema = z.object({
    walletClient: z.any(), // Signer | MultiNetworkSigner
    vincentConfig: z.any(), // VincentClientConfig
    signingMethod: z.enum(['vincent', 'porto', 'direct']).default('vincent'),
    metadata: z.record(z.any()).optional(),
});

export type SigningConfig = z.infer<typeof SigningConfigSchema>;

// Signature Data
export const SignatureDataSchema = z.object({
    signature: z.string(),
    publicKey: z.string(),
    algorithm: z.string(),
    timestamp: z.string().datetime(),
    nonce: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

export type SignatureData = z.infer<typeof SignatureDataSchema>;

// Payment Header Data
export const PaymentHeaderDataSchema = z.object({
    sessionId: z.string().uuid(),
    amount: z.string(),
    currency: z.string(),
    network: z.string(),
    endpoint: z.string(),
    timestamp: z.string().datetime(),
    signature: z.string(),
    publicKey: z.string(),
    nonce: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

export type PaymentHeaderData = z.infer<typeof PaymentHeaderDataSchema>;

// Policy Proof Data
export const PolicyProofDataSchema = z.object({
    sessionId: z.string().uuid(),
    policyId: z.string(),
    evaluationResult: z.any(), // PolicyEvaluationResult
    signature: z.string(),
    publicKey: z.string(),
    timestamp: z.string().datetime(),
    nonce: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

export type PolicyProofData = z.infer<typeof PolicyProofDataSchema>;

// Signing Service Interface
export interface SigningService {
    signPaymentHeader(data: PaymentHeaderData): Promise<string>;
    signPolicyProof(data: PolicyProofData): Promise<string>;
    verifySignature(signature: string, data: any, publicKey: string): Promise<boolean>;
    generateNonce(): string;
    getPublicKey(): Promise<string>;
}

// Verification Service Interface
export interface VerificationService {
    verifyPaymentHeader(header: string, expectedData: PaymentHeaderData): Promise<boolean>;
    verifyPolicyProof(proof: string, expectedData: PolicyProofData): Promise<boolean>;
    verifyDelegation(delegation: any): Promise<boolean>;
}

// Crypto Utilities Interface
export interface CryptoUtils {
    hash(data: string): string;
    generateKeyPair(): Promise<{ publicKey: string; privateKey: string }>;
    encrypt(data: string, publicKey: string): Promise<string>;
    decrypt(encryptedData: string, privateKey: string): Promise<string>;
}
