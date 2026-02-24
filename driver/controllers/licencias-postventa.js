const pool = require('../conexion');

const SERIAL_CODE = "@Cli-4582-52246-63877";

// Verificar estado de licencia
const verificarLicencia = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM licencias WHERE serial_code = ?", [SERIAL_CODE]);

    if (rows.length === 0) {
      // Primera vez → insertar
      await pool.query("INSERT INTO licencias (serial_code, activation_date, estado) VALUES (?, NOW(), 'prueba')", [SERIAL_CODE]);
      return res.json({ estado: "prueba", diasRestantes: 60 });
    }

    const licencia = rows[0];
    const activationDate = new Date(licencia.activation_date);

    // Definir duración
    let duracion = licencia.estado === 'prueba' ? 60 : 1825; // 60 días vs 5 años
    let fechaExpira = new Date(activationDate);
    fechaExpira.setDate(fechaExpira.getDate() + duracion);

    if (new Date() > fechaExpira) {
      return res.json({ estado: "expirado", diasRestantes: 0 });
    }

    // Calcular días restantes
    const diffMs = fechaExpira - new Date();
    const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return res.json({ estado: licencia.estado, diasRestantes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al verificar licencia" });
  }
};

// Activar/reactivar
const activarLicencia = async (req, res) => {
  try {
    const { codigo } = req.body;

    if (codigo !== SERIAL_CODE) {
      return res.status(400).json({ error: "Código inválido" });
    }

    await pool.query("UPDATE licencias SET activation_date = NOW(), estado = 'activado' WHERE serial_code = ?", [SERIAL_CODE]);

    return res.json({ estado: "activado", mensaje: "Licencia reactivada por 5 años" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al activar licencia" });
  }
};

module.exports = { verificarLicencia, activarLicencia };
