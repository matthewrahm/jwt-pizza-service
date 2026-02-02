const request = require('supertest');
const app = require('../service.js');
const { createAdminUser, registerUser } = require('./authRouter.test.js');

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5);
}

describe('user router', () => {
  let user, token;

  beforeAll(async () => {
    [user, token] = await registerUser();
  });

  test('get current user', async () => {
    const res = await request(app).get('/api/user/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
  });

  test('update user', async () => {
    const newEmail = 'updated_' + user.email;
    const res = await request(app)
      .put(`/api/user/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: newEmail, password: 'a' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(newEmail);
    token = res.body.token;
    user = res.body.user;
  });

  test('update user unauthorized', async () => {
    const [otherUser] = await registerUser();
    const res = await request(app)
      .put(`/api/user/${otherUser.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'hacker@test.com' });
    expect(res.status).toBe(403);
  });

  test('admin can update any user', async () => {
    const [, adminToken] = await createAdminUser();
    const res = await request(app)
      .put(`/api/user/${user.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: user.email, password: 'a' });
    expect(res.status).toBe(200);
  });

  test('delete user (not implemented)', async () => {
    const res = await request(app).delete(`/api/user/${user.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('not implemented');
  });

  test('list users (not implemented)', async () => {
    const res = await request(app).get('/api/user/').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('not implemented');
  });
});
