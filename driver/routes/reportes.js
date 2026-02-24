const express = require("express");
const router = express.Router();
const pool = require("../conexion");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// =======================
// RANGO DE FECHAS
// =======================
function obtenerRangoFechas(rango) {
    const ahora = new Date();
    const fechaLima = new Date(ahora.toLocaleString("en-US", { timeZone: "America/Lima" }));
    
    const format = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    let inicio, fin;

    if (rango === "hoy") {
        const hoyStr = format(fechaLima);
        inicio = hoyStr;
        fin = hoyStr;
    } 
    else if (rango === "semana") {
        const diaSemana = fechaLima.getDay();
        const diferencia = diaSemana === 0 ? -6 : 1 - diaSemana;
        
        const lunes = new Date(fechaLima);
        lunes.setDate(fechaLima.getDate() + diferencia);
        
        const domingo = new Date(lunes);
        domingo.setDate(lunes.getDate() + 6);
        
        inicio = format(lunes);
        fin = format(domingo);
    } 
    else if (rango === "mes") {
        const primerDiaMes = new Date(fechaLima.getFullYear(), fechaLima.getMonth(), 1);
        inicio = format(primerDiaMes);
        fin = format(fechaLima); 
    } 
    else {
        throw new Error("Rango no válido");
    }

    console.log(`📅 Filtro aplicado (${rango}): ${inicio} al ${fin}`);
    return { inicio, fin };
}

// =======================
// DEBUG ENDPOINT (Temporal - eliminar en producción)
// =======================
router.get("/debug", async (req, res) => {
    try {
        const { rango = 'mes' } = req.query;
        const { inicio, fin } = obtenerRangoFechas(rango);

        // Verificar cuántas ventas hay en total
        const [totalVentas] = await pool.query(
            `SELECT COUNT(*) as total FROM ventas`
        );

        // Verificar ventas en el rango
        const [ventasRango] = await pool.query(
            `SELECT 
                id,
                DATE_FORMAT(fecha, '%Y-%m-%d %H:%i:%s') AS fecha,
                total
            FROM ventas 
            WHERE DATE(fecha) BETWEEN ? AND ?
            ORDER BY fecha DESC
            LIMIT 10`,
            [inicio, fin]
        );

        // Verificar la zona horaria del servidor MySQL
        const [timezone] = await pool.query(`SELECT NOW() as server_time, @@session.time_zone as tz`);

        res.json({
            rango,
            fechaInicio: inicio,
            fechaFin: fin,
            totalVentasBD: totalVentas[0].total,
            ventasEncontradas: ventasRango.length,
            muestraVentas: ventasRango,
            mysqlInfo: timezone[0],
            nodeJS: {
                fechaUTC: new Date().toISOString(),
                fechaLima: new Date().toLocaleString("en-US", { timeZone: "America/Lima" })
            }
        });

    } catch (err) {
        console.error("❌ Error en debug:", err);
        res.status(500).json({
            error: "Error en debug",
            details: err.message
        });
    }
});

// =======================
// GET /api/reportes (VERSIÓN CORREGIDA)
// =======================
router.get("/", async (req, res) => {
    try {
        const { rango = 'mes' } = req.query;
        const { inicio, fin } = obtenerRangoFechas(rango);

        console.log(`📊 Consultando ventas: ${rango} (${inicio} al ${fin})`);

        // 1️⃣ Ventas + productos - USA DATE() para comparar solo fechas
        const [ventas] = await pool.query(
            `SELECT
                v.id AS venta_id,
                DATE_FORMAT(v.fecha, '%Y-%m-%d %H:%i:%s') AS fecha,
                v.subtotal AS total_subtotal,
                v.igv AS total_igv,
                v.total AS total_ventas,
                COALESCE(v.profit, 0) AS profit,
                GROUP_CONCAT(CONCAT(p.nombre, ' (', dv.cantidad, ' uds)') SEPARATOR ', ') AS productos_vendidos
            FROM ventas v
            JOIN detalle_ventas dv ON v.id = dv.venta_id
            JOIN productos p ON dv.producto_id = p.id
            WHERE DATE(v.fecha) BETWEEN ? AND ?
            GROUP BY v.id
            ORDER BY v.fecha DESC`,
            [inicio, fin]
        );

        console.log(`✅ Ventas encontradas: ${ventas.length}`);

        if (ventas.length === 0) {
            console.log(`⚠️ No se encontraron ventas para el rango: ${rango}`);
            return res.json([]);
        }

        // 2️⃣ Pagos por venta y método
        const ventaIds = ventas.map(v => v.venta_id);

        const [pagos] = await pool.query(
            `SELECT
                pv.venta_id,
                mp.nombre AS metodo,
                SUM(pv.monto) AS monto
            FROM pagos_venta pv
            JOIN metodos_pago mp ON mp.id = pv.metodo_pago_id
            WHERE pv.venta_id IN (?)
            GROUP BY pv.venta_id, mp.id`,
            [ventaIds]
        );

        // 3️⃣ Agrupar pagos por venta
        const pagosPorVenta = {};
        pagos.forEach(p => {
            if (!pagosPorVenta[p.venta_id]) {
                pagosPorVenta[p.venta_id] = [];
            }
            pagosPorVenta[p.venta_id].push({
                metodo: p.metodo,
                monto: parseFloat(p.monto) || 0
            });
        });

        // 4️⃣ Adjuntar pagos a cada venta y asegurar tipos numéricos
        const resultado = ventas.map(v => ({
            fecha: v.fecha,
            total_subtotal: parseFloat(v.total_subtotal) || 0,
            total_igv: parseFloat(v.total_igv) || 0,
            total_ventas: parseFloat(v.total_ventas) || 0,
            profit: parseFloat(v.profit) || 0,
            productos_vendidos: v.productos_vendidos || '',
            pagos: pagosPorVenta[v.venta_id] || []
        }));

        res.json(resultado);

    } catch (err) {
        console.error("❌ Error al obtener reportes:", err);
        res.status(500).json({
            error: "Error al obtener reportes",
            details: err.message
        });
    }
});

// =======================
// EXPORTAR EXCEL
// =======================
router.get("/exportar", async (req, res) => {
    try {
        const { rango = 'mes' } = req.query;
        const { inicio, fin } = obtenerRangoFechas(rango);

        const [rows] = await pool.query(
            `SELECT
                DATE_FORMAT(v.fecha, '%Y-%m-%d %H:%i:%s') AS Fecha,
                v.subtotal AS Subtotal,
                v.igv AS IGV,
                v.total AS Total,
                COALESCE(v.profit, 0) AS Ganancia,
                GROUP_CONCAT(CONCAT(p.nombre, ' (', dv.cantidad, ' uds)') SEPARATOR ', ') AS Productos
            FROM ventas v
            JOIN detalle_ventas dv ON v.id = dv.venta_id
            JOIN productos p ON dv.producto_id = p.id
            WHERE DATE(v.fecha) BETWEEN ? AND ?
            GROUP BY v.id
            ORDER BY v.fecha DESC`,
            [inicio, fin]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: `No hay ventas en el rango ${rango}`
            });
        }

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(rows);

        worksheet['!cols'] = [
            { width: 20 },
            { width: 14 },
            { width: 10 },
            { width: 14 },
            { width: 14 },
            { width: 50 }
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, `Ventas_${rango}`);

        const fecha = new Date().toISOString().split("T")[0];
        const fileName = `Reporte_Ventas_${rango}_${fecha}.xlsx`;
        const filePath = path.join(__dirname, "../exports", fileName);

        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }

        XLSX.writeFile(workbook, filePath);

        res.download(filePath, fileName, err => {
            if (!err) {
                setTimeout(() => {
                    try {
                        fs.unlinkSync(filePath);
                    } catch (e) {
                        console.error("Error al eliminar archivo temporal:", e);
                    }
                }, 5000);
            }
        });

    } catch (err) {
        console.error("❌ Error al exportar:", err);
        res.status(500).json({
            error: "Error al exportar",
            details: err.message
        });
    }
});

module.exports = router;