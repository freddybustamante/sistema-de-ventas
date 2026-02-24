document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formFiltro');
    const tabla = document.getElementById('tablaProformas');
  
    form.addEventListener('submit', e => {
      e.preventDefault();
      consultarProformas();
    });
  
    function consultarProformas() {
      const nombre = document.getElementById('nombre').value.trim();
      const documento = document.getElementById('documento').value.trim();
      const desde = document.getElementById('desde').value;
      const hasta = document.getElementById('hasta').value;
  
      const params = new URLSearchParams({ nombre, documento, desde, hasta });
  
      fetch('/api/proformas/filtrar?' + params.toString())
        .then(res => res.json())
        .then(proformas => {
          tabla.innerHTML = '';
          if (!Array.isArray(proformas)) {
            tabla.innerHTML = '<tr><td colspan="6">No se encontraron resultados</td></tr>';
            return;
          }
  
          if (proformas.length === 0) {
            tabla.innerHTML = '<tr><td colspan="6">Sin resultados</td></tr>';
            return;
          }
          window.ultimosResultados = proformas;

          proformas.forEach((p, i) => {
            const fila = `
              <tr>
                <td>${i + 1}</td>
                <td>${new Date(p.fecha_emision).toLocaleDateString()}</td>
                <td>${p.nombre_cliente || '-'}</td>
                <td>${p.numero_documento || '-'}</td>
                <td>S/. ${parseFloat(p.total).toFixed(2)}</td>
                <td><button class="btn btn-sm btn-primary" onclick="imprimirProforma(${p.id})">Imprimir</button></td>
              </tr>
            `;
            tabla.innerHTML += fila;
          });
        })
        .catch(err => {
          console.error('❌ Error al filtrar proformas:', err);
          tabla.innerHTML = '<tr><td colspan="6">Error al cargar resultados</td></tr>';
        });
    }
  
    window.imprimirProforma = function(id) {
      // Puedes cambiar esto por un endpoint real de impresión
      window.open(`/api/proformas/imprimir/${id}`, '_blank');
    };
  
    consultarProformas(); // Carga inicial
  });
  
  function exportarAExcel(data) {
    const cabecera = [
      ['#', 'Fecha', 'Cliente', 'Documento', 'Total']
    ];
  
    const cuerpo = data.map((p, i) => [
      i + 1,
      new Date(p.fecha_emision).toLocaleDateString(),
      p.nombre_cliente || '-',
      p.numero_documento || '-',
      parseFloat(p.total).toFixed(2)
    ]);
  
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([...cabecera, ...cuerpo]);
  
    XLSX.utils.book_append_sheet(wb, ws, 'Proformas');
    XLSX.writeFile(wb, 'proformas.xlsx');
  }

  function exportarAPDF(data) {
    const doc = new jsPDF();
  
    doc.setFontSize(12);
    doc.text("Historial de Proformas", 14, 14);
  
    const rows = data.map((p, i) => [
      i + 1,
      new Date(p.fecha_emision).toLocaleDateString(),
      p.nombre_cliente || '-',
      p.numero_documento || '-',
      `S/. ${parseFloat(p.total).toFixed(2)}`
    ]);
  
    doc.autoTable({
      head: [['#', 'Fecha', 'Cliente', 'Documento', 'Total']],
      body: rows,
      startY: 20,
      theme: 'striped'
    });
  
    doc.save('proformas.pdf');
  }
  