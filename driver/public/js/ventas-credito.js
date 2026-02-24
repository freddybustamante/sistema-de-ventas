// Agrega en tu HTML antes de este script:
// <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>

document.addEventListener("DOMContentLoaded", () => {
  let carrito = [];

  // Elementos DOM
  const modoBusqueda = document.getElementById("modoBusqueda");
  const buscarProducto = document.getElementById("buscarProducto");
  const sugerencias = document.getElementById("sugerencias");

  const nombreCliente = document.getElementById("nombreCliente");
  const apellidoCliente = document.getElementById("apellidoCliente");
  const tipoDocumento = document.getElementById("tipo_documento");
  const numeroDocumento = document.getElementById("numero_documento");
  const telefonoCliente = document.getElementById("telefonoCliente");
  const direccionCliente = document.getElementById("direccionCliente");
  const clienteCreditoInput = document.getElementById("clienteCredito");
  const mensajeClienteNuevo = document.getElementById("mensajeClienteNuevo");
  const estadoCliente = document.getElementById("estadoCliente");

  const subtotalElem = document.getElementById("subtotal");
  const igvElem = document.getElementById("igv");
  const totalElem = document.getElementById("total");
  const aplicarIgv = document.getElementById("aplicarIgv");
  const carritoContainer = document.getElementById("carritoContainer");
  const btnGuardarVentaCredito = document.getElementById("btnGuardarVentaCredito");

  const IGV_RATE = 0.18;

  // Buscar producto por nombre o código
  async function buscarSugerencias(query) {
    if (!query || query.trim() === "") {
      sugerencias.style.display = "none";
      sugerencias.innerHTML = "";
      return;
    }
  
    const modo = modoBusqueda.value;
  
    if (modo === "codigo" && query.trim().length < 3) {
      sugerencias.style.display = "none";
      sugerencias.innerHTML = "";
      return;
    }
  
    let url = modo === "codigo"
      ? "/api/productos-credito/codigo/" + encodeURIComponent(query)
      : "/api/productos-credito/buscar?nombre=" + encodeURIComponent(query);
  
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Error en la búsqueda. Status: " + resp.status);
  
      let productos = modo === "codigo" ? [await resp.json()] : await resp.json();
      productos = productos.filter(Boolean);
  
      if (!productos.length) {
        sugerencias.style.display = "none";
        sugerencias.innerHTML = "";
        return;
      }
  
      if (modo === "codigo" && productos.length === 1) {
        agregarAlCarrito(formatearProducto(productos[0]));
        buscarProducto.value = "";
        sugerencias.style.display = "none";
        return;
      }
  
      sugerencias.innerHTML = "";
      productos.forEach((producto) => {
        const li = document.createElement("li");
        li.classList.add("list-group-item", "list-group-item-action");
        li.textContent = `${producto.nombre} - S/ ${parseFloat(producto.precio_venta).toFixed(2)}`;
        li.dataset.id = producto.id;
        li.dataset.nombre = producto.nombre;
        li.dataset.precio = producto.precio_venta;
        li.dataset.stock = producto.stock;
        li.dataset.codigo = producto.codigo_barras || "";
        sugerencias.appendChild(li);
      });
  
      sugerencias.style.display = "block";
    } catch (error) {
      console.error("Error en la búsqueda:", error);
      sugerencias.style.display = "none";
      sugerencias.innerHTML = "";
    }
  }
  
  function formatearProducto(data) {
    if (typeof data.get === "function" || typeof data.id === "string") {
      return {
        id: parseInt(data.id),
        nombre: data.nombre,
        precio: parseFloat(data.precio),
        stock: parseInt(data.stock),
        codigo_barras: data.codigo || ""
      };
    }
  
    return {
      id: data.id || data.id_producto,
      nombre: data.nombre,
      precio: parseFloat(data.precio || data.precio_venta),
      stock: data.stock,
      codigo_barras: data.codigo_barras || data.codigo_barra || ""
    };
  }
  
  function agregarAlCarrito(producto) {
    const existente = carrito.find((p) => p.id === producto.id);
    if (existente) {
      if (existente.cantidad + 1 > producto.stock) {
        Swal.fire("Stock insuficiente", "No hay suficiente stock para este producto.", "warning");
        return;
      }
      existente.cantidad++;
    } else {
      if (producto.stock <= 0) {
        Swal.fire("Sin stock", "Producto sin stock disponible.", "error");
        return;
      }
      carrito.push({ ...producto, cantidad: 1 });
    }
    actualizarCarrito();
  }

  function actualizarCarrito() {
    carritoContainer.innerHTML = `
      <thead>
        <tr>
          <th>Producto</th>
          <th>Precio</th>
          <th>Cantidad</th>
          <th>Total</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = carritoContainer.querySelector("tbody");

    carrito.forEach((prod, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${prod.nombre}</td>
        <td>S/ ${prod.precio.toFixed(2)}</td>
<td>
  <input 
    type="number" 
    min="1" 
    max="${prod.stock}" 
    step="1" 
    value="${prod.cantidad}" 
    data-index="${idx}" 
    class="cantidad-input form-control form-control-sm">
</td>
        <td>S/ ${(prod.precio * prod.cantidad).toFixed(2)}</td>
        <td><button class="btn btn-danger btn-sm btn-eliminar" data-index="${idx}">Eliminar</button></td>
      `;
      tbody.appendChild(tr);
    });

    calcularTotales();
  }

  function calcularTotales() {
    const subtotal = carrito.reduce((acc, p) => acc + p.precio * p.cantidad, 0);
    const igv = aplicarIgv.checked ? subtotal * IGV_RATE : 0;
    const total = subtotal + igv;

    subtotalElem.textContent = subtotal.toFixed(2);
    igvElem.textContent = igv.toFixed(2);
    totalElem.textContent = total.toFixed(2);
  }

  async function buscarCliente() {
    const tipo = tipoDocumento.value;
    const numero = numeroDocumento.value;
  
    nombreCliente.value = "";
    apellidoCliente.value = "";
    telefonoCliente.value = "";
    direccionCliente.value = "";
    clienteCreditoInput.dataset.idCliente = "";
    estadoCliente.textContent = "";
    estadoCliente.classList.remove("text-success", "text-danger");
    mensajeClienteNuevo.style.display = "none";
  
    if (!tipo || !numero) {
      Swal.fire("Datos incompletos", "Ingrese o busque un cliente.", "warning");
      return;
    }
  
    try {
      const res = await fetch(`/api/ventas-credito/buscar?tipo_documento=${encodeURIComponent(tipo)}&numero_documento=${encodeURIComponent(numero)}`);
      const data = await res.json();
  
      if (data.length > 0) {
        const cliente = data[0];
        nombreCliente.value = cliente.nombre || "";
        apellidoCliente.value = cliente.apellido || "";
        telefonoCliente.value = cliente.telefono || "";
        direccionCliente.value = cliente.direccion || "";
        clienteCreditoInput.dataset.idCliente = cliente.id || "";
  
        estadoCliente.textContent = "✅ Cliente existente cargado.";
        estadoCliente.classList.add("text-success");
      } else {
        estadoCliente.textContent = "⚠️ Cliente no registrado. Se creará nuevo.";
        estadoCliente.classList.add("text-danger");
        mensajeClienteNuevo.style.display = "block";
      }
    } catch (err) {
      console.error("Error al buscar cliente:", err);
      Swal.fire("Error", "Ocurrió un error al buscar el cliente.", "error");
    }
  }

  // Eventos
  buscarProducto.addEventListener("input", (e) => buscarSugerencias(e.target.value));

  buscarProducto.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      const first = sugerencias.querySelector("li.list-group-item");
      if (first) {
        agregarAlCarrito(formatearProducto(first.dataset));
        sugerencias.style.display = "none";
        buscarProducto.value = "";
      }
    }
  });

  buscarProducto.addEventListener("blur", () => {
    setTimeout(() => sugerencias.style.display = "none", 150);
  });

  modoBusqueda.addEventListener("change", () => {
    buscarProducto.value = "";
    sugerencias.style.display = "none";
    sugerencias.innerHTML = "";
  });

  sugerencias.addEventListener("click", (e) => {
    if (e.target && e.target.matches("li.list-group-item")) {
      agregarAlCarrito(formatearProducto(e.target.dataset));
      buscarProducto.value = "";
      sugerencias.style.display = "none";
    }
  });

 carritoContainer.addEventListener("input", (e) => {
  if (e.target.classList.contains("cantidad-input")) {
    const idx = parseInt(e.target.dataset.index);
    let nueva = parseInt(e.target.value);

    if (isNaN(nueva) || nueva < 1) nueva = 1;
    if (nueva > carrito[idx].stock) {
      Swal.fire("Stock insuficiente", `Solo hay ${carrito[idx].stock} unidades disponibles.`, "warning");
      nueva = carrito[idx].stock;
      e.target.value = nueva;
    }

    carrito[idx].cantidad = nueva;

    // Actualizar solo el total de esa fila
    const fila = e.target.closest("tr");
    fila.querySelector("td:nth-child(4)").textContent =
      `S/ ${(carrito[idx].precio * carrito[idx].cantidad).toFixed(2)}`;

    // Actualizar resumen
    calcularTotales();
  }
});


  carritoContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-eliminar")) {
      const idx = parseInt(e.target.dataset.index);
      carrito.splice(idx, 1);
      actualizarCarrito();
    }
  });

  aplicarIgv.addEventListener("change", calcularTotales);

  numeroDocumento.addEventListener("blur", buscarCliente);
  tipoDocumento.addEventListener("change", buscarCliente);
  // lo que sigue abajo de pende del archivo imprimir-doc-dinamicos.js
//se modifico para IMprimir ventas al credito la otra parte 

 btnGuardarVentaCredito.addEventListener("click", async () => {
  if (carrito.length === 0) {
    Swal.fire("Carrito vacío", "Agrega productos al carrito.", "warning");
    return;
  }

  const nombre = nombreCliente.value.trim();
  const apellido = apellidoCliente.value.trim();
  const tipoDoc = tipoDocumento.value;
  const numeroDoc = numeroDocumento.value.trim();
  const telefono = telefonoCliente.value.trim();
  const direccion = direccionCliente.value.trim();
  const idCliente = clienteCreditoInput.dataset.idCliente || null;

  if (!nombre || !tipoDoc || !numeroDoc) {
    Swal.fire("Datos incompletos", "Por favor completa los datos del cliente.", "warning");
    return;
  }

  const productos = carrito.map(p => ({
    id: p.id,
    cantidad: p.cantidad,
    precio: p.precio,
    nombre: p.nombre // Agregar nombre del producto para la impresión
  }));

  const venta = {
    cliente: {
      id: idCliente,
      nombre,
      apellido,
      tipo_documento: tipoDoc,
      numero_documento: numeroDoc,
      telefono,
      direccion
    },
    productos,
    aplicar_igv: aplicarIgv.checked
  };

  try {
    const res = await fetch("/api/ventas-credito/registrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(venta)
    });

    const resultado = await res.json();

    if (!res.ok) {
      console.error("Error al registrar venta:", resultado);
      Swal.fire("Error", resultado.message || "Error desconocido", "error");
      return;
    }

    // ✅ VENTA REGISTRADA EXITOSAMENTE
    
    // Preparar datos para la impresión
    const subtotal = carrito.reduce((acc, p) => acc + p.precio * p.cantidad, 0);
    const igv = aplicarIgv.checked ? subtotal * 0.18 : 0;
    const total = subtotal + igv;
    
    // Crear objeto con todos los datos necesarios para la impresión
    window.ventaCreditoRegistrada = {
      id: resultado.id || resultado.venta_id,
      codigo: resultado.codigo || `VC-${Date.now()}`, // Usar código del servidor o generar uno
      fecha: new Date().toISOString(),
      cliente: {
        nombre: nombre,
        apellido: apellido,
        tipo_documento: tipoDoc,
        numero_documento: numeroDoc,
        telefono: telefono,
        direccion: direccion
      },
      productos: carrito.map(p => ({
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        cantidad: p.cantidad
      })),
      subtotal: subtotal,
      igv: igv,
      total: total,
      aplicar_igv: aplicarIgv.checked
    };

    // Mostrar mensaje de éxito con opciones
    Swal.fire({
      title: 'Éxito',
      text: 'Venta registrada correctamente.',
      icon: 'success',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#6c757d',
      confirmButtonText: '🖨️ Imprimir Comprobante',
      cancelButtonText: 'Cerrar'
    }).then((result) => {
      if (result.isConfirmed) {
        // Verificar si existe la función de impresión
        if (typeof generarComprobanteCredito === 'function') {
          generarComprobanteCredito();
        } else {
          console.error('Función generarComprobanteCredito no encontrada');
          Swal.fire('Error', 'Sistema de impresión no disponible', 'error');
        }
      }
    });

    // Limpiar el carrito y formulario
    carrito = [];
    actualizarCarrito();

    nombreCliente.value = "";
    apellidoCliente.value = "";
    tipoDocumento.value = "";
    numeroDocumento.value = "";
    telefonoCliente.value = "";
    direccionCliente.value = "";
    clienteCreditoInput.dataset.idCliente = "";
    estadoCliente.textContent = "";
    mensajeClienteNuevo.style.display = "none";

  } catch (err) {
    console.error("Error al guardar la venta:", err);
    Swal.fire("Error", "Ocurrió un error al guardar la venta: " + err.message, "error");
  }
});

// Función auxiliar para reimprimir venta a crédito (opcional)
window.reimprimirVentaCredito = function(ventaId) {
  // Esta función se puede usar para reimprimir desde otras partes del sistema
  fetch(`/api/ventas-credito/${ventaId}`)
    .then(response => response.json())
    .then(venta => {
      window.ventaCreditoRegistrada = venta;
      if (typeof generarComprobanteCredito === 'function') {
        generarComprobanteCredito();
      }
    })
    .catch(error => {
      console.error('Error al cargar venta para reimpresión:', error);
      Swal.fire('Error', 'No se pudo cargar la venta para imprimir', 'error');
    });
};
});
