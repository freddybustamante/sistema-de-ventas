const express = require('express');
const router = express.Router();
const pool = require('../conexion'); // Pool centralizado con mysql2/promise

// ==========================
// Buscar cliente por documento
// ==========================
router.get("/buscar", async (req, res) => {
  try {
    const { tipo_documento, numero_documento } = req.query;
    if (!tipo_documento || !numero_documento) {
      return res.status(400).json({ error: "Faltan parámetros." });
    }

    const [rows] = await pool.query(
      `SELECT id_cliente as id, nombre, apellido, telefono, direccion
       FROM clientes
       WHERE tipo_documento = ? AND numero_documento = ?
       LIMIT 1`,
      [tipo_documento, numero_documento]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error buscando cliente:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ==========================
// Buscar productos por nombre o código
// ==========================
router.get('/productos', async (req, res) => {
  try {
    const term = `%${req.query.term}%`;
    const [rows] = await pool.query(
      `SELECT id_producto, nombre, precio_venta, stock 
       FROM productos 
       WHERE nombre LIKE ? OR codigo_barra LIKE ?`,
      [term, term]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error buscando productos:', error);
    res.status(500).json({ error: 'Error en búsqueda de productos' });
  }
});

// ==========================
// Registrar venta a crédito
// ==========================
router.post('/registrar', async (req, res) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const { cliente, productos, aplicar_igv } = req.body;
    const { nombre, apellido, tipo_documento, numero_documento, telefono, direccion } = cliente;

    // Verificar si el cliente ya existe por su número de documento
    const [[clienteExistente]] = await conn.query(
      'SELECT id_cliente FROM clientes WHERE numero_documento = ?',
      [numero_documento]
    );

    let idCliente;

    if (clienteExistente) {
      idCliente = clienteExistente.id_cliente;
    } else {
      // Insertar nuevo cliente si no existe
      const [resultCliente] = await conn.query(
        `INSERT INTO clientes (nombre, apellido, tipo_documento, numero_documento, telefono, direccion)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [nombre, apellido, tipo_documento, numero_documento, telefono, direccion]
      );
      idCliente = resultCliente.insertId;
    }

    // Calcular totales
    let subtotal = 0;
    productos.forEach(p => {
      subtotal += p.precio * p.cantidad;
    });

    let igv = aplicar_igv ? subtotal * 0.18 : 0;
    let total = subtotal + igv;

    // Registrar la venta a crédito
    const [resultVenta] = await conn.query(
      `INSERT INTO ventas_credito (id_cliente, fecha_credito, subtotal, igv, total, saldo_pendiente)
       VALUES (?, NOW(), ?, ?, ?, ?)`,
      [idCliente, subtotal, igv, total, total]
    );

    const idCredito = resultVenta.insertId;

    // Registrar productos vendidos en detalle_venta_credito
for (const producto of productos) {
  const subtotalProducto = producto.precio * producto.cantidad;

  await conn.query(
    `INSERT INTO detalle_venta_credito 
      (id_credito, id_producto, cantidad, precio_unitario, subtotal)
     VALUES (?, ?, ?, ?, ?)`,
    [idCredito, producto.id, producto.cantidad, producto.precio, subtotalProducto]
  );

  // Descontar stock
  await conn.query(
    `UPDATE productos SET stock = stock - ? WHERE id = ?`,
    [producto.cantidad, producto.id]
  );
}

    await conn.commit();
    res.status(200).json({ message: "Venta a crédito registrada correctamente." });

  } catch (error) {
    await conn.rollback();
    console.error("Error registrando venta a crédito:", error);
    res.status(500).json({ error: "Error registrando venta a crédito", detalles: error.message });
  } finally {
    conn.release();
  }
});


// ==========================
// Sugerencias por documento parcial
// ==========================
router.get('/sugerencias', async (req, res) => {
  const { tipo_documento, numero_documento } = req.query;
  try {
    const [rows] = await pool.query(
      `SELECT id_cliente as id, nombre, apellido, numero_documento 
       FROM clientes 
       WHERE tipo_documento = ? AND numero_documento LIKE ? 
       LIMIT 10`,
      [tipo_documento, `${numero_documento}%`]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error al buscar sugerencias:", error);
    res.status(500).json({ error: 'Error al buscar sugerencias' });
  }
});

router.post('/api/ventas-credito', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      nombre, apellido, tipo_documento, numero_documento, telefono, direccion,
      carrito, subtotal, igv, total
    } = req.body;

    // Paso 1: Buscar cliente por número de documento
    const [[clienteExistente]] = await connection.query(
      'SELECT id_cliente FROM clientes WHERE numero_documento = ?',
      [numero_documento]
    );
    let idCliente;

    if (clienteExistente) {
      // Cliente ya existe, usar su ID
      idCliente = clienteExistente.id_cliente;
    } else {
      // Insertar nuevo cliente
      const [resultCliente] = await connection.query(
        `INSERT INTO clientes (nombre, apellido, tipo_documento, numero_documento, telefono, direccion)
           VALUES (?, ?, ?, ?, ?, ?)`,
        [nombre, apellido, tipo_documento, numero_documento, telefono, direccion]
      );
      idCliente = resultCliente.insertId;
    }

    // Paso 2: Insertar nueva venta a crédito para ese cliente
    const [resultVentaCredito] = await connection.query(
      `INSERT INTO ventas_credito (id_cliente, fecha_credito, subtotal, igv, total)
         VALUES (?, NOW(), ?, ?, ?)`,
      [idCliente, subtotal, igv, total]
    );
    const idVentaCredito = resultVentaCredito.insertId;

    // Paso 3: Insertar productos del carrito en detalles_venta
    for (const producto of carrito) {
      const { id_producto, cantidad, precio_unitario, total_producto } = producto;

      // Verificar stock disponible
      const [productoBD] = await connection.query(
        'SELECT stock FROM productos WHERE id = ?',
        [id_producto]
      );
      if (productoBD.length === 0 || productoBD[0].stock < cantidad) {
        throw new Error(`Stock insuficiente para el producto ID ${id_producto}`);
      }

      // Insertar detalle
      await connection.query(
        `INSERT INTO detalles_venta (id_venta_credito, id_producto, cantidad, precio_unitario, total)
         VALUES (?, ?, ?, ?, ?)`,
        [idVentaCredito, id_producto, cantidad, precio_unitario, total_producto]
      );

      // Descontar stock
      await connection.query(
        'UPDATE productos SET stock = stock - ? WHERE id = ?',
        [cantidad, id_producto]
      );
    }

    await connection.commit();
    res.json({ mensaje: 'Venta a crédito registrada con éxito.' });

  } catch (error) {
    await connection.rollback();
    console.error('Error registrando venta a crédito:', error);
    res.status(500).json({ error: 'Error al registrar la venta a crédito' });
  } finally {
    connection.release();
  }
});


// ==========================
//este funcion es para obtener DNI  en pagos-credito.js 
// Obtener crédito pendiente más antiguo por documento
// ==========================
router.get('/cliente/:documento', async (req, res) => {
  const documento = req.params.documento;

  try {
    // Buscar cliente
    const [[cliente]] = await pool.query(
      `SELECT id_cliente AS id, nombre FROM clientes WHERE numero_documento = ? LIMIT 1`,
      [documento]
    );

    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

    // Buscar el crédito pendiente más antiguo
    const [[credito]] = await pool.query(
      `SELECT id_credito, saldo_pendiente 
       FROM ventas_credito 
       WHERE id_cliente = ? AND estado = 'pendiente' 
       ORDER BY fecha_credito ASC 
       LIMIT 1`,
      [cliente.id]
    );

    if (!credito) return res.status(404).json({ error: "El cliente no tiene créditos pendientes" });

    res.json({
      nombre: cliente.nombre,
      id_credito: credito.id_credito,
      saldo_pendiente: credito.saldo_pendiente
    });

  } catch (err) {
    console.error("Error buscando crédito pendiente:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// separar la vbusqeda por codigo de barras
router.get('/codigo/:codigo', async (req, res) => {
  const { codigo } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT id_producto AS id, nombre, precio_venta, stock, codigo_barra AS codigo_barras FROM productos WHERE codigo_barra = ? LIMIT 1',
      [codigo]
    );
    if (rows.length === 0) return res.status(404).json({});
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al buscar producto por código:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});



module.exports = router;