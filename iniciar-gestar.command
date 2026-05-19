#!/bin/bash
# Doble clic en este archivo desde el Finder para arrancar todo el sistema

PROYECTO="/Users/josegondolaescudero/Documents/Proyectos/gestar-erp"

# Abre ventana de Terminal para el backend
osascript -e "
tell application \"Terminal\"
  activate
  do script \"echo '🚀 Iniciando backend Gestar ERP...' && cd $PROYECTO && npm run dev\"
end tell"

# Espera un segundo y abre ventana de Terminal para el frontend
sleep 1

osascript -e "
tell application \"Terminal\"
  activate
  do script \"echo '🎨 Iniciando frontend Gestar ERP...' && cd $PROYECTO/frontend && npm run dev\"
end tell"

# Espera 4 segundos y abre el navegador
sleep 4
open "http://localhost:5173"
