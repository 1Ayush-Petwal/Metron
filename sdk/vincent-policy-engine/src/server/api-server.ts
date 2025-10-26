import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PolicyManager } from '../core/policy-manager';
import { DelegationManager } from '../core/delegation-manager';
import { EnforcementEngine } from '../core/enforcement-engine';
import { AuditLogger } from '../core/audit-logger';
import { HederaRegistry } from '../core/hedera-registry';
import { VincentPolicyEngine } from '../core/vincent-policy-engine';
import { VincentDelegationManager } from '../core/vincent-delegation-manager';
import { createPolicyRoutes } from './routes/policy-routes';
import { createDelegationRoutes } from './routes/delegation-routes';
import { createEnforcementRoutes } from './routes/enforcement-routes';
import { createAuditRoutes } from './routes/audit-routes';
import { createHealthRoutes } from './routes/health-routes';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { authMiddleware } from './middleware/auth-middleware';
import { 
  HederaNetworkConfig,
  VincentClientConfig,
  EnforcementMiddlewareConfig
} from '../types';

export interface ApiServerConfig {
  port: number;
  hederaConfig: HederaNetworkConfig;
  vincentConfig: VincentClientConfig;
  enforcementConfig: EnforcementMiddlewareConfig;
  enableAuth: boolean;
  enableCors: boolean;
  enableHelmet: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class ApiServer {
  private app: express.Application;
  private server: any;
  private policyManager: PolicyManager;
  private delegationManager: DelegationManager;
  private enforcementEngine: EnforcementEngine;
  private auditLogger: AuditLogger;
  private hederaRegistry: HederaRegistry;
  private vincentPolicyEngine: VincentPolicyEngine;
  private vincentDelegationManager: VincentDelegationManager;

  constructor(private config: ApiServerConfig) {
    this.app = express();
    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Initialize all services
   */
  private initializeServices(): void {
    // Initialize Hedera registry
    this.hederaRegistry = new HederaRegistry({
      networkConfig: this.config.hederaConfig,
    });

    // Initialize audit logger
    this.auditLogger = new AuditLogger({
      hederaRegistry: this.hederaRegistry,
      logLevel: this.config.logLevel,
      enableHederaLogging: true,
      enableConsoleLogging: true,
    });

    // Initialize Vincent policy engine
    this.vincentPolicyEngine = new VincentPolicyEngine({
      clientConfig: this.config.vincentConfig,
      policies: new Map(),
      abilities: new Map(),
    });

    // Initialize Vincent delegation manager
    this.vincentDelegationManager = new VincentDelegationManager({
      clientConfig: this.config.vincentConfig,
    });

    // Initialize policy manager
    this.policyManager = new PolicyManager({
      hederaRegistry: this.hederaRegistry,
      vincentEngine: this.vincentPolicyEngine,
      auditLogger: this.auditLogger,
    });

    // Initialize delegation manager
    this.delegationManager = new DelegationManager({
      hederaRegistry: this.hederaRegistry,
      auditLogger: this.auditLogger,
      vincentDelegationManager: this.vincentDelegationManager,
    });

    // Initialize enforcement engine
    this.enforcementEngine = new EnforcementEngine({
      policyManager: this.policyManager,
      delegationManager: this.delegationManager,
      auditLogger: this.auditLogger,
      config: this.config.enforcementConfig,
    });
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    if (this.config.enableHelmet) {
      this.app.use(helmet());
    }

    // CORS middleware
    if (this.config.enableCors) {
      this.app.use(cors({
        origin: true,
        credentials: true,
      }));
    }

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    this.app.use(requestLogger);

    // Authentication middleware
    if (this.config.enableAuth) {
      this.app.use(authMiddleware);
    }
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check routes
    this.app.use('/health', createHealthRoutes({
      hederaRegistry: this.hederaRegistry,
      auditLogger: this.auditLogger,
    }));

    // Policy routes
    this.app.use('/api/v1/policies', createPolicyRoutes({
      policyManager: this.policyManager,
      auditLogger: this.auditLogger,
    }));

    // Delegation routes
    this.app.use('/api/v1/delegations', createDelegationRoutes({
      delegationManager: this.delegationManager,
      auditLogger: this.auditLogger,
    }));

    // Enforcement routes
    this.app.use('/api/v1/enforcement', createEnforcementRoutes({
      enforcementEngine: this.enforcementEngine,
      auditLogger: this.auditLogger,
    }));

    // Audit routes
    this.app.use('/api/v1/audit', createAuditRoutes({
      auditLogger: this.auditLogger,
    }));

    // Root route
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Vincent Policy Engine API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found',
        message: `The requested route ${req.originalUrl} was not found`,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, () => {
          console.log(`Vincent Policy Engine API server running on port ${this.config.port}`);
          console.log(`Health check: http://localhost:${this.config.port}/health`);
          console.log(`API documentation: http://localhost:${this.config.port}/api/v1`);
          resolve();
        });

        this.server.on('error', (error: any) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((error: any) => {
          if (error) {
            reject(error);
          } else {
            console.log('Vincent Policy Engine API server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the Express app instance
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Get server status
   */
  getStatus(): {
    running: boolean;
    port: number;
    services: {
      hedera: boolean;
      audit: boolean;
      policy: boolean;
      delegation: boolean;
      enforcement: boolean;
    };
  } {
    return {
      running: !!this.server,
      port: this.config.port,
      services: {
        hedera: this.hederaRegistry.isHealthy(),
        audit: true,
        policy: true,
        delegation: true,
        enforcement: true,
      },
    };
  }
}

/**
 * Create and start the API server
 */
export async function createApiServer(config: ApiServerConfig): Promise<ApiServer> {
  const server = new ApiServer(config);
  await server.start();
  return server;
}

/**
 * Default configuration
 */
export const defaultConfig: ApiServerConfig = {
  port: 3000,
  hederaConfig: {
    network: 'testnet',
    mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
    consensusNodeUrl: 'https://testnet.hedera.com',
    operatorId: process.env.HEDERA_OPERATOR_ID || '',
    operatorKey: process.env.HEDERA_OPERATOR_KEY || '',
  },
  vincentConfig: {
    network: 'testnet',
    rpcUrl: process.env.VINCENT_RPC_URL || 'https://testnet.vincent.com',
    privateKey: process.env.VINCENT_PRIVATE_KEY || '',
    publicKey: process.env.VINCENT_PUBLIC_KEY || '',
    did: process.env.VINCENT_DID || '',
  },
  enforcementConfig: {
    enabled: true,
    strictMode: false,
    logLevel: 'info',
    cachePolicyResults: true,
    cacheTTL: 300,
    requireDelegation: true,
    challengeTimeout: 300,
  },
  enableAuth: false,
  enableCors: true,
  enableHelmet: true,
  logLevel: 'info',
};
