const express = require("express");
const router = express.Router();
const pool = require("../conexion");
const multer = require("multer");
const path = require("path");

// 📌 Configurar almacenamiento de imágenes con Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../public/uploads/")); // Guardar en public/uploads/
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Nombre único
  },
});

// Middleware para manejar uploads
const upload = multer({ storage });

// 📌 Obtener negocio (solo 1 registro)
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM negocio LIMIT 1");
    if (rows.length === 0) {
      return res.json(null);
    }

    const negocio = rows[0];
    
    // 🔧 MEJORADO: Construir URLs completas para las imágenes
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // ✅ Solo agregar baseUrl si existe la ruta de la imagen
    if (negocio.empresa_logo && !negocio.empresa_logo.startsWith('http')) {
      negocio.empresa_logo = `${baseUrl}${negocio.empresa_logo}`;
    }
    if (negocio.empresa_qr && !negocio.empresa_qr.startsWith('http')) {
      negocio.empresa_qr = `${baseUrl}${negocio.empresa_qr}`;
    }

    console.log('🏢 Negocio enviado al frontend:', {
      nombre: negocio.empresa_nombre,
      logo: negocio.empresa_logo,
      qr: negocio.empresa_qr
    });

    res.json(negocio);
  } catch (error) {
    console.error("❌ Error al obtener negocio:", error);
    res.status(500).json({ error: "Error al obtener negocio" });
  }
});

// 📌 Crear o actualizar negocio (solo 1)
router.post(
  "/",
  upload.fields([{ name: "empresa_logo" }, { name: "empresa_qr" }]),
  async (req, res) => {
    try {
      const {
        empresa_nombre,
        empresa_ruc,
        empresa_descripcion,
        empresa_servicios,
        empresa_detalles,
        empresa_direccion,
        empresa_referencia,
        empresa_departamento,
        empresa_provincia,
        empresa_distrito,
        empresa_ubicacion_maps,
        empresa_telefono,
        empresa_web,
        empresa_email,
        empresa_redes_sociales,
        estado,
      } = req.body;

      // 📌 Rutas de archivos subidos (igual que tu código original)
      const empresa_logo = req.files["empresa_logo"]
        ? `/uploads/${req.files["empresa_logo"][0].filename}`
        : null;
      const empresa_qr = req.files["empresa_qr"]
        ? `/uploads/${req.files["empresa_qr"][0].filename}`
        : null;

      // 📌 Validación básica
      if (!empresa_nombre || !empresa_ruc) {
        return res.status(400).json({ error: "Nombre y RUC son obligatorios" });
      }

      // 📌 Verificar si ya existe un negocio
      const [rows] = await pool.query("SELECT * FROM negocio LIMIT 1");

      if (rows.length > 0) {
        // 🔄 ACTUALIZAR negocio existente (manteniendo tu lógica COALESCE)
        const id = rows[0].id;
        
        await pool.query(
          `UPDATE negocio SET
            empresa_nombre=?, empresa_ruc=?, empresa_descripcion=?, 
            empresa_logo=COALESCE(?, empresa_logo), 
            empresa_servicios=?, empresa_detalles=?, empresa_direccion=?, 
            empresa_referencia=?, empresa_departamento=?, empresa_provincia=?, 
            empresa_distrito=?, empresa_ubicacion_maps=?, empresa_telefono=?, 
            empresa_web=?, empresa_email=?, empresa_redes_sociales=?, 
            empresa_qr=COALESCE(?, empresa_qr), estado=?
          WHERE id=?`,
          [
            empresa_nombre,
            empresa_ruc,
            empresa_descripcion || null,
            empresa_logo,
            empresa_servicios || null,
            empresa_detalles || null,
            empresa_direccion || null,
            empresa_referencia || null,
            empresa_departamento || null,
            empresa_provincia || null,
            empresa_distrito || null,
            empresa_ubicacion_maps || null,
            empresa_telefono || null,
            empresa_web || null,
            empresa_email || null,
            empresa_redes_sociales
              ? JSON.stringify(empresa_redes_sociales)
              : null,
            empresa_qr,
            estado || "activo",
            id,
          ]
        );
        return res.json({ message: "✅ Negocio actualizado correctamente", id });

      } else {
        // ➕ CREAR nuevo negocio
        const [result] = await pool.query(
          `INSERT INTO negocio (
            empresa_nombre, empresa_ruc, empresa_descripcion, empresa_logo, empresa_servicios,
            empresa_detalles, empresa_direccion, empresa_referencia, empresa_departamento,
            empresa_provincia, empresa_distrito, empresa_ubicacion_maps, empresa_telefono,
            empresa_web, empresa_email, empresa_redes_sociales, empresa_qr, estado
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            empresa_nombre,
            empresa_ruc,
            empresa_descripcion || null,
            empresa_logo,
            empresa_servicios || null,
            empresa_detalles || null,
            empresa_direccion || null,
            empresa_referencia || null,
            empresa_departamento || null,
            empresa_provincia || null,
            empresa_distrito || null,
            empresa_ubicacion_maps || null,
            empresa_telefono || null,
            empresa_web || null,
            empresa_email || null,
            empresa_redes_sociales
              ? JSON.stringify(empresa_redes_sociales)
              : null,
            empresa_qr,
            estado || "activo",
          ]
        );
        return res.json({
          message: "✅ Negocio creado correctamente",
          id: result.insertId,
        });
      }

    } catch (error) {
      console.error("❌ Error al registrar/actualizar negocio:", error);
      res.status(500).json({ error: "Error al registrar/actualizar negocio" });
    }
  }
);

// 📌 NUEVO: Endpoint para eliminar imágenes específicas
router.delete("/imagen/:tipo", async (req, res) => {
  try {
    const { tipo } = req.params; // 'logo' o 'qr'
    
    if (!['logo', 'qr'].includes(tipo)) {
      return res.status(400).json({ error: "Tipo de imagen no válido" });
    }

    const [rows] = await pool.query("SELECT * FROM negocio LIMIT 1");
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "No existe negocio registrado" });
    }

    const campo = tipo === 'logo' ? 'empresa_logo' : 'empresa_qr';
    
    await pool.query(`UPDATE negocio SET ${campo} = NULL WHERE id = ?`, [rows[0].id]);

    res.json({ 
      message: `✅ ${tipo === 'logo' ? 'Logo' : 'Código QR'} eliminado correctamente`,
      [campo]: null
    });

  } catch (error) {
    console.error(`❌ Error al eliminar imagen:`, error);
    res.status(500).json({ error: "Error al eliminar imagen" });
  }
});

module.exports = router;