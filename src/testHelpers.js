const request = require('supertest');
const app = require('./service.js');

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createAdminUser() {
  let loginRes;
  for (let i = 0; i < 10; i++) {
    loginRes = await request(app).put('/api/auth').send({ email: 'a@jwt.com', password: 'admin' });
    if (loginRes.status === 200) break;
    await sleep(500);
  }
  return [loginRes.body.user, loginRes.body.token];
}

async function registerUser() {
  const user = { name: randomName(), email: randomName() + '@test.com', password: 'a' };
  let res;
  for (let i = 0; i < 10; i++) {
    res = await request(app).post('/api/auth').send(user);
    if (res.status === 200) break;
    await sleep(500);
  }
  return [res.body.user, res.body.token];
}

module.exports = { createAdminUser, registerUser, randomName };
