// MultiplayerSync — P1 является единственным хозяином игровой логики.
// P2 отправляет только управление и получает готовые кадры с экрана P1.
function MultiplayerSync(ws, role, eventManager, canvasContext) {
  this._ws = ws;
  this._role = role;
  this._em = eventManager;
  this._ctx = canvasContext || null;
  this._frameImage = new Image();
  this._framePending = false;

  var self = this;
  this._frameImage.onload = function () {
    if (self._ctx && self._role === 'p2') {
      self._ctx.clearRect(0, 0, self._ctx.canvas.width, self._ctx.canvas.height);
      self._ctx.drawImage(self._frameImage, 0, 0, self._ctx.canvas.width, self._ctx.canvas.height);
    }
    self._framePending = false;
  };

  ws.onmessage = function (e) {
    var msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    self._onMessage(msg);
  };
}

MultiplayerSync.prototype._onMessage = function (msg) {
  if (msg.type === 'INPUT') {
    // Только P1 применяет команды к игровой логике.
    if (this._role !== 'p1') return;

    var key = msg.role === 'p2'
      ? (MultiplayerSync.P2_KEY_MAP[msg.key] || msg.key)
      : msg.key;

    // Собственные команды P1 уже применены локально.
    if (msg.role === 'p1') return;

    this._em.fireEvent({
      name: msg.pressed ? Keyboard.Event.KEY_PRESSED : Keyboard.Event.KEY_RELEASED,
      key: key
    });
  }
  else if (msg.type === 'FRAME' && this._role === 'p2') {
    if (!msg.data || this._framePending) return;
    this._framePending = true;
    this._frameImage.src = msg.data;
  }
  else if (msg.type === 'OPPONENT_LEFT') {
    var overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed','inset:0','background:rgba(0,0,0,0.82)',
      'color:#fff','font:bold 20px monospace','display:flex',
      'align-items:center','justify-content:center','z-index:999',
      'text-align:center','padding:20px'
    ].join(';');
    overlay.innerHTML = 'Соперник вышел из игры<br><br><small>Закрой и снова открой игру</small>';
    document.body.appendChild(overlay);
  }
};

MultiplayerSync.prototype.sendFrame = function (canvas) {
  if (this._role !== 'p1' || !canvas || this._ws.readyState !== 1) return;
  try {
    this._ws.send(JSON.stringify({
      type: 'FRAME',
      data: canvas.toDataURL('image/jpeg', 0.55)
    }));
  } catch (e) {}
};

MultiplayerSync.P2_KEY_MAP = {
  38: 87,
  40: 83,
  37: 65,
  39: 68,
  32: 69
};

MultiplayerSync.createTouchControls = function (canvas, eventManager, ws, role) {
  if (role === 'p1') {
    return new TouchControls(canvas, eventManager, {
      applyLocally: true,
      sendToServer: function (key, pressed) {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type:'INPUT', key:key, pressed:pressed }));
      }
    });
  }

  return new TouchControls(canvas, eventManager, {
    applyLocally: false,
    sendToServer: function (key, pressed) {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type:'INPUT', key:key, pressed:pressed }));
    }
  });
};