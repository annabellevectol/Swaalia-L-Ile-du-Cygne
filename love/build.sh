#!/bin/sh
# Fabrique swaalia.love : à copier dans le dossier love2d de la carte SD de la R36S
cd "$(dirname "$0")"
A=assets; R=../assets
mkdir -p $A/npc3 $A/spr $A/music $A/piano $A/load
cp $R/map.jpg $R/myah/walk8.png $R/gaikin_fly.png $R/gaikin_perch.png $R/interieur2.jpg $R/soin2.jpg $R/mairie3.jpg $R/musee.jpg $R/bateau.jpg $R/observatoire.jpg $R/ukai.jpg $A/
cp $R/npc3/*.png $A/npc3/
cp $R/spr/shell0.png $R/spr/flower2.png $R/spr/fishA0.png $R/spr/crab0.png $R/spr/plume.png $R/spr/perle.png $R/spr/perroquet.png $R/spr/swan0.png $A/spr/
cp $R/music/berceuse.* $R/music/danse.* $R/music/lucioles.* $A/music/
cp $R/piano/*.png $R/piano/bg.jpg $A/piano/
cp $R/load/bg.jpg $R/load/sw*.png $A/load/
rm -f swaalia.love && zip -9 -r swaalia.love main.lua conf.lua data.lua assets >/dev/null && echo "swaalia.love prêt ($(du -h swaalia.love | cut -f1))"
