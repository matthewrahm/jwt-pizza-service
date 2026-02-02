const request = require('supertest');
const app = require('./service.js');

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  const loginRes = await request(app).put('/api/auth').send({ email: 'a@jwt.com', password: 'admin' });
  return [loginRes.body.user, loginRes.body.token];
}

async function registerUser() {
  const user = { name: randomName(), email: randomName() + '@test.com', password: 'a' };
  const res = await request(app).post('/api/auth').send(user);
  return [res.body.user, res.body.token];
}

module.exports = { createAdminUser, registerUser, randomName };
