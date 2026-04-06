const request = require('supertest');
const app = require('../service.js');
const { createAdminUser, registerUser, randomName } = require('../testHelpers.js');

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

  test('get current user unauthorized', async () => {
    const res = await request(app).get('/api/user/me');
    expect(res.status).toBe(401);
  });

  test('update user email and password', async () => {
    const newEmail = 'updated_' + randomName() + '@test.com';
    const res = await request(app)
      .put(`/api/user/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: newEmail, password: 'a' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(newEmail);
    token = res.body.token;
    user = res.body.user;
  });

  test('update user name only', async () => {
    const newName = 'name_' + randomName();
    const res = await request(app)
      .put(`/api/user/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: newName, email: user.email, password: 'a' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe(newName);
    token = res.body.token;
    user = res.body.user;
  });

  test('update user unauthorized (different user)', async () => {
    const [otherUser] = await registerUser();
    const res = await request(app)
      .put(`/api/user/${otherUser.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'hacker@test.com' });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('unauthorized');
  });

  test('update user not logged in', async () => {
    const res = await request(app)
      .put(`/api/user/${user.id}`)
      .send({ email: 'new@test.com' });
    expect(res.status).toBe(401);
  });

  test('admin can update any user', async () => {
    const [, adminToken] = await createAdminUser();
    const res = await request(app)
      .put(`/api/user/${user.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: user.email, password: 'a' });
    expect(res.status).toBe(200);
  });

  test('list users unauthorized (non-admin)', async () => {
    const res = await request(app).get('/api/user/').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('unauthorized');
  });

  test('list users not logged in', async () => {
    const res = await request(app).get('/api/user/');
    expect(res.status).toBe(401);
  });

  test('list users as admin', async () => {
    const [, adminToken] = await createAdminUser();
    const res = await request(app).get('/api/user/').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toBeDefined();
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.more).toBeDefined();
    // Each user should have roles
    if (res.body.users.length > 0) {
      expect(res.body.users[0].roles).toBeDefined();
    }
  });

  test('list users with pagination', async () => {
    const [, adminToken] = await createAdminUser();
    const res = await request(app).get('/api/user/?page=0&limit=5').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeLessThanOrEqual(5);
  });

  test('list users with name filter', async () => {
    const [, adminToken] = await createAdminUser();
    const res = await request(app).get('/api/user/?name=*').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toBeDefined();
  });

  test('delete user unauthorized (non-admin)', async () => {
    const res = await request(app).delete(`/api/user/${user.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('unauthorized');
  });

  test('delete user not logged in', async () => {
    const res = await request(app).delete(`/api/user/${user.id}`);
    expect(res.status).toBe(401);
  });

  test('delete user as admin', async () => {
    const [userToDelete] = await registerUser();
    const [, adminToken] = await createAdminUser();
    const res = await request(app).delete(`/api/user/${userToDelete.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('user deleted');
  });
});
