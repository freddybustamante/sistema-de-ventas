require('dotenv').config();
const mysql = require('mysql2/promise'); // Se recomienda usar `promise` para consultas async/await

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 20,  // Número de conexiones simultáneas
  queueLimit: 0
});

pool.getConnection()
  .then(connection => {
    console.log('✅ Conexión a la base de datos establecida correctamente.');
    connection.release(); // Liberar conexión al pool
  })
  .catch(error => {
    console.error('❌ Error al conectar a la base de datos:', error.message);
  });

module.exports = pool; // Exportar el pool de conexiones
