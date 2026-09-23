@echo off
rem UTF-8: para que los acentos de las carpetas (Agrupación) salgan bien
chcp 65001 >nul
:inicio
cls
echo Selecciona el tipo de proyecto:
echo.
echo 1. Residencial 	 - RS
echo 2. Nave Industrial  - NI
echo 3. Mezzanine        - MZ
echo.
choice /c 123Q /n /m "Teclea 1, 2, 3 o Q para salir: "
if errorlevel 4 goto salir
if errorlevel 3 set "CODE=MZ" & goto pedirnombre
if errorlevel 2 set "CODE=NI" & goto pedirnombre
if errorlevel 1 set "CODE=RS" & goto pedirnombre

:pedirnombre
set "PNAME="
set /p PNAME=Escribe el nombre del proyecto (ej. Acacia): 
if "%PNAME%"=="" (
  echo Nombre invalido. Intenta de nuevo.
  pause
  goto inicio
)

rem Aviso: evita \ / : * ? " < > | en nombres de carpeta
set "TARGET=%CODE%-%PNAME%"

if not exist "%TARGET%\" mkdir "%TARGET%" 2>nul

for %%S in (RECIBIDO MONETARIA ENTREGABLE PROCESO) do (
  if not exist "%TARGET%\%%S\" mkdir "%TARGET%\%%S" 2>nul
)

rem Arbol de Auxiliar IV dentro de PROCESO (el mismo que usa la app)
set "AUX=%TARGET%\PROCESO\Auxiliar IV"
for %%S in ("1 Agrupación" "2 Salidas\Memoria" "2 Salidas\Planos" "2 Salidas\Double Check" "3 Respaldos") do (
  if not exist "%AUX%\%%~S\" mkdir "%AUX%\%%~S" 2>nul
)

if exist "%TARGET%\" (
  echo Carpeta de proyecto creada: %TARGET%
  echo Subcarpetas: RECIBIDO, MONETARIA, ENTREGABLE, PROCESO
  echo En PROCESO\Auxiliar IV: 1 Agrupación, 2 Salidas ^(Memoria, Planos, Double Check^), 3 Respaldos
) else (
  echo No se pudo crear la carpeta (revisa caracteres invalidos o permisos).
)

echo.
choice /c SN /n /m "¿Crear otro proyecto? (S/N): "
if errorlevel 2 goto salir
goto inicio

:salir
echo Listo. Presiona una tecla para cerrar.
pause>nul

