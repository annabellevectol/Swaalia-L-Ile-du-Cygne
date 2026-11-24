#!/bin/sh
# Fabrique swaalia.love (à copier sur la carte SD de la R36S, avec PortMaster / le moteur LÖVE)
cd "$(dirname "$0")"
mkdir -p assets && cp ../assets/map.jpg ../assets/myah/walk8.png assets/
rm -f swaalia.love && zip -9 -r swaalia.love main.lua conf.lua assets >/dev/null && echo "swaalia.love prêt"
