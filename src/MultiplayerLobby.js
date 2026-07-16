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
  this._codeDialog = null;

  var self = this;
  ws.onmessage = function (e) {
    var msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    self._onServerMsg(msg);
  };
  ws.onclose = function () {
    self._error = 'Связь с сервером потеряна';
    self._hideCodeDialog();
  };

  this._eventManager.addSubscriber(this, [Keyboard.Event.KEY_PRESSED]);
}

MultiplayerLobby.prototype.notify = function (event) {
  if (event.name === Keyboard.Event.KEY_PRESSED) this._onKey(event.key);
};

MultiplayerLobby.prototype._isMobile = function () {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
    !!(window.Telegram && window.Telegram.WebApp);
};

MultiplayerLobby.prototype._enterCode = function () {
  this._state = 'ENTER_CODE';
  this._inputCode = '';
  this._error = '';
  if (this._isMobile()) this._showCodeDialog();
};

MultiplayerLobby.prototype._showCodeDialog = function () {
  this._hideCodeDialog();

  var self = this;
  var overlay = document.createElement('div');
  overlay.id = 'room-code-dialog';
  overlay.style.cssText = [
    'position:fixed','inset:0','z-index:1000',
    'display:flex','align-items:center','justify-content:center',
    'padding:20px','background:rgba(0,0,0,.88)',
    'font-family:Arial,sans-serif','box-sizing:border-box'
  ].join(';');

  var card = document.createElement('div');
  card.style.cssText = [
    'width:min(360px,100%)','background:#111827','border:2px solid #f8b800',
    'border-radius:18px','padding:24px 20px','box-sizing:border-box',
    'box-shadow:0 18px 60px rgba(0,0,0,.55)','text-align:center','color:#fff'
  ].join(';');

  var title = document.createElement('div');
  title.textContent = 'Войти в комнату';
  title.style.cssText = 'font-size:23px;font-weight:700;margin-bottom:8px';

  var hint = document.createElement('div');
  hint.textContent = 'Введи 4-значный код, который показан у первого игрока';
  hint.style.cssText = 'font-size:14px;line-height:1.35;color:#aab2c0;margin-bottom:18px';

  var input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 4;
  input.autocomplete = 'off';
  input.autocapitalize = 'characters';
  input.spellcheck = false;
  input.placeholder = 'AB12';
  input.inputMode = 'text';
  input.style.cssText = [
    'display:block','width:100%','height:64px','box-sizing:border-box',
    'border:2px solid #344054','border-radius:12px','background:#05070b','color:#f8b800',
    'font-size:32px','font-weight:800','letter-spacing:12px','text-align:center',
    'text-transform:uppercase','outline:none','padding-left:12px'
  ].join(';');

  var error = document.createElement('div');
  error.style.cssText = 'min-height:22px;color:#ff6767;font-size:13px;margin-top:8px';

  var join = document.createElement('button');
  join.textContent = 'ВОЙТИ В КОМНАТУ';
  join.disabled = true;
  join.style.cssText = [
    'width:100%','height:52px','border:0','border-radius:12px','margin-top:8px',
    'font-size:16px','font-weight:800','background:#5a4b12','color:#9b9167'
  ].join(';');

  var back = document.createElement('button');
  back.textContent = 'Назад';
  back.style.cssText = [
    'width:100%','height:44px','border:1px solid #475467','border-radius:12px','margin-top:10px',
    'font-size:15px','background:transparent','color:#d0d5dd'
  ].join(';');

  function normalize() {
    var value = input.value.toUpperCase().replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, '').slice(0, 4);
    input.value = value;
    self._inputCode = value;
    var ready = value.length === 4;
    join.disabled = !ready;
    join.style.background = ready ? '#f8b800' : '#5a4b12';
    join.style.color = ready ? '#111' : '#9b9167';
    error.textContent = '';
  }

  input.addEventListener('input', normalize);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && input.value.length === 4) {
      e.preventDefault();
      join.click();
    }
  });
  join.addEventListener('click', function () {
    normalize();
    if (self._inputCode.length !== 4) {
      error.textContent = 'Нужно ввести 4 символа';
      return;
    }
    input.blur();
    self._hideCodeDialog();
    self._joinRoom(self._inputCode);
  });
  back.addEventListener('click', function () {
    self._hideCodeDialog();
    self._state = 'CHOOSE';
    self._inputCode = '';
  });

  card.appendChild(title);
  card.appendChild(hint);
  card.appendChild(input);
  card.appendChild(error);
  card.appendChild(join);
  card.appendChild(back);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  this._codeDialog = overlay;

  setTimeout(function () { input.focus(); }, 250);
};

MultiplayerLobby.prototype._hideCodeDialog = function () {
  if (this._codeDialog && this._codeDialog.parentNode) {
    this._codeDialog.parentNode.removeChild(this._codeDialog);
  }
  this._codeDialog = null;
};

MultiplayerLobby.prototype._onKey = function (key) {
  var K = Keyboard.Key;

  if (this._state === 'CHOOSE') {
    if (key === K.START || key === K.SPACE) this._createRoom();
    else if (key === K.SELECT || key === K.DOWN || key === K.RIGHT) this._enterCode();
    return;
  }

  if (this._state === 'ENTER_CODE') {
    // На телефоне используется обычное поле ввода и экранная клавиатура.
    if (this._isMobile()) return;
    if (key === K.RIGHT) this._charIdx = (this._charIdx + 1) % this._chars.length;
    else if (key === K.LEFT) this._charIdx = (this._charIdx + this._chars.length - 1) % this._chars.length;
    else if (key === K.DOWN && this._inputCode.length < 4) this._inputCode += this._chars[this._charIdx];
    else if (key === K.UP && this._inputCode.length > 0) this._inputCode = this._inputCode.slice(0, -1);
    else if ((key === K.START || key === K.SPACE) && this._inputCode.length === 4) this._joinRoom(this._inputCode);
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
  this._hideCodeDialog();
  this._role = 'p1';
  this._ws.send(JSON.stringify({ type: 'CREATE_ROOM', p1Lvl: this._myLvl }));
  this._state = 'WAITING';
};

MultiplayerLobby.prototype._joinRoom = function (code) {
  this._hideCodeDialog();
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
    this._hideCodeDialog();
    TankPowerSelectScene.chosenUpgradeLevel = msg.p1Lvl || 0;
    TankPowerSelectScene.chosenUpgradeLevel2 = msg.p2Lvl || 0;
    TankPowerSelectScene.twoPlayers = true;
    if (window.startNetworkGame) window.startNetworkGame(this._role, this._ws);
    else this._sceneManager.toGameScene();
  }
  else if (msg.type === 'ERROR') {
    this._error = msg.text || 'Ошибка';
    if (this._isMobile() && this._role === 'p2') {
      this._state = 'ENTER_CODE';
      this._showCodeDialog();
      var errorNode = this._codeDialog && this._codeDialog.querySelector('div div:nth-child(4)');
      if (errorNode) errorNode.textContent = this._error;
    } else {
      this._state = 'CHOOSE';
    }
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
    ctx.fillText(this._isMobile() ? 'ВВЕДИ КОД В ОКНЕ' : 'ВВЕДИ КОД КОМНАТЫ', W / 2, 105);
    if (!this._isMobile()) {
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