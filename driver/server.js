require('dotenv').config(); // Cargar variables de entorno

const express = require('express');
const cors = require('cors'); // Permitir peticiones desde otros dominios
const path = require('path');
const bodyParser = require('body-parser');
const conexion = require('./conexion'); // Usamos la conexión desde conexion.js
const XLSX = require('xlsx'); // Para exportación a Excel
const fs = require('fs'); // Necesario para manejar archivos

const app = express();


// Configurar middleware
app.use(cors()); // Habilita CORS para todas las rutas
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); //

app.use(express.static("public")); //agrego para probar hacer un backup del servidor 


// Importar rutas

const productosRoutes = require('./routes/productos');
const productosCreditoRoutes = require('./routes/productos-credito'); // <-- productos al credito
const ventasRoutes = require('./routes/ventas');
const loginRoutes = require('./routes/login');
const reportesRoutes = require('./routes/reportes');
const importarExcelRoutes = require('./routes/importarExcel');
const backupRoutes = require('./routes/backup');
const licenciaRoutes = require('./routes/licencia');// <--/ Seguridad por licencia/MAC
const ventasCreditoRoutes = require('./routes/ventas-credito');// Registro de ventas a crédito
const pagosCreditoRoutes = require('./routes/pagos-credito'); // NUEVA RUTA: Registro y consulta de pagos
const creditosRouter = require('./routes/creditos-cliente');// para historial-crditos.html
const alertasRoutes = require('./routes/alertas'); //para exportar incluso la lista no visible de stock minimo
const comprobantesRoutes = require('./routes/comprobantes');//comprobanes boleta factura para consultar 
const clientesRoutes = require('./routes/clientes');//buscar cliente para venta al contado y flex que sea reutilizable
const guardarComprobantesRoutes = require('./routes/guardar-comprobantes');//para guardar comprobantes desde 2 carritos 
const proformasRoutes = require('./routes/proformas'); // Ruta para manejar proformas desde ventas flexible
const metodosPagoRoutes = require('./routes/metodos-pago');//estos primer dos ultimos agregados apra metodos de pago
const pagosVentaRoutes = require('./routes/pagos-venta');//este segundo  agregados apra metodos de pago
// para caja
const cajaRoutes = require('./routes/caja');// // Ruta para manejar caja
const negocioRoutes = require("./routes/negocio");// para inggesar datos del negocio

// Definir rutas
app.use('/api/productos', productosRoutes);
app.use('/api/productos-credito', productosCreditoRoutes);// <-- productos al credito
app.use('/api/ventas', ventasRoutes);
app.use('/api/login', loginRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/importar-excel', importarExcelRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/licencia', licenciaRoutes);
app.use('/api/ventas-credito', ventasCreditoRoutes);
app.use('/api/pagos-credito', pagosCreditoRoutes); // 💳 Registrar y consultar pagos de cuentas a crédito
app.use('/api/creditos', creditosRouter); //para historial-crditos.html
app.use('/api/alertas', alertasRoutes); //para exportar incluso la lista no visible de stock minimo
app.use('/api/comprobantes', comprobantesRoutes);//consutar imprimir boletas factura etc
app.use('/api/clientes', clientesRoutes);//buscar cliente para venta al contado y flex que sea reutilizable
app.use('/api/guardar-comprobantes', guardarComprobantesRoutes);//para guardar comprobantes desde 2 carritos
app.use('/api/proformas', proformasRoutes);// Ruta para manejar proformas desde ventas flexible
// para caja
app.use('/api/caja', cajaRoutes); // Ruta para manejar caja
app.use("/api/negocio", negocioRoutes);//Ruta para datos del negocio  
// Servir archivos estáticos desde la carpeta 'uploads'
app.use('/api/metodos-pago', metodosPagoRoutes);//metdoos de pago mas agrego pagos venta
app.use('/api/pagos-venta', pagosVentaRoutes);//metdoos de pago mas agrego pagos venta
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));



// para ver solo probar si se cargan las rutas
// console.log("🔍 Rutas cargadas en Express:");
// const listarRutas = (stack, basePath = "") => {
//     stack.forEach((r) => {
//         if (r.route) {
//             console.log(`✅ ${Object.keys(r.route.methods).join(', ').toUpperCase()} ${basePath}${r.route.path}`);
//         } else if (r.name === "router" && r.handle.stack) {
//             listarRutas(r.handle.stack, basePath + (r.regexp.source.replace("^\\/", "").replace("\\/?(?=\\/|$)", "") || ""));
//         }
//     });
// };

// listarRutas(app._router.stack);


// Middleware para manejo de errores internos
app.use((err, req, res, next) => {
  console.error("Error en el servidor:", err);
  res.status(500).json({ error: "Error interno del servidor" });
});

// Exportar datos a Excel
app.get('/api/exportar-excel', async (req, res) => {
  try {
    const [rows] = await conexion.query("SELECT * FROM ventas");

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ventas");

    // Crear directorio "exports" si no existe
    const exportDir = path.join(__dirname, "exports");
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir);
    }

    const filePath = path.join(exportDir, "ventas.xlsx");
    XLSX.writeFile(workbook, filePath);

    res.download(filePath, "Reporte_Ventas.xlsx", (err) => {
      if (err) {
        console.error("Error al descargar el archivo:", err);
        res.status(500).json({ error: "No se pudo descargar el archivo" });
      }
    });
  } catch (error) {
    console.error("Error al exportar a Excel:", error);
    res.status(500).json({ error: "No se pudo exportar el archivo" });
  }
});


// console.log("Clave JWT cargada:", process.env.JWT_SECRET ? "✅ OK" : "❌ NO DEFINIDA");


// Directorios que se deben asegurar que existan
const uploadsDir = path.join(__dirname, 'public', 'uploads');
console.log('Accediendo a la carpeta uploads:', uploadsDir);

if (!fs.existsSync(uploadsDir)) {
  console.error('La carpeta "uploads" no existe.');
} else {
  console.log('La carpeta "uploads" está disponible.');
}

// Configuración del puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
