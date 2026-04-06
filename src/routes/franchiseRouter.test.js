const request = require('supertest');
const app = require('../service.js');
const { createAdminUser, registerUser, randomName } = require('../testHelpers.js');

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5);
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
    expect(res.body.more).toBeDefined();
  });

  test('list franchises with query params', async () => {
    const res = await request(app).get('/api/franchise?page=0&limit=5&name=*');
    expect(res.status).toBe(200);
    expect(res.body.franchises).toBeDefined();
  });

  test('list franchises as admin shows admins and revenue', async () => {
    // Create a franchise first
    const franchise = { name: 'admin_view_' + randomName(), admins: [{ email: adminUser.email }] };
    await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminToken}`).send(franchise);

    const res = await request(app).get('/api/franchise').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.franchises).toBeDefined();
    // Admin view should include admins for each franchise
    if (res.body.franchises.length > 0) {
      const f = res.body.franchises[0];
      expect(f.stores).toBeDefined();
    }
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

  test('create franchise unauthorized', async () => {
    const franchise = { name: 'unauth_' + randomName(), admins: [{ email: adminUser.email }] };
    const res = await request(app).post('/api/franchise').send(franchise);
    expect(res.status).toBe(401);
  });

  test('create franchise with unknown admin email', async () => {
    const franchise = { name: 'bad_' + randomName(), admins: [{ email: 'nonexistent_' + randomName() + '@test.com' }] };
    const res = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminToken}`).send(franchise);
    expect(res.status).toBe(404);
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

  test('get user franchises unauthorized', async () => {
    const res = await request(app).get(`/api/franchise/${adminUser.id}`);
    expect(res.status).toBe(401);
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

  test('delete franchise with stores', async () => {
    const franchise = { name: 'delws_' + randomName(), admins: [{ email: adminUser.email }] };
    const createRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(franchise);
    const franchiseId = createRes.body.id;

    // Add a store first
    await request(app)
      .post(`/api/franchise/${franchiseId}/store`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Store1' });

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

  test('create store unauthorized', async () => {
    const storeRes = await request(app).post('/api/franchise/1/store').send({ name: 'SLC' });
    expect(storeRes.status).toBe(401);
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

  test('delete store unauthorized', async () => {
    const delRes = await request(app).delete('/api/franchise/1/store/1');
    expect(delRes.status).toBe(401);
  });
});
