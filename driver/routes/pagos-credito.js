const express = require('express');
const router = express.Router();
const pool = require('../conexion');

// Buscar cliente y su crédito pendiente
// Buscar cliente
router.get('/cliente/:numeroDocumento', async (req, res) => {
  const { numeroDocumento } = req.params;

  try {
    // Buscar datos del cliente
    const [clientes] = await pool.query(
      'SELECT id_cliente, nombre, apellido FROM clientes WHERE numero_documento = ?',
      [numeroDocumento]
    );

    if (clientes.length === 0) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }

    const cliente = clientes[0];

    // Buscar crédito pendiente (opcional, para enviar info básica)
    const [creditos] = await pool.query(
      'SELECT id_credito, saldo_pendiente FROM ventas_credito WHERE id_cliente = ? AND estado = "pendiente" ORDER BY fecha_credito DESC LIMIT 1',
      [cliente.id_cliente]
    );

    // Respondemos siempre 200, incluso si no hay créditos
    res.status(200).json({
      id_cliente: cliente.id_cliente,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      credito: creditos.length > 0 ? creditos[0] : null
    });

  } catch (error) {
    console.error('Error al buscar cliente:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});


// Registrar pago
router.post('/pagar', async (req, res) => {
  const { idCredito, metodoPago, monto, observacion } = req.body;

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    const [creditoRows] = await connection.query(
      'SELECT saldo_pendiente FROM ventas_credito WHERE id_credito = ?',
      [idCredito]
    );

    if (creditoRows.length === 0) {
      await connection.release();
      return res.status(404).json({ mensaje: 'Crédito no encontrado' });
    }

    const saldoAnterior = parseFloat(creditoRows[0].saldo_pendiente);
    const nuevoSaldo = saldoAnterior - parseFloat(monto);

    // Insertar el pago
    await connection.query(
      'INSERT INTO pagos_credito (id_credito, metodo_pago, monto_pagado, saldo_restante, observacion) VALUES (?, ?, ?, ?, ?)',
      [idCredito, metodoPago, monto, nuevoSaldo, observacion || null]
    );

    // Actualizar saldo pendiente
    await connection.query(
      'UPDATE ventas_credito SET saldo_pendiente = ?, estado = ? WHERE id_credito = ?',
      [
        nuevoSaldo,
        nuevoSaldo <= 0 ? 'cancelado' : 'pendiente',
        idCredito
      ]
    );

    await connection.commit();
    connection.release();

    res.json({ mensaje: 'Pago registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ mensaje: 'Error al registrar el pago' });
  }
});

// Historial de pagos
router.get('/historial/:idCredito', async (req, res) => {
  const { idCredito } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT fecha_pago, metodo_pago, monto_pagado FROM pagos_credito WHERE id_credito = ? ORDER BY fecha_pago DESC',
      [idCredito]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ mensaje: 'Error al obtener historial' });
  }
});


// Obtener créditos pendientes por cliente
router.get('/creditos/:numeroDocumento', async (req, res) => {
  const { numeroDocumento } = req.params;

  try {
    const [rows] = await pool.query(`
      SELECT vc.id_credito, vc.fecha_credito, vc.total, vc.saldo_pendiente 
      FROM ventas_credito vc
      JOIN clientes c ON c.id_cliente = vc.id_cliente
      WHERE c.numero_documento = ? AND vc.saldo_pendiente > 0
      ORDER BY vc.fecha_credito DESC
    `, [numeroDocumento]);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener créditos:', error);
    res.status(500).json({ mensaje: 'Error al obtener créditos pendientes' });
  }
});

// Obtener productos asociados a un crédito
// Obtener productos asociados a un crédito
router.get('/detalles/:idCredito', async (req, res) => {
  const { idCredito } = req.params;

  try {
    const [rows] = await pool.query(`
      SELECT 
        p.nombre AS producto,
        dvc.cantidad,
        dvc.precio_unitario,
        dvc.subtotal
      FROM detalle_venta_credito dvc
      INNER JOIN productos p ON p.id = dvc.id_producto
      WHERE dvc.id_credito = ?
    `, [idCredito]);

    res.json(rows);
  } catch (error) {
    console.error("❌ Error al obtener productos del crédito:", error);
    res.status(500).json({ mensaje: "Error al obtener productos del crédito" });
  }
});

// pagar multiples creditos de un cliente
router.post('/pagar-multiple', async (req, res) => {
  const { ids, metodoPago, monto, observacion } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ mensaje: 'No se proporcionaron créditos' });
  }

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    let restante = parseFloat(monto);

    for (let id of ids) {
      const [rows] = await connection.query('SELECT saldo_pendiente FROM ventas_credito WHERE id_credito = ?', [id]);
      if (rows.length === 0) continue;

      const saldoPendiente = parseFloat(rows[0].saldo_pendiente);
      if (saldoPendiente <= 0) continue;

      const aPagar = Math.min(saldoPendiente, restante);
      const nuevoSaldo = saldoPendiente - aPagar;

      await connection.query(
        'INSERT INTO pagos_credito (id_credito, metodo_pago, monto_pagado, saldo_restante, observacion) VALUES (?, ?, ?, ?, ?)',
        [id, metodoPago, aPagar, nuevoSaldo, observacion || null]
      );

      await connection.query(
        'UPDATE ventas_credito SET saldo_pendiente = ?, estado = ? WHERE id_credito = ?',
        [nuevoSaldo, nuevoSaldo <= 0 ? 'cancelado' : 'pendiente', id]
      );

      restante -= aPagar;
      if (restante <= 0) break;
    }

    await connection.commit();
    connection.release();

    res.json({ mensaje: 'Pagos múltiples registrados correctamente' });
  } catch (err) {
    console.error('❌ Error en pago múltiple:', err);
    res.status(500).json({ mensaje: 'Error al registrar pagos múltiples' });
  }
});

// para usarlo en el modulo de caja 
// Total pagado en efectivo hoy (para módulo de caja)
// 🔢 Total pagado en efectivo hoy (para módulo de caja)
router.get('/total-efectivo-dia', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT SUM(monto_pagado) AS total
      FROM pagos_credito
      WHERE DATE(fecha_pago) = CURDATE() AND metodo_pago = 'efectivo'
    `);
    res.json({ total: rows[0].total || 0 });
  } catch (error) {
    console.error('❌ Error al obtener total en efectivo:', error);
    res.status(500).json({ mensaje: 'Error al obtener total en efectivo' });
  }
});



module.exports = router;
