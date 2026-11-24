# Swaalia sur R36S (LÖVE2D)

Version console du jeu, réécrite en Lua pour LÖVE 11 (le jeu web reste la version principale).

## Lancer
1. `sh love/build.sh` crée `love/swaalia.love`.
2. Sur PC : `love love/` pour tester (clavier ou manette).
3. Sur la R36S (ArkOS + PortMaster) : copier `swaalia.love` dans `ports/swaalia/` avec un lanceur `Swaalia.sh` qui appelle le moteur LÖVE de PortMaster.

## Touches
A rouge = parler/prendre · B jaune = courir · Y vert = sac · X bleu = outil suivant · START = pause · SELECT = aide · L1/R1 = zoom · flèches et joystick gauche = marcher · joystick droit = regarder autour.

## Avancement
- [x] L'île, Myah qui marche (8 directions), collisions, caméra, zoom, toutes les touches
- [x] Les 13 habitants avec leurs vrais dialogues, la bulle de mission, ramasser (fruits, fleurs, crabes, coquillages), papillons au filet, le sac (Y)
- [x] Les 5 missions et les plumes de Gaïkin, les 7 intérieurs (maison, poste de soin, comptoir, musée, bateau, observatoire, maison Ukaï), sauvegarde (START, et toute seule toutes les 30 s)
- [x] Pêche (au bord de l'eau, avec la canne), vol avec Gaïkin (avec une plume), Memory et Piano des koalas (3 morceaux, A B Y X = les 4 couleurs)

Simplifications par rapport au jeu web : la plume est donnée directement à la fin d'une mission (pas de coffre à chercher), pas encore de cuisine, de vestiaire, d'île Koala ni de jour/nuit.
