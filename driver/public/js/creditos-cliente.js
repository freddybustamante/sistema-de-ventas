document.getElementById("btnBuscar").addEventListener("click", async () => {
  const documento = document.getElementById("inputDocumento").value.trim();
  const tablaCreditos = document.getElementById("tablaCreditos");
  document.getElementById("detallesCredito").style.display = "none";
  tablaCreditos.innerHTML = "";

  if (!documento || documento.length < 6) {
    Swal.fire({
      icon: "warning",
      title: "Documento inválido",
      text: "Ingrese un DNI o RUC válido",
      confirmButtonColor: "#3085d6",
    });
    return;
  }

  try {
    const res = await fetch(`/api/creditos/${documento}`);
    const creditos = await res.json();

    if (!Array.isArray(creditos) || creditos.length === 0) {
      tablaCreditos.innerHTML = `<tr><td colspan="4">No se encontraron créditos</td></tr>`;
      return;
    }

    creditos.forEach(c => {
      const colorEstado = c.estado === "pendiente" ? "text-danger font-weight-bold" : "text-success font-weight-bold";
  const fila = `
  <tr>
    <td>${new Date(c.fecha_credito).toLocaleDateString()}</td>
    <td>S/ ${parseFloat(c.total).toFixed(2)}</td>
    <td>S/ ${parseFloat(c.saldo_pendiente).toFixed(2)}</td>
    <td class="${colorEstado}">${c.estado}</td>
    <td><button class="btn btn-sm btn-info" onclick="verDetalles(${c.id_credito})">Ver</button></td>
  </tr>
`;


      tablaCreditos.innerHTML += fila;
    });

  } catch (error) {
    console.error("❌ Error al consultar créditos:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Ocurrió un error al buscar los créditos",
      confirmButtonColor: "#d33",
    });
  }
});

async function verDetalles(idCredito) {
  const tablaProductos = document.getElementById("tablaProductosCredito");
  const tablaPagos = document.getElementById("tablaPagosCredito");
  document.getElementById("detallesCredito").style.display = "block";

  // 📦 Productos del crédito
  try {
  const resPagos = await fetch(`/api/creditos/pagos/${idCredito}`);
  if (!resPagos.ok) throw new Error("No se pudo cargar historial de pagos");

  const pagos = await resPagos.json();
  const totalElemento = document.getElementById("totalPagado");
  const saldoElemento = document.getElementById("saldoPendienteHistorial");

  tablaPagos.innerHTML = "";
  let totalPagado = 0;

  // Obtener el total original del crédito
  const resCredito = await fetch(`/api/creditos/${idCredito}/info`);
  const infoCredito = await resCredito.json();
  const totalOriginal = parseFloat(infoCredito.total);

  if (pagos.length === 0) {
    // Si no hay pagos, mostramos todo pendiente
    tablaPagos.innerHTML = "<tr><td colspan='3'>Sin pagos registrados</td></tr>";
    totalElemento.textContent = "S/ 0.00";
    saldoElemento.textContent = `S/ ${totalOriginal.toFixed(2)}`;
    return;
  }

  // Calcular el total pagado sumando todos los pagos
  pagos.forEach(p => {
    totalPagado += parseFloat(p.monto_pagado);
    tablaPagos.innerHTML += `
      <tr>
        <td>${new Date(p.fecha_pago).toLocaleDateString()}</td>
        <td>${p.metodo_pago}</td>
        <td>S/ ${parseFloat(p.monto_pagado).toFixed(2)}</td>
      </tr>
    `;
  });

  // Calcular el saldo pendiente restando el total pagado al total original
  const saldoPendiente = totalOriginal - totalPagado;
  
  totalElemento.textContent = `S/ ${totalPagado.toFixed(2)}`;
  saldoElemento.textContent = `S/ ${saldoPendiente.toFixed(2)}`;
} catch (err) {
  console.error("❌ Error al cargar pagos:", err.message);
  Swal.fire({
    icon: "error",
    title: "Error al cargar pagos",
    text: "No se pudo obtener el historial de pagos.",
    confirmButtonColor: "#d33",
  });
}

  // 💳 Historial de pagos
  try {
    const resPagos = await fetch(`/api/creditos/pagos/${idCredito}`);
    if (!resPagos.ok) throw new Error("No se pudo cargar historial de pagos");

    const pagos = await resPagos.json();
    const totalElemento = document.getElementById("totalPagado");
    const saldoElemento = document.getElementById("saldoPendienteHistorial");

    tablaPagos.innerHTML = "";
    let totalPagado = 0;

    if (pagos.length === 0) {
      // Si no hay pagos, mostramos todo pendiente
      tablaPagos.innerHTML = "<tr><td colspan='3'>Sin pagos registrados</td></tr>";
      totalElemento.textContent = "S/ 0.00";

      // ⚡ Pedimos al backend el saldo original del crédito
      const resCredito = await fetch(`/api/creditos/${idCredito}/saldo`);
      if (resCredito.ok) {
        const data = await resCredito.json();
        saldoElemento.textContent = `S/ ${parseFloat(data.saldo_pendiente).toFixed(2)}`;
      } else {
        saldoElemento.textContent = "S/ 0.00";
      }
      return;
    }

    pagos.forEach(p => {
      totalPagado += parseFloat(p.monto_pagado);
      tablaPagos.innerHTML += `
        <tr>
          <td>${new Date(p.fecha_pago).toLocaleDateString()}</td>
          <td>${p.metodo_pago}</td>
          <td>S/ ${parseFloat(p.monto_pagado).toFixed(2)}</td>
        </tr>
      `;
    });



    // ✅ Saldo pendiente correcto = del último pago
    const ultimoPago = pagos[pagos.length - 1];
    totalElemento.textContent = `S/ ${totalPagado.toFixed(2)}`;
    saldoElemento.textContent = `S/ ${parseFloat(ultimoPago.saldo_restante).toFixed(2)}`;
  } catch (err) {
    console.error("❌ Error al cargar pagos:", err.message);
    Swal.fire({
      icon: "error",
      title: "Error al cargar pagos",
      text: "No se pudo obtener el historial de pagos.",
      confirmButtonColor: "#d33",
    });
  }
}

