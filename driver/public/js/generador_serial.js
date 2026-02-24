const crypto = require("crypto");
const readline = require("readline");

// Clave secreta (debe ser la misma usada en el backend)
const AES_SECRET_KEY = "MI_CLAVE_SECRETA_32B"; 

// Crear interfaz para leer entrada de usuario
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question("Ingrese el código de activación: ", (codigo) => {
    try {
        const cipher = crypto.createCipheriv("aes-256-ecb", AES_SECRET_KEY, null);
        let serial = cipher.update(codigo, "utf8", "hex");
        serial += cipher.final("hex");

        console.log(`Serial generado: ${serial}`);
    } catch (error) {
        console.error("Error generando serial:", error);
    }
    rl.close();
});
