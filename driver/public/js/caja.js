document.addEventListener('DOMContentLoaded', () => {
  const resumen = document.getElementById('resumenCaja');
  const tablaMovimientos = document.getElementById('tablaMovimientos');
  const formMovimiento = document.getElementById('formMovimiento');
  const btnAbrirCaja = document.getElementById('btnAbrirCaja');
  const btnCerrarCaja = document.getElementById('btnCerrarCaja');
  const inputMontoApertura = document.getElementById('monto_apertura');
  const campoDiferencia = document.getElementById('diferencia');

  cargarMovimientosDia();

  formMovimiento?.addEventListener('submit', e => {
    e.preventDefault();
    const tipo = document.getElementById('tipo').value;
    const monto = parseFloat(document.getElementById('monto').value);
    const motivo = document.getElementById('motivo').value.trim();

    if (!monto || monto <= 0) {
      Swal.fire('Monto inválido', 'Por favor ingrese un monto mayor a 0.', 'warning');
      return;
    }

    fetch(`/api/caja/${tipo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descripcion: motivo, monto })
    })
      .then(res => res.json())
      .then(resp => {
        if (resp.error) throw new Error(resp.error);
        cargarMovimientosDia();
        formMovimiento.reset();
        Swal.fire('Movimiento registrado', 'El movimiento se guardó correctamente.', 'success');
      })
      .catch(err => Swal.fire('Error', err.message, 'error'));
  });

  btnAbrirCaja?.addEventListener('click', () => {
    const monto = parseFloat(inputMontoApertura.value);
    if (isNaN(monto) || monto < 0) {
      Swal.fire('Monto inválido', 'Ingrese un monto válido para apertura.', 'warning');
      return;
    }

    fetch('/api/caja/abrir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monto_inicial: monto })
    })
      .then(res => res.json())
      .then(resp => {
        if (resp.error) throw new Error(resp.error);
        Swal.fire('Caja abierta', '✅ Caja abierta correctamente.', 'success');
        cargarMovimientosDia();
      })
      .catch(err => Swal.fire('Error', err.message, 'error'));
  });

  btnCerrarCaja?.addEventListener('click', async () => {
    const { value: montoCierre } = await Swal.fire({
      title: 'Cerrar caja',
      input: 'number',
      inputLabel: 'Ingrese el monto contado en caja (físico)',
      inputPlaceholder: 'Ej: 150.00',
      confirmButtonText: 'Cerrar',
      showCancelButton: true,
      cancelButtonText: 'Cancelar'
    });

    if (!montoCierre || isNaN(montoCierre)) {
      Swal.fire('Monto inválido', 'Debe ingresar un monto válido.', 'warning');
      return;
    }

    const observacion = document.getElementById('observacion_cierre')?.value.trim() || null;

    fetch('/api/caja/cerrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monto_final: parseFloat(montoCierre),
        observacion: observacion
      })
    })
      .then(res => res.json())
      .then(resp => {
        if (resp.error) throw new Error(resp.error);
        Swal.fire('Caja cerrada', '✅ Caja cerrada correctamente.', 'success');
        cargarMovimientosDia();
      })
      .catch(err => Swal.fire('Error', '❌ ' + err.message, 'error'));
  });

  function cargarMovimientosDia() {
    fetch('/api/caja/movimientos')
      .then(res => res.json())
      .then(data => {
        tablaMovimientos.innerHTML = '';
        let totalIngresos = 0;
        let totalEgresos = 0;
        let apertura = 0;
        let cierre = 0;
        let tieneCierre = false;

        data.forEach((mov, i) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${mov.fecha.substring(0, 16).replace('T', ' ')}</td>
            <td>${mov.tipo}</td>
            <td>${mov.descripcion || '-'}</td>
            <td>S/. ${parseFloat(mov.monto).toFixed(2)}</td>
          `;
          tablaMovimientos.appendChild(tr);

          if (mov.tipo === 'apertura') apertura += parseFloat(mov.monto);
          else if (mov.tipo === 'cierre') {
            cierre = parseFloat(mov.monto);
            tieneCierre = true;
          }
          else if (mov.tipo === 'ingreso') totalIngresos += parseFloat(mov.monto);
          else if (mov.tipo === 'egreso') totalEgresos += parseFloat(mov.monto);
        });

        fetch('/api/caja/ingresos-adicionales')
          .then(res => res.json())
          .then(extra => {
            const ventasContado = parseFloat(extra.ventasContado || 0);
            const pagosCredito = parseFloat(extra.pagosCredito || 0);
            const totalIngresosFinal = totalIngresos + ventasContado + pagosCredito;
            const totalCaja = apertura + totalIngresosFinal - totalEgresos;
            const diferencia = tieneCierre ? (cierre - totalCaja) : 0;

            resumen.innerHTML = `
              <strong>Apertura:</strong> S/. ${apertura.toFixed(2)}<br>
              <strong>Movimientos (manuales):</strong> S/. ${totalIngresos.toFixed(2)}<br>
              <strong>Ventas contado:</strong> S/. ${ventasContado.toFixed(2)}<br>
              <strong>Pagos crédito (efectivo):</strong> S/. ${pagosCredito.toFixed(2)}<br>
              <strong>Total ingresos:</strong> S/. ${totalIngresosFinal.toFixed(2)}<br>
              <strong>Egresos:</strong> S/. ${totalEgresos.toFixed(2)}<br>
              <strong>Total en caja:</strong> S/. ${totalCaja.toFixed(2)}<br>
              ${tieneCierre ? `<strong>Cierre:</strong> S/. ${cierre.toFixed(2)}<br><strong>Diferencia:</strong> S/. ${diferencia.toFixed(2)}` : ''}
            `;

            if (campoDiferencia) {
              campoDiferencia.textContent = tieneCierre
                ? `Diferencia: S/. ${diferencia.toFixed(2)}`
                : '';
            }
          })
          .catch(err => console.error('❌ Error al obtener ingresos adicionales:', err));
      })
      .catch(err => {
        console.error('❌ Error cargando movimientos:', err);
        tablaMovimientos.innerHTML = '<tr><td colspan="5">Error al cargar movimientos</td></tr>';
      });
  }

  function cargarHistorialCaja() {
    fetch('/api/caja/historial')
      .then(res => res.json())
      .then(historial => {
        const tabla = document.getElementById('tablaHistorial');
        if (!tabla) return;
        tabla.innerHTML = '';
        historial.forEach(row => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${row.fecha.substring(0, 16).replace('T', ' ')}</td>
            <td>S/. ${parseFloat(row.apertura).toFixed(2)}</td>
            <td>${row.cierre != null ? 'S/. ' + parseFloat(row.cierre).toFixed(2) : '-'}</td>
            <td>${row.diferencia != null ? 'S/. ' + parseFloat(row.diferencia).toFixed(2) : '-'}</td>
            <td>${row.estado}</td>
            <td>${row.observaciones || '-'}</td>
          `;
          tabla.appendChild(tr);
        });
      })
      .catch(err => console.error('❌ Error al cargar historial de caja:', err));
  }
  cargarHistorialCaja();
});
