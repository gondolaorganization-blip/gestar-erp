const request = require('supertest');
const app     = require('../app');
const { limpiarBD, cerrarBD } = require('./setup');

let token, proveedorId, productoId;

beforeAll(async () => {
  await limpiarBD();

  const auth = await request(app).post('/api/auth/registro').send({
    empresa: { ruc: '999-004-00004', nombre: 'Empresa Test Compras' },
    usuario: { nombre: 'Admin', email: 'admin4@test.com', password: 'Test1234!' },
  });
  token = auth.body.token;

  const prov = await request(app)
    .post('/api/proveedores')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'Proveedor Test', ruc: '300-400-11111' });
  proveedorId = prov.body.id;

  const prod = await request(app)
    .post('/api/productos')
    .set('Authorization', `Bearer ${token}`)
    .send({ codigo: 'PROD-T01', nombre: 'Producto Compra Test', tipo: 'BIEN', precio: 50, itbms: false });
  productoId = prod.body.id;
});

afterAll(cerrarBD);

describe('POST /api/compras', () => {
  it('crea orden de compra con numeración automática', async () => {
    const res = await request(app)
      .post('/api/compras')
      .set('Authorization', `Bearer ${token}`)
      .send({
        proveedorId,
        fecha: '2026-05-01',
        fechaVence: '2026-05-31',
        lineas: [{ productoId, cantidad: 10 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.numero).toBe('OC-0001');
    expect(res.body.subtotal).toBe(500);   // 10 × 50
    expect(res.body.itbms).toBe(0);
    expect(res.body.total).toBe(500);
    expect(res.body.estado).toBe('BORRADOR');
  });

  it('segunda orden obtiene número correlativo', async () => {
    const res = await request(app)
      .post('/api/compras')
      .set('Authorization', `Bearer ${token}`)
      .send({
        proveedorId, fecha: '2026-05-02',
        lineas: [{ descripcion: 'Servicio externo', cantidad: 1, precioUnit: 200, itbms: true }],
      });

    expect(res.status).toBe(201);
    expect(res.body.numero).toBe('OC-0002');
    expect(res.body.itbms).toBe(14);       // 200 × 7%
    expect(res.body.total).toBe(214);
  });
});

describe('PATCH /api/compras/:id/estado', () => {
  let ordenId;

  beforeAll(async () => {
    const res = await request(app).get('/api/compras').set('Authorization', `Bearer ${token}`);
    ordenId = res.body.datos[0].id;
  });

  it('cambia estado de BORRADOR a ENVIADA', async () => {
    const res = await request(app)
      .patch(`/api/compras/${ordenId}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'ENVIADA' });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ENVIADA');
  });

  it('rechaza estado inválido', async () => {
    const res = await request(app)
      .patch(`/api/compras/${ordenId}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'INEXISTENTE' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/compras/:id/pagos', () => {
  let ordenId, totalOrden;

  beforeAll(async () => {
    const res = await request(app).get('/api/compras').set('Authorization', `Bearer ${token}`);
    const primera = res.body.datos.find((o) => o.numero === 'OC-0001');
    ordenId   = primera.id;
    totalOrden = primera.total;
  });

  it('registra pago parcial a proveedor', async () => {
    const res = await request(app)
      .post(`/api/compras/${ordenId}/pagos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fecha: '2026-05-15', monto: 250, metodo: 'TRANSFERENCIA', referencia: 'TRF-001' });

    expect(res.status).toBe(201);
    expect(res.body.totalPagado).toBe(250);
  });

  it('pago final marca orden como RECIBIDA', async () => {
    const saldo = totalOrden - 250;
    const res   = await request(app)
      .post(`/api/compras/${ordenId}/pagos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fecha: '2026-05-20', monto: saldo, metodo: 'CHEQUE' });

    expect(res.status).toBe(201);
    expect(res.body.estadoOrden).toBe('RECIBIDA');
    expect(res.body.saldoPendiente).toBe(0);
  });
});
