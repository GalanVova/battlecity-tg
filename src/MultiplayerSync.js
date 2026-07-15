// ═══════════════════════════════════════════════════════════
//  MultiplayerSync — синхронизация ввода между игроками
//
//  Архитектура: P1 = хост (вся игровая логика у него)
//               P2 = клиент (шлёт только свои нажатия)
//
//  Поток данных:
//  P2 тач → TouchControls.sendToServer(key) →
//  → WebSocket → сервер → P1-хост →
//  → MultiplayerSync.remapAndFire(key) →
//  → eventManager → Player2TankController (WASD+E) →
//  → P2-танк двигается
// ═══════════════════════════════════════════════════════════

function MultiplayerSync(ws, role, eventManager) {
  this._ws   = ws;
  this._role = role;
  this._em   = eventManager;

  var self = this;
  ws.onmessage = function(e) {
    var msg;
    try { msg = JSON.parse(e.data); } catch(err) { return; }
    self._onMessage(msg);
  };
}

MultiplayerSync.prototype._onMessage = function(msg) {
  if (msg.type === 'INPUT' && this._role === 'p1') {
    // P1-хост получил нажатие от P2-клиента
    // Ремапим стрелки + SPACE → WASD + E (коды Player2TankController)
    var remapped = MultiplayerSync.P2_KEY_MAP[msg.key] || msg.key;
    this._em.fireEvent({
      name: msg.pressed
        ? Keyboard.Event.KEY_PRESSED
        : Keyboard.Event.KEY_RELEASED,
      key: remapped,
    });
  } else if (msg.type === 'OPPONENT_LEFT') {
    // Показываем сообщение без alert (не блокирует поток)
    var overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed','inset:0','background:rgba(0,0,0,0.7)',
      'color:#fff','font:bold 20px monospace',
      'display:flex','align-items:center','justify-content:center',
      'z-index:999','text-align:center','padding:20px',
    ].join(';');
    overlay.innerHTML = '😢 Соперник вышел из игры<br><br><small>Обнови страницу чтобы сыграть снова</small>';
    document.body.appendChild(overlay);
  }
};

// P2 использует стрелки + SPACE (те же что у P1 на его телефоне)
// P1-хост ремапит их в WASD+E — коды Player2TankController
MultiplayerSync.P2_KEY_MAP = {
  38: 87,   // ↑ → W
  40: 83,   // ↓ → S
  37: 65,   // ← → A
  39: 68,   // → → D
  32: 69,   // SPACE → E (огонь)
};

// Фабричный метод: создаёт TouchControls с правильной конфигурацией
MultiplayerSync.createTouchControls = function(canvas, eventManager, ws, role) {
  if (role === 'p1') {
    // P1: применяет нажатия локально, НЕ шлёт на сервер
    return new TouchControls(canvas, eventManager, {
      applyLocally: true,
      sendToServer: null,
    });
  } else {
    // P2: НЕ применяет локально (не двигает P1-танк!), шлёт на сервер
    return new TouchControls(canvas, eventManager, {
      applyLocally: false,
      sendToServer: function(key, pressed) {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'INPUT', key: key, pressed: pressed }));
        }
      },
    });
  }
};
