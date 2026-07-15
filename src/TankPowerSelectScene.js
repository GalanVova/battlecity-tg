// TankPowerSelectScene — выбор мощности для 1 или 2 игроков
// Уровни как в оригинале Battle City:
//   0 — Base   (обычно)
//   1 — Speed  (быстрые пули)
//   2 — Power  (2 пули)
//   3 — Armor  (пробивает сталь)

function TankPowerSelectScene(sceneManager) {
  this._sceneManager = sceneManager;
  this._eventManager = sceneManager.getEventManager();
  this._eventManager.addSubscriber(this, [Keyboard.Event.KEY_PRESSED]);

  // Фаза: 'p1' = выбираем P1, 'p2' = выбираем P2
  this._phase = 'p1';
  this._p1Level = 0;
  this._p2Level = 0;

  this._blinkTimer = 0;
  this._blinkVisible = true;

  this._levelNames = ['BASE', 'SPEED', 'POWER', 'ARMOR'];
  this._levelDescs = [
    ['1 bullet', 'Normal speed', 'Normal ammo'],
    ['1 bullet', 'Fast bullets', 'Normal ammo'],
    ['2 bullets', 'Fast bullets', 'Normal ammo'],
    ['2 bullets', 'Fast bullets', 'Steel pierce'],
  ];
}

// Глобальные переменные, читаются в PlayerTankFactory и Level
TankPowerSelectScene.chosenUpgradeLevel  = 0;
TankPowerSelectScene.chosenUpgradeLevel2 = 0;
TankPowerSelectScene.twoPlayers = false;

TankPowerSelectScene.prototype.notify = function (event) {
  if (event.name !== Keyboard.Event.KEY_PRESSED) return;
  var key = event.key;

  var UP    = Keyboard.Key.UP,    DOWN  = Keyboard.Key.DOWN;
  var LEFT  = Keyboard.Key.LEFT,  RIGHT = Keyboard.Key.RIGHT;
  var FIRE1 = 32,  FIRE2 = Keyboard.Key.START; // SPACE / ENTER

  if (key === UP || key === LEFT) {
    if (this._phase === 'p1') this._p1Level = (this._p1Level + 3) % 4;
    else                      this._p2Level = (this._p2Level + 3) % 4;
  } else if (key === DOWN || key === RIGHT) {
    if (this._phase === 'p1') this._p1Level = (this._p1Level + 1) % 4;
    else                      this._p2Level = (this._p2Level + 1) % 4;
  } else if (key === FIRE1 || key === FIRE2) {
    if (this._phase === 'p1' && TankPowerSelectScene.twoPlayers) {
      // Перейти к выбору P2
      this._phase = 'p2';
    } else {
      // Стартуем
      TankPowerSelectScene.chosenUpgradeLevel  = this._p1Level;
      TankPowerSelectScene.chosenUpgradeLevel2 = this._p2Level;
      this._sceneManager.toGameScene();
    }
  }
};

TankPowerSelectScene.prototype.update = function () {
  this._blinkTimer++;
  if (this._blinkTimer % 20 === 0) this._blinkVisible = !this._blinkVisible;
};

TankPowerSelectScene.prototype.draw = function (ctx) {
  var W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  ctx.font = '16px prstart';
  ctx.textAlign = 'center';

  var isP2Phase = (this._phase === 'p2');
  var title = isP2Phase ? 'PLAYER 2 TANK' : 'PLAYER 1 TANK';
  ctx.fillStyle = isP2Phase ? '#00c8f8' : '#f8b800';
  ctx.fillText('SELECT ' + title, W / 2, 50);

  ctx.fillStyle = '#aaa';
  ctx.font = '10px prstart';
  ctx.fillText(isP2Phase ? 'WASD + E to shoot' : 'ARROWS + SPACE to shoot', W / 2, 72);

  // 4 варианта — 2x2 сетка
  var boxW = 175, boxH = 110;
  var gapX = 30, gapY = 20;
  var gridW = 2 * boxW + gapX;
  var startX = Math.floor(W / 2 - gridW / 2);
  var startY = 95;

  var currentLevel = isP2Phase ? this._p2Level : this._p1Level;
  var activeColor  = isP2Phase ? '#00c8f8' : '#f8b800';

  for (var i = 0; i < 4; i++) {
    var col = i % 2, row = Math.floor(i / 2);
    var bx = startX + col * (boxW + gapX);
    var by = startY + row * (boxH + gapY);
    var isSelected = (i === currentLevel);

    // Рамка
    ctx.strokeStyle = isSelected ? activeColor : '#444';
    ctx.lineWidth = isSelected ? 3 : 1;
    ctx.strokeRect(bx, by, boxW, boxH);

    // Фон выбранного
    if (isSelected) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(bx + 1, by + 1, boxW - 2, boxH - 2);
    }

    // Спрайт танка
    this._drawTankSprite(ctx, bx + 16, by + 14, i, isP2Phase);

    // Название уровня
    ctx.fillStyle = isSelected ? activeColor : '#888';
    ctx.font = '10px prstart';
    ctx.textAlign = 'left';
    ctx.fillText('LV' + i + ' ' + this._levelNames[i], bx + 8, by + boxH - 16);

    // Курсор
    if (isSelected && this._blinkVisible) {
      ctx.fillStyle = activeColor;
      ctx.fillText('>', bx - 14, by + boxH - 16);
    }
  }

  // Описание выбранного уровня
  var desc = this._levelDescs[currentLevel];
  ctx.textAlign = 'center';
  var dy = startY + 2 * (boxH + gapY) + 14;
  ctx.fillStyle = '#fff';
  ctx.font = '10px prstart';
  for (var d = 0; d < desc.length; d++) {
    ctx.fillText(desc[d], W / 2, dy + d * 18);
  }

  // Если 2 игрока — показываем уже выбранный P1
  if (TankPowerSelectScene.twoPlayers && !isP2Phase) {
    ctx.fillStyle = '#555';
    ctx.font = '9px prstart';
    ctx.fillText('P2 selects next  (SPACE/ENTER)', W / 2, H - 40);
  } else if (TankPowerSelectScene.twoPlayers && isP2Phase) {
    ctx.fillStyle = '#f8b800';
    ctx.font = '9px prstart';
    ctx.fillText('P1 level: ' + this._levelNames[this._p1Level], W / 2, H - 55);
    ctx.fillStyle = '#555';
    ctx.fillText('SPACE/ENTER to start', W / 2, H - 38);
  } else {
    if (this._blinkVisible) {
      ctx.fillStyle = '#fff';
      ctx.font = '10px prstart';
      ctx.fillText('SPACE / ENTER to start', W / 2, H - 38);
    }
  }
};

TankPowerSelectScene.prototype._drawTankSprite = function (ctx, x, y, upgradeLevel, isP2) {
  // Пробуем взять оригинальный спрайт из ImageManager
  var suffix = ['', '_s1', '_s2', '_s3'][upgradeLevel];
  var imgKey = 'tank_player1_up_c0_t1' + suffix;
  try {
    var img = ImageManager.getImage(imgKey);
    if (img && img.complete && img.width > 0) {
      var scale = 2.5;
      // P2 — рисуем с синеватым оттенком через temporary canvas
      if (isP2) {
        var tmp = document.createElement('canvas');
        tmp.width = img.width; tmp.height = img.height;
        var tc = tmp.getContext('2d');
        tc.drawImage(img, 0, 0);
        tc.globalCompositeOperation = 'source-atop';
        tc.fillStyle = 'rgba(0, 120, 255, 0.45)';
        tc.fillRect(0, 0, img.width, img.height);
        ctx.drawImage(tmp, x, y, Math.floor(img.width * scale), Math.floor(img.height * scale));
      } else {
        ctx.drawImage(img, x, y, Math.floor(img.width * scale), Math.floor(img.height * scale));
      }
      return;
    }
  } catch(e) {}

  // Fallback — примитивный танк
  var color = isP2 ? '#00c8f8' : '#f8b800';
  ctx.fillStyle = color;
  ctx.fillRect(x + 8, y, 14, 36);
  ctx.fillRect(x, y + 8, 30, 18);
  ctx.fillRect(x + 11, y - 8, 8, 14);
  if (upgradeLevel >= 2) { // 2 ствола
    ctx.fillRect(x + 5, y - 5, 5, 10);
    ctx.fillRect(x + 20, y - 5, 5, 10);
  }
};
