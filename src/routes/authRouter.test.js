const request = require('supertest');
const app = require('../service.js');

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: 'admin' }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';
  await request(app).post('/api/auth').send(user);
  const loginRes = await request(app).put('/api/auth').send({ email: 'a@jwt.com', password: 'admin' });
  return [loginRes.body.user, loginRes.body.token];
}

async function registerUser() {
  const user = { name: randomName(), email: randomName() + '@test.com', password: 'a' };
  const res = await request(app).post('/api/auth').send(user);
  return [res.body.user, res.body.token];
}

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

  test('logout', async () => {
    const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserToken}`);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.message).toBe('logout successful');
  });

  test('logout unauthorized', async () => {
    const logoutRes = await request(app).delete('/api/auth');
    expect(logoutRes.status).toBe(401);
  });
});

module.exports = { createAdminUser, registerUser };
