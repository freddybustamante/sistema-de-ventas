const pool = require('../conexion');
const crypto = require('crypto');
const moment = require('moment');

const CLAVE_SECRETA = process.env.CLAVE_SERIAL || "MI_CLAVE_SERIAL";
const IV = Buffer.alloc(16, 0);

// solucion al problema de refrescar el forntend recueprar la clave ya generada
exports.obtenerSerieGenerada = async (req, res) => {
    try {
        // Intenta obtener una clave activa
        const [licenciaActiva] = await pool.query("SELECT codigo FROM licencias WHERE estado = 'activa' ORDER BY fecha_expiracion DESC LIMIT 1");

        if (licenciaActiva.length > 0) {
            return res.json({ serial: licenciaActiva[0].codigo });
        }

        // Si no hay clave activa, intenta obtener una clave de prueba
        const [licenciaPrueba] = await pool.query("SELECT codigo FROM licencias WHERE estado = 'prueba' ORDER BY fecha_fin_prueba DESC LIMIT 1");

        if (licenciaPrueba.length > 0) {
            return res.json({ serial: licenciaPrueba[0].codigo });
        }

        // Si no hay claves activas ni de prueba, devuelve un error
        res.status(404).json({ error: "Serie no encontrada" });
    } catch (error) {
        console.error("Error al obtener la serie generada:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};
function generarSerieMejorada(clienteId) {
    const fechaGeneracion = Date.now();
    const datos = `${clienteId}-${fechaGeneracion}-${crypto.randomBytes(8).toString('hex')}`;
    const serieBase = crypto.createHash('sha256').update(datos).digest('hex').toUpperCase().slice(0, 32);
    const codigoVerificacion = generarCodigoVerificacion(serieBase);
    const serie = `${serieBase}-${codigoVerificacion}`;
    console.log("Serie Generada:", serie, "Longitud:", serie.length); //Agregado para debug.
    return serie;
}


// Antes de intentar insertar una nueva serie, verifica si ya existe una serie con estado = 'prueba'.
// Si existe una serie, devuélvela al frontend.
// Si no existe, genera una nueva serie y la inserta en la base de datos.
exports.generarSerial = async (req, res) => {
    try {
        console.log("Generando serie de prueba...");

        // Verifica si ya existe una serie generada
        const [existingSerie] = await pool.query("SELECT codigo FROM licencias WHERE estado = 'prueba' LIMIT 1");

        if (existingSerie.length > 0) {
            console.log("Serie existente encontrada:", existingSerie[0].codigo);
            return res.json({ serial: existingSerie[0].codigo });
        }

        // Si no existe, genera una nueva serie
        const clienteId = req.query.clienteId || 'GENERICO';
        const serie = generarSerieMejorada(clienteId);
        const fechaInicioPrueba = moment().format('YYYY-MM-DD');
        const fechaFinPrueba = moment().add(90, 'days').format('YYYY-MM-DD');
        const mac_pc = crypto.randomBytes(8).toString('hex'); // Genera un valor aleatorio para mac_pc

        const [result] = await pool.query(
            "INSERT INTO licencias (codigo, estado, mac_pc, fecha_inicio_prueba, fecha_fin_prueba) VALUES (?, 'prueba', ?, ?, ?)",
            [serie, mac_pc, fechaInicioPrueba, fechaFinPrueba]
        );

        console.log("Serie de prueba generada:", serie);
        res.json({ serial: serie });
    } catch (error) {
        console.error("Error al generar la serial:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};


function generarCodigoVerificacion(serieBase) {
    let suma = 0;
    for (let i = 0; i < serieBase.length; i++) {
        suma += serieBase.charCodeAt(i);
    }
    return suma % 97;
}

exports.activarSistema = async (req, res) => {
    try {
        const { serial } = req.body;
        if (!validarSerieMejorada(serial)) {
            return res.status(400).json({ error: "Serial inválida" });
        }
        const [licencia] = await pool.query("SELECT * FROM licencias WHERE codigo = ?", [serial]);
        if (licencia.length === 0) {
            return res.status(400).json({ error: "Serial no encontrada" });
        }
        await pool.query("UPDATE licencias SET estado = 'activa' WHERE codigo = ?", [serial]);
        res.json({ mensaje: "Sistema activado correctamente" });
    } catch (error) {
        console.error("Error al activar el sistema:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

exports.verificarEstado = async (req, res) => {
    try {
        const [licencia] = await pool.query("SELECT * FROM licencias WHERE estado = 'activa' LIMIT 1");
        if (licencia.length > 0) {
            return res.json({ licenciaActiva: true, mensaje: "Licencia permanente activa" });
        }
        const [licenciaPrueba] = await pool.query("SELECT * FROM licencias WHERE estado = 'prueba' LIMIT 1");
        if (licenciaPrueba.length > 0) {
            const fechaFinPrueba = moment(licenciaPrueba[0].fecha_fin_prueba);
            const diasRestantes = fechaFinPrueba.diff(moment(), 'days');
            if (diasRestantes > 0) {
                return res.json({ licenciaActiva: false, mensaje: `Período de prueba activo. Días restantes: ${diasRestantes}` });
            } else {
                // Actualizar el estado a 'inactiva' si la prueba ha expirado
                await pool.query("UPDATE licencias SET estado = 'inactiva' WHERE codigo = ?", [licenciaPrueba[0].codigo]);
                return res.json({ licenciaActiva: false, mensaje: "Período de prueba expirado. Active el sistema." });
            }
        }
        return res.json({ licenciaActiva: false, mensaje: "Sistema no activado" });
    } catch (error) {
        console.error("Error al verificar el estado de la licencia:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

function validarSerieMejorada(serie) {
    const partes = serie.split('-');
    if (partes.length !== 2) return false;
    const serieBase = partes[0];
    const codigoVerificacion = parseInt(partes[1]);
    return generarCodigoVerificacion(serieBase) === codigoVerificacion;
}

