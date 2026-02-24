const express = require("express");
const router = express.Router();
const { exec } = require("child_process");
const multer = require("multer");
const path = require("path");

router.get("/generar", (req, res) => {
    try {
        const backupFile = path.join(__dirname, "../backups/backup.sql");
        const comando = `mysqldump -u root -pAasdfgf852 tienda_vue > "${backupFile}"`;

        exec(comando, (error, stdout, stderr) => {
            if (error) {
                console.error("❌ Error al generar backup:", error);
                return res.status(500).json({ error: "Error al generar backup", details: error.message });
            }
            res.download(backupFile);
        });
    } catch (err) {
        console.error("❌ Error inesperado:", err);
        res.status(500).json({ error: "Error inesperado", details: err.message });
    }
});

// Configurar almacenamiento de archivos subidos
const upload = multer({ dest: "uploads/" });

router.post("/restaurar", upload.single("backup"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No se ha seleccionado ningún archivo." });
    }

    const backupPath = path.join(__dirname, "..", req.file.path);
    const comando = `mysql -u root -pAasdfgf852 tienda_vue < ${backupPath}`;

    exec(comando, (error, stdout, stderr) => {
        if (error) {
            console.error("Error al restaurar backup:", stderr);
            return res.status(500).json({ error: "Error al restaurar backup", details: stderr });
        }
        res.json({ message: "✅ Base de datos restaurada correctamente." });
    });
});



module.exports = router;
