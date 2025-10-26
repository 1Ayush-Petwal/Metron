import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import {
    SettlementRequest,
    SettlementResponse,
    PolicyCreationRequest,
    PolicyUpdateRequest,
    PolicyQueryRequest,
    VerificationRequest,
    ApiResponse,
    PaginatedResponse,
    HealthCheck,
    ErrorResponse
} from '../types/index.js';
import { SettlementService } from '../services/settlement-service.js';
import { PolicyRegistryService } from '../services/policy-registry-service.js';
import { VerificationService } from '../services/verification-service.js';
import { EventStreamService } from '../services/event-stream-service.js';
import { HederaClient } from '../core/hedera-client.js';
import { configManager } from '../core/config.js';
import { logger } from '../core/logger.js';

export class RestApiServer {
    private app: Express;
    private settlementService: SettlementService;
    private policyRegistryService: PolicyRegistryService;
    private verificationService: VerificationService;
    private eventStreamService: EventStreamService;
    private hederaClient: HederaClient;
    private config = configManager.getConfig();

    constructor(
        settlementService: SettlementService,
        policyRegistryService: PolicyRegistryService,
        verificationService: VerificationService,
        eventStreamService: EventStreamService,
        hederaClient: HederaClient
    ) {
        this.app = express();
        this.settlementService = settlementService;
        this.policyRegistryService = policyRegistryService;
        this.verificationService = verificationService;
        this.eventStreamService = eventStreamService;
        this.hederaClient = hederaClient;

        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    /**
     * Setup middleware
     */
    private setupMiddleware(): void {
        // Security middleware
        if (this.config.security.enableHelmet) {
            this.app.use(helmet());
        }

        // CORS middleware
        if (this.config.security.enableCors) {
            this.app.use(cors({
                origin: this.config.security.corsOrigins,
                credentials: true,
            }));
        }

        // Body parsing middleware
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request logging middleware
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            const requestId = uuidv4();
            req.headers['x-request-id'] = requestId;

            logger.info('HTTP Request', {
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                requestId,
            });

            res.setHeader('X-Request-ID', requestId);
            next();
        });

        // Response time middleware
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                logger.info('HTTP Response', {
                    method: req.method,
                    url: req.url,
                    statusCode: res.statusCode,
                    duration: `${duration}ms`,
                    requestId: req.headers['x-request-id'],
                });
            });
            next();
        });
    }

    /**
     * Setup routes
     */
    private setupRoutes(): void {
        // Health check
        this.app.get('/health', this.healthCheck.bind(this));

        // API version
        this.app.get('/api/version', this.getVersion.bind(this));

        // Settlement routes
        this.app.post('/api/settlements', this.createSettlement.bind(this));
        this.app.get('/api/settlements/:id', this.getSettlement.bind(this));
        this.app.get('/api/settlements', this.getSettlements.bind(this));
        this.app.post('/api/settlements/:id/verify', this.verifySettlement.bind(this));

        // Policy routes
        this.app.post('/api/policies', this.createPolicy.bind(this));
        this.app.put('/api/policies/:id', this.updatePolicy.bind(this));
        this.app.get('/api/policies/:id', this.getPolicy.bind(this));
        this.app.get('/api/policies', this.queryPolicies.bind(this));
        this.app.post('/api/policies/:id/archive', this.archivePolicy.bind(this));
        this.app.post('/api/policies/:id/activate', this.activatePolicy.bind(this));
        this.app.post('/api/policies/:id/deactivate', this.deactivatePolicy.bind(this));
        this.app.get('/api/policies/:id/audit', this.getPolicyAuditLog.bind(this));
        this.app.get('/api/policies/stats', this.getPolicyStatistics.bind(this));

        // Verification routes
        this.app.post('/api/verify', this.verify.bind(this));
        this.app.get('/api/verifications/:id', this.getVerification.bind(this));
        this.app.get('/api/verifications', this.getVerifications.bind(this));

        // Event stream routes
        this.app.get('/api/events/stats', this.getEventStreamStats.bind(this));

        // Hedera routes
        this.app.get('/api/hedera/account/:id', this.getHederaAccount.bind(this));
        this.app.get('/api/hedera/transaction/:id', this.getHederaTransaction.bind(this));

        // 404 handler
        this.app.use('*', this.notFound.bind(this));
    }

    /**
     * Setup error handling
     */
    private setupErrorHandling(): void {
        this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
            logger.error('Unhandled error', {
                error: error.message,
                stack: error.stack,
                url: req.url,
                method: req.method,
                requestId: req.headers['x-request-id'],
            });

            const errorResponse: ErrorResponse = {
                success: false,
                error: this.config.service.nodeEnv === 'production'
                    ? 'Internal server error'
                    : error.message,
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.status(500).json(errorResponse);
        });
    }

    /**
     * Health check endpoint
     */
    private async healthCheck(req: Request, res: Response): Promise<void> {
        try {
            const startTime = process.uptime();

            // Check Hedera connection
            const hederaAccount = await this.hederaClient.getAccountInfo(this.config.hedera.operatorId);
            const hederaStatus = hederaAccount.success ? 'healthy' : 'unhealthy';

            // Check event stream service
            const eventStats = this.eventStreamService.getStatistics();
            const eventStreamStatus = eventStats.isRunning ? 'healthy' : 'unhealthy';

            const health: HealthCheck = {
                status: hederaStatus === 'healthy' && eventStreamStatus === 'healthy' ? 'healthy' : 'degraded',
                timestamp: new Date().toISOString(),
                services: {
                    hedera: {
                        status: hederaStatus,
                        lastCheck: new Date().toISOString(),
                        details: hederaAccount.data,
                    },
                    eventStream: {
                        status: eventStreamStatus,
                        lastCheck: new Date().toISOString(),
                        details: eventStats,
                    },
                },
                version: '1.0.0',
                uptime: Math.floor(startTime),
            };

            res.json(health);
        } catch (error) {
            logger.error('Health check failed', { error });
            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                services: {},
                version: '1.0.0',
                uptime: Math.floor(process.uptime()),
            });
        }
    }

    /**
     * Get API version
     */
    private getVersion(req: Request, res: Response): void {
        res.json({
            version: '1.0.0',
            name: 'Hedera Facilitator Service',
            description: 'Hedera Facilitator Service for x402 payment settlement and Vincent policy registry management',
        });
    }

    /**
     * Create settlement
     */
    private async createSettlement(req: Request, res: Response): Promise<void> {
        try {
            const request: SettlementRequest = req.body;
            const result = await this.settlementService.createSettlement(request);

            const response: ApiResponse<SettlementResponse> = {
                success: result.success,
                data: result,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.status(result.success ? 201 : 400).json(response);
        } catch (error) {
            logger.error('Failed to create settlement', { error, body: req.body });
            res.status(500).json({
                success: false,
                error: 'Failed to create settlement',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Get settlement by ID
     */
    private async getSettlement(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const settlement = await this.settlementService.getSettlement(id);

            if (!settlement) {
                res.status(404).json({
                    success: false,
                    error: 'Settlement not found',
                    timestamp: new Date().toISOString(),
                    requestId: req.headers['x-request-id'] as string,
                });
                return;
            }

            const response: ApiResponse = {
                success: true,
                data: settlement,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.json(response);
        } catch (error) {
            logger.error('Failed to get settlement', { error, id: req.params.id });
            res.status(500).json({
                success: false,
                error: 'Failed to get settlement',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Get settlements with pagination
     */
    private async getSettlements(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            const status = req.query.status as any;

            const result = await this.settlementService.getSettlements(limit, offset, status);

            const response: PaginatedResponse = {
                success: true,
                data: result.settlements,
                pagination: {
                    page: Math.floor(offset / limit) + 1,
                    limit,
                    total: result.total,
                    hasMore: offset + limit < result.total,
                },
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.json(response);
        } catch (error) {
            logger.error('Failed to get settlements', { error, query: req.query });
            res.status(500).json({
                success: false,
                error: 'Failed to get settlements',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Verify settlement
     */
    private async verifySettlement(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const verification = await this.settlementService.verifySettlement(id);

            const response: ApiResponse = {
                success: true,
                data: verification,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.json(response);
        } catch (error) {
            logger.error('Failed to verify settlement', { error, id: req.params.id });
            res.status(500).json({
                success: false,
                error: 'Failed to verify settlement',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Create policy
     */
    private async createPolicy(req: Request, res: Response): Promise<void> {
        try {
            const request: PolicyCreationRequest = req.body;
            const result = await this.policyRegistryService.createPolicy(request);

            const response: ApiResponse = {
                success: result.success,
                data: result,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.status(result.success ? 201 : 400).json(response);
        } catch (error) {
            logger.error('Failed to create policy', { error, body: req.body });
            res.status(500).json({
                success: false,
                error: 'Failed to create policy',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Update policy
     */
    private async updatePolicy(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const request: PolicyUpdateRequest = { ...req.body, policyId: id };
            const result = await this.policyRegistryService.updatePolicy(request);

            const response: ApiResponse = {
                success: result.success,
                data: result,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.status(result.success ? 200 : 400).json(response);
        } catch (error) {
            logger.error('Failed to update policy', { error, id: req.params.id, body: req.body });
            res.status(500).json({
                success: false,
                error: 'Failed to update policy',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Get policy by ID
     */
    private async getPolicy(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const policy = await this.policyRegistryService.getPolicy(id);

            if (!policy) {
                res.status(404).json({
                    success: false,
                    error: 'Policy not found',
                    timestamp: new Date().toISOString(),
                    requestId: req.headers['x-request-id'] as string,
                });
                return;
            }

            const response: ApiResponse = {
                success: true,
                data: policy,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.json(response);
        } catch (error) {
            logger.error('Failed to get policy', { error, id: req.params.id });
            res.status(500).json({
                success: false,
                error: 'Failed to get policy',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Query policies
     */
    private async queryPolicies(req: Request, res: Response): Promise<void> {
        try {
            const request: PolicyQueryRequest = {
                policyId: req.query.policyId as string,
                owner: req.query.owner as string,
                status: req.query.status as any,
                limit: parseInt(req.query.limit as string) || 10,
                offset: parseInt(req.query.offset as string) || 0,
            };

            const result = await this.policyRegistryService.queryPolicies(request);

            const response: PaginatedResponse = {
                success: result.success,
                data: result.policies,
                pagination: {
                    page: Math.floor(request.offset / request.limit) + 1,
                    limit: request.limit,
                    total: result.total,
                    hasMore: result.hasMore,
                },
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.json(response);
        } catch (error) {
            logger.error('Failed to query policies', { error, query: req.query });
            res.status(500).json({
                success: false,
                error: 'Failed to query policies',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Archive policy
     */
    private async archivePolicy(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const actor = req.body.actor || 'system';
            const result = await this.policyRegistryService.archivePolicy(id, actor);

            const response: ApiResponse = {
                success: result.success,
                data: result,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.status(result.success ? 200 : 400).json(response);
        } catch (error) {
            logger.error('Failed to archive policy', { error, id: req.params.id });
            res.status(500).json({
                success: false,
                error: 'Failed to archive policy',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Activate policy
     */
    private async activatePolicy(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const actor = req.body.actor || 'system';
            const result = await this.policyRegistryService.activatePolicy(id, actor);

            const response: ApiResponse = {
                success: result.success,
                data: result,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.status(result.success ? 200 : 400).json(response);
        } catch (error) {
            logger.error('Failed to activate policy', { error, id: req.params.id });
            res.status(500).json({
                success: false,
                error: 'Failed to activate policy',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Deactivate policy
     */
    private async deactivatePolicy(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const actor = req.body.actor || 'system';
            const result = await this.policyRegistryService.deactivatePolicy(id, actor);

            const response: ApiResponse = {
                success: result.success,
                data: result,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.status(result.success ? 200 : 400).json(response);
        } catch (error) {
            logger.error('Failed to deactivate policy', { error, id: req.params.id });
            res.status(500).json({
                success: false,
                error: 'Failed to deactivate policy',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Get policy audit log
     */
    private async getPolicyAuditLog(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const auditLog = await this.policyRegistryService.getPolicyAuditLog(id);

            const response: ApiResponse = {
                success: true,
                data: auditLog,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.json(response);
        } catch (error) {
            logger.error('Failed to get policy audit log', { error, id: req.params.id });
            res.status(500).json({
                success: false,
                error: 'Failed to get policy audit log',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Get policy statistics
     */
    private async getPolicyStatistics(req: Request, res: Response): Promise<void> {
        try {
            const stats = await this.policyRegistryService.getPolicyStatistics();

            const response: ApiResponse = {
                success: true,
                data: stats,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.json(response);
        } catch (error) {
            logger.error('Failed to get policy statistics', { error });
            res.status(500).json({
                success: false,
                error: 'Failed to get policy statistics',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Verify request
     */
    private async verify(req: Request, res: Response): Promise<void> {
        try {
            const request: VerificationRequest = req.body;
            const result = await this.verificationService.verify(request);

            const response: ApiResponse = {
                success: result.success,
                data: result,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.status(result.success ? 200 : 400).json(response);
        } catch (error) {
            logger.error('Failed to verify request', { error, body: req.body });
            res.status(500).json({
                success: false,
                error: 'Failed to verify request',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Get verification by ID
     */
    private async getVerification(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const verification = await this.verificationService.getVerification(id);

            if (!verification) {
                res.status(404).json({
                    success: false,
                    error: 'Verification not found',
                    timestamp: new Date().toISOString(),
                    requestId: req.headers['x-request-id'] as string,
                });
                return;
            }

            const response: ApiResponse = {
                success: true,
                data: verification,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.json(response);
        } catch (error) {
            logger.error('Failed to get verification', { error, id: req.params.id });
            res.status(500).json({
                success: false,
                error: 'Failed to get verification',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Get verifications with pagination
     */
    private async getVerifications(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;

            const result = await this.verificationService.getVerifications(limit, offset);

            const response: PaginatedResponse = {
                success: true,
                data: result.verifications,
                pagination: {
                    page: Math.floor(offset / limit) + 1,
                    limit,
                    total: result.total,
                    hasMore: offset + limit < result.total,
                },
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.json(response);
        } catch (error) {
            logger.error('Failed to get verifications', { error, query: req.query });
            res.status(500).json({
                success: false,
                error: 'Failed to get verifications',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Get event stream statistics
     */
    private getEventStreamStats(req: Request, res: Response): void {
        try {
            const stats = this.eventStreamService.getStatistics();

            const response: ApiResponse = {
                success: true,
                data: stats,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.json(response);
        } catch (error) {
            logger.error('Failed to get event stream stats', { error });
            res.status(500).json({
                success: false,
                error: 'Failed to get event stream stats',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Get Hedera account info
     */
    private async getHederaAccount(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const accountInfo = await this.hederaClient.getAccountInfo(id);

            const response: ApiResponse = {
                success: accountInfo.success,
                data: accountInfo.data,
                error: accountInfo.error,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.status(accountInfo.success ? 200 : 400).json(response);
        } catch (error) {
            logger.error('Failed to get Hedera account', { error, id: req.params.id });
            res.status(500).json({
                success: false,
                error: 'Failed to get Hedera account',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * Get Hedera transaction record
     */
    private async getHederaTransaction(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const transaction = await this.hederaClient.getTransactionRecord(id);

            const response: ApiResponse = {
                success: transaction.success,
                data: transaction.data,
                error: transaction.error,
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            };

            res.status(transaction.success ? 200 : 400).json(response);
        } catch (error) {
            logger.error('Failed to get Hedera transaction', { error, id: req.params.id });
            res.status(500).json({
                success: false,
                error: 'Failed to get Hedera transaction',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] as string,
            });
        }
    }

    /**
     * 404 handler
     */
    private notFound(req: Request, res: Response): void {
        res.status(404).json({
            success: false,
            error: 'Endpoint not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] as string,
        });
    }

    /**
     * Get Express app
     */
    getApp(): Express {
        return this.app;
    }

    /**
     * Start the server
     */
    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            const server = this.app.listen(this.config.service.port, (error?: Error) => {
                if (error) {
                    logger.error('Failed to start REST API server', { error });
                    reject(error);
                } else {
                    logger.info('REST API server started', {
                        port: this.config.service.port,
                        environment: this.config.service.nodeEnv,
                    });
                    resolve();
                }
            });

            // Graceful shutdown
            process.on('SIGTERM', () => {
                logger.info('SIGTERM received, shutting down REST API server');
                server.close(() => {
                    logger.info('REST API server closed');
                });
            });
        });
    }
}
