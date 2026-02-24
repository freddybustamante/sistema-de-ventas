const express = require('express');
const router = express.Router();
const pool = require('../conexion'); // Importamos la conexión centralizada

// Ruta POST para registrar ventas
router.post('/', async (req, res) => {
    const venta = req.body;
    const productos = venta.productos;
    const pagos = venta.pagos || [];

    let totalProfit = 0;
    
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        // Actualizar stock y calcular ganancia de cada producto
        for (const producto of productos) {
            // Consultar datos del producto (precio_compra, precio_venta y stock)
            const [rows] = await connection.query(
                'SELECT nombre, precio_compra, precio_venta, stock FROM productos WHERE id = ?',
                [producto.id]
            );
            if (rows.length === 0) {
                throw new Error(`Producto con ID ${producto.id} no encontrado`);
            }
            const dbProducto = rows[0];

            // Verificar stock suficiente
            if (dbProducto.stock < producto.cantidad) {
                throw new Error(`⚠️ Stock insuficiente para el producto "${dbProducto.nombre}". Solo quedan ${dbProducto.stock} unidades.`);
            }

            // Calcular ganancia para este producto
            const profitProducto = (dbProducto.precio_venta - dbProducto.precio_compra) * producto.cantidad;
            totalProfit += profitProducto;

            // Actualizar stock
            await connection.query('UPDATE productos SET stock = stock - ? WHERE id = ?', [producto.cantidad, producto.id]);

            // Guardar el precio unitario y ganancia individual para el detalle de venta
            producto.precio_unitario = dbProducto.precio_venta;
            producto.profit = profitProducto;
        }

        // Insertar registro de la venta en la tabla ventas
        const ventaQuery = 'INSERT INTO ventas (subtotal, igv, total, efectivo, vuelto, profit) VALUES (?, ?, ?, ?, ?, ?)';
        const [ventaResult] = await connection.query(ventaQuery, [
            venta.subtotal,
            venta.igv,
            venta.total,
            venta.efectivo,
            venta.vuelto,
            totalProfit
        ]);
        const ventaId = ventaResult.insertId;

        // Insertar detalles de la venta en la tabla detalle_ventas
        for (const producto of productos) {
            await connection.query(
                'INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, profit) VALUES (?, ?, ?, ?, ?)',
                [ventaId, producto.id, producto.cantidad, producto.precio_unitario, producto.profit]
            );
        }

        await connection.commit();
        res.status(201).json({ mensaje: 'Venta registrada correctamente', id_venta: ventaId });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error en venta:', error);
        res.status(400).json({ mensaje: `Error al procesar la venta: ${error.message}` });
    } finally {
        if (connection) {
            connection.release(); // Liberamos la conexión
        }
    }
});

module.exports = router;
