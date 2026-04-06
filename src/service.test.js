const request = require('supertest');
const app = require('./service.js');

describe('service endpoints', () => {
  test('welcome page', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('welcome to JWT Pizza');
    expect(res.body.version).toBeDefined();
  });

  test('docs endpoint', async () => {
    const res = await request(app).get('/api/docs');
    expect(res.status).toBe(200);
    expect(res.body.version).toBeDefined();
    expect(res.body.endpoints).toBeDefined();
    expect(res.body.config).toBeDefined();
    expect(res.body.config.factory).toBeDefined();
    expect(res.body.config.db).toBeDefined();
  });

  test('unknown endpoint', async () => {
    const res = await request(app).get('/api/invalid');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('unknown endpoint');
  });

  test('unknown non-api endpoint', async () => {
    const res = await request(app).get('/totally/bogus');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('unknown endpoint');
  });

  test('CORS headers are set', async () => {
    const res = await request(app).get('/').set('Origin', 'http://example.com');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
    expect(res.headers['access-control-allow-methods']).toContain('GET');
    expect(res.headers['access-control-allow-headers']).toContain('Authorization');
  });
});
