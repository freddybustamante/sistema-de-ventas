const express = require('express');
const router = express.Router();
const conexion = require('../conexion');

/**
 * GET /api/metodos-pago
 * Lista métodos de pago activos
 */
router.get('/', async (req, res) => {
  try {
   const [rows] = await conexion.query(
  `SELECT id, codigo, nombre, requiere_vuelto
   FROM metodos_pago
   WHERE activo = 1
   ORDER BY 
     CASE codigo
       WHEN 'EFECTIVO' THEN 1
       WHEN 'YAPE' THEN 2
       ELSE 3
     END,
     nombre`
);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener métodos de pago:', error);
    res.status(500).json({ error: 'Error al obtener métodos de pago' });
  }
});

/**
 * POST /api/metodos-pago
 * Crear método de pago (caso OTRO u administración)
 */
router.post('/', async (req, res) => {
  const { codigo, nombre, requiere_vuelto = 0 } = req.body;

  if (!codigo || !nombre) {
    return res.status(400).json({ error: 'Código y nombre son obligatorios' });
  }

  try {
    const [result] = await conexion.query(
      `INSERT INTO metodos_pago (codigo, nombre, requiere_vuelto)
       VALUES (?, ?, ?)`,
      [codigo.toUpperCase(), nombre, requiere_vuelto]
    );

    res.status(201).json({
      id: result.insertId,
      codigo: codigo.toUpperCase(),
      nombre,
      requiere_vuelto
    });
  } catch (error) {
    console.error('Error al crear método de pago:', error);
    res.status(500).json({ error: 'Error al crear método de pago' });
  }
});

module.exports = router;
