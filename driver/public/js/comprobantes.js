document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnBuscarPorCliente").addEventListener("click", buscarPorCliente);
  document.getElementById("btnBuscarPorNumero").addEventListener("click", buscarPorNumero);
});

async function buscarPorCliente() {
  const tipo = document.getElementById("buscar_tipo_doc").value;
  const numero = document.getElementById("buscar_numero_doc").value.trim();
  if (!numero) {
    Swal.fire({
      icon: 'warning',
      title: 'Atención',
      text: 'Ingrese el número de documento',
      confirmButtonText: 'OK'
    });
    return;
  }

  try {
    const res = await fetch(`/api/comprobantes/buscar?tipo_documento=${tipo}&numero_documento=${numero}`);
    const data = await res.json();
    renderTabla(data);
  } catch (err) {
    console.error("Error al buscar comprobantes por cliente:", err);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al buscar comprobantes',
      confirmButtonText: 'OK'
    });
  }
}

async function buscarPorNumero() {
  const numero = document.getElementById("buscar_num_comprobante").value.trim();
  if (!numero) {
    Swal.fire({
      icon: 'warning',
      title: 'Atención',
      text: 'Ingrese el número de comprobante',
      confirmButtonText: 'OK'
    });
    return;
  }

  try {
    const res = await fetch(`/api/comprobantes/buscar?numero_comprobante=${numero}`);
    const data = await res.json();
    renderTabla(data);
  } catch (err) {
    console.error("Error al buscar comprobantes por número:", err);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al buscar comprobantes',
      confirmButtonText: 'OK'
    });
  }
}

function renderTabla(data) {
  const tbody = document.getElementById("tablaResultados");
  tbody.innerHTML = "";

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay resultados.</td></tr>';
    return;
  }

  data.forEach(item => {
    const fecha = new Date(item.fecha_emision).toLocaleString("es-PE");
    const total = Number(item.total).toFixed(2);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.numero_comprobante}</td>
      <td>${item.tipo}</td>
      <td>${fecha}</td>
      <td>${item.cliente || '-'}</td>
      <td>S/ ${total}</td>
      <td>
        <button class="btn btn-success btn-sm" onclick="verComprobante('${item.tipo}', '${item.numero_comprobante}')">
          <i class="fa fa-print"> Imprimir</i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Función directa de exportar PDF sin mostrar modal
async function verComprobante(tipo, codigo_venta) {
  try {
    const res = await fetch(`/api/comprobantes/detalle/${tipo}/${codigo_venta}`);
    const { cabecera, detalle } = await res.json();

    const html = `
      <div style="font-family: Arial; width: 100%;">
        <h2 style="text-align: center;">${cabecera.tipo_comprobante.toUpperCase()}</h2>
        <hr>
        <p><strong>Cliente:</strong> ${cabecera.nombre || 'No especificado'}</p>
        <p><strong>Documento:</strong> ${cabecera.tipo_documento} ${cabecera.numero_documento}</p>
        <p><strong>Fecha:</strong> ${new Date(cabecera.fecha).toLocaleString()}</p>
        <p><strong>N° Comprobante:</strong> ${cabecera.codigo_venta}</p>
        <hr>
        <table style="width: 100%; font-size: 12px;" border="1" cellspacing="0" cellpadding="4">
          <thead>
            <tr><th>Descripción</th><th>Cant</th><th>Precio</th><th>Subtotal</th></tr>
          </thead>
          <tbody>
            ${detalle.map(p => `
              <tr>
                <td>${p.descripcion}</td>
                <td align="center">${p.cantidad}</td>
                <td align="right">S/ ${Number(p.precio_unitario).toFixed(2)}</td>
                <td align="right">S/ ${Number(p.subtotal).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <hr>
        <p style="text-align:right"><strong>Total: S/ ${Number(cabecera.total).toFixed(2)}</strong></p>
        <p style="text-align:right">IGV: S/ ${Number(cabecera.igv || 0).toFixed(2)}</p>
        <p style="text-align:right">Efectivo: S/ ${Number(cabecera.efectivo || 0).toFixed(2)}</p>
        <p style="text-align:right">Vuelto: S/ ${Number(cabecera.vuelto || 0).toFixed(2)}</p>
        <hr>
        <p style="text-align:center">¡Gracias por su Preferencia!</p>
      </div>
    `;

    // IMPRIMIR usando una ventana temporal
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir comprobante</title>
        </head>
        <body onload="window.print(); window.close();">
          ${html}
        </body>
      </html>
    `);
    printWindow.document.close();

    // Esperar un momento antes de generar PDF
    setTimeout(() => {
      const contenedor = document.createElement('div');
      contenedor.innerHTML = html;

      html2pdf().set({
        margin: 5,
        filename: `comprobante_${codigo_venta}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' }
      }).from(contenedor).save();
    }, 2000);

  } catch (err) {
    console.error("❌ Error al generar comprobante:", err);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error al generar comprobante',
      confirmButtonText: 'OK'
    });
  }
}

window.verComprobante = verComprobante;
