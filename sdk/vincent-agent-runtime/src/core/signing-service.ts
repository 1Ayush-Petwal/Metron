import { createPaymentHeader } from 'x402/client';
import type { 
  SigningService, 
  PaymentHeaderData, 
  PolicyProofData,
  SigningConfig 
} from '../types/signing';
import type { Signer, MultiNetworkSigner } from 'x402/types';

export class VincentSigningService implements SigningService {
  private config: SigningConfig;

  constructor(config: SigningConfig) {
    this.config = config;
  }

  async signPaymentHeader(data: PaymentHeaderData): Promise<string> {
    try {
      // Create payment requirements for x402
      const paymentRequirements = {
        scheme: 'exact' as const,
        network: data.network,
        maxAmountRequired: data.amount,
        currency: data.currency,
        recipient: data.endpoint,
      };

      // Create payment header using x402
      const paymentHeader = await createPaymentHeader(
        this.config.walletClient as Signer | MultiNetworkSigner,
        1, // x402 version
        paymentRequirements
      );

      return paymentHeader;
    } catch (error) {
      throw new Error(`Failed to sign payment header: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async signPolicyProof(data: PolicyProofData): Promise<string> {
    try {
      // Create a signature for the policy proof
      const proofData = {
        sessionId: data.sessionId,
        policyId: data.policyId,
        evaluationResult: data.evaluationResult,
        timestamp: data.timestamp,
        nonce: data.nonce || this.generateNonce(),
      };

      // In a real implementation, this would use Vincent's signing capabilities
      // For now, we'll create a mock signature
      const signature = await this.createMockSignature(JSON.stringify(proofData));
      
      return signature;
    } catch (error) {
      throw new Error(`Failed to sign policy proof: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async verifySignature(signature: string, data: any, publicKey: string): Promise<boolean> {
    try {
      // In a real implementation, this would verify the signature using Vincent
      // For now, we'll do a basic validation
      return signature.length > 0 && publicKey.length > 0;
    } catch (error) {
      return false;
    }
  }

  generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  async getPublicKey(): Promise<string> {
    try {
      // In a real implementation, this would get the public key from the wallet
      // For now, return a mock public key
      return 'mock-public-key-' + this.generateNonce();
    } catch (error) {
      throw new Error(`Failed to get public key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createMockSignature(data: string): Promise<string> {
    // In a real implementation, this would create a proper signature
    // For now, return a mock signature
    return 'mock-signature-' + Buffer.from(data).toString('base64');
  }
}
