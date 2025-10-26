import pino from 'pino';
import { ServiceConfig } from '../types/config.js';

let loggerInstance: pino.Logger | null = null;

export const createLogger = (config: ServiceConfig): pino.Logger => {
    if (loggerInstance) {
        return loggerInstance;
    }

    const isDevelopment = config.nodeEnv === 'development';

    loggerInstance = pino({
        level: config.logLevel,
        transport: isDevelopment ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
            },
        } : undefined,
        formatters: {
            level: (label) => {
                return { level: label };
            },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
    });

    return loggerInstance;
};

export const logger = createLogger({
    port: 3000,
    grpcPort: 50051,
    wsPort: 8080,
    nodeEnv: 'development',
    logLevel: 'info',
    enableTelemetry: true,
});
