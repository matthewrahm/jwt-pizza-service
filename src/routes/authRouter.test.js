const request = require('supertest');
const app = require('../service.js');
const { randomName } = require('../testHelpers.js');

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5);
}

describe('auth router', () => {
  let testUser;
  let testUserToken;

  test('register', async () => {
    const user = { name: randomName(), email: randomName() + '@test.com', password: 'a' };
    const registerRes = await request(app).post('/api/auth').send(user);
    expect(registerRes.status).toBe(200);
    expect(registerRes.body.token).toMatch(/^[a-zA-Z0-9\-_.]+$/);
    testUser = registerRes.body.user;
    testUserToken = registerRes.body.token;
    expect(testUser.name).toBe(user.name);
    expect(testUser.email).toBe(user.email);
  });

  test('register missing fields', async () => {
    const res = await request(app).post('/api/auth').send({ name: 'test' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('name, email, and password are required');
  });

  test('register missing name', async () => {
    const res = await request(app).post('/api/auth').send({ email: 'x@x.com', password: 'a' });
    expect(res.status).toBe(400);
  });

  test('register missing password', async () => {
    const res = await request(app).post('/api/auth').send({ name: 'x', email: 'x@x.com' });
    expect(res.status).toBe(400);
  });

  test('login', async () => {
    const loginRes = await request(app).put('/api/auth').send({ email: testUser.email, password: 'a' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_.]+$/);
    testUserToken = loginRes.body.token;
  });

  test('login wrong password', async () => {
    const loginRes = await request(app).put('/api/auth').send({ email: testUser.email, password: 'wrong' });
    expect(loginRes.status).toBe(404);
  });

  test('login nonexistent user', async () => {
    const loginRes = await request(app).put('/api/auth').send({ email: 'nobody_' + randomName() + '@test.com', password: 'a' });
    expect(loginRes.status).toBe(404);
  });

  test('logout', async () => {
    const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserToken}`);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.message).toBe('logout successful');
  });

  test('logout unauthorized', async () => {
    const logoutRes = await request(app).delete('/api/auth');
    expect(logoutRes.status).toBe(401);
  });

  test('request with invalid token', async () => {
    const res = await request(app).delete('/api/auth').set('Authorization', 'Bearer invalid.token.value');
    expect(res.status).toBe(401);
  });

  test('request with expired/logged-out token is unauthorized', async () => {
    // Register, get token, logout, then try to use the old token
    const user = { name: randomName(), email: randomName() + '@test.com', password: 'a' };
    const regRes = await request(app).post('/api/auth').send(user);
    const token = regRes.body.token;
    await request(app).delete('/api/auth').set('Authorization', `Bearer ${token}`);
    // Now try to use the logged-out token
    const res = await request(app).get('/api/user/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
