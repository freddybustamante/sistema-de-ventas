const express = require('express');
const router = express.Router();
const pool = require('../conexion'); // Asegúrate que este archivo exporte pool correctamente

// 🔍 Buscar comprobantes por número de comprobante o por documento del cliente
router.get('/buscar', async (req, res) => {
  const { tipo_documento, numero_documento, numero_comprobante } = req.query;

  try {
    let query = `
      SELECT 
        v.id AS id_venta,
        v.codigo_venta AS numero_comprobante,
        v.tipo_comprobante AS tipo,
        v.fecha AS fecha_emision,
        IFNULL(v.total, 0.00) AS total,
        IFNULL(v.efectivo, 0.00) AS efectivo,
        IFNULL(v.vuelto, 0.00) AS vuelto,
        IFNULL(v.profit, 0.00) AS profit,
        CONCAT(c.nombre, ' ', IFNULL(c.apellido, '')) AS cliente
      FROM ventas v
      LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
      WHERE 1=1
    `;
    const params = [];

    if (numero_comprobante) {
      query += ' AND v.codigo_venta = ?';
      params.push(numero_comprobante);
    }

    if (tipo_documento && numero_documento) {
      query += ' AND c.tipo_documento = ? AND c.numero_documento = ?';
      params.push(tipo_documento, numero_documento);
    }

    const [resultados] = await pool.query(query, params);
    res.json(resultados);
  } catch (error) {
    console.error('❌ Error al buscar comprobantes:', error.message);
    res.status(500).json({ error: 'Error al buscar comprobantes' });
  }
});

// 📄 Obtener detalle del comprobante por tipo y código
router.get('/detalle/:tipo/:codigo_venta', async (req, res) => {
  const { tipo, codigo_venta } = req.params;

  try {
    // Cabecera
    const [cabeceraRows] = await pool.query(`
      SELECT v.codigo_venta, v.tipo_comprobante, v.fecha, v.subtotal, v.igv, v.total,
             v.efectivo, v.vuelto, v.profit,
             c.nombre, c.apellido, c.tipo_documento, c.numero_documento, c.telefono, c.direccion
      FROM ventas v
      LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
      WHERE v.codigo_venta = ? AND v.tipo_comprobante = ?
    `, [codigo_venta, tipo]);

    if (cabeceraRows.length === 0) {
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }

    const cabecera = cabeceraRows[0];

    // Detalle
    const [detalle] = await pool.query(`
      SELECT 
        p.nombre AS descripcion,
        dv.cantidad,
        dv.precio_unitario,
        dv.profit,
        (dv.cantidad * dv.precio_unitario) AS subtotal
      FROM detalle_ventas dv
      INNER JOIN productos p ON dv.producto_id = p.id
      WHERE dv.venta_id = (
        SELECT id FROM ventas WHERE codigo_venta = ? LIMIT 1
      )
    `, [codigo_venta]);

    res.json({
      cabecera,
      detalle
    });
  } catch (error) {
    console.error('❌ Error al obtener detalle del comprobante:', error.message);
    res.status(500).json({ error: 'Error al obtener detalle del comprobante' });
  }
});

module.exports = router;
