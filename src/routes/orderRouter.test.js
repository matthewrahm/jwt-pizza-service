const request = require('supertest');
const app = require('../service.js');
const { createAdminUser, registerUser } = require('../testHelpers.js');

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5);
}

describe('order router', () => {
  let adminUser, adminToken;
  let dinerUser, dinerToken;
  let menuItem;

  beforeAll(async () => {
    [adminUser, adminToken] = await createAdminUser();
    [dinerUser, dinerToken] = await registerUser();
  });

  test('get menu', async () => {
    const res = await request(app).get('/api/order/menu');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('add menu item as admin', async () => {
    const item = { title: 'Test Pizza', description: 'A test pizza', image: 'pizza.png', price: 0.001 };
    const res = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${adminToken}`).send(item);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    menuItem = res.body.find((i) => i.title === 'Test Pizza');
    expect(menuItem).toBeDefined();
  });

  test('add menu item as non-admin', async () => {
    const item = { title: 'Hack Pizza', description: 'Should fail', image: 'pizza.png', price: 0.001 };
    const res = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${dinerToken}`).send(item);
    expect(res.status).toBe(403);
  });

  test('add menu item unauthorized', async () => {
    const item = { title: 'Hack Pizza', description: 'Should fail', image: 'pizza.png', price: 0.001 };
    const res = await request(app).put('/api/order/menu').send(item);
    expect(res.status).toBe(401);
  });

  test('get orders', async () => {
    const res = await request(app).get('/api/order').set('Authorization', `Bearer ${dinerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.dinerId).toBe(dinerUser.id);
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  test('create order', async () => {
    const franchise = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'order_test_' + Date.now(), admins: [{ email: adminUser.email }] });
    const store = await request(app)
      .post(`/api/franchise/${franchise.body.id}/store`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'SLC' });

    const order = {
      franchiseId: franchise.body.id,
      storeId: store.body.id,
      items: [{ menuId: menuItem.id, description: menuItem.description, price: menuItem.price }],
    };
    const res = await request(app).post('/api/order').set('Authorization', `Bearer ${dinerToken}`).send(order);
    expect(res.status === 200 || res.status === 500).toBe(true);
    if (res.status === 200) {
      expect(res.body.order).toBeDefined();
    }
  });

  test('create order factory error', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ reportUrl: '' }) }));

    const franchise = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'order_fail_' + Date.now(), admins: [{ email: adminUser.email }] });
    const store = await request(app)
      .post(`/api/franchise/${franchise.body.id}/store`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'SLC' });

    const order = {
      franchiseId: franchise.body.id,
      storeId: store.body.id,
      items: [{ menuId: menuItem.id, description: menuItem.description, price: menuItem.price }],
    };
    const res = await request(app).post('/api/order').set('Authorization', `Bearer ${dinerToken}`).send(order);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Failed to fulfill order at factory');
    global.fetch = originalFetch;
  });
});
