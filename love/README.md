# Swaalia sur R36S (LÖVE2D)

Version console du jeu, réécrite en Lua pour LÖVE 11 (le jeu web reste la version principale).

## Lancer
1. `sh love/build.sh` crée `love/swaalia.love`.
2. Sur PC : `love love/` pour tester (clavier ou manette).
3. Sur la R36S (ArkOS + PortMaster) : copier `swaalia.love` dans `ports/swaalia/` avec un lanceur `Swaalia.sh` qui appelle le moteur LÖVE de PortMaster.

## Touches
A rouge = parler/prendre · B jaune = courir · Y vert = sac · X bleu = outil suivant · START = pause · SELECT = aide · L1/R1 = zoom · flèches et joystick gauche = marcher · joystick droit = regarder autour.

## Avancement
- [x] Étape 1 : l'île, Myah qui marche (8 directions animées), collisions, caméra, zoom, toutes les touches
- [ ] Étape 2 : habitants et dialogues, ramasser (fleurs, fruits, coquillages), le sac
- [ ] Étape 3 : missions, intérieurs, sauvegarde
- [ ] Étape 4 : pêche, filet, vol avec Gaïkin, mini-jeux
