// routes/caja.js
const express = require('express');
const router = express.Router();
const pool = require('../conexion');

// Abrir caja
router.post('/abrir', async (req, res) => {
  const { monto_inicial } = req.body;
  if (monto_inicial == null || isNaN(monto_inicial)) {
    return res.status(400).json({ error: 'Monto de apertura inválido' });
  }

  try {
    const [existe] = await pool.query('SELECT * FROM caja WHERE fecha = CURDATE()');
    if (existe.length > 0) {
      return res.status(400).json({ error: 'Ya se ha abierto caja para hoy' });
    }

    await pool.query('INSERT INTO caja (fecha, apertura, estado) VALUES (CURDATE(), ?, "abierta")', [monto_inicial]);
    await pool.query('INSERT INTO movimientos_caja (fecha, tipo, monto, descripcion) VALUES (CURDATE(), ?, ?, ?)', [
      'apertura', monto_inicial, 'Apertura de caja'
    ]);

    res.json({ mensaje: 'Caja abierta exitosamente' });
  } catch (err) {
    console.error('❌ Error al abrir caja:', err);
    res.status(500).json({ error: 'Error al abrir caja' });
  }
});

// Estado de la caja
router.get('/estado', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM caja WHERE fecha = CURDATE()');
    if (rows.length === 0) return res.json({ estado: 'no_abierta' });
    res.json(rows[0]);
  } catch (error) {
    console.error('❌ Error al consultar estado de caja:', error);
    res.status(500).json({ mensaje: 'Error al consultar caja.' });
  }
});

// Cerrar caja
// 📌 Cerrar caja
router.post('/cerrar', async (req, res) => {
  const { monto_final, observacion } = req.body;
  

  try {
    // Obtener caja abierta del día
    const [rows] = await pool.query('SELECT * FROM caja WHERE fecha = CURDATE() AND estado = ?', ['abierta']);
    if (rows.length === 0) return res.status(400).json({ mensaje: 'No hay caja abierta hoy.' });

    const apertura = parseFloat(rows[0].apertura);

    // Obtener total de egresos del día
    const [[{ total_egresos }]] = await pool.query(`
      SELECT SUM(monto) AS total_egresos 
      FROM movimientos_caja 
      WHERE tipo = 'egreso' AND DATE(fecha) = CURDATE()
    `);

    // Obtener total de pagos crédito en efectivo del día
    const [[{ total_credito }]] = await pool.query(`
      SELECT SUM(monto_pagado) AS total_credito
      FROM pagos_credito
      WHERE metodo_pago = 'efectivo' AND DATE(fecha_pago) = CURDATE()
    `);

    // ✅ Obtener total de ventas al contado (real) del día — corregido aquí
    const [[{ total_ventas }]] = await pool.query(`
      SELECT SUM(total) AS total_ventas
      FROM ventas
      WHERE tipo_venta = 'contado' AND DATE(fecha) = CURDATE()
    `);

    const ingresos = parseFloat(total_ventas || 0) + parseFloat(total_credito || 0);
    const egresos = parseFloat(total_egresos || 0);

    const total_en_caja = apertura + ingresos - egresos;
    const diferencia = parseFloat(monto_final) - total_en_caja;

    // Guardar cierre
    // Guardar cierre con observación (si hay)
await pool.query(`
UPDATE caja 
SET cierre = ?, diferencia = ?, estado = ?, observaciones = ?
WHERE fecha = CURDATE()
`, [
monto_final,
diferencia,
'cerrada',
observacion || null
]);

    res.json({ mensaje: 'Caja cerrada correctamente.' });
  } catch (error) {
    console.error('❌ Error al cerrar caja:', error);
    res.status(500).json({ mensaje: 'Error al cerrar caja.' });
  }
});


// Registrar egreso
router.post('/egreso', async (req, res) => {
  const { descripcion, monto } = req.body;
  try {
    await pool.query('INSERT INTO movimientos_caja (tipo, descripcion, monto, fecha) VALUES (?, ?, ?, NOW())', ['egreso', descripcion, monto]);
    res.json({ mensaje: 'Egreso registrado correctamente.' });
  } catch (error) {
    console.error('❌ Error al registrar egreso:', error);
    res.status(500).json({ mensaje: 'Error al registrar egreso.' });
  }
});

// Registrar ingreso manual
router.post('/ingreso', async (req, res) => {
  const { descripcion, monto } = req.body;
  try {
    await pool.query('INSERT INTO movimientos_caja (tipo, descripcion, monto, fecha) VALUES (?, ?, ?, NOW())', ['ingreso', descripcion, monto]);
    res.json({ mensaje: 'Ingreso registrado correctamente.' });
  } catch (error) {
    console.error('❌ Error al registrar ingreso:', error);
    res.status(500).json({ mensaje: 'Error al registrar ingreso.' });
  }
});

// Obtener movimientos del día
router.get('/movimientos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM movimientos_caja WHERE DATE(fecha) = CURDATE() ORDER BY fecha DESC');
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener movimientos:', error);
    res.status(500).json({ mensaje: 'Error al obtener movimientos.' });
  }
});

// Ingresos adicionales: ventas al contado + pagos crédito efectivo
router.get('/ingresos-adicionales', async (req, res) => {
  try {
    const [[{ total: ventasContado }]] = await pool.query('SELECT SUM(total) AS total FROM ventas WHERE tipo_venta = ? AND DATE(fecha) = CURDATE()', ['contado']);
    const [[{ total: pagosCredito }]] = await pool.query('SELECT SUM(monto_pagado) AS total FROM pagos_credito WHERE metodo_pago = ? AND DATE(fecha_pago) = CURDATE()', ['efectivo']);
    res.json({ ventasContado: parseFloat(ventasContado || 0), pagosCredito: parseFloat(pagosCredito || 0) });
  } catch (error) {
    console.error('❌ Error al obtener ingresos adicionales:', error);
    res.status(500).json({ error: 'Error al obtener ingresos adicionales' });
  }
});

// Verificar si hay caja abierta hoy
router.get('/estado-hoy', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM caja WHERE fecha = CURDATE()');
    if (rows.length > 0) {
      res.json({ existe: true, estado: rows[0].estado });
    } else {
      res.json({ existe: false });
    }
  } catch (err) {
    console.error('Error al verificar caja de hoy:', err);
    res.status(500).json({ error: 'Error al verificar caja' });
  }
});

// 📌 Ingresos desde ventas del día (contado)
router.get('/ingresos-ventas', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT SUM(total) AS total
      FROM ventas
      WHERE tipo_venta = 'contado' AND DATE(fecha) = CURDATE()
    `);
    res.json({ total: rows[0].total || 0 });
  } catch (error) {
    console.error("❌ Error al obtener ingresos de ventas:", error);
    res.status(500).json({ mensaje: "Error al obtener ingresos" });
  }
});

router.get('/historial', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM caja ORDER BY fecha DESC LIMIT 30');
    res.json(rows);
  } catch (err) {
    console.error('❌ Error al cargar historial:', err);
    res.status(500).json({ mensaje: 'Error al cargar historial' });
  }
});

// para ostar en el indes o dashboard
// Obtener total en caja actual del día (para dashboard)
router.get('/total', async (req, res) => {
  try {
    // Obtener apertura
    const [[caja]] = await pool.query('SELECT apertura FROM caja WHERE fecha = CURDATE()');
    if (!caja) return res.status(400).json({ error: 'Caja no abierta hoy' });

    const apertura = parseFloat(caja.apertura || 0);

    // Ventas al contado (valor real de venta)
    const [[{ total_ventas }]] = await pool.query(`
      SELECT SUM(total) AS total_ventas
      FROM ventas
      WHERE tipo_venta = 'contado' AND DATE(fecha) = CURDATE()
    `);

    // Pagos de créditos en efectivo
    const [[{ total_credito }]] = await pool.query(`
      SELECT SUM(monto_pagado) AS total_credito
      FROM pagos_credito
      WHERE metodo_pago = 'efectivo' AND DATE(fecha_pago) = CURDATE()
    `);

    // Egresos manuales
    const [[{ total_egresos }]] = await pool.query(`
      SELECT SUM(monto) AS total_egresos
      FROM movimientos_caja
      WHERE tipo = 'egreso' AND DATE(fecha) = CURDATE()
    `);

    // Ingresos manuales
    const [[{ total_ingresos }]] = await pool.query(`
      SELECT SUM(monto) AS total_ingresos
      FROM movimientos_caja
      WHERE tipo = 'ingreso' AND DATE(fecha) = CURDATE()
    `);

    const ventas = parseFloat(total_ventas || 0);
    const creditos = parseFloat(total_credito || 0);
    const ingresos_manual = parseFloat(total_ingresos || 0);
    const egresos = parseFloat(total_egresos || 0);

    const ingresos = ventas + creditos + ingresos_manual;
    const total_en_caja = apertura + ingresos - egresos;

    res.json({ totalCaja: total_en_caja.toFixed(2) });

  } catch (error) {
    console.error('❌ Error al calcular total en caja:', error);
    res.status(500).json({ error: 'Error al calcular total en caja' });
  }
});



module.exports = router;
