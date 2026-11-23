# Liste des fichiers du jeu pour le mode hors ligne, avec une empreinte par fichier (pour ne retélécharger que ce qui change)
import subprocess, json, hashlib
out = subprocess.run(['git', 'ls-files', '-s'], capture_output=True, text=True).stdout.splitlines()
F = {}
for l in out:
  meta, path = l.split('\t', 1)
  if not (path.startswith('assets/') or path in ('index.html','art.js','data.js','game.js','grass.js','myah.js','mymask.js','npcs.js','packs.js','sprites.js','manifest.webmanifest','icon192.png','icon512.png')): continue   # seulement ce que le site publie
  F[path] = meta.split()[1][:10]
v = hashlib.sha1(json.dumps(F, sort_keys=True).encode()).hexdigest()[:10]
json.dump({'v': v, 'files': F}, open('offline.json', 'w'), separators=(',', ':'))
print(v, len(F))
