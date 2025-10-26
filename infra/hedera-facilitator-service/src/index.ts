#!/usr/bin/env node

import { HederaClient } from './core/hedera-client.js';
import { SettlementService } from './services/settlement-service.js';
import { PolicyRegistryService } from './services/policy-registry-service.js';
import { VerificationService } from './services/verification-service.js';
import { EventStreamService } from './services/event-stream-service.js';
import { RestApiServer } from './server/rest-api.js';
import { GrpcServer } from './server/grpc-server.js';
import { configManager } from './core/config.js';
import { logger } from './core/logger.js';

class HederaFacilitatorService {
    private hederaClient: HederaClient;
    private settlementService: SettlementService;
    private policyRegistryService: PolicyRegistryService;
    private verificationService: VerificationService;
    private eventStreamService: EventStreamService;
    private restApiServer: RestApiServer;
    private grpcServer: GrpcServer;
    private config = configManager.getConfig();
    private isRunning: boolean = false;

    constructor() {
        this.initializeServices();
    }

    /**
     * Initialize all services
     */
    private initializeServices(): void {
        try {
            // Initialize Hedera client
            this.hederaClient = new HederaClient(this.config.hedera);
            logger.info('Hedera client initialized');

            // Initialize core services
            this.settlementService = new SettlementService(this.hederaClient, this.config.hedera);
            this.policyRegistryService = new PolicyRegistryService(this.hederaClient, this.config.hedera);
            this.verificationService = new VerificationService(
                this.hederaClient,
                this.settlementService,
                this.policyRegistryService
            );

            // Initialize event stream service
            this.eventStreamService = new EventStreamService(
                this.config.service.wsPort,
                this.hederaClient,
                this.config.hedera,
                this.settlementService,
                this.policyRegistryService,
                this.verificationService
            );

            // Initialize API servers
            this.restApiServer = new RestApiServer(
                this.settlementService,
                this.policyRegistryService,
                this.verificationService,
                this.eventStreamService,
                this.hederaClient
            );

            this.grpcServer = new GrpcServer(
                this.settlementService,
                this.policyRegistryService,
                this.verificationService,
                this.hederaClient
            );

            logger.info('All services initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize services', { error });
            throw error;
        }
    }

    /**
     * Start the service
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Service is already running');
            return;
        }

        try {
            logger.info('Starting Hedera Facilitator Service...', {
                version: '1.0.0',
                environment: this.config.service.nodeEnv,
                network: this.config.hedera.network,
            });

            // Start event stream service
            await this.eventStreamService.start();
            logger.info('Event stream service started');

            // Start REST API server
            await this.restApiServer.start();
            logger.info('REST API server started');

            // Start gRPC server
            await this.grpcServer.start();
            logger.info('gRPC server started');

            this.isRunning = true;

            logger.info('Hedera Facilitator Service started successfully', {
                restPort: this.config.service.port,
                grpcPort: this.config.service.grpcPort,
                wsPort: this.config.service.wsPort,
                hederaNetwork: this.config.hedera.network,
            });

            // Setup graceful shutdown
            this.setupGracefulShutdown();
        } catch (error) {
            logger.error('Failed to start service', { error });
            await this.stop();
            throw error;
        }
    }

    /**
     * Stop the service
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        try {
            logger.info('Stopping Hedera Facilitator Service...');

            // Stop API servers
            if (this.grpcServer) {
                await this.grpcServer.stop();
                logger.info('gRPC server stopped');
            }

            if (this.restApiServer) {
                // REST API server will be stopped by the process signal handler
                logger.info('REST API server stopping...');
            }

            // Stop event stream service
            if (this.eventStreamService) {
                await this.eventStreamService.stop();
                logger.info('Event stream service stopped');
            }

            // Close Hedera client
            if (this.hederaClient) {
                await this.hederaClient.close();
                logger.info('Hedera client closed');
            }

            this.isRunning = false;
            logger.info('Hedera Facilitator Service stopped successfully');
        } catch (error) {
            logger.error('Error during service shutdown', { error });
        }
    }

    /**
     * Setup graceful shutdown handlers
     */
    private setupGracefulShutdown(): void {
        const shutdown = async (signal: string) => {
            logger.info(`Received ${signal}, starting graceful shutdown...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception', { error });
            shutdown('uncaughtException');
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled promise rejection', { reason, promise });
            shutdown('unhandledRejection');
        });
    }

    /**
     * Get service status
     */
    getStatus(): {
        isRunning: boolean;
        services: {
            hedera: boolean;
            settlement: boolean;
            policy: boolean;
            verification: boolean;
            eventStream: boolean;
            restApi: boolean;
            grpc: boolean;
        };
        config: {
            network: string;
            restPort: number;
            grpcPort: number;
            wsPort: number;
        };
    } {
        return {
            isRunning: this.isRunning,
            services: {
                hedera: !!this.hederaClient,
                settlement: !!this.settlementService,
                policy: !!this.policyRegistryService,
                verification: !!this.verificationService,
                eventStream: !!this.eventStreamService,
                restApi: !!this.restApiServer,
                grpc: !!this.grpcServer,
            },
            config: {
                network: this.config.hedera.network,
                restPort: this.config.service.port,
                grpcPort: this.config.service.grpcPort,
                wsPort: this.config.service.wsPort,
            },
        };
    }
}

// Main execution
async function main(): Promise<void> {
    try {
        const service = new HederaFacilitatorService();
        await service.start();

        // Keep the process alive
        process.stdin.resume();
    } catch (error) {
        logger.error('Failed to start Hedera Facilitator Service', { error });
        process.exit(1);
    }
}

// Run the service if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        logger.error('Unhandled error in main', { error });
        process.exit(1);
    });
}

export { HederaFacilitatorService };
export * from './types/index.js';
export * from './core/hedera-client.js';
export * from './services/settlement-service.js';
export * from './services/policy-registry-service.js';
export * from './services/verification-service.js';
export * from './services/event-stream-service.js';
export * from './server/rest-api.js';
export * from './server/grpc-server.js';
