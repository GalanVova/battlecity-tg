// ═══════════════════════════════════════════════════════════
//  MultiplayerLobby — экран создания/входа в комнату
//  Показывается вместо главного меню когда открыт через Telegram
// ═══════════════════════════════════════════════════════════

function MultiplayerLobby(sceneManager, ws) {
  this._sceneManager = sceneManager;
  this._eventManager = sceneManager.getEventManager();
  this._ws           = ws;
  this._state        = 'CHOOSE';   // CHOOSE | ENTER_CODE | WAITING | SELECTING_TANK
  this._role         = null;       // 'p1' | 'p2'
  this._code         = '';
  this._inputCode    = '';
  this._error        = '';
  this._errorTimer   = 0;
  this._p1Lvl        = 3;          // Armor по умолчанию
  this._p2Lvl        = 3;
  this._blinkTimer   = 0;
  this._blinkOn      = true;
  this._levelNames   = ['BASE','SPEED','POWER','ARMOR'];
  this._levelDescs   = [
    '1 пуля  •  обычная скорость',
    '1 пуля  •  быстрые пули',
    '2 пули  •  быстрые пули',
    '2 пули  •  пробивает сталь',
  ];
  this._tankSelectPhase = false;  // показываем выбор танка?
  this._waitingForP2   = false;   // P1 ждёт второго

  // Слушаем сообщения сервера
  var self = this;
  this._ws.onmessage = function(e) { self._onServerMsg(JSON.parse(e.data)); };
  this._ws.onclose   = function()  { self._error = 'Нет связи с сервером'; };

  // Тач-клавиши для ввода кода (цифры и буквы)
  this._codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  this._charIdx   = 0;

  this._eventManager.addSubscriber(this, [Keyboard.Event.KEY_PRESSED]);
}

MultiplayerLobby.prototype.notify = function(event) {
  if (event.name !== Keyboard.Event.KEY_PRESSED) return;
  this._onKey(event.key);
};

MultiplayerLobby.prototype._onKey = function(key) {
  var K = Keyboard.Key;
  // Выбор уровня танка
  if (this._tankSelectPhase) {
    if (key === K.UP || key === K.LEFT)    this._myLvl = (this._myLvl + 3) % 4;
    if (key === K.DOWN || key === K.RIGHT) this._myLvl = (this._myLvl + 1) % 4;
    if (key === 32 || key === K.START) {   // SPACE / ENTER
      if (this._role === 'p1') this._p1Lvl = this._myLvl;
      else                     this._p2Lvl = this._myLvl;
      this._ws.send(JSON.stringify({ type: 'READY' }));
      this._tankSelectPhase = false;
      this._state = 'WAITING';
    }
    return;
  }

  if (this._state === 'CHOOSE') {
    if (key === K.UP || key === K.DOWN) {} // ничего
    if (key === 32 || key === K.START) {   // SPACE = создать
      this._createRoom();
    }
    if (key === K.SELECT) {                // CTRL = войти
      this._state = 'ENTER_CODE';
      this._inputCode = '';
    }
  } else if (this._state === 'ENTER_CODE') {
    // Стрелки листают символы
    if (key === K.RIGHT) this._charIdx = (this._charIdx + 1) % this._codeChars.length;
    if (key === K.LEFT)  this._charIdx = (this._charIdx + this._codeChars.length - 1) % this._codeChars.length;
    if (key === K.DOWN && this._inputCode.length < 4) {
      this._inputCode += this._codeChars[this._charIdx];
      this._charIdx = 0;
    }
    if (key === K.UP && this._inputCode.length > 0) {
      this._inputCode = this._inputCode.slice(0, -1);
    }
    if ((key === 32 || key === K.START) && this._inputCode.length === 4) {
      this._joinRoom(this._inputCode);
    }
    if (key === K.SELECT) { this._state = 'CHOOSE'; this._inputCode = ''; }
  }
};

MultiplayerLobby.prototype._createRoom = function() {
  this._role = 'p1';
  this._myLvl = this._p1Lvl;
  this._ws.send(JSON.stringify({ type: 'CREATE_ROOM', p1Lvl: this._p1Lvl }));
  this._state = 'WAITING';
};

MultiplayerLobby.prototype._joinRoom = function(code) {
  this._role = 'p2';
  this._myLvl = this._p2Lvl;
  this._ws.send(JSON.stringify({ type: 'JOIN_ROOM', code: code, p2Lvl: this._p2Lvl }));
};

MultiplayerLobby.prototype._onServerMsg = function(msg) {
  switch (msg.type) {
    case 'ROOM_CREATED':
      this._code = msg.code;
      this._state = 'WAITING';
      this._tankSelectPhase = true;
      // P1: тач применяется локально
      this._initTouchAndSync('p1');
      break;
    case 'ROOM_JOINED':
      this._code = msg.code;
      this._p1Lvl = msg.p1Lvl;
      this._state = 'WAITING';
      this._tankSelectPhase = true;
      // P2: тач только отправляет на сервер, не двигает локальные танки
      this._initTouchAndSync('p2');
      break;
    case 'PLAYER2_JOINED':
      this._p2Lvl = msg.p2Lvl;
      break;
    case 'START_GAME':
      TankPowerSelectScene.chosenUpgradeLevel  = msg.p1Lvl;
      TankPowerSelectScene.chosenUpgradeLevel2 = msg.p2Lvl;
      TankPowerSelectScene.twoPlayers = true;
      TankPowerSelectScene.multiplayerRole = this._role;
      TankPowerSelectScene.ws = this._ws;
      // Только P1-хост запускает игровую сцену (у него вся логика)
      // P2-клиент тоже запускает — но его танки управляются через сеть
      this._sceneManager.toGameScene();
      break;
    case 'ERROR':
      this._error = msg.text;
      this._errorTimer = 120;
      break;
    case 'OPPONENT_LEFT':
      this._error = 'Соперник вышел из игры';
      this._errorTimer = 999;
      this._state = 'CHOOSE';
      break;
  }
};

MultiplayerLobby.prototype.update = function() {
  this._blinkTimer++;
  if (this._blinkTimer % 25 === 0) this._blinkOn = !this._blinkOn;
  if (this._errorTimer > 0) this._errorTimer--;
};

MultiplayerLobby.prototype.draw = function(ctx) {
  var W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  // Логотип
  try {
    var logo = ImageManager.getImage('battle_city');
    if (logo && logo.complete) ctx.drawImage(logo, W/2 - logo.width/2, 20);
  } catch(e) {}

  ctx.fillStyle = '#f8b800';
  ctx.font = '14px prstart';
  ctx.fillText('MULTIPLAYER', W/2, 90);

  // ── Выбор танка ────────────────────────────────────────
  if (this._tankSelectPhase) {
    this._drawTankSelect(ctx, W, H);
    return;
  }

  // ── Ожидание ────────────────────────────────────────────
  if (this._state === 'WAITING') {
    ctx.fillStyle = '#fff'; ctx.font = '11px prstart';
    if (this._role === 'p1') {
      ctx.fillText('Ожидание игрока 2...', W/2, 130);
      ctx.fillStyle = '#f8b800'; ctx.font = '18px prstart';
      ctx.fillText('Код комнаты:', W/2, 168);
      ctx.fillStyle = '#fff'; ctx.font = '36px prstart';
      ctx.fillText(this._code, W/2, 215);
      ctx.fillStyle = '#888'; ctx.font = '9px prstart';
      ctx.fillText('Скажи этот код жене', W/2, 245);
    } else {
      ctx.fillText('Подключение...', W/2, 160);
    }
    // Анимация точек
    if (this._blinkOn) {
      ctx.fillStyle = '#555';
      ctx.fillText('● ● ●', W/2, H - 60);
    }
    return;
  }

  // ── Выбор: создать или войти ─────────────────────────────
  if (this._state === 'CHOOSE') {
    ctx.fillStyle = '#aaa'; ctx.font = '10px prstart';
    ctx.fillText('Выбери действие:', W/2, 120);

    // Кнопка СОЗДАТЬ
    ctx.strokeStyle = '#f8b800'; ctx.lineWidth = 2;
    ctx.strokeRect(W/2 - 130, 140, 260, 44);
    ctx.fillStyle = '#f8b800'; ctx.font = '13px prstart';
    ctx.fillText('СОЗДАТЬ КОМНАТУ', W/2, 168);
    ctx.fillStyle = '#555'; ctx.font = '8px prstart';
    ctx.fillText('(SPACE / кнопка)', W/2, 182);

    // Кнопка ВОЙТИ
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 2;
    ctx.strokeRect(W/2 - 130, 200, 260, 44);
    ctx.fillStyle = '#aaa'; ctx.font = '13px prstart';
    ctx.fillText('ВВЕСТИ КОД', W/2, 228);
    ctx.fillStyle = '#555'; ctx.font = '8px prstart';
    ctx.fillText('(CTRL / кнопка)', W/2, 242);
  }

  // ── Ввод кода ───────────────────────────────────────────
  if (this._state === 'ENTER_CODE') {
    ctx.fillStyle = '#fff'; ctx.font = '11px prstart';
    ctx.fillText('Введи код комнаты:', W/2, 125);

    // Введённые символы
    ctx.fillStyle = '#f8b800'; ctx.font = '28px prstart';
    var display = this._inputCode + (this._inputCode.length < 4 ? '_' : '');
    ctx.fillText(display, W/2, 170);

    // Текущий символ для выбора
    if (this._inputCode.length < 4) {
      ctx.fillStyle = '#aaa'; ctx.font = '10px prstart';
      ctx.fillText('← → выбор символа', W/2, 200);
      ctx.fillStyle = '#fff'; ctx.font = '16px prstart';
      ctx.fillText('[ ' + this._codeChars[this._charIdx] + ' ]', W/2, 222);
      ctx.fillStyle = '#555'; ctx.font = '9px prstart';
      ctx.fillText('↓ добавить  ↑ удалить', W/2, 242);
    }

    if (this._inputCode.length === 4 && this._blinkOn) {
      ctx.fillStyle = '#0f0'; ctx.font = '10px prstart';
      ctx.fillText('SPACE — подтвердить', W/2, 240);
    }

    ctx.fillStyle = '#555'; ctx.font = '9px prstart';
    ctx.fillText('CTRL — назад', W/2, 262);
  }

  // Ошибка
  if (this._errorTimer > 0) {
    ctx.fillStyle = '#f00'; ctx.font = '10px prstart';
    ctx.fillText(this._error, W/2, H - 40);
  }
};

MultiplayerLobby.prototype._drawTankSelect = function(ctx, W, H) {
  var myLvl = this._myLvl || 0;
  var isP2 = this._role === 'p2';

  ctx.fillStyle = isP2 ? '#00c8f8' : '#f8b800';
  ctx.font = '12px prstart';
  ctx.fillText(isP2 ? 'ИГРОК 2 — выбери танк' : 'ИГРОК 1 — выбери танк', W/2, 100);

  // 4 варианта вертикально
  for (var i = 0; i < 4; i++) {
    var by = 120 + i * 60;
    var isSelected = (i === myLvl);
    ctx.strokeStyle = isSelected ? (isP2 ? '#00c8f8' : '#f8b800') : '#333';
    ctx.lineWidth = isSelected ? 3 : 1;
    ctx.strokeRect(W/2 - 150, by, 300, 50);
    if (isSelected) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(W/2 - 149, by+1, 298, 48);
    }
    ctx.fillStyle = isSelected ? '#fff' : '#666';
    ctx.font = '10px prstart';
    ctx.textAlign = 'left';
    ctx.fillText('LV' + i + '  ' + this._levelNames[i], W/2 - 138, by + 18);
    ctx.fillStyle = '#555'; ctx.font = '8px prstart';
    ctx.fillText(this._levelDescs[i], W/2 - 138, by + 36);
    ctx.textAlign = 'center';
    if (isSelected && this._blinkOn) {
      ctx.fillStyle = isP2 ? '#00c8f8' : '#f8b800';
      ctx.fillText('▶', W/2 - 160, by + 28);
    }
  }

  ctx.fillStyle = '#aaa'; ctx.font = '9px prstart';
  ctx.fillText('↑↓ выбор  •  SPACE подтвердить', W/2, H - 30);
};
