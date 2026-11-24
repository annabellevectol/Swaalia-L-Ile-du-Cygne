-- Swaalia - L'Île du Cygne : version LÖVE2D pour la console R36S (écran 640x480)
--
-- Touches de la R36S :
--   A (rouge) = parler / prendre / valider     B (jaune) = courir (garder appuyé) / retour
--   Y (vert)  = sac à dos                       X (bleu)  = changer d'outil
--   START     = menu (reprendre, mini-jeux, sauvegarder)   SELECT = aide des touches
--   L1 / R1   = zoom                            flèches et joystick gauche = marcher
--   joystick droit = regarder autour
-- Au clavier (PC) : flèches, Entrée=A, Maj=B, Y, X, Échap=START, Tab=SELECT, Q/E=L1/R1

local DATA = require("data")
local W, H = 640, 480
local WORLD_W, WORLD_H, CELL, GW, GH = 917, 512, 4, 229, 128
local MS = 0.26                      -- taille de Myah : pixels de carte par pixel de case

-- ======================= ressources =======================
local IMG, walkMask, seaMask, names = {}, nil, nil, nil
local frameIndex = {}
local fonts = {}
local function img(path)
  if IMG[path] == nil then
    local ok, im = pcall(love.graphics.newImage, path)
    IMG[path] = ok and im or false
  end
  return IMG[path] or nil
end

-- ======================= état du jeu =======================
local S                              -- la sauvegarde (tout ce qui doit être gardé)
local function newSave()
  return { x = DATA.start[1], y = DATA.start[2], inv = {}, quest = {}, plumes = 0, talk = {}, mini = {} }
end
local scene = "title"                -- title / world / inside / dialog / bag / menu / help / fish / memory / piano / fly / ending
local place = nil                    -- la maison où l'on est (nil = dehors)
local player = { x = 0, y = 0, dir = "down", moving = false, t = 0 }
local cam = { x = 0, y = 0, zoom = 2.0, lookX = 0, lookY = 0 }
local toast, toastT = nil, 0
local TOOLS = { { k = "basket", n = "Panier" }, { k = "net", n = "Filet" }, { k = "rod", n = "Canne" }, { k = "fly", n = "Voler" } }
local tool = 1
local pad
local dlg = nil                      -- { who, lines, i, after }
local menuSel, titleSel = 1, 1
local hasSave = false

local ITEM = { coconut = "Noix de coco", banana = "Bananes", mango = "Mangues", flower = "Fleurs", butterfly = "Papillons", fish = "Poissons", crab = "Crabes", shell = "Coquillages", perle = "Perles" }
local ITEM_COL = { coconut = { .55, .35, .2 }, banana = { .98, .85, .25 }, mango = { 1, .6, .2 }, flower = { .95, .5, .7 }, butterfly = { .5, .7, 1 }, fish = { .4, .7, .9 }, crab = { .95, .35, .25 }, shell = { .98, .9, .8 }, perle = { .95, .95, 1 } }

local function say(t, d) toast, toastT = t, d or 2.6 end
local function dist(a, b, c, d) return math.sqrt((a - c) ^ 2 + (b - d) ^ 2) end
local function inv(k) return S.inv[k] or 0 end
local function give(k, n) S.inv[k] = inv(k) + (n or 1) end

-- ======================= sauvegarde =======================
local function ser(v)
  local t = type(v)
  if t == "number" or t == "boolean" then return tostring(v) end
  if t == "string" then return string.format("%q", v) end
  if t == "table" then
    local o = {}
    for k, x in pairs(v) do o[#o + 1] = "[" .. ser(k) .. "]=" .. ser(x) end
    return "{" .. table.concat(o, ",") .. "}"
  end
  return "nil"
end
local function saveGame()
  S.x, S.y = player.x, player.y
  love.filesystem.write("partie.lua", "return " .. ser(S))
end
local function loadGame()
  if not love.filesystem.getInfo("partie.lua") then return false end
  local ok, f = pcall(love.filesystem.load, "partie.lua")
  if not ok or not f then return false end
  local ok2, t = pcall(f)
  if ok2 and type(t) == "table" then S = t; return true end
  return false
end

-- ======================= le monde =======================
local function cellOf(mask, x, y)
  local cx, cy = math.floor(x / CELL), math.floor(y / CELL)
  if cx < 0 or cy < 0 or cx >= GW or cy >= GH then return 0 end
  return mask:byte(cy * GW + cx + 1)
end
local function walkable(x, y) return cellOf(walkMask, x, y) == 1 end
local function nearSea(x, y)
  for dy = -16, 16, 4 do for dx = -16, 16, 4 do if cellOf(seaMask, x + dx, y + dy) == 1 then return true end end end
  return false
end

local trees, flowers, butterflies, crabs = {}, {}, {}, {}
local function setupWorld()
  trees = {}
  for _, t in ipairs(DATA.trees) do trees[#trees + 1] = { x = t.x, y = t.y, kind = t.kind, fruits = 5, regrow = 0 } end
  -- des fleurs sur l'herbe (toujours aux mêmes endroits)
  flowers = {}
  local seed = 7
  local function rnd() seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 end
  local tries = 0
  while #flowers < 14 and tries < 4000 do
    tries = tries + 1
    local x, y = 60 + rnd() * 800, 120 + rnd() * 270
    if walkable(x, y) and not nearSea(x, y) then
      local ok = true
      for _, f in ipairs(flowers) do if dist(f.x, f.y, x, y) < 40 then ok = false end end
      if ok then flowers[#flowers + 1] = { x = x, y = y, c = math.floor(rnd() * 10), regrow = 0, on = true } end
    end
  end
  butterflies = {}
  for i = 1, 5 do
    local f = flowers[(i * 3) % #flowers + 1] or { x = 400, y = 250 }
    butterflies[i] = { x = f.x, y = f.y - 10, hx = f.x, hy = f.y, t = i, on = true, regrow = 0, c = i }
  end
  crabs = {}
  for i = 1, 4 do crabs[i] = { x = 250 + i * 110, y = 430, t = i * 1.7, on = true, regrow = 0 } end
end

-- ======================= habitants =======================
local npcs = {}
local function polyCenter(P)
  local sx, sy = 0, 0
  for _, p in ipairs(P) do sx, sy = sx + p[1], sy + p[2] end
  return sx / #P, sy / #P
end
local function setupNpcs()
  npcs = {}
  local indoor = {}
  for _, q in ipairs(DATA.indoor) do indoor[q.quest] = q.house end
  for _, n in ipairs(DATA.npcs) do
    local o = { d = n, x = n.x, y = n.y, house = nil }
    if n.id and indoor[n.id] then
      for _, h in ipairs(DATA.houses) do
        if h.id == indoor[n.id] and h.floor then
          local cx, cy = polyCenter(h.floor); o.house, o.x, o.y = h.id, cx + 60, cy - 10
        end
      end
    end
    if o.x > 0 then npcs[#npcs + 1] = o end
  end
end

local function questsDone()
  local n = 0
  for _, q in ipairs(DATA.npcs) do if q.id and S.quest[q.id] == "done" then n = n + 1 end end
  return n
end
local function needText(need)
  local o = {}
  for k, n in pairs(need) do o[#o + 1] = n .. " " .. (ITEM[k] or k) .. " (tu en as " .. inv(k) .. ")" end
  return table.concat(o, ", ")
end
local function hasNeed(need)
  for k, n in pairs(need) do if inv(k) < n then return false end end
  return true
end

local function openDialog(who, lines, after)
  if not lines or #lines == 0 then return end
  dlg = { who = who, lines = lines, i = 1, after = after, back = scene }
  scene = "dialog"
end

local function talkTo(o)
  local n = o.d
  if n.id then
    local st = S.quest[n.id]
    if st == "done" then openDialog(n.who, { "Merci encore, Myah ! Grâce à toi, l'île va mieux." }); return end
    if n.final and questsDone() < 4 then openDialog(n.who, n.locked or { "Reviens plus tard !" }); return end
    if not st then
      S.quest[n.id] = "active"
      openDialog(n.who, n.start, function() say("Nouvelle mission : " .. (n.title or "")) end)
    elseif hasNeed(n.need or {}) then
      for k, c in pairs(n.need or {}) do S.inv[k] = inv(k) - c end
      S.quest[n.id] = "done"; S.plumes = S.plumes + 1
      local lines = {}
      for _, l in ipairs(n.done or {}) do lines[#lines + 1] = l end
      lines[#lines + 1] = "Tu reçois une plume de Gaïkin ! (" .. S.plumes .. "/5)"
      openDialog(n.who, lines, function()
        saveGame()
        if S.plumes >= 5 then scene = "ending" end
      end)
    else
      local l = {}
      for _, x in ipairs(n.remind or {}) do l[#l + 1] = x end
      l[#l + 1] = "Il me faut : " .. needText(n.need or {})
      openDialog(n.who, l)
    end
  elseif n.lines then
    S.talk[n.k] = ((S.talk[n.k] or 0) % #n.lines) + 1
    openDialog(n.who, { n.lines[S.talk[n.k]] })
  end
end

-- ======================= entrées =======================
local function axis(name)
  if not pad or not pad:isGamepad() then return 0 end
  local v = pad:getGamepadAxis(name); if math.abs(v) < 0.2 then return 0 end; return v
end
local function down(btn, key)
  if pad and pad:isGamepad() and pad:isGamepadDown(btn) then return true end
  return key and love.keyboard.isDown(key) or false
end
local function moveInput()
  local dx, dy = axis("leftx"), axis("lefty")
  if down("dpleft", "left") then dx = -1 end; if down("dpright", "right") then dx = 1 end
  if down("dpup", "up") then dy = -1 end; if down("dpdown", "down") then dy = 1 end
  return dx, dy
end

-- ======================= mini-jeu : pêche =======================
local fishG
local function startFish()
  fishG = { pos = 0, dir = 1, zone = 0.35 + math.random() * 0.3, w = 0.16, t = 0, tries = 3, back = scene }
  scene = "fish"
end

-- ======================= mini-jeu : memory =======================
local memG
local MEM_IMG = { "assets/spr/shell0.png", "assets/spr/flower2.png", "assets/spr/fishA0.png", "assets/spr/crab0.png", "assets/spr/plume.png", "assets/spr/perle.png", "assets/spr/perroquet.png", "assets/spr/swan0.png" }
local function startMemory()
  local cards = {}
  for i = 1, 8 do cards[#cards + 1] = i; cards[#cards + 1] = i end
  for i = #cards, 2, -1 do local j = math.random(i); cards[i], cards[j] = cards[j], cards[i] end
  memG = { cards = cards, open = {}, found = {}, sel = 1, wait = 0, pairs = 0, moves = 0 }
  scene = "memory"
end

-- ======================= mini-jeu : piano des koalas =======================
local pianoG
local SONGS = { { f = "berceuse", n = "Berceuse de l'eucalyptus" }, { f = "danse", n = "La danse des koalas" }, { f = "lucioles", n = "Fête sous les lucioles" } }
local LANE_BTN = { "a", "b", "y", "x" }               -- rose = A rouge, jaune = B, vert = Y, bleu = X
local LANE_KEY = { a = 1, b = 2, y = 3, x = 4 }
local LANE_COL = { { .96, .64, .75 }, { .97, .84, .45 }, { .62, .88, .75 }, { .61, .79, .95 } }
local function loadChart(f)
  local ok, txt = pcall(love.filesystem.read, "assets/music/" .. f .. ".json")
  local notes = {}
  if not ok or not txt then return notes end
  for body in txt:gmatch("%[([%d%.,%-]+)%]") do
    local t, l, d = body:match("^([%d%.]+),(%d+),?([%d%.]*)$")
    if t then notes[#notes + 1] = { t = tonumber(t), l = tonumber(l) + 1, d = tonumber(d) or 0, hit = false, miss = false, hold = false } end
  end
  return notes
end
local function startPiano(i)
  local s = SONGS[i]
  local ok, src = pcall(love.audio.newSource, "assets/music/" .. s.f .. ".mp3", "stream")
  pianoG = { song = s, notes = loadChart(s.f), src = ok and src or nil, t = -2, score = 0, combo = 0, fx = {}, flash = { 0, 0, 0, 0 }, held = {}, done = false, perfect = 0, total = 0 }
  pianoG.total = #pianoG.notes
  scene = "piano"
end
local function pianoHit(lane)
  local g = pianoG; if not g or g.done then return end
  g.flash[lane] = 0.15
  local best, bd = nil, 0.25
  for _, n in ipairs(g.notes) do
    if n.l == lane and not n.hit and not n.miss then
      local d = math.abs(n.t - g.t)
      if d < bd then best, bd = n, d end
    end
  end
  if best then
    best.hit = true
    local p = bd < 0.09
    g.score = g.score + (p and 100 or 50); g.combo = g.combo + 1
    if p then g.perfect = g.perfect + 1 end
    if best.d > 0 then best.hold = true; g.held[lane] = best end
    g.fx[#g.fx + 1] = { l = lane, a = 1, txt = p and "Parfait !" or "Bien !" }
  end
end

-- ======================= le vol avec Gaïkin =======================
local flyG
local function startFly()
  flyG = { x = player.x, y = player.y, alt = 0, t = 0 }
  scene = "fly"; cam.zoom = 1.4
  say("Gaïkin t'emmène ! B pour atterrir.")
end

-- ======================= action (bouton A) =======================
local function insidePoly(P, x, y)
  local c = false
  local j = #P
  for i = 1, #P do
    local xi, yi, xj, yj = P[i][1], P[i][2], P[j][1], P[j][2]
    if ((yi > y) ~= (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi) then c = not c end
    j = i
  end
  return c
end


local function nearestNpc(maxd)
  local best, bd = nil, maxd
  for _, o in ipairs(npcs) do
    if o.house == (place and place.id or nil) then
      local d = dist(o.x, o.y, player.x, player.y)
      if d < bd then best, bd = o, d end
    end
  end
  return best
end

local function actionA()
  if place then
    local o = nearestNpc(45 * place.K / 3.5 * 3)
    if o then talkTo(o); return end
    say("Pour sortir, marche vers la lumière de la porte.")
    return
  end
  local o = nearestNpc(22)
  if o then talkTo(o); return end
  for _, h in ipairs(DATA.houses) do
    if h.floor and dist(player.x, player.y, h.door[1], h.door[2]) < 18 then
      place = h; player.x, player.y = h.sexit[1], h.sexit[2] - 40
      for k = 0, 400, 5 do if insidePoly(h.floor, h.sexit[1], h.sexit[2] - 40 - k) then player.y = h.sexit[2] - 40 - k; break end end
      scene = "inside"; say(h.name); return
    end
  end
  if dist(player.x, player.y, DATA.perch[1], DATA.perch[2]) < 30 then
    if S.plumes >= 1 then startFly() else openDialog("Gaïkin, le grand Cygne", { "Rapporte-moi une plume, Myah, et je t'emmènerai voler au-dessus de l'île." }) end
    return
  end
  local tk = TOOLS[tool].k
  if tk == "basket" then
    for _, t in ipairs(trees) do
      if dist(t.x, t.y, player.x, player.y) < 26 then
        if t.fruits > 0 then t.fruits = t.fruits - 1; give(t.kind); say("+1 " .. ITEM[t.kind] .. " (" .. inv(t.kind) .. ")") else say("Cet arbre n'a plus de fruits. Reviens plus tard !") end
        return
      end
    end
    for _, f in ipairs(flowers) do
      if f.on and dist(f.x, f.y, player.x, player.y) < 14 then f.on = false; f.regrow = 40; give("flower"); say("+1 fleur (" .. inv("flower") .. ")"); return end
    end
    for _, c in ipairs(crabs) do
      if c.on and dist(c.x, c.y, player.x, player.y) < 16 then c.on = false; c.regrow = 30; give("crab"); say("+1 crabe (" .. inv("crab") .. ")"); return end
    end
    if player.y > 395 and math.random() < 0.25 then give("shell"); say("Un joli coquillage ! (" .. inv("shell") .. ")"); return end
    say("Rien à cueillir ici. Essaie près des arbres ou des fleurs.")
  elseif tk == "net" then
    for _, b in ipairs(butterflies) do
      if b.on and dist(b.x, b.y, player.x, player.y - 10) < 22 then b.on = false; b.regrow = 25; give("butterfly"); say("Attrapé ! +1 papillon (" .. inv("butterfly") .. ")"); return end
    end
    say("Approche-toi d'un papillon.")
  elseif tk == "rod" then
    if nearSea(player.x, player.y) then startFish() else say("Va au bord de l'eau pour pêcher.") end
  elseif tk == "fly" then
    if S.plumes >= 1 then startFly() else say("Il te faut une plume de Gaïkin pour voler.") end
  end
end

-- ======================= boutons =======================
local function press(b)
  if scene == "title" then
    if b == "dpup" or b == "dpdown" then titleSel = hasSave and (3 - titleSel) or 1 end
    if b == "a" or b == "start" then
      if hasSave and titleSel == 1 then loadGame() else S = newSave() end
      player.x, player.y = S.x, S.y; setupNpcs(); scene = "world"; say("Bienvenue sur l'île du Cygne !")
      if not S.quest.rose and not hasSave then openDialog("Miraaï, ta maman", { "Myah ! Viens me voir à la maison rose, j'ai besoin de toi pour la fête du Cygne." }) end
    end
    return
  end
  if scene == "dialog" then
    if b == "a" or b == "b" then
      dlg.i = dlg.i + 1
      if dlg.i > #dlg.lines then local f = dlg.after; scene = dlg.back; dlg = nil; if f then f() end end
    end
    return
  end
  if scene == "ending" then if b == "a" or b == "start" then scene = "world" end; return end
  if scene == "fish" then
    local g = fishG
    if b == "a" then
      if g.pos >= g.zone and g.pos <= g.zone + g.w then
        local r = math.random()
        local k = r < 0.06 and "perle" or "fish"
        give(k); say(k == "fish" and ("Un poisson ! (" .. inv("fish") .. ")") or "Oh ! Une perle !"); scene = g.back; fishG = nil
      else
        g.tries = g.tries - 1
        if g.tries <= 0 then say("Le poisson s'est échappé…"); scene = g.back; fishG = nil else say("Raté ! Encore " .. g.tries .. " essai(s)", 1.2) end
      end
    elseif b == "b" then scene = g.back; fishG = nil end
    return
  end
  if scene == "memory" then
    local g = memG
    if b == "b" or b == "start" then scene = "menu"; return end
    if g.wait > 0 then return end
    local c, r = (g.sel - 1) % 4, math.floor((g.sel - 1) / 4)
    if b == "dpleft" then c = (c + 3) % 4 elseif b == "dpright" then c = (c + 1) % 4 elseif b == "dpup" then r = (r + 3) % 4 elseif b == "dpdown" then r = (r + 1) % 4 end
    g.sel = r * 4 + c + 1
    if b == "a" and not g.found[g.sel] and g.open[1] ~= g.sel then
      g.open[#g.open + 1] = g.sel
      if #g.open == 2 then
        g.moves = g.moves + 1
        if g.cards[g.open[1]] == g.cards[g.open[2]] then
          g.found[g.open[1]], g.found[g.open[2]] = true, true; g.open = {}; g.pairs = g.pairs + 1
          if g.pairs == 8 then say("Bravo ! Toutes les paires en " .. g.moves .. " coups !", 4); give("shell", 2) end
        else g.wait = 0.9 end
      end
    end
    return
  end
  if scene == "piano" then
    if b == "start" or (b == "back") then if pianoG.src then pianoG.src:stop() end; scene = "menu"; return end
    if pianoG.done then if b == "a" then scene = "menu" end; return end
    if LANE_KEY[b] then pianoHit(LANE_KEY[b]) end
    return
  end
  if scene == "fly" then
    if b == "b" then
      if walkable(flyG.x, flyG.y) then player.x, player.y = flyG.x, flyG.y; scene = "world"; cam.zoom = 2.0; flyG = nil; say("Atterrissage en douceur !")
      else say("Gaïkin ne peut pas se poser ici.") end
    end
    return
  end
  if scene == "bag" or scene == "help" then if b == "a" or b == "b" or b == "y" or b == "back" or b == "start" then scene = place and "inside" or "world" end; return end
  if scene == "menu" then
    local items = 5
    if b == "dpup" then menuSel = (menuSel - 2) % items + 1 elseif b == "dpdown" then menuSel = menuSel % items + 1 end
    if b == "b" or b == "start" then scene = place and "inside" or "world" end
    if b == "a" then
      if menuSel == 1 then scene = place and "inside" or "world"
      elseif menuSel == 2 then startMemory()
      elseif menuSel == 3 then scene = "songs"; menuSel = 1
      elseif menuSel == 4 then saveGame(); say("Partie sauvegardée !"); scene = place and "inside" or "world"
      elseif menuSel == 5 then saveGame(); love.event.quit() end
    end
    return
  end
  if scene == "songs" then
    if b == "dpup" then menuSel = (menuSel - 2) % 3 + 1 elseif b == "dpdown" then menuSel = menuSel % 3 + 1 end
    if b == "b" then scene = "menu"; menuSel = 3 end
    if b == "a" then startPiano(menuSel) end
    return
  end
  -- dehors ou dans une maison
  if b == "start" then scene = "menu"; menuSel = 1
  elseif b == "back" then scene = "help"
  elseif b == "y" then scene = "bag"
  elseif b == "a" then actionA()
  elseif b == "x" then tool = tool % #TOOLS + 1; say("Outil : " .. TOOLS[tool].n, 1.4)
  elseif b == "leftshoulder" then cam.zoom = math.max(1.2, cam.zoom - 0.25)
  elseif b == "rightshoulder" then cam.zoom = math.min(3.2, cam.zoom + 0.25) end
end
local function release(b)
  if scene == "piano" and pianoG and LANE_KEY[b] then pianoG.held[LANE_KEY[b]] = nil end
end
function love.gamepadpressed(j, b) press(b) end
function love.gamepadreleased(j, b) release(b) end
local KEYS = { ["return"] = "a", lshift = "b", y = "y", x = "x", escape = "start", tab = "back", q = "leftshoulder", e = "rightshoulder", up = "dpup", down = "dpdown", left = "dpleft", right = "dpright" }
function love.keypressed(k) if KEYS[k] then press(KEYS[k]) end end
function love.keyreleased(k) if KEYS[k] then release(KEYS[k]) end end
function love.joystickadded(j) pad = j end

-- ======================= démarrage =======================
function love.load()
  love.graphics.setDefaultFilter("linear", "linear")
  walkMask = love.filesystem.read("assets/walk.bin")
  seaMask = love.filesystem.read("assets/sea.bin") or string.rep("\0", GW * GH)
  names = love.filesystem.load("assets/walk_names.lua")()
  for i, n in ipairs(names) do frameIndex[n] = i - 1 end
  fonts.s = love.graphics.newFont(13); fonts.m = love.graphics.newFont(16); fonts.l = love.graphics.newFont(30)
  local js = love.joystick.getJoysticks(); pad = js[1]
  S = newSave(); hasSave = love.filesystem.getInfo("partie.lua") ~= nil
  setupWorld(); setupNpcs()
  img("assets/map.jpg"); img("assets/walk8.png")
end

-- ======================= mise à jour =======================
local autosave = 0
local function moveMyah(dt, canWalk, speed)
  local dx, dy = moveInput()
  local len = math.sqrt(dx * dx + dy * dy)
  player.moving = len > 0.1
  if not player.moving then return end
  dx, dy = dx / math.max(1, len), dy / math.max(1, len)
  local run = down("b", "lshift")
  local sp = speed * (run and 1.7 or 1) * dt
  local nx, ny = player.x + dx * sp, player.y + dy * sp
  if canWalk(nx, ny) then player.x, player.y = nx, ny
  elseif canWalk(nx, player.y) then player.x = nx
  elseif canWalk(player.x, ny) then player.y = ny end
  if math.abs(dx) > 0.35 and math.abs(dy) > 0.35 and dy > 0 then player.dir = dx > 0 and "dr" or "dl"
  elseif math.abs(dx) > math.abs(dy) then player.dir = dx > 0 and "right" or "left"
  else player.dir = dy > 0 and "down" or "up" end
  player.t = player.t + dt * (run and 1.7 or 1)
end

local function follow(dt, tx, ty, ww, wh, z)
  cam.lookX = cam.lookX + (axis("rightx") * 90 - cam.lookX) * math.min(1, dt * 6)
  cam.lookY = cam.lookY + (axis("righty") * 70 - cam.lookY) * math.min(1, dt * 6)
  local x = tx + cam.lookX / z - W / (2 * z)
  local y = ty - 20 + cam.lookY / z - H / (2 * z)
  if ww * z > W then x = math.max(0, math.min(ww - W / z, x)) else x = -(W / z - ww) / 2 end
  if wh * z > H then y = math.max(0, math.min(wh - H / z, y)) else y = -(H / z - wh) / 2 end
  cam.x = cam.x + (x - cam.x) * math.min(1, dt * 8); cam.y = cam.y + (y - cam.y) * math.min(1, dt * 8)
end

function love.update(dt)
  dt = math.min(dt, 0.05)
  if toastT > 0 then toastT = toastT - dt end
  if scene == "title" then return end
  -- le monde vit même quand on parle
  for _, t in ipairs(trees) do if t.fruits < 5 then t.regrow = t.regrow + dt; if t.regrow > 20 then t.regrow = 0; t.fruits = t.fruits + 1 end end end
  for _, f in ipairs(flowers) do if not f.on then f.regrow = f.regrow - dt; if f.regrow <= 0 then f.on = true end end end
  for _, b in ipairs(butterflies) do
    b.t = b.t + dt
    if not b.on then b.regrow = b.regrow - dt; if b.regrow <= 0 then b.on = true end end
    b.x = b.hx + math.sin(b.t * 0.9) * 26 + math.sin(b.t * 2.3) * 6; b.y = b.hy - 14 + math.cos(b.t * 1.3) * 12
  end
  for _, c in ipairs(crabs) do
    c.t = c.t + dt
    if not c.on then c.regrow = c.regrow - dt; if c.regrow <= 0 then c.on = true end end
    local nx = c.x + math.sin(c.t * 0.7) * 12 * dt
    if walkable(nx, c.y) then c.x = nx end
  end
  autosave = autosave + dt
  if autosave > 30 and (scene == "world" or scene == "inside") then autosave = 0; saveGame() end

  if scene == "world" then
    moveMyah(dt, walkable, 55)
    follow(dt, player.x, player.y, WORLD_W, WORLD_H, cam.zoom)
  elseif scene == "inside" then
    local P = place.floor
    moveMyah(dt, function(x, y) return insidePoly(P, x, y) end, 55 * place.K)
    local z = math.max(H / place.H, 0.62)
    cam.zoom = z
    follow(dt, player.x, player.y, place.W, place.H, z)
    if dist(player.x, player.y, place.sexit[1], place.sexit[2]) < 25 then
      player.x, player.y = place.exit[1], place.exit[2] + 4; place = nil; scene = "world"; cam.zoom = 2.0
    end
  elseif scene == "fish" then
    local g = fishG
    g.pos = g.pos + g.dir * dt * 0.9
    if g.pos > 1 then g.pos, g.dir = 1, -1 elseif g.pos < 0 then g.pos, g.dir = 0, 1 end
  elseif scene == "memory" then
    if memG.wait > 0 then memG.wait = memG.wait - dt; if memG.wait <= 0 then memG.open = {} end end
  elseif scene == "piano" then
    local g = pianoG
    if g.t < 0 then g.t = g.t + dt; if g.t >= 0 and g.src then g.src:play() end
    elseif g.src and g.src:isPlaying() then g.t = g.src:tell()
    else g.t = g.t + dt end
    for _, n in ipairs(g.notes) do
      if not n.hit and not n.miss and g.t - n.t > 0.25 then n.miss = true; g.combo = 0; g.fx[#g.fx + 1] = { l = n.l, a = 1, txt = "Raté" } end
      if n.hold and g.held[n.l] ~= n and g.t < n.t + n.d then n.hold = false end
      if n.hold and g.t >= n.t + n.d then n.hold = false; g.held[n.l] = nil; g.score = g.score + 50 end
      if n.hold then g.score = g.score + 1 end
    end
    for i = 1, 4 do g.flash[i] = math.max(0, g.flash[i] - dt) end
    for i = #g.fx, 1, -1 do g.fx[i].a = g.fx[i].a - dt * 1.4; if g.fx[i].a <= 0 then table.remove(g.fx, i) end end
    local last = g.notes[#g.notes]
    if not g.done and last and g.t > last.t + last.d + 2 then
      g.done = true; if g.src then g.src:stop() end
      local r = g.total > 0 and (g.score / (g.total * 100)) or 0
      g.stars = r > 0.85 and 3 or r > 0.6 and 2 or 1
      S.mini["piano_" .. g.song.f] = math.max(S.mini["piano_" .. g.song.f] or 0, g.stars)
      if g.stars == 3 and not S.mini["cadeau_" .. g.song.f] then S.mini["cadeau_" .. g.song.f] = true; give("flower", 3); give("shell", 2) end
      saveGame()
    end
  elseif scene == "fly" then
    local dx, dy = moveInput()
    flyG.t = flyG.t + dt
    flyG.x = math.max(10, math.min(WORLD_W - 10, flyG.x + dx * 110 * dt))
    flyG.y = math.max(20, math.min(WORLD_H - 10, flyG.y + dy * 110 * dt))
    if math.abs(dx) > 0.1 then flyG.face = dx > 0 and 1 or -1 end
    follow(dt, flyG.x, flyG.y, WORLD_W, WORLD_H, cam.zoom)
  end
end

-- ======================= dessin =======================
local function drawMyahAt(x, y, s)
  local im = img("assets/walk8.png"); if not im then return end
  local n = player.dir .. (player.moving and (math.floor(player.t * 10) % 8 + 1) or 1)
  local i = frameIndex[n] or frameIndex["down1"]
  local q = love.graphics.newQuad((i % 8) * 256, math.floor(i / 8) * 256, 256, 256, im:getDimensions())
  love.graphics.setColor(0, 0, 0, 0.2); love.graphics.ellipse("fill", x, y, 44 * s, 12 * s)
  love.graphics.setColor(1, 1, 1); love.graphics.draw(im, q, x - 128 * s, y - 212 * s, 0, s, s)
end
local function drawNpc(o, k)
  local n = o.d; local im = img(n.src); if not im then return end
  local s = n.sc * (k or 1)
  love.graphics.setColor(0, 0, 0, 0.2); love.graphics.ellipse("fill", o.x, o.y, n.mw * s * 0.22, 3 * (k or 1))
  love.graphics.setColor(1, 1, 1); love.graphics.draw(im, o.x - n.cx * s, o.y - n.feet * s, 0, s, s)
  if n.id and S.quest[n.id] ~= "done" and not (n.final and questsDone() < 4) then   -- une bulle au-dessus des habitants qui ont une mission
    local hy = o.y - (n.feet - n.head) * s - 6 * (k or 1)
    love.graphics.setColor(1, 0.97, 0.88); love.graphics.circle("fill", o.x, hy, 5 * (k or 1))
    love.graphics.setColor(S.quest[n.id] == "active" and hasNeed(n.need or {}) and { .2, .7, .3 } or { .85, .3, .3 })
    love.graphics.setFont(fonts.s); love.graphics.print(S.quest[n.id] and (hasNeed(n.need or {}) and "v" or "...") or "!", o.x - 3 * (k or 1), hy - 7 * (k or 1), 0, (k or 1) * 0.7)
  end
end
local function drawFlower(f)
  love.graphics.setColor(0.3, 0.6, 0.3); love.graphics.line(f.x, f.y, f.x, f.y - 5)
  local c = { { 1, .6, .75 }, { 1, .85, .3 }, { .75, .6, 1 }, { 1, 1, 1 } }
  love.graphics.setColor(c[f.c % 4 + 1]); for a = 0, 4 do love.graphics.circle("fill", f.x + math.cos(a * 1.26) * 2.2, f.y - 6 + math.sin(a * 1.26) * 2.2, 1.8) end
  love.graphics.setColor(1, .9, .3); love.graphics.circle("fill", f.x, f.y - 6, 1.2)
end
local function drawButterfly(b)
  local w = math.abs(math.sin(b.t * 12)) * 3 + 1
  love.graphics.setColor(b.c % 2 == 0 and { .5, .7, 1 } or { 1, .6, .4 })
  love.graphics.ellipse("fill", b.x - 2, b.y, w, 2.5); love.graphics.ellipse("fill", b.x + 2, b.y, w, 2.5)
  love.graphics.setColor(.2, .15, .2); love.graphics.rectangle("fill", b.x - .5, b.y - 2, 1, 4)
end
local function drawCrab(c)
  love.graphics.setColor(.9, .3, .2); love.graphics.ellipse("fill", c.x, c.y, 5, 3.4)
  love.graphics.circle("fill", c.x - 6, c.y - 2, 2); love.graphics.circle("fill", c.x + 6, c.y - 2, 2)
  love.graphics.setColor(0, 0, 0); love.graphics.circle("fill", c.x - 1.5, c.y - 2.5, .7); love.graphics.circle("fill", c.x + 1.5, c.y - 2.5, .7)
end

local function panel(x, y, w, h)
  love.graphics.setColor(1, 0.97, 0.9, 0.96); love.graphics.rectangle("fill", x, y, w, h, 14)
  love.graphics.setColor(0.6, 0.45, 0.75); love.graphics.setLineWidth(3); love.graphics.rectangle("line", x, y, w, h, 14); love.graphics.setLineWidth(1)
end
local PURPLE = { 0.29, 0.16, 0.48 }

local function drawWorld()
  love.graphics.push(); love.graphics.scale(cam.zoom); love.graphics.translate(-cam.x, -cam.y)
  local map = img("assets/map.jpg")
  love.graphics.setColor(1, 1, 1); if map then love.graphics.draw(map, 0, 0, 0, WORLD_W / map:getWidth(), WORLD_H / map:getHeight()) end
  for _, f in ipairs(flowers) do if f.on then drawFlower(f) end end
  for _, c in ipairs(crabs) do if c.on then drawCrab(c) end end
  for _, t in ipairs(trees) do   -- les fruits qui restent sur l'arbre
    for i = 1, t.fruits do love.graphics.setColor(ITEM_COL[t.kind] or { 1, 1, 1 }); love.graphics.circle("fill", t.x - 8 + i * 3, t.y - 30 + (i % 2) * 3, 1.8) end
  end
  -- Gaïkin sur son perchoir
  local gk = img("assets/gaikin_perch.png")
  if gk and scene ~= "fly" then love.graphics.setColor(1, 1, 1); love.graphics.draw(gk, DATA.perch[1] - 22, DATA.perch[2] - 40, 0, 44 / gk:getWidth(), 44 / gk:getWidth()) end
  -- habitants et Myah, du fond vers l'avant
  local list = {}
  for _, o in ipairs(npcs) do if not o.house then list[#list + 1] = { y = o.y, f = function() drawNpc(o) end } end end
  if scene ~= "fly" then list[#list + 1] = { y = player.y, f = function() drawMyahAt(player.x, player.y, MS) end } end
  table.sort(list, function(a, b) return a.y < b.y end)
  for _, it in ipairs(list) do it.f() end
  for _, b in ipairs(butterflies) do if b.on then drawButterfly(b) end end
  if scene == "fly" then
    local gf = img("assets/gaikin_fly.png")
    if gf then
      local s, bob = 70 / gf:getWidth(), math.sin(flyG.t * 4) * 3
      love.graphics.setColor(0, 0, 0, 0.15); love.graphics.ellipse("fill", flyG.x, flyG.y + 14, 22, 5)
      love.graphics.setColor(1, 1, 1); love.graphics.draw(gf, flyG.x, flyG.y - 30 + bob, 0, s * (flyG.face or -1), s, gf:getWidth() / 2, gf:getHeight() / 2)
    end
  end
  love.graphics.pop()
end

local function drawInside()
  local bg = img(place.img)
  love.graphics.clear(0, 0, 0)
  love.graphics.push(); love.graphics.scale(cam.zoom); love.graphics.translate(-cam.x, -cam.y)
  love.graphics.setColor(1, 1, 1); if bg then love.graphics.draw(bg, 0, 0, 0, place.W / bg:getWidth(), place.H / bg:getHeight()) end
  local list = {}
  for _, o in ipairs(npcs) do if o.house == place.id then list[#list + 1] = { y = o.y, f = function() drawNpc(o, place.K) end } end end
  list[#list + 1] = { y = player.y, f = function() drawMyahAt(player.x, player.y, MS * place.K * 0.75) end }
  table.sort(list, function(a, b) return a.y < b.y end)
  for _, it in ipairs(list) do it.f() end
  -- la sortie
  love.graphics.setColor(1, 0.95, 0.6, 0.35 + 0.2 * math.sin(love.timer.getTime() * 3)); love.graphics.circle("fill", place.sexit[1], place.sexit[2] - 10, 22)
  love.graphics.pop()
end

local function drawHud()
  love.graphics.setFont(fonts.s)
  panel(W - 120, H - 36, 112, 28); love.graphics.setColor(PURPLE); love.graphics.printf(TOOLS[tool].n .. "  (X)", W - 120, H - 29, 112, "center")
  panel(8, 8, 96, 26); love.graphics.setColor(PURPLE); love.graphics.print("Plumes " .. S.plumes .. "/5", 18, 14)
  if toastT > 0 and toast then
    love.graphics.setFont(fonts.m); panel(70, 44, W - 140, 34); love.graphics.setColor(PURPLE); love.graphics.printf(toast, 76, 52, W - 152, "center")
  end
end

local function drawDialog()
  local d = dlg
  panel(16, H - 140, W - 32, 128)
  love.graphics.setColor(0.78, 0.27, 0.48); love.graphics.setFont(fonts.m); love.graphics.print(d.who or "", 32, H - 132)
  love.graphics.setColor(PURPLE); love.graphics.printf(d.lines[d.i] or "", 32, H - 108, W - 64)
  love.graphics.setFont(fonts.s); love.graphics.setColor(0.5, 0.4, 0.6); love.graphics.printf("A  suite", 16, H - 30, W - 50, "right")
end

local function drawBag()
  panel(60, 40, W - 120, H - 80)
  love.graphics.setFont(fonts.l); love.graphics.setColor(PURPLE); love.graphics.printf("Mon sac", 60, 52, W - 120, "center")
  love.graphics.setFont(fonts.m)
  local y, x = 104, 90
  for _, k in ipairs({ "coconut", "banana", "mango", "flower", "butterfly", "fish", "crab", "shell", "perle" }) do
    love.graphics.setColor(ITEM_COL[k]); love.graphics.circle("fill", x + 8, y + 9, 8)
    love.graphics.setColor(PURPLE); love.graphics.print(ITEM[k] .. " : " .. inv(k), x + 24, y)
    y = y + 26; if y > 300 then y, x = 104, 340 end
  end
  love.graphics.setColor(0.78, 0.27, 0.48); love.graphics.print("Plumes de Gaïkin : " .. S.plumes .. " / 5", 90, 340)
  love.graphics.setFont(fonts.s); love.graphics.setColor(PURPLE)
  local my = 368
  for _, n in ipairs(DATA.npcs) do
    if n.id and S.quest[n.id] == "active" then love.graphics.print("- " .. (n.title or ""), 90, my); my = my + 18 end
  end
  love.graphics.setColor(0.5, 0.4, 0.6); love.graphics.printf("Y ou B pour fermer", 60, H - 62, W - 120, "center")
end

local function drawMenu(title, items)
  panel(170, 90, 300, 60 + #items * 40)
  love.graphics.setFont(fonts.l); love.graphics.setColor(PURPLE); love.graphics.printf(title, 170, 100, 300, "center")
  love.graphics.setFont(fonts.m)
  for i, it in ipairs(items) do
    local y = 150 + (i - 1) * 40
    if i == menuSel then love.graphics.setColor(0.91, 0.86, 0.98); love.graphics.rectangle("fill", 195, y - 6, 250, 32, 16) end
    love.graphics.setColor(PURPLE); love.graphics.printf(it, 170, y, 300, "center")
  end
end

local function drawHelp()
  panel(110, 70, 420, 340)
  love.graphics.setFont(fonts.m); love.graphics.setColor(PURPLE); love.graphics.printf("Les touches", 110, 84, 420, "center")
  local rows = { { { .88, .3, .3 }, "A", "Parler, prendre, entrer" }, { { .95, .8, .25 }, "B", "Courir (garder appuyé), retour" }, { { .35, .75, .4 }, "Y", "Sac à dos" }, { { .35, .55, .9 }, "X", "Changer d'outil" } }
  for i, r in ipairs(rows) do
    local y = 124 + (i - 1) * 34
    love.graphics.setColor(r[1]); love.graphics.circle("fill", 150, y + 9, 12)
    love.graphics.setColor(1, 1, 1); love.graphics.printf(r[2], 138, y, 24, "center")
    love.graphics.setColor(PURPLE); love.graphics.print(r[3], 175, y)
  end
  love.graphics.setFont(fonts.s)
  love.graphics.print("START : menu (mini-jeux, sauvegarde)    SELECT : cette aide", 140, 270)
  love.graphics.print("L1 / R1 : zoom      Joystick droit : regarder autour", 140, 292)
  love.graphics.print("Panier : fruits, fleurs, crabes   Filet : papillons", 140, 320)
  love.graphics.print("Canne : au bord de l'eau   Voler : avec une plume de Gaïkin", 140, 342)
end

local function drawFish()
  panel(100, 150, 440, 180)
  love.graphics.setFont(fonts.m); love.graphics.setColor(PURPLE); love.graphics.printf("Ça mord ! Appuie sur A quand le poisson est dans la zone verte", 110, 162, 420, "center")
  local g, bx, bw = fishG, 130, 380
  love.graphics.setColor(0.75, 0.88, 0.97); love.graphics.rectangle("fill", bx, 240, bw, 30, 15)
  love.graphics.setColor(0.45, 0.8, 0.5); love.graphics.rectangle("fill", bx + g.zone * bw, 240, g.w * bw, 30, 8)
  love.graphics.setColor(0.2, 0.4, 0.7); love.graphics.ellipse("fill", bx + g.pos * bw, 255, 12, 7)
  love.graphics.setFont(fonts.s); love.graphics.setColor(PURPLE); love.graphics.printf("Essais : " .. g.tries .. "    B : arrêter", 100, 290, 440, "center")
end

local function drawMemory()
  love.graphics.clear(0.86, 0.82, 0.95)
  local g = memG
  love.graphics.setFont(fonts.m); love.graphics.setColor(PURPLE); love.graphics.printf("Memory de l'île   (paires : " .. g.pairs .. "/8)", 0, 12, W, "center")
  for i = 1, 16 do
    local c, r = (i - 1) % 4, math.floor((i - 1) / 4)
    local x, y = 160 + c * 82, 44 + r * 106
    local shown = g.found[i] or g.open[1] == i or g.open[2] == i
    love.graphics.setColor(shown and { 1, 0.98, 0.92 } or { 0.62, 0.48, 0.78 }); love.graphics.rectangle("fill", x, y, 72, 96, 10)
    if i == g.sel then love.graphics.setColor(0.25, 0.7, 0.3); love.graphics.setLineWidth(4); love.graphics.rectangle("line", x - 2, y - 2, 76, 100, 11); love.graphics.setLineWidth(1) end
    if shown then
      local im = img(MEM_IMG[g.cards[i]])
      if im then local s = math.min(60 / im:getWidth(), 80 / im:getHeight()); love.graphics.setColor(1, 1, 1); love.graphics.draw(im, x + 36 - im:getWidth() * s / 2, y + 48 - im:getHeight() * s / 2, 0, s, s) end
    else love.graphics.setColor(1, 1, 1, 0.5); love.graphics.printf("?", x, y + 36, 72, "center") end
  end
  love.graphics.setFont(fonts.s); love.graphics.setColor(PURPLE); love.graphics.printf("Flèches : choisir   A : retourner   B : quitter", 0, H - 22, W, "center")
end

local function drawPiano()
  local g = pianoG
  local bg = img("assets/piano/bg.jpg")
  love.graphics.setColor(1, 1, 1)
  if bg then love.graphics.draw(bg, 0, 0, 0, W / bg:getWidth(), H / bg:getHeight()) else love.graphics.clear(0.8, 0.78, 0.95) end
  local LX = { 220, 293, 366, 439 }   -- les 4 couloirs, au centre de l'écran
  local HY, SP = 380, 260
  for i = 1, 4 do love.graphics.setColor(1, 1, 1, 0.22); love.graphics.rectangle("fill", LX[i] - 30, 0, 60, HY) end
  local lia = img("assets/piano/ligne.png"); love.graphics.setColor(1, 1, 1)
  if lia then love.graphics.draw(lia, 180, HY - 8, 0, 300 / lia:getWidth(), 16 / lia:getHeight()) end
  for _, n in ipairs(g.notes) do
    local y = HY - (n.t - g.t) * SP
    if n.d > 0 and not n.miss then
      local yE = HY - (n.t + n.d - g.t) * SP
      if g.t <= n.t + n.d then
        local yh = math.min(y, HY)
        love.graphics.setColor(LANE_COL[n.l][1], LANE_COL[n.l][2], LANE_COL[n.l][3], n.hold and 1 or 0.8)
        love.graphics.rectangle("fill", LX[n.l] - 9, yE, 18, yh - yE, 8)
        if not n.hit or n.hold then local leaf = img("assets/piano/n" .. (n.l - 1) .. ".png"); if leaf then love.graphics.setColor(1, 1, 1); love.graphics.draw(leaf, LX[n.l] - 22, yh - 24, 0, 44 / leaf:getWidth(), 48 / leaf:getHeight()) end end
      end
    elseif not n.hit and not n.miss and y > -40 and y < HY + 30 then
      local leaf = img("assets/piano/n" .. (n.l - 1) .. ".png")
      love.graphics.setColor(1, 1, 1); if leaf then love.graphics.draw(leaf, LX[n.l] - 22, y - 24, 0, 44 / leaf:getWidth(), 48 / leaf:getHeight()) end
    end
  end
  local pi = img("assets/piano/piano.png")
  love.graphics.setColor(1, 1, 1); if pi then love.graphics.draw(pi, 170, H - 104, 0, 300 / pi:getWidth(), 100 / pi:getHeight()) end
  local BL = { "A", "B", "Y", "X" }
  for i = 1, 4 do
    if g.flash[i] > 0 or g.held[i] then love.graphics.setColor(1, 1, 1, 0.55); love.graphics.rectangle("fill", LX[i] - 30, H - 84, 60, 60, 12) end
    love.graphics.setColor(PURPLE); love.graphics.setFont(fonts.m); love.graphics.printf(BL[i], LX[i] - 20, H - 26, 40, "center")
  end
  love.graphics.setFont(fonts.m)
  for _, e in ipairs(g.fx) do love.graphics.setColor(0.8, 0.55, 0.1, e.a); love.graphics.printf(e.txt, LX[e.l] - 50, HY - 50 - (1 - e.a) * 30, 100, "center") end
  love.graphics.setColor(PURPLE); love.graphics.printf(g.song.n .. "    Score " .. g.score .. "   combo " .. g.combo, 0, 10, W, "center")
  local ko = img("assets/piano/ko_danse.png")
  if ko then love.graphics.setColor(1, 1, 1); love.graphics.draw(ko, 520, 60 + math.sin(love.timer.getTime() * 5) * 4, 0, 100 / ko:getHeight(), 100 / ko:getHeight()) end
  if g.t < 0 then love.graphics.setFont(fonts.l); love.graphics.printf("Prête ?", 0, 200, W, "center") end
  if g.done then
    panel(170, 150, 300, 170); love.graphics.setFont(fonts.l); love.graphics.setColor(PURPLE); love.graphics.printf("Bravo !", 170, 166, 300, "center")
    local on, off = img("assets/piano/st_on.png"), img("assets/piano/st_off.png")
    for i = 1, 3 do local s = i <= g.stars and on or off; if s then love.graphics.setColor(1, 1, 1); love.graphics.draw(s, 215 + (i - 1) * 75, 210, 0, 56 / s:getWidth(), 56 / s:getWidth()) end end
    love.graphics.setFont(fonts.s); love.graphics.printf("Score " .. g.score .. "     A : continuer", 170, 290, 300, "center")
  end
end

function love.draw()
  love.graphics.setFont(fonts.m)
  if scene == "title" then
    local bg = img("assets/load/bg.jpg")
    love.graphics.setColor(1, 1, 1); if bg then love.graphics.draw(bg, 0, 0, 0, W / bg:getWidth(), H / bg:getHeight()) else love.graphics.clear(0.75, 0.7, 0.92) end
    local sw = img("assets/load/sw" .. ({ 0, 1, 2, 1 })[math.floor(love.timer.getTime() * 6) % 4 + 1] .. ".png")
    if sw then love.graphics.draw(sw, W / 2 - 80, 70 + math.sin(love.timer.getTime()) * 8, 0, 160 / sw:getWidth(), 160 / sw:getWidth()) end
    love.graphics.setFont(fonts.l); love.graphics.setColor(PURPLE); love.graphics.printf("Swaalia", 0, 210, W, "center")
    love.graphics.setFont(fonts.m); love.graphics.printf("L'Île du Cygne", 0, 248, W, "center")
    local items = hasSave and { "Continuer la partie", "Nouvelle partie" } or { "Nouvelle partie" }
    for i, t in ipairs(items) do
      if i == titleSel then love.graphics.setColor(1, 0.97, 0.9, 0.9); love.graphics.rectangle("fill", W / 2 - 120, 296 + (i - 1) * 40, 240, 32, 16) end
      love.graphics.setColor(PURPLE); love.graphics.printf(t, 0, 302 + (i - 1) * 40, W, "center")
    end
    return
  end
  if scene == "memory" then drawMemory(); return end
  if scene == "piano" then drawPiano(); return end
  if place then drawInside() else drawWorld() end
  drawHud()
  if scene == "dialog" then drawDialog()
  elseif scene == "bag" then drawBag()
  elseif scene == "help" then drawHelp()
  elseif scene == "fish" then drawFish()
  elseif scene == "menu" then drawMenu("Menu", { "Reprendre", "Memory", "Piano des koalas", "Sauvegarder", "Sauvegarder et quitter" })
  elseif scene == "songs" then drawMenu("Quel morceau ?", { "Berceuse (facile)", "Danse des koalas", "Fête des lucioles" })
  elseif scene == "ending" then
    panel(80, 120, W - 160, 220); love.graphics.setFont(fonts.l); love.graphics.setColor(PURPLE); love.graphics.printf("Les 5 plumes !", 80, 140, W - 160, "center")
    love.graphics.setFont(fonts.m); love.graphics.printf("Gaïkin revient sur l'île du Cygne. L'eau du lac redevient claire, les papillons dansent et toute l'île fait la fête. Merci, Myah !", 100, 190, W - 200, "center")
    love.graphics.setFont(fonts.s); love.graphics.printf("A pour continuer à te promener", 80, 310, W - 160, "center")
  end
end
_G.__T = function() return { scene = scene, place = place, player = player, S = S } end   -- pour les tests
