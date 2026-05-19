const request = require('supertest');
const app     = require('../app');
const { limpiarBD, cerrarBD } = require('./setup');

const EMPRESA  = { ruc: '999-001-00001', nombre: 'Empresa Test Auth' };
const USUARIO  = { nombre: 'Admin Test', email: 'admin@test.com', password: 'Test1234!' };

beforeAll(limpiarBD);
afterAll(cerrarBD);

describe('POST /api/auth/registro', () => {
  it('crea empresa y usuario administrador', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ empresa: EMPRESA, usuario: USUARIO });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.empresa.ruc).toBe(EMPRESA.ruc);
    expect(res.body.usuario.rol).toBe('ADMIN');
    expect(res.body.usuario).not.toHaveProperty('password');
  });

  it('rechaza RUC duplicado', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ empresa: EMPRESA, usuario: { ...USUARIO, email: 'otro@test.com' } });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/RUC/i);
  });

  it('rechaza contraseña corta', async () => {
    const res = await request(app)
      .post('/api/auth/registro')
      .send({ empresa: { ruc: '999-002-00002', nombre: 'X' }, usuario: { ...USUARIO, password: '123' } });

    expect(res.status).toBe(400);
  });

  it('rechaza campos faltantes', async () => {
    const res = await request(app).post('/api/auth/registro').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('devuelve token con credenciales válidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USUARIO.email, password: USUARIO.password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.usuario.email).toBe(USUARIO.email);
  });

  it('rechaza contraseña incorrecta', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USUARIO.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('rechaza email inexistente', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noexiste@test.com', password: 'Test1234!' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USUARIO.email, password: USUARIO.password });
    token = res.body.token;
  });

  it('devuelve perfil con token válido', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(USUARIO.email);
    expect(res.body).not.toHaveProperty('password');
  });

  it('rechaza sin token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rechaza token inválido', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer tokenfalso');
    expect(res.status).toBe(401);
  });
});
