require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');

describe('Auth Endpoints', () => {
    test('POST /api/auth/register', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'test@example.com',
                password: 'Test1234',
                role: 'learner'
            });
            
        expect(res.statusCode).not.toBe(500);
    });
    
    test('POST /api/auth/login', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'Test1234'
            });
            
        expect(res.statusCode).not.toBe(500);
    });
});