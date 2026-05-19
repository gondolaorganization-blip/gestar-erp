const request = require('supertest');
const app     = require('../app');
const { limpiarBD, cerrarBD } = require('./setup');

let token;

beforeAll(async () => {
  await limpiarBD();
  const res = await request(app).post('/api/auth/registro').send({
    empresa: { ruc: '999-002-00002', nombre: 'Empresa Test Clientes' },
    usuario: { nombre: 'Admin', email: 'admin2@test.com', password: 'Test1234!' },
  });
  token = res.body.token;
});

afterAll(cerrarBD);

const CLIENTE = { tipoDoc: 'RUC', numDoc: '100-200-12345', nombre: 'Cliente Prueba S.A.', email: 'cliente@test.com' };

describe('POST /api/clientes', () => {
  it('crea cliente correctamente', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send(CLIENTE);

    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe(CLIENTE.nombre);
    expect(res.body.tipoDoc).toBe('RUC');
  });

  it('rechaza documento duplicado', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send(CLIENTE);

    expect(res.status).toBe(409);
  });

  it('rechaza tipo de documento inválido', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...CLIENTE, numDoc: '999', tipoDoc: 'INVALIDO' });

    expect(res.status).toBe(400);
  });

  it('requiere autenticación', async () => {
    const res = await request(app).post('/api/clientes').send(CLIENTE);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/clientes', () => {
  it('lista clientes con paginación', async () => {
    const res = await request(app)
      .get('/api/clientes?pagina=1&limite=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('datos');
    expect(res.body).toHaveProperty('paginacion');
    expect(res.body.paginacion.total).toBeGreaterThan(0);
  });

  it('filtra por búsqueda', async () => {
    const res = await request(app)
      .get('/api/clientes?buscar=Prueba')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.datos.length).toBeGreaterThan(0);
    expect(res.body.datos[0].nombre).toContain('Prueba');
  });
});

describe('PUT /api/clientes/:id', () => {
  let clienteId;

  beforeAll(async () => {
    const res = await request(app)
      .get('/api/clientes')
      .set('Authorization', `Bearer ${token}`);
    clienteId = res.body.datos[0].id;
  });

  it('actualiza campos parcialmente', async () => {
    const res = await request(app)
      .put(`/api/clientes/${clienteId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ telefono: '507-6000-1234' });

    expect(res.status).toBe(200);
    expect(res.body.telefono).toBe('507-6000-1234');
  });

  it('devuelve 404 para ID inexistente', async () => {
    const res = await request(app)
      .put('/api/clientes/99999')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Nombre Válido' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/clientes/:id', () => {
  let clienteId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipoDoc: 'CEDULA', numDoc: '8-999-9999', nombre: 'Para Eliminar' });
    clienteId = res.body.id;
  });

  it('desactiva cliente (baja lógica)', async () => {
    const res = await request(app)
      .delete(`/api/clientes/${clienteId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toMatch(/desactivado/i);
  });

  it('no aparece en lista de activos tras desactivación', async () => {
    const res = await request(app)
      .get(`/api/clientes/${clienteId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.activo).toBe(false);
  });
});
