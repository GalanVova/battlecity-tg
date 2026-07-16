// MultiplayerLobby — создание комнаты и вход по коду.
function MultiplayerLobby(sceneManager, ws) {
  this._sceneManager = sceneManager;
  this._eventManager = sceneManager.getEventManager();
  this._ws = ws;
  this._state = 'CHOOSE'; // CHOOSE | ENTER_CODE | WAITING | SELECT_TANK
  this._role = null;
  this._code = '';
  this._inputCode = '';
  this._chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  this._charIdx = 0;
  this._myLvl = 0;
  this._error = '';
  this._blink = 0;
  this._otherJoined = false;

  var self = this;
  ws.onmessage = function (e) {
    var msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    self._onServerMsg(msg);
  };
  ws.onclose = function () {
    self._error = 'Связь с сервером потеряна';
  };

  this._eventManager.addSubscriber(this, [Keyboard.Event.KEY_PRESSED]);
}

MultiplayerLobby.prototype.notify = function (event) {
  if (event.name === Keyboard.Event.KEY_PRESSED) this._onKey(event.key);
};

MultiplayerLobby.prototype._onKey = function (key) {
  var K = Keyboard.Key;

  if (this._state === 'CHOOSE') {
    if (key === K.START || key === K.SPACE) this._createRoom();
    else if (key === K.SELECT || key === K.DOWN || key === K.RIGHT) {
      this._state = 'ENTER_CODE';
      this._inputCode = '';
    }
    return;
  }

  if (this._state === 'ENTER_CODE') {
    if (key === K.RIGHT) this._charIdx = (this._charIdx + 1) % this._chars.length;
    else if (key === K.LEFT) this._charIdx = (this._charIdx + this._chars.length - 1) % this._chars.length;
    else if (key === K.DOWN && this._inputCode.length < 4) {
      this._inputCode += this._chars[this._charIdx];
    }
    else if (key === K.UP && this._inputCode.length > 0) {
      this._inputCode = this._inputCode.slice(0, -1);
    }
    else if ((key === K.START || key === K.SPACE) && this._inputCode.length === 4) {
      this._joinRoom(this._inputCode);
    }
    else if (key === K.SELECT) {
      this._state = 'CHOOSE';
      this._inputCode = '';
    }
    return;
  }

  if (this._state === 'SELECT_TANK') {
    if (key === K.UP || key === K.LEFT) this._myLvl = (this._myLvl + 3) % 4;
    else if (key === K.DOWN || key === K.RIGHT) this._myLvl = (this._myLvl + 1) % 4;
    else if (key === K.START || key === K.SPACE) {
      this._ws.send(JSON.stringify({ type: 'READY', level: this._myLvl }));
      this._state = 'WAITING';
    }
  }
};

MultiplayerLobby.prototype._createRoom = function () {
  this._role = 'p1';
  this._ws.send(JSON.stringify({ type: 'CREATE_ROOM', p1Lvl: this._myLvl }));
  this._state = 'WAITING';
};

MultiplayerLobby.prototype._joinRoom = function (code) {
  this._role = 'p2';
  this._ws.send(JSON.stringify({ type: 'JOIN_ROOM', code: code, p2Lvl: this._myLvl }));
  this._state = 'WAITING';
};

MultiplayerLobby.prototype._onServerMsg = function (msg) {
  if (msg.type === 'ROOM_CREATED') {
    this._code = msg.code;
    this._role = 'p1';
    this._state = 'SELECT_TANK';
  }
  else if (msg.type === 'ROOM_JOINED') {
    this._code = msg.code;
    this._role = 'p2';
    this._state = 'SELECT_TANK';
  }
  else if (msg.type === 'PLAYER2_JOINED') {
    this._otherJoined = true;
  }
  else if (msg.type === 'START_GAME') {
    TankPowerSelectScene.chosenUpgradeLevel = msg.p1Lvl || 0;
    TankPowerSelectScene.chosenUpgradeLevel2 = msg.p2Lvl || 0;
    TankPowerSelectScene.twoPlayers = true;
    if (window.startNetworkGame) {
      window.startNetworkGame(this._role, this._ws);
    } else {
      this._sceneManager.toGameScene();
    }
  }
  else if (msg.type === 'ERROR') {
    this._error = msg.text || 'Ошибка';
    this._state = 'CHOOSE';
  }
  else if (msg.type === 'OPPONENT_LEFT') {
    this._error = 'Второй игрок вышел';
    this._state = 'CHOOSE';
  }
};

MultiplayerLobby.prototype.update = function () {
  this._blink++;
};

MultiplayerLobby.prototype.draw = function (ctx) {
  var W = ctx.canvas.width;
  var H = ctx.canvas.height;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  ctx.fillStyle = '#f8b800';
  ctx.font = '17px prstart';
  ctx.fillText('MULTIPLAYER', W / 2, 62);

  if (this._state === 'CHOOSE') {
    ctx.fillStyle = '#fff';
    ctx.font = '12px prstart';
    ctx.fillText('START / FIRE', W / 2, 125);
    ctx.fillStyle = '#f8b800';
    ctx.fillText('СОЗДАТЬ КОМНАТУ', W / 2, 155);

    ctx.fillStyle = '#fff';
    ctx.fillText('SELECT / ВНИЗ', W / 2, 220);
    ctx.fillStyle = '#00c8f8';
    ctx.fillText('ВОЙТИ ПО КОДУ', W / 2, 250);
  }
  else if (this._state === 'ENTER_CODE') {
    ctx.fillStyle = '#fff';
    ctx.font = '11px prstart';
    ctx.fillText('ВВЕДИ КОД КОМНАТЫ', W / 2, 105);
    ctx.fillStyle = '#f8b800';
    ctx.font = '30px prstart';
    ctx.fillText(this._inputCode + (this._inputCode.length < 4 ? '_' : ''), W / 2, 160);
    ctx.fillStyle = '#fff';
    ctx.font = '18px prstart';
    ctx.fillText('[ ' + this._chars[this._charIdx] + ' ]', W / 2, 215);
    ctx.fillStyle = '#888';
    ctx.font = '9px prstart';
    ctx.fillText('ЛЕВО/ПРАВО — символ', W / 2, 250);
    ctx.fillText('ВНИЗ — добавить, ВВЕРХ — удалить', W / 2, 270);
    ctx.fillText('START/FIRE — войти', W / 2, 292);
  }
  else if (this._state === 'SELECT_TANK') {
    var names = ['BASE', 'SPEED', 'POWER', 'ARMOR'];
    ctx.fillStyle = this._role === 'p1' ? '#f8b800' : '#00c8f8';
    ctx.font = '11px prstart';
    ctx.fillText(this._role === 'p1' ? 'ИГРОК 1' : 'ИГРОК 2', W / 2, 92);
    ctx.fillStyle = '#fff';
    ctx.font = '22px prstart';
    ctx.fillText(names[this._myLvl], W / 2, 165);
    ctx.fillStyle = '#888';
    ctx.font = '10px prstart';
    ctx.fillText('СТРЕЛКИ — выбрать', W / 2, 220);
    ctx.fillText('START / FIRE — готов', W / 2, 245);
    if (this._code) {
      ctx.fillStyle = '#f8b800';
      ctx.font = '14px prstart';
      ctx.fillText('КОМНАТА ' + this._code, W / 2, 300);
    }
  }
  else if (this._state === 'WAITING') {
    ctx.fillStyle = '#fff';
    ctx.font = '12px prstart';
    ctx.fillText('ОЖИДАНИЕ ВТОРОГО ИГРОКА', W / 2, 125);
    if (this._code) {
      ctx.fillStyle = '#f8b800';
      ctx.font = '34px prstart';
      ctx.fillText(this._code, W / 2, 195);
      ctx.fillStyle = '#888';
      ctx.font = '9px prstart';
      ctx.fillText('ПЕРЕДАЙ КОД ЖЕНЕ', W / 2, 230);
    }
    if (this._otherJoined) {
      ctx.fillStyle = '#00ff70';
      ctx.font = '10px prstart';
      ctx.fillText('ИГРОК 2 ПОДКЛЮЧИЛСЯ', W / 2, 275);
    }
  }

  if (this._error) {
    ctx.fillStyle = '#ff4040';
    ctx.font = '10px prstart';
    ctx.fillText(this._error, W / 2, H - 25);
  }
};
