import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { v4 as uuidv4 } from 'uuid';
import {
    SettlementRequest,
    SettlementResponse,
    PolicyCreationRequest,
    PolicyUpdateRequest,
    PolicyQueryRequest,
    VerificationRequest
} from '../types/index.js';
import { SettlementService } from '../services/settlement-service.js';
import { PolicyRegistryService } from '../services/policy-registry-service.js';
import { VerificationService } from '../services/verification-service.js';
import { HederaClient } from '../core/hedera-client.js';
import { configManager } from '../core/config.js';
import { logger } from '../core/logger.js';
import path from 'path';

export class GrpcServer {
    private server: grpc.Server;
    private settlementService: SettlementService;
    private policyRegistryService: PolicyRegistryService;
    private verificationService: VerificationService;
    private hederaClient: HederaClient;
    private config = configManager.getConfig();

    constructor(
        settlementService: SettlementService,
        policyRegistryService: PolicyRegistryService,
        verificationService: VerificationService,
        hederaClient: HederaClient
    ) {
        this.settlementService = settlementService;
        this.policyRegistryService = policyRegistryService;
        this.verificationService = verificationService;
        this.hederaClient = hederaClient;

        this.server = new grpc.Server();
        this.setupServices();
    }

    /**
     * Setup gRPC services
     */
    private setupServices(): void {
        // Load protobuf definitions
        const packageDefinition = protoLoader.loadSync(
            path.join(__dirname, '../../proto/hedera_facilitator.proto'),
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true,
            }
        );

        const hederaFacilitatorProto = grpc.loadPackageDefinition(packageDefinition) as any;

        // Settlement service
        this.server.addService(hederaFacilitatorProto.hedera_facilitator.SettlementService.service, {
            createSettlement: this.createSettlement.bind(this),
            getSettlement: this.getSettlement.bind(this),
            getSettlements: this.getSettlements.bind(this),
            verifySettlement: this.verifySettlement.bind(this),
        });

        // Policy service
        this.server.addService(hederaFacilitatorProto.hedera_facilitator.PolicyService.service, {
            createPolicy: this.createPolicy.bind(this),
            updatePolicy: this.updatePolicy.bind(this),
            getPolicy: this.getPolicy.bind(this),
            queryPolicies: this.queryPolicies.bind(this),
            archivePolicy: this.archivePolicy.bind(this),
            activatePolicy: this.activatePolicy.bind(this),
            deactivatePolicy: this.deactivatePolicy.bind(this),
            getPolicyAuditLog: this.getPolicyAuditLog.bind(this),
            getPolicyStatistics: this.getPolicyStatistics.bind(this),
        });

        // Verification service
        this.server.addService(hederaFacilitatorProto.hedera_facilitator.VerificationService.service, {
            verify: this.verify.bind(this),
            getVerification: this.getVerification.bind(this),
            getVerifications: this.getVerifications.bind(this),
        });

        // Hedera service
        this.server.addService(hederaFacilitatorProto.hedera_facilitator.HederaService.service, {
            getAccount: this.getHederaAccount.bind(this),
            getTransaction: this.getHederaTransaction.bind(this),
        });

        logger.info('gRPC services registered');
    }

    /**
     * Create settlement
     */
    private async createSettlement(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const request: SettlementRequest = call.request;
            const result = await this.settlementService.createSettlement(request);

            logger.info('gRPC createSettlement', {
                requestId: uuidv4(),
                paymentId: request.paymentId,
                success: result.success,
            });

            callback(null, result);
        } catch (error) {
            logger.error('gRPC createSettlement error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Get settlement by ID
     */
    private async getSettlement(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const { id } = call.request;
            const settlement = await this.settlementService.getSettlement(id);

            if (!settlement) {
                callback({
                    code: grpc.status.NOT_FOUND,
                    message: 'Settlement not found',
                });
                return;
            }

            logger.info('gRPC getSettlement', {
                requestId: uuidv4(),
                settlementId: id,
            });

            callback(null, settlement);
        } catch (error) {
            logger.error('gRPC getSettlement error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Get settlements with pagination
     */
    private async getSettlements(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const { limit = 10, offset = 0, status } = call.request;
            const result = await this.settlementService.getSettlements(limit, offset, status);

            logger.info('gRPC getSettlements', {
                requestId: uuidv4(),
                limit,
                offset,
                total: result.total,
            });

            callback(null, {
                settlements: result.settlements,
                total: result.total,
                hasMore: offset + limit < result.total,
            });
        } catch (error) {
            logger.error('gRPC getSettlements error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Verify settlement
     */
    private async verifySettlement(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const { id } = call.request;
            const verification = await this.settlementService.verifySettlement(id);

            logger.info('gRPC verifySettlement', {
                requestId: uuidv4(),
                settlementId: id,
                isValid: verification.isValid,
            });

            callback(null, verification);
        } catch (error) {
            logger.error('gRPC verifySettlement error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Create policy
     */
    private async createPolicy(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const request: PolicyCreationRequest = call.request;
            const result = await this.policyRegistryService.createPolicy(request);

            logger.info('gRPC createPolicy', {
                requestId: uuidv4(),
                owner: request.owner,
                success: result.success,
            });

            callback(null, result);
        } catch (error) {
            logger.error('gRPC createPolicy error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Update policy
     */
    private async updatePolicy(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const request: PolicyUpdateRequest = call.request;
            const result = await this.policyRegistryService.updatePolicy(request);

            logger.info('gRPC updatePolicy', {
                requestId: uuidv4(),
                policyId: request.policyId,
                success: result.success,
            });

            callback(null, result);
        } catch (error) {
            logger.error('gRPC updatePolicy error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Get policy by ID
     */
    private async getPolicy(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const { id } = call.request;
            const policy = await this.policyRegistryService.getPolicy(id);

            if (!policy) {
                callback({
                    code: grpc.status.NOT_FOUND,
                    message: 'Policy not found',
                });
                return;
            }

            logger.info('gRPC getPolicy', {
                requestId: uuidv4(),
                policyId: id,
            });

            callback(null, policy);
        } catch (error) {
            logger.error('gRPC getPolicy error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Query policies
     */
    private async queryPolicies(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const request: PolicyQueryRequest = call.request;
            const result = await this.policyRegistryService.queryPolicies(request);

            logger.info('gRPC queryPolicies', {
                requestId: uuidv4(),
                limit: request.limit,
                offset: request.offset,
                total: result.total,
            });

            callback(null, result);
        } catch (error) {
            logger.error('gRPC queryPolicies error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Archive policy
     */
    private async archivePolicy(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const { id, actor = 'system' } = call.request;
            const result = await this.policyRegistryService.archivePolicy(id, actor);

            logger.info('gRPC archivePolicy', {
                requestId: uuidv4(),
                policyId: id,
                actor,
                success: result.success,
            });

            callback(null, result);
        } catch (error) {
            logger.error('gRPC archivePolicy error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Activate policy
     */
    private async activatePolicy(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const { id, actor = 'system' } = call.request;
            const result = await this.policyRegistryService.activatePolicy(id, actor);

            logger.info('gRPC activatePolicy', {
                requestId: uuidv4(),
                policyId: id,
                actor,
                success: result.success,
            });

            callback(null, result);
        } catch (error) {
            logger.error('gRPC activatePolicy error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Deactivate policy
     */
    private async deactivatePolicy(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const { id, actor = 'system' } = call.request;
            const result = await this.policyRegistryService.deactivatePolicy(id, actor);

            logger.info('gRPC deactivatePolicy', {
                requestId: uuidv4(),
                policyId: id,
                actor,
                success: result.success,
            });

            callback(null, result);
        } catch (error) {
            logger.error('gRPC deactivatePolicy error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Get policy audit log
     */
    private async getPolicyAuditLog(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const { id } = call.request;
            const auditLog = await this.policyRegistryService.getPolicyAuditLog(id);

            logger.info('gRPC getPolicyAuditLog', {
                requestId: uuidv4(),
                policyId: id,
                entries: auditLog.length,
            });

            callback(null, { entries: auditLog });
        } catch (error) {
            logger.error('gRPC getPolicyAuditLog error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Get policy statistics
     */
    private async getPolicyStatistics(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const stats = await this.policyRegistryService.getPolicyStatistics();

            logger.info('gRPC getPolicyStatistics', {
                requestId: uuidv4(),
                total: stats.total,
            });

            callback(null, stats);
        } catch (error) {
            logger.error('gRPC getPolicyStatistics error', { error });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Verify request
     */
    private async verify(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const request: VerificationRequest = call.request;
            const result = await this.verificationService.verify(request);

            logger.info('gRPC verify', {
                requestId: uuidv4(),
                type: request.type,
                success: result.success,
                isValid: result.isValid,
            });

            callback(null, result);
        } catch (error) {
            logger.error('gRPC verify error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Get verification by ID
     */
    private async getVerification(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const { id } = call.request;
            const verification = await this.verificationService.getVerification(id);

            if (!verification) {
                callback({
                    code: grpc.status.NOT_FOUND,
                    message: 'Verification not found',
                });
                return;
            }

            logger.info('gRPC getVerification', {
                requestId: uuidv4(),
                verificationId: id,
            });

            callback(null, verification);
        } catch (error) {
            logger.error('gRPC getVerification error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Get verifications with pagination
     */
    private async getVerifications(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const { limit = 10, offset = 0 } = call.request;
            const result = await this.verificationService.getVerifications(limit, offset);

            logger.info('gRPC getVerifications', {
                requestId: uuidv4(),
                limit,
                offset,
                total: result.total,
            });

            callback(null, {
                verifications: result.verifications,
                total: result.total,
                hasMore: offset + limit < result.total,
            });
        } catch (error) {
            logger.error('gRPC getVerifications error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Get Hedera account info
     */
    private async getHederaAccount(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const { id } = call.request;
            const accountInfo = await this.hederaClient.getAccountInfo(id);

            logger.info('gRPC getHederaAccount', {
                requestId: uuidv4(),
                accountId: id,
                success: accountInfo.success,
            });

            callback(null, accountInfo);
        } catch (error) {
            logger.error('gRPC getHederaAccount error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Get Hedera transaction record
     */
    private async getHederaTransaction(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ): Promise<void> {
        try {
            const { id } = call.request;
            const transaction = await this.hederaClient.getTransactionRecord(id);

            logger.info('gRPC getHederaTransaction', {
                requestId: uuidv4(),
                transactionId: id,
                success: transaction.success,
            });

            callback(null, transaction);
        } catch (error) {
            logger.error('gRPC getHederaTransaction error', { error, request: call.request });
            callback({
                code: grpc.status.INTERNAL,
                message: 'Internal server error',
            });
        }
    }

    /**
     * Start the gRPC server
     */
    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            const port = this.config.service.grpcPort;
            const host = '0.0.0.0';

            this.server.bindAsync(
                `${host}:${port}`,
                grpc.ServerCredentials.createInsecure(),
                (error, port) => {
                    if (error) {
                        logger.error('Failed to start gRPC server', { error });
                        reject(error);
                    } else {
                        this.server.start();
                        logger.info('gRPC server started', {
                            port,
                            host,
                        });
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * Stop the gRPC server
     */
    async stop(): Promise<void> {
        return new Promise((resolve) => {
            this.server.forceShutdown();
            logger.info('gRPC server stopped');
            resolve();
        });
    }
}
