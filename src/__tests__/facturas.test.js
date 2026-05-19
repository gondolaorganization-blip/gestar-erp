const request = require('supertest');
const app     = require('../app');
const { limpiarBD, cerrarBD } = require('./setup');

let token, clienteId, productoId;

beforeAll(async () => {
  await limpiarBD();

  // Empresa + usuario
  const auth = await request(app).post('/api/auth/registro').send({
    empresa: { ruc: '999-003-00003', nombre: 'Empresa Test Facturas' },
    usuario: { nombre: 'Admin', email: 'admin3@test.com', password: 'Test1234!' },
  });
  token = auth.body.token;

  // Cliente
  const cli = await request(app)
    .post('/api/clientes')
    .set('Authorization', `Bearer ${token}`)
    .send({ tipoDoc: 'RUC', numDoc: '200-300-45678', nombre: 'Cliente Factura S.A.' });
  clienteId = cli.body.id;

  // Producto con ITBMS
  const prod = await request(app)
    .post('/api/productos')
    .set('Authorization', `Bearer ${token}`)
    .send({ codigo: 'SRV-001', nombre: 'Servicio Test', tipo: 'SERVICIO', precio: 100, itbms: true });
  productoId = prod.body.id;
});

afterAll(cerrarBD);

describe('POST /api/facturas', () => {
  it('crea factura con producto y calcula ITBMS correctamente', async () => {
    const res = await request(app)
      .post('/api/facturas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clienteId,
        fecha: '2026-05-01',
        fechaVence: '2026-06-01',
        lineas: [{ productoId, cantidad: 2 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.numero).toBe('F-0001');
    expect(res.body.subtotal).toBe(200);          // 2 × 100
    expect(res.body.itbms).toBe(14);              // 200 × 7%
    expect(res.body.total).toBe(214);             // 200 + 14
    expect(res.body.estado).toBe('PENDIENTE');
  });

  it('crea factura con línea manual sin ITBMS', async () => {
    const res = await request(app)
      .post('/api/facturas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clienteId,
        fecha: '2026-05-01',
        lineas: [{ descripcion: 'Gastos varios', cantidad: 1, precioUnit: 50, itbms: false }],
      });

    expect(res.status).toBe(201);
    expect(res.body.subtotal).toBe(50);
    expect(res.body.itbms).toBe(0);
    expect(res.body.total).toBe(50);
  });

  it('rechaza sin cliente', async () => {
    const res = await request(app)
      .post('/api/facturas')
      .set('Authorization', `Bearer ${token}`)
      .send({ fecha: '2026-05-01', lineas: [{ productoId, cantidad: 1 }] });

    expect(res.status).toBe(400);
  });

  it('rechaza sin líneas', async () => {
    const res = await request(app)
      .post('/api/facturas')
      .set('Authorization', `Bearer ${token}`)
      .send({ clienteId, fecha: '2026-05-01', lineas: [] });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/facturas/:id/pagos', () => {
  let facturaId, totalFactura;

  beforeAll(async () => {
    const res = await request(app)
      .get('/api/facturas')
      .set('Authorization', `Bearer ${token}`);
    const primera = res.body.datos[0];
    facturaId    = primera.id;
    totalFactura = primera.total;
  });

  it('registra pago parcial', async () => {
    const res = await request(app)
      .post(`/api/facturas/${facturaId}/pagos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fecha: '2026-05-10', monto: 100, metodo: 'TRANSFERENCIA' });

    expect(res.status).toBe(201);
    expect(res.body.totalPagado).toBe(100);
    expect(res.body.estadoFactura).toBe('PENDIENTE');
  });

  it('pago final cierra factura como PAGADA', async () => {
    const saldo = totalFactura - 100;
    const res   = await request(app)
      .post(`/api/facturas/${facturaId}/pagos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fecha: '2026-05-10', monto: saldo, metodo: 'EFECTIVO' });

    expect(res.status).toBe(201);
    expect(res.body.estadoFactura).toBe('PAGADA');
    expect(res.body.saldoPendiente).toBe(0);
  });

  it('rechaza pago que excede el saldo', async () => {
    const res = await request(app)
      .post(`/api/facturas/${facturaId}/pagos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fecha: '2026-05-10', monto: 9999 });

    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/facturas/:id/anular', () => {
  let facturaId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/facturas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clienteId, fecha: '2026-05-02',
        lineas: [{ descripcion: 'Para anular', cantidad: 1, precioUnit: 10, itbms: false }],
      });
    facturaId = res.body.id;
  });

  it('anula factura pendiente', async () => {
    const res = await request(app)
      .patch(`/api/facturas/${facturaId}/anular`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ANULADA');
  });

  it('no permite anular una factura ya anulada', async () => {
    const res = await request(app)
      .patch(`/api/facturas/${facturaId}/anular`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });
});
