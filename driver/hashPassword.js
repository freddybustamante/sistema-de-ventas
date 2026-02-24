const bcrypt = require('bcrypt');

const password = 'admin123'; // Cambia esto por la contraseña que deseas encriptar

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error generando el hash:', err);
  } else {
    console.log('Hash generado:', hash);
  }
});
