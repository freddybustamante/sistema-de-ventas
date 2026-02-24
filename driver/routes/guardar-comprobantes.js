const express = require('express');
const router = express.Router();
const conexion = require('../conexion');

function generarCodigoVenta() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(100 + Math.random() * 900);
  return `VENTA-${timestamp}-${random}`;
}

router.post('/', async (req, res) => {
  const {
    id_cliente,
    tipo_documento,
    numero_documento,
    nombre,
    apellido,
    telefono,
    direccion,
    productos,
    subtotal,
    igv,
    total,
    tipo_comprobante,
    efectivo,
    vuelto,
    fecha_validez // opcional para crédito
  } = req.body;

  let clienteId = id_cliente;
  let clienteNombre = nombre;
  let clienteNumeroDocumento = numero_documento;
  const codigoVenta = generarCodigoVenta();

  const conn = await conexion.getConnection();
  try {
    await conn.beginTransaction();

    // Buscar cliente por documento si no se proporcionó ID
    if (!clienteId && tipo_documento && numero_documento) {
      const [rows] = await conn.query(
        "SELECT id_cliente, nombre, numero_documento FROM clientes WHERE tipo_documento = ? AND numero_documento = ?",
        [tipo_documento, numero_documento]
      );

      if (rows.length > 0) {
        clienteId = rows[0].id_cliente;
        clienteNombre = rows[0].nombre;
        clienteNumeroDocumento = rows[0].numero_documento;
      } else {
        const [result] = await conn.query(
          "INSERT INTO clientes (nombre, apellido, tipo_documento, numero_documento, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?)",
          [nombre, apellido, tipo_documento, numero_documento, telefono, direccion]
        );
        clienteId = result.insertId;
      }
    }

    // Insertar venta
    let totalProfit = 0;
    const [ventaResult] = await conn.query(
      `INSERT INTO ventas (
        codigo_venta, id_cliente, subtotal, igv, total,
        tipo_comprobante, tipo_venta, efectivo, vuelto,
        profit, fecha, fecha_validez
      ) VALUES (?, ?, ?, ?, ?, ?, 'contado', ?, ?, ?, NOW(), ?)`,
      [
        codigoVenta,
        clienteId,
        subtotal || 0,
        igv || 0,
        total || 0,
        tipo_comprobante || 'boleta',
        efectivo || 0,
        vuelto || 0,
        0, // profit temporal
        fecha_validez || null
      ]
    );

    const ventaId = ventaResult.insertId;

    // Insertar detalles y calcular profit
    for (const prod of productos) {
      const [producto] = await conn.query(
        "SELECT precio_compra FROM productos WHERE id = ?",
        [prod.id]
      );

      const costo = producto[0]?.precio_compra || 0;
      const profit = (parseFloat(prod.precio) - parseFloat(costo)) * prod.cantidad;
      totalProfit += profit;

      await conn.query(
        "INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, profit) VALUES (?, ?, ?, ?, ?)",
        [ventaId, prod.id, prod.cantidad, prod.precio, profit]
      );

      await conn.query(
        "UPDATE productos SET stock = stock - ? WHERE id = ?",
        [prod.cantidad, prod.id]
      );
    }

    // Actualizar profit en la venta
    await conn.query("UPDATE ventas SET profit = ? WHERE id = ?", [totalProfit, ventaId]);

    await conn.commit();
    res.json({
      mensaje: 'Venta y comprobante registrados exitosamente.',
      id_venta: ventaId,
      codigo_venta: codigoVenta,
      fecha: new Date().toISOString(),
      cliente: {
        nombre: clienteNombre,
        numero_documento: clienteNumeroDocumento
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error("❌ Error al guardar comprobante:", err);
    res.status(500).json({ mensaje: "Error interno al registrar la venta." });
  } finally {
    conn.release();
  }
});

module.exports = router;
