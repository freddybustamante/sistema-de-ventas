function renderPagos() {
  const tbody = document.getElementById('tablaPagos');
  if (!tbody) return;
  
  tbody.innerHTML = '';

  let totalPagado = 0;
  let efectivoPagado = 0;

  pagos.forEach((p, index) => {
    totalPagado += p.monto;
    if (p.codigo === 'EFECTIVO') {
      efectivoPagado += p.monto;
    }

    const referenciaTexto = p.referencia ? `<br><small class="text-muted">Ref: ${p.referencia}</small>` : '';
    
    tbody.innerHTML += `
      <tr>
        <td>${p.nombre}${referenciaTexto}</td>
        <td class="text-end">S/. ${p.monto.toFixed(2)}</td>
        <td class="text-center">
          <button class="btn btn-danger btn-sm" onclick="eliminarPago(${index})">✕</button>
        </td>
      </tr>
    `;
  });

  const totalPagadoElement = document.getElementById('totalPagado');
  if (totalPagadoElement) {
    totalPagadoElement.textContent = totalPagado.toFixed(2);
  }
  
  // ✅ Calcular vuelto considerando otros métodos de pago
  const totalVenta = parseFloat(document.getElementById('total')?.textContent || 0);
  const vueltoInput = document.getElementById('vuelto');
  if (vueltoInput) {
    if (efectivoPagado > 0) {
      // Calcular cuánto falta pagar después de los otros métodos
      const otrosPagos = totalPagado - efectivoPagado;
      const restantePorPagar = totalVenta - otrosPagos;
      
      // El vuelto es: efectivo - lo que realmente debe cubrir
      const vuelto = efectivoPagado - restantePorPagar;
      vueltoInput.value = vuelto > 0 ? vuelto.toFixed(2) : '0.00';
    } else {
      vueltoInput.value = '0.00';
    }
  }
  
  // Habilitar/deshabilitar botón de finalizar
  const btnFinalizar = document.getElementById('btnFinalizarVenta');
  if (btnFinalizar) {
    const puedeFinalizarConEfectivo = efectivoPagado > 0 && totalPagado >= totalVenta;
    const puedeFinalizarSinEfectivo = efectivoPagado === 0 && Math.abs(totalPagado - totalVenta) < 0.01;
    
    btnFinalizar.disabled = carrito.length === 0 || !(puedeFinalizarConEfectivo || puedeFinalizarSinEfectivo);
  }
}