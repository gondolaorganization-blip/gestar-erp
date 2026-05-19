const MODULOS  = ['clientes', 'productos', 'facturas', 'contabilidad', 'reportes', 'dashboard', 'usuarios'];
const ACCIONES = ['leer', 'crear', 'editar', 'eliminar'];

const PLANTILLAS_ROLES = [
  {
    nombre: 'ADMIN',
    descripcion: 'Administrador con acceso total',
    permisos: { todo: true },
  },
  {
    nombre: 'CONTADOR',
    descripcion: 'Acceso completo excepto eliminación y gestión de usuarios',
    permisos: Object.fromEntries(
      MODULOS.map((m) => [
        m,
        {
          leer:     true,
          crear:    ['clientes', 'productos', 'facturas', 'contabilidad'].includes(m),
          editar:   ['clientes', 'productos', 'facturas', 'contabilidad'].includes(m),
          eliminar: false,
        },
      ])
    ),
  },
  {
    nombre: 'VENDEDOR',
    descripcion: 'Acceso a clientes, facturación y dashboard',
    permisos: Object.fromEntries(
      MODULOS.map((m) => [
        m,
        {
          leer:     ['clientes', 'productos', 'facturas', 'dashboard'].includes(m),
          crear:    ['clientes', 'facturas'].includes(m),
          editar:   ['clientes'].includes(m),
          eliminar: false,
        },
      ])
    ),
  },
  {
    nombre: 'LECTOR',
    descripcion: 'Solo lectura en todos los módulos',
    permisos: Object.fromEntries(
      MODULOS.map((m) => [m, { leer: true, crear: false, editar: false, eliminar: false }])
    ),
  },
];

module.exports = { PLANTILLAS_ROLES, MODULOS, ACCIONES };
