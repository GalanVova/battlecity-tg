// MultiplayerSync — синхронизация управления между двумя клиентами.
// Обе копии игры получают одинаковые команды P1 и P2.
function MultiplayerSync(ws, role, eventManager) {
  this._ws = ws;
  this._role = role;
  this._em = eventManager;

  var self = this;
  ws.onmessage = function (e) {
    var msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    self._onMessage(msg);
  };
}

MultiplayerSync.prototype._onMessage = function (msg) {
  if (msg.type === 'INPUT') {
    // P1 всегда использует стрелки + SPACE.
    // P2 на обеих копиях игры преобразуется в WASD + E.
    var key = msg.role === 'p2'
      ? (MultiplayerSync.P2_KEY_MAP[msg.key] || msg.key)
      : msg.key;

    // P1 уже применил свою команду локально — его эхо пропускаем.
    if (this._role === 'p1' && msg.role === 'p1') return;

    this._em.fireEvent({
      name: msg.pressed ? Keyboard.Event.KEY_PRESSED : Keyboard.Event.KEY_RELEASED,
      key: key
    });
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

MultiplayerSync.P2_KEY_MAP = {
  38: 87, // UP -> W
  40: 83, // DOWN -> S
  37: 65, // LEFT -> A
  39: 68, // RIGHT -> D
  32: 69  // SPACE -> E
};

MultiplayerSync.createTouchControls = function (canvas, eventManager, ws, role) {
  if (role === 'p1') {
    return new TouchControls(canvas, eventManager, {
      applyLocally: true,
      sendToServer: function (key, pressed) {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'INPUT', key: key, pressed: pressed }));
        }
      }
    });
  }

  // P2 не применяет стрелки локально. Сервер возвращает их как INPUT role=p2,
  // после чего MultiplayerSync преобразует их в WASD+E.
  return new TouchControls(canvas, eventManager, {
    applyLocally: false,
    sendToServer: function (key, pressed) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'INPUT', key: key, pressed: pressed }));
      }
    }
  });
};
