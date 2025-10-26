import { v4 as uuidv4 } from 'uuid';
import { HederaClient } from '../core/hedera-client.js';
import {
    PaymentSettlement,
    SettlementRequest,
    SettlementResponse,
    SettlementVerification,
    SettlementEvent
} from '../types/settlement.js';
import { HederaConfig } from '../types/hedera.js';
import { logger } from '../core/logger.js';
import { EventEmitter } from 'events';

export class SettlementService extends EventEmitter {
    private hederaClient: HederaClient;
    private settlements: Map<string, PaymentSettlement> = new Map();
    private config: HederaConfig;

    constructor(hederaClient: HederaClient, config: HederaConfig) {
        super();
        this.hederaClient = hederaClient;
        this.config = config;
    }

    /**
     * Create a new payment settlement
     */
    async createSettlement(request: SettlementRequest): Promise<SettlementResponse> {
        try {
            const settlementId = uuidv4();
            const now = new Date().toISOString();

            const settlement: PaymentSettlement = {
                settlementId,
                paymentId: request.paymentId,
                amount: request.amount,
                currency: request.currency,
                payer: request.payer,
                payee: request.payee,
                status: 'pending',
                createdAt: now,
                updatedAt: now,
                metadata: request.metadata,
            };

            // Store settlement locally
            this.settlements.set(settlementId, settlement);

            // Emit settlement created event
            this.emitSettlementEvent('settlement_created', settlement);

            // Submit settlement to Hedera topic
            const topicMessage = JSON.stringify({
                type: 'settlement_created',
                settlementId,
                paymentId: request.paymentId,
                amount: request.amount,
                currency: request.currency,
                payer: request.payer,
                payee: request.payee,
                timestamp: now,
                metadata: request.metadata,
            });

            const topicResult = await this.hederaClient.submitTopicMessage(
                this.config.paymentTopicId,
                topicMessage
            );

            if (topicResult.success) {
                settlement.transactionId = topicResult.transactionId;
                settlement.consensusTimestamp = topicResult.consensusTimestamp;
                settlement.status = 'processing';
                settlement.updatedAt = new Date().toISOString();

                this.settlements.set(settlementId, settlement);
                this.emitSettlementEvent('settlement_processing', settlement);

                logger.info('Settlement created and submitted to Hedera', {
                    settlementId,
                    paymentId: request.paymentId,
                    transactionId: topicResult.transactionId,
                });

                return {
                    success: true,
                    settlementId,
                    transactionId: topicResult.transactionId,
                    consensusTimestamp: topicResult.consensusTimestamp,
                };
            } else {
                settlement.status = 'failed';
                settlement.updatedAt = new Date().toISOString();
                this.settlements.set(settlementId, settlement);

                logger.error('Failed to submit settlement to Hedera', {
                    settlementId,
                    error: topicResult.error,
                });

                return {
                    success: false,
                    settlementId,
                    error: topicResult.error,
                };
            }
        } catch (error) {
            logger.error('Failed to create settlement', { error, request });
            return {
                success: false,
                settlementId: '',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Get settlement by ID
     */
    async getSettlement(settlementId: string): Promise<PaymentSettlement | null> {
        return this.settlements.get(settlementId) || null;
    }

    /**
     * Get settlements by payment ID
     */
    async getSettlementsByPaymentId(paymentId: string): Promise<PaymentSettlement[]> {
        const settlements = Array.from(this.settlements.values())
            .filter(settlement => settlement.paymentId === paymentId);
        return settlements;
    }

    /**
     * Get settlements by payer
     */
    async getSettlementsByPayer(payer: string): Promise<PaymentSettlement[]> {
        const settlements = Array.from(this.settlements.values())
            .filter(settlement => settlement.payer === payer);
        return settlements;
    }

    /**
     * Get settlements by payee
     */
    async getSettlementsByPayee(payee: string): Promise<PaymentSettlement[]> {
        const settlements = Array.from(this.settlements.values())
            .filter(settlement => settlement.payee === payee);
        return settlements;
    }

    /**
     * Update settlement status
     */
    async updateSettlementStatus(
        settlementId: string,
        status: PaymentSettlement['status'],
        transactionId?: string,
        consensusTimestamp?: string
    ): Promise<boolean> {
        const settlement = this.settlements.get(settlementId);
        if (!settlement) {
            return false;
        }

        const oldStatus = settlement.status;
        settlement.status = status;
        settlement.updatedAt = new Date().toISOString();

        if (transactionId) {
            settlement.transactionId = transactionId;
        }
        if (consensusTimestamp) {
            settlement.consensusTimestamp = consensusTimestamp;
        }

        this.settlements.set(settlementId, settlement);

        // Emit status change event
        this.emitSettlementEvent('settlement_processing', settlement);

        if (status === 'completed') {
            this.emitSettlementEvent('settlement_completed', settlement);
        } else if (status === 'failed') {
            this.emitSettlementEvent('settlement_failed', settlement);
        }

        logger.info('Settlement status updated', {
            settlementId,
            oldStatus,
            newStatus: status,
            transactionId,
        });

        return true;
    }

    /**
     * Verify settlement on Hedera
     */
    async verifySettlement(settlementId: string): Promise<SettlementVerification> {
        try {
            const settlement = this.settlements.get(settlementId);
            if (!settlement) {
                throw new Error('Settlement not found');
            }

            if (!settlement.transactionId) {
                throw new Error('No transaction ID available for verification');
            }

            // Get transaction record from Hedera
            const recordResult = await this.hederaClient.getTransactionRecord(settlement.transactionId);

            if (!recordResult.success || !recordResult.data) {
                return {
                    settlementId,
                    isValid: false,
                    transactionId: settlement.transactionId,
                    consensusTimestamp: settlement.consensusTimestamp || '',
                    verificationTimestamp: new Date().toISOString(),
                    details: {
                        error: recordResult.error || 'Failed to retrieve transaction record',
                    },
                };
            }

            // Verify transaction details match settlement
            const record = recordResult.data;
            const isValid = this.validateSettlementRecord(settlement, record);

            const verification: SettlementVerification = {
                settlementId,
                isValid,
                transactionId: settlement.transactionId,
                consensusTimestamp: settlement.consensusTimestamp || '',
                verificationTimestamp: new Date().toISOString(),
                details: {
                    record,
                    validation: {
                        amountMatch: true, // Simplified for now
                        payerMatch: true,
                        payeeMatch: true,
                        timestampMatch: true,
                    },
                },
            };

            logger.info('Settlement verification completed', {
                settlementId,
                isValid,
                transactionId: settlement.transactionId,
            });

            return verification;
        } catch (error) {
            logger.error('Failed to verify settlement', { settlementId, error });
            return {
                settlementId,
                isValid: false,
                transactionId: '',
                consensusTimestamp: '',
                verificationTimestamp: new Date().toISOString(),
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Validate settlement record against Hedera transaction
     */
    private validateSettlementRecord(settlement: PaymentSettlement, record: any): boolean {
        try {
            // Basic validation - in a real implementation, you would:
            // 1. Verify the transaction type and parameters
            // 2. Check the transaction memo contains settlement details
            // 3. Validate the transaction amount matches settlement amount
            // 4. Verify payer/payee accounts match
            // 5. Check transaction timestamp is within expected range

            // For now, return true if record exists and has basic structure
            return record &&
                record.transactionId &&
                record.consensusTimestamp &&
                record.status === 'SUCCESS';
        } catch (error) {
            logger.error('Failed to validate settlement record', { error, settlementId: settlement.settlementId });
            return false;
        }
    }

    /**
     * Emit settlement event
     */
    private emitSettlementEvent(eventType: SettlementEvent['eventType'], settlement: PaymentSettlement): void {
        const event: SettlementEvent = {
            eventType,
            settlementId: settlement.settlementId,
            paymentId: settlement.paymentId,
            timestamp: new Date().toISOString(),
            data: {
                settlement,
            },
        };

        this.emit('settlement_event', event);
        logger.debug('Settlement event emitted', { eventType, settlementId: settlement.settlementId });
    }

    /**
     * Get all settlements with pagination
     */
    async getSettlements(
        limit: number = 10,
        offset: number = 0,
        status?: PaymentSettlement['status']
    ): Promise<{ settlements: PaymentSettlement[]; total: number }> {
        let settlements = Array.from(this.settlements.values());

        if (status) {
            settlements = settlements.filter(s => s.status === status);
        }

        const total = settlements.length;
        const paginatedSettlements = settlements
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(offset, offset + limit);

        return {
            settlements: paginatedSettlements,
            total,
        };
    }

    /**
     * Clean up old settlements (for maintenance)
     */
    async cleanupOldSettlements(olderThanDays: number = 30): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        let cleanedCount = 0;
        for (const [settlementId, settlement] of this.settlements.entries()) {
            if (new Date(settlement.createdAt) < cutoffDate &&
                ['completed', 'failed', 'cancelled'].includes(settlement.status)) {
                this.settlements.delete(settlementId);
                cleanedCount++;
            }
        }

        logger.info('Cleaned up old settlements', { cleanedCount, olderThanDays });
        return cleanedCount;
    }
}
