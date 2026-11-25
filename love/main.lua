-- Swaalia - L'Île du Cygne : version LÖVE2D pour la console R36S (écran 640x480)
--
-- Touches de la R36S :
--   A (rouge) = parler / agir / valider      B (jaune) = courir (garder appuyé) / retour
--   Y (vert)  = sac à dos                    X (bleu)  = libre
--   L1 / R1   = outil précédent / suivant    START = menu    SELECT = aide des touches
--   flèches et joystick gauche = marcher     joystick droit = regarder autour
-- Au clavier (PC) : flèches, Espace=A, Maj=B, Y, X, Entrée=START, Tab=SELECT, Q/E=L1/R1

local DATA = require("data")
local D2 = require("data2")
local CHAT = require("chat")
local W, H = 640, 480
local WORLD_W, WORLD_H, CELL, GW, GH = 917, 512, 4, 229, 128
local MS = 0.26                      -- taille de Myah dans le monde

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
local tones = {}
local function tone(i)   -- petites notes pour les mini-jeux
  if not tones[i] then
    local ok, sd = pcall(love.sound.newSoundData, 9000, 22050, 16, 1)
    if not ok then return end
    local f = ({ 523, 659, 784, 988, 392, 330 })[i] or 440
    for n = 0, 8999 do local t = n / 22050; sd:setSample(n, math.sin(t * f * 2 * math.pi) * 0.35 * math.exp(-t * 6)) end
    tones[i] = love.audio.newSource(sd, "static")
  end
  tones[i]:stop(); tones[i]:play()
end

-- ======================= état du jeu =======================
local S
local function newSave()
  return { x = 0, y = 0, house = "home", inv = {}, quest = {}, opened = {}, plumes = 0, talk = {}, mini = {} }
end
local scene = "title"
local place = nil                    -- la maison où l'on est (nil = dehors)
local player = { x = 0, y = 0, dir = "down", moving = false, t = 0 }
local cam = { x = 0, y = 0, zoom = 2.0, lookX = 0, lookY = 0 }
local toast, toastT = nil, 0
local TOOLS = { { k = "hand", n = "Main libre" }, { k = "basket", n = "Panier" }, { k = "net", n = "Filet" }, { k = "rod", n = "Canne" } }
local tool = 1
local pad
local dlg = nil
local menuSel, titleSel = 1, 1
local ITEM = { coconut = "Noix de coco", banana = "Bananes", mango = "Mangues", flower = "Fleurs", butterfly = "Papillons", fish = "Poissons", crab = "Crabes", shell = "Coquillages", perle = "Perles" }
local ICON = { coconut = "extra/trees/coconut_bunch.png", banana = "extra/trees/banana_bunch.png", mango = "extra/trees/mango_bunch.png", flower = "assets/spr/flower0.png", butterfly = "assets/spr/bfly0.png", fish = "assets/spr/fishA0.png", crab = "assets/spr/an_crabe.png", shell = "assets/spr/shell0.png", perle = "assets/spr/perle.png" }
local PURPLE = { 0.29, 0.16, 0.48 }

local function say(t, d) toast, toastT = t, d or 2.6 end
local function dist(a, b, c, d) return math.sqrt((a - c) ^ 2 + (b - d) ^ 2) end
local function inv(k) return S.inv[k] or 0 end
local function give(k, n) S.inv[k] = inv(k) + (n or 1) end
local function houseById(id) for _, h in ipairs(DATA.houses) do if h.id == id then return h end end end

-- ======================= fondu entre deux lieux =======================
local fade = { a = 0, dir = 0, fn = nil }
local function goTo(fn) if fade.dir == 0 then fade.dir, fade.fn = 1, fn end end

-- ======================= sauvegarde (4 emplacements) =======================
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
local slot = 1
local function saveGame()
  S.x, S.y = player.x, player.y; S.house = place and place.id or nil; S.up = place and place.up or nil
  love.filesystem.write("partie" .. slot .. ".lua", "return " .. ser(S))
end
local function readSlot(i)
  local f = "partie" .. i .. ".lua"
  if not love.filesystem.getInfo(f) then return nil end
  local ok, fn = pcall(love.filesystem.load, f)
  if not ok or not fn then return nil end
  local ok2, t = pcall(fn)
  if ok2 and type(t) == "table" then return t end
  return nil
end
local slots = {}
local function refreshSlots() for i = 1, 4 do slots[i] = readSlot(i) end end
local nameG
local KB = { "ABCDEFGHIJ", "KLMNOPQRST", "UVWXYZ-'  ", "éèêàçëïô  " }
local function utf8chars(s) local t = {}; for ch in s:gmatch("[^\128-\191][\128-\191]*") do t[#t + 1] = ch end; return t end

-- ======================= géométrie =======================
local function cellOf(mask, x, y)
  local cx, cy = math.floor(x / CELL), math.floor(y / CELL)
  if cx < 0 or cy < 0 or cx >= GW or cy >= GH then return 0 end
  return mask:byte(cy * GW + cx + 1)
end
local function isWater(x, y) return cellOf(seaMask, x, y) == 1 end
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

-- ======================= le monde =======================
local trees, flowers, butterflies, crabs, shells, animals, fishes = {}, {}, {}, {}, {}, {}, {}
local TREE_K = { coconut = 0.2, mango = 0.2, banana = 0.27 }
local npcs = {}
local function blockedByNpc(x, y, k)   -- Myah ne traverse pas les habitants
  for _, o in ipairs(npcs) do
    if o.house == (place and place.id or nil) and dist(o.x, o.y, x, y) < 8 * (k or 1) and dist(o.x, o.y, player.x, player.y) >= 8 * (k or 1) - 0.5 then return true end
  end
  return false
end
local function walkable(x, y) return cellOf(walkMask, x, y) == 1 end
local function setupWorld()
  trees = {}
  for _, t in ipairs(DATA.trees) do trees[#trees + 1] = { x = t.x, y = t.y, kind = t.kind, fruits = 5, regrow = 0 } end
  flowers = {}
  for i, f in ipairs(D2.flowers) do flowers[#flowers + 1] = { x = f[1], y = f[2], c = (i * 3) % 10, regrow = 0, on = true } end
  butterflies = {}
  for i = 1, 5 do
    local f = D2.flowers[(i * 2) % #D2.flowers + 1]
    butterflies[i] = { x = f[1], y = f[2] - 12, hx = f[1], hy = f[2], t = i * 1.3, on = true, regrow = 0, sp = (i - 1) % 5 }
  end
  animals = {}
  for _, a in ipairs(D2.animals) do animals[#animals + 1] = { id = a[1], x = a[2], y = a[3], hx = a[2], hy = a[3], h = a[4], t = math.random() * 5, face = 1, on = true, regrow = 0 } end
  crabs = {}
  for i, p in ipairs({ { 330, 440 }, { 520, 452 }, { 610, 448 } }) do if walkable(p[1], p[2]) then crabs[#crabs + 1] = { x = p[1], y = p[2], t = i * 1.7, on = true, regrow = 0 } end end
  shells = {}
  for i = 0, 8 do
    local x, y = 140 + i * 80, 432 + (i % 3) * 8
    for k = 0, 30, 2 do if walkable(x, y - k) then y = y - k; break end end
    if walkable(x, y) then shells[#shells + 1] = { x = x, y = y, k = i % 5, on = true, regrow = 0 } end
  end
  fishes = {}   -- les poissons au bord de la plage, comme dans le jeu en ligne
  local kinds = { "fishA0", "fishA2", "fishB0", "fishB2", "fishA3", "fish4", "fishB3" }
  for i, p in ipairs(D2.seaFish) do fishes[#fishes + 1] = { x = p[1], y = p[2], hx = p[1], hy = p[2], k = kinds[(i - 1) % #kinds + 1], t = i * 2.1, face = 1 } end
end

-- ======================= habitants =======================
local HOME_POS = { maman = { "home", 360, 568 }, kito = { "home", 520, 585 }, juliana = { "museum", 185, 750 }, soigneuse = { "care", 330, 800 }, maima = { "hall", 625, 690 }, lila = { "ukai", 420, 575 } }
local function setupNpcs()
  npcs = {}
  for _, n in ipairs(DATA.npcs) do
    local o = { d = n, x = n.x, y = n.y, house = nil }
    local hp = HOME_POS[n.k]
    if hp then o.house, o.x, o.y = hp[1], hp[2], hp[3] end
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
local function wantsBubble(n)
  if not n.id or S.quest[n.id] == "done" then return false end
  if n.final and questsDone() < 4 then return false end
  return true
end

-- ======================= dialogues =======================
local function openDialog(who, lines, after, choices, onChoice)
  if not lines or #lines == 0 then return end
  dlg = { who = who, lines = lines, i = 1, after = after, back = (scene == "dialog" and dlg and dlg.back) or scene, choices = choices, onChoice = onChoice, sel = 1 }
  scene = "dialog"
end
local function closeDialog()
  local d = dlg; scene = d.back; dlg = nil
  if d.choices then if d.onChoice then d.onChoice(d.sel) end elseif d.after then d.after() end
end

-- ======================= coffres =======================
local CHESTS = {
  rose = { house = nil, x = 142, y = 222, img = "c0" }, soleil = { house = nil, x = 294, y = 250, img = "c0" },
  bleu = { house = "museum", up = true, x = 405, y = 372, img = "c0" }, plume = { house = "obs", x = 560, y = 740, img = "h1" },
  toto = { house = "boat", x = 600, y = 600, img = "h0" },
}
local function chestReady(id) return S.quest[id] == "done" and not S.opened[id] end
local endingShown = false
local function openChest(id)
  S.opened[id] = true; S.plumes = S.plumes + 1; saveGame()
  player.act = { kind = "chest", t = 0, dur = 0.8, hitAt = 9 }
  openDialog("Le coffre", { "Une plume de Gaïkin ! (" .. S.plumes .. "/5)" }, function() if S.plumes >= 5 and not endingShown then endingShown = true; scene = "ending" end end)
end

-- ======================= mini-jeux (déclarés plus bas) =======================
local startMemory, startPiano, startRythme, startFight
local GAME_OF = { lila = "memory", romi = "memory", kykah = "rythme", maima = "piano", poggi = "rythme" }
local GAME_NAME = { memory = "un Memory", rythme = "aux coquillages chantants", piano = "au Piano des koalas" }
local function offerGame(o)
  local g = GAME_OF[o.d.k]; if not g then return end
  openDialog(o.d.who, { "Tu veux jouer " .. (g == "memory" and "à " or "") .. GAME_NAME[g] .. " avec moi ?" }, nil, { "Oui !", "Pas maintenant" }, function(i)
    if i == 1 then if g == "memory" then startMemory() elseif g == "rythme" then startRythme() else scene = "songs"; menuSel = 1 end end
  end)
end
local function chatterOf(k)
  local src = (S.plumes >= 5 and CHAT.CHAT_END[k]) or CHAT.CHAT[k]
  if not src or #src == 0 then return { "Belle journée sur l'île, n'est-ce pas ?" } end
  S.talk[k] = ((S.talk[k] or 0) % #src) + 1
  return src[S.talk[k]]
end

local function talkTo(o)
  local n = o.d
  player.dir = (math.abs(o.x - player.x) > math.abs(o.y - player.y)) and (o.x > player.x and "right" or "left") or (o.y > player.y and "down" or "up")
  if n.id then
    local st = S.quest[n.id]
    if st == "done" then
      if not S.opened[n.id] then openDialog(n.who, { "Ta plume t'attend dans le coffre, Myah ! Cherche ce qui scintille." }); return end
      openDialog(n.who, chatterOf(n.k), function() offerGame(o) end); return
    end
    if n.final and questsDone() < 4 then openDialog(n.who, n.locked or { "Reviens plus tard !" }); return end
    if not st then
      S.quest[n.id] = "active"
      openDialog(n.who, n.start, function() say("Nouvelle mission : " .. (n.title or "")) end)
    elseif hasNeed(n.need or {}) then
      for k, c in pairs(n.need or {}) do S.inv[k] = inv(k) - c end
      S.quest[n.id] = "done"
      openDialog(n.who, n.done, function() saveGame(); say("Va chercher la plume dans le coffre !", 4) end)
    else
      local l = {}
      for _, x in ipairs(n.remind or {}) do l[#l + 1] = x end
      l[#l + 1] = "Il me faut : " .. needText(n.need or {})
      openDialog(n.who, l)
    end
  else
    local lines
    if CHAT.CHAT[n.k] then lines = chatterOf(n.k)
    elseif n.lines then S.talk[n.k] = ((S.talk[n.k] or 0) % #n.lines) + 1; lines = { n.lines[S.talk[n.k]] }
    else lines = { "Bonjour Myah !" } end
    openDialog(n.who, lines, function() offerGame(o) end)
  end
end

-- ======================= entrées =======================
local function axis(name)
  if not pad or not pad:isGamepad() then return 0 end
  local v = pad:getGamepadAxis(name); if math.abs(v) < 0.2 then return 0 end; return v
end
local padUsed = false
local function down(btn, key)
  if pad and pad:isGamepad() and pad:isGamepadDown(btn) then return true end
  if padUsed then return false end
  return key and love.keyboard.isDown(key) or false
end
local function moveInput()
  local dx, dy = axis("leftx"), axis("lefty")
  if down("dpleft", "left") then dx = -1 end; if down("dpright", "right") then dx = 1 end
  if down("dpup", "up") then dy = -1 end; if down("dpdown", "down") then dy = 1 end
  return dx, dy
end
local function holdA() return down("a", "space") end

-- ======================= pêche et crabe (comme en ligne : on tient A quand il se fatigue, on lâche quand il tire) =======================
local fishG
local FISH_KINDS = { "fishA0", "fishA2", "fishA3", "fishB0", "fishB2", "fishB3", "fish4", "fish5" }
local function nearWater(x, y)
  local best, bd = nil, 46
  for dy = -40, 40, 4 do for dx = -40, 40, 4 do
    if isWater(x + dx, y + dy) then local d = dist(0, 0, dx, dy); if d < bd then bd, best = d, { x + dx, y + dy } end end
  end end
  return best
end
local function startFishing(w)
  fishG = { kind = "fish", phase = "cast", t = 0, bx = w[1], by = w[2], k = FISH_KINDS[math.random(#FISH_KINDS)], wait = 1.5 + math.random() * 2.5 }
  player.dir = (math.abs(w[1] - player.x) > math.abs(w[2] - player.y)) and (w[1] > player.x and "right" or "left") or (w[2] > player.y and "down" or "up")
end
startFight = function(kind, target)
  fishG = fishG or { kind = kind }
  fishG.kind = kind; fishG.target = target; fishG.phase = "fight"
  fishG.F = { T = 0.1, mode = "rest", mt = 1.4, prog = 0.25 }
  scene = "fight"
end
local function endFishing() fishG = nil; if scene == "fight" then scene = place and "inside" or "world" end end

-- ======================= Memory (les images du jeu en ligne) =======================
local memG
local MEM_IMG = { "ananas", "cabane", "coco", "collier", "hamac", "livres", "monstera", "tortue", "toucan" }
startMemory = function()
  local pick = {}
  for i = 1, 9 do pick[i] = i end
  for i = 9, 2, -1 do local j = math.random(i); pick[i], pick[j] = pick[j], pick[i] end
  local cards = {}
  for i = 1, 8 do cards[#cards + 1] = pick[i]; cards[#cards + 1] = pick[i] end
  for i = #cards, 2, -1 do local j = math.random(i); cards[i], cards[j] = cards[j], cards[i] end
  memG = { cards = cards, open = {}, found = {}, sel = 1, wait = 0, pairs = 0, moves = 0 }
  scene = "memory"
end

-- ======================= les coquillages chantants (Kykah joue, tu répètes) =======================
local rytG
local RYT_COL = { { .96, .55, .55 }, { .97, .84, .4 }, { .5, .82, .55 }, { .5, .68, .95 } }
local RYT_KEY = { a = 1, b = 2, y = 3, x = 4 }
startRythme = function()
  rytG = { seq = { math.random(4) }, i = 0, mode = "show", t = -0.8, lit = 0, litT = 0 }
  scene = "rythme"
end

-- ======================= Piano des koalas =======================
local pianoG
local SONGS = { { f = "berceuse", n = "Berceuse de l'eucalyptus" }, { f = "danse", n = "La danse des koalas" }, { f = "lucioles", n = "Fête sous les lucioles" } }
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
startPiano = function(i)
  local s = SONGS[i]
  local ok, src = pcall(love.audio.newSource, "assets/music/" .. s.f .. ".mp3", "stream")
  pianoG = { song = s, notes = loadChart(s.f), src = ok and src or nil, t = -2, score = 0, combo = 0, fx = {}, flash = { 0, 0, 0, 0 }, held = {}, done = false }
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
    if best.d > 0 then best.hold = true; g.held[lane] = best end
    g.fx[#g.fx + 1] = { l = lane, a = 1, txt = p and "Parfait !" or "Bien !" }
  end
end

-- ======================= entrer / sortir des maisons =======================
local doorLock = nil
local function snapInside(h, x, y)
  for k = 0, 400, 5 do if insidePoly(h.floor, x, y - k) then return x, y - k end end
  return x, y
end
local function enterHouse(h)
  goTo(function()
    place = h; place.up = false
    player.x, player.y = snapInside(h, h.sexit[1], h.sexit[2] - 50); player.dir = "up"
    scene = "inside"
    local z = math.max(H / h.H, 0.62); cam.zoom = z
    cam.x, cam.y = math.max(0, math.min(h.W - W / z, player.x - W / (2 * z))), math.max(0, math.min(h.H - H / z, player.y - 20 - H / (2 * z)))
  end)
end
local function leaveHouse()
  local h = place
  goTo(function()
    doorLock = h.id; player.x, player.y = h.exit[1], h.exit[2] + 4; player.dir = "down"
    place.up = nil; place = nil; scene = "world"; cam.zoom = 2.0
    cam.x, cam.y = math.max(0, math.min(WORLD_W - W / 2, player.x - W / 4)), math.max(0, math.min(WORLD_H - H / 2, player.y - 20 - H / 4))
  end)
end

-- ======================= action (bouton A) =======================
local function nearestNpc(maxd)
  local best, bd = nil, maxd
  for _, o in ipairs(npcs) do
    if o.house == (place and place.id or nil) and not (place and place.up) then
      local d = dist(o.x, o.y, player.x, player.y)
      if d < bd then best, bd = o, d end
    end
  end
  return best
end
local function startAct(kind, dur, onHit, hitAt)
  player.act = { kind = kind, t = 0, dur = dur, onHit = onHit, hitAt = hitAt or dur * 0.5 }
end

local function actionA()
  if player.act or player.climb then return end
  local K = place and place.K or 1
  for id, c in pairs(CHESTS) do
    local here = (c.house == (place and place.id or nil)) and (not c.up or (place and place.up))
    if here and chestReady(id) and dist(player.x, player.y, c.x, c.y) < 18 * K then openChest(id); return end
  end
  local o = nearestNpc(22 * K)
  if o then talkTo(o); return end
  if place then return end
  for _, a in ipairs(animals) do
    if a.id ~= "crabe" and dist(a.x, a.y, player.x, player.y) < 20 then say(({ chat = "Sukah ronronne tout doucement…", tortue = "La tortue sourit doucement.", singe = "Jukii fait des grimaces !" })[a.id] or "Coucou !"); return end
  end
  local tk = TOOLS[tool].k
  if tk == "basket" then
    for _, t in ipairs(trees) do
      if dist(t.x, t.y, player.x, player.y) < 26 then
        if t.fruits > 0 then startAct("pick", 0.7, function() t.fruits = t.fruits - 1; give(t.kind); say("+1 " .. ITEM[t.kind] .. " (" .. inv(t.kind) .. ")") end)
        else say("Cet arbre est vide. Reviens plus tard !") end
        return
      end
    end
    for _, f in ipairs(flowers) do
      if f.on and dist(f.x, f.y, player.x, player.y) < 14 then startAct("pick", 0.7, function() f.on = false; f.regrow = 40; give("flower"); say("+1 fleur (" .. inv("flower") .. ")") end); return end
    end
    for _, c in ipairs(shells) do
      if c.on and dist(c.x, c.y, player.x, player.y) < 14 then startAct("pick", 0.7, function() c.on = false; c.regrow = 60; give("shell"); say("Un joli coquillage ! (" .. inv("shell") .. ")") end); return end
    end
    local crab
    for _, c in ipairs(crabs) do if c.on and dist(c.x, c.y, player.x, player.y) < 18 then crab = c end end
    for _, a in ipairs(animals) do if a.id == "crabe" and a.on and dist(a.x, a.y, player.x, player.y) < 18 then crab = a end end
    if crab then fishG = nil; startFight("crab", crab); return end
    say("Rien à ramasser ici. Approche-toi d'un arbre, d'une fleur ou d'un crabe.")
  elseif tk == "net" then
    startAct("net", 1.2, function()
      for _, b in ipairs(butterflies) do
        if b.on and dist(b.x, b.y, player.x, player.y - 12) < 26 then b.on = false; b.regrow = 25; give("butterfly"); say("Attrapé ! +1 papillon (" .. inv("butterfly") .. ")"); player.act.got = true; return end
      end
    end, 0.45)
  elseif tk == "rod" then
    local w = nearWater(player.x, player.y)
    if w then startFishing(w) else say("Approche-toi de l'eau pour pêcher.") end
  else
    say("Choisis un outil avec L1 ou R1.")
  end
end

-- ======================= boutons =======================
local function backScene() return place and "inside" or "world" end
local function press(b)
  if fade.dir ~= 0 then return end
  if scene == "title" then
    if b == "dpup" then titleSel = (titleSel - 2) % 4 + 1 elseif b == "dpdown" then titleSel = titleSel % 4 + 1 end
    if b == "a" or b == "start" then
      slot = titleSel
      if slots[slot] then
        S = slots[slot]; S.opened = S.opened or {}; S.mini = S.mini or {}; S.talk = S.talk or {}
        goTo(function()
          local h = S.house and houseById(S.house)
          if h then place = h; place.up = S.up; scene = "inside" else place = nil; scene = "world" end
          player.x, player.y = S.x, S.y; say("Bon retour, " .. (S.name or "Myah") .. " !")
        end)
      else nameG = { txt = "", r = 1, c = 1 }; scene = "name" end
    end
    return
  end
  if scene == "name" then
    local g = nameG
    if b == "dpup" then g.r = (g.r - 2) % 5 + 1 elseif b == "dpdown" then g.r = g.r % 5 + 1
    elseif b == "dpleft" then g.c = (g.c - 2) % 10 + 1 elseif b == "dpright" then g.c = g.c % 10 + 1 end
    local function finish()
      S = newSave(); S.name = (g.txt:gsub("^%s+", ""):gsub("%s+$", "")); if S.name == "" then S.name = "Myah" end
      goTo(function()   -- Myah commence chez elle
        local h = houseById("home"); place = h; place.up = false
        player.x, player.y = snapInside(h, 470, 640); player.dir = "down"; scene = "inside"
        saveGame(); refreshSlots()
        say("L1 et R1 : changer d'outil (panier, filet, canne)", 6)
        openDialog("Miraaï, ta maman", { "Bonjour ma chérie ! Viens me voir, j'ai besoin de toi pour la fête du Cygne." })
      end)
    end
    if b == "a" then
      if g.r == 5 then if g.c <= 5 then local c = utf8chars(g.txt); c[#c] = nil; g.txt = table.concat(c) else finish() end
      else local ch = utf8chars(KB[g.r])[g.c] or " "; if #utf8chars(g.txt) < 14 then g.txt = g.txt .. ch end end
    elseif b == "b" then local c = utf8chars(g.txt); c[#c] = nil; g.txt = table.concat(c)
    elseif b == "start" then finish()
    elseif b == "back" then scene = "title" end
    return
  end
  if scene == "dialog" then
    local d = dlg
    if d.choices and d.i == #d.lines and (b == "dpleft" or b == "dpright" or b == "dpup" or b == "dpdown") then d.sel = d.sel % #d.choices + 1; return end
    if b == "a" then
      d.i = d.i + 1
      if d.i > #d.lines then closeDialog() end
    elseif b == "b" then
      if d.choices then d.sel = #d.choices end
      d.i = #d.lines + 1; closeDialog()
    end
    return
  end
  if scene == "ending" then if b == "a" or b == "start" then scene = backScene() end; return end
  if scene == "fight" then if b == "b" then endFishing(); say("Tu as lâché prise.") end; return end
  if scene == "memory" then
    local g = memG
    if b == "b" or b == "start" then scene = backScene(); return end
    if g.pairs == 8 then if b == "a" then scene = backScene() end; return end
    if g.wait > 0 then return end
    local c, r = (g.sel - 1) % 4, math.floor((g.sel - 1) / 4)
    if b == "dpleft" then c = (c + 3) % 4 elseif b == "dpright" then c = (c + 1) % 4 elseif b == "dpup" then r = (r + 3) % 4 elseif b == "dpdown" then r = (r + 1) % 4 end
    g.sel = r * 4 + c + 1
    if b == "a" and not g.found[g.sel] and g.open[1] ~= g.sel then
      g.open[#g.open + 1] = g.sel; tone(1)
      if #g.open == 2 then
        g.moves = g.moves + 1
        if g.cards[g.open[1]] == g.cards[g.open[2]] then
          g.found[g.open[1]], g.found[g.open[2]] = true, true; g.open = {}; g.pairs = g.pairs + 1; tone(3)
          if g.pairs == 8 then say("Bravo ! Toutes les paires en " .. g.moves .. " coups ! +2 coquillages", 5); give("shell", 2); saveGame() end
        else g.wait = 1.0 end
      end
    end
    return
  end
  if scene == "rythme" then
    local g = rytG
    if b == "b" or b == "start" then scene = backScene(); return end
    if g.mode == "end" then if b == "a" then scene = backScene() end; return end
    if g.mode == "play" and RYT_KEY[b] then
      local k = RYT_KEY[b]; g.lit, g.litT = k, 0.25; tone(k)
      g.i = g.i + 1
      if g.seq[g.i] ~= k then g.mode = "end"; g.win = false
      elseif g.i == #g.seq then
        if #g.seq >= 8 then g.mode = "end"; g.win = true; give("shell", 2); give("perle", 1); saveGame()
        else g.seq[#g.seq + 1] = math.random(4); g.mode = "show"; g.i = 0; g.t = -0.9 end
      end
    end
    return
  end
  if scene == "piano" then
    if b == "start" or b == "back" then if pianoG.src then pianoG.src:stop() end; scene = backScene(); return end
    if pianoG.done then if b == "a" then scene = backScene() end; return end
    if LANE_KEY[b] then pianoHit(LANE_KEY[b]) end
    return
  end
  if scene == "bag" then if b == "y" or b == "b" then scene = backScene() end; return end
  if scene == "help" then if b == "a" or b == "b" or b == "back" or b == "start" then scene = backScene() end; return end
  if scene == "menu" then
    local items = 4
    if b == "dpup" then menuSel = (menuSel - 2) % items + 1 elseif b == "dpdown" then menuSel = menuSel % items + 1 end
    if b == "b" or b == "start" then scene = backScene() end
    if b == "a" then
      if menuSel == 1 then scene = backScene()
      elseif menuSel == 2 then scene = "games"; menuSel = 1
      elseif menuSel == 3 then saveGame(); say("Partie sauvegardée !"); scene = backScene()
      elseif menuSel == 4 then saveGame(); love.event.quit() end
    end
    return
  end
  if scene == "games" then
    if b == "dpup" then menuSel = (menuSel - 2) % 3 + 1 elseif b == "dpdown" then menuSel = menuSel % 3 + 1 end
    if b == "b" or b == "start" then scene = "menu"; menuSel = 2 end
    if b == "a" then if menuSel == 1 then startMemory() elseif menuSel == 2 then startRythme() else scene = "songs"; menuSel = 1 end end
    return
  end
  if scene == "songs" then
    if b == "dpup" then menuSel = (menuSel - 2) % 3 + 1 elseif b == "dpdown" then menuSel = menuSel % 3 + 1 end
    if b == "b" or b == "start" then scene = backScene() end
    if b == "a" then startPiano(menuSel) end
    return
  end
  -- dehors ou dans une maison
  if fishG and fishG.kind == "fish" and scene ~= "fight" then   -- pendant la pêche
    if b == "a" and fishG.phase == "bite" then startFight("fish")
    elseif b == "a" and fishG.phase == "wait" then say("Patience… attends que le poisson morde.", 1.6)
    elseif b == "b" then fishG = nil end
    return
  end
  if b == "start" then scene = "menu"; menuSel = 1
  elseif b == "back" then scene = "help"
  elseif b == "y" then scene = "bag"
  elseif b == "a" then actionA()
  elseif b == "rightshoulder" then tool = tool % #TOOLS + 1
  elseif b == "leftshoulder" then tool = (tool - 2) % #TOOLS + 1 end
end
local function release(b)
  if scene == "piano" and pianoG and LANE_KEY[b] then pianoG.held[LANE_KEY[b]] = nil end
end
local lastIn = ""
function love.gamepadpressed(j, b) padUsed = true; lastIn = "manette " .. b; press(b) end
function love.gamepadreleased(j, b) release(b) end
-- au clavier (PC). Si la console envoie aussi des touches, on les ignore dès que la manette a parlé (sinon tout se fait deux fois)
local KEYS = { ["return"] = "start", space = "a", z = "a", lshift = "b", lctrl = "b", y = "y", x = "x", tab = "back", backspace = "b", q = "leftshoulder", e = "rightshoulder", up = "dpup", down = "dpdown", left = "dpleft", right = "dpright" }
function love.keypressed(k) lastIn = "touche " .. k; if padUsed then return end; if KEYS[k] then press(KEYS[k]) end end
function love.keyreleased(k) if padUsed then return end; if KEYS[k] then release(KEYS[k]) end end
function love.joystickpressed(j, n) if not j:isGamepad() then lastIn = "bouton " .. n end end
function love.joystickadded(j) pad = j end

-- ======================= démarrage =======================
function love.load()
  love.graphics.setDefaultFilter("linear", "linear")
  walkMask = love.filesystem.read("assets/walk.bin")
  seaMask = love.filesystem.read("assets/sea.bin") or string.rep("\0", GW * GH)
  names = love.filesystem.load("assets/walk_names.lua")()
  for sh, d in pairs(names) do frameIndex[sh] = {}; for i, n in ipairs(d.names) do frameIndex[sh][n] = i - 1 end end
  fonts.s = love.graphics.newFont(13); fonts.m = love.graphics.newFont(16); fonts.l = love.graphics.newFont(30); fonts.b = love.graphics.newFont(22)
  local js = love.joystick.getJoysticks(); pad = js[1]
  S = newSave(); refreshSlots()
  setupWorld(); setupNpcs()
  img("assets/map.jpg"); img("assets/myah/walk.png")
end

-- ======================= mise à jour =======================
local autosave = 0
local function moveMyah(dt, canWalk, speed)
  if player.act or player.climb or fishG then player.moving = false; return end
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

local function updateFight(dt)
  local F = fishG.F
  F.mt = F.mt - dt
  if F.mt <= 0 then
    if F.mode == "rest" then F.mode = "pull"; F.mt = 0.9 + math.random() * 0.7 else F.mode = "rest"; F.mt = 1.6 + math.random() * 1.1 end
  end
  local held = holdA()
  if held then F.T = F.T + (F.mode == "pull" and 0.8 or 0.15) * dt
  else F.T = F.T + ((F.mode == "pull" and 0.3 or 0.1) - F.T) * math.min(1, 2.2 * dt) end
  F.T = math.max(0, F.T)
  F.prog = F.prog + ((held and F.mode == "rest") and 0.28 or (held and 0.04 or -0.06)) * dt
  F.prog = math.max(0, math.min(1, F.prog))
  if F.T >= 1 then F.T = 0.35; F.prog = math.max(0, F.prog - 0.12); F.mode = "rest"; F.mt = 1.6; say(fishG.kind == "fish" and "Aïe, la ligne a failli casser ! Lâche quand il tire." or "Il pince ! Lâche quand il s'agite.", 2.2) end
  if F.prog >= 1 then
    if fishG.kind == "fish" then
      fishG.phase = "caught"; fishG.t = 0; scene = backScene()
      fishG.got = math.random() < 0.06 and "perle" or "fish"
    else
      local c = fishG.target; c.on = false; c.regrow = 35; give("crab"); say("Attrapé ! +1 crabe (" .. inv("crab") .. ")")
      fishG = nil; scene = backScene(); startAct("pick", 0.7)
    end
  end
end

function love.update(dt)
  dt = math.min(dt, 0.05)
  if toastT > 0 then toastT = toastT - dt end
  if fade.dir ~= 0 then
    fade.a = fade.a + fade.dir * dt / 0.35
    if fade.dir > 0 and fade.a >= 1 then fade.a = 1; if fade.fn then fade.fn() end; fade.fn = nil; fade.dir = -1
    elseif fade.dir < 0 and fade.a <= 0 then fade.a = 0; fade.dir = 0 end
  end
  if scene == "title" or scene == "name" then return end
  for _, t in ipairs(trees) do if t.fruits < 5 then t.regrow = t.regrow + dt; if t.regrow > 20 then t.regrow = 0; t.fruits = t.fruits + 1 end end end
  for _, f in ipairs(flowers) do if not f.on then f.regrow = f.regrow - dt; if f.regrow <= 0 then f.on = true end end end
  for _, b in ipairs(butterflies) do
    b.t = b.t + dt
    if not b.on then b.regrow = b.regrow - dt; if b.regrow <= 0 then b.on = true end end
    b.x = b.hx + math.sin(b.t * 0.45) * 30 + math.sin(b.t * 1.7) * 6; b.y = b.hy - 14 + math.cos(b.t * 0.8) * 12
  end
  for _, a in ipairs(animals) do
    a.t = a.t + dt
    if not a.on then a.regrow = a.regrow - dt; if a.regrow <= 0 then a.on = true end end
    if a.id ~= "tortue" then   -- la tortue reste tranquille
      local nx = a.hx + math.sin(a.t * 0.25) * 14
      if walkable(nx, a.y) then a.face = nx > a.x and 1 or -1; a.x = nx end
    end
  end
  for _, c in ipairs(crabs) do
    c.t = c.t + dt
    if not c.on then c.regrow = c.regrow - dt; if c.regrow <= 0 then c.on = true end end
    local nx = c.x + math.sin(c.t * 0.7) * 12 * dt
    if walkable(nx, c.y) then c.x = nx end
  end
  for _, c in ipairs(shells) do if not c.on then c.regrow = c.regrow - dt; if c.regrow <= 0 then c.on = true end end end
  for _, f in ipairs(fishes) do
    f.t = f.t + dt
    local nx, ny = f.hx + math.sin(f.t * 0.3) * 22, f.hy + math.sin(f.t * 0.21) * 5
    if isWater(nx, ny) then f.face = nx > f.x and 1 or -1; f.x, f.y = nx, ny end
  end
  autosave = autosave + dt
  if autosave > 30 and (scene == "world" or scene == "inside") then autosave = 0; saveGame() end

  if player.act then
    local a = player.act; local before = a.t
    a.t = a.t + dt
    if a.onHit and before < a.hitAt and a.t >= a.hitAt then a.onHit() end
    if player.act == a and a.t >= a.dur then player.act = nil end
  end
  if fishG and fishG.kind == "fish" and scene ~= "fight" then
    local g = fishG; g.t = g.t + dt
    if g.phase == "cast" and g.t > 0.7 then g.phase, g.t = "wait", 0
    elseif g.phase == "wait" and g.t > g.wait then g.phase, g.t = "bite", 0; tone(4)
    elseif g.phase == "bite" and g.t > 1.6 then g.phase, g.t, g.wait = "wait", 0, 1.5 + math.random() * 2; say("Trop tard ! Appuie sur A dès que tu vois le « ! »", 2)
    elseif g.phase == "caught" and g.t > 1.8 then
      give(g.got); say(g.got == "perle" and "Oh ! Une perle !" or ("Un poisson ! (" .. inv("fish") .. ")")); fishG = nil
    end
  end
  if scene == "fight" then updateFight(dt) end

  if scene == "world" then
    moveMyah(dt, function(x, y) return walkable(x, y) and not blockedByNpc(x, y) end, 55)
    follow(dt, player.x, player.y, WORLD_W, WORLD_H, cam.zoom)
    if doorLock then local h = houseById(doorLock); if not h or dist(player.x, player.y, h.door[1], h.door[2]) > 24 then doorLock = nil end end
    for _, h in ipairs(DATA.houses) do
      if h.floor and h.id ~= doorLock and fade.dir == 0 and dist(player.x, player.y, h.door[1], h.door[2]) < 9 then enterHouse(h) end
    end
  elseif scene == "inside" and not place then scene = "world"
  elseif scene == "inside" then
    local I = D2.inside[place.id] or {}
    local K = place.K
    if player.climb then   -- l'échelle, doucement
      local c = player.climb
      c.t = c.t + dt / 1.8
      player.x = c.x0 + (c.x1 - c.x0) * math.min(1, c.t); player.y = c.y0 + (c.y1 - c.y0) * math.min(1, c.t)
      player.t = player.t + dt
      if c.t >= 1 then place.up = c.up; player.climb = nil; player.dir = c.up and "up" or "down" end
    else
      local P = (place.up and I.f1) or place.floor
      moveMyah(dt, function(x, y)
        if not insidePoly(P, x, y) then return false end
        if not place.up then for _, b in ipairs(I.blocks or {}) do if insidePoly(b, x, y) then return false end end end
        return place.up or not blockedByNpc(x, y, K)
      end, 55 * K)
      if I.ladder and I.f1 and not fishG and not player.act then
        local dx, dy = moveInput()
        local L0, L1 = I.ladder[1], I.ladder[2]
        if not place.up and dist(player.x, player.y, L0[1], L0[2]) < 40 and dy < -0.5 then player.climb = { t = 0, x0 = player.x, y0 = player.y, x1 = L1[1], y1 = L1[2] - 10, up = true } end
        if place.up and dist(player.x, player.y, L1[1], L1[2]) < 40 and dy > 0.5 then player.climb = { t = 0, x0 = player.x, y0 = player.y, x1 = L0[1], y1 = L0[2] + 12, up = false } end
      end
    end
    local z = math.max(H / place.H, 0.62)
    cam.zoom = z
    follow(dt, player.x, player.y, place.W, place.H, z)
    if not place.up and not player.climb and fade.dir == 0 and dist(player.x, player.y, place.sexit[1], place.sexit[2]) < 25 then leaveHouse() end
  elseif scene == "memory" then
    if memG.wait > 0 then memG.wait = memG.wait - dt; if memG.wait <= 0 then memG.open = {} end end
  elseif scene == "rythme" then
    local g = rytG
    g.litT = g.litT - dt
    if g.mode == "show" then
      g.t = g.t + dt
      local step = math.floor(g.t / 0.7) + 1
      if g.t >= 0 and step <= #g.seq and step ~= g.shown then g.shown = step; g.lit, g.litT = g.seq[step], 0.45; tone(g.seq[step]) end
      if g.t >= 0 and step > #g.seq then g.mode = "play"; g.i = 0; g.shown = nil end
    end
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
  end
end

-- ======================= dessin =======================
local SHEET = { basket = "walkbask", net = "walknet", rod = "walkrod", hand = "walk" }
local quads = {}
local function frameOf()
  if player.climb then return "lad", (player.climb.up and "up" or "down") .. (math.floor(player.t * 6) % 4 + 1) end
  local a = player.act
  if a then
    if a.kind == "net" then return "walknet", a.t < 0.3 and "ready" or a.t < 0.65 and "swing" or (a.got and "victory" or "idle") end
    if a.kind == "pick" then return "walkbask", a.t < 0.45 and "crouch" or "crouchidle" end
    if a.kind == "chest" then return "walk", player.dir .. "1" end
  end
  if fishG and fishG.kind == "fish" then
    local g = fishG
    if g.phase == "cast" then return "walkrod", "cast" .. math.min(3, math.floor(g.t / 0.24) + 1) end
    if g.phase == "fight" then return "walkrod", "reel" .. (math.floor(love.timer.getTime() * 6) % 3 + 1) end
    if g.phase == "caught" then return "walkrod", "caught" .. math.min(3, math.floor(g.t / 0.25) + 1) end
    return "walkrod", "cast3"
  end
  local sh = SHEET[TOOLS[tool].k] or "walk"
  return sh, player.dir .. (player.moving and (math.floor(player.t * 10) % 8 + 1) or 1)
end
local function drawMyahAt(x, y, s)
  local sh, n = frameOf()
  local im = img("assets/myah/" .. sh .. ".png"); if not im then sh = "walk"; im = img("assets/myah/walk.png"); n = player.dir .. "1" end
  if not im then return end
  local fi = frameIndex[sh] or frameIndex.walk
  local i = fi[n] or fi[player.dir .. "1"] or fi["down1"] or fi["idle"] or 0
  local cols = (names[sh] and names[sh].cols) or 8
  local key = sh .. i
  if not quads[key] then quads[key] = love.graphics.newQuad((i % cols) * 128, math.floor(i / cols) * 128, 128, 128, im:getDimensions()) end
  local flip = (player.act or fishG) and player.dir == "left"
  love.graphics.setColor(0, 0, 0, 0.2); love.graphics.ellipse("fill", x, y, 44 * s, 12 * s)
  love.graphics.setColor(1, 1, 1); love.graphics.draw(im, quads[key], x + (flip and 128 * s or -128 * s), y - 212 * s, 0, s * 2 * (flip and -1 or 1), s * 2)
end
local function bubble(x, y, r, txt, col)   -- rond jaune avec « ! » rouge bien centré
  love.graphics.setColor(0.45, 0.3, 0.1, 0.5); love.graphics.circle("fill", x, y + r * 0.12, r)
  love.graphics.setColor(1, 0.86, 0.25); love.graphics.circle("fill", x, y, r)
  love.graphics.setColor(0.6, 0.38, 0.05); love.graphics.setLineWidth(math.max(0.5, r * 0.12)); love.graphics.circle("line", x, y, r); love.graphics.setLineWidth(1)
  local f = fonts.b; love.graphics.setFont(f); love.graphics.setColor(col or { 0.85, 0.12, 0.12 })
  local k = (r * 1.5) / f:getHeight()
  love.graphics.print(txt, x - f:getWidth(txt) * k / 2, y - f:getHeight() * k / 2, 0, k, k)
end
local function drawNpc(o, k)
  local n = o.d; local im = img(n.src); if not im then return end
  k = k or 1
  local s = n.sc * k
  love.graphics.setColor(0, 0, 0, 0.2); love.graphics.ellipse("fill", o.x, o.y, n.mw * s * 0.22, 3 * k)
  love.graphics.setColor(1, 1, 1); love.graphics.draw(im, o.x - n.cx * s, o.y - n.feet * s, 0, s, s)
  if wantsBubble(n) then
    local hy = o.y - (n.feet - n.head) * s - 9 * k + math.sin(love.timer.getTime() * 3) * k
    local st = S.quest[n.id]
    local ready = st == "active" and hasNeed(n.need or {})
    bubble(o.x, hy, 7 * k, st == "active" and (ready and "v" or "?") or "!", ready and { .15, .55, .2 } or nil)
  end
end
local function sprite(name, x, y, k)
  local d = D2.sprites[name]; local im = img("assets/spr/" .. name .. ".png"); if not d or not im then return end
  k = k or 1
  local kx, ky = d[1] / im:getWidth() * k, d[2] / im:getHeight() * k
  love.graphics.setColor(1, 1, 1); love.graphics.draw(im, x, y, 0, kx, ky, d[3] * k / kx, d[4] * k / ky)
end
local function drawImgH(path, x, y, h, flip)
  local im = img(path); if not im then return end
  local k = h / im:getHeight()
  love.graphics.setColor(0, 0, 0, 0.18); love.graphics.ellipse("fill", x, y, im:getWidth() * k * 0.35, h * 0.2)
  love.graphics.setColor(1, 1, 1); love.graphics.draw(im, x, y, 0, k * (flip and -1 or 1), k, im:getWidth() / 2, im:getHeight())
end
local function drawChests(houseId)
  for id, c in pairs(CHESTS) do
    if c.house == houseId and (not c.up or (place and place.up)) and S.quest[id] == "done" then
      local name = S.opened[id] and "c2" or (chestReady(id) and not c.house and "c1" or c.img)
      local im = img("assets/chin/" .. name .. ".png")
      if im then
        local hgt = c.house and (place and place.K or 3.5) * 13.2 or 14.4
        local s = hgt / im:getHeight()
        if chestReady(id) then love.graphics.setColor(1, 0.95, 0.5, 0.35 + 0.25 * math.sin(love.timer.getTime() * 4)); love.graphics.circle("fill", c.x, c.y - hgt / 2, hgt * 0.8) end
        love.graphics.setColor(1, 1, 1); love.graphics.draw(im, c.x, c.y, 0, s, s, im:getWidth() / 2, im:getHeight())
      end
    end
  end
end
local function drawTree(t)
  local im = img("extra/trees/" .. t.kind .. "_" .. (t.fruits > 0 and "full" or "bare") .. ".png"); if not im then return end
  local k = TREE_K[t.kind] or 0.2
  love.graphics.setColor(0.06, 0.18, 0.06, 0.28); love.graphics.ellipse("fill", t.x, t.y, 20, 6)
  love.graphics.setColor(1, 1, 1, 0.92); love.graphics.draw(im, t.x, t.y + 1, 0, k, k, im:getWidth() / 2, im:getHeight())
end
local function drawButterfly(b)
  local flap = 0.55 + 0.45 * math.abs(math.sin(b.t * 9))
  local d = D2.sprites["bfly" .. b.sp]; local im = img("assets/spr/bfly" .. b.sp .. ".png"); if not im or not d then return end
  love.graphics.setColor(1, 1, 1); love.graphics.draw(im, b.x, b.y, 0, d[1] / im:getWidth() * flap * 0.75, d[2] / im:getHeight() * 0.75, im:getWidth() / 2, im:getHeight() / 2)
end
local function panel(x, y, w, h)
  love.graphics.setColor(1, 0.97, 0.9, 0.96); love.graphics.rectangle("fill", x, y, w, h, 14)
  love.graphics.setColor(0.6, 0.45, 0.75); love.graphics.setLineWidth(3); love.graphics.rectangle("line", x, y, w, h, 14); love.graphics.setLineWidth(1)
end
local function glow(x, y, r)
  love.graphics.setColor(1, 0.95, 0.6, 0.3 + 0.2 * math.sin(love.timer.getTime() * 3)); love.graphics.circle("fill", x, y, r)
  love.graphics.setColor(1, 1, 0.85, 0.5); love.graphics.circle("fill", x, y, r * 0.45)
end
local function houseHasBubble(id)
  for _, o in ipairs(npcs) do if o.house == id and wantsBubble(o.d) then return true end end
  return false
end
local function drawFishingWorld()
  local g = fishG; if not g or g.kind ~= "fish" then return end
  local hx, hy = player.x + (player.dir == "left" and -10 or 10), player.y - 22
  local bx, by = g.bx, g.by
  if g.phase == "cast" then local u = math.min(1, g.t / 0.7); bx, by = hx + (g.bx - hx) * u, hy + (g.by - hy) * u - math.sin(u * math.pi) * 18 end
  local bob = (g.phase == "bite") and math.sin(love.timer.getTime() * 20) * 1.2 or math.sin(love.timer.getTime() * 3) * 0.6
  love.graphics.setColor(0.25, 0.2, 0.15, 0.8); love.graphics.line(hx, hy, bx, by + bob)
  love.graphics.setColor(0.95, 0.25, 0.25); love.graphics.circle("fill", bx, by + bob, 2)
  love.graphics.setColor(1, 1, 1); love.graphics.circle("fill", bx, by + bob - 1.2, 1)
  if g.phase == "bite" then bubble(bx, by - 12, 6, "!") end
  if g.phase == "caught" then
    local fi = g.got == "perle" and img("assets/spr/perle.png") or img("assets/spr/" .. g.k .. ".png")
    if fi then local k = 16 / fi:getWidth(); love.graphics.setColor(1, 1, 1); love.graphics.draw(fi, player.x, player.y - 46 - math.min(1, g.t) * 6, math.sin(g.t * 8) * 0.2, k, k, fi:getWidth() / 2, fi:getHeight() / 2) end
  end
end

local function drawWorld()
  love.graphics.push(); love.graphics.scale(cam.zoom); love.graphics.translate(-cam.x, -cam.y)
  local map = img("assets/map.jpg")
  love.graphics.setColor(1, 1, 1); if map then love.graphics.draw(map, 0, 0, 0, WORLD_W / map:getWidth(), WORLD_H / map:getHeight()) end
  for _, f in ipairs(fishes) do
    local d = D2.sprites[f.k]; local im = img("assets/spr/" .. f.k .. ".png")
    if d and im then love.graphics.setColor(1, 1, 1, 0.6); love.graphics.draw(im, f.x, f.y, 0, d[1] / im:getWidth() * 0.9 * f.face, d[2] / im:getHeight() * 0.9, im:getWidth() / 2, im:getHeight() / 2) end
  end
  for _, c in ipairs(shells) do if c.on then drawImgH("assets/spr/shell" .. c.k .. ".png", c.x, c.y, 5.3) end end
  for _, f in ipairs(flowers) do if f.on then sprite("flower" .. f.c, f.x, f.y, 0.75) end end
  drawChests(nil)
  for _, h in ipairs(DATA.houses) do
    if h.floor and dist(player.x, player.y, h.door[1], h.door[2]) < 45 then glow(h.door[1], h.door[2] - 2, 8) end
  end
  local list = {}
  for _, t in ipairs(trees) do list[#list + 1] = { y = t.y, f = function() drawTree(t) end } end
  for _, o in ipairs(npcs) do if not o.house then list[#list + 1] = { y = o.y, f = function() drawNpc(o) end } end end
  for _, a in ipairs(animals) do if a.on then list[#list + 1] = { y = a.y, f = function() drawImgH("assets/spr/an_" .. a.id .. ".png", a.x, a.y, a.h * (a.id == "crabe" and 0.75 or 1), a.face < 0) end } end end
  for _, c in ipairs(crabs) do if c.on then list[#list + 1] = { y = c.y, f = function() drawImgH("assets/spr/an_crabe.png", c.x, c.y, 8.3, math.sin(c.t) > 0) end } end end
  if S.plumes >= 5 then
    list[#list + 1] = { y = DATA.perch[2], f = function() local gk = img("assets/gaikin_perch.png"); if gk then love.graphics.setColor(1, 1, 1); love.graphics.draw(gk, DATA.perch[1] - 22, DATA.perch[2] - 40, 0, 44 / gk:getWidth(), 44 / gk:getWidth()) end end }
  end
  list[#list + 1] = { y = player.y, f = function() drawMyahAt(player.x, player.y, MS) end }
  table.sort(list, function(a, b) return a.y < b.y end)
  for _, it in ipairs(list) do it.f() end
  for _, b in ipairs(butterflies) do if b.on then drawButterfly(b) end end
  for _, h in ipairs(DATA.houses) do   -- le « ! » au-dessus de la porte si quelqu'un attend dedans
    if houseHasBubble(h.id) then bubble(h.door[1], h.door[2] - 34 + math.sin(love.timer.getTime() * 3), 7, "!") end
  end
  drawFishingWorld()
  love.graphics.pop()
end

local function drawInside()
  local bg = img(place.img)
  if place.id == "boat" then love.graphics.clear(0.78, 0.88, 0.96) else love.graphics.clear(0, 0, 0) end
  love.graphics.push(); love.graphics.scale(cam.zoom); love.graphics.translate(-cam.x, -cam.y)
  love.graphics.setColor(1, 1, 1); if bg then love.graphics.draw(bg, 0, 0, 0, place.W / bg:getWidth(), place.H / bg:getHeight()) end
  if not place.up then glow(place.sexit[1], place.sexit[2] - 10, 22) end
  drawChests(place.id)
  local list = {}
  for _, o in ipairs(npcs) do if o.house == place.id and not place.up then list[#list + 1] = { y = o.y, f = function() drawNpc(o, place.K) end } end end
  list[#list + 1] = { y = player.y, f = function() drawMyahAt(player.x, player.y, MS * place.K * 0.75) end }
  table.sort(list, function(a, b) return a.y < b.y end)
  for _, it in ipairs(list) do it.f() end
  love.graphics.pop()
end

local function drawHud()
  love.graphics.setFont(fonts.s)
  panel(8, 8, 96, 26); love.graphics.setColor(PURPLE); love.graphics.print("Plumes " .. S.plumes .. "/5", 18, 14)
  if toastT > 0 and toast then
    love.graphics.setFont(fonts.m); panel(70, 44, W - 140, 34); love.graphics.setColor(PURPLE); love.graphics.printf(toast, 76, 52, W - 152, "center")
  end
end

local function drawDialog()
  local d = dlg
  panel(16, H - 150, W - 32, 138)
  love.graphics.setColor(0.78, 0.27, 0.48); love.graphics.setFont(fonts.m); love.graphics.print(d.who or "", 32, H - 142)
  love.graphics.setColor(PURPLE); love.graphics.printf(d.lines[d.i] or "", 32, H - 118, W - 64)
  if d.choices and d.i == #d.lines then
    for i, c in ipairs(d.choices) do
      local x = 120 + (i - 1) * 220
      love.graphics.setColor(i == d.sel and { 0.62, 0.48, 0.78 } or { 0.93, 0.88, 0.98 }); love.graphics.rectangle("fill", x, H - 56, 190, 34, 17)
      love.graphics.setColor(i == d.sel and { 1, 1, 1 } or PURPLE); love.graphics.printf(c, x, H - 48, 190, "center")
    end
  else
    love.graphics.setFont(fonts.s); love.graphics.setColor(0.5, 0.4, 0.6); love.graphics.printf("A  suite", 16, H - 32, W - 50, "right")
  end
end

local function drawBag()
  panel(40, 20, W - 80, H - 40)
  local sac = img("assets/ui/sac.png")
  if sac then local k = 90 / sac:getHeight(); love.graphics.setColor(1, 1, 1); love.graphics.draw(sac, W / 2, 26, 0, k, k, sac:getWidth() / 2, 0) end
  local list = { "coconut", "banana", "mango", "flower", "butterfly", "fish", "crab", "shell", "perle" }
  for i, k in ipairs(list) do
    local c, r = (i - 1) % 3, math.floor((i - 1) / 3)
    local x, y = 80 + c * 170, 128 + r * 70
    love.graphics.setColor(1, 1, 1, 0.7); love.graphics.rectangle("fill", x, y, 150, 60, 12)
    local ic = img(ICON[k])
    if ic then local s = math.min(44 / ic:getWidth(), 44 / ic:getHeight()); love.graphics.setColor(1, 1, 1, inv(k) > 0 and 1 or 0.35); love.graphics.draw(ic, x + 30, y + 30, 0, s, s, ic:getWidth() / 2, ic:getHeight() / 2) end
    love.graphics.setColor(PURPLE); love.graphics.setFont(fonts.b); love.graphics.print("x " .. inv(k), x + 62, y + 6)
    love.graphics.setFont(fonts.s); love.graphics.print(ITEM[k], x + 62, y + 36)
  end
  love.graphics.setFont(fonts.m); love.graphics.setColor(0.78, 0.27, 0.48); love.graphics.printf("Plumes de Gaïkin : " .. S.plumes .. " / 5", 40, 345, W - 80, "center")
  love.graphics.setFont(fonts.s); love.graphics.setColor(PURPLE)
  local my = 372
  for _, n in ipairs(DATA.npcs) do
    if n.id and S.quest[n.id] == "active" and my < 430 then love.graphics.printf("- " .. (n.title or ""), 40, my, W - 80, "center"); my = my + 18 end
  end
  love.graphics.setColor(0.5, 0.4, 0.6); love.graphics.printf("Y pour fermer", 40, H - 40, W - 80, "center")
end

local function drawMenu(title, items)
  panel(170, 80, 300, 70 + #items * 40)
  love.graphics.setFont(fonts.l); love.graphics.setColor(PURPLE); love.graphics.printf(title, 170, 90, 300, "center")
  love.graphics.setFont(fonts.m)
  for i, it in ipairs(items) do
    local y = 145 + (i - 1) * 40
    if i == menuSel then love.graphics.setColor(0.91, 0.86, 0.98); love.graphics.rectangle("fill", 195, y - 6, 250, 32, 16) end
    love.graphics.setColor(PURPLE); love.graphics.printf(it, 170, y, 300, "center")
  end
end

local function drawHelp()
  panel(100, 60, 440, 360)
  love.graphics.setFont(fonts.m); love.graphics.setColor(PURPLE); love.graphics.printf("Les touches", 100, 74, 440, "center")
  local rows = { { { .88, .3, .3 }, "A", "Parler, agir, valider" }, { { .95, .8, .25 }, "B", "Courir (garder appuyé), retour" }, { { .35, .75, .4 }, "Y", "Sac à dos" } }
  for i, r in ipairs(rows) do
    local y = 112 + (i - 1) * 34
    love.graphics.setColor(r[1]); love.graphics.circle("fill", 140, y + 9, 12)
    love.graphics.setColor(1, 1, 1); love.graphics.printf(r[2], 128, y, 24, "center")
    love.graphics.setColor(PURPLE); love.graphics.print(r[3], 165, y)
  end
  love.graphics.setFont(fonts.s)
  love.graphics.print("L1 / R1 : changer d'outil (main libre, panier, filet, canne)", 130, 225)
  love.graphics.print("START : menu (mini-jeux, sauvegarde)    SELECT : cette aide", 130, 248)
  love.graphics.print("Panier : fruits, fleurs, coquillages, crabes", 130, 278)
  love.graphics.print("Filet : papillons      Canne : au bord de l'eau", 130, 300)
  love.graphics.print("Pêche : tiens A quand il se fatigue, lâche quand il tire", 130, 322)
  love.graphics.setColor(0.5, 0.4, 0.6); love.graphics.print("Dernière touche reçue : " .. (lastIn or ""), 130, 360)
end

local function drawFight()
  local g = fishG; local F = g.F
  panel(90, 120, 460, 230)
  love.graphics.setFont(fonts.m); love.graphics.setColor(PURPLE)
  love.graphics.printf(g.kind == "fish" and "Ça mord !" or "Attrape le crabe !", 90, 132, 460, "center")
  local pic = g.kind == "fish" and img("assets/spr/" .. g.k .. ".png") or img("assets/spr/an_crabe.png")
  if pic then
    local k = 70 / pic:getWidth(); local wob = F.mode == "pull" and math.sin(love.timer.getTime() * 25) * 6 or 0
    love.graphics.setColor(1, 1, 1); love.graphics.draw(pic, W / 2 + wob, 200, 0, k, k, pic:getWidth() / 2, pic:getHeight() / 2)
  end
  if F.mode == "pull" then love.graphics.setColor(0.85, 0.2, 0.2); love.graphics.printf(g.kind == "fish" and "Il tire ! Lâche A" or "Il s'agite ! Lâche A", 90, 240, 460, "center")
  else love.graphics.setColor(0.15, 0.55, 0.2); love.graphics.printf("Il se fatigue : garde A appuyé", 90, 240, 460, "center") end
  love.graphics.setFont(fonts.s); love.graphics.setColor(PURPLE); love.graphics.print("Prise", 120, 274); love.graphics.print("Tension", 120, 304)
  love.graphics.setColor(0.85, 0.85, 0.9); love.graphics.rectangle("fill", 190, 272, 320, 16, 8); love.graphics.rectangle("fill", 190, 302, 320, 16, 8)
  love.graphics.setColor(0.4, 0.78, 0.45); love.graphics.rectangle("fill", 190, 272, 320 * F.prog, 16, 8)
  love.graphics.setColor(F.T > 0.7 and { 0.9, 0.3, 0.25 } or { 0.95, 0.75, 0.3 }); love.graphics.rectangle("fill", 190, 302, 320 * math.min(1, F.T), 16, 8)
  love.graphics.setColor(0.5, 0.4, 0.6); love.graphics.printf("B : abandonner", 90, 328, 460, "center")
end

local function drawMemory()
  love.graphics.clear(0.86, 0.82, 0.95)
  local g = memG
  love.graphics.setFont(fonts.m); love.graphics.setColor(PURPLE); love.graphics.printf("Memory   (paires : " .. g.pairs .. "/8)", 0, 10, W, "center")
  for i = 1, 16 do
    local c, r = (i - 1) % 4, math.floor((i - 1) / 4)
    local x, y = 150 + c * 88, 36 + r * 104
    local shown = g.found[i] or g.open[1] == i or g.open[2] == i
    local im = img("assets/memory/" .. (shown and MEM_IMG[g.cards[i]] or "dos") .. ".jpg")
    love.graphics.setColor(1, 1, 1, g.found[i] and 0.75 or 1)
    if im then love.graphics.draw(im, x, y, 0, 80 / im:getWidth(), 96 / im:getHeight()) else love.graphics.rectangle("fill", x, y, 80, 96, 10) end
    if i == g.sel then love.graphics.setColor(0.25, 0.7, 0.3); love.graphics.setLineWidth(4); love.graphics.rectangle("line", x - 2, y - 2, 84, 100, 8); love.graphics.setLineWidth(1) end
  end
  love.graphics.setFont(fonts.s); love.graphics.setColor(PURPLE)
  love.graphics.printf(g.pairs == 8 and "Bravo ! A pour revenir sur l'île" or "Flèches : choisir   A : retourner   B : quitter", 0, H - 22, W, "center")
end

local function drawRythme()
  local bg = img("assets/piano/bg.jpg")
  love.graphics.setColor(1, 1, 1); if bg then love.graphics.draw(bg, 0, 0, 0, W / bg:getWidth(), H / bg:getHeight()) else love.graphics.clear(0.8, 0.78, 0.95) end
  local g = rytG
  local msg = g.mode == "show" and "Écoute Kykah…" or g.mode == "play" and "À toi ! Répète avec A B Y X" or (g.win and "Bravo ! +2 coquillages et 1 perle" or "Oups ! Tu as retenu " .. (#g.seq - 1) .. " notes")
  panel(120, 20, 400, 40); love.graphics.setFont(fonts.m); love.graphics.setColor(PURPLE); love.graphics.printf(msg, 120, 31, 400, "center")
  local P = { { W / 2, 150 }, { W / 2 + 120, 250 }, { W / 2 - 120, 250 }, { W / 2, 350 } }
  local L = { "A", "B", "Y", "X" }
  for i = 1, 4 do
    local lit = g.lit == i and g.litT > 0
    local sh = img("assets/spr/shell" .. (i - 1) .. ".png")
    love.graphics.setColor(RYT_COL[i][1], RYT_COL[i][2], RYT_COL[i][3], lit and 1 or 0.55); love.graphics.circle("fill", P[i][1], P[i][2], lit and 52 or 44)
    if sh then local k = 60 / sh:getWidth(); love.graphics.setColor(1, 1, 1); love.graphics.draw(sh, P[i][1], P[i][2], 0, k, k, sh:getWidth() / 2, sh:getHeight() / 2) end
    love.graphics.setColor(1, 1, 1); love.graphics.setFont(fonts.b); love.graphics.printf(L[i], P[i][1] - 20, P[i][2] + 26, 40, "center")
  end
  love.graphics.setFont(fonts.s); love.graphics.setColor(PURPLE); love.graphics.printf("Série : " .. #g.seq .. " / 8      B : quitter", 0, H - 26, W, "center")
end

local function drawPiano()
  local g = pianoG
  local bg = img("assets/piano/bg.jpg")
  love.graphics.setColor(1, 1, 1)
  if bg then love.graphics.draw(bg, 0, 0, 0, W / bg:getWidth(), H / bg:getHeight()) else love.graphics.clear(0.8, 0.78, 0.95) end
  local LX = { 220, 293, 366, 439 }
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
        love.graphics.rectangle("fill", LX[n.l] - 9, yE, 18, math.max(0, yh - yE), 8)
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

local function drawTitle()
  local bg = img("assets/load/bg.jpg")
  love.graphics.setColor(1, 1, 1); if bg then love.graphics.draw(bg, 0, 0, 0, W / bg:getWidth(), H / bg:getHeight()) else love.graphics.clear(0.75, 0.7, 0.92) end
  local sw = img("assets/load/sw" .. ({ 0, 1, 2, 1 })[math.floor(love.timer.getTime() * 6) % 4 + 1] .. ".png")
  if sw then love.graphics.draw(sw, W / 2 - 80, 50 + math.sin(love.timer.getTime()) * 8, 0, 160 / sw:getWidth(), 160 / sw:getWidth()) end
  love.graphics.setFont(fonts.l); love.graphics.setColor(PURPLE); love.graphics.printf("Swaalia", 0, 190, W, "center")
  love.graphics.setFont(fonts.m); love.graphics.printf("L'Île du Cygne", 0, 228, W, "center")
  for i = 1, 4 do
    local s0 = slots[i]
    local t = s0 and (i .. ".  " .. (s0.name or "Myah") .. "   -   " .. (s0.plumes or 0) .. "/5 plumes") or (i .. ".  Nouvelle partie")
    love.graphics.setColor(1, 0.97, 0.9, i == titleSel and 0.95 or 0.6); love.graphics.rectangle("fill", W / 2 - 160, 266 + (i - 1) * 46, 320, 36, 18)
    if i == titleSel then love.graphics.setColor(0.6, 0.45, 0.75); love.graphics.setLineWidth(3); love.graphics.rectangle("line", W / 2 - 160, 266 + (i - 1) * 46, 320, 36, 18); love.graphics.setLineWidth(1) end
    love.graphics.setColor(PURPLE); love.graphics.printf(t, W / 2 - 150, 275 + (i - 1) * 46, 300, "left")
  end
end

local function drawName()
  love.graphics.clear(0.86, 0.82, 0.95); local g = nameG
  love.graphics.setFont(fonts.m); love.graphics.setColor(PURPLE); love.graphics.printf("Comment t'appelles-tu ?", 0, 30, W, "center")
  panel(140, 66, 360, 44); love.graphics.setFont(fonts.l); love.graphics.setColor(PURPLE); love.graphics.printf(g.txt .. (math.floor(love.timer.getTime() * 2) % 2 == 0 and "_" or " "), 140, 70, 360, "center")
  love.graphics.setFont(fonts.m)
  for r = 1, 4 do
    local chars = utf8chars(KB[r])
    for c = 1, 10 do
      local x, y = 95 + (c - 1) * 46, 140 + (r - 1) * 50
      local sel = g.r == r and g.c == c
      love.graphics.setColor(sel and { 0.62, 0.48, 0.78 } or { 1, 0.97, 0.9 }); love.graphics.rectangle("fill", x, y, 40, 40, 10)
      love.graphics.setColor(sel and { 1, 1, 1 } or PURPLE); love.graphics.printf(chars[c] or "", x, y + 10, 40, "center")
    end
  end
  for c = 1, 2 do
    local sel = g.r == 5 and ((c == 1 and g.c <= 5) or (c == 2 and g.c > 5))
    local x = c == 1 and 95 or 325
    love.graphics.setColor(sel and { 0.62, 0.48, 0.78 } or { 1, 0.97, 0.9 }); love.graphics.rectangle("fill", x, 345, 220, 42, 12)
    love.graphics.setColor(sel and { 1, 1, 1 } or PURPLE); love.graphics.printf(c == 1 and "Effacer" or "C'est parti !", x, 357, 220, "center")
  end
  love.graphics.setFont(fonts.s); love.graphics.setColor(PURPLE); love.graphics.printf("Flèches : choisir    A : écrire    B : effacer    START : valider", 0, H - 30, W, "center")
end

function love.draw()
  love.graphics.setFont(fonts.m)
  if scene == "title" then drawTitle()
  elseif scene == "name" then drawName()
  elseif scene == "memory" then drawMemory()
  elseif scene == "piano" then drawPiano()
  elseif scene == "rythme" then drawRythme()
  else
    if place then drawInside() else drawWorld() end
    drawHud()
    if scene == "dialog" then drawDialog()
    elseif scene == "bag" then drawBag()
    elseif scene == "help" then drawHelp()
    elseif scene == "fight" then drawFight()
    elseif scene == "menu" then drawMenu("Menu", { "Reprendre", "Mini-jeux", "Sauvegarder", "Sauvegarder et quitter" })
    elseif scene == "games" then drawMenu("Mini-jeux", { "Memory", "Coquillages chantants", "Piano des koalas" })
    elseif scene == "songs" then drawMenu("Quel morceau ?", { "Berceuse (facile)", "Danse des koalas", "Fête des lucioles" })
    elseif scene == "ending" then
      panel(80, 120, W - 160, 220); love.graphics.setFont(fonts.l); love.graphics.setColor(PURPLE); love.graphics.printf("Les 5 plumes !", 80, 140, W - 160, "center")
      love.graphics.setFont(fonts.m); love.graphics.printf("Gaïkin revient sur l'île du Cygne. L'eau du lac redevient claire, les papillons dansent et toute l'île fait la fête. Merci, Myah !", 100, 190, W - 200, "center")
      love.graphics.setFont(fonts.s); love.graphics.printf("A pour continuer à te promener", 80, 310, W - 160, "center")
    end
  end
  if fade.a > 0 then love.graphics.setColor(0, 0, 0, fade.a); love.graphics.rectangle("fill", 0, 0, W, H) end
end

-- les erreurs : on les montre (et on les écrit dans erreur.txt) au lieu de fermer le jeu
local errMsg
local up0, dr0 = love.update, love.draw
love.update = function(dt) if errMsg then return end local ok, e = xpcall(up0, debug.traceback, dt); if not ok then errMsg = e; pcall(love.filesystem.write, "erreur.txt", e) end end
love.draw = function() if errMsg then love.graphics.clear(.2, .1, .3); love.graphics.setColor(1, 1, 1); love.graphics.printf("Oups ! Prends cet écran en photo :\n\n" .. errMsg, 10, 10, W - 20); return end local ok, e = xpcall(dr0, debug.traceback); if not ok then errMsg = e; pcall(love.filesystem.write, "erreur.txt", e) end end
_G.__T = function() return { scene = scene, place = place, player = player, S = S, fishG = fishG, setPlace = function(p) place = p end, setScene = function(s) scene = s end, setFight = function() end } end   -- pour les tests
