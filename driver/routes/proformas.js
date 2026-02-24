const express = require('express');
const router = express.Router();
const pool = require('../conexion'); // Conexión centralizada con mysql2/promise

// 🔹 REGISTRAR UNA PROFORMA
router.post('/', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const {
      numero_comprobante,
      fecha_validez,
      subtotal,
      igv,
      total,
      observaciones,
      tipo_proforma = 'proforma',
      id_cliente = null,
      productos = []
    } = req.body;

    // Insertar cabecera de proforma
    const [result] = await conn.query(`
      INSERT INTO proformas (numero_comprobante, fecha_validez, subtotal, igv, total, id_cliente, observaciones, tipo_proforma)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [numero_comprobante, fecha_validez, subtotal, igv, total, id_cliente, observaciones, tipo_proforma]);

    const proforma_id = result.insertId;

    // Insertar productos de la proforma
    for (const p of productos) {
      await conn.query(`
        INSERT INTO detalle_proformas (proforma_id, producto_id, descripcion, unidad_medida, cantidad, precio_unitario)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        proforma_id,
        p.id,
        p.nombre,
        p.unidad_medida || 'UND',
        p.cantidad,
        p.precio
      ]);
    }

    await conn.commit();
    res.json({
      mensaje: '✅ Proforma registrada correctamente',
      proforma_id,
      numero_comprobante,
      fecha_emision: fecha_validez
    });

  } catch (error) {
    if (conn) await conn.rollback();
    console.error('❌ Error al registrar proforma:', error.message);
    res.status(500).json({ mensaje: 'Error al registrar la proforma' });
  } finally {
    if (conn) conn.release();
  }
});

// 🔹 OBTENER ÚLTIMAS 100 PROFORMAS
router.get(['/listado', '/'], async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.id, 
        p.numero_comprobante, 
        p.fecha_validez AS fecha_emision,
        p.total,
        c.nombre AS nombre_cliente,
        c.numero_documento
      FROM proformas p
      LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
      ORDER BY p.fecha_validez DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (error) {
    console.error('🔥 ERROR AL OBTENER PROFORMAS:', error.message);
    res.status(500).json({ mensaje: 'Error interno al obtener proformas' });
  }
});

// 🔹 FILTRAR PROFORMAS POR NOMBRE, DOCUMENTO Y FECHAS
router.get('/filtrar', async (req, res) => {
  const { nombre = '', documento = '', desde = '', hasta = '' } = req.query;

  let sql = `
    SELECT 
      p.id, 
      p.numero_comprobante, 
      p.fecha_validez AS fecha_emision, 
      p.total,
      c.nombre AS nombre_cliente, 
      c.numero_documento
    FROM proformas p
    LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
    WHERE 1=1
  `;
  const valores = [];

  if (nombre.trim()) {
    sql += ' AND c.nombre LIKE ?';
    valores.push(`%${nombre}%`);
  }

  if (documento.trim()) {
    sql += ' AND c.numero_documento LIKE ?';
    valores.push(`%${documento}%`);
  }

  if (desde) {
    sql += ' AND DATE(p.fecha_validez) >= ?';
    valores.push(desde);
  }

  if (hasta) {
    sql += ' AND DATE(p.fecha_validez) <= ?';
    valores.push(hasta);
  }

  sql += ' ORDER BY p.fecha_validez DESC LIMIT 100';

  try {
    const [rows] = await pool.query(sql, valores);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error al filtrar proformas:', err.message);
    res.status(500).json({ mensaje: 'Error interno al filtrar proformas' });
  }
});

// 🔹 Imprimir proforma por ID
router.get('/imprimir/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [cabeceraRows] = await pool.query(`
      SELECT 
        p.numero_comprobante, 
        p.fecha_validez AS fecha_emision,
        c.nombre AS nombre_cliente,
        c.numero_documento,
        p.subtotal, p.igv, p.total, p.observaciones
      FROM proformas p
      LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
      WHERE p.id = ?
    `, [id]);

    if (cabeceraRows.length === 0) {
      return res.status(404).send('Proforma no encontrada');
    }

    const proforma = cabeceraRows[0];

    const [detalles] = await pool.query(`
      SELECT descripcion, unidad_medida, cantidad, precio_unitario
      FROM detalle_proformas
      WHERE proforma_id = ?
    `, [id]);

    // Render HTML directamente
    const detalleHTML = detalles.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.descripcion}</td>
        <td>${item.unidad_medida}</td>
        <td>${item.cantidad}</td>
        <td>S/. ${parseFloat(item.precio_unitario).toFixed(2)}</td>
        <td>S/. ${(item.cantidad * item.precio_unitario).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
      <html>
      <head>
        <title>Imprimir Proforma</title>
        <style>
          body { font-family: Arial; margin: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #000; padding: 5px; text-align: left; }
          h2, h4 { margin: 0; }
          .totales { margin-top: 20px; text-align: right; }
          .btn-print { margin-top: 20px; }
        </style>
      </head>
      <body onload="window.print()">
        <h2>Proforma N° ${proforma.numero_comprobante}</h2>
        <h4>Válido hasta: ${new Date(proforma.fecha_emision).toLocaleDateString()}</h4>
        <p><strong>Cliente:</strong> ${proforma.nombre_cliente || '-'}</p>
        <p><strong>Documento:</strong> ${proforma.numero_documento || '-'}</p>
        <p><strong>Observaciones:</strong> ${proforma.observaciones || '-'}</p>

        <table>
          <thead>
            <tr>
              <th>#</th><th>Descripción</th><th>Unidad</th><th>Cantidad</th><th>Precio Unitario</th><th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${detalleHTML}
          </tbody>
        </table>

        <div class="totales">
          <p><strong>Subtotal:</strong> S/. ${parseFloat(proforma.subtotal).toFixed(2)}</p>
          <p><strong>IGV:</strong> S/. ${parseFloat(proforma.igv).toFixed(2)}</p>
          <p><strong>Total:</strong> <strong>S/. ${parseFloat(proforma.total).toFixed(2)}</strong></p>
        </div>
      </body>
      </html>
    `;

    res.send(html);

  } catch (err) {
    console.error('❌ Error al generar impresión de proforma:', err.message);
    res.status(500).send('Error al generar la impresión');
  }
});

module.exports = router;
