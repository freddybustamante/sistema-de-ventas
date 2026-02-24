// para la busqueda de produntos a credito

const express = require("express");
const router = express.Router();
const pool = require("../conexion"); // Conexión a MySQL

// Buscar por nombre (para autocompletado)
router.get("/buscar", async (req, res) => {
  try {
    const nombre = req.query.nombre;
    if (!nombre) {
      return res.status(400).json({ error: "Parámetro 'nombre' es requerido" });
    }

    const [rows] = await pool.query(
      "SELECT id, nombre, codigo_barras, precio_venta, stock FROM productos WHERE nombre LIKE ? LIMIT 10",
      [`%${nombre}%`]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error en productos-credito/buscar:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Buscar por código de barras (modo escáner)
router.get("/codigo/:codigo", async (req, res) => {
  try {
    const codigo = req.params.codigo;
    const [rows] = await pool.query(
      "SELECT id, nombre, codigo_barras, precio_venta, stock FROM productos WHERE codigo_barras = ? LIMIT 1",
      [codigo]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error en productos-credito/codigo:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
