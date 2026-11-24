-- Swaalia - L'Île du Cygne : version LÖVE2D pour la console R36S
-- Étape 1 : l'île, Myah qui se promène, la caméra et toutes les touches de la console.
--
-- Touches de la R36S (manette SDL) :
--   A (rouge)  = parler / prendre        B (jaune) = courir (en le gardant appuyé)
--   Y (vert)   = sac à dos               X (bleu)  = outil suivant
--   START      = pause / menu            SELECT    = aide des touches
--   L1 / R1    = zoom moins / plus       flèches et joystick gauche = marcher
--   joystick droit = regarder autour
-- Au clavier (pour tester sur PC) : flèches, Entrée=A, Maj=B, Y, X, Échap=START, Tab=SELECT, Q/E=L1/R1

local W, H = 640, 480
local WORLD_W, WORLD_H, CELL, GW, GH = 917, 512, 4, 229, 128
local MAP, MYAH, walkMask, names
local frameIndex = {}
local player = { x = 427, y = 305, dir = "down", moving = false, t = 0 }
local cam = { x = 0, y = 0, zoom = 2.0, lookX = 0, lookY = 0 }
local state = "title"         -- title / play / pause
local showHelp = false
local toast, toastT = nil, 0
local TOOLS = { "Panier", "Filet", "Canne", "Voler" }
local tool = 1
local pad
local font, bigFont

-- les couleurs des boutons de la console (pour l'aide à l'écran)
local BTN = { a = { 0.88, 0.3, 0.3 }, b = { 0.95, 0.8, 0.25 }, y = { 0.35, 0.75, 0.4 }, x = { 0.35, 0.55, 0.9 } }

local function say(t) toast, toastT = t, 2.5 end

local function walkable(x, y)
  local cx, cy = math.floor(x / CELL), math.floor(y / CELL)
  if cx < 0 or cy < 0 or cx >= GW or cy >= GH then return false end
  return walkMask:byte(cy * GW + cx + 1) == 1
end

function love.load()
  love.graphics.setDefaultFilter("linear", "linear")
  MAP = love.graphics.newImage("assets/map.jpg")
  MYAH = love.graphics.newImage("assets/walk8.png")
  walkMask = love.filesystem.read("assets/walk.bin")
  names = love.filesystem.load("assets/walk_names.lua")()
  for i, n in ipairs(names) do frameIndex[n] = i - 1 end
  font = love.graphics.newFont(14); bigFont = love.graphics.newFont(28)
  local js = love.joystick.getJoysticks(); pad = js[1]
end

function love.joystickadded(j) pad = j end

-- ---------- entrées ----------
local function axis(name)
  if not pad or not pad:isGamepad() then return 0 end
  local v = pad:getGamepadAxis(name); if math.abs(v) < 0.2 then return 0 end; return v
end
local function down(btn, key)
  if pad and pad:isGamepad() and pad:isGamepadDown(btn) then return true end
  return key and love.keyboard.isDown(key) or false
end

local function press(b)
  if state == "title" then if b == "start" or b == "a" then state = "play"; say("Bienvenue sur l'île du Cygne !") end; return end
  if b == "start" then state = (state == "pause") and "play" or "pause"; return end
  if state == "pause" then if b == "a" then state = "play" end; return end
  if b == "back" then showHelp = not showHelp
  elseif b == "a" then say("Il n'y a personne ici… (bientôt : parler et ramasser)")
  elseif b == "y" then say("Sac à dos : bientôt disponible")
  elseif b == "x" then tool = tool % #TOOLS + 1; say("Outil : " .. TOOLS[tool])
  elseif b == "leftshoulder" then cam.zoom = math.max(1.2, cam.zoom - 0.25)
  elseif b == "rightshoulder" then cam.zoom = math.min(3.2, cam.zoom + 0.25) end
end
function love.gamepadpressed(j, b) press(b) end
local KEYS = { ["return"] = "a", lshift = "b", y = "y", x = "x", escape = "start", tab = "back", q = "leftshoulder", e = "rightshoulder" }
function love.keypressed(k) if KEYS[k] then press(KEYS[k]) end end

-- ---------- jeu ----------
function love.update(dt)
  if toastT > 0 then toastT = toastT - dt end
  if state ~= "play" then return end
  local dx = axis("leftx"); local dy = axis("lefty")
  if down("dpleft", "left") then dx = -1 end; if down("dpright", "right") then dx = 1 end
  if down("dpup", "up") then dy = -1 end; if down("dpdown", "down") then dy = 1 end
  local len = math.sqrt(dx * dx + dy * dy)
  player.moving = len > 0.1
  if player.moving then
    dx, dy = dx / math.max(1, len), dy / math.max(1, len)
    local sp = (down("b", "lshift") and 95 or 55) * dt
    local nx, ny = player.x + dx * sp, player.y + dy * sp
    if walkable(nx, ny) then player.x, player.y = nx, ny
    elseif walkable(nx, player.y) then player.x = nx
    elseif walkable(player.x, ny) then player.y = ny end
    if math.abs(dx) > 0.35 and math.abs(dy) > 0.35 and dy > 0 then player.dir = dx > 0 and "dr" or "dl"
    elseif math.abs(dx) > math.abs(dy) then player.dir = dx > 0 and "right" or "left"
    else player.dir = dy > 0 and "down" or "up" end
    player.t = player.t + dt * (down("b", "lshift") and 1.7 or 1)
  end
  -- joystick droit : regarder autour
  cam.lookX = cam.lookX + (axis("rightx") * 90 - cam.lookX) * math.min(1, dt * 6)
  cam.lookY = cam.lookY + (axis("righty") * 70 - cam.lookY) * math.min(1, dt * 6)
  local z = cam.zoom
  local tx = player.x + cam.lookX / z - W / (2 * z)
  local ty = player.y - 20 + cam.lookY / z - H / (2 * z)
  tx = math.max(0, math.min(WORLD_W - W / z, tx)); ty = math.max(0, math.min(WORLD_H - H / z, ty))
  cam.x = cam.x + (tx - cam.x) * math.min(1, dt * 8); cam.y = cam.y + (ty - cam.y) * math.min(1, dt * 8)
end

local function drawMyah()
  local n = player.dir .. (player.moving and (math.floor(player.t * 10) % 8 + 1) or 1)
  local i = frameIndex[n] or frameIndex["down1"]
  local sx, sy = (i % 8) * 256, math.floor(i / 8) * 256
  local q = love.graphics.newQuad(sx, sy, 256, 256, MYAH:getDimensions())
  local s = 0.2   -- taille de Myah dans le monde
  love.graphics.setColor(0, 0, 0, 0.2); love.graphics.ellipse("fill", player.x, player.y, 11, 3)
  love.graphics.setColor(1, 1, 1); love.graphics.draw(MYAH, q, player.x - 128 * s, player.y - 212 * s, 0, s, s)
end

local function button(x, y, c, label, txt)
  love.graphics.setColor(c); love.graphics.circle("fill", x, y, 10)
  love.graphics.setColor(1, 1, 1); love.graphics.printf(label, x - 10, y - 8, 20, "center")
  love.graphics.setColor(0.2, 0.1, 0.3); love.graphics.print(txt, x + 16, y - 8)
end

function love.draw()
  love.graphics.setFont(font)
  if state == "title" then
    love.graphics.clear(0.75, 0.7, 0.92)
    love.graphics.setColor(0.29, 0.16, 0.48); love.graphics.setFont(bigFont)
    love.graphics.printf("Swaalia", 0, 160, W, "center"); love.graphics.setFont(font)
    love.graphics.printf("L'Île du Cygne", 0, 200, W, "center")
    if math.floor(love.timer.getTime() * 2) % 2 == 0 then love.graphics.printf("Appuie sur START", 0, 300, W, "center") end
    return
  end
  love.graphics.push(); love.graphics.scale(cam.zoom); love.graphics.translate(-cam.x, -cam.y)
  love.graphics.setColor(1, 1, 1); love.graphics.draw(MAP, 0, 0, 0, WORLD_W / MAP:getWidth(), WORLD_H / MAP:getHeight())
  drawMyah()
  love.graphics.pop()
  -- l'outil en bas à droite
  love.graphics.setColor(1, 0.97, 0.9, 0.9); love.graphics.rectangle("fill", W - 112, H - 34, 104, 26, 13)
  love.graphics.setColor(0.29, 0.16, 0.48); love.graphics.printf(TOOLS[tool], W - 112, H - 29, 104, "center")
  if toastT > 0 and toast then
    love.graphics.setColor(1, 0.97, 0.9, 0.95); love.graphics.rectangle("fill", 60, 14, W - 120, 32, 16)
    love.graphics.setColor(0.29, 0.16, 0.48); love.graphics.printf(toast, 60, 22, W - 120, "center")
  end
  if showHelp or state == "pause" then
    love.graphics.setColor(1, 0.97, 0.9, 0.95); love.graphics.rectangle("fill", 120, 90, 400, 300, 18)
    love.graphics.setColor(0.29, 0.16, 0.48); love.graphics.printf(state == "pause" and "Pause" or "Les touches", 120, 104, 400, "center")
    button(160, 150, BTN.a, "A", "Parler / prendre"); button(160, 180, BTN.b, "B", "Courir (garder appuyé)")
    button(160, 210, BTN.y, "Y", "Sac à dos"); button(160, 240, BTN.x, "X", "Changer d'outil")
    love.graphics.setColor(0.2, 0.1, 0.3)
    love.graphics.print("L1 / R1 : zoom      Joystick droit : regarder", 150, 275)
    love.graphics.print("START : pause      SELECT : cette aide", 150, 300)
    if state == "pause" then love.graphics.printf("A ou START pour reprendre", 120, 350, 400, "center") end
  end
end
