import {
    Client,
    AccountId,
    PrivateKey,
    TopicCreateTransaction,
    TopicMessageSubmitTransaction,
    TopicMessageQuery,
    ContractCreateTransaction,
    ContractCallQuery,
    ContractExecuteTransaction,
    TransactionResponse,
    TransactionReceipt,
    TransactionRecord,
    AccountInfoQuery,
    Hbar,
    Status,
    MirrorClient,
    MirrorConsensusServiceClient,
    MirrorNodeClient,
} from '@hashgraph/sdk';
import { HederaConfig, HederaTransactionResult, HederaQueryResult } from '../types/hedera.js';
import { logger } from './logger.js';

export class HederaClient {
    private client: Client;
    private mirrorClient: MirrorClient;
    private consensusClient: MirrorConsensusServiceClient;
    private mirrorNodeClient: MirrorNodeClient;
    private config: HederaConfig;

    constructor(config: HederaConfig) {
        this.config = config;
        this.initializeClients();
    }

    private initializeClients(): void {
        try {
            // Initialize main Hedera client
            this.client = Client.forName(this.config.network);
            this.client.setOperator(
                AccountId.fromString(this.config.operatorId),
                PrivateKey.fromString(this.config.operatorKey)
            );
            this.client.setMaxTransactionFee(new Hbar(this.config.maxTransactionFee));
            this.client.setMaxQueryPayment(new Hbar(this.config.maxQueryPayment));

            // Initialize mirror clients
            this.mirrorClient = new MirrorClient(this.config.mirrorNodeUrl);
            this.consensusClient = new MirrorConsensusServiceClient(this.config.mirrorNodeUrl);
            this.mirrorNodeClient = new MirrorNodeClient(this.config.mirrorNodeUrl);

            logger.info('Hedera clients initialized successfully', {
                network: this.config.network,
                operatorId: this.config.operatorId,
            });
        } catch (error) {
            logger.error('Failed to initialize Hedera clients', { error });
            throw new Error(`Failed to initialize Hedera clients: ${error}`);
        }
    }

    /**
     * Get account information
     */
    async getAccountInfo(accountId: string): Promise<HederaQueryResult> {
        try {
            const query = new AccountInfoQuery().setAccountId(AccountId.fromString(accountId));
            const accountInfo = await query.execute(this.client);

            return {
                success: true,
                data: {
                    accountId: accountInfo.accountId.toString(),
                    balance: accountInfo.balance.toString(),
                    key: accountInfo.key?.toString() || '',
                    isDeleted: accountInfo.isDeleted,
                    autoRenewPeriod: accountInfo.autoRenewPeriod?.toString() || '',
                    proxyAccountId: accountInfo.proxyAccountId?.toString(),
                    proxyReceived: accountInfo.proxyReceived?.toString(),
                },
            };
        } catch (error) {
            logger.error('Failed to get account info', { accountId, error });
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Create a new topic
     */
    async createTopic(
        adminKey?: string,
        submitKey?: string,
        autoRenewAccountId?: string,
        autoRenewPeriod?: string,
        memo?: string
    ): Promise<HederaTransactionResult> {
        try {
            const transaction = new TopicCreateTransaction();

            if (adminKey) {
                transaction.setAdminKey(PrivateKey.fromString(adminKey));
            }
            if (submitKey) {
                transaction.setSubmitKey(PrivateKey.fromString(submitKey));
            }
            if (autoRenewAccountId) {
                transaction.setAutoRenewAccountId(AccountId.fromString(autoRenewAccountId));
            }
            if (autoRenewPeriod) {
                transaction.setAutoRenewPeriod(parseInt(autoRenewPeriod));
            }
            if (memo) {
                transaction.setTopicMemo(memo);
            }

            const response = await transaction.execute(this.client);
            const receipt = await response.getReceipt(this.client);
            const record = await response.getRecord(this.client);

            return {
                success: true,
                transactionId: response.transactionId.toString(),
                consensusTimestamp: record.consensusTimestamp.toString(),
                transactionHash: Buffer.from(response.transactionHash).toString('hex'),
                receipt: receipt,
                record: record,
            };
        } catch (error) {
            logger.error('Failed to create topic', { error });
            return {
                success: false,
                transactionId: '',
                consensusTimestamp: '',
                transactionHash: '',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Submit a message to a topic
     */
    async submitTopicMessage(
        topicId: string,
        message: string
    ): Promise<HederaTransactionResult> {
        try {
            const transaction = new TopicMessageSubmitTransaction()
                .setTopicId(topicId)
                .setMessage(message);

            const response = await transaction.execute(this.client);
            const receipt = await response.getReceipt(this.client);
            const record = await response.getRecord(this.client);

            return {
                success: true,
                transactionId: response.transactionId.toString(),
                consensusTimestamp: record.consensusTimestamp.toString(),
                transactionHash: Buffer.from(response.transactionHash).toString('hex'),
                receipt: receipt,
                record: record,
            };
        } catch (error) {
            logger.error('Failed to submit topic message', { topicId, error });
            return {
                success: false,
                transactionId: '',
                consensusTimestamp: '',
                transactionHash: '',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Query topic messages
     */
    async queryTopicMessages(
        topicId: string,
        startTime?: Date,
        endTime?: Date,
        limit?: number
    ): Promise<HederaQueryResult> {
        try {
            const query = new TopicMessageQuery()
                .setTopicId(topicId);

            if (startTime) {
                query.setStartTime(startTime);
            }
            if (endTime) {
                query.setEndTime(endTime);
            }
            if (limit) {
                query.setLimit(limit);
            }

            const messages = await query.execute(this.client);
            const formattedMessages = messages.map(msg => ({
                topicId: msg.topicId.toString(),
                sequenceNumber: msg.sequenceNumber,
                runningHash: Buffer.from(msg.runningHash).toString('hex'),
                consensusTimestamp: msg.consensusTimestamp.toString(),
                message: Buffer.from(msg.contents).toString('utf-8'),
                chunkInfo: msg.chunkInfo ? {
                    initialTransactionId: msg.chunkInfo.initialTransactionId.toString(),
                    number: msg.chunkInfo.number,
                    total: msg.chunkInfo.total,
                } : undefined,
            }));

            return {
                success: true,
                data: formattedMessages,
            };
        } catch (error) {
            logger.error('Failed to query topic messages', { topicId, error });
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Create a smart contract
     */
    async createContract(
        bytecode: string,
        constructorParameters?: string[],
        gas?: number,
        initialBalance?: string,
        adminKey?: string,
        autoRenewAccountId?: string,
        autoRenewPeriod?: string,
        memo?: string
    ): Promise<HederaTransactionResult> {
        try {
            const transaction = new ContractCreateTransaction()
                .setBytecode(bytecode)
                .setGas(gas || 100000);

            if (constructorParameters) {
                transaction.setConstructorParameters(...constructorParameters);
            }
            if (initialBalance) {
                transaction.setInitialBalance(new Hbar(initialBalance));
            }
            if (adminKey) {
                transaction.setAdminKey(PrivateKey.fromString(adminKey));
            }
            if (autoRenewAccountId) {
                transaction.setAutoRenewAccountId(AccountId.fromString(autoRenewAccountId));
            }
            if (autoRenewPeriod) {
                transaction.setAutoRenewPeriod(parseInt(autoRenewPeriod));
            }
            if (memo) {
                transaction.setContractMemo(memo);
            }

            const response = await transaction.execute(this.client);
            const receipt = await response.getReceipt(this.client);
            const record = await response.getRecord(this.client);

            return {
                success: true,
                transactionId: response.transactionId.toString(),
                consensusTimestamp: record.consensusTimestamp.toString(),
                transactionHash: Buffer.from(response.transactionHash).toString('hex'),
                receipt: receipt,
                record: record,
            };
        } catch (error) {
            logger.error('Failed to create contract', { error });
            return {
                success: false,
                transactionId: '',
                consensusTimestamp: '',
                transactionHash: '',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Call a smart contract function
     */
    async callContract(
        contractId: string,
        functionName: string,
        parameters?: any[]
    ): Promise<HederaQueryResult> {
        try {
            const query = new ContractCallQuery()
                .setContractId(contractId)
                .setFunction(functionName);

            if (parameters) {
                query.setFunctionParameters(...parameters);
            }

            const result = await query.execute(this.client);

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            logger.error('Failed to call contract', { contractId, functionName, error });
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Execute a smart contract function
     */
    async executeContract(
        contractId: string,
        functionName: string,
        parameters?: any[]
    ): Promise<HederaTransactionResult> {
        try {
            const transaction = new ContractExecuteTransaction()
                .setContractId(contractId)
                .setFunction(functionName);

            if (parameters) {
                transaction.setFunctionParameters(...parameters);
            }

            const response = await transaction.execute(this.client);
            const receipt = await response.getReceipt(this.client);
            const record = await response.getRecord(this.client);

            return {
                success: true,
                transactionId: response.transactionId.toString(),
                consensusTimestamp: record.consensusTimestamp.toString(),
                transactionHash: Buffer.from(response.transactionHash).toString('hex'),
                receipt: receipt,
                record: record,
            };
        } catch (error) {
            logger.error('Failed to execute contract', { contractId, functionName, error });
            return {
                success: false,
                transactionId: '',
                consensusTimestamp: '',
                transactionHash: '',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Get transaction record
     */
    async getTransactionRecord(transactionId: string): Promise<HederaQueryResult> {
        try {
            const record = await this.mirrorNodeClient.getTransactionRecord(transactionId);

            return {
                success: true,
                data: record,
            };
        } catch (error) {
            logger.error('Failed to get transaction record', { transactionId, error });
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Close the client connections
     */
    async close(): Promise<void> {
        try {
            this.client.close();
            await this.mirrorClient.close();
            await this.consensusClient.close();
            await this.mirrorNodeClient.close();
            logger.info('Hedera clients closed successfully');
        } catch (error) {
            logger.error('Failed to close Hedera clients', { error });
        }
    }

    /**
     * Get the underlying client instances
     */
    getClients() {
        return {
            client: this.client,
            mirrorClient: this.mirrorClient,
            consensusClient: this.consensusClient,
            mirrorNodeClient: this.mirrorNodeClient,
        };
    }
}
