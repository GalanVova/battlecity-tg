// ═══════════════════════════════════════════════════════════
//  TouchControls — виртуальный джойстик для телефона
//
//  ВАЖНО для мультиплеера:
//  - Каждый игрок на своём телефоне — у каждого свой джойстик
//  - P1 (хост): тач → стрелки + SPACE → TankController
//  - P2 (клиент): тач → стрелки + SPACE → шлём на сервер →
//    сервер ремапит в WASD+E → P1-хост двигает P2-танк
//
//  Т.е. ОБА игрока используют одинаковые коды клавиш (стрелки),
//  но P2 их не применяет локально — только отправляет на сервер.
// ═══════════════════════════════════════════════════════════

function TouchControls(canvas, eventManager, opts) {
  this._canvas = canvas;
  this._eventManager = eventManager;
  this._opts = opts || {};
  // sendToServer: function(key, pressed) — колбэк для P2
  this._sendToServer = this._opts.sendToServer || null;
  // applyLocally: bool — применять ли нажатия в локальный eventManager
  // P1 = true (управляет своим танком)
  // P2 = false (только отправляет на сервер, не двигает P1-танк)
  this._applyLocally = (this._opts.applyLocally !== false);

  this._overlay = null;
  this._pressed = {};
  this._touches = {};

  this._buttons = [
    { id:'up',    key: 38, label: '▲' },
    { id:'down',  key: 40, label: '▼' },
    { id:'left',  key: 37, label: '◀' },
    { id:'right', key: 39, label: '▶' },
    { id:'fire',  key: 32, label: '🔥', isFireBtn: true },
  ];
}

TouchControls.prototype.show = function () {
  if (this._overlay) this._overlay.remove();

  var W = window.innerWidth, H = window.innerHeight;
  var btnSz = Math.min(Math.floor(Math.min(W, H) * 0.14), 60);
  var gap   = Math.floor(btnSz * 0.22);
  var pad   = Math.floor(btnSz * 0.4);

  // D-pad — левый нижний
  var dx = pad + btnSz + gap;
  var dy = H - pad - btnSz - gap;
  // Огонь — правый нижний
  var fx = W - pad - btnSz;
  var fy = H - pad - btnSz;

  // Позиции кнопок
  var positions = {
    up:    { x: dx,               y: dy - btnSz - gap },
    down:  { x: dx,               y: dy + btnSz + gap },
    left:  { x: dx - btnSz - gap, y: dy              },
    right: { x: dx + btnSz + gap, y: dy              },
    fire:  { x: fx,               y: fy              },
  };

  this._buttons.forEach(function(b) {
    b.x = positions[b.id].x;
    b.y = positions[b.id].y;
    b.w = btnSz; b.h = btnSz;
  });

  var ov = document.createElement('canvas');
  ov.id = 'touch-overlay';
  ov.width  = W;
  ov.height = H;
  ov.style.cssText = [
    'position:fixed','left:0','top:0',
    'width:100%','height:100%',
    'z-index:100','pointer-events:all','touch-action:none',
  ].join(';');
  document.body.appendChild(ov);
  this._overlay = ov;
  this._draw();

  var self = this;
  ov.addEventListener('touchstart',  function(e){e.preventDefault();self._onTouch(e,true); }, {passive:false});
  ov.addEventListener('touchend',    function(e){e.preventDefault();self._onTouch(e,false);}, {passive:false});
  ov.addEventListener('touchcancel', function(e){e.preventDefault();self._onTouch(e,false);}, {passive:false});
  ov.addEventListener('touchmove',   function(e){e.preventDefault();self._onMove(e);       }, {passive:false});
};

TouchControls.prototype._draw = function () {
  if (!this._overlay) return;
  var ctx = this._overlay.getContext('2d');
  ctx.clearRect(0, 0, this._overlay.width, this._overlay.height);

  this._buttons.forEach(function(b) {
    var pressed = this._pressed[b.id];
    ctx.globalAlpha = pressed ? 0.85 : 0.45;
    ctx.fillStyle   = b.isFireBtn ? (pressed ? '#ff2020' : '#800000') : (pressed ? '#2060cc' : '#223');
    ctx.strokeStyle = b.isFireBtn ? '#ff6060' : '#48f';
    ctx.lineWidth   = 2;

    var r = 10;
    ctx.beginPath();
    ctx.moveTo(b.x+r, b.y);
    ctx.lineTo(b.x+b.w-r, b.y);     ctx.quadraticCurveTo(b.x+b.w, b.y,    b.x+b.w, b.y+r);
    ctx.lineTo(b.x+b.w, b.y+b.h-r); ctx.quadraticCurveTo(b.x+b.w, b.y+b.h,b.x+b.w-r, b.y+b.h);
    ctx.lineTo(b.x+r, b.y+b.h);     ctx.quadraticCurveTo(b.x, b.y+b.h,    b.x, b.y+b.h-r);
    ctx.lineTo(b.x, b.y+r);         ctx.quadraticCurveTo(b.x, b.y,         b.x+r, b.y);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = Math.floor(b.w * 0.42) + 'px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w/2, b.y + b.h/2 + 1);
  }, this);
};

TouchControls.prototype._hitBtn = function (cx, cy) {
  for (var i = 0; i < this._buttons.length; i++) {
    var b = this._buttons[i];
    // Немного увеличиваем зону попадания для удобства
    var pad = 4;
    if (cx >= b.x-pad && cx <= b.x+b.w+pad && cy >= b.y-pad && cy <= b.y+b.h+pad) return b;
  }
  return null;
};

TouchControls.prototype._fireKey = function (key, pressed) {
  // Применяем локально (P1 управляет своим танком)
  if (this._applyLocally) {
    this._eventManager.fireEvent({
      name: pressed ? Keyboard.Event.KEY_PRESSED : Keyboard.Event.KEY_RELEASED,
      key: key,
    });
  }
  // Отправляем на сервер (P2 управляет своим танком через P1-хост)
  if (this._sendToServer) {
    this._sendToServer(key, pressed);
  }
};

TouchControls.prototype._onTouch = function (e, isStart) {
  var rect = this._overlay.getBoundingClientRect();
  var sx = this._overlay.width  / rect.width;
  var sy = this._overlay.height / rect.height;
  var touches = e.changedTouches;

  for (var i = 0; i < touches.length; i++) {
    var t = touches[i];
    var cx = (t.clientX - rect.left) * sx;
    var cy = (t.clientY - rect.top)  * sy;

    if (isStart) {
      var btn = this._hitBtn(cx, cy);
      if (btn && !this._touches[t.identifier]) {
        this._touches[t.identifier] = btn.id;
        if (!this._pressed[btn.id]) {
          this._pressed[btn.id] = true;
          this._fireKey(btn.key, true);
        }
      }
    } else {
      var btnId = this._touches[t.identifier];
      if (btnId) {
        delete this._touches[t.identifier];
        var stillHeld = Object.values(this._touches).indexOf(btnId) !== -1;
        if (!stillHeld) {
          delete this._pressed[btnId];
          for (var j = 0; j < this._buttons.length; j++) {
            if (this._buttons[j].id === btnId) {
              this._fireKey(this._buttons[j].key, false);
              break;
            }
          }
        }
      }
    }
  }
  this._draw();
};

TouchControls.prototype._onMove = function (e) {
  var rect = this._overlay.getBoundingClientRect();
  var sx = this._overlay.width  / rect.width;
  var sy = this._overlay.height / rect.height;
  var touches = e.changedTouches;

  for (var i = 0; i < touches.length; i++) {
    var t = touches[i];
    var oldId = this._touches[t.identifier];
    var cx = (t.clientX - rect.left) * sx;
    var cy = (t.clientY - rect.top)  * sy;
    var newBtn = this._hitBtn(cx, cy);
    var newId = newBtn ? newBtn.id : null;

    if (oldId !== newId) {
      // Отпускаем старую
      if (oldId) {
        delete this._touches[t.identifier];
        var stillOld = Object.values(this._touches).indexOf(oldId) !== -1;
        if (!stillOld) {
          delete this._pressed[oldId];
          for (var j = 0; j < this._buttons.length; j++) {
            if (this._buttons[j].id === oldId) { this._fireKey(this._buttons[j].key, false); break; }
          }
        }
      }
      // Нажимаем новую
      if (newBtn) {
        this._touches[t.identifier] = newId;
        if (!this._pressed[newId]) {
          this._pressed[newId] = true;
          this._fireKey(newBtn.key, true);
        }
      }
    }
  }
  this._draw();
};

TouchControls.prototype.destroy = function () {
  if (this._overlay) { this._overlay.remove(); this._overlay = null; }
};
