document.addEventListener("DOMContentLoaded", () => {
  const inputDocumento = document.getElementById("documentoCliente");
  const inputNombre = document.getElementById("nombreCliente");
  const saldoPendiente = document.getElementById("saldoPendiente");
  const formPago = document.getElementById("formPagoCredito");
  const tablaCreditos = document.getElementById("tablaCreditos");
  const tablaPagos = document.getElementById("tablaPagos");
  const tablaProductos = document.getElementById("tablaProductosCredito");

  let creditosCliente = [];

  inputDocumento.addEventListener("change", async () => {
    const documento = inputDocumento.value.trim();
    if (documento.length < 6) return;

    try {
      const res = await fetch(`/api/pagos-credito/cliente/${documento}`);
      if (!res.ok) throw new Error("Cliente no registrado / encontrado");

      const cliente = await res.json();
      
      // Validar que inputNombre existe antes de asignar valor
      if (inputNombre) {
        inputNombre.value = `${cliente.nombre} ${cliente.apellido}`;
      }

      // Si el backend indica que no hay crédito, mostrar mensaje sin hacer fetch extra
      if (!cliente.credito) {
        Swal.fire({
          icon: 'info',
          title: 'Sin créditos pendientes',
          text: 'Este cliente no tiene deuda Pendiente.',
          confirmButtonText: 'Aceptar'
        });

        if (saldoPendiente) {
          saldoPendiente.value = "0.00";
        }

        if (tablaCreditos) tablaCreditos.innerHTML = "";
        if (tablaPagos) tablaPagos.innerHTML = "";
        if (tablaProductos) tablaProductos.innerHTML = "";
        return;
      }

      // Si tiene créditos, cargar lista normal
      await cargarCreditosPendientes(documento);

    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message,
        confirmButtonText: 'Aceptar'
      });
      
      // Validar elementos antes de limpiar
      if (inputNombre) inputNombre.value = "";
      if (saldoPendiente) saldoPendiente.value = "";
      if (tablaCreditos) tablaCreditos.innerHTML = "";
      if (tablaPagos) tablaPagos.innerHTML = "";
      if (tablaProductos) tablaProductos.innerHTML = "";
    }
  });

  async function cargarCreditosPendientes(numeroDocumento) {
    try {
      const res = await fetch(`/api/pagos-credito/creditos/${numeroDocumento}`);
      if (!res.ok) throw new Error("No se pudo cargar los créditos");

      creditosCliente = await res.json();
      
      // Validar elementos antes de manipular
      if (tablaCreditos) tablaCreditos.innerHTML = "";
      if (saldoPendiente) saldoPendiente.value = "0.00";
      if (tablaProductos) tablaProductos.innerHTML = "";
      if (tablaPagos) tablaPagos.innerHTML = "";

      if (creditosCliente.length === 0) {
        if (tablaCreditos) {
          tablaCreditos.innerHTML = "<tr><td colspan='4'>Sin créditos pendientes</td></tr>";
        }
        return;
      }

      if (tablaCreditos) {
        creditosCliente.forEach(c => {
          const fila = `
            <tr>
              <td><input type="checkbox" class="credito-checkbox" value="${c.id_credito}" data-saldo="${c.saldo_pendiente}"></td>
              <td>${new Date(c.fecha_credito).toLocaleDateString()}</td>
              <td>S/ ${parseFloat(c.total).toFixed(2)}</td>
              <td>S/ ${parseFloat(c.saldo_pendiente).toFixed(2)}</td>
            </tr>`;
          tablaCreditos.innerHTML += fila;
        });

        // Asignar evento a cada checkbox
        document.querySelectorAll('.credito-checkbox').forEach(cb => {
          cb.addEventListener('change', actualizarSeleccionCreditos);
        });
      }

    } catch (err) {
      // Log para debugging en desarrollo (opcional mantener para Electron)
      if (window.require) {
        // En Electron, usar el sistema de logs
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('log-error', 'Error al cargar créditos:', err.message);
      }
    }
  }

  async function actualizarSeleccionCreditos() {
    const seleccionados = Array.from(document.querySelectorAll('.credito-checkbox:checked'));
    const total = seleccionados.reduce((sum, cb) => sum + parseFloat(cb.dataset.saldo), 0);
    
    if (saldoPendiente) {
      saldoPendiente.value = total.toFixed(2);
    }

    if (seleccionados.length === 1) {
      const idCredito = seleccionados[0].value;
      await cargarHistorialPagos(idCredito);
      await cargarProductosCredito(idCredito);
    } else {
      if (tablaPagos) {
        tablaPagos.innerHTML = "<tr><td colspan='3'>Seleccione solo un crédito para ver el historial</td></tr>";
      }
      if (tablaProductos) {
        tablaProductos.innerHTML = "<tr><td colspan='4'>Seleccione solo un crédito para ver productos</td></tr>";
      }
    }
  }

  if (formPago) {
    formPago.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      // Validar elementos antes de acceder a sus valores
      const metodoElement = document.getElementById("metodoPago");
      const montoElement = document.getElementById("montoPago");
      const observacionElement = document.getElementById("observacionPago");
      
      if (!metodoElement || !montoElement) {
        console.error("Elementos del formulario no encontrados");
        return;
      }
      
      const metodo = metodoElement.value;
      const monto = parseFloat(montoElement.value);
      const observacion = observacionElement?.value || null;

      const checkboxes = document.querySelectorAll(".credito-checkbox:checked");
      const idsSeleccionados = Array.from(checkboxes).map(cb => parseInt(cb.value));

      if (idsSeleccionados.length === 0) {
        await Swal.fire({
          icon: 'warning',
          title: 'Atención',
          text: 'Debes seleccionar al menos un crédito',
          confirmButtonText: 'Entendido'
        });
        return;
      }

      if (isNaN(monto) || monto <= 0) {
        await Swal.fire({
          icon: 'error',
          title: 'Monto inválido',
          text: 'Por favor, ingresa un monto válido mayor a 0',
          confirmButtonText: 'Aceptar'
        });
        return;
      }

      const saldoValue = saldoPendiente ? parseFloat(saldoPendiente.value) : 0;
      if (monto > saldoValue) {
        await Swal.fire({
          icon: 'error',
          title: 'Monto excedido',
          text: 'El monto no puede ser mayor al saldo total seleccionado',
          confirmButtonText: 'Aceptar'
        });
        return;
      }

      // Mostrar confirmación antes de procesar el pago
      const confirmResult = await Swal.fire({
        icon: 'question',
        title: 'Confirmar pago',
        html: `
          <p><strong>Método:</strong> ${metodo}</p>
          <p><strong>Monto:</strong> S/ ${monto.toFixed(2)}</p>
          <p><strong>Créditos:</strong> ${idsSeleccionados.length}</p>
          ${observacion ? `<p><strong>Observación:</strong> ${observacion}</p>` : ''}
        `,
        showCancelButton: true,
        confirmButtonText: 'Confirmar pago',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d'
      });

      if (!confirmResult.isConfirmed) return;

      // Mostrar loader durante el procesamiento
      Swal.fire({
        title: 'Procesando pago...',
        text: 'Por favor espere',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      try {
        const res = await fetch("/api/pagos-credito/pagar-multiple", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: idsSeleccionados, metodoPago: metodo, monto, observacion }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje);

        await Swal.fire({
          icon: 'success',
          title: 'Pago exitoso',
          text: 'El pago se ha registrado correctamente',
          confirmButtonText: 'Aceptar',
          timer: 3000,
          timerProgressBar: true
        });

        // Validar elementos antes de limpiar
        if (montoElement) montoElement.value = "";
        if (observacionElement) observacionElement.value = "";
        
        if (inputDocumento) {
          await cargarCreditosPendientes(inputDocumento.value.trim());
        }

      } catch (err) {
        // Log para debugging en desarrollo (opcional mantener para Electron)
        if (window.require) {
          const { ipcRenderer } = window.require('electron');
          ipcRenderer.send('log-error', 'Error al registrar pago múltiple:', err.message);
        }

        await Swal.fire({
          icon: 'error',
          title: 'Error al procesar pago',
          text: err.message || 'Ha ocurrido un error inesperado',
          confirmButtonText: 'Aceptar'
        });
      }
    });
  }

  async function cargarHistorialPagos(idCredito) {
    try {
      const res = await fetch(`/api/pagos-credito/historial/${idCredito}`);
      const pagos = await res.json();
      
      if (tablaPagos) {
        tablaPagos.innerHTML = "";

        if (!res.ok || pagos.length === 0) {
          tablaPagos.innerHTML = "<tr><td colspan='3'>Sin pagos registrados</td></tr>";
          return;
        }

        pagos.forEach(pago => {
          tablaPagos.innerHTML += `
            <tr>
              <td>${new Date(pago.fecha_pago).toLocaleDateString()}</td>
              <td>${pago.metodo_pago}</td>
              <td>S/ ${parseFloat(pago.monto_pagado).toFixed(2)}</td>
            </tr>`;
        });
      }
    } catch (err) {
      // Log para debugging en desarrollo (opcional mantener para Electron)
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('log-error', 'Error al cargar historial:', err.message);
      }
    }
  }

  async function cargarProductosCredito(idCredito) {
    try {
      const res = await fetch(`/api/pagos-credito/detalles/${idCredito}`);
      const productos = await res.json();
      
      if (tablaProductos) {
        tablaProductos.innerHTML = "";

        if (!res.ok || productos.length === 0) {
          tablaProductos.innerHTML = "<tr><td colspan='4'>Sin productos registrados</td></tr>";
          return;
        }

        productos.forEach(prod => {
          tablaProductos.innerHTML += `
            <tr>
              <td>${prod.producto}</td>
              <td>${prod.cantidad}</td>
              <td>S/ ${parseFloat(prod.precio_unitario).toFixed(2)}</td>
              <td>S/ ${parseFloat(prod.subtotal).toFixed(2)}</td>
            </tr>`;
        });
      }
    } catch (err) {
      // Log para debugging en desarrollo (opcional mantener para Electron)
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('log-error', 'Error al cargar productos:', err.message);
      }
    }
  }

  const inputMonto = document.getElementById("montoPago");
  const inputSaldo = document.getElementById("saldoPendiente");

  if (inputMonto && inputSaldo) {
    inputMonto.addEventListener("input", () => {
      const monto = parseFloat(inputMonto.value);
      const saldoMax = parseFloat(inputSaldo.value);

      if (!isNaN(monto) && monto > saldoMax) {
        inputMonto.value = saldoMax.toFixed(2); // lo fuerza al máximo permitido
        
        // Mostrar advertencia con SweetAlert
        Swal.fire({
          icon: 'info',
          title: 'Monto ajustado',
          text: 'El monto ha sido ajustado al máximo permitido',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true
        });
      }
    });
  }
});

// Función para manejar errores de red en Electron
if (window.require) {
  const { ipcRenderer } = window.require('electron');
  
  // Escuchar eventos de conectividad si es necesario
  window.addEventListener('online', () => {
    Swal.fire({
      icon: 'success',
      title: 'Conexión restaurada',
      text: 'La conexión a internet ha sido restaurada',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  });

  window.addEventListener('offline', () => {
    Swal.fire({
      icon: 'warning',
      title: 'Sin conexión',
      text: 'Se ha perdido la conexión a internet',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  });
}