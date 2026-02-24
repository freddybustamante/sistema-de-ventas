
// resto del codigo que consulta el producto  reutilizado  esta en el archivo de routes/productos.js
function formatearFecha(fechaISO) {
    if (!fechaISO) return '-';
    const fecha = new Date(fechaISO);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const año = fecha.getFullYear();
    return `${dia}/${mes}/${año}`; // → Formato DD/MM/AAAA
  }
let alertasTable; // instancia global
document.addEventListener("DOMContentLoaded", () => {
  fetch('/api/productos/alertas-stock')
    .then(response => response.json())
    .then(data => {
      const tbody = document.querySelector('#tabla-alertas-stock tbody');
      tbody.innerHTML = '';

      if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">✅ No hay productos con alertas actualmente.</td></tr>';
        return;
      }

      // 🔁 Ordenar por prioridad
      data.sort((a, b) => prioridadAlerta(a) - prioridadAlerta(b));

      data.forEach(producto => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${producto.nombre}</td>
          <td>${producto.stock}</td>
          <td>${producto.stock_minimo}</td>
          <td>${producto.estado_stock}</td>
          <td>${producto.estado_vencimiento}</td>
          <td>${formatearFecha(producto.fecha_vencimiento)}</td>
          <td>${producto.tipo_alerta}</td>
        `;
        tbody.appendChild(tr);
      });

      // ⚡ Destruir la tabla anterior si ya existe
      if (alertasTable) {
        alertasTable.destroy();
        alertasTable = null;
      }

      // ⚡ Crear la tabla con paginación y selector de registros
      alertasTable = new simpleDatatables.DataTable("#tabla-alertas-stock", {
        searchable: true,
        fixedHeight: true,
        perPage: 10,
        perPageSelect: [5, 10, 25, 50, 100], // 👈 esto muestra el select
        labels: {
          placeholder: "🔍 Buscar...",
          perPage: "registros por página",
          noRows: "No se encontraron productos",
          info: "Mostrando {start} a {end} de {rows} productos"
        }
      });
    })
    .catch(error => {
      console.error('❌ Error al cargar alertas:', error);
      const tbody = document.querySelector('#tabla-alertas-stock tbody');
      tbody.innerHTML = '<tr><td colspan="7" class="text-danger text-center">❌ Error al cargar datos</td></tr>';
    });

  function prioridadAlerta(producto) {
    if (producto.estado_stock === 'Agotado') return 1;
    if (producto.estado_vencimiento === 'Vencido') return 2;
    if (producto.estado_stock === 'Bajo') return 3;
    if (producto.estado_vencimiento === 'Próximo') return 4;
    return 5;
  }
});
  document.getElementById('btnExportarExcel').addEventListener('click', () => {
    const tabla = document.getElementById('tabla-alertas-stock');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(tabla);
    XLSX.utils.book_append_sheet(wb, ws, 'Alertas');
  
    XLSX.writeFile(wb, 'alertas_stock.xlsx');
  });

  document.getElementById('btnExportarTodo').addEventListener('click', () => {
    window.open('/api/alertas/exportar-excel', '_blank');
  });
  