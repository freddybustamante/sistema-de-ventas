const express = require('express');
const router = express.Router();
const conexion = require('../conexion');

/**
 * POST /api/pagos-venta
 * Registrar pagos de una venta (uno o varios métodos)
 * PROTECCIÓN: Evita duplicados verificando si ya existen pagos para esta venta
 */
router.post('/', async (req, res) => {
    const { venta_id, pagos } = req.body;

    // 🔴 Validaciones básicas
    if (!venta_id) {
        return res.status(400).json({ 
            success: false, 
            error: 'venta_id es requerido' 
        });
    }

    if (!Array.isArray(pagos) || pagos.length === 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Se requiere al menos un método de pago' 
        });
    }

    // 🔒 Validar que cada pago tenga los campos necesarios
    for (const pago of pagos) {
        if (!pago.metodo_pago_id || !pago.monto || pago.monto <= 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Cada pago debe tener metodo_pago_id y monto válido' 
            });
        }
    }

    try {
        // 🔒 VERIFICAR si ya existen pagos para esta venta
        const [existentes] = await conexion.query(
            'SELECT COUNT(*) as total FROM pagos_venta WHERE venta_id = ?',
            [venta_id]
        );

        if (existentes[0].total > 0) {
            console.warn(`⚠️ Ya existen ${existentes[0].total} pagos para venta_id: ${venta_id}`);
            return res.status(409).json({ 
                success: false, 
                error: 'Los pagos para esta venta ya fueron registrados',
                pagos_existentes: existentes[0].total
            });
        }

        // 🔒 USAR TRANSACCIÓN para garantizar atomicidad
        await conexion.query('START TRANSACTION');

        console.log(`📝 Insertando ${pagos.length} pagos para venta_id: ${venta_id}`);

        for (const pago of pagos) {
            // Limpiamos la referencia
            const refFinal = (pago.referencia && pago.referencia !== "") ? pago.referencia : null;

            const query = `
                INSERT INTO pagos_venta 
                (venta_id, metodo_pago_id, monto, referencia, created_at) 
                VALUES (?, ?, ?, ?, NOW())
            `;
            
            await conexion.query(query, [
                venta_id, 
                pago.metodo_pago_id, 
                pago.monto, 
                refFinal
            ]);

            console.log(`✅ Pago insertado: método=${pago.metodo_pago_id}, monto=${pago.monto}`);
        }

        // 🔒 COMMIT de la transacción
        await conexion.query('COMMIT');

        res.json({ 
            success: true,
            message: `${pagos.length} pago(s) registrado(s) correctamente`,
            venta_id: venta_id,
            total_pagos: pagos.length
        });

    } catch (error) {
        // 🔒 ROLLBACK en caso de error
        try {
            await conexion.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('❌ Error en rollback:', rollbackError);
        }

        console.error('❌ Error al registrar pagos:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error al registrar pagos',
            details: error.message
        });
    }
});

/**
 * GET /api/pagos-venta/:venta_id
 * Obtener pagos de una venta
 */
router.get('/:venta_id', async (req, res) => {
  const { venta_id } = req.params;

  try {
    const [rows] = await conexion.query(
      `SELECT
         pv.id,
         mp.nombre AS metodo,
         pv.monto,
         pv.referencia,
         pv.created_at
       FROM pagos_venta pv
       JOIN metodos_pago mp ON mp.id = pv.metodo_pago_id
       WHERE pv.venta_id = ?
       ORDER BY pv.created_at ASC`,
      [venta_id]
    );

    res.json({
      success: true,
      pagos: rows,
      total: rows.length
    });
  } catch (error) {
    console.error('❌ Error al obtener pagos:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener pagos' 
    });
  }
});

/**
 * DELETE /api/pagos-venta/:venta_id
 * Eliminar todos los pagos de una venta (útil para correcciones)
 */
router.delete('/:venta_id', async (req, res) => {
  const { venta_id } = req.params;

  try {
    const [result] = await conexion.query(
      'DELETE FROM pagos_venta WHERE venta_id = ?',
      [venta_id]
    );

    res.json({
      success: true,
      message: `${result.affectedRows} pago(s) eliminado(s)`,
      venta_id: venta_id
    });
  } catch (error) {
    console.error('❌ Error al eliminar pagos:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al eliminar pagos' 
    });
  }
});

module.exports = router;