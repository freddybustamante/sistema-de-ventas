document.addEventListener('DOMContentLoaded', () => {
    const formularioAgregarProducto = document.getElementById('formularioAgregarProducto');
    // const tabla = document.getElementById('bootstrap-data-table-export');
    // const tbody = tabla.querySelector('tbody');
    const inputBuscar = document.getElementById('buscarProducto');
    const listaSugerencias = document.getElementById('sugerencias');
    const btnImportarExcel = document.getElementById('btnImportarExcel');
    const btnExportarExcel = document.getElementById('btnExportarExcel');
    const btnLimpiar = document.getElementById('btnLimpiar');
    const vistaPreviaImagen = document.getElementById('vista-previa-imagen');
    const inputImagen = document.getElementById('imagen');
    const codigoBarrasInput = document.getElementById('codigo_barras');
    const formData = new FormData(formularioAgregarProducto);

    // 📌 Función para limpiar todos los campos y localStorage
    function limpiarFormulario() {
        formularioAgregarProducto.reset();
        document.getElementById("producto_id").value = "";
        document.getElementById("vista-previa-imagen").style.display = "none";
        inputBuscar.value = "";
        listaSugerencias.style.display = "none";
        // Limpiar localStorage si existe alguna información guardada
        localStorage.removeItem('productoActual');
        localStorage.removeItem('ultimaBusqueda');
    }

    // 📌 Botón Limpiar
    if (btnLimpiar) {
        btnLimpiar.addEventListener("click", () => {
            limpiarFormulario();
            Swal.fire({
                icon: 'success',
                title: 'Campos limpiados',
                text: 'Todos los campos han sido limpiados correctamente',
                timer: 1500,
                showConfirmButton: false
            });
        });
    }

    // 📌 Función para convertir texto a mayúsculas
    function convertirAMayusculas(input) {
        if (input && input.value) {
            input.value = input.value.toUpperCase();
        }
    }

    // 📌 Aplicar conversión a mayúsculas en campos de texto
    const camposTexto = ['nombre', 'marca', 'proveedor', 'categoria', 'subcategoria', 'unidad_medida', 'descripcion'];
    camposTexto.forEach(campo => {
        const input = document.getElementById(campo);
        if (input) {
            input.addEventListener('input', () => convertirAMayusculas(input));
        }
    });

    // 📌 Validar duplicados por código de barras y nombre
    async function validarProductoDuplicado(nombre, codigoBarras, idProductoActual = null) {
        try {
            const response = await fetch('/api/productos');
            const productos = await response.json();
            
            const nombreUpper = nombre.toUpperCase();
            const duplicado = productos.find(producto => {
                const esElMismoProducto = idProductoActual && producto.id == idProductoActual;
                if (esElMismoProducto) return false;
                
                return (producto.nombre && producto.nombre.toUpperCase() === nombreUpper) || 
                       (codigoBarras && producto.codigo_barras === codigoBarras);
            });

            return duplicado;
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al validar producto duplicado'
            });
            return null;
        }
    }

    // 📌 Función para detectar si es código de barras (números, guiones, espacios)
    function esCodigoBarras(texto) {
        const codigoLimpio = texto.trim();
        // Código de barras típico: solo números, guiones o espacios, mínimo 8 caracteres
        return /^[\d\s\-]+$/.test(codigoLimpio) && codigoLimpio.length >= 8;
    }

    // 📌 Cargar producto automáticamente con pistola de código de barras
    codigoBarrasInput.addEventListener('input', async () => {
        const codigoBarras = codigoBarrasInput.value.trim();
        if (codigoBarras && esCodigoBarras(codigoBarras)) {
            try {
                const response = await fetch(`/api/productos/buscar?termino=${codigoBarras}`);
                const productos = await response.json();
                
                if (productos.length > 0) {
                    const producto = productos.find(p => 
                        p.codigo_barras && p.codigo_barras.trim() === codigoBarras
                    );
                    if (producto) {
                        await cargarProducto(producto.id);
                        Swal.fire({
                            icon: 'success',
                            title: 'Producto encontrado',
                            text: `Producto "${producto.nombre}" cargado correctamente`,
                            timer: 1500,
                            showConfirmButton: false
                        });
                    }
                }
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al buscar producto por código de barras'
                });
            }
        }
    });

    // 📌 También cargar al presionar Enter o perder el foco
    codigoBarrasInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const codigoBarras = codigoBarrasInput.value.trim();
            if (codigoBarras) {
                try {
                    const response = await fetch(`/api/productos/buscar?termino=${codigoBarras}`);
                    const productos = await response.json();
                    
                    if (productos.length > 0) {
                        const producto = productos.find(p => 
                            p.codigo_barras && p.codigo_barras.trim() === codigoBarras
                        );
                        if (producto) {
                            await cargarProducto(producto.id);
                            Swal.fire({
                                icon: 'success',
                                title: 'Producto encontrado',
                                text: `Producto "${producto.nombre}" cargado correctamente`,
                                timer: 1500,
                                showConfirmButton: false
                            });
                        } else {
                            Swal.fire({
                                icon: 'info',
                                title: 'Producto no encontrado',
                                text: `No se encontró un producto con el código "${codigoBarras}"`,
                                timer: 2000,
                                showConfirmButton: false
                            });
                        }
                    }
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Error al buscar producto por código de barras'
                    });
                }
            }
        }
    });

    // 📌 Mostrar vista previa de la imagen antes de enviarla
    inputImagen.addEventListener("change", (event) => {
        const archivo = event.target.files[0];
        if (archivo) {
            const reader = new FileReader();
            reader.onload = (e) => {
                vistaPreviaImagen.src = e.target.result;
                vistaPreviaImagen.style.display = "block";
            };
            reader.readAsDataURL(archivo);
        }
    });

    // 📌 Importar Excel
    if (btnImportarExcel) {
        btnImportarExcel.addEventListener("click", async () => {
            // Mostrar opciones de importación
            const { value: opcion } = await Swal.fire({
                title: 'Importar productos',
                text: 'Selecciona una opción',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Importar archivo Excel',
                cancelButtonText: 'Descargar plantilla',
                reverseButtons: true,
                allowOutsideClick: false
            });

            if (opcion) {
                // Importar archivo
                const inputArchivo = document.createElement("input");
                inputArchivo.type = "file";
                inputArchivo.accept = ".xlsx, .xls";
            
                inputArchivo.addEventListener("change", async (event) => {
                    const archivo = event.target.files[0];
                    if (!archivo) return;
            
                    // Mostrar loading
                    Swal.fire({
                        title: 'Importando productos...',
                        text: 'Por favor espera mientras se procesan los datos',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        showConfirmButton: false,
                        didOpen: () => {
                            Swal.showLoading();
                        }
                    });
            
                    const formData = new FormData();
                    formData.append("archivo", archivo);
            
                    try {
                        const response = await fetch("/api/importar-excel", { 
                            method: "POST", 
                            body: formData 
                        });
                        
                        const data = await response.json();
            
                        if (response.ok) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Importación exitosa',
                                text: `${data.productos_procesados || 'Productos'} importados correctamente`
                            });
                            
                            // Recargar productos si existe la función
                            if (typeof cargarProductos === 'function') {
                                cargarProductos();
                            }
                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: 'Error al importar',
                                html: `<strong>Error:</strong> ${data.error || 'Error desconocido'}<br><strong>Detalles:</strong> ${data.details || 'Sin detalles'}`
                            });
                        }
                    } catch (error) {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error en la solicitud',
                            text: 'Error en la solicitud al servidor: ' + error.message
                        });
                    }
                });
            
                inputArchivo.click();
            } else if (opcion === false) {
                // Descargar plantilla
                generarPlantillaImportacion();
            }
        });
    }

    // 📌 Función para generar plantilla de importación
    function generarPlantillaImportacion() {
        try {
            const datosPlantilla = [
                {
                    ID: '',
                    Nombre: 'COCA COLA 500ML',
                    CodigoBarras: '7794000123456',
                    Marca: 'COCA COLA',
                    Proveedor: 'DISTRIBUIDORA ABC',
                    Categoria: 'BEBIDAS',
                    Subcategoria: 'GASEOSAS',
                    UnidadMedida: 'ML',
                    Peso: 500,
                    Alto: 20.5,
                    Ancho: 6.5,
                    Largo: 6.5,
                    Descripcion: 'BEBIDA GASEOSA SABOR COLA',
                    PrecioCompra: 2.50,
                    PrecioVenta: 3.50,
                    Stock: 100,
                    StockMinimo: 10,
                    FechaVencimiento: '2025-12-31',
                    FechaElaboracion: '2025-01-15'
                },
                {
                    ID: '',
                    Nombre: 'PEPSI 500ML',
                    CodigoBarras: '7794000123457',
                    Marca: 'PEPSI',
                    Proveedor: 'DISTRIBUIDORA XYZ',
                    Categoria: 'BEBIDAS',
                    Subcategoria: 'GASEOSAS',
                    UnidadMedida: 'ML',
                    Peso: 500,
                    Alto: 20.5,
                    Ancho: 6.5,
                    Largo: 6.5,
                    Descripcion: 'BEBIDA GASEOSA SABOR COLA',
                    PrecioCompra: 2.40,
                    PrecioVenta: 3.40,
                    Stock: 80,
                    StockMinimo: 10,
                    FechaVencimiento: '2025-11-30',
                    FechaElaboracion: '2025-01-10'
                },
                {
                    ID: '',
                    Nombre: 'EJEMPLO PRODUCTO MINIMO',
                    CodigoBarras: '',
                    Marca: '',
                    Proveedor: '',
                    Categoria: '',
                    Subcategoria: '',
                    UnidadMedida: '',
                    Peso: 0,
                    Alto: 0,
                    Ancho: 0,
                    Largo: 0,
                    Descripcion: '',
                    PrecioCompra: 0,
                    PrecioVenta: 0,
                    Stock: 0,
                    StockMinimo: 0,
                    FechaVencimiento: '',
                    FechaElaboracion: ''
                }
            ];

            // Detectar si estamos en Electron
            const isElectron = typeof window !== 'undefined' && window.process && window.process.type;
            
            if (isElectron) {
                // Para Electron, generar CSV
                generarPlantillaCSV(datosPlantilla);
            } else {
                // Para navegador, intentar Excel
                try {
                    const XLSXLib = window.XLSX || XLSX;
                    if (!XLSXLib) {
                        generarPlantillaCSV(datosPlantilla);
                        return;
                    }
                    generarPlantillaExcel(datosPlantilla, XLSXLib);
                } catch (error) {
                    generarPlantillaCSV(datosPlantilla);
                }
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al generar plantilla: ' + error.message
            });
        }
    }

    // 📌 Generar plantilla Excel
    function generarPlantillaExcel(datos, XLSXLib) {
        try {
            const libroExcel = XLSXLib.utils.book_new();
            const hojaExcel = XLSXLib.utils.json_to_sheet(datos);
            
            // Ajustar anchos de columna
            const wscols = [
                {wch: 10}, {wch: 25}, {wch: 15}, {wch: 20}, {wch: 20}, 
                {wch: 15}, {wch: 15}, {wch: 12}, {wch: 10}, {wch: 8}, 
                {wch: 8}, {wch: 8}, {wch: 30}, {wch: 12}, {wch: 12}, 
                {wch: 10}, {wch: 12}, {wch: 15}, {wch: 15}
            ];
            hojaExcel['!cols'] = wscols;

            XLSXLib.utils.book_append_sheet(libroExcel, hojaExcel, "Plantilla_Productos");
            XLSXLib.writeFile(libroExcel, "plantilla_importacion_productos.xlsx");
            
            Swal.fire({
                icon: 'success',
                title: 'Plantilla descargada',
                html: `Plantilla Excel descargada correctamente<br><br><strong>Instrucciones:</strong><br>• Deja la columna ID vacía para productos nuevos<br>• El campo Nombre es obligatorio<br>• Usa formato YYYY-MM-DD para fechas<br>• Borra las filas de ejemplo antes de importar`,
                width: '500px'
            });
        } catch (error) {
            generarPlantillaCSV(datos);
        }
    }

    // 📌 Generar plantilla CSV
    function generarPlantillaCSV(datos) {
        try {
            const headers = Object.keys(datos[0]);
            const csvContent = [
                headers.join(','),
                ...datos.map(producto => 
                    headers.map(header => {
                        const valor = producto[header];
                        if (typeof valor === 'string' && valor.includes(',')) {
                            return `"${valor.replace(/"/g, '""')}"`;
                        }
                        return valor;
                    }).join(',')
                )
            ].join('\n');

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.setAttribute('href', URL.createObjectURL(blob));
            link.setAttribute('download', 'plantilla_importacion_productos.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            Swal.fire({
                icon: 'success',
                title: 'Plantilla CSV descargada',
                html: `Plantilla CSV descargada correctamente<br><br><strong>Instrucciones:</strong><br>• Abre en Excel o Google Sheets<br>• Deja la columna ID vacía para productos nuevos<br>• El campo Nombre es obligatorio<br>• Usa formato YYYY-MM-DD para fechas<br>• Borra las filas de ejemplo antes de importar`,
                width: '500px'
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al generar plantilla CSV: ' + error.message
            });
        }
    }
    
    // 📌 Exportar a Excel (Compatible con Electron)
    if (btnExportarExcel) {
        btnExportarExcel.addEventListener("click", async () => {
            try {
                // Mostrar loading
                Swal.fire({
                    title: 'Exportando productos...',
                    text: 'Obteniendo datos, por favor espera',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                const response = await fetch('/api/productos');
                
                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status}`);
                }
                
                const productos = await response.json();

                if (!productos || productos.length === 0) {
                    Swal.fire({
                        icon: 'info',
                        title: 'Sin datos',
                        text: 'No hay productos para exportar'
                    });
                    return;
                }

                // Detectar si estamos en Electron
                const isElectron = typeof window !== 'undefined' && window.process && window.process.type;
                
                if (isElectron) {
                    // Solución para Electron - usar require si está disponible
                    try {
                        let XLSX_LIB;
                        
                        // Intentar usar require de Electron
                        if (typeof require !== 'undefined') {
                            try {
                                XLSX_LIB = require('xlsx');
                            } catch (e) {
                                console.log('XLSX no disponible via require, intentando método alternativo');
                            }
                        }
                        
                        // Si require no funciona, usar método alternativo para Electron
                        if (!XLSX_LIB) {
                            // Verificar si XLSX está en window
                            if (window.XLSX) {
                                XLSX_LIB = window.XLSX;
                            } else {
                                // Método alternativo: exportación como CSV para Electron
                                exportarComoCSV(productos);
                                return;
                            }
                        }

                        // Continuar con exportación Excel usando XLSX_LIB
                        exportarExcel(productos, XLSX_LIB);
                        
                    } catch (error) {
                        console.log('Error con XLSX en Electron, usando CSV como alternativa');
                        exportarComoCSV(productos);
                    }
                } else {
                    // Navegador normal - usar XLSX estándar
                    const XLSXLib = window.XLSX || XLSX;
                    if (!XLSXLib) {
                        await cargarXLSX();
                    }
                    exportarExcel(productos, window.XLSX || XLSX);
                }
                
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error al exportar',
                    text: 'Error al exportar: ' + error.message
                });
            }
        });
    }

    // 📌 Función para exportar Excel (separada para reutilización)
    function exportarExcel(productos, XLSXLib) {
        try {
            const datosExcel = productos.map(producto => ({
                ID: producto.id || '',
                Nombre: producto.nombre || '',
                CodigoBarras: producto.codigo_barras || '',
                Marca: producto.marca || '',
                Proveedor: producto.proveedor || '',
                Categoria: producto.categoria || '',
                Subcategoria: producto.subcategoria || '',
                UnidadMedida: producto.unidad_medida || '',
                Peso: producto.peso || 0,
                Alto: producto.alto || 0,
                Ancho: producto.ancho || 0,
                Largo: producto.largo || 0,
                Descripcion: producto.descripcion || '',
                PrecioCompra: producto.precio_compra || 0,
                PrecioVenta: producto.precio_venta || 0,
                Stock: producto.stock || 0,
                StockMinimo: producto.stock_minimo || 0,
                FechaVencimiento: formatearFecha(producto.fecha_vencimiento),
                FechaElaboracion: formatearFecha(producto.fecha_elaboracion),
                ProductosRelacionados: producto.productos_relacionados || '',
                UnidadVentaVolumenId: producto.unidad_venta_volumen_id || '',
                PrecioVentaVolumen: producto.precio_venta_volumen || 0,
                CantidadMinimaVolumen: producto.cantidad_minima_volumen || 0,
                FechaCreacion: producto.fecha_creacion || '',
                FechaActualizacion: producto.fecha_actualizacion || '',
            }));

            const libroExcel = XLSXLib.utils.book_new();
            const hojaExcel = XLSXLib.utils.json_to_sheet(datosExcel);
            
            // Ajustar anchos de columna
            const wscols = [
                {wch: 10}, {wch: 30}, {wch: 15}, {wch: 20}, {wch: 20}, 
                {wch: 15}, {wch: 15}, {wch: 12}, {wch: 10}, {wch: 8}, 
                {wch: 8}, {wch: 8}, {wch: 30}, {wch: 12}, {wch: 12}, 
                {wch: 10}, {wch: 12}, {wch: 15}, {wch: 15}
            ];
            hojaExcel['!cols'] = wscols;

            XLSXLib.utils.book_append_sheet(libroExcel, hojaExcel, "Productos");

            // Generar nombre de archivo con fecha
            const fecha = new Date();
            const fechaFormato = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
            const nombreArchivo = `productos_${fechaFormato}.xlsx`;

            XLSXLib.writeFile(libroExcel, nombreArchivo);
            
            Swal.fire({
                icon: 'success',
                title: 'Exportación exitosa',
                text: `Archivo Excel "${nombreArchivo}" descargado correctamente`,
                timer: 3000,
                showConfirmButton: false
            });
        } catch (error) {
            console.log('Error en exportarExcel, intentando CSV como alternativa');
            exportarComoCSV(productos);
        }
    }

    // 📌 Función alternativa para exportar como CSV (para Electron)
    function exportarComoCSV(productos) {
        try {
            const headers = [
                'ID', 'Nombre', 'CodigoBarras', 'Marca', 'Proveedor', 'Categoria', 
                'Subcategoria', 'UnidadMedida', 'Peso', 'Alto', 'Ancho', 'Largo',
                'Descripcion', 'PrecioCompra', 'PrecioVenta', 'Stock', 'StockMinimo',
                'FechaVencimiento', 'FechaElaboracion', 'ProductosRelacionados',
                'UnidadVentaVolumenId', 'PrecioVentaVolumen', 'CantidadMinimaVolumen',
                'FechaCreacion', 'FechaActualizacion'
            ];

            const csvContent = [
                headers.join(','),
                ...productos.map(producto => [
                    producto.id || '',
                    `"${(producto.nombre || '').replace(/"/g, '""')}"`,
                    producto.codigo_barras || '',
                    `"${(producto.marca || '').replace(/"/g, '""')}"`,
                    `"${(producto.proveedor || '').replace(/"/g, '""')}"`,
                    `"${(producto.categoria || '').replace(/"/g, '""')}"`,
                    `"${(producto.subcategoria || '').replace(/"/g, '""')}"`,
                    `"${(producto.unidad_medida || '').replace(/"/g, '""')}"`,
                    producto.peso || 0,
                    producto.alto || 0,
                    producto.ancho || 0,
                    producto.largo || 0,
                    `"${(producto.descripcion || '').replace(/"/g, '""')}"`,
                    producto.precio_compra || 0,
                    producto.precio_venta || 0,
                    producto.stock || 0,
                    producto.stock_minimo || 0,
                    formatearFecha(producto.fecha_vencimiento),
                    formatearFecha(producto.fecha_elaboracion),
                    `"${(producto.productos_relacionados || '').replace(/"/g, '""')}"`,
                    producto.unidad_venta_volumen_id || '',
                    producto.precio_venta_volumen || 0,
                    producto.cantidad_minima_volumen || 0,
                    producto.fecha_creacion || '',
                    producto.fecha_actualizacion || ''
                ].join(','))
            ].join('\n');

            // Crear y descargar archivo CSV
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            const fecha = new Date();
            const fechaFormato = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
            const nombreArchivo = `productos_${fechaFormato}.csv`;
            
            link.setAttribute('href', URL.createObjectURL(blob));
            link.setAttribute('download', nombreArchivo);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            Swal.fire({
                icon: 'success',
                title: 'Exportación CSV exitosa',
                html: `Archivo CSV "${nombreArchivo}" descargado correctamente<br><small>Se exportó como CSV porque estás usando Electron</small>`,
                timer: 4000,
                showConfirmButton: false
            });

        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error al exportar',
                text: 'Error al exportar datos: ' + error.message
            });
        }
    }

    // 📌 Función para formatear fecha correctamente
    function formatearFecha(fechaISO) {
        if (!fechaISO) return "";
        return fechaISO.split("T")[0]; // Convierte "2025-02-12T05:00:00.000Z" a "2025-02-12"
    }

    // 📌 Buscar productos dinámicamente
    inputBuscar.addEventListener("input", async () => {
        const termino = inputBuscar.value.trim();
        if (termino.length < 1) {
            listaSugerencias.style.display = "none";
            // Limpiar campos si se borra la búsqueda
            if (termino === "") {
                limpiarFormulario();
            }
            return;
        }

        try {
            const response = await fetch(`/api/productos/buscar?termino=${termino}`);
            const productos = await response.json();
            listaSugerencias.innerHTML = "";

            if (productos.length === 0) {
                listaSugerencias.innerHTML = `<li class="list-group-item text-muted">❌ Producto No encontrado</li>`;
                listaSugerencias.style.display = "block";
                return;
            }

            // 📌 Si es un código de barras y hay coincidencia exacta, cargar automáticamente
            if (esCodigoBarras(termino)) {
                const productoExacto = productos.find(p => 
                    p.codigo_barras && p.codigo_barras.trim() === termino
                );
                if (productoExacto) {
                    inputBuscar.value = productoExacto.nombre;
                    listaSugerencias.style.display = "none";
                    await cargarProducto(productoExacto.id);
                    Swal.fire({
                        icon: 'success',
                        title: 'Producto cargado automáticamente',
                        text: `Producto "${productoExacto.nombre}" encontrado por código de barras`,
                        timer: 1500,
                        showConfirmButton: false
                    });
                    return;
                }
            }

            // 📌 Mostrar sugerencias para búsqueda por nombre
            productos.forEach(producto => {
                const item = document.createElement("li");
                item.classList.add("list-group-item");
                item.style.cursor = "pointer";
                item.textContent = `${producto.nombre} (${producto.codigo_barras})`;

                item.addEventListener("click", () => {
                    inputBuscar.value = producto.nombre;
                    listaSugerencias.style.display = "none";
                    cargarProducto(producto.id);
                });

                listaSugerencias.appendChild(item);
            });

            listaSugerencias.style.display = "block";
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error en la búsqueda',
                text: 'Error al buscar productos'
            });
        }
    });

    document.addEventListener("click", function (e) {
        if (!listaSugerencias.contains(e.target) && e.target !== inputBuscar) {
            listaSugerencias.style.display = "none";
        }
    });
    
    // 📌 Cargar producto en el formulario
    async function cargarProducto(id) {
        try {
            const response = await fetch(`/api/productos/${id}`);
            if (!response.ok) throw new Error("Producto no encontrado");

            const producto = await response.json();

            document.getElementById("producto_id").value = producto.id || "";
            document.getElementById("nombre").value = producto.nombre || "";
            document.getElementById("codigo_barras").value = producto.codigo_barras || "";
            document.getElementById("marca").value = producto.marca || "";
            document.getElementById("proveedor").value = producto.proveedor || "";
            document.getElementById("categoria").value = producto.categoria || "";
            document.getElementById("subcategoria").value = producto.subcategoria || "";
            document.getElementById("unidad_medida").value = producto.unidad_medida || "";
            document.getElementById("peso").value = producto.peso || "0";
            document.getElementById("alto").value = producto.alto || "0";
            document.getElementById("ancho").value = producto.ancho || "0";
            document.getElementById("largo").value = producto.largo || "0";
            document.getElementById("descripcion").value = producto.descripcion || "";
            document.getElementById("precio_compra").value = producto.precio_compra || "0.00";
            document.getElementById("precio_venta").value = producto.precio_venta || "0.00";
            document.getElementById("stock").value = producto.stock || "0";
            document.getElementById("stock_minimo").value = producto.stock_minimo || "0";
            document.getElementById("fecha_vencimiento").value = producto.fecha_vencimiento ? formatearFecha(producto.fecha_vencimiento) : "";
            document.getElementById("fecha_elaboracion").value = producto.fecha_elaboracion ? formatearFecha(producto.fecha_elaboracion) : "";
            
            const vistaPrevia = document.getElementById("vista-previa-imagen");
            if (producto.imagen) {
                vistaPrevia.src = producto.imagen;
                vistaPrevia.style.display = "block";
            } else {
                vistaPrevia.style.display = "none";
            }

            // Guardar en localStorage para referencia
            localStorage.setItem('productoActual', JSON.stringify(producto));

        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error al cargar producto',
                text: 'No se pudo cargar el producto seleccionado'
            });
        }
    }

    // 📌 Guardar (Crear o Editar producto)
    formularioAgregarProducto.addEventListener("submit", async (event) => {
        event.preventDefault();
    
        const idProducto = document.getElementById("producto_id").value;
        const nombre = document.getElementById("nombre").value.trim().toUpperCase();
        const codigoBarras = document.getElementById("codigo_barras").value.trim();

        // Validar campos obligatorios
        if (!nombre) {
            Swal.fire({
                icon: 'warning',
                title: 'Campo requerido',
                text: 'El nombre del producto es obligatorio'
            });
            return;
        }

        // Validar duplicados
        const productoDuplicado = await validarProductoDuplicado(nombre, codigoBarras, idProducto);
        if (productoDuplicado) {
            let mensaje = '';
            if (productoDuplicado.nombre && productoDuplicado.nombre.toUpperCase() === nombre) {
                mensaje = `Ya existe un producto con el nombre "${nombre}"`;
            } else if (productoDuplicado.codigo_barras === codigoBarras) {
                mensaje = `Ya existe un producto con el código de barras "${codigoBarras}"`;
            }
            
            Swal.fire({
                icon: 'warning',
                title: 'Producto duplicado',
                text: mensaje
            });
            return;
        }
    
        const url = idProducto ? `/api/productos/${idProducto}` : "/api/productos";
        const method = idProducto ? "PUT" : "POST";
    
        const formData = new FormData();
    
        formData.append("nombre", nombre || "SIN NOMBRE");
        formData.append("codigo_barras", codigoBarras || "");
        formData.append("marca", document.getElementById("marca").value.toUpperCase() || "");
        formData.append("proveedor", document.getElementById("proveedor").value.toUpperCase() || "");
        formData.append("categoria", document.getElementById("categoria").value.toUpperCase() || "");
        formData.append("subcategoria", document.getElementById("subcategoria").value.toUpperCase() || "");
        formData.append("unidad_medida", document.getElementById("unidad_medida").value.toUpperCase() || "");
        formData.append("peso", document.getElementById("peso").value || 0);
        formData.append("alto", document.getElementById("alto").value || 0);
        formData.append("ancho", document.getElementById("ancho").value || 0);
        formData.append("largo", document.getElementById("largo").value || 0);
        formData.append("descripcion", document.getElementById("descripcion").value.toUpperCase() || "");
        formData.append("precio_compra", document.getElementById("precio_compra").value || 0);
        formData.append("precio_venta", document.getElementById("precio_venta").value || 0);
        formData.append("stock", document.getElementById("stock").value || 0);
        formData.append("stock_minimo", document.getElementById("stock_minimo").value || 0);
    
        // 📌 Validar fechas antes de enviarlas
        const fechaVencimiento = document.getElementById("fecha_vencimiento").value.trim();
        const fechaElaboracion = document.getElementById("fecha_elaboracion").value.trim();
    
        formData.append("fecha_vencimiento", fechaVencimiento !== "" ? fechaVencimiento : "");
        formData.append("fecha_elaboracion", fechaElaboracion !== "" ? fechaElaboracion : "");
    
        // 📌 Si no se sube una nueva imagen, enviar la imagen actual
        const inputImagen = document.getElementById("imagen");
        const vistaPreviaImagen = document.getElementById("vista-previa-imagen").src;
    
        if (inputImagen.files.length > 0) {
            formData.append("imagen", inputImagen.files[0]);
        } else if (vistaPreviaImagen && vistaPreviaImagen !== "") {
            formData.append("imagen", vistaPreviaImagen);
        }
    
        try {
            const response = await fetch(url, {
                method,
                body: formData
            });
    
            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: `Producto ${idProducto ? "actualizado" : "agregado"}`,
                    text: `El producto ha sido ${idProducto ? "actualizado" : "agregado"} correctamente`,
                    timer: 2000,
                    showConfirmButton: false
                });
                
                // Limpiar formulario después de guardar
                limpiarFormulario();
                
                if (typeof cargarProductos === 'function') {
                    cargarProductos();
                }
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error al guardar',
                    text: 'Error al guardar el producto'
                });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error en la solicitud',
                text: 'Error al conectar con el servidor'
            });
        }
    });
    
     // 📌 Eliminar un producto
     document.querySelector(".btn-danger").addEventListener("click", async function () {
        const idProducto = document.getElementById("producto_id").value;
        if (!idProducto) {
            Swal.fire({
                icon: 'warning',
                title: 'Selecciona un producto',
                text: 'Debes seleccionar un producto primero'
            });
            return;
        }

        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: "Esta acción no se puede deshacer",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/productos/${idProducto}`, { method: "DELETE" });
                if (response.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Producto eliminado',
                        text: 'El producto ha sido eliminado correctamente',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    
                    // Limpiar formulario después de eliminar
                    limpiarFormulario();
                    
                    if (typeof cargarProductos === 'function') {
                        cargarProductos();
                    }
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error al eliminar',
                        text: 'No se pudo eliminar el producto'
                    });
                }
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error en la solicitud',
                    text: 'Error al conectar con el servidor'
                });
            }
        }
    });

    window.cargarProducto = cargarProducto;
});