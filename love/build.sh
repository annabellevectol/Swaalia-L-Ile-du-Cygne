#!/bin/sh
# Fabrique swaalia.love : à copier dans le dossier love2d de la carte SD de la R36S
cd "$(dirname "$0")"
A=assets; R=../assets
mkdir -p $A/chin && cp $R/chin/*.png $A/chin/
mkdir -p $A/npc3 $A/spr $A/music $A/piano $A/load
cp $R/gaikin_fly.png $R/gaikin_perch.png $R/interieur2.jpg $R/soin2.jpg $R/mairie3.jpg $R/musee.jpg $R/bateau.jpg $R/observatoire.jpg $R/ukai.jpg $A/
cp $R/npc3/*.png $A/npc3/
mkdir -p $A/myah
python3 - <<'P'
from PIL import Image
Image.open('../assets/map.jpg').resize((2048,1144),Image.LANCZOS).save('assets/map.jpg',quality=88)   # pas d'image de plus de 2048 px (limite de la console)
for a,b in [('walk8','walk'),('walkbask','walkbask'),('walknet','walknet'),('walkrod','walkrod')]:
  im=Image.open('../assets/myah/%s.png'%a); im.resize((im.width//2,im.height//2),Image.LANCZOS).save('assets/myah/%s.png'%b,optimize=True)
P
cp $R/spr/shell?.png $R/spr/flower?.png $R/spr/fish*.png $R/spr/crab0.png $R/spr/plume.png $R/spr/perle.png $R/spr/perroquet.png $R/spr/swan0.png $R/spr/an_*.png $A/spr/
cp /tmp/bf/bfly*.png $A/spr/ 2>/dev/null || cp bfly/*.png $A/spr/
cp $R/music/berceuse.* $R/music/danse.* $R/music/lucioles.* $A/music/
cp $R/piano/*.png $R/piano/bg.jpg $A/piano/
cp $R/load/bg.jpg $R/load/sw*.png $A/load/
rm -f swaalia.love && zip -9 -r swaalia.love main.lua conf.lua data.lua data2.lua assets >/dev/null && echo "swaalia.love prêt ($(du -h swaalia.love | cut -f1))"
