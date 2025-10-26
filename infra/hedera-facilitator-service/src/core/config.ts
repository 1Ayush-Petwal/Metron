import { config } from 'dotenv';
import { z } from 'zod';
import { Config, ConfigSchema } from '../types/config.js';
import { logger } from './logger.js';

// Load environment variables
config();

/**
 * Configuration manager for the Hedera Facilitator Service
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): Config {
    try {
      const rawConfig = {
        service: {
          port: parseInt(process.env.PORT || '3000'),
          grpcPort: parseInt(process.env.GRPC_PORT || '50051'),
          wsPort: parseInt(process.env.WS_PORT || '8080'),
          nodeEnv: process.env.NODE_ENV || 'development',
          logLevel: process.env.LOG_LEVEL || 'info',
          enableTelemetry: process.env.ENABLE_TELEMETRY === 'true',
          telemetryEndpoint: process.env.TELEMETRY_ENDPOINT,
        },
        hedera: {
          network: process.env.HEDERA_NETWORK || 'testnet',
          mirrorNodeUrl: process.env.HEDERA_MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com',
          consensusNodeUrl: process.env.HEDERA_CONSENSUS_NODE_URL || 'https://testnet.hedera.com:50211',
          operatorId: process.env.HEDERA_OPERATOR_ID || '',
          operatorKey: process.env.HEDERA_OPERATOR_KEY || '',
          maxTransactionFee: process.env.HEDERA_MAX_TRANSACTION_FEE || '2',
          maxQueryPayment: process.env.HEDERA_MAX_QUERY_PAYMENT || '1',
          policyRegistryContractId: process.env.POLICY_REGISTRY_CONTRACT_ID || '',
          policyTopicId: process.env.POLICY_TOPIC_ID || '',
          paymentSettlementContractId: process.env.PAYMENT_SETTLEMENT_CONTRACT_ID || '',
          paymentTopicId: process.env.PAYMENT_TOPIC_ID || '',
        },
        security: {
          jwtSecret: process.env.JWT_SECRET || '',
          apiKeySecret: process.env.API_KEY_SECRET || '',
          enableCors: process.env.ENABLE_CORS !== 'false',
          corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
          enableHelmet: process.env.ENABLE_HELMET !== 'false',
          rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
          rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        },
        database: {
          url: process.env.DATABASE_URL,
          type: (process.env.DATABASE_TYPE as 'postgresql' | 'mysql' | 'sqlite' | 'memory') || 'memory',
          host: process.env.DATABASE_HOST,
          port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT) : undefined,
          username: process.env.DATABASE_USERNAME,
          password: process.env.DATABASE_PASSWORD,
          database: process.env.DATABASE_NAME,
          ssl: process.env.DATABASE_SSL === 'true',
          poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10'),
        },
      };

      // Validate configuration
      const validatedConfig = ConfigSchema.parse(rawConfig);

      // Validate required fields
      if (!validatedConfig.hedera.operatorId) {
        throw new Error('HEDERA_OPERATOR_ID is required');
      }
      if (!validatedConfig.hedera.operatorKey) {
        throw new Error('HEDERA_OPERATOR_KEY is required');
      }
      if (!validatedConfig.security.jwtSecret) {
        throw new Error('JWT_SECRET is required');
      }
      if (!validatedConfig.security.apiKeySecret) {
        throw new Error('API_KEY_SECRET is required');
      }

      logger.info('Configuration loaded successfully', {
        nodeEnv: validatedConfig.service.nodeEnv,
        network: validatedConfig.hedera.network,
        port: validatedConfig.service.port,
      });

      return validatedConfig;
    } catch (error) {
      logger.error('Failed to load configuration', { error });
      throw new Error(`Configuration validation failed: ${error}`);
    }
  }

  public getConfig(): Config {
    return this.config;
  }

  public getServiceConfig() {
    return this.config.service;
  }

  public getHederaConfig() {
    return this.config.hedera;
  }

  public getSecurityConfig() {
    return this.config.security;
  }

  public getDatabaseConfig() {
    return this.config.database;
  }

  public isDevelopment(): boolean {
    return this.config.service.nodeEnv === 'development';
  }

  public isProduction(): boolean {
    return this.config.service.nodeEnv === 'production';
  }

  public isTest(): boolean {
    return this.config.service.nodeEnv === 'test';
  }
}

export const configManager = ConfigManager.getInstance();
export const getConfig = () => configManager.getConfig();
