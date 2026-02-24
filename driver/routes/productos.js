const express = require('express');
const router = express.Router();
const pool = require('../conexion'); // Importamos el pool de conexiones
const multer = require('multer');
const path = require('path');

// 📌 Configurar almacenamiento de imágenes con Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/uploads/')); // 📌 Guardar en `public/uploads/`
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // 📌 Nombre único
    }
});

// 📌 Definir 'upload' antes de usarlo
const upload = multer({ storage });

// 📌 Obtener todos los productos
router.get('/', async (req, res) => {
    try {
        const [productos] = await pool.query('SELECT * FROM productos');
        res.json(productos);
    } catch (error) {
        console.error('❌ Error al obtener productos:', error);
        res.status(500).json({ error: 'Error al obtener productos del servidor', details: error.message });
    }
});

// para consultar STOCK
// 📌 Obtener productos con stock bajo o próximos a vencer
// ✅ Esta va primero
router.get('/alertas-stock', async (req, res) => {
    try {
      const [filas] = await pool.query(`
      SELECT 
      id,
      nombre,
      stock,
      stock_minimo,
      fecha_vencimiento,
      CASE
        WHEN stock = 0 THEN 'Agotado'
        WHEN stock <= stock_minimo THEN 'Bajo'
        ELSE 'OK'
      END AS estado_stock,
      CASE
        WHEN fecha_vencimiento IS NULL THEN 'Sin fecha'
        WHEN fecha_vencimiento < CURDATE() THEN 'Vencido'
        WHEN fecha_vencimiento BETWEEN CURDATE() AND CURDATE() + INTERVAL 15 DAY THEN 'Próximo'
        ELSE 'OK'
      END AS estado_vencimiento,
      CASE
        WHEN stock <= stock_minimo AND fecha_vencimiento <= CURDATE() + INTERVAL 15 DAY THEN 'Stock y Vencimiento'
        WHEN stock <= stock_minimo THEN 'Stock'
        WHEN fecha_vencimiento <= CURDATE() + INTERVAL 15 DAY THEN 'Vencimiento'
        ELSE 'Ninguna'
      END AS tipo_alerta
    FROM productos
    WHERE stock <= stock_minimo
       OR (fecha_vencimiento IS NOT NULL AND fecha_vencimiento <= CURDATE() + INTERVAL 15 DAY)
    LIMIT 50;
    `);
  
      res.json(filas);
    } catch (error) {
      console.error("❌ Error en alerta:", error.message);
      res.status(500).json({ error: 'Error al obtener alertas de stock/vencimiento' });
    }
});

// 📌 NUEVO ENDPOINT: Validar duplicados
router.get('/validar-duplicados', async (req, res) => {
    try {
        const { nombre, codigo_barras, excluir_id } = req.query;
        
        if (!nombre && !codigo_barras) {
            return res.json({ esValido: true });
        }

        let condiciones = [];
        let parametros = [];
        
        if (nombre && nombre.trim()) {
            condiciones.push('LOWER(nombre) = LOWER(?)');
            parametros.push(nombre.trim());
        }
        
        if (codigo_barras && codigo_barras.trim()) {
            condiciones.push('codigo_barras = ?');
            parametros.push(codigo_barras.trim());
        }
        
        let consulta = `SELECT id, nombre, codigo_barras FROM productos WHERE (${condiciones.join(' OR ')})`;
        
        if (excluir_id) {
            consulta += ' AND id != ?';
            parametros.push(excluir_id);
        }
        
        const [productos] = await pool.query(consulta, parametros);
        
        if (productos.length === 0) {
            return res.json({ esValido: true });
        }
        
        // Verificar qué tipo de duplicado encontramos
        const duplicadoNombre = productos.some(producto => 
            nombre && producto.nombre.toLowerCase() === nombre.toLowerCase()
        );
        
        const duplicadoCodigo = productos.some(producto => 
            codigo_barras && producto.codigo_barras === codigo_barras
        );
        
        res.json({
            esValido: false,
            duplicadoNombre,
            duplicadoCodigo,
            productos: productos.map(p => ({
                id: p.id,
                nombre: p.nombre,
                codigo_barras: p.codigo_barras
            }))
        });
        
    } catch (error) {
        console.error('❌ Error al validar duplicados:', error);
        res.status(500).json({ 
            error: 'Error al validar duplicados', 
            details: error.message 
        });
    }
});

// 📌 Buscar productos por nombre o código de barras (máx. 10 resultados)
// 📌 Buscar productos por nombre o código de barras (máx. 10 resultados)
router.get('/buscar', async (req, res) => {
    const termino = req.query.termino;
    if (!termino || termino.trim() === '') {
        return res.json([]);
    }

    try {
        // Limpiar el término de búsqueda (quitar espacios y caracteres especiales)
        const terminoLimpio = termino.trim().replace(/[\r\n\t]/g, '');
        
        const [productos] = await pool.query(
            `SELECT * FROM productos 
             WHERE UPPER(nombre) LIKE UPPER(?) 
             OR TRIM(codigo_barras) = ? 
             OR codigo_barras LIKE ? 
             LIMIT 10`,
            [`%${terminoLimpio}%`, terminoLimpio, `%${terminoLimpio}%`]
        );
        res.json(productos);
    } catch (error) {
        console.error('❌ Error en la búsqueda:', error);
        res.status(500).json({ error: 'Error en la búsqueda', details: error.message });
    }
});

// 📌 Obtener un producto por ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [producto] = await pool.query('SELECT * FROM productos WHERE id = ? ', [id]);
        if (producto.length === 0) {
            return res.status(404).json({ mensaje: "❌ Producto no encontrado" });
        }
        res.json(producto[0]); // Retornar solo el primer resultado
    } catch (error) {
        console.error("❌ Error al obtener producto:", error);
        res.status(500).json({ mensaje: "Error en el servidor" });
    }
});

// 📌 Agregar un nuevo producto
router.post('/', upload.single('imagen'), async (req, res) => {
    try {
        const nuevoProducto = req.body;
        const imagenRuta = req.file ? `/uploads/${req.file.filename}` : null;

        // 📌 Validar duplicados antes de insertar
        if (nuevoProducto.nombre || nuevoProducto.codigo_barras) {
            let condiciones = [];
            let parametros = [];
            
            if (nuevoProducto.nombre && nuevoProducto.nombre.trim()) {
                condiciones.push('LOWER(nombre) = LOWER(?)');
                parametros.push(nuevoProducto.nombre.trim());
            }
            
            if (nuevoProducto.codigo_barras && nuevoProducto.codigo_barras.trim()) {
                condiciones.push('codigo_barras = ?');
                parametros.push(nuevoProducto.codigo_barras.trim());
            }
            
            if (condiciones.length > 0) {
                const consultaDuplicados = `SELECT nombre, codigo_barras FROM productos WHERE ${condiciones.join(' OR ')}`;
                const [duplicados] = await pool.query(consultaDuplicados, parametros);
                
                if (duplicados.length > 0) {
                    const duplicado = duplicados[0];
                    let mensaje = '⚠️ Ya existe un producto con ';
                    
                    if (nuevoProducto.nombre && duplicado.nombre.toLowerCase() === nuevoProducto.nombre.toLowerCase()) {
                        mensaje += `el nombre "${nuevoProducto.nombre}"`;
                    }
                    
                    if (nuevoProducto.codigo_barras && duplicado.codigo_barras === nuevoProducto.codigo_barras) {
                        if (mensaje.includes('nombre')) mensaje += ' y ';
                        mensaje += `el código de barras "${nuevoProducto.codigo_barras}"`;
                    }
                    
                    return res.status(409).json({ 
                        error: 'Producto duplicado',
                        message: mensaje
                    });
                }
            }
        }

        // 📌 Convertimos "NULL" en null para evitar errores de MySQL
        const fechaVencimiento = nuevoProducto.fecha_vencimiento && nuevoProducto.fecha_vencimiento !== "NULL"
            ? nuevoProducto.fecha_vencimiento 
            : null;

        const fechaElaboracion = nuevoProducto.fecha_elaboracion && nuevoProducto.fecha_elaboracion !== "NULL"
            ? nuevoProducto.fecha_elaboracion 
            : null;

        // 🔧 CORREGIDO: Validar unidad_venta_volumen_id correctamente
        const unidadVentaVolumenId = validarUnidadVentaVolumenId(nuevoProducto.unidad_venta_volumen_id);

        console.log('🔍 DEBUG - unidad_venta_volumen_id:', {
            original: nuevoProducto.unidad_venta_volumen_id,
            procesado: unidadVentaVolumenId,
            tipo: typeof unidadVentaVolumenId
        });

        const sql = `INSERT INTO productos 
            (nombre, codigo_barras, marca, proveedor, categoria, subcategoria, unidad_medida, peso, alto, ancho, largo, 
            descripcion, imagen, precio_compra, precio_venta, stock, stock_minimo, fecha_vencimiento, fecha_elaboracion, 
            productos_relacionados, unidad_venta_volumen_id, precio_venta_volumen, cantidad_minima_volumen) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = [
            nuevoProducto.nombre, nuevoProducto.codigo_barras || null, nuevoProducto.marca || null, nuevoProducto.proveedor || null,
            nuevoProducto.categoria || null, nuevoProducto.subcategoria || null, nuevoProducto.unidad_medida || null,
            nuevoProducto.peso || 0, nuevoProducto.alto || 0, nuevoProducto.ancho || 0, nuevoProducto.largo || 0,
            nuevoProducto.descripcion || null, imagenRuta, nuevoProducto.precio_compra, nuevoProducto.precio_venta,
            nuevoProducto.stock, nuevoProducto.stock_minimo || 0, 
            fechaVencimiento, 
            fechaElaboracion, 
            nuevoProducto.productos_relacionados || null, 
            unidadVentaVolumenId, // 🔧 CORREGIDO: Usar la función de validación
            nuevoProducto.precio_venta_volumen || 0, nuevoProducto.cantidad_minima_volumen || 0
        ];

        const [result] = await pool.query(sql, values);
        res.status(201).json({ message: '✅ Producto agregado correctamente', id: result.insertId });

    } catch (error) {
        console.error('❌ Error al agregar producto:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ 
                error: 'Código de barras duplicado',
                message: '⚠️ Ya existe un producto con este código de barras' 
            });
        }
        res.status(500).json({ error: 'Error al agregar producto', details: error.message });
    }
});

router.put('/:id', upload.single('imagen'), async (req, res) => {
    try {
        const idProducto = req.params.id;
        const productoEditado = req.body;

        // 📌 Validar duplicados antes de actualizar (excluyendo el producto actual)
        if (productoEditado.nombre || productoEditado.codigo_barras) {
            let condiciones = [];
            let parametros = [];
            
            if (productoEditado.nombre && productoEditado.nombre.trim()) {
                condiciones.push('LOWER(nombre) = LOWER(?)');
                parametros.push(productoEditado.nombre.trim());
            }
            
            if (productoEditado.codigo_barras && productoEditado.codigo_barras.trim()) {
                condiciones.push('codigo_barras = ?');
                parametros.push(productoEditado.codigo_barras.trim());
            }
            
            if (condiciones.length > 0) {
                const consultaDuplicados = `SELECT nombre, codigo_barras FROM productos WHERE (${condiciones.join(' OR ')}) AND id != ?`;
                parametros.push(idProducto);
                const [duplicados] = await pool.query(consultaDuplicados, parametros);
                
                if (duplicados.length > 0) {
                    const duplicado = duplicados[0];
                    let mensaje = '⚠️ Ya existe otro producto con ';
                    
                    if (productoEditado.nombre && duplicado.nombre.toLowerCase() === productoEditado.nombre.toLowerCase()) {
                        mensaje += `el nombre "${productoEditado.nombre}"`;
                    }
                    
                    if (productoEditado.codigo_barras && duplicado.codigo_barras === productoEditado.codigo_barras) {
                        if (mensaje.includes('nombre')) mensaje += ' y ';
                        mensaje += `el código de barras "${productoEditado.codigo_barras}"`;
                    }
                    
                    return res.status(409).json({ 
                        error: 'Producto duplicado',
                        message: mensaje
                    });
                }
            }
        }

        let imagenRuta = productoEditado.imagen || null;

        // 📌 Si se sube una nueva imagen, actualizar la ruta
        if (req.file) {
            imagenRuta = `/uploads/${req.file.filename}`;
        }

        // 📌 Si no hay imagen en la BD ni en el frontend, guardar NULL
        if (imagenRuta === "null" || imagenRuta === "") {
            imagenRuta = null;
        }

        // 📌 Validar fechas antes de actualizar
        const fechaVencimiento = productoEditado.fecha_vencimiento && productoEditado.fecha_vencimiento.trim() !== ""
            ? productoEditado.fecha_vencimiento 
            : null;

        const fechaElaboracion = productoEditado.fecha_elaboracion && productoEditado.fecha_elaboracion.trim() !== ""
            ? productoEditado.fecha_elaboracion 
            : null;

        // 🔧 CORREGIDO: Validar unidad_venta_volumen_id correctamente
        const unidadVentaVolumenId = validarUnidadVentaVolumenId(productoEditado.unidad_venta_volumen_id);

        console.log(`🖼️ Imagen enviada a MySQL: ${imagenRuta}`);
        console.log(`📅 Fecha Vencimiento enviada a MySQL: ${fechaVencimiento}`);
        console.log(`📅 Fecha Elaboración enviada a MySQL: ${fechaElaboracion}`);
        console.log('🔍 DEBUG - unidad_venta_volumen_id:', {
            original: productoEditado.unidad_venta_volumen_id,
            procesado: unidadVentaVolumenId,
            tipo: typeof unidadVentaVolumenId
        });

        const sql = `UPDATE productos SET 
            nombre=?, codigo_barras=?, marca=?, proveedor=?, categoria=?, subcategoria=?, 
            unidad_medida=?, peso=?, alto=?, ancho=?, largo=?, descripcion=?, imagen=?, 
            precio_compra=?, precio_venta=?, stock=?, stock_minimo=?, productos_relacionados=?, 
            unidad_venta_volumen_id=?, precio_venta_volumen=?, cantidad_minima_volumen=?, 
            fecha_vencimiento=?, fecha_elaboracion=? WHERE id=?`;

        const values = [
            productoEditado.nombre, productoEditado.codigo_barras || null, productoEditado.marca || null, 
            productoEditado.proveedor || null, productoEditado.categoria || null, productoEditado.subcategoria || null, 
            productoEditado.unidad_medida || null, productoEditado.peso || 0, productoEditado.alto || 0, 
            productoEditado.ancho || 0, productoEditado.largo || 0, productoEditado.descripcion || null, 
            imagenRuta, productoEditado.precio_compra, productoEditado.precio_venta, productoEditado.stock, 
            productoEditado.stock_minimo || 0, productoEditado.productos_relacionados || null, 
            unidadVentaVolumenId, // 🔧 CORREGIDO: Usar la función de validación
            productoEditado.precio_venta_volumen || 0, 
            productoEditado.cantidad_minima_volumen || 0, 
            fechaVencimiento, fechaElaboracion, idProducto
        ];

        await pool.query(sql, values);

        res.json({ message: "✅ Producto actualizado correctamente." });

    } catch (error) {
        console.error("❌ Error al actualizar producto:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ 
                error: 'Código de barras duplicado',
                message: '⚠️ Ya existe otro producto con este código de barras' 
            });
        }
        res.status(500).json({ error: "Error al actualizar producto", details: error.message });
    }
});

// 📌 Eliminar un producto por ID
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM productos WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ mensaje: "❌ Producto no encontrado" });
        }

        res.json({ mensaje: "✅ Producto eliminado correctamente" });

    } catch (error) {
        console.error("❌ Error al eliminar producto:", error);
        res.status(500).json({ mensaje: "Error en el servidor" });
    }
});

function validarUnidadVentaVolumenId(valor) {
    // Si es null, undefined, string vacío, "null", "undefined", "0", 0, o false
    if (!valor || valor === '' || valor === 'null' || valor === 'undefined' || valor === '0' || valor === 0) {
        return null;
    }
    
    // Convertir a número entero
    const numeroId = parseInt(valor);
    
    // Si no es un número válido o es menor/igual a 0, retornar null
    if (isNaN(numeroId) || numeroId <= 0) {
        return null;
    }
    
    return numeroId;
}

module.exports = router;