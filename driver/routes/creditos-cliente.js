// Archivo: routes/historial-creditos.js
const express = require('express');
const router = express.Router();
const pool = require('../conexion');

// Obtener historial de créditos por cliente
router.get('/:numeroDocumento', async (req, res) => {
  const { numeroDocumento } = req.params;

  try {
    const [creditos] = await pool.query(`
      SELECT vc.id_credito, vc.fecha_credito, vc.total, vc.saldo_pendiente,
             vc.estado, c.nombre, c.apellido
      FROM ventas_credito vc
      JOIN clientes c ON vc.id_cliente = c.id_cliente
      WHERE c.numero_documento = ?
      ORDER BY vc.fecha_credito DESC
    `, [numeroDocumento]);

    res.json(creditos);
  } catch (err) {
    console.error('❌ Error al obtener historial:', err);
    res.status(500).json({ mensaje: 'Error al obtener historial de créditos' });
  }
});

// Obtener detalles del crédito
router.get('/detalles/:idCredito', async (req, res) => {
  const { idCredito } = req.params;

  try {
    const [productos] = await pool.query(`
      SELECT p.nombre AS producto, dvc.cantidad, dvc.precio_unitario, dvc.subtotal
      FROM detalle_venta_credito dvc
      JOIN productos p ON dvc.id_producto = p.id
      WHERE dvc.id_credito = ?
    `, [idCredito]);

    res.json(productos);
  } catch (err) {
    console.error('❌ Error al obtener detalles del crédito:', err);
    res.status(500).json({ mensaje: 'Error al obtener detalles del crédito' });
  }
});


// Historial de pagos de un crédito
router.get("/pagos/:idCredito", async (req, res) => {
  const { idCredito } = req.params;
  const [pagos] = await pool.query(`
    SELECT fecha_pago, metodo_pago, monto_pagado, saldo_restante
    FROM pagos_credito
    WHERE id_credito = ?
    ORDER BY fecha_pago ASC
  `, [idCredito]);

  res.json(pagos);
});


module.exports = router;
