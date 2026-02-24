#!/bin/bash

# Cargar las variables de entorno desde el archivo .env
set -o allexport
source .env
set +o allexport

DB_HOST="${DB_HOST:-localhost}"       # Valor por defecto si no está en .env
DB_USER_ADMIN="${DB_USER:-root}"      # Asumimos que DB_USER en .env es el admin
DB_PASSWORD_ADMIN="${DB_PASSWORD}"
DB_NAME="${DB_DATABASE:-tienda_vue}" # Valor por defecto si no está en .env
DB_USER_APP="mi_usuario_app"          # Define el usuario para tu aplicación
DB_PASSWORD_APP="contrasena_app"      # Define la contraseña para tu aplicación
SQL_FILE="schema.sql"
DATA_FILE="data.sql"

echo "Configurando la base de datos '$DB_NAME' en '$DB_HOST'..."

# Crear la base de datos si no existe
mysql -h "$DB_HOST" -u "$DB_USER_ADMIN" -p"$DB_PASSWORD_ADMIN" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"
if [ $? -ne 0 ]; then
    echo "Error al crear la base de datos."
    exit 1
fi

# Seleccionar la base de datos
mysql -h "$DB_HOST" -u "$DB_USER_ADMIN" -p"$DB_PASSWORD_ADMIN" -e "USE $DB_NAME;"

# Ejecutar el script de esquema (crear tablas)
echo "Creando las tablas desde '$SQL_FILE'..."
mysql -h "$DB_HOST" -u "$DB_USER_ADMIN" -p"$DB_PASSWORD_ADMIN" "$DB_NAME" < "$SQL_FILE"
if [ $? -ne 0 ]; then
    echo "Error al crear las tablas."
    exit 1
fi

# Crear el usuario de la aplicación si no existe
if ! mysql -h "$DB_HOST" -u "$DB_USER_ADMIN" -p"$DB_PASSWORD_ADMIN" -e "SELECT EXISTS(SELECT 1 FROM mysql.user WHERE user='$DB_USER_APP' AND host='localhost')" | grep -q 1; then
    echo "Creando el usuario '$DB_USER_APP'@'localhost'..."
    mysql -h "$DB_HOST" -u "$DB_USER_ADMIN" -p"$DB_PASSWORD_ADMIN" -e "CREATE USER IF NOT EXISTS '$DB_USER_APP'@'localhost' IDENTIFIED BY '$DB_PASSWORD_APP';"
    mysql -h "$DB_HOST" -u "$DB_USER_ADMIN" -p"$DB_PASSWORD_ADMIN" -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER_APP'@'localhost';"
    mysql -h "$DB_HOST" -u "$DB_USER_ADMIN" -p"$DB_PASSWORD_ADMIN" -e "FLUSH PRIVILEGES;"
else
    echo "El usuario '$DB_USER_APP'@'localhost' ya existe."
fi

# Importar datos iniciales (opcional)
if [ -f "$DATA_FILE" ]; then
    echo "Importando datos iniciales desde '$DATA_FILE'..."
    mysql -h "$DB_HOST" -u "$DB_USER_ADMIN" -p"$DB_PASSWORD_ADMIN" "$DB_NAME" < "$DATA_FILE"
    if [ $? -ne 0 ]; then
        echo "Error al importar los datos iniciales."
        exit 1
    fi
fi

echo "Configuración de la base de datos completada."