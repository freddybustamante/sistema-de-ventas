const express = require('express');
const router = express.Router();
const pool = require('../conexion');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

router.get('/exportar-excel', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        nombre AS Producto,
        stock AS 'Stock Actual',
        stock_minimo AS 'Stock Mínimo',
        CASE
          WHEN stock = 0 THEN 'Agotado'
          WHEN stock <= stock_minimo THEN 'Bajo'
          ELSE 'OK'
        END AS 'Estado Stock',
        CASE 
          WHEN fecha_vencimiento IS NULL THEN 'Sin fecha'
          WHEN fecha_vencimiento < CURDATE() THEN 'Vencido'
          WHEN fecha_vencimiento <= CURDATE() + INTERVAL 15 DAY THEN 'Próximo'
          ELSE 'OK'
        END AS 'Estado Vencimiento',
        fecha_vencimiento AS 'Fecha Vencimiento',
        CASE
          WHEN stock <= stock_minimo AND (fecha_vencimiento IS NOT NULL AND fecha_vencimiento <= CURDATE() + INTERVAL 15 DAY)
            THEN 'Stock y Vencimiento'
          WHEN stock <= stock_minimo THEN 'Stock'
          WHEN (fecha_vencimiento IS NOT NULL AND fecha_vencimiento <= CURDATE() + INTERVAL 15 DAY)
            THEN 'Vencimiento'
          ELSE 'Ninguna'
        END AS 'Tipo Alerta'
      FROM productos
      WHERE 
        stock <= stock_minimo OR 
        (fecha_vencimiento IS NOT NULL AND fecha_vencimiento <= CURDATE() + INTERVAL 15 DAY)
    `);

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Alertas');

    const filePath = path.join(__dirname, '../exports/alertas_stock.xlsx');

    // Asegura que el directorio exista
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    XLSX.writeFile(workbook, filePath);

    // Enviar el archivo como descarga
    res.download(filePath, 'alertas_stock.xlsx', (err) => {
      if (err) {
        console.error('❌ Error al enviar el archivo:', err);
        res.status(500).json({ error: 'No se pudo enviar el archivo' });
      }
    });

  } catch (error) {
    console.error('❌ Error al generar Excel:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
