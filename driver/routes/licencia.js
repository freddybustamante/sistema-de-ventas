const express = require('express');
const router = express.Router();
const pool = require('../conexion');

const CODIGO_LICENCIA = "@Cli-4582-52246-63877";
const DIAS_PRUEBA = 60;

// Obtener estado de licencia
router.get('/estado', async (req, res) => {
  try {
    let [rows] = await pool.query("SELECT * FROM licencias ORDER BY id DESC LIMIT 1");

    // 🚀 Si no existe licencia, crearla en modo prueba automáticamente
    if (!rows.length) {
      await pool.query(
        "INSERT INTO licencias (serial_code, activation_date, estado) VALUES (?, NOW(), 'prueba')",
        [CODIGO_LICENCIA]
      );
      [rows] = await pool.query("SELECT * FROM licencias ORDER BY id DESC LIMIT 1");
    }

    const licencia = rows[0];
    const hoy = new Date();
    const fechaActivacion = new Date(licencia.activation_date);

    // Caso: licencia activada
    if (licencia.estado === "activado") {
      return res.json({ estado: "activado", mensaje: "Licencia activada correctamente." });
    }

    // Caso: licencia en prueba
    if (licencia.estado === "prueba") {
      const diasTranscurridos = Math.floor((hoy - fechaActivacion) / (1000 * 60 * 60 * 24));
      const diasRestantes = DIAS_PRUEBA - diasTranscurridos;

      if (diasRestantes > 0) {
        return res.json({ estado: "prueba", diasRestantes, mensaje: `Prueba activa (${diasRestantes} días restantes).` });
      } else {
        await pool.query("UPDATE licencias SET estado = 'expirado' WHERE id = ?", [licencia.id]);
        return res.json({ estado: "expirado", mensaje: "El periodo de prueba ha expirado." });
      }
    }

    // Caso: expirado
    return res.json({ estado: "expirado", mensaje: "Licencia expirada." });
  } catch (err) {
    console.error("Error al obtener estado de licencia:", err);
    res.status(500).json({ estado: "error", mensaje: "Error en el servidor." });
  }
});

// Activar licencia
router.post('/activar', async (req, res) => {
  const { codigo } = req.body;

  try {
    const [rows] = await pool.query("SELECT * FROM licencias ORDER BY id DESC LIMIT 1");
    if (!rows.length) {
      return res.status(400).json({ success: false, mensaje: "No existe licencia registrada." });
    }
    const licencia = rows[0];

    if (codigo === CODIGO_LICENCIA) {
      await pool.query(
        "UPDATE licencias SET estado = 'activado', activation_date = NOW() WHERE id = ?",
        [licencia.id]
      );
      return res.json({ success: true, mensaje: "Licencia activada correctamente." });
    }

    return res.status(400).json({ success: false, mensaje: "Código inválido." });
  } catch (err) {
    console.error("Error al activar licencia:", err);
    res.status(500).json({ success: false, mensaje: "Error en el servidor." });
  }
});

module.exports = router;
