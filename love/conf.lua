-- Swaalia pour la R36S (écran 640x480)
function love.conf(t)
  t.identity = "swaalia"
  t.window.title = "Swaalia - L'Île du Cygne"
  t.window.width = 640
  t.window.height = 480
  t.window.fullscreen = false
  t.modules.physics = false
  t.modules.video = false
end
