const express = require('express');
const router = express.Router();
const pool = require('../conexion');

// Ruta: Buscar cliente y verificar si tiene deudas
router.get('/buscar', async (req, res) => {
  const { tipo_documento, numero_documento } = req.query;

  if (!tipo_documento || !numero_documento) {
    return res.status(400).json({ error: "Faltan parámetros." });
  }

  try {
    // Buscar cliente
    const [[cliente]] = await pool.query(
      `SELECT id_cliente AS id, nombre, apellido, telefono, direccion
       FROM clientes
       WHERE LOWER(TRIM(tipo_documento)) = LOWER(TRIM(?))
         AND TRIM(numero_documento) = TRIM(?)
       LIMIT 1`,
      [tipo_documento, numero_documento]
    );

    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    // Verificar si tiene deuda pendiente (opcional)
    const [[credito]] = await pool.query(
      `SELECT id_credito FROM ventas_credito
       WHERE id_cliente = ? AND estado = 'pendiente'
       LIMIT 1`,
      [cliente.id]
    );

    res.json({
      ...cliente,
      tieneCreditoPendiente: !!credito
    });
  } catch (error) {
    console.error("Error al buscar cliente:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
