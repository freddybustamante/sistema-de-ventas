//ventas-flexible.js - VERSIÓN CORREGIDA COMPLETA

let carrito = [];
let pagos = [];
let metodosPago = [];
let procesandoVenta = false;

// ==================== MÉTODOS DE PAGO ====================
const METODO_PAGO_DEFAULT_CODIGO = 'EFECTIVO';

async function cargarMetodosPago() {
  try {
    const res = await fetch('/api/metodos-pago');
    metodosPago = await res.json();

    const select = document.getElementById('metodo_pago');
    select.innerHTML = '<option value="">Seleccione método</option>';

    metodosPago.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.dataset.codigo = m.codigo;
      opt.dataset.vuelto = m.requiere_vuelto;
      opt.textContent = m.nombre;

      if (m.codigo === METODO_PAGO_DEFAULT_CODIGO) {
        opt.selected = true;
      }

      select.appendChild(opt);
    });

  } catch (err) {
    console.error('Error cargando métodos de pago:', err);
    mostrarAlerta('error', 'Error', 'No se pudieron cargar los métodos de pago');
  }
}


function toggleReferencia() {
  const select = document.getElementById('metodo_pago');
  const divReferencia = document.getElementById('div_referencia');
  const referenciaInput = document.getElementById('referencia_pago');
  
  if (!select || !divReferencia) return;
  
  const option = select.selectedOptions[0];
  if (!option || !option.value) {
    divReferencia.style.display = 'none';
    return;
  }
  
  const codigo = option.dataset.codigo;
  
  if (codigo && codigo !== 'EFECTIVO') {
    divReferencia.style.display = 'block';
    if (referenciaInput) {
      referenciaInput.placeholder = `N° de operación ${option.textContent}`;
    }
  } else {
    divReferencia.style.display = 'none';
    if (referenciaInput) referenciaInput.value = '';
  }
}

function agregarPago() {
  const select = document.getElementById('metodo_pago');
  const montoInput = document.getElementById('monto_pago');
  const referenciaInput = document.getElementById('referencia_pago');

  const metodoId = select.value;
  let monto = parseFloat(montoInput.value);
  const option = select.selectedOptions[0];

  if (!metodoId || !monto || monto <= 0) {
    mostrarAlerta('warning', 'Pago inválido', 'Seleccione método y monto válido');
    return;
  }

  const codigo = option.dataset.codigo;
  const nombreMetodo = option.textContent;
  const referencia = referenciaInput && referenciaInput.value.trim() ? referenciaInput.value.trim() : null;

  const totalVenta = parseFloat(document.getElementById('total').textContent);
  const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);
  const faltante = totalVenta - totalPagado;

  // ✅ VALIDACIÓN 1: Ya está completamente pagado
  if (faltante <= 0) {
    mostrarAlerta('warning', 'Venta ya pagada', 
      'El total de la venta ya está cubierto. No puede agregar más pagos.');
    return;
  }

  const esEfectivo = (codigo === 'EFECTIVO');

  // ✅ VALIDACIÓN 2: Si NO es efectivo, NO puede exceder
  if (!esEfectivo && monto > faltante) {
    mostrarAlerta('error', 'Monto excede lo pendiente', 
      `${nombreMetodo} no puede exceder el saldo pendiente. Solo faltan S/. ${faltante.toFixed(2)} por pagar.`);
    return;
  }

  // ✅ VALIDACIÓN 3: Efectivo solo una vez
  if (esEfectivo) {
    const yaExisteEfectivo = pagos.some(p => p.codigo === 'EFECTIVO');
    if (yaExisteEfectivo) {
      mostrarAlerta('warning', 'Efectivo ya registrado', 
        'Ya hay un pago en efectivo registrado. Si desea modificarlo, elimínelo primero.');
      return;
    }
  }

  // 🔥 NUEVO: Si es efectivo, guardar monto recibido Y calcular vuelto
  let montoRecibido = monto;
  let montoAPagar = monto;
  let vueltoCalculado = 0;

  if (esEfectivo && monto > faltante) {
    montoAPagar = faltante; // Solo registrar lo que cubre la deuda
    vueltoCalculado = monto - faltante; // Calcular vuelto
    
    Swal.fire({
      icon: 'info',
      title: 'Pago en efectivo',
      html: `
        <p>Cliente entrega: <strong>S/. ${montoRecibido.toFixed(2)}</strong></p>
        <p>Monto a registrar: <strong>S/. ${montoAPagar.toFixed(2)}</strong></p>
        <p>Vuelto a devolver: <strong class="text-success">S/. ${vueltoCalculado.toFixed(2)}</strong></p>
      `,
      confirmButtonText: 'Aceptar'
    });
  }

  // ✅ Agregar el pago (con monto ajustado si es efectivo)
  pagos.push({
    metodo_pago_id: metodoId,
    codigo: codigo,
    nombre: nombreMetodo,
    monto: montoAPagar, // ⭐ Aquí se ajusta el monto para efectivo
    requiere_vuelto: esEfectivo,
    referencia: esEfectivo ? null : referencia,
    monto_recibido: esEfectivo ? montoRecibido : null, // Guardamos cuánto entregó el cliente
    vuelto: esEfectivo ? vueltoCalculado : 0
  });

  montoInput.value = '';
  select.value = '';
  if (referenciaInput) referenciaInput.value = '';
  
  const divReferencia = document.getElementById('div_referencia');
  if (divReferencia) divReferencia.style.display = 'none';
  
  renderPagos();
}

function renderPagos() {
  const tbody = document.getElementById('tablaPagos');
  if (!tbody) return;
  
  tbody.innerHTML = '';

  let totalPagado = 0;
  let efectivoPagado = 0;
  let vueltoTotal = 0;

  pagos.forEach((p, index) => {
    totalPagado += p.monto;
    if (p.codigo === 'EFECTIVO') {
      efectivoPagado += p.monto;
      vueltoTotal = p.vuelto || 0;
    }

    const referenciaTexto = p.referencia ? `<br><small class="text-muted">Ref: ${p.referencia}</small>` : '';
    const montoRecibidoTexto = p.monto_recibido ? `<br><small class="text-info">Recibido: S/. ${p.monto_recibido.toFixed(2)}</small>` : '';
    
    tbody.innerHTML += `
      <tr>
        <td>${p.nombre}${referenciaTexto}${montoRecibidoTexto}</td>
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
  
  // ✅ Mostrar vuelto
  const vueltoInput = document.getElementById('vuelto');
  if (vueltoInput) {
    vueltoInput.value = vueltoTotal.toFixed(2);
  }
  
  // Habilitar/deshabilitar botón de finalizar
  const totalVenta = parseFloat(document.getElementById('total')?.textContent || 0);
  const btnFinalizar = document.getElementById('btnFinalizarVenta');
  if (btnFinalizar) {
    const estaPagado = Math.abs(totalPagado - totalVenta) < 0.01;
    btnFinalizar.disabled = carrito.length === 0 || !estaPagado;
  }
}

function eliminarPago(index) {
  pagos.splice(index, 1);
  renderPagos();
}

function calcularVuelto(efectivoPagado) {
  if (!efectivoPagado) {
    efectivoPagado = parseFloat(document.getElementById('efectivo')?.value || 0);
  }
  
  const totalVenta = parseFloat(document.getElementById('total').textContent);
  const vueltoInput = document.getElementById('vuelto');

  if (efectivoPagado > totalVenta) {
    vueltoInput.value = (efectivoPagado - totalVenta).toFixed(2);
  } else {
    vueltoInput.value = '0.00';
  }
}

function validarPagos(totalVenta) {
  let totalPagos = 0;
  let totalEfectivo = 0;

  for (const p of pagos) {
    totalPagos += Number(p.monto);
    if (p.codigo === 'EFECTIVO') {
      totalEfectivo += Number(p.monto);
    }
  }

  totalPagos = Number(totalPagos.toFixed(2));
  totalVenta = Number(totalVenta.toFixed(2));

  if (totalEfectivo === 0 && totalPagos !== totalVenta) {
    throw new Error('La suma de los pagos debe ser exacta');
  }

  if (totalEfectivo > 0 && totalPagos < totalVenta) {
    throw new Error('El efectivo no cubre el total');
  }

  const vuelto = totalEfectivo > 0 ? Math.max(0, totalPagos - totalVenta) : 0;
  return vuelto;
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', function() {
    const storedCarrito = localStorage.getItem('carrito');
    if (storedCarrito) {
        try {
            const parsedCarrito = JSON.parse(storedCarrito);
            if (Array.isArray(parsedCarrito)) {
                carrito = parsedCarrito.filter(p => p && typeof p.id === 'string' && typeof p.precio === 'number' && typeof p.cantidad === 'number' && typeof p.stock === 'number');
            }
        } catch (e) {
            console.error('Error al parsear carrito de localStorage:', e);
            carrito = [];
        }
    } else {
        carrito = [];
    }
    
    actualizarCarrito();
    setupEventListeners();
    cargarMetodosPago();
});

function setupEventListeners() {
    const tipoDoc = document.getElementById('tipo_documento');
    const numeroDoc = document.getElementById('numero_documento');
    
    if (tipoDoc) {
        tipoDoc.removeEventListener('change', onTipoDocumentoChange);
        tipoDoc.addEventListener('change', onTipoDocumentoChange);
    }
    
    if (numeroDoc) {
        numeroDoc.removeEventListener('blur', buscarCliente);
        numeroDoc.removeEventListener('input', debounce(onNumeroDocumentoChange, 500));
        
        numeroDoc.addEventListener('blur', buscarCliente);
        numeroDoc.addEventListener('input', debounce(onNumeroDocumentoChange, 500));
    }
    
    const buscarProducto = document.getElementById('buscarProducto');
    if (buscarProducto) {
        buscarProducto.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const termino = this.value.trim();
                if (termino.length > 0) {
                    buscarProductoExacto(termino);
                }
            }
        });

        buscarProducto.addEventListener('keyup', function(e) {
            if (e.key !== 'Enter') {
                const termino = this.value.trim();
                if (termino) {
                    buscarProductosSugerencias(termino);
                } else {
                    const sugerencias = document.getElementById('sugerencias');
                    if (sugerencias) {
                        sugerencias.style.display = 'none';
                    }
                }
            }
        });
    }

    const efectivoInput = document.getElementById('efectivo');
    if (efectivoInput) {
        efectivoInput.addEventListener('input', function() {
            calcularVuelto(parseFloat(this.value || 0));
        });
    }

    const aplicarIgvCheckbox = document.getElementById('aplicarIgv');
    if (aplicarIgvCheckbox) {
        aplicarIgvCheckbox.addEventListener('change', actualizarCarrito);
    }

    const btnFinalizarVenta = document.getElementById('btnFinalizarVenta');
    if (btnFinalizarVenta) {
        btnFinalizarVenta.removeEventListener('click', finalizarVenta);
        btnFinalizarVenta.addEventListener('click', finalizarVenta);
    }

    const btnGenerarProforma = document.getElementById('btnGenerarProforma');
    if (btnGenerarProforma) {
        btnGenerarProforma.removeEventListener('click', generarProformaCompleta);
        btnGenerarProforma.addEventListener('click', generarProformaCompleta);
    }

    const btnBoleta = document.getElementById('btnBoleta');
    if (btnBoleta) {
        btnBoleta.removeEventListener('click', () => generarDocumento('boleta'));
        btnBoleta.addEventListener('click', () => generarDocumento('boleta'));
    }

    const btnFactura = document.getElementById('btnFactura');
    if (btnFactura) {
        btnFactura.removeEventListener('click', () => generarDocumento('factura'));
        btnFactura.addEventListener('click', () => generarDocumento('factura'));
    }

    const btnNotaVenta = document.getElementById('btnNotaVenta');
    if (btnNotaVenta) {
        btnNotaVenta.removeEventListener('click', () => generarDocumento('nota'));
        btnNotaVenta.addEventListener('click', () => generarDocumento('nota'));
    }

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('change', handleDocumentChange);

    document.removeEventListener('keydown', handleKeyboardShortcuts);
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(e) {
    if (procesandoVenta) return;
        const elementoActivo = document.activeElement;
    const esInputTexto = elementoActivo.tagName === 'TEXTAREA' || 
                         elementoActivo.id === 'observaciones' ||
                         elementoActivo.id === 'referencia_pago';
    
    // ✅ NUEVOS ATAJOS (agregar antes del switch de F7-F10)
    if (!esInputTexto) {
        switch(e.key) {
            case '+':
                e.preventDefault();
                agregarPago();
                break;
            case '/':
                e.preventDefault();
                const select = document.getElementById('metodo_pago');
                if (select) {
                    select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
                    toggleReferencia();
                }
                break;
            case '*':
                e.preventDefault();
                const montoInput = document.getElementById('monto_pago');
                if (montoInput) {
                    montoInput.focus();
                    montoInput.select();
                }
                break;
        }
    }
    switch(e.keyCode) {
        case 109: // (-)
            e.preventDefault();
            const btnFinalizar = document.getElementById('btnFinalizarVenta');
            if (btnFinalizar && !btnFinalizar.disabled) {
                finalizarVenta();
            }
            break;
        case 119: // F8
            e.preventDefault();
            generarDocumento('boleta');
            break;
        case 120: // F9
            e.preventDefault();
            generarDocumento('factura');
            break;
        case 121: // F10
            e.preventDefault();
            generarDocumento('nota');
            break;
    }
}

function handleDocumentClick(e) {
    if (e.target.classList.contains('seleccionar-producto')) {
        const producto = {
            id: e.target.dataset.id,
            nombre: e.target.dataset.nombre,
            precio: parseFloat(e.target.dataset.precio),
            stock: parseInt(e.target.dataset.stock) || 0
        };
        agregarOIncrementarProducto(producto);
    }

    if (e.target.classList.contains('eliminar-producto')) {
        const id = e.target.dataset.id;
        carrito = carrito.filter(p => p.id !== id);
        localStorage.setItem('carrito', JSON.stringify(carrito));
        actualizarCarrito();
    }
}

function handleDocumentChange(e) {
    if (e.target.classList.contains('cantidad-producto') || e.target.classList.contains('precio-producto')) {
        const id = e.target.dataset.id;
        const producto = carrito.find(p => p.id === id);
        if (producto) {
            const nuevoValor = parseFloat(e.target.value);
            if (!isNaN(nuevoValor) && nuevoValor > 0) {
                if (e.target.classList.contains('cantidad-producto')) {
                    const stockDisponible = producto.stock || 0;
                    if (nuevoValor > stockDisponible) {
                        mostrarAlerta('warning', 'Stock insuficiente', 
                            `La cantidad ingresada (${nuevoValor}) supera el stock disponible (${stockDisponible})`);
                        e.target.value = producto.cantidad;
                        return;
                    }
                    producto.cantidad = nuevoValor;
                } else {
                    producto.precio = nuevoValor;
                }
                localStorage.setItem('carrito', JSON.stringify(carrito));
                actualizarCarrito();
            }
        }
    }
}

// ==================== UTILIDADES ====================
function mostrarAlerta(tipo, titulo, texto, timer = null) {
    if (typeof Swal !== 'undefined') {
        const config = {
            icon: tipo,
            title: titulo,
            text: texto,
            confirmButtonText: 'Entendido'
        };
        if (timer) {
            config.timer = timer;
            config.showConfirmButton = false;
        }
        Swal.fire(config);
    } else {
        alert(`${titulo}: ${texto}`);
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ==================== PRODUCTOS ====================
async function buscarProductoExacto(termino) {
    try {
        const response = await fetch(`/api/productos/buscar?termino=${encodeURIComponent(termino)}`);
        const productos = await response.json();
        const exacto = productos.find(p => p.codigo_barras === termino && p.stock > 0);
        if (exacto) {
            if (exacto.stock === undefined) {
                exacto.stock = 0;
            }
            exacto.id = String(exacto.id);
            agregarOIncrementarProducto(exacto);
        } else {
            mostrarSugerencias(productos.filter(p => p.stock > 0));
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error de búsqueda',
            text: 'No se pudo buscar el producto. Verifique su conexión.',
            timer: 3000
        });
    }
}

async function buscarProductosSugerencias(termino) {
    try {
        const response = await fetch(`/api/productos/buscar?termino=${encodeURIComponent(termino)}`);
        const productos = await response.json();
        mostrarSugerencias(productos.filter(p => p.stock > 0));
    } catch (error) {
        // Error silencioso
    }
}

function mostrarSugerencias(productos) {
    const sugerencias = document.getElementById('sugerencias');
    sugerencias.innerHTML = '';
    sugerencias.style.display = 'block';
    
    productos.forEach(p => {
        const li = document.createElement('li');
        li.className = 'list-group-item sugerencia-item seleccionar-producto';
        li.dataset.id = String(p.id);
        li.dataset.nombre = p.nombre;
        li.dataset.precio = p.precio_venta;
        li.dataset.stock = p.stock || 0;
        li.textContent = `${p.nombre} (Stock: ${p.stock || 0})`;
        sugerencias.appendChild(li);
    });
}

function agregarOIncrementarProducto(producto) {
    producto.id = String(producto.id);
    const existente = carrito.find(p => p.id === producto.id);
    const cantidadActualEnCarrito = existente ? existente.cantidad : 0;
    const stockDisponible = producto.stock || 0;
    
    if (cantidadActualEnCarrito + 1 > stockDisponible) {
        Swal.fire({
            icon: 'warning',
            title: 'Stock insuficiente',
            text: `No hay suficiente stock para este producto. Stock disponible: ${stockDisponible}`,
            confirmButtonText: 'Entendido'
        });
        return;
    }
    
    if (existente) {
        existente.cantidad += 1;
    } else {
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: parseFloat(producto.precio || producto.precio_venta),
            cantidad: 1,
            stock: stockDisponible
        });
    }
    
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarCarrito();
    document.getElementById('buscarProducto').value = '';
    document.getElementById('buscarProducto').focus();
    document.getElementById('sugerencias').style.display = 'none';
}

function actualizarCarrito() {
    const container = document.getElementById('carritoContainer');
    container.innerHTML = '';
    let subtotal = 0;

    carrito.forEach(producto => {
        const totalProducto = producto.precio * producto.cantidad;
        subtotal += totalProducto;

        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${producto.nombre}</td>
            <td>
                <input type="number" 
                       class="precio-producto" 
                       data-id="${producto.id}" 
                       value="${producto.precio.toFixed(2)}" 
                       style="width: 80px; padding: 4px;">
            </td>
            <td>
                <input type="number" 
                       class="cantidad-producto text-center" 
                       data-id="${producto.id}" 
                       value="${producto.cantidad}" 
                       style="width: 70px; padding: 4px;">
            </td>
            <td class="text-end">${totalProducto.toFixed(2)}</td>
            <td>
                <button class="btn btn-danger btn-sm eliminar-producto" 
                        data-id="${producto.id}" 
                        title="Eliminar">🗑</button>
            </td>
        `;
        container.appendChild(fila);
    });

    const aplicarIgv = document.getElementById('aplicarIgv').checked;
    const igv = aplicarIgv ? subtotal * 0.18 : 0;
    const total = subtotal + igv;

    document.getElementById('subtotal').textContent = subtotal.toFixed(2);
    document.getElementById('igv').textContent = igv.toFixed(2);
    document.getElementById('total').textContent = total.toFixed(2);
    
    localStorage.setItem('carrito', JSON.stringify(carrito));
}

// ==================== CLIENTES ====================
function limpiarDatosCliente() {
    const campos = ['nombre_cliente', 'apellido_cliente', 'telefono_cliente', 'direccion_cliente', 'id_cliente'];
    campos.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.value = '';
    });
}

function limpiarCamposCompletos() {
    limpiarDatosCliente();
    
    const estadoElement = document.getElementById('estadoCliente');
    if (estadoElement) {
        estadoElement.textContent = '';
        estadoElement.className = '';
    }
}

function onTipoDocumentoChange() {
    limpiarDatosCliente();
    
    const numeroElement = document.getElementById('numero_documento');
    const numero = numeroElement ? numeroElement.value.trim() : '';
    
    if (numero) {
        buscarCliente();
    } else {
        const estadoElement = document.getElementById('estadoCliente');
        if (estadoElement) {
            estadoElement.textContent = '';
            estadoElement.className = '';
        }
    }
}

function onNumeroDocumentoChange() {
    const numeroElement = document.getElementById('numero_documento');
    const numero = numeroElement ? numeroElement.value.trim() : '';
    
    if (!numero) {
        limpiarCamposCompletos();
        return;
    }
    
    buscarCliente();
}

async function buscarCliente() {
    const tipoElement = document.getElementById('tipo_documento');
    const numeroElement = document.getElementById('numero_documento');
    const estadoElement = document.getElementById('estadoCliente');
    
    if (!tipoElement || !numeroElement || !estadoElement) return;
    
    const tipo = tipoElement.value;
    const numero = numeroElement.value.trim();
    
    if (!tipo || !numero) {
        limpiarDatosCliente();
        estadoElement.textContent = '';
        estadoElement.className = '';
        return;
    }

    estadoElement.textContent = '🔍 Buscando cliente...';
    estadoElement.className = 'text-info';

    try {
        const url = `/api/clientes/buscar?tipo_documento=${encodeURIComponent(tipo)}&numero_documento=${encodeURIComponent(numero)}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const cliente = await response.json();
        
        const camposCliente = {
            'nombre_cliente': cliente.nombre || '',
            'apellido_cliente': cliente.apellido || '',
            'telefono_cliente': cliente.telefono || '',
            'direccion_cliente': cliente.direccion || '',
            'id_cliente': cliente.id || ''
        };
        
        Object.entries(camposCliente).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) elemento.value = valor;
        });
        
        if (cliente.tieneCreditoPendiente) {
            estadoElement.textContent = '⚠️ Cliente con deuda pendiente.';
            estadoElement.className = 'text-warning';
        } else {
            estadoElement.textContent = '✅ Cliente encontrado.';
            estadoElement.className = 'text-success';
        }
        
    } catch (error) {
        estadoElement.textContent = '❌ Cliente no registrado. Se creará automáticamente.';
        estadoElement.className = 'text-danger';
        limpiarDatosCliente();
    }
}

// ==================== FINALIZAR VENTA ====================
async function finalizarVenta() {
    if (procesandoVenta) {
        console.warn('Ya hay una venta en proceso...');
        return;
    }

    if (carrito.length === 0) {
        mostrarAlerta('warning', 'Carrito vacío', 'Agregue productos antes de finalizar.');
        return;
    }

    if (!pagos.length) {
        mostrarAlerta('warning', 'Sin pagos', 'Debe registrar al menos un método de pago.');
        return;
    }

    const totalVenta = parseFloat(document.getElementById('total').textContent);
    const tipo_comprobante = document.getElementById('tipo_comprobante').value;
    const autoImprimir = document.getElementById('impresionAutomatica')?.checked || false;

    // ✅ Calcular efectivo recibido y vuelto correctamente
    const pagoEfectivo = pagos.find(p => p.codigo === 'EFECTIVO');
    const efectivoRecibido = pagoEfectivo ? (pagoEfectivo.monto_recibido || pagoEfectivo.monto) : 0;
    const vueltoCalculado = pagoEfectivo ? (pagoEfectivo.vuelto || 0) : 0;

    let vuelto;
    try {
        vuelto = validarPagos(totalVenta);
    } catch (e) {
        mostrarAlerta('warning', 'Error en pagos', e.message);
        return;
    }

    procesandoVenta = true;
    const btnFinalizar = document.getElementById('btnFinalizarVenta');
    if (btnFinalizar) {
        btnFinalizar.disabled = true;
        btnFinalizar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    }

    const ventaData = {
        id_cliente: document.getElementById('id_cliente').value || null,
        tipo_documento: document.getElementById('tipo_documento').value,
        numero_documento: document.getElementById('numero_documento').value.trim(),
        nombre: document.getElementById('nombre_cliente').value,
        apellido: document.getElementById('apellido_cliente').value,
        telefono: document.getElementById('telefono_cliente').value,
        direccion: document.getElementById('direccion_cliente').value,
        observaciones: document.getElementById('observaciones')?.value || '',
        productos: carrito,
        subtotal: parseFloat(document.getElementById('subtotal').textContent),
        igv: parseFloat(document.getElementById('igv').textContent),
        total: totalVenta,
        efectivo: efectivoRecibido,
        vuelto: vueltoCalculado, // ⭐ Usar el vuelto calculado
        tipo_comprobante: tipo_comprobante
    };

    try {
        // Paso 1: Guardar la Venta
        const resVenta = await fetch('/api/guardar-comprobantes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ventaData)
        });

        if (!resVenta.ok) throw new Error('Error al guardar el comprobante');
        const resultVenta = await resVenta.json();

        // Paso 2: Guardar los Métodos de Pago
        const resPagos = await fetch('/api/pagos-venta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                venta_id: resultVenta.id_venta,
                pagos: pagos.map(p => ({
                    metodo_pago_id: p.metodo_pago_id,
                    monto: p.monto, // ⭐ Aquí se guarda solo lo que cubre la deuda
                    referencia: p.referencia || null
                }))
            })
        });

        if (!resPagos.ok) throw new Error('Error al registrar los pagos');
        const resultPagos = await resPagos.json();

        // ✅ Estructura para impresión con vuelto correcto
        window.ventaRegistrada = {
            productos: ventaData.productos,
            subtotal: ventaData.subtotal,
            igv: ventaData.igv,
            total: ventaData.total,
            efectivo: efectivoRecibido, // ⭐ Monto que entregó el cliente
            vuelto: vueltoCalculado, // ⭐ Vuelto a devolver
            id: resultVenta.id_venta,
            codigo: resultVenta.codigo_venta,
            fecha: resultVenta.fecha || new Date().toISOString(),
            cliente: {
                nombre: resultVenta.cliente?.nombre || 'Cliente Genérico',
                numero_documento: resultVenta.cliente?.numero_documento || '-'
            },
            metodos_pago: pagos.map(p => ({
                nombre: p.nombre,
                monto: p.monto,
                referencia: p.referencia || null,
                monto_recibido: p.monto_recibido || null, // ⭐ Para mostrar en ticket
                vuelto: p.vuelto || 0 // ⭐ Para mostrar en ticket
            }))
        };

        // Paso 4: Impresión automática
        if (autoImprimir && typeof generarDocumento === 'function') {
            generarDocumento(tipo_comprobante);
        }

        // Paso 5: Éxito
     // Paso 5: Éxito
        await Swal.fire({
            icon: 'success',
            title: '¡Venta Exitosa!',
            text: `Comprobante ${resultVenta.codigo} generado correctamente.`,
            timer: 2000,
            showConfirmButton: false
        });

        limpiarTodoPostVenta();
        
        // ⭐ Forzar focus en búsqueda de productos
        setTimeout(() => {
            const campoBusqueda = document.getElementById('buscarProducto');
            if (campoBusqueda) {
                campoBusqueda.focus();
            }
        }, 300);

    } catch (err) {
        console.error(err);
        Swal.fire({
            icon: 'error',
            title: 'Error Crítico',
            text: err.message || 'No se pudo completar la operación.'
        });
    } finally {
        procesandoVenta = false;
        if (btnFinalizar) {
            btnFinalizar.disabled = false;
            btnFinalizar.textContent = 'Finalizar Venta (F7)';
        }
    }
}

function limpiarTodoPostVenta() {
    carrito = [];
    pagos = [];
    localStorage.removeItem('carrito');
    actualizarCarrito();
    limpiarFormularioVenta();
    document.getElementById('buscarProducto').focus();
}

function limpiarFormularioVenta() {
    pagos = [];
    
    const tablaPagos = document.getElementById('tablaPagos');
    if (tablaPagos) {
        tablaPagos.innerHTML = '';
    }
    
    const totalPagadoElement = document.getElementById('totalPagado');
    if (totalPagadoElement) {
        totalPagadoElement.textContent = '0.00';
    }
    
    const metodoPagoSelect = document.getElementById('metodo_pago');
    if (metodoPagoSelect) {
        metodoPagoSelect.selectedIndex = 1;
    }
    
    const montoPagoInput = document.getElementById('monto_pago');
    if (montoPagoInput) {
        montoPagoInput.value = '';
    }
    
    const referenciaPagoInput = document.getElementById('referencia_pago');
    if (referenciaPagoInput) {
        referenciaPagoInput.value = '';
    }
    const divReferencia = document.getElementById('div_referencia');
    if (divReferencia) {
        divReferencia.style.display = 'none';
    }
    
    document.getElementById('tipo_documento').value = 'DNI';
    document.getElementById('numero_documento').value = '';
    
    const camposCliente = ['nombre_cliente', 'apellido_cliente', 'telefono_cliente', 'direccion_cliente', 'id_cliente'];
    camposCliente.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.value = '';
    });
    
    const estadoElement = document.getElementById('estadoCliente');
    if (estadoElement) {
        estadoElement.textContent = '';
        estadoElement.className = '';
    }

    const efectivoInput = document.getElementById('efectivo');
    if (efectivoInput) {
        efectivoInput.value = '';
    }
    
    const vueltoInput = document.getElementById('vuelto');
    if (vueltoInput) {
        vueltoInput.value = '';
    }

    const aplicarIgvCheckbox = document.getElementById('aplicarIgv');
    if (aplicarIgvCheckbox) {
        aplicarIgvCheckbox.checked = false;
    }

    const sugerenciasElement = document.getElementById('sugerencias');
    if (sugerenciasElement) {
        sugerenciasElement.style.display = 'none';
    }

    const buscarProductoInput = document.getElementById('buscarProducto');
    if (buscarProductoInput) {
        buscarProductoInput.value = '';
    }
    
    const btnFinalizar = document.getElementById('btnFinalizarVenta');
    if (btnFinalizar) {
        btnFinalizar.disabled = true;
    }
    
    document.getElementById('subtotal').textContent = '0.00';
    document.getElementById('igv').textContent = '0.00';
    document.getElementById('total').textContent = '0.00';
    
    const observacionesInput = document.getElementById('observaciones');
    if (observacionesInput) {
        observacionesInput.value = '';
    }
    
    localStorage.removeItem('carrito');
    window.ventaRegistrada = null;
}

// ==================== PROFORMA ====================
async function generarProformaCompleta() {
    if (carrito.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Carrito vacío',
            text: 'No hay productos en el carrito para generar la proforma',
            confirmButtonText: 'Entendido'
        });
        return;
    }

    const tipoDoc = document.getElementById('tipo_documento').value;
    const numeroDoc = document.getElementById('numero_documento').value.trim();
        
    if (!numeroDoc) {
        Swal.fire({
            icon: 'warning',
            title: 'Documento requerido',
            text: 'Debe ingresar Datos del Cliente para generar la proforma',
            confirmButtonText: 'Entendido'
        });
        return;
    }

    const fechaValidez = new Date();
    fechaValidez.setDate(fechaValidez.getDate() + 7);

    const proforma = {
        numero_comprobante: generarCodigoProforma(),
        fecha_validez: fechaValidez.toISOString().split('T')[0],
        subtotal: parseFloat(document.getElementById('subtotal').textContent),
        igv: parseFloat(document.getElementById('igv').textContent),
        total: parseFloat(document.getElementById('total').textContent),
        id_cliente: document.getElementById('id_cliente').value || null,
        tipo_documento: tipoDoc,
        numero_documento: numeroDoc,
        nombre_cliente: document.getElementById('nombre_cliente').value || '',
        observaciones: document.getElementById('observaciones')?.value || '',
        tipo_proforma: 'proforma',
        productos: carrito.map(p => ({
            id: p.id,
            nombre: p.nombre,
            precio: p.precio,
            cantidad: p.cantidad
        }))
    };

    try {
        Swal.fire({
            title: 'Guardando proforma...',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            willOpen: () => {
                Swal.showLoading();
            }
        });

        const response = await fetch('/api/proformas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(proforma)
        });

        const responseText = await response.text();
        let result;
        
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            throw new Error('La respuesta del servidor no es un JSON válido');
        }

        if (!response.ok || result.success === false) {
            throw new Error(result.message || `Error del servidor: ${response.status}`);
        }

        Swal.fire({
            icon: 'success',
            title: 'Proforma guardada',
            text: 'La proforma se ha guardado correctamente',
            timer: 2000,
            showConfirmButton: false
        });

        window.proformaGenerada = {
            ...proforma,
            numero_comprobante: result.numero_comprobante || result.data?.numero_comprobante || proforma.numero_comprobante,
            fecha: result.fecha_emision || result.data?.fecha_emision || new Date().toISOString(),
            id: result.id || result.data?.id,
            cliente: {
                nombre: document.getElementById('nombre_cliente').value || 'Cliente Genérico',
                numero_documento: numeroDoc,
                tipo_documento: tipoDoc
            }
        };

        setTimeout(() => {
            try {
                if (typeof generarProformaPDF === 'undefined') {
                    throw new Error('La función generarProformaPDF no está disponible');
                }
                
                if (!window.proformaGenerada) {
                    throw new Error('No hay datos de proforma disponibles');
                }
                
                generarProformaPDF();
                
            } catch (pdfError) {
                console.error('Error al generar PDF:', pdfError);
            }
        }, 1000);

        carrito = [];
        localStorage.removeItem('carrito');
        actualizarCarrito();
        limpiarFormularioVenta();

    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error al procesar proforma',
            text: error.message || 'No se pudo procesar la proforma',
            confirmButtonText: 'Reintentar'
        });
    }
}

function generarCodigoProforma() {
    return 'PRO-' + Date.now();
}

// ==================== FUNCIONES AUXILIARES HTML ====================
function actualizarEfectivo(monto) {
    const montoPagoInput = document.getElementById('monto_pago');
    if (montoPagoInput) {
        montoPagoInput.value = monto.toFixed(2);
    }
}
function limpiarEfectivo() {
    const montoPagoInput = document.getElementById('monto_pago');
    if (montoPagoInput) {
        montoPagoInput.value = '';
    }
}