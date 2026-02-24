document.addEventListener('DOMContentLoaded', function () {
  let carrito = JSON.parse(localStorage.getItem('carrito')) || [];
  carrito = carrito.filter(p => p && typeof p.precio === 'number' && typeof p.cantidad === 'number');

  function iniciarCarrito() {
    function formatearStock(stock) {
      return stock % 1 === 0 ? stock.toFixed(0) : stock.toFixed(2);
    }

    function actualizarCarrito() {
      const carritoContainer = document.getElementById('carritoContainer');
      carritoContainer.innerHTML = '';
      let subtotal = 0;
      
      carrito.forEach(producto => {
        const totalProducto = producto.precio * producto.cantidad;
        subtotal += totalProducto;
        const fila = `
            <tr>
              <td class="col-producto" data-label="Producto" title="${producto.nombre}">${producto.nombre}</td>
              <td class="col-precio" data-label="Precio">S/ ${producto.precio.toFixed(2)}</td>
              <td class="col-cantidad" data-label="Cantidad">
                <input type="number" class="cantidad-producto form-control form-control-sm" data-id="${producto.id}"
                       value="${formatearStock(producto.cantidad)}" min="0.1" step="0.1">
              </td>
              <td class="col-total" data-label="Total">S/ ${totalProducto.toFixed(2)}</td>
              <td class="col-acciones">
                <button class="btn btn-danger btn-sm btn-eliminar eliminar-producto" data-id="${producto.id}" title="Eliminar producto">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          `;
        carritoContainer.innerHTML += fila;
      });

      const aplicarIgvEl = document.getElementById('aplicarIgv');
      const aplicarIgv = aplicarIgvEl.checked;
      const igv = aplicarIgv ? subtotal * 0.18 : 0;
      const total = subtotal + igv;
      
      document.getElementById('subtotal').textContent = subtotal.toFixed(2);
      document.getElementById('igv').textContent = igv.toFixed(2);
      document.getElementById('total').textContent = total.toFixed(2);
      localStorage.setItem('carrito', JSON.stringify(carrito));
      
      if (document.activeElement) {
        document.activeElement.blur();
      }
      if (!['buscarProducto', 'efectivo'].includes(document.activeElement?.id)) {
        if (document.activeElement) {
          document.activeElement.blur();
        }
      }
    }

    // Función auxiliar para agregar o incrementar producto en el carrito
    function agregarOIncrementarProducto(producto) {
      const productoExistente = carrito.find(p => p.id === producto.id);
      if (!productoExistente) {
        carrito.push({
          id: producto.id,
          nombre: producto.nombre,
          precio: parseFloat(producto.precio || producto.precio_venta),
          cantidad: 1
        });
      } else {
        productoExistente.cantidad += 1;
      }
      actualizarCarrito();
      
      const buscarProductoEl = document.getElementById('buscarProducto');
      buscarProductoEl.value = '';
      buscarProductoEl.focus();
      document.getElementById('sugerencias').style.display = 'none';
    }

    // Event listener para búsqueda con Enter
    const buscarProductoEl = document.getElementById('buscarProducto');
    if (buscarProductoEl) {
      buscarProductoEl.addEventListener('keypress', function (e) {
        if (e.which === 13) {
          e.preventDefault();
          const termino = this.value.trim();
          if (termino.length > 0) {
            fetch('/api/productos/buscar?termino=' + encodeURIComponent(termino))
              .then(response => response.json())
              .then(productos => {
                const productosConStock = productos.filter(p => p.stock > 0);

                // Si encontramos un único producto y su código de barras coincide exactamente
                if (productosConStock.length === 1 && productosConStock[0].codigo_barras === termino) {
                  agregarOIncrementarProducto(productosConStock[0]);
                } else {
                  // Si no es un código de barras exacto, o hay múltiples resultados, mostrar sugerencias
                  mostrarSugerencias(productosConStock);
                }
              })
              .catch(error => {
                Swal.fire({
                  icon: 'error',
                  title: 'Error en la búsqueda',
                  text: 'No se pudo realizar la búsqueda. Inténtalo de nuevo.',
                  confirmButtonColor: '#dc3545'
                });
              });
          }
        }
      });

      // Event listener para búsqueda con keyup
      buscarProductoEl.addEventListener('keyup', function (e) {
        // Ignorar el evento keyup si la tecla es Enter, ya lo manejamos en keypress
        if (e.which === 13) {
          return;
        }

        let termino = this.value.trim();

        if (termino.length === 0) {
          document.getElementById('sugerencias').style.display = 'none';
          return;
        }

        fetch('/api/productos/buscar?termino=' + encodeURIComponent(termino))
          .then(response => response.json())
          .then(productos => {
            const productosConStock = productos.filter(producto => producto.stock > 0);

            if (productosConStock.length === 0) {
              document.getElementById('sugerencias').style.display = 'none';
              return;
            }

            // Si fue búsqueda por nombre (o múltiples resultados)
            mostrarSugerencias(productosConStock);
          })
          .catch(error => {
            Swal.fire({
              icon: 'warning',
              title: 'Error de conexión',
              text: 'No se pudo conectar con el servidor para buscar productos.',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3000
            });
          });
      });
    }

    function mostrarSugerencias(productosConStock) {
      const sugerenciasEl = document.getElementById('sugerencias');
      sugerenciasEl.innerHTML = '';
      
      productosConStock.forEach(producto => {
        const sugerencia = `
            <li class="list-group-item seleccionar-producto"
                data-id="${producto.id}"
                data-nombre="${producto.nombre}"
                data-precio="${producto.precio_venta}">
              ${producto.nombre}
            </li>
          `;
        sugerenciasEl.innerHTML += sugerencia;
      });
      sugerenciasEl.style.display = 'block';
    }

    // Event delegation para elementos dinámicos
    document.addEventListener('change', function(e) {
      if (e.target.classList.contains('cantidad-producto')) {
        const idProducto = e.target.getAttribute('data-id');
        const cantidad = parseFloat(e.target.value);
        const producto = carrito.find(p => p.id == idProducto);
        if (producto && !isNaN(cantidad)) {
          producto.cantidad = cantidad;
          e.target.value = formatearStock(cantidad);
          actualizarCarrito();
        }
      }
    });

    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('seleccionar-producto')) {
        const producto = {
          id: e.target.getAttribute('data-id'),
          nombre: e.target.getAttribute('data-nombre'),
          precio: parseFloat(e.target.getAttribute('data-precio')),
          cantidad: 1
        };
        agregarOIncrementarProducto(producto);
        const efectivoEl = document.getElementById('efectivo');
        if (efectivoEl) efectivoEl.focus();
      }

      if (e.target.classList.contains('agregar-carrito')) {
        e.stopPropagation();
        const parentLi = e.target.closest('.seleccionar-producto');
        const producto = {
          id: parentLi.getAttribute('data-id'),
          nombre: parentLi.getAttribute('data-nombre'),
          precio: parseFloat(parentLi.getAttribute('data-precio')),
          cantidad: 1
        };
        agregarOIncrementarProducto(producto);
        const efectivoEl = document.getElementById('efectivo');
        if (efectivoEl) efectivoEl.focus();
      }

      if (e.target.classList.contains('eliminar-producto')) {
        const idProducto = e.target.getAttribute('data-id');
        const producto = carrito.find(p => p.id == idProducto);
        
        Swal.fire({
          title: '¿Eliminar producto?',
          text: `¿Estás seguro de eliminar "${producto?.nombre || 'este producto'}" del carrito?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#dc3545',
          cancelButtonColor: '#6c757d',
          confirmButtonText: 'Sí, eliminar',
          cancelButtonText: 'Cancelar'
        }).then((result) => {
          if (result.isConfirmed) {
            carrito = carrito.filter(producto => producto.id != idProducto);
            actualizarCarrito();
            
            Swal.fire({
              icon: 'success',
              title: 'Producto eliminado',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 2000
            });
          }
        });
      }
    });

    // Event listener para efectivo
    const efectivoEl = document.getElementById('efectivo');
    if (efectivoEl) {
      efectivoEl.addEventListener('input', function () {
        const efectivo = parseFloat(this.value);
        const total = parseFloat(document.getElementById('total').textContent);
        const vuelto = efectivo - total;
        const vueltoEl = document.getElementById('vuelto');
        
        if (isNaN(vuelto)) {
          vueltoEl.value = "Ingrese un valor numérico";
          vueltoEl.style.color = 'black';
        } else if (vuelto < 0) {
          vueltoEl.value = "Faltan S/." + Math.abs(vuelto).toFixed(2);
          vueltoEl.style.color = 'red';
        } else {
          vueltoEl.value = vuelto.toFixed(2);
          vueltoEl.style.color = 'black';
        }
        
        if (!isNaN(efectivo) && efectivo >= total) {
          const btnFinalizarVenta = document.getElementById('btnFinalizarVenta');
          if (btnFinalizarVenta) btnFinalizarVenta.focus();
        }
      });
    }

    // Event listener para aplicar IGV
    const aplicarIgvEl = document.getElementById('aplicarIgv');
    if (aplicarIgvEl) {
      aplicarIgvEl.addEventListener('change', function () {
        actualizarCarrito();
      });
    }

    actualizarCarrito();

    // Event listener para finalizar venta
    const btnFinalizarVenta = document.getElementById('btnFinalizarVenta');
    if (btnFinalizarVenta) {
      btnFinalizarVenta.addEventListener('click', function () {
        const efectivo = parseFloat(document.getElementById('efectivo').value);
        const totalVenta = parseFloat(document.getElementById('total').textContent);
        
        if (isNaN(efectivo) || efectivo < totalVenta) {
          Swal.fire({
            icon: 'warning',
            title: 'Monto insuficiente',
            text: 'El monto en efectivo es insuficiente para completar la venta.',
            confirmButtonColor: '#ffc107'
          });
          return;
        }
        
        // Mostrar loading mientras se procesa la venta
        Swal.fire({
          title: 'Procesando venta...',
          text: 'Por favor espera mientras se registra la venta',
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
        
        const venta = {
          productos: carrito,
          subtotal: parseFloat(document.getElementById('subtotal').textContent),
          igv: parseFloat(document.getElementById('igv').textContent),
          total: totalVenta,
          efectivo: efectivo,
          vuelto: efectivo - totalVenta
        };
        
        fetch('/api/ventas', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(venta)
        })
        .then(response => response.json())
        .then(response => {
          Swal.fire({
            icon: 'success',
            title: '¡Venta registrada!',
            text: response.mensaje,
            confirmButtonColor: '#28a745'
          });
          
          const opcionesDocumento = document.getElementById('opcionesDocumento');
          if (opcionesDocumento) opcionesDocumento.style.display = 'block';
          
          window.ventaRegistrada = {
            id: response.id_venta,
            total: venta.total,
            fecha: new Date().toLocaleString(),
            productos: carrito
          };
          
          carrito = [];
          localStorage.removeItem('carrito');
          actualizarCarrito();
          document.getElementById('efectivo').value = '';
          document.getElementById('vuelto').value = '';
          const buscarProductoEl = document.getElementById('buscarProducto');
          if (buscarProductoEl) buscarProductoEl.focus();
        })
        .catch(xhr => {
          xhr.text().then(responseText => {
            try {
              const respuesta = JSON.parse(responseText);
              
              if (respuesta.mensaje.includes("Stock insuficiente")) {
                Swal.fire({
                  icon: 'error',
                  title: 'Stock insuficiente',
                  html: respuesta.mensaje.replace(/\n/g, '<br>'),
                  confirmButtonColor: '#dc3545'
                });
                
                const mensajeErrorStock = document.getElementById('mensaje-error-stock');
                if (mensajeErrorStock) {
                  mensajeErrorStock.innerHTML = respuesta.mensaje;
                  mensajeErrorStock.style.display = 'block';
                }
                return;
              }
            } catch (e) {
              Swal.fire({
                icon: 'error',
                title: 'Error del servidor',
                text: 'Ocurrió un error inesperado. Por favor, intenta nuevamente.',
                confirmButtonColor: '#dc3545'
              });
            }
          }).catch(() => {
            Swal.fire({
              icon: 'error',
              title: 'Error de conexión',
              text: 'No se pudo conectar con el servidor. Verifica tu conexión e intenta nuevamente.',
              confirmButtonColor: '#dc3545'
            });
          });
          
          const mensajeErrorStock = document.getElementById('mensaje-error-stock');
          if (mensajeErrorStock) {
            mensajeErrorStock.innerHTML = '⚠️ Error al registrar la venta. Intente nuevamente.';
            mensajeErrorStock.style.display = 'block';
          }
        });
      });
    }
  }

  iniciarCarrito();

  function generarDocumento(tipo) {
    const htmlDocumento = `
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${tipo.toUpperCase()}</title>
            <style>
              @page { margin: 0; }
              body {
                font-family: Arial, sans-serif;
                font-size: 14px;
                width: 80mm;
                margin: 0;
                padding: 0;
              }
              .ticket-container {
                width: 80mm;
                margin: 0 auto;
              }
              .center { text-align: center; }
              .right { text-align: right; }
              .separator { border-top: 1px dashed #000; margin: 2mm 0; }
              table { width: 100%; border-collapse: collapse; }
              th, td { padding: 1mm; word-wrap: break-word; }

              .total-display {
                font-size: 14px;
                font-weight: bold;
              }

              .company-name {
                font-size: 14px;
                font-weight: bold;
              }
              .company-info {
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="ticket-container">
              <div class="center">
                <strong class="company-name">GBTECH SAC</strong><br>
                <span class="company-info">AV Marco Puente Llanos</span><br>
                <span class="company-info">RUC: 20450069723</span><br>
                <span class="company-info">Tel: 940644849</span>
              </div>
              <div class="separator"></div>
              <table>
                <thead>
                  <tr>
                    <th>Cant.</th>
                    <th>Producto</th>
                    <th>P.U.</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${window.ventaRegistrada.productos.map(prod => `
                    <tr>
                      <td class="center">${prod.cantidad.toFixed(2)}</td>
                      <td>${prod.nombre}</td>
                      <td class="right">${prod.precio.toFixed(2)}</td>
                      <td class="right">${(prod.cantidad * prod.precio).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div class="separator"></div>
              <div class="right total-display"> <strong>TOTAL: ${window.ventaRegistrada.total.toFixed(2)}</strong>
              </div>
              <div class="center" style="margin-top:2mm;">
                www.gbtech.com.pe
              </div>
            </div>
          </body>
        </html>
      `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.open();
    printWindow.document.write(htmlDocumento);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = function () {
      printWindow.print();
      printWindow.close();
    };

    // Mostrar notificación de documento generado
    Swal.fire({
      icon: 'info',
      title: 'Documento generado',
      text: `Se ha generado el ${tipo} y enviado a imprimir.`,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2500
    });
  }

  // Event listeners para teclas de función
  document.addEventListener('keydown', function (e) {
    if (e.which === 118) { // F7 para Finalizar Venta
      e.preventDefault();
      const btnFinalizarVenta = document.getElementById('btnFinalizarVenta');
      if (btnFinalizarVenta) btnFinalizarVenta.click();
    }
    if (window.ventaRegistrada) {
      if (e.which === 119) { // F8
        generarDocumento('boleta');
      } else if (e.which === 120) { // F9
        generarDocumento('factura');
      } else if (e.which === 121) { // F10
        generarDocumento('nota');
      }
    }
  });

  // Event listeners para botones de documentos
  document.addEventListener('click', function(e) {
    if (e.target.id === 'btnBoleta') {
      generarDocumento('boleta');
    }
    if (e.target.id === 'btnFactura') {
      generarDocumento('factura');
    }
    if (e.target.id === 'btnNotaVenta') {
      generarDocumento('nota');
    }
  });

  // Sistema de frases motivacionales
  const frases = [
    {
      texto: "Recuerda que la constancia, la atención al detalle y la pasión por ofrecer un buen servicio son fundamentales para el éxito a largo plazo de tu tienda de abarrotes.",
      icono: "bi-graph-up-arrow",
      color: "primary"
    },
    {
      texto: "Si tu comunidad lo utiliza, considera tener una presencia básica en redes sociales para anunciar ofertas o comunicar información relevante.",
      icono: "bi-share",
      color: "info"
    },
    {
      texto: "Si tu negocio es exitoso, podrías considerar abrir otra sucursal o expandir tu oferta de productos y servicios.",
      icono: "bi-shop",
      color: "success"
    },
    {
      texto: "Sé flexible y ajusta tu oferta y estrategias según las necesidades del mercado y la retroalimentación de los clientes.",
      icono: "bi-arrow-repeat",
      color: "warning"
    },
    {
      texto: "Mantente atento a los cambios en los hábitos de consumo y las nuevas demandas (productos orgánicos, sin gluten, etc.).",
      icono: "bi-eye",
      color: "secondary"
    },
    {
      texto: "Mantén tu tienda impecable. Un ambiente limpio y ordenado genera confianza.",
      icono: "bi-bucket",
      color: "primary"
    },
    {
      texto: "Asegúrate de que los productos más antiguos se vendan primero para evitar pérdidas.",
      icono: "bi-arrow-down-up",
      color: "danger"
    },
    {
      texto: "Busca proveedores confiables que ofrezcan buenos precios y entregas oportunas.",
      icono: "bi-truck",
      color: "info"
    },
    {
      texto: "Ten un fondo reservado para imprevistos (reparaciones, averías, etc.).",
      icono: "bi-piggy-bank",
      color: "warning"
    },
    {
      texto: "Identifica cuáles productos son más rentables y dales mayor visibilidad.",
      icono: "bi-star-fill",
      color: "success"
    },
    {
      texto: "Lleva un control detallado de ventas y costos para mejorar tus ganancias.",
      icono: "bi-journal-text",
      color: "dark"
    },
    {
      texto: "Capacita a tu personal para responder preguntas sobre los productos.",
      icono: "bi-person-lines-fill",
      color: "primary"
    },
    {
      texto: "Ofrece servicios extra como picar verduras o cortes especiales para fidelizar clientes.",
      icono: "bi-scissors",
      color: "info"
    },
    {
      texto: "Crea ofertas combinando productos a un precio inferior individual.",
      icono: "bi-tags",
      color: "success"
    },
    {
      texto: "Ofrece productos a granel para atraer a más clientes.",
      icono: "bi-basket",
      color: "warning"
    },
    {
      texto: "Incluye productos locales o artesanales para destacar frente a la competencia.",
      icono: "bi-geo-fill",
      color: "info"
    },
    {
      texto: "Incluye snacks, bebidas y productos de compra impulsiva cerca de la caja.",
      icono: "bi-cup-straw",
      color: "primary"
    },
    {
      texto: "Ofrece productos de limpieza, higiene personal y pan fresco para atraer más clientes.",
      icono: "bi-brush",
      color: "primary"
    },
    {
      texto: "Escucha a tus clientes. Sus sugerencias pueden mejorar mucho tu negocio.",
      icono: "bi-chat-dots",
      color: "secondary"
    },
    {
      texto: "Implementa seguridad: cámaras, espejos y control de acceso al almacén.",
      icono: "bi-shield-lock",
      color: "dark"
    },
    {
      texto: "Reconoce y recompensa el buen desempeño de tu equipo.",
      icono: "bi-award",
      color: "warning"
    },
    {
      texto: "Utiliza el espacio de forma óptima para mantener orden y eficiencia.",
      icono: "bi-layout-text-sidebar",
      color: "info"
    },
    {
      texto: "Optimiza tu personal en horarios clave para una mejor atención.",
      icono: "bi-person-check",
      color: "success"
    },
    {
      texto: "Investiga precios de la competencia y negocia con proveedores.",
      icono: "bi-search",
      color: "danger"
    },
    {
      texto: "Aplica estrategias de precios como terminar en .99 para incentivar compras.",
      icono: "bi-cash-coin",
      color: "primary"
    },
    {
      texto: "Un trato amable, rápido y eficiente marca la diferencia.",
      icono: "bi-hand-thumbs-up",
      color: "info"
    },
    {
      texto: "Promociona tu tienda con volantes, redes sociales o servicios adicionales como recargas o delivery.",
      icono: "bi-megaphone",
      color: "success"
    },
    {
      texto: "Reduce el desperdicio gestionando bien el inventario y dando descuentos a productos próximos a vencerse.",
      icono: "bi-exclamation-diamond",
      color: "warning"
    },
    {
      texto: "Recuerda revisar tu inventario al final del día.",
      icono: "bi-box-seam",
      color: "orange"
    },
    {
      texto: "Ofrece siempre una sonrisa, es gratis y fideliza.",
      icono: "bi-emoji-smile",
      color: "yellowgreen"
    },
    {
      texto: "Cada cliente es una oportunidad, escúchalo con atención.",
      icono: "bi-person-lines-fill",
      color: "#007bff"
    },
    {
      texto: "Controla tus gastos pequeños, se acumulan rápido.",
      icono: "bi-cash-stack",
      color: "#28a745"
    },
    {
      texto: "Aprende algo nuevo sobre tu negocio cada día.",
      icono: "bi-journal-richtext",
      color: "darkviolet"
    },
    {
      texto: "La constancia vale más que la perfección.",
      icono: "bi-hourglass-split",
      color: "#17a2b8"
    },
    {
      texto: "Celebra tus pequeñas victorias, ¡cuentan mucho!",
      icono: "bi-trophy",
      color: "gold"
    }
  ];

  const saludos = [
    "¡Hola!",
    "Buenos días,",
    "¡Bienvenido!",
    "¡Hola, campeón!",
    "¡Buen día, emprendedor!"
  ];

  const saludo = saludos[Math.floor(Math.random() * saludos.length)];
  const frase = frases[Math.floor(Math.random() * frases.length)];

  const contenidoFraseEl = document.getElementById('contenidoFrase');
  const iconoConsejoEl = document.getElementById('iconoConsejo');
  
  if (contenidoFraseEl) {
    contenidoFraseEl.textContent = `${saludo} ${frase.texto}`;
  }
  
  if (iconoConsejoEl) {
    iconoConsejoEl.className = `bi ${frase.icono} me-2`;
    iconoConsejoEl.style.color = frase.color;
  }
});

// Función externa para actualizar efectivo (se mantiene como estaba)
function actualizarEfectivo(monto) {
  const inputEfectivo = document.getElementById('efectivo');
  if (inputEfectivo) {
    inputEfectivo.value = monto;
    inputEfectivo.dispatchEvent(new Event('input'));
  }
}