import { v4 as uuidv4 } from 'uuid';
import { HederaClient } from '../core/hedera-client.js';
import { 
  VerificationRequest, 
  VerificationResponse, 
  PaymentProofVerification,
  PolicyComplianceVerification,
  TransactionAuthenticityVerification,
  VerificationEvent
} from '../types/verification.js';
import { SettlementService } from './settlement-service.js';
import { PolicyRegistryService } from './policy-registry-service.js';
import { logger } from '../core/logger.js';
import { EventEmitter } from 'events';

export class VerificationService extends EventEmitter {
  private hederaClient: HederaClient;
  private settlementService: SettlementService;
  private policyRegistryService: PolicyRegistryService;
  private verifications: Map<string, VerificationResponse> = new Map();

  constructor(
    hederaClient: HederaClient,
    settlementService: SettlementService,
    policyRegistryService: PolicyRegistryService
  ) {
    super();
    this.hederaClient = hederaClient;
    this.settlementService = settlementService;
    this.policyRegistryService = policyRegistryService;
  }

  /**
   * Verify a request
   */
  async verify(request: VerificationRequest): Promise<VerificationResponse> {
    try {
      const verificationId = uuidv4();
      const timestamp = new Date().toISOString();

      this.emitVerificationEvent('verification_requested', verificationId, request.type, request);

      let result: VerificationResponse;

      switch (request.type) {
        case 'payment_proof':
          result = await this.verifyPaymentProof(request);
          break;
        case 'policy_compliance':
          result = await this.verifyPolicyCompliance(request);
          break;
        case 'transaction_authenticity':
          result = await this.verifyTransactionAuthenticity(request);
          break;
        default:
          result = {
            success: false,
            isValid: false,
            verificationId,
            timestamp,
            error: 'Unknown verification type',
          };
      }

      result.verificationId = verificationId;
      result.timestamp = timestamp;

      // Store verification result
      this.verifications.set(verificationId, result);

      // Emit completion event
      this.emitVerificationEvent(
        result.success ? 'verification_completed' : 'verification_failed',
        verificationId,
        request.type,
        result
      );

      logger.info('Verification completed', {
        verificationId,
        type: request.type,
        success: result.success,
        isValid: result.isValid,
      });

      return result;
    } catch (error) {
      logger.error('Failed to verify request', { error, request });
      return {
        success: false,
        isValid: false,
        verificationId: '',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify payment proof
   */
  private async verifyPaymentProof(request: VerificationRequest): Promise<VerificationResponse> {
    try {
      const { paymentId, proof, amount, currency, payer, payee, timestamp, signature } = request.data as PaymentProofVerification;

      if (!paymentId || !proof || !amount || !currency || !payer || !payee) {
        return {
          success: false,
          isValid: false,
          verificationId: '',
          timestamp: new Date().toISOString(),
          error: 'Missing required payment proof fields',
        };
      }

      // Get settlement from settlement service
      const settlements = await this.settlementService.getSettlementsByPaymentId(paymentId);
      if (settlements.length === 0) {
        return {
          success: true,
          isValid: false,
          verificationId: '',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'No settlement found for payment ID',
            paymentId,
          },
        };
      }

      // Find matching settlement
      const matchingSettlement = settlements.find(s => 
        s.amount === amount && 
        s.currency === currency && 
        s.payer === payer && 
        s.payee === payee
      );

      if (!matchingSettlement) {
        return {
          success: true,
          isValid: false,
          verificationId: '',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'No matching settlement found',
            paymentId,
            amount,
            currency,
            payer,
            payee,
          },
        };
      }

      // Verify settlement status
      if (matchingSettlement.status !== 'completed') {
        return {
          success: true,
          isValid: false,
          verificationId: '',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'Settlement not completed',
            settlementStatus: matchingSettlement.status,
            settlementId: matchingSettlement.settlementId,
          },
        };
      }

      // Verify on Hedera if transaction ID is available
      if (matchingSettlement.transactionId) {
        const verification = await this.settlementService.verifySettlement(matchingSettlement.settlementId);
        if (!verification.isValid) {
          return {
            success: true,
            isValid: false,
            verificationId: '',
            timestamp: new Date().toISOString(),
            details: {
              reason: 'Hedera verification failed',
              settlementId: matchingSettlement.settlementId,
              transactionId: matchingSettlement.transactionId,
            },
          };
        }
      }

      // Verify signature if provided
      if (signature) {
        const signatureValid = await this.verifySignature(proof, signature, payer);
        if (!signatureValid) {
          return {
            success: true,
            isValid: false,
            verificationId: '',
            timestamp: new Date().toISOString(),
            details: {
              reason: 'Invalid signature',
              paymentId,
            },
          };
        }
      }

      return {
        success: true,
        isValid: true,
        verificationId: '',
        timestamp: new Date().toISOString(),
        details: {
          settlementId: matchingSettlement.settlementId,
          transactionId: matchingSettlement.transactionId,
          consensusTimestamp: matchingSettlement.consensusTimestamp,
        },
      };
    } catch (error) {
      logger.error('Failed to verify payment proof', { error, request });
      return {
        success: false,
        isValid: false,
        verificationId: '',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify policy compliance
   */
  private async verifyPolicyCompliance(request: VerificationRequest): Promise<VerificationResponse> {
    try {
      const { policyId, userId, action, resource, context } = request.data as PolicyComplianceVerification;

      if (!policyId || !userId || !action || !resource) {
        return {
          success: false,
          isValid: false,
          verificationId: '',
          timestamp: new Date().toISOString(),
          error: 'Missing required policy compliance fields',
        };
      }

      // Get policy from registry
      const policy = await this.policyRegistryService.getPolicy(policyId);
      if (!policy) {
        return {
          success: true,
          isValid: false,
          verificationId: '',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'Policy not found',
            policyId,
          },
        };
      }

      // Check if policy is active
      if (policy.status !== 'active') {
        return {
          success: true,
          isValid: false,
          verificationId: '',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'Policy is not active',
            policyId,
            status: policy.status,
          },
        };
      }

      // Check if user is the policy owner
      if (policy.owner !== userId) {
        return {
          success: true,
          isValid: false,
          verificationId: '',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'User is not policy owner',
            policyId,
            userId,
            owner: policy.owner,
          },
        };
      }

      // In a real implementation, you would:
      // 1. Parse the policy hash to get policy rules
      // 2. Evaluate the policy against the action and resource
      // 3. Check context against policy conditions
      // For now, we'll do a simplified check

      const isCompliant = this.evaluatePolicyCompliance(policy, action, resource, context);

      return {
        success: true,
        isValid: isCompliant,
        verificationId: '',
        timestamp: new Date().toISOString(),
        details: {
          policyId,
          userId,
          action,
          resource,
          isCompliant,
          policyHash: policy.policyHash,
        },
      };
    } catch (error) {
      logger.error('Failed to verify policy compliance', { error, request });
      return {
        success: false,
        isValid: false,
        verificationId: '',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify transaction authenticity
   */
  private async verifyTransactionAuthenticity(request: VerificationRequest): Promise<VerificationResponse> {
    try {
      const { 
        transactionId, 
        transactionHash, 
        consensusTimestamp, 
        payer, 
        payee, 
        amount, 
        currency, 
        signature 
      } = request.data as TransactionAuthenticityVerification;

      if (!transactionId || !transactionHash || !consensusTimestamp) {
        return {
          success: false,
          isValid: false,
          verificationId: '',
          timestamp: new Date().toISOString(),
          error: 'Missing required transaction fields',
        };
      }

      // Get transaction record from Hedera
      const recordResult = await this.hederaClient.getTransactionRecord(transactionId);
      
      if (!recordResult.success || !recordResult.data) {
        return {
          success: true,
          isValid: false,
          verificationId: '',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'Transaction not found on Hedera',
            transactionId,
            error: recordResult.error,
          },
        };
      }

      const record = recordResult.data;

      // Verify transaction hash
      if (record.transactionHash !== transactionHash) {
        return {
          success: true,
          isValid: false,
          verificationId: '',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'Transaction hash mismatch',
            expected: transactionHash,
            actual: record.transactionHash,
          },
        };
      }

      // Verify consensus timestamp
      if (record.consensusTimestamp !== consensusTimestamp) {
        return {
          success: true,
          isValid: false,
          verificationId: '',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'Consensus timestamp mismatch',
            expected: consensusTimestamp,
            actual: record.consensusTimestamp,
          },
        };
      }

      // Verify transaction status
      if (record.status !== 'SUCCESS') {
        return {
          success: true,
          isValid: false,
          verificationId: '',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'Transaction not successful',
            status: record.status,
          },
        };
      }

      // Verify additional fields if provided
      if (payer || payee || amount || currency) {
        const transfers = record.transfers || [];
        const tokenTransfers = record.tokenTransfers || [];

        // Check if payer/payee match (simplified check)
        if (payer && !transfers.some(t => t.accountId === payer)) {
          return {
            success: true,
            isValid: false,
            verificationId: '',
            timestamp: new Date().toISOString(),
            details: {
              reason: 'Payer not found in transaction transfers',
              payer,
              transfers,
            },
          };
        }

        if (payee && !transfers.some(t => t.accountId === payee)) {
          return {
            success: true,
            isValid: false,
            verificationId: '',
            timestamp: new Date().toISOString(),
            details: {
              reason: 'Payee not found in transaction transfers',
              payee,
              transfers,
            },
          };
        }
      }

      // Verify signature if provided
      if (signature) {
        const signatureValid = await this.verifyTransactionSignature(transactionId, signature);
        if (!signatureValid) {
          return {
            success: true,
            isValid: false,
            verificationId: '',
            timestamp: new Date().toISOString(),
            details: {
              reason: 'Invalid transaction signature',
              transactionId,
            },
          };
        }
      }

      return {
        success: true,
        isValid: true,
        verificationId: '',
        timestamp: new Date().toISOString(),
        details: {
          transactionId,
          transactionHash,
          consensusTimestamp,
          status: record.status,
        },
      };
    } catch (error) {
      logger.error('Failed to verify transaction authenticity', { error, request });
      return {
        success: false,
        isValid: false,
        verificationId: '',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Evaluate policy compliance (simplified implementation)
   */
  private evaluatePolicyCompliance(
    policy: any, 
    action: string, 
    resource: string, 
    context: any
  ): boolean {
    // This is a simplified implementation
    // In a real system, you would:
    // 1. Parse the policy hash to get the actual policy rules
    // 2. Evaluate the policy against the action and resource
    // 3. Check context against policy conditions
    // 4. Return the evaluation result

    // For now, we'll do basic checks
    if (!policy.policyHash) {
      return false;
    }

    // Basic action and resource validation
    if (!action || !resource) {
      return false;
    }

    // In a real implementation, you would decode the policy hash
    // and evaluate the actual policy rules here
    return true; // Simplified - always return true for now
  }

  /**
   * Verify signature (simplified implementation)
   */
  private async verifySignature(proof: string, signature: string, signer: string): Promise<boolean> {
    // This is a simplified implementation
    // In a real system, you would:
    // 1. Recover the public key from the signature
    // 2. Verify the signature against the proof
    // 3. Check if the recovered public key matches the signer

    try {
      // For now, we'll do a basic validation
      return proof.length > 0 && signature.length > 0 && signer.length > 0;
    } catch (error) {
      logger.error('Failed to verify signature', { error, proof, signature, signer });
      return false;
    }
  }

  /**
   * Verify transaction signature (simplified implementation)
   */
  private async verifyTransactionSignature(transactionId: string, signature: string): Promise<boolean> {
    // This is a simplified implementation
    // In a real system, you would:
    // 1. Get the transaction details from Hedera
    // 2. Verify the signature against the transaction
    // 3. Check if the signature is valid

    try {
      // For now, we'll do a basic validation
      return transactionId.length > 0 && signature.length > 0;
    } catch (error) {
      logger.error('Failed to verify transaction signature', { error, transactionId, signature });
      return false;
    }
  }

  /**
   * Emit verification event
   */
  private emitVerificationEvent(
    eventType: VerificationEvent['eventType'],
    verificationId: string,
    type: VerificationRequest['type'],
    data: any
  ): void {
    const event: VerificationEvent = {
      eventType,
      verificationId,
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    this.emit('verification_event', event);
    logger.debug('Verification event emitted', { eventType, verificationId, type });
  }

  /**
   * Get verification by ID
   */
  async getVerification(verificationId: string): Promise<VerificationResponse | null> {
    return this.verifications.get(verificationId) || null;
  }

  /**
   * Get all verifications with pagination
   */
  async getVerifications(
    limit: number = 10, 
    offset: number = 0
  ): Promise<{ verifications: VerificationResponse[]; total: number }> {
    const verifications = Array.from(this.verifications.values());
    const total = verifications.length;
    const paginatedVerifications = verifications
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(offset, offset + limit);

    return {
      verifications: paginatedVerifications,
      total,
    };
  }
}
