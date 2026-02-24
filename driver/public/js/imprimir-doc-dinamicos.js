//imprmir-doc-dinamicos.js - Sistema completo de impresión con opciones configurables

// Variables globales
let datosNegocio = null;
let impresionAutomatica = true;

// Función para cargar datos del negocio
async function cargarDatosNegocio() {
    try {
        const response = await fetch('/api/negocio');
        if (response.ok) {
            datosNegocio = await response.json();
            
            // Precargar el logo para verificar si está disponible
            if (datosNegocio.empresa_logo) {
                precargarImagen(datosNegocio.empresa_logo).then(existe => {
                    if (!existe) {
                        console.warn('El logo no está disponible en la URL:', datosNegocio.empresa_logo);
                        datosNegocio.empresa_logo = null;
                    }
                });
            }
            
            // Precargar el QR también
            if (datosNegocio.empresa_qr) {
                precargarImagen(datosNegocio.empresa_qr).then(existe => {
                    if (!existe) {
                        console.warn('El QR no está disponible en la URL:', datosNegocio.empresa_qr);
                        datosNegocio.empresa_qr = null;
                    }
                });
            }
        } else {
            // Datos por defecto en caso de error
            datosNegocio = obtenerDatosPorDefecto();
        }
    } catch (error) {
        console.error('Error al cargar datos del negocio:', error);
        // Datos por defecto en caso de error
        datosNegocio = obtenerDatosPorDefecto();
    }
}

// Función para precargar una imagen y verificar si está disponible
function precargarImagen(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

// Función para obtener datos por defecto
function obtenerDatosPorDefecto() {
    return {
        empresa_nombre: '',
        empresa_ruc: '',
        empresa_direccion: 'Dirección no disponible',
        empresa_telefono: '',
        empresa_web: '',
        empresa_email: '',
        empresa_logo: null,
        empresa_qr: null
    };
}

// Cargar datos del negocio al inicializar
cargarDatosNegocio();

// Función para configurar las opciones de impresión
function configurarOpcionesImpresion() {
    const checkboxImpresion = document.getElementById('impresionAutomatica');
    if (checkboxImpresion) {
        // Cargar preferencia guardada
        const preferenciaImpresion = localStorage.getItem('impresionAutomatica');
        if (preferenciaImpresion !== null) {
            impresionAutomatica = preferenciaImpresion === 'true';
            checkboxImpresion.checked = impresionAutomatica;
        }
        
        checkboxImpresion.addEventListener('change', function() {
            impresionAutomatica = this.checked;
            localStorage.setItem('impresionAutomatica', this.checked);
        });
    }
}

// Función para obtener el tipo de comprobante seleccionado
function obtenerTipoComprobante() {
    const selector = document.getElementById('tipo_comprobante');
    return selector ? selector.value : 'boleta';
}

// Función para generar documento (factura, boleta, nota)
// 🔥 ACTUALIZACIÓN: Función generarDocumento CON MÉTODOS DE PAGO
// Reemplaza la función generarDocumento existente en imprimir-doc-dinamicos.js

function generarDocumento(tipo) {
    const venta = window.ventaRegistrada;
    if (!venta) {
        mostrarAlerta('info', 'Sin venta registrada', 'No hay ninguna venta registrada para imprimir');
        return;
    }

    const nombreCliente = venta.cliente?.nombre || "Cliente Genérico";
    const apellidoCliente = venta.cliente?.apellido || "";
    const nombreCompleto = `${nombreCliente} ${apellidoCliente}`.trim();
    const documentoCliente = venta.cliente?.numero_documento || "-";
    const fechaVenta = new Date(venta.fecha).toLocaleString("es-PE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });

    // Usar datos del negocio o valores por defecto
    const empresaNombre = datosNegocio?.empresa_nombre || '';
    const empresaRuc = datosNegocio?.empresa_ruc ? `RUC: ${datosNegocio.empresa_ruc}` : 'RUC: 10450069723';
    const empresaDireccion = datosNegocio?.empresa_direccion || '';
    const empresaTelefono = datosNegocio?.empresa_telefono ? `Teléfono: ${datosNegocio.empresa_telefono}` : '';
    const empresaWeb = datosNegocio?.empresa_web || '';
    const empresaEmail = datosNegocio?.empresa_email ? `Email: ${datosNegocio.empresa_email}` : '';
    const empresaLogo = datosNegocio?.empresa_logo || '';
    const empresaQR = datosNegocio?.empresa_qr || '';

    const html = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${tipo}</title>
          <style>
    /* BASE GLOBAL */
    body {
        font-family: Arial, sans-serif;
        font-size: 8px;
        line-height: 1.05;
        padding: 1.5px;
        max-width: 80mm;
        margin: 0 auto;
    }

    /* HEADER */
    .header {
        text-align: center;
        margin-bottom: 4px;
    }

    .logo-container {
        margin-bottom: 3px;
    }

    .logo {
        max-width: 100px;
        max-height: 60px;
    }

    h1 {
        margin: 2px 0;
        font-size: 9px;
        line-height: 1.1;
    }

    .empresa-info {
        font-size: 8px;
        margin: 1px 0;
        line-height: 1.05;
    }

    /* DATOS CLIENTE / TOTALES */
    .datos-cliente,
    .totales {
        margin-top: 4px;
    }

    .datos-cliente p,
    .totales p {
        display: flex;
        justify-content: space-between;
        margin: 1px 0;
        font-size: 8px;
        line-height: 1.05;
    }

    /* SEPARADOR */
    .linea {
        border-top: 1px solid #000;
        margin: 4px 0;
    }

    /* LISTA DE PRODUCTOS */
    ul {
        list-style: none;
        padding: 0;
        margin: 0;
        font-size: 8px;
    }

    li {
        margin: 1px 0;
        line-height: 1.05;
    }

    .producto {
        display: flex;
        justify-content: space-between;
    }

    .producto-nombre {
        flex: 3;
    }

    .producto-precio {
        flex: 1;
        text-align: right;
    }

    /* CÓDIGO DE VENTA */
    .codigo-venta {
        background-color: #f8f9fa;
        padding: 2px;
        border-radius: 3px;
        font-weight: bold;
        margin-bottom: 4px;
        text-align: center;
        font-size: 8px;
        line-height: 1.05;
    }

    /* MÉTODOS DE PAGO */
    .metodos-pago {
        background-color: #f0f8ff;
        padding: 3px;
        border-radius: 3px;
        margin-top: 4px;
        font-size: 8px;
        line-height: 1.05;
    }

    .metodos-pago h6 {
        margin: 1px 0 2px 0;
        font-size: 8px;
        font-weight: bold;
        line-height: 1.05;
    }

    .metodo-item {
        display: flex;
        justify-content: space-between;
        padding: 1px 0;
        border-bottom: 1px dashed #ddd;
    }

    .metodo-item:last-child {
        border-bottom: none;
    }

    .metodo-ref {
        font-size: 7px;
        line-height: 1.05;
        margin-left: 10px;
    }

    /* QR */
    .qr-container {
        text-align: center;
        margin-top: 4px;
        padding-top: 3px;
        border-top: 1px dashed #ccc;
        font-size: 8px;
        line-height: 1.05;
    }

    .qr-image {
        max-width: 80px;
        height: auto;
        margin-bottom: 2px;
    }

    /* FOOTER */
    .footer {
        text-align: center;
        font-size: 8px;
        margin-top: 4px;
        line-height: 1.05;
    }

    /* BOTONES (NO IMPRESIÓN) */
    .print-actions {
        display: flex;
        justify-content: center;
        gap: 6px;
        margin: 6px 0;
    }

    .print-btn,
    .download-btn {
        background-color: #007bff;
        color: #fff;
        border: none;
        padding: 4px 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 10px;
    }

    .download-btn {
        background-color: #28a745;
    }

    /* IMPRESIÓN */
    @media print {
        * {
            font-size: 8px !important;
            line-height: 1.05 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .print-actions {
            display: none;
        }
    }
</style>

        </head>
        <body>
            <div class="header">
                ${empresaLogo ? `
                <div class="logo-container">
                    <img src="${empresaLogo}" alt="Logo" class="logo" onerror="this.style.display='none'">
                </div>
                ` : ''}
                
                <h1>${empresaNombre}</h1>
                <div class="empresa-info">${empresaRuc}</div>
                ${empresaDireccion ? `<div class="empresa-info">${empresaDireccion}</div>` : ''}
                ${empresaTelefono ? `<div class="empresa-info">${empresaTelefono}</div>` : ''}
                ${empresaEmail ? `<div class="empresa-info">${empresaEmail}</div>` : ''}
                <div class="empresa-info">${empresaWeb}</div>
            </div>
            
            <div class="codigo-venta">
                <strong>Código de Venta:</strong> ${venta.codigo || 'N/A'}
            </div>
            
            <p class="linea"></p>
            
            <div class="datos-cliente">
                <p><strong>Comprobante:</strong> ${tipo.toUpperCase()}</p>
                <p><strong>Fecha:</strong> ${fechaVenta}</p>
                <p><strong>Cliente:</strong> ${nombreCompleto}</p>
                <p><strong>Documento:</strong> ${documentoCliente}</p>
            </div>
            
            <p class="linea"></p>
            
            <ul>
                ${venta.productos.map(p => `
                    <li class="producto">
                        <span class="producto-nombre">${p.nombre} x${p.cantidad}</span>
                        <span class="producto-precio">S/. ${(p.precio * p.cantidad).toFixed(2)}</span>
                    </li>
                `).join('')}
            </ul>
            
            <p class="linea"></p>
            
            <div class="totales">
                <p><span>Subtotal:</span> <span>S/. ${venta.subtotal.toFixed(2)}</span></p>
                <p><span>IGV:</span> <span>S/. ${venta.igv.toFixed(2)}</span></p>
                <p><span>Total:</span> <span>S/. ${venta.total.toFixed(2)}</span></p>
                ${venta.efectivo > 0 ? `
                <p><span>Efectivo:</span> <span>S/. ${venta.efectivo.toFixed(2)}</span></p>
                <p><span>Vuelto:</span> <span>S/. ${venta.vuelto.toFixed(2)}</span></p>
                ` : ''}
            </div>
            
            ${venta.metodos_pago && venta.metodos_pago.length > 0 ? `
            <div class="metodos-pago">
                <h6>💳 MÉTODOS DE PAGO UTILIZADOS:</h6>
                ${venta.metodos_pago.map(mp => `
                    <div class="metodo-item">
                        <span>• ${mp.nombre}</span>
                        <span>S/. ${mp.monto.toFixed(2)}</span>
                    </div>
                    ${mp.referencia ? `<div class="metodo-ref">Ref: ${mp.referencia}</div>` : ''}
                `).join('')}
            </div>
            ` : ''}
            
            ${empresaQR ? `
            <div class="qr-container">
                <img src="${empresaQR}" alt="QR Code" class="qr-image" onerror="this.style.display='none'">
                <div>Escanea para más información</div>
            </div>
            ` : ''}
            
            <div class="print-actions">
                <button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>
                <button class="download-btn" onclick="generatePDF('${tipo}')">📄 Descargar PDF</button>
            </div>
            
            <div class="footer">
                <p>¡Gracias por su Preferencia!</p>
                <p>${new Date().getFullYear()} © ${empresaNombre}</p>
            </div>

            <script>
                 function attemptPrint() {
        setTimeout(() => {
            try {
                window.print();

                // 🔹 Cerrar ventana después de imprimir
                setTimeout(() => {
                    window.close();
                }, 400);

            } catch (e) {
                console.error('Error al imprimir automáticamente:', e);
            }
        }, 300);
    }
                
                let loadedImages = 0;
                const totalImages = document.images.length;
                
                if (totalImages === 0) {
                    attemptPrint();
                } else {
                    for (let i = 0; i < totalImages; i++) {
                        document.images[i].addEventListener('load', () => {
                            loadedImages++;
                            if (loadedImages === totalImages) {
                                attemptPrint();
                            }
                        });
                        document.images[i].addEventListener('error', () => {
                            loadedImages++;
                            if (loadedImages === totalImages) {
                                attemptPrint();
                            }
                        });
                    }
                }
                
                function generatePDF(tipo) {
                    const pdfContent = document.documentElement.outerHTML;
                    const blob = new Blob([pdfContent], { type: 'text/html' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = tipo + '_${venta.codigo || 'N/A'}.html';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            </script>
        </body>
        </html>
    `;

    const w = window.open("", "_blank");
    w.document.write(html);
}

// Función para generar proforma PDF





function generarProformaPDF() {
    const proforma = window.proformaGenerada;
    if (!proforma) {
        mostrarAlerta('info', 'Sin proforma', 'No hay ninguna proforma para imprimir');
        return;
    }

    const fecha = new Date(proforma.fecha).toLocaleString('es-PE', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const empresaNombre = datosNegocio?.empresa_nombre || '';
    const empresaRuc = datosNegocio?.empresa_ruc ? `RUC: ${datosNegocio.empresa_ruc}` : 'RUC: 10450069723';
    const empresaDireccion = datosNegocio?.empresa_direccion || '';
    const empresaTelefono = datosNegocio?.empresa_telefono ? `Teléfono: ${datosNegocio.empresa_telefono}` : '';
    const empresaWeb = datosNegocio?.empresa_web || '';
    const empresaEmail = datosNegocio?.empresa_email ? `Email: ${datosNegocio.empresa_email}` : '';
    const empresaLogo = datosNegocio?.empresa_logo || '';
    const empresaQR = datosNegocio?.empresa_qr || '';

    // Pasar la configuración de impresión automática
    const imprimirAutomaticamente = impresionAutomatica;
    
    // Variable para el nombre del archivo
    const numeroProforma = proforma.numero_comprobante;

    const html = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Proforma</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 80mm; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 15px; }
                .logo-container { margin-bottom: 10px; }
                .logo { max-width: 100px; max-height: 60px; }
                h1 { margin: 5px 0; font-size: 18px; }
                .empresa-info { font-size: 12px; margin: 3px 0; }
                .datos-cliente, .totales { margin-top: 15px; }
                .linea { border-top: 1px solid #000; margin: 10px 0; }
                ul { list-style: none; padding: 0; font-size: 12px; }
                .producto { display: flex; justify-content: space-between; }
                .producto-nombre { flex: 3; }
                .producto-precio { flex: 1; text-align: right; }
                .codigo-venta { 
                    background-color: #f8f9fa; 
                    padding: 5px; 
                    border-radius: 4px; 
                    font-weight: bold;
                    margin-bottom: 10px;
                    text-align: center;
                    font-size: 12px;
                }
                .totales p { 
                    display: flex; 
                    justify-content: space-between; 
                    margin: 5px 0;
                    font-size: 12px;
                }
                .qr-container { 
                    text-align: center; 
                    margin-top: 15px;
                    padding-top: 10px;
                    border-top: 1px dashed #ccc;
                }
                .qr-image { 
                    max-width: 80px; 
                    height: auto;
                    margin-bottom: 5px;
                }
                .footer { 
                    text-align: center; 
                    font-size: 10px; 
                    margin-top: 10px;
                }
                .print-actions {
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                    margin: 15px 0;
                }
                .print-btn {
                    background-color: #007bff;
                    color: white;
                    border: none;
                    padding: 8px 15px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .download-btn {
                    background-color: #28a745;
                    color: white;
                    border: none;
                    padding: 8px 15px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
              @media print {
    * {
        font-size: 8px !important;
        line-height: 1.05 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    .print-actions {
        display: none;
    }
}
            </style>
        </head>
        <body>
            <div class="header">
                ${empresaLogo ? `
                <div class="logo-container">
                    <img src="${empresaLogo}" alt="Logo" class="logo" onerror="this.style.display='none'">
                </div>
                ` : ''}
                
                <h1>${empresaNombre}</h1>
                <div class="empresa-info">${empresaRuc}</div>
                ${empresaDireccion ? `<div class="empresa-info">${empresaDireccion}</div>` : ''}
                ${empresaTelefono ? `<div class="empresa-info">${empresaTelefono}</div>` : ''}
                ${empresaEmail ? `<div class="empresa-info">${empresaEmail}</div>` : ''}
                <div class="empresa-info">${empresaWeb}</div>
            </div>
            
            <div class="codigo-venta">
                <strong>N° Proforma:</strong> ${proforma.numero_comprobante}
            </div>
            
            <p class="linea"></p>
            
            <div class="datos-cliente">
                <p><strong>Documento:</strong> PROFORMA</p>
                <p><strong>Fecha:</strong> ${fecha}</p>
                <p><strong>Cliente:</strong> ${proforma.cliente.nombre}</p>
                <p><strong>Documento:</strong> ${proforma.cliente.numero_documento}</p>
                ${proforma.observaciones ? `<p><strong>Observaciones:</strong> ${proforma.observaciones}</p>` : ''}
            </div>
            
            <p class="linea"></p>
            
            <ul>
                ${proforma.productos.map(p => `
                    <li class="producto">
                        <span class="producto-nombre">${p.nombre} x${p.cantidad}</span>
                        <span class="producto-precio">S/. ${(p.precio * p.cantidad).toFixed(2)}</span>
                    </li>
                `).join('')}
            </ul>
            
            <p class="linea"></p>
            
            <div class="totales">
                <p><span>Subtotal:</span> <span>S/. ${proforma.subtotal.toFixed(2)}</span></p>
                <p><span>IGV:</span> <span>S/. ${proforma.igv.toFixed(2)}</span></p>
                <p><span>Total:</span> <span>S/. ${proforma.total.toFixed(2)}</span></p>
            </div>
            
            <p class="linea"></p>
            <p><strong>Válido hasta:</strong> ${new Date(proforma.fecha_validez).toLocaleDateString('es-PE')}</p>
            
            ${empresaQR ? `
            <div class="qr-container">
                <img src="${empresaQR}" alt="QR Code" class="qr-image" onerror="this.style.display='none'">
                <div>Escanea para más información</div>
            </div>
            ` : ''}
            
            <div class="print-actions">
                <button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>
                <button class="download-btn" onclick="generatePDF()">📄 Descargar PDF</button>
            </div>
            
            <div class="footer">
                <p>¡Gracias por su preferencia!</p>
                <p>${new Date().getFullYear()} © ${empresaNombre}</p>
            </div>

            <script>
                // Variables locales definidas correctamente
                const impresionAutomaticaHabilitada = ${imprimirAutomaticamente};
                const numeroProforma = "${numeroProforma}";
                const tipoDocumento = "proforma";
                
                function attemptPrint() {
                    if (impresionAutomaticaHabilitada) {
                        setTimeout(() => {
                            try {
                                window.print();
                                console.log('Impresión automática ejecutada para proforma:', numeroProforma);
                            } catch (e) {
                                console.error('Error al imprimir automáticamente:', e);
                            }
                        }, 1000);
                    }
                }
                
                // Esperar a que todas las imágenes se carguen
                let loadedImages = 0;
                const totalImages = document.images.length;
                
                console.log('Total de imágenes a cargar:', totalImages);
                
                if (totalImages === 0) {
                    console.log('No hay imágenes, procediendo con impresión');
                    attemptPrint();
                } else {
                    for (let i = 0; i < totalImages; i++) {
                        document.images[i].addEventListener('load', () => {
                            loadedImages++;
                            console.log('Imagen cargada:', loadedImages, 'de', totalImages);
                            if (loadedImages === totalImages) {
                                attemptPrint();
                            }
                        });
                        document.images[i].addEventListener('error', () => {
                            loadedImages++;
                            console.log('Error al cargar imagen:', loadedImages, 'de', totalImages);
                            if (loadedImages === totalImages) {
                                attemptPrint();
                            }
                        });
                    }
                }
                
                // Función para generar PDF - CORREGIDA
                function generatePDF() {
                    try {
                        console.log('Iniciando generación de PDF para:', tipoDocumento, numeroProforma);
                        
                        // Crear un HTML simplificado para el PDF
                        const pdfContent = document.documentElement.outerHTML;
                        
                        // Crear un blob con el contenido
                        const blob = new Blob([pdfContent], { type: 'text/html' });
                        
                        // Crear un enlace de descarga
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        
                        // CORREGIDO: usar variables locales definidas correctamente
                        a.download = tipoDocumento + '_' + numeroProforma + '.html';
                        
                        console.log('Nombre del archivo:', a.download);
                        
                        // Simular clic en el enlace
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        
                        console.log('Descarga iniciada correctamente');
                        
                        // Limpiar el objeto URL después de un tiempo
                        setTimeout(() => {
                            URL.revokeObjectURL(a.href);
                            console.log('URL del blob limpiada');
                        }, 1000);
                        
                    } catch (error) {
                        console.error('Error al generar PDF:', error);
                        alert('Error al generar el PDF: ' + error.message);
                    }
                }
                
                // Log de inicialización
                console.log('=== VENTANA DE PROFORMA INICIALIZADA ===');
                console.log('Número:', numeroProforma);
                console.log('Tipo:', tipoDocumento);
                console.log('Impresión automática:', impresionAutomaticaHabilitada);
                console.log('========================================');
            </script>
        </body>
        </html>
    `;

    try {
        const w = window.open('', '_blank');
        if (!w) {
            throw new Error('No se pudo abrir la ventana de impresión. Verifique que no esté bloqueada por el navegador.');
        }
        
        w.document.write(html);
        console.log('✅ Ventana de proforma abierta correctamente');
        
    } catch (error) {
        console.error('❌ Error al abrir ventana de impresión:', error);
        mostrarAlerta('error', 'Error de impresión', 'No se pudo abrir la ventana de impresión: ' + error.message);
    }
}

// Función para generar proforma simple
function generarProforma() {
    if (carrito.length === 0) {
        mostrarAlerta('warning', 'Carrito vacío', 'El carrito está vacío');
        return;
    }
    
    const nombreCliente = document.getElementById('nombre_cliente').value || 'Cliente';
    const documentoCliente = document.getElementById('numero_documento').value || '-';
    const fecha = new Date().toLocaleString("es-PE", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    });

    const subtotal = parseFloat(document.getElementById('subtotal').textContent) || 0;
    const igv = parseFloat(document.getElementById('igv').textContent) || 0;
    const total = parseFloat(document.getElementById('total').textContent) || 0;
    const codigoProforma = generarCodigoProforma();

    const empresaNombre = datosNegocio?.empresa_nombre || '';
    const empresaRuc = datosNegocio?.empresa_ruc ? `RUC: ${datosNegocio.empresa_ruc}` : 'RUC: 10450069723';
    const empresaDireccion = datosNegocio?.empresa_direccion || '';
    const empresaTelefono = datosNegocio?.empresa_telefono ? `Teléfono: ${datosNegocio.empresa_telefono}` : '';
    const empresaWeb = datosNegocio?.empresa_web || '';
    const empresaEmail = datosNegocio?.empresa_email ? `Email: ${datosNegocio.empresa_email}` : '';
    const empresaLogo = datosNegocio?.empresa_logo || '';
    const empresaQR = datosNegocio?.empresa_qr || '';

    // Pasar la configuración de impresión automática
    const imprimirAutomaticamente = impresionAutomatica;

    const html = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Proforma</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 80mm; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 15px; }
                .logo-container { margin-bottom: 10px; }
                .logo { max-width: 100px; max-height: 60px; }
                h1 { margin: 5px 0; font-size: 18px; }
                .empresa-info { font-size: 12px; margin: 3px 0; }
                .datos-cliente, .totales { margin-top: 15px; }
                .linea { border-top: 1px solid #000; margin: 10px 0; }
                ul { list-style: none; padding: 0; font-size: 12px; }
                .producto { display: flex; justify-content: space-between; }
                .producto-nombre { flex: 3; }
                .producto-precio { flex: 1; text-align: right; }
                .codigo-venta { 
                    background-color: #f8f9fa; 
                    padding: 5px; 
                    border-radius: 4px; 
                    font-weight: bold;
                    margin-bottom: 10px;
                    text-align: center;
                    font-size: 12px;
                }
                .totales p { 
                    display: flex; 
                    justify-content: space-between; 
                    margin: 5px 0;
                    font-size: 12px;
                }
                .qr-container { 
                    text-align: center; 
                    margin-top: 15px;
                    padding-top: 10px;
                    border-top: 1px dashed #ccc;
                }
                .qr-image { 
                    max-width: 80px; 
                    height: auto;
                    margin-bottom: 5px;
                }
                .footer { 
                    text-align: center; 
                    font-size: 10px; 
                    margin-top: 10px;
                }
                .print-actions {
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                    margin: 15px 0;
                }
                .print-btn {
                    background-color: #007bff;
                    color: white;
                    border: none;
                    padding: 8px 15px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .download-btn {
                    background-color: #28a745;
                    color: white;
                    border: none;
                    padding: 8px 15px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                @media print {
                    .print-actions { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                ${empresaLogo ? `
                <div class="logo-container">
                    <img src="${empresaLogo}" alt="Logo" class="logo" onerror="this.style.display='none'">
                </div>
                ` : ''}
                
                <h1>${empresaNombre}</h1>
                <div class="empresa-info">${empresaRuc}</div>
                ${empresaDireccion ? `<div class="empresa-info">${empresaDireccion}</div>` : ''}
                ${empresaTelefono ? `<div class="empresa-info">${empresaTelefono}</div>` : ''}
                ${empresaEmail ? `<div class="empresa-info">${empresaEmail}</div>` : ''}
                <div class="empresa-info">${empresaWeb}</div>
            </div>
            
            <div class="codigo-venta">
                <strong>N° Proforma:</strong> ${codigoProforma}
            </div>
            
            <p class="linea"></p>
            
            <div class="datos-cliente">
                <p><strong>Documento:</strong> PROFORMA</p>
                <p><strong>Fecha:</strong> ${fecha}</p>
                <p><strong>Cliente:</strong> ${nombreCliente}</p>
                <p><strong>Documento:</strong> ${documentoCliente}</p>
            </div>
            
            <p class="linea"></p>
            
            <ul>
                ${carrito.map(p => `
                    <li class="producto">
                        <span class="producto-nombre">${p.nombre} x${p.cantidad}</span>
                        <span class="producto-precio">S/. ${(p.precio * p.cantidad).toFixed(2)}</span>
                    </li>
                `).join('')}
            </ul>
            
            <p class="linea"></p>
            
            <div class="totales">
                <p><span>Subtotal:</span> <span>S/. ${subtotal.toFixed(2)}</span></p>
                <p><span>IGV:</span> <span>S/. ${igv.toFixed(2)}</span></p>
                <p><span>Total:</span> <span>S/. ${total.toFixed(2)}</span></p>
            </div>
            
            ${empresaQR ? `
            <div class="qr-container">
                <img src="${empresaQR}" alt="QR Code" class="qr-image" onerror="this.style.display='none'">
                <div>Escanea para más información</div>
            </div>
            ` : ''}
            
            <div class="print-actions">
                <button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>
                <button class="download-btn" onclick="generatePDF('proforma')">📄 Descargar PDF</button>
            </div>
            
            <div class="footer">
                <p>¡Gracias por su preferencia!</p>
                <p>${new Date().getFullYear()} © ${empresaNombre}</p>
            </div>

            <script>
                // Solo imprimir si está habilitado
                const impresionAutomaticaHabilitada = ${imprimirAutomaticamente};
                
                function attemptPrint() {
                    if (impresionAutomaticaHabilitada) {
                        setTimeout(() => {
                            try {
                                window.print();
                            } catch (e) {
                                console.error('Error al imprimir automáticamente:', e);
                            }
                        }, 1000);
                    }
                }
                
                // Esperar a que todas las imágenes se carguen
                let loadedImages = 0;
                const totalImages = document.images.length;
                
                if (totalImages === 0) {
                    attemptPrint();
                } else {
                    for (let i = 0; i < totalImages; i++) {
                        document.images[i].addEventListener('load', () => {
                            loadedImages++;
                            if (loadedImages === totalImages) {
                                attemptPrint();
                            }
                        });
                        document.images[i].addEventListener('error', () => {
                            loadedImages++;
                            if (loadedImages === totalImages) {
                                attemptPrint();
                            }
                        });
                    }
                }
                
                // Función para generar PDF
                function generatePDF(tipo) {
                    // Crear un HTML simplificado para el PDF
                    const pdfContent = document.documentElement.outerHTML;
                    
                    // Crear un blob con el contenido
                    const blob = new Blob([pdfContent], { type: 'text/html' });
                    
                    // Crear un enlace de descarga
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = '${tipo}_${codigoProforma}.html';
                    
                    // Simular clic en el enlace
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            </script>
        </body>
        </html>
    `;

    const w = window.open("", "_blank");
    w.document.write(html);
}

// Función para generar código de proforma
function generarCodigoProforma() {
    const ahora = new Date();
    return 'PF-' + ahora.getFullYear().toString().slice(-2) +
           (ahora.getMonth() + 1).toString().padStart(2, '0') +
           ahora.getDate().toString().padStart(2, '0') +
           '-' + Math.floor(Math.random() * 1000);
}

// Función global para reimprimir proforma
async function imprimirProforma(id) {
    try {
        const response = await fetch(`/api/proformas/${id}`);
        const proforma = await response.json();
        
        window.proformaGenerada = proforma;
        generarProformaPDF();
    } catch (error) {
        mostrarAlerta('error', 'Error al cargar proforma', 'No se pudo cargar la proforma para imprimir');
    }
}

// Hacer función accesible globalmente
window.imprimirProforma = imprimirProforma;

// Inicializar las opciones de impresión cuando se carga el DOM
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        configurarOpcionesImpresion();
    });
}


//**************************FUNCION AGREGADA  PARA VENTAS A CREDITO******* */
//ventas-credito.html
// Extensión del sistema de impresión para ventas a crédito
// Este código se debe agregar al archivo imprimir-doc-dinamicos.js existente

// Función específica para generar comprobante de venta a crédito
function generarComprobanteCredito() {
    const venta = window.ventaCreditoRegistrada;
    if (!venta) {
        mostrarAlerta('info', 'Sin venta a crédito registrada', 'No hay ninguna venta a crédito registrada para imprimir');
        return;
    }

    const nombreCliente = venta.cliente?.nombre || "Cliente";
    const apellidoCliente = venta.cliente?.apellido || "";
    const nombreCompleto = `${nombreCliente} ${apellidoCliente}`.trim();
    const documentoCliente = venta.cliente?.numero_documento || "-";
    const tipoDocumento = venta.cliente?.tipo_documento || "-";
    const telefonoCliente = venta.cliente?.telefono || "";
    const direccionCliente = venta.cliente?.direccion || "";
    
    const fechaVenta = new Date(venta.fecha).toLocaleString("es-PE", {
        year: "numeric",
        month: "2-digit", 
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });

    // Usar datos del negocio o valores por defecto
    const empresaNombre = datosNegocio?.empresa_nombre || '';
    const empresaRuc = datosNegocio?.empresa_ruc ? `RUC: ${datosNegocio.empresa_ruc}` : 'RUC: 10450069723';
    const empresaDireccion = datosNegocio?.empresa_direccion || '';
    const empresaTelefono = datosNegocio?.empresa_telefono ? `Teléfono: ${datosNegocio.empresa_telefono}` : '';
    const empresaWeb = datosNegocio?.empresa_web || '';
    const empresaEmail = datosNegocio?.empresa_email ? `Email: ${datosNegocio.empresa_email}` : '';
    const empresaLogo = datosNegocio?.empresa_logo || '';
    const empresaQR = datosNegocio?.empresa_qr || '';

    // Pasar la configuración de impresión automática
    const imprimirAutomaticamente = impresionAutomatica;

    const html = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Venta a Crédito</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 80mm; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 15px; }
                .logo-container { margin-bottom: 10px; }
                .logo { max-width: 100px; max-height: 60px; }
                h1 { margin: 5px 0; font-size: 18px; }
                .empresa-info { font-size: 12px; margin: 3px 0; }
                .datos-cliente, .totales { margin-top: 15px; }
                .linea { border-top: 1px solid #000; margin: 10px 0; }
                ul { list-style: none; padding: 0; font-size: 12px; }
                .producto { display: flex; justify-content: space-between; margin-bottom: 2px; }
                .producto-nombre { flex: 3; }
                .producto-precio { flex: 1; text-align: right; }
                .codigo-venta { 
                    background-color: #fff3cd; 
                    padding: 5px; 
                    border: 1px solid #ffeaa7;
                    border-radius: 4px; 
                    font-weight: bold;
                    margin-bottom: 10px;
                    text-align: center;
                    font-size: 12px;
                    color: #856404;
                }
                .credito-badge {
                    background-color: #d1ecf1;
                    color: #0c5460;
                    padding: 3px 8px;
                    border-radius: 15px;
                    font-size: 11px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    text-align: center;
                }
                .totales p { 
                    display: flex; 
                    justify-content: space-between; 
                    margin: 5px 0;
                    font-size: 12px;
                }
                .datos-cliente p {
                    margin: 3px 0;
                    font-size: 11px;
                }
                .qr-container { 
                    text-align: center; 
                    margin-top: 15px;
                    padding-top: 10px;
                    border-top: 1px dashed #ccc;
                }
                .qr-image { 
                    max-width: 80px; 
                    height: auto;
                    margin-bottom: 5px;
                }
                .footer { 
                    text-align: center; 
                    font-size: 10px; 
                    margin-top: 10px;
                }
                .print-actions {
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                    margin: 15px 0;
                }
                .print-btn {
                    background-color: #007bff;
                    color: white;
                    border: none;
                    padding: 8px 15px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .download-btn {
                    background-color: #28a745;
                    color: white;
                    border: none;
                    padding: 8px 15px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .credito-info {
                    background-color: #f8f9fa;
                    padding: 8px;
                    border-left: 3px solid #17a2b8;
                    margin: 10px 0;
                    font-size: 11px;
                }
                @media print {
                    .print-actions { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                ${empresaLogo ? `
                <div class="logo-container">
                    <img src="${empresaLogo}" alt="Logo" class="logo" onerror="this.style.display='none'">
                </div>
                ` : ''}
                
                <h1>${empresaNombre}</h1>
                <div class="empresa-info">${empresaRuc}</div>
                ${empresaDireccion ? `<div class="empresa-info">${empresaDireccion}</div>` : ''}
                ${empresaTelefono ? `<div class="empresa-info">${empresaTelefono}</div>` : ''}
                ${empresaEmail ? `<div class="empresa-info">${empresaEmail}</div>` : ''}
                <div class="empresa-info">${empresaWeb}</div>
            </div>
            
            <div class="credito-badge">
                🔄 VENTA A CRÉDITO
            </div>
            
            <div class="codigo-venta">
                <strong>Código de Venta:</strong> ${venta.codigo || 'N/A'}
            </div>
            
            <p class="linea"></p>
            
            <div class="datos-cliente">
                <p><strong>Comprobante:</strong> VENTA A CRÉDITO</p>
                <p><strong>Fecha:</strong> ${fechaVenta}</p>
                <p><strong>Cliente:</strong> ${nombreCompleto}</p>
                <p><strong>Documento:</strong> ${tipoDocumento} - ${documentoCliente}</p>
                ${telefonoCliente ? `<p><strong>Teléfono:</strong> ${telefonoCliente}</p>` : ''}
                ${direccionCliente ? `<p><strong>Dirección:</strong> ${direccionCliente}</p>` : ''}
            </div>
            
            <div class="credito-info">
                <strong>⚠️ CONDICIONES DE CRÉDITO:</strong><br>
                • Esta es una venta a crédito pendiente de pago<br>
                • El cliente se compromete a cancelar el monto total<br>
                • Conserve este comprobante como respaldo
            </div>
            
            <p class="linea"></p>
            
            <ul>
                ${venta.productos.map(p => `
                    <li class="producto">
                        <span class="producto-nombre">${p.nombre} x${p.cantidad}</span>
                        <span class="producto-precio">S/. ${(p.precio * p.cantidad).toFixed(2)}</span>
                    </li>
                `).join('')}
            </ul>
            
            <p class="linea"></p>
            
            <div class="totales">
                <p><span>Subtotal:</span> <span>S/. ${venta.subtotal.toFixed(2)}</span></p>
                <p><span>IGV:</span> <span>S/. ${venta.igv.toFixed(2)}</span></p>
                <p style="font-weight: bold; border-top: 1px solid #000; padding-top: 5px;">
                    <span>TOTAL A CRÉDITO:</span> <span>S/. ${venta.total.toFixed(2)}</span>
                </p>
            </div>
            
            ${empresaQR ? `
            <div class="qr-container">
                <img src="${empresaQR}" alt="QR Code" class="qr-image" onerror="this.style.display='none'">
                <div>Escanea para más información</div>
            </div>
            ` : ''}
            
            <div class="print-actions">
                <button class="print-btn" onclick="window.print()">🖨️ Imprimir</button>
                <button class="download-btn" onclick="generatePDF()">📄 Descargar PDF</button>
            </div>
            
            <div class="footer">
                <p>¡Gracias por su confianza!</p>
                <p>${new Date().getFullYear()} © ${empresaNombre}</p>
                <p style="font-size: 9px; margin-top: 5px;">
                    Venta a crédito - Documento sin valor fiscal
                </p>
            </div>

            <script>
                // Variables locales
                const impresionAutomaticaHabilitada = ${imprimirAutomaticamente};
                const codigoVenta = "${venta.codigo || 'N/A'}";
                const tipoDocumento = "venta_credito";
                
                function attemptPrint() {
                    if (impresionAutomaticaHabilitada) {
                        setTimeout(() => {
                            try {
                                window.print();
                                console.log('Impresión automática ejecutada para venta a crédito:', codigoVenta);
                            } catch (e) {
                                console.error('Error al imprimir automáticamente:', e);
                            }
                        }, 1000);
                    }
                }
                
                // Esperar a que todas las imágenes se carguen
                let loadedImages = 0;
                const totalImages = document.images.length;
                
                if (totalImages === 0) {
                    attemptPrint();
                } else {
                    for (let i = 0; i < totalImages; i++) {
                        document.images[i].addEventListener('load', () => {
                            loadedImages++;
                            if (loadedImages === totalImages) {
                                attemptPrint();
                            }
                        });
                        document.images[i].addEventListener('error', () => {
                            loadedImages++;
                            if (loadedImages === totalImages) {
                                attemptPrint();
                            }
                        });
                    }
                }
                
                // Función para generar PDF
                function generatePDF() {
                    try {
                        console.log('Iniciando generación de PDF para venta a crédito:', codigoVenta);
                        
                        // Crear un HTML simplificado para el PDF
                        const pdfContent = document.documentElement.outerHTML;
                        
                        // Crear un blob con el contenido
                        const blob = new Blob([pdfContent], { type: 'text/html' });
                        
                        // Crear un enlace de descarga
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = tipoDocumento + '_' + codigoVenta + '.html';
                        
                        // Simular clic en el enlace
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        
                        // Limpiar el objeto URL después de un tiempo
                        setTimeout(() => {
                            URL.revokeObjectURL(a.href);
                        }, 1000);
                        
                    } catch (error) {
                        console.error('Error al generar PDF:', error);
                        alert('Error al generar el PDF: ' + error.message);
                    }
                }
                
                // Log de inicialización
                console.log('=== VENTANA DE VENTA A CRÉDITO INICIALIZADA ===');
                console.log('Código:', codigoVenta);
                console.log('Impresión automática:', impresionAutomaticaHabilitada);
                console.log('================================================');
            </script>
        </body>
        </html>
    `;

    try {
        const w = window.open('', '_blank');
        if (!w) {
            throw new Error('No se pudo abrir la ventana de impresión. Verifique que no esté bloqueada por el navegador.');
        }
        
        w.document.write(html);
        console.log('✅ Ventana de venta a crédito abierta correctamente');
        
    } catch (error) {
        console.error('❌ Error al abrir ventana de impresión:', error);
        mostrarAlerta('error', 'Error de impresión', 'No se pudo abrir la ventana de impresión: ' + error.message);
    }
}

// Función para mostrar alertas (usar SweetAlert si está disponible, sino alert nativo)
function mostrarAlerta(tipo, titulo, mensaje) {
    if (typeof Swal !== 'undefined') {
        Swal.fire(titulo, mensaje, tipo);
    } else {
        alert(`${titulo}: ${mensaje}`);
    }
}

// Hacer la función accesible globalmente
window.generarComprobanteCredito = generarComprobanteCredito;