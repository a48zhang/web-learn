const mockConfig = {
    port: 3001,
    jwt: {
        secret: 'test-secret',
        expiresIn: '7d',
    },
    cors: {
        origins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    },
    database: {
        host: 'localhost',
        port: 3306,
        name: 'web_learn',
        user: 'root',
        password: '',
    },
    ai: {
        apiKey: 'test-key',
        baseUrl: '',
        model: 'test-model',
    },
    uploadsDir: '/tmp/web-learn-test-uploads',
};

jest.mock('../src/utils/config', () => ({
    config: mockConfig,
}));

import request from 'supertest';
import app from '../src/app';

describe('CORS middleware', () => {
    it('allows localhost origins on any local port', async () => {
        const response = await request(app)
            .get('/api/health')
            .set('Origin', 'http://localhost:3000');

        expect(response.status).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
});