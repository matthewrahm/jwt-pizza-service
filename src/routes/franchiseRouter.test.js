const request = require('supertest');
const app = require('../service.js');
const { createAdminUser, registerUser } = require('./authRouter.test.js');

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5);
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

describe('franchise router', () => {
  let adminUser, adminToken;
  let dinerUser, dinerToken;

  beforeAll(async () => {
    [adminUser, adminToken] = await createAdminUser();
    [dinerUser, dinerToken] = await registerUser();
  });

  test('list franchises', async () => {
    const res = await request(app).get('/api/franchise');
    expect(res.status).toBe(200);
    expect(res.body.franchises).toBeDefined();
  });

  test('list franchises as admin', async () => {
    const res = await request(app).get('/api/franchise').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.franchises).toBeDefined();
  });

  test('create franchise as admin', async () => {
    const franchise = { name: 'test_' + randomName(), admins: [{ email: adminUser.email }] };
    const res = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminToken}`).send(franchise);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(franchise.name);
    expect(res.body.admins).toBeDefined();
    expect(res.body.id).toBeDefined();
  });

  test('create franchise as non-admin', async () => {
    const franchise = { name: 'hack_' + randomName(), admins: [{ email: dinerUser.email }] };
    const res = await request(app).post('/api/franchise').set('Authorization', `Bearer ${dinerToken}`).send(franchise);
    expect(res.status).toBe(403);
  });

  test('get user franchises', async () => {
    const res = await request(app)
      .get(`/api/franchise/${adminUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('get user franchises as different user returns empty', async () => {
    const res = await request(app)
      .get(`/api/franchise/${adminUser.id}`)
      .set('Authorization', `Bearer ${dinerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('delete franchise', async () => {
    const franchise = { name: 'del_' + randomName(), admins: [{ email: adminUser.email }] };
    const createRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(franchise);
    const franchiseId = createRes.body.id;

    const res = await request(app)
      .delete(`/api/franchise/${franchiseId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('franchise deleted');
  });

  test('create store', async () => {
    const franchise = { name: 'store_' + randomName(), admins: [{ email: adminUser.email }] };
    const createRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(franchise);
    const franchiseId = createRes.body.id;

    const storeRes = await request(app)
      .post(`/api/franchise/${franchiseId}/store`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'SLC' });
    expect(storeRes.status).toBe(200);
    expect(storeRes.body.name).toBe('SLC');
    expect(storeRes.body.id).toBeDefined();
  });

  test('create store as non-admin non-franchisee', async () => {
    const franchise = { name: 'noperm_' + randomName(), admins: [{ email: adminUser.email }] };
    const createRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(franchise);
    const franchiseId = createRes.body.id;

    const storeRes = await request(app)
      .post(`/api/franchise/${franchiseId}/store`)
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({ name: 'SLC' });
    expect(storeRes.status).toBe(403);
  });

  test('delete store', async () => {
    const franchise = { name: 'dstore_' + randomName(), admins: [{ email: adminUser.email }] };
    const createRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(franchise);
    const franchiseId = createRes.body.id;

    const storeRes = await request(app)
      .post(`/api/franchise/${franchiseId}/store`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'SLC' });
    const storeId = storeRes.body.id;

    const delRes = await request(app)
      .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.message).toBe('store deleted');
  });

  test('delete store as non-admin non-franchisee', async () => {
    const franchise = { name: 'nodel_' + randomName(), admins: [{ email: adminUser.email }] };
    const createRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(franchise);
    const franchiseId = createRes.body.id;

    const storeRes = await request(app)
      .post(`/api/franchise/${franchiseId}/store`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'SLC' });
    const storeId = storeRes.body.id;

    const delRes = await request(app)
      .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
      .set('Authorization', `Bearer ${dinerToken}`);
    expect(delRes.status).toBe(403);
  });
});
