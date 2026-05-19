/**
 * Descarga un array de objetos como archivo CSV.
 * @param {Object[]} filas      - datos a exportar
 * @param {string[]} columnas   - keys del objeto que se incluirán (en orden)
 * @param {string[]} encabezados - etiquetas de columna (mismo orden que `columnas`)
 * @param {string}   nombre     - nombre del archivo sin extensión
 */
export function exportarCSV(filas, columnas, encabezados, nombre = 'exportacion') {
  const escapar = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };

  const lineas = [
    encabezados.map(escapar).join(','),
    ...filas.map((f) => columnas.map((c) => escapar(f[c])).join(',')),
  ];

  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${nombre}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
