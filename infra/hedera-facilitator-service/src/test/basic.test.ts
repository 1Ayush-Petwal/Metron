import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { HederaFacilitatorService } from '../index.js';

describe('Hedera Facilitator Service', () => {
    let service: HederaFacilitatorService;

    beforeAll(async () => {
        service = new HederaFacilitatorService();
    });

    afterAll(async () => {
        if (service) {
            await service.stop();
        }
    });

    it('should initialize without errors', () => {
        expect(service).toBeDefined();
        expect(service.getStatus).toBeDefined();
    });

    it('should have correct service status', () => {
        const status = service.getStatus();

        expect(status).toHaveProperty('isRunning');
        expect(status).toHaveProperty('services');
        expect(status).toHaveProperty('config');

        expect(status.services).toHaveProperty('hedera');
        expect(status.services).toHaveProperty('settlement');
        expect(status.services).toHaveProperty('policy');
        expect(status.services).toHaveProperty('verification');
        expect(status.services).toHaveProperty('eventStream');
        expect(status.services).toHaveProperty('restApi');
        expect(status.services).toHaveProperty('grpc');
    });

    it('should have valid configuration', () => {
        const status = service.getStatus();

        expect(status.config).toHaveProperty('network');
        expect(status.config).toHaveProperty('restPort');
        expect(status.config).toHaveProperty('grpcPort');
        expect(status.config).toHaveProperty('wsPort');

        expect(typeof status.config.restPort).toBe('number');
        expect(typeof status.config.grpcPort).toBe('number');
        expect(typeof status.config.wsPort).toBe('number');
    });
});
