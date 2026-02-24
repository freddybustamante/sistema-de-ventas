const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const pool = require("../conexion");

// Configurar Multer para manejar archivos en memoria
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 10 * 1024 * 1024 // 10MB máximo
    },
    fileFilter: (req, file, cb) => {
        const tiposPermitidos = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        if (tiposPermitidos.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'), false);
        }
    }
});

// 📌 Función mejorada para normalizar nombres de columnas del Excel
function normalizarColumnas(producto) {
    const productoNormalizado = {};
    
    Object.keys(producto).forEach(key => {
        // Limpiar la clave original
        let keyLimpia = key.toString().trim();
        
        // Si la clave está vacía, omitirla
        if (!keyLimpia) return;

        // Normalizar la clave
        let keyNormalizada = keyLimpia.toLowerCase()
            .replace(/\s+/g, '_')           // Espacios a guiones bajos
            .replace(/[áàäâã]/g, 'a')       // Caracteres especiales
            .replace(/[éèëê]/g, 'e')
            .replace(/[íìïî]/g, 'i')
            .replace(/[óòöô]/g, 'o')
            .replace(/[úùüû]/g, 'u')
            .replace(/ñ/g, 'n')
            .replace(/ç/g, 'c')
            .replace(/[^\w_]/g, '')         // Eliminar caracteres no alfanuméricos excepto _
            .replace(/_+/g, '_')            // Múltiples _ a uno solo
            .replace(/^_|_$/g, '');         // Eliminar _ al inicio y final

        // Mapeo extendido de columnas comunes
        const mapeoColumnas = {
            // Código de barras
            'codigobarras': 'codigo_barras',
            'codigo_barras': 'codigo_barras',
            'codigo_de_barras': 'codigo_barras',
            'barcode': 'codigo_barras',
            'ean': 'codigo_barras',
            'upc': 'codigo_barras',
            
            // Nombre del producto
            'nombre_producto': 'nombre',
            'product_name': 'nombre',
            'producto': 'nombre',
            'item': 'nombre',
            'articulo': 'nombre',
            
            // Unidad de medida
            'unidadmedida': 'unidad_medida',
            'unidad_de_medida': 'unidad_medida',
            'unidad': 'unidad_medida',
            'medida': 'unidad_medida',
            'unit': 'unidad_medida',
            
            // Precios
            'preciocompra': 'precio_compra',
            'precio_de_compra': 'precio_compra',
            'precio_compra': 'precio_compra',
            'costo': 'precio_compra',
            'cost': 'precio_compra',
            
            'precioventa': 'precio_venta',
            'precio_de_venta': 'precio_venta',
            'precio': 'precio_venta',
            'price': 'precio_venta',
            'pvp': 'precio_venta',
            
            // Stock
            'stockminimo': 'stock_minimo',
            'stock_minimo': 'stock_minimo',
            'stock_min': 'stock_minimo',
            'minimo': 'stock_minimo',
            'existencia': 'stock',
            'cantidad': 'stock',
            'inventory': 'stock',
            
            // Fechas
            'fechavencimiento': 'fecha_vencimiento',
            'fecha_de_vencimiento': 'fecha_vencimiento',
            'vencimiento': 'fecha_vencimiento',
            'expiry_date': 'fecha_vencimiento',
            'exp_date': 'fecha_vencimiento',
            
            'fechaelaboracion': 'fecha_elaboracion',
            'fecha_de_elaboracion': 'fecha_elaboracion',
            'elaboracion': 'fecha_elaboracion',
            'manufacturing_date': 'fecha_elaboracion',
            
            // Otros campos
            'descripcion': 'descripcion',
            'description': 'descripcion',
            'detalle': 'descripcion',
            'observaciones': 'descripcion',
            
            'categoria': 'categoria',
            'category': 'categoria',
            'tipo': 'categoria',
            
            'subcategoria': 'subcategoria',
            'subcategory': 'subcategoria',
            'subtipo': 'subcategoria',
            
            'marca': 'marca',
            'brand': 'marca',
            'fabricante': 'marca',
            
            'proveedor': 'proveedor',
            'supplier': 'proveedor',
            'distribuidor': 'proveedor'
        };

        keyNormalizada = mapeoColumnas[keyNormalizada] || keyNormalizada;
        
        // Solo agregar si el valor no está vacío
        const valor = producto[key];
        if (valor !== null && valor !== undefined && valor !== '') {
            productoNormalizado[keyNormalizada] = valor;
        }
    });

    return productoNormalizado;
}

// 📌 Función mejorada para normalizar valores de un producto
function normalizarProducto(producto) {
    const productoNormalizado = { ...producto };

    // Normalizar strings: trim y uppercase para campos de texto
    const camposTexto = ['nombre', 'marca', 'proveedor', 'categoria', 'subcategoria', 'unidad_medida'];
    camposTexto.forEach(campo => {
        if (productoNormalizado[campo]) {
            productoNormalizado[campo] = productoNormalizado[campo].toString().trim().toUpperCase();
        }
    });

    // Normalizar descripción (mantener mayúsculas y minúsculas)
    if (productoNormalizado.descripcion) {
        productoNormalizado.descripcion = productoNormalizado.descripcion.toString().trim();
    }

    // Normalizar código de barras (eliminar espacios y caracteres especiales)
    if (productoNormalizado.codigo_barras) {
        productoNormalizado.codigo_barras = productoNormalizado.codigo_barras.toString()
            .replace(/\s+/g, '')
            .replace(/[^\w]/g, '');
    }

    // Normalizar números
    const camposNumericos = ['peso', 'alto', 'ancho', 'largo', 'precio_compra', 'precio_venta', 'stock', 'stock_minimo'];
    camposNumericos.forEach(campo => {
        if (productoNormalizado[campo] !== null && productoNormalizado[campo] !== undefined && productoNormalizado[campo] !== '') {
            const valor = parseFloat(productoNormalizado[campo]);
            productoNormalizado[campo] = isNaN(valor) ? null : valor;
        }
    });

    // Normalizar enteros específicos
    const camposEnteros = ['stock', 'stock_minimo', 'cantidad_minima_volumen'];
    camposEnteros.forEach(campo => {
        if (productoNormalizado[campo] !== null && productoNormalizado[campo] !== undefined) {
            const valor = parseInt(productoNormalizado[campo]);
            productoNormalizado[campo] = isNaN(valor) ? null : valor;
        }
    });

    // Normalizar fechas
    const camposFecha = ['fecha_vencimiento', 'fecha_elaboracion'];
    camposFecha.forEach(campo => {
        if (productoNormalizado[campo]) {
            const fecha = new Date(productoNormalizado[campo]);
            productoNormalizado[campo] = isNaN(fecha.getTime()) ? null : fecha;
        }
    });

    return productoNormalizado;
}

// 📌 Función mejorada para validar un producto individual
function validarProducto(producto, indice) {
    const errores = [];
    const advertencias = [];
    const fila = indice + 2; // +2 porque empezamos desde fila 1 y hay encabezados

    // 🚨 CAMPO OBLIGATORIO: nombre
    const nombre = producto.nombre || '';
    if (!nombre || nombre.toString().trim() === '') {
        errores.push(`Fila ${fila}: El campo "nombre" es obligatorio y no puede estar vacío`);
    } else {
        // Validar longitud del nombre
        if (nombre.toString().length > 255) {
            errores.push(`Fila ${fila}: El nombre es demasiado largo (máximo 255 caracteres)`);
        }
        // Validar caracteres mínimos
        if (nombre.toString().trim().length < 2) {
            errores.push(`Fila ${fila}: El nombre debe tener al menos 2 caracteres`);
        }
    }

    // Validar código de barras (opcional pero si existe debe ser válido)
    if (producto.codigo_barras) {
        const codigoBarras = producto.codigo_barras.toString().replace(/\s+/g, '');
        if (codigoBarras.length < 8 || codigoBarras.length > 18) {
            advertencias.push(`Fila ${fila}: El código de barras "${codigoBarras}" tiene una longitud inusual`);
        }
        if (!/^\d+$/.test(codigoBarras)) {
            advertencias.push(`Fila ${fila}: El código de barras contiene caracteres no numéricos`);
        }
    }

    // Validar campos numéricos
    const camposNumericos = ['peso', 'alto', 'ancho', 'largo', 'precio_compra', 'precio_venta', 'stock', 'stock_minimo'];
    camposNumericos.forEach(campo => {
        const valor = producto[campo];
        if (valor !== null && valor !== undefined && valor !== '') {
            const numeroValor = parseFloat(valor);
            if (isNaN(numeroValor)) {
                errores.push(`Fila ${fila}: El campo "${campo}" debe ser un número válido (valor: "${valor}")`);
            } else if (numeroValor < 0) {
                errores.push(`Fila ${fila}: El campo "${campo}" no puede ser negativo`);
            } else if (['precio_compra', 'precio_venta'].includes(campo) && numeroValor > 999999) {
                advertencias.push(`Fila ${fila}: El "${campo}" parece muy alto (${numeroValor})`);
            }
        }
    });

    // Validar fechas
    const camposFecha = ['fecha_vencimiento', 'fecha_elaboracion'];
    camposFecha.forEach(campo => {
        const fecha = producto[campo];
        if (fecha && fecha !== '') {
            const fechaObj = new Date(fecha);
            if (isNaN(fechaObj.getTime())) {
                errores.push(`Fila ${fila}: El campo "${campo}" debe tener formato de fecha válido (valor: "${fecha}")`);
            } else {
                // Validar fechas lógicas
                const ahora = new Date();
                if (campo === 'fecha_vencimiento' && fechaObj < ahora) {
                    advertencias.push(`Fila ${fila}: La fecha de vencimiento ya pasó`);
                }
                if (campo === 'fecha_elaboracion' && fechaObj > ahora) {
                    advertencias.push(`Fila ${fila}: La fecha de elaboración es futura`);
                }
            }
        }
    });

    // Validar relación entre precios
    if (producto.precio_compra && producto.precio_venta) {
        const precioCompra = parseFloat(producto.precio_compra);
        const precioVenta = parseFloat(producto.precio_venta);
        if (!isNaN(precioCompra) && !isNaN(precioVenta) && precioVenta < precioCompra) {
            advertencias.push(`Fila ${fila}: El precio de venta es menor al precio de compra`);
        }
    }

    return {
        valido: errores.length === 0,
        errores: errores,
        advertencias: advertencias
    };
}

// 📌 Función para verificar duplicados
async function verificarDuplicados(productosValidos) {
    const productosUnicos = [];
    const duplicadosEncontrados = [];
    const nombresVistos = new Set();
    const codigosVistos = new Set();

    // Verificar duplicados en el archivo actual
    for (let i = 0; i < productosValidos.length; i++) {
        const producto = productosValidos[i];
        const nombre = producto.nombre?.toUpperCase().trim();
        const codigoBarras = producto.codigo_barras;
        
        let esDuplicado = false;
        let razonDuplicado = [];

        // Verificar duplicado por nombre
        if (nombre && nombresVistos.has(nombre)) {
            esDuplicado = true;
            razonDuplicado.push('nombre duplicado en el archivo');
        } else if (nombre) {
            nombresVistos.add(nombre);
        }

        // Verificar duplicado por código de barras
        if (codigoBarras && codigosVistos.has(codigoBarras)) {
            esDuplicado = true;
            razonDuplicado.push('código de barras duplicado en el archivo');
        } else if (codigoBarras) {
            codigosVistos.add(codigoBarras);
        }

        if (esDuplicado) {
            duplicadosEncontrados.push({
                fila: i + 2,
                nombre: nombre,
                codigo_barras: codigoBarras,
                razon: razonDuplicado.join(', ')
            });
        } else {
            productosUnicos.push(producto);
        }
    }

    // Verificar duplicados en la base de datos
    if (productosUnicos.length > 0) {
        const nombres = productosUnicos.map(p => p.nombre).filter(n => n);
        const codigos = productosUnicos.map(p => p.codigo_barras).filter(c => c);

        let sqlCheck = '';
        let params = [];

        if (nombres.length > 0 && codigos.length > 0) {
            sqlCheck = 'SELECT nombre, codigo_barras FROM productos WHERE nombre IN (?) OR codigo_barras IN (?)';
            params = [nombres, codigos];
        } else if (nombres.length > 0) {
            sqlCheck = 'SELECT nombre, codigo_barras FROM productos WHERE nombre IN (?)';
            params = [nombres];
        } else if (codigos.length > 0) {
            sqlCheck = 'SELECT nombre, codigo_barras FROM productos WHERE codigo_barras IN (?)';
            params = [codigos];
        }

        if (sqlCheck) {
            const [existentes] = await pool.query(sqlCheck, params);
            const existentesSet = new Set();
            
            existentes.forEach(row => {
                if (row.nombre) existentesSet.add(`nombre:${row.nombre}`);
                if (row.codigo_barras) existentesSet.add(`codigo:${row.codigo_barras}`);
            });

            // Filtrar productos que ya existen en BD
            const productosFiltrados = [];
            for (let i = 0; i < productosUnicos.length; i++) {
                const producto = productosUnicos[i];
                let existeEnBD = false;
                let razonExistencia = [];

                if (producto.nombre && existentesSet.has(`nombre:${producto.nombre}`)) {
                    existeEnBD = true;
                    razonExistencia.push('nombre ya existe en BD');
                }

                if (producto.codigo_barras && existentesSet.has(`codigo:${producto.codigo_barras}`)) {
                    existeEnBD = true;
                    razonExistencia.push('código de barras ya existe en BD');
                }

                if (existeEnBD) {
                    duplicadosEncontrados.push({
                        fila: productosValidos.indexOf(producto) + 2,
                        nombre: producto.nombre,
                        codigo_barras: producto.codigo_barras,
                        razon: razonExistencia.join(', ')
                    });
                } else {
                    productosFiltrados.push(producto);
                }
            }

            return {
                productosUnicos: productosFiltrados,
                duplicados: duplicadosEncontrados
            };
        }
    }

    return {
        productosUnicos: productosUnicos,
        duplicados: duplicadosEncontrados
    };
}

// Ruta para importar productos desde Excel
router.post("/", upload.single("archivo"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                error: "No se ha subido ningún archivo",
                details: "Debe seleccionar un archivo Excel para importar" 
            });
        }

        // Leer archivo Excel
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const productosRaw = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { 
            defval: '',
            blankrows: false // Omitir filas completamente vacías
        });

        if (!productosRaw || productosRaw.length === 0) {
            return res.status(400).json({ 
                error: "El archivo Excel está vacío o no tiene datos válidos",
                details: "Verifique que el archivo tenga encabezados y al menos una fila de datos" 
            });
        }

        // 📌 Procesar productos: normalizar columnas, valores y validar
        const productosValidos = [];
        const erroresValidacion = [];
        const advertenciasValidacion = [];
        let productosOmitidos = 0;

        for (let i = 0; i < productosRaw.length; i++) {
            const productoRaw = productosRaw[i];
            
            // Verificar si la fila está completamente vacía
            const valoresNoVacios = Object.values(productoRaw).filter(val => 
                val !== null && val !== undefined && val !== ''
            );
            
            if (valoresNoVacios.length === 0) {
                productosOmitidos++;
                continue;
            }
            
            // Normalizar nombres de columnas
            const productoConColumnasNormalizadas = normalizarColumnas(productoRaw);
            
            // Normalizar valores
            const productoNormalizado = normalizarProducto(productoConColumnasNormalizadas);
            
            // Validar producto
            const validacion = validarProducto(productoNormalizado, i);
            
            if (!validacion.valido) {
                erroresValidacion.push(...validacion.errores);
                productosOmitidos++;
                continue;
            }

            // Agregar advertencias
            if (validacion.advertencias.length > 0) {
                advertenciasValidacion.push(...validacion.advertencias);
            }

            // Agregar a lista de productos válidos
            productosValidos.push(productoNormalizado);
        }

        // Si hay errores críticos y no hay productos válidos, devolver error
        if (erroresValidacion.length > 0 && productosValidos.length === 0) {
            return res.status(400).json({ 
                error: "No se pudo procesar ningún producto",
                details: erroresValidacion.join('; ')
            });
        }

        // 📌 Verificar duplicados
        const { productosUnicos, duplicados } = await verificarDuplicados(productosValidos);
        
        // Actualizar contadores
        productosOmitidos += duplicados.length;

        // 📌 Convertir los datos únicos para MySQL
        let productosInsertados = 0;
        if (productosUnicos.length > 0) {
            const valores = productosUnicos.map((producto) => [
                // 🚨 ASEGURAR que nombre nunca sea null
                (producto.nombre || '').toString().trim() || 'SIN NOMBRE',
                producto.codigo_barras || null,
                producto.marca || null,
                producto.proveedor || null,
                producto.categoria || null,
                producto.subcategoria || null,
                producto.unidad_medida || null,
                producto.peso || null,
                producto.alto || null,
                producto.ancho || null,
                producto.largo || null,
                producto.descripcion || null,
                producto.imagen || null,
                producto.precio_compra || null,
                producto.precio_venta || null,
                producto.stock || null,
                producto.stock_minimo || null,
                producto.fecha_vencimiento || null,
                producto.fecha_elaboracion || null,
                producto.productos_relacionados || null,
                producto.unidad_venta_volumen_id || null,
                producto.precio_venta_volumen || null,
                producto.cantidad_minima_volumen || null,
            ]);

            const sql = `
                INSERT INTO productos (
                    nombre, codigo_barras, marca, proveedor, categoria, subcategoria, unidad_medida, peso, alto, ancho, largo,
                    descripcion, imagen, precio_compra, precio_venta, stock, stock_minimo, fecha_vencimiento, fecha_elaboracion, 
                    productos_relacionados, unidad_venta_volumen_id, precio_venta_volumen, cantidad_minima_volumen
                ) VALUES ?`;

            const [result] = await pool.query(sql, [valores]);
            productosInsertados = result.affectedRows;
        }

        // 📌 Respuesta detallada
        const respuesta = {
            message: "Importación completada",
            productos_procesados: productosRaw.length,
            productos_insertados: productosInsertados,
            productos_omitidos: productosOmitidos,
            resumen: {
                total_filas: productosRaw.length,
                insertados: productosInsertados,
                omitidos_por_errores: erroresValidacion.length > 0 ? Math.ceil(erroresValidacion.length / 2) : 0, // Estimación
                omitidos_por_duplicados: duplicados.length,
                otros_omitidos: productosOmitidos - duplicados.length
            }
        };

        // Incluir información sobre duplicados
        if (duplicados.length > 0) {
            respuesta.duplicados_omitidos = duplicados.slice(0, 10).map(dup => 
                `Fila ${dup.fila}: ${dup.nombre || 'Sin nombre'} (${dup.razon})`
            );
            
            if (duplicados.length > 10) {
                respuesta.duplicados_omitidos.push(`... y ${duplicados.length - 10} duplicados más`);
            }
        }

        // Incluir errores de validación
        if (erroresValidacion.length > 0) {
            respuesta.errores_validacion = erroresValidacion.slice(0, 10);
            
            if (erroresValidacion.length > 10) {
                respuesta.errores_validacion.push(`... y ${erroresValidacion.length - 10} errores más`);
            }
        }

        // Incluir advertencias
        if (advertenciasValidacion.length > 0) {
            respuesta.advertencias = advertenciasValidacion.slice(0, 10);
            
            if (advertenciasValidacion.length > 10) {
                respuesta.advertencias.push(`... y ${advertenciasValidacion.length - 10} advertencias más`);
            }
        }

        res.json(respuesta);

    } catch (error) {
        console.error("❌ Error al importar productos:", error);
        
        // Errores específicos más informativos
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ 
                error: "Producto duplicado encontrado",
                details: "Uno o más productos ya existen en la base de datos (nombre o código de barras duplicado)" 
            });
        }
        
        if (error.code === 'ER_DATA_TOO_LONG') {
            return res.status(400).json({ 
                error: "Datos demasiado largos",
                details: "Uno o más campos exceden la longitud máxima permitida" 
            });
        }
        
        if (error.code === 'ER_BAD_NULL_ERROR') {
            return res.status(400).json({ 
                error: "Campo obligatorio faltante",
                details: "El campo 'nombre' es obligatorio y no puede estar vacío" 
            });
        }

        res.status(500).json({ 
            error: "Error interno del servidor", 
            details: error.message 
        });
    }
});

module.exports = router;