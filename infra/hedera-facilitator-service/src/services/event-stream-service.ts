import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
    EventStreamConfig,
    EventSubscription,
    WebSocketEvent,
    EventHandler,
    EventProcessingResult,
    BaseEvent
} from '../types/events.js';
import { SettlementService } from './settlement-service.js';
import { PolicyRegistryService } from './policy-registry-service.js';
import { VerificationService } from './verification-service.js';
import { HederaClient } from '../core/hedera-client.js';
import { HederaConfig } from '../types/hedera.js';
import { logger } from '../core/logger.js';
import { EventEmitter } from 'events';

export class EventStreamService extends EventEmitter {
    private wss: WebSocketServer;
    private subscriptions: Map<string, EventSubscription> = new Map();
    private clients: Map<string, WebSocket> = new Map();
    private eventHandlers: Map<string, EventHandler> = new Map();
    private config: EventStreamConfig;
    private hederaClient: HederaClient;
    private hederaConfig: HederaConfig;
    private isRunning: boolean = false;
    private pollInterval: NodeJS.Timeout | null = null;

    constructor(
        port: number,
        hederaClient: HederaClient,
        hederaConfig: HederaConfig,
        settlementService: SettlementService,
        policyRegistryService: PolicyRegistryService,
        verificationService: VerificationService
    ) {
        super();

        this.hederaClient = hederaClient;
        this.hederaConfig = hederaConfig;

        this.config = {
            streamId: 'hedera-facilitator-events',
            topics: [hederaConfig.policyTopicId, hederaConfig.paymentTopicId],
            batchSize: 100,
            pollInterval: 5000,
            maxRetries: 3,
            retryDelay: 1000,
        };

        // Initialize WebSocket server
        this.wss = new WebSocketServer({ port });
        this.setupWebSocketServer();

        // Setup event handlers
        this.setupEventHandlers(settlementService, policyRegistryService, verificationService);
    }

    /**
     * Start the event stream service
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Event stream service is already running');
            return;
        }

        try {
            this.isRunning = true;

            // Start polling Hedera topics
            this.startTopicPolling();

            logger.info('Event stream service started', {
                port: this.wss.options.port,
                topics: this.config.topics,
            });
        } catch (error) {
            logger.error('Failed to start event stream service', { error });
            this.isRunning = false;
            throw error;
        }
    }

    /**
     * Stop the event stream service
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        try {
            this.isRunning = false;

            // Stop polling
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
            }

            // Close all client connections
            for (const [clientId, ws] of this.clients) {
                ws.close(1000, 'Service shutting down');
            }
            this.clients.clear();

            // Close WebSocket server
            this.wss.close();

            logger.info('Event stream service stopped');
        } catch (error) {
            logger.error('Failed to stop event stream service', { error });
        }
    }

    /**
     * Setup WebSocket server
     */
    private setupWebSocketServer(): void {
        this.wss.on('connection', (ws: WebSocket, request) => {
            const clientId = uuidv4();
            const clientIP = request.socket.remoteAddress;

            this.clients.set(clientId, ws);

            logger.info('WebSocket client connected', { clientId, clientIP });

            // Send welcome message
            this.sendToClient(clientId, {
                type: 'heartbeat',
                data: { message: 'Connected to Hedera Facilitator Event Stream' },
                timestamp: new Date().toISOString(),
            });

            // Handle client messages
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleClientMessage(clientId, message);
                } catch (error) {
                    logger.error('Failed to parse client message', { clientId, error, data: data.toString() });
                    this.sendErrorToClient(clientId, 'Invalid message format');
                }
            });

            // Handle client disconnect
            ws.on('close', (code, reason) => {
                this.clients.delete(clientId);
                this.removeClientSubscriptions(clientId);
                logger.info('WebSocket client disconnected', { clientId, code, reason: reason.toString() });
            });

            // Handle client errors
            ws.on('error', (error) => {
                logger.error('WebSocket client error', { clientId, error });
                this.clients.delete(clientId);
                this.removeClientSubscriptions(clientId);
            });
        });

        this.wss.on('error', (error) => {
            logger.error('WebSocket server error', { error });
        });
    }

    /**
     * Setup event handlers for services
     */
    private setupEventHandlers(
        settlementService: SettlementService,
        policyRegistryService: PolicyRegistryService,
        verificationService: VerificationService
    ): void {
        // Settlement events
        settlementService.on('settlement_event', (event) => {
            this.broadcastEvent('settlement', event);
        });

        // Policy events
        policyRegistryService.on('policy_event', (event) => {
            this.broadcastEvent('policy', event);
        });

        // Verification events
        verificationService.on('verification_event', (event) => {
            this.broadcastEvent('verification', event);
        });
    }

    /**
     * Start polling Hedera topics
     */
    private startTopicPolling(): void {
        this.pollInterval = setInterval(async () => {
            if (!this.isRunning) return;

            try {
                await this.pollTopics();
            } catch (error) {
                logger.error('Error polling topics', { error });
            }
        }, this.config.pollInterval);
    }

    /**
     * Poll Hedera topics for new messages
     */
    private async pollTopics(): Promise<void> {
        for (const topicId of this.config.topics) {
            try {
                const messagesResult = await this.hederaClient.queryTopicMessages(
                    topicId,
                    undefined, // startTime - would be last poll time in production
                    undefined, // endTime
                    this.config.batchSize
                );

                if (messagesResult.success && messagesResult.data) {
                    for (const message of messagesResult.data) {
                        await this.processTopicMessage(topicId, message);
                    }
                }
            } catch (error) {
                logger.error('Failed to poll topic', { topicId, error });
            }
        }
    }

    /**
     * Process a topic message
     */
    private async processTopicMessage(topicId: string, message: any): Promise<void> {
        try {
            const event: BaseEvent = {
                eventId: uuidv4(),
                eventType: 'hedera_topic_message',
                timestamp: new Date().toISOString(),
                source: 'hedera',
                version: '1.0.0',
                data: {
                    topicId,
                    message,
                },
            };

            // Broadcast to subscribed clients
            this.broadcastEvent('hedera', event);

            // Process with event handlers
            await this.processEvent(event);
        } catch (error) {
            logger.error('Failed to process topic message', { topicId, error });
        }
    }

    /**
     * Process an event with registered handlers
     */
    private async processEvent(event: BaseEvent): Promise<EventProcessingResult> {
        const results: EventProcessingResult = {
            success: true,
            processedCount: 0,
            failedCount: 0,
            errors: [],
            timestamp: new Date().toISOString(),
        };

        for (const [handlerId, handler] of this.eventHandlers) {
            try {
                if (handler.isActive && handler.eventType === event.eventType) {
                    await handler.handler(event);
                    results.processedCount++;
                }
            } catch (error) {
                results.failedCount++;
                results.errors.push(`Handler ${handlerId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                logger.error('Event handler failed', { handlerId, eventType: event.eventType, error });
            }
        }

        results.success = results.failedCount === 0;

        return results;
    }

    /**
     * Handle client message
     */
    private handleClientMessage(clientId: string, message: any): void {
        switch (message.type) {
            case 'subscribe':
                this.handleSubscription(clientId, message);
                break;
            case 'unsubscribe':
                this.handleUnsubscription(clientId, message);
                break;
            case 'ping':
                this.sendToClient(clientId, {
                    type: 'pong',
                    data: { timestamp: new Date().toISOString() },
                    timestamp: new Date().toISOString(),
                });
                break;
            default:
                this.sendErrorToClient(clientId, `Unknown message type: ${message.type}`);
        }
    }

    /**
     * Handle client subscription
     */
    private handleSubscription(clientId: string, message: any): void {
        try {
            const { topics, filters } = message;

            if (!Array.isArray(topics) || topics.length === 0) {
                this.sendErrorToClient(clientId, 'Invalid topics provided');
                return;
            }

            const subscriptionId = uuidv4();
            const subscription: EventSubscription = {
                subscriptionId,
                clientId,
                topics,
                filters,
                createdAt: new Date().toISOString(),
                isActive: true,
            };

            this.subscriptions.set(subscriptionId, subscription);

            this.sendToClient(clientId, {
                type: 'subscription_update',
                data: { subscriptionId, status: 'subscribed' },
                timestamp: new Date().toISOString(),
                subscriptionId,
            });

            logger.info('Client subscribed to events', { clientId, subscriptionId, topics });
        } catch (error) {
            logger.error('Failed to handle subscription', { clientId, error });
            this.sendErrorToClient(clientId, 'Failed to create subscription');
        }
    }

    /**
     * Handle client unsubscription
     */
    private handleUnsubscription(clientId: string, message: any): void {
        try {
            const { subscriptionId } = message;

            if (subscriptionId) {
                const subscription = this.subscriptions.get(subscriptionId);
                if (subscription && subscription.clientId === clientId) {
                    subscription.isActive = false;
                    this.subscriptions.set(subscriptionId, subscription);

                    this.sendToClient(clientId, {
                        type: 'subscription_update',
                        data: { subscriptionId, status: 'unsubscribed' },
                        timestamp: new Date().toISOString(),
                        subscriptionId,
                    });
                }
            } else {
                // Unsubscribe from all topics
                this.removeClientSubscriptions(clientId);
            }

            logger.info('Client unsubscribed from events', { clientId, subscriptionId });
        } catch (error) {
            logger.error('Failed to handle unsubscription', { clientId, error });
            this.sendErrorToClient(clientId, 'Failed to unsubscribe');
        }
    }

    /**
     * Remove all subscriptions for a client
     */
    private removeClientSubscriptions(clientId: string): void {
        for (const [subscriptionId, subscription] of this.subscriptions) {
            if (subscription.clientId === clientId) {
                subscription.isActive = false;
                this.subscriptions.set(subscriptionId, subscription);
            }
        }
    }

    /**
     * Broadcast event to subscribed clients
     */
    private broadcastEvent(eventType: string, event: any): void {
        const eventData: WebSocketEvent = {
            type: 'event',
            data: event,
            timestamp: new Date().toISOString(),
        };

        for (const [subscriptionId, subscription] of this.subscriptions) {
            if (!subscription.isActive) continue;

            // Check if client is subscribed to this event type
            if (subscription.topics.includes(eventType) || subscription.topics.includes('*')) {
                this.sendToClient(subscription.clientId, eventData);
            }
        }
    }

    /**
     * Send message to specific client
     */
    private sendToClient(clientId: string, message: WebSocketEvent): void {
        const ws = this.clients.get(clientId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(message));
            } catch (error) {
                logger.error('Failed to send message to client', { clientId, error });
                this.clients.delete(clientId);
            }
        }
    }

    /**
     * Send error message to specific client
     */
    private sendErrorToClient(clientId: string, error: string): void {
        this.sendToClient(clientId, {
            type: 'error',
            data: { error },
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Register event handler
     */
    registerEventHandler(eventType: string, handler: (event: BaseEvent) => Promise<void>): string {
        const handlerId = uuidv4();
        const eventHandler: EventHandler = {
            handlerId,
            eventType,
            handler,
            isActive: true,
            createdAt: new Date().toISOString(),
        };

        this.eventHandlers.set(handlerId, eventHandler);
        logger.info('Event handler registered', { handlerId, eventType });

        return handlerId;
    }

    /**
     * Unregister event handler
     */
    unregisterEventHandler(handlerId: string): boolean {
        const handler = this.eventHandlers.get(handlerId);
        if (handler) {
            handler.isActive = false;
            this.eventHandlers.set(handlerId, handler);
            logger.info('Event handler unregistered', { handlerId });
            return true;
        }
        return false;
    }

    /**
     * Get service statistics
     */
    getStatistics(): {
        isRunning: boolean;
        connectedClients: number;
        activeSubscriptions: number;
        registeredHandlers: number;
        topics: string[];
    } {
        const activeSubscriptions = Array.from(this.subscriptions.values())
            .filter(s => s.isActive).length;

        const registeredHandlers = Array.from(this.eventHandlers.values())
            .filter(h => h.isActive).length;

        return {
            isRunning: this.isRunning,
            connectedClients: this.clients.size,
            activeSubscriptions,
            registeredHandlers,
            topics: this.config.topics,
        };
    }
}
