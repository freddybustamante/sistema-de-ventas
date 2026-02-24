const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../conexion'); // Ahora importamos el pool de conexiones
require('dotenv').config();

// Endpoint de login
router.post('/', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ mensaje: 'Faltan credenciales' });
  }

  try {
    // Obtener el usuario desde la base de datos
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE username = ?', [username]);

    if (rows.length === 0) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    const usuario = rows[0];

    // Comparar la contraseña con el hash almacenado
    const match = await bcrypt.compare(password, usuario.password);
    if (!match) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    // Actualizar el último acceso
    await pool.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?', [usuario.id]);

    // Generar token JWT
    const token = jwt.sign({ id: usuario.id, rol: usuario.rol }, process.env.JWT_SECRET, { expiresIn: '8h' });

    res.json({
      mensaje: 'Autenticación exitosa',
      token,
      rol: usuario.rol,
      nombre: usuario.nombre
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ mensaje: 'Error interno en el servidor' });
  }
});

module.exports = router;
