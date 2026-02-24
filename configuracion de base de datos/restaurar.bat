@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ============================================
echo   RESTAURANDO ESTRUCTURA + DATOS METODOS_PAGO
echo ============================================
echo.

REM ---------------------------------------------
REM 1. Verificar archivos
REM ---------------------------------------------
if not exist backup.sql (
    echo ERROR: No se encuentra backup.sql
    pause
    exit /b 1
)

echo [+] Archivo encontrado: backup.sql
echo [+] Base de datos destino: tienda_vue
echo.

REM ---------------------------------------------
REM 2. Recrear base de datos
REM ---------------------------------------------
echo [+] Paso 1: Recreando base de datos limpia...
mysql -u root -pAasdfgf852 -e "DROP DATABASE IF EXISTS tienda_vue;" 2>nul
mysql -u root -pAasdfgf852 -e "CREATE DATABASE tienda_vue CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>nul
echo [OK] Base de datos creada.
echo.

REM ---------------------------------------------
REM 3. Restaurar TODA la estructura (SIN --no-data)
REM ---------------------------------------------
echo [+] Paso 2: Importando estructura completa...
echo Esto puede tardar dependiendo del tamano del archivo...
mysql -u root -pAasdfgf852 tienda_vue < backup.sql 2>nul
echo [OK] Estructura restaurada exitosamente.
echo.

REM ---------------------------------------------
REM 4. Insertar datos de metodos_pago
REM ---------------------------------------------
echo [+] Paso 3: Insertando datos de metodos_pago...
mysql -u root -pAasdfgf852 tienda_vue -e "DELETE FROM metodos_pago; INSERT INTO metodos_pago (codigo, nombre, requiere_vuelto, activo) VALUES ('EFECTIVO','Efectivo',1,1),('YAPE','Yape',0,1),('PLIN','Plin',0,1),('TARJETA','Tarjeta',0,1);" 2>nul
echo [OK] Datos insertados.
echo.

REM ---------------------------------------------
REM 5. Verificar tablas y datos
REM ---------------------------------------------
echo [+] Paso 4: Verificando tablas creadas...
mysql -u root -pAasdfgf852 tienda_vue -e "SHOW TABLES;" 2>nul
echo.
echo [+] Paso 5: Verificando datos de metodos_pago...
mysql -u root -pAasdfgf852 tienda_vue -e "SELECT * FROM metodos_pago;" 2>nul

echo.
echo ============================================
echo   PROCESO COMPLETADO CORRECTAMENTE
echo ============================================
pause