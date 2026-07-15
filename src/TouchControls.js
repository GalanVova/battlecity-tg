// TouchControls — сенсорное управление для смартфона и Telegram Mini App.
// Направления и огонь работают одновременно; SELECT/START управляют меню.
function TouchControls(canvas, eventManager, opts) {
  this._canvas = canvas;
  this._eventManager = eventManager;
  this._opts = opts || {};
  this._sendToServer = this._opts.sendToServer || null;
  this._applyLocally = (this._opts.applyLocally !== false);
  this._overlay = null;
  this._pressed = {};
  this._touches = {};

  this._buttons = [
    { id: 'up',     key: Keyboard.Key.UP,     label: '▲' },
    { id: 'down',   key: Keyboard.Key.DOWN,   label: '▼' },
    { id: 'left',   key: Keyboard.Key.LEFT,   label: '◀' },
    { id: 'right',  key: Keyboard.Key.RIGHT,  label: '▶' },
    { id: 'fire',   key: Keyboard.Key.SPACE,  label: 'FIRE', isFireBtn: true },
    { id: 'select', key: Keyboard.Key.SELECT, label: 'SELECT', isMetaBtn: true },
    { id: 'start',  key: Keyboard.Key.START,  label: 'START', isMetaBtn: true }
  ];
}

TouchControls.prototype.show = function () {
  if (this._overlay) this.destroy();

  var W = window.innerWidth;
  var H = window.innerHeight;
  var btnSz = Math.min(64, Math.max(48, Math.floor(Math.min(W, H) * 0.13)));
  var gap = Math.max(7, Math.floor(btnSz * 0.16));
  var pad = Math.max(12, Math.floor(btnSz * 0.28));
  var bottom = pad + 4;

  var dx = pad + btnSz + gap;
  var dy = H - bottom - btnSz * 2 - gap;
  var fireSz = Math.floor(btnSz * 1.18);
  var fx = W - pad - fireSz;
  var fy = H - bottom - fireSz - Math.floor(btnSz * 0.45);
  var metaW = Math.max(58, Math.floor(btnSz * 1.18));
  var metaH = Math.max(28, Math.floor(btnSz * 0.48));
  var center = Math.floor(W / 2);

  var positions = {
    up:     { x: dx,                 y: dy - btnSz - gap, w: btnSz,  h: btnSz },
    down:   { x: dx,                 y: dy + btnSz + gap, w: btnSz,  h: btnSz },
    left:   { x: dx - btnSz - gap,   y: dy,               w: btnSz,  h: btnSz },
    right:  { x: dx + btnSz + gap,   y: dy,               w: btnSz,  h: btnSz },
    fire:   { x: fx,                 y: fy,               w: fireSz, h: fireSz },
    select: { x: center-metaW-gap/2, y: H-bottom-metaH,   w: metaW,  h: metaH },
    start:  { x: center+gap/2,       y: H-bottom-metaH,   w: metaW,  h: metaH }
  };

  this._buttons.forEach(function (b) {
    var p = positions[b.id];
    b.x = p.x; b.y = p.y; b.w = p.w; b.h = p.h;
  });

  var ov = document.createElement('canvas');
  ov.id = 'touch-overlay';
  ov.width = W;
  ov.height = H;
  ov.style.cssText = [
    'position:fixed', 'left:0', 'top:0', 'width:100%', 'height:100%',
    'z-index:100', 'pointer-events:auto', 'touch-action:none',
    '-webkit-user-select:none', 'user-select:none'
  ].join(';');
  document.body.appendChild(ov);
  this._overlay = ov;
  this._draw();

  var self = this;
  ov.addEventListener('touchstart', function (e) { e.preventDefault(); self._onTouch(e, true); }, { passive: false });
  ov.addEventListener('touchend', function (e) { e.preventDefault(); self._onTouch(e, false); }, { passive: false });
  ov.addEventListener('touchcancel', function (e) { e.preventDefault(); self._onTouch(e, false); }, { passive: false });
  ov.addEventListener('touchmove', function (e) { e.preventDefault(); self._onMove(e); }, { passive: false });

  // Полезно при тестировании в мобильном режиме браузера мышью.
  ov.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse') self._onPointer(e, true); });
  ov.addEventListener('pointerup', function (e) { if (e.pointerType === 'mouse') self._onPointer(e, false); });
};

TouchControls.prototype._draw = function () {
  if (!this._overlay) return;
  var ctx = this._overlay.getContext('2d');
  ctx.clearRect(0, 0, this._overlay.width, this._overlay.height);

  this._buttons.forEach(function (b) {
    var pressed = this._pressed[b.id];
    ctx.globalAlpha = pressed ? 0.92 : 0.58;
    if (b.isFireBtn) ctx.fillStyle = pressed ? '#ff3b30' : '#8b1515';
    else if (b.isMetaBtn) ctx.fillStyle = pressed ? '#777' : '#333';
    else ctx.fillStyle = pressed ? '#3976d9' : '#20283a';
    ctx.strokeStyle = b.isFireBtn ? '#ff8a80' : (b.isMetaBtn ? '#aaa' : '#66a3ff');
    ctx.lineWidth = 2;

    var r = Math.min(12, b.h / 4);
    ctx.beginPath();
    ctx.moveTo(b.x+r, b.y);
    ctx.lineTo(b.x+b.w-r, b.y); ctx.quadraticCurveTo(b.x+b.w,b.y,b.x+b.w,b.y+r);
    ctx.lineTo(b.x+b.w,b.y+b.h-r); ctx.quadraticCurveTo(b.x+b.w,b.y+b.h,b.x+b.w-r,b.y+b.h);
    ctx.lineTo(b.x+r,b.y+b.h); ctx.quadraticCurveTo(b.x,b.y+b.h,b.x,b.y+b.h-r);
    ctx.lineTo(b.x,b.y+r); ctx.quadraticCurveTo(b.x,b.y,b.x+r,b.y);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = (b.isMetaBtn ? Math.max(9, Math.floor(b.h*0.34)) : Math.max(13, Math.floor(b.h*0.30))) + 'px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x+b.w/2, b.y+b.h/2+1);
  }, this);
};

TouchControls.prototype._hitBtn = function (cx, cy) {
  for (var i=0; i<this._buttons.length; i++) {
    var b=this._buttons[i], hitPad=6;
    if (cx>=b.x-hitPad && cx<=b.x+b.w+hitPad && cy>=b.y-hitPad && cy<=b.y+b.h+hitPad) return b;
  }
  return null;
};

TouchControls.prototype._fireKey = function (key, pressed) {
  if (this._applyLocally) {
    this._eventManager.fireEvent({
      name: pressed ? Keyboard.Event.KEY_PRESSED : Keyboard.Event.KEY_RELEASED,
      key: key
    });
  }
  if (this._sendToServer) this._sendToServer(key, pressed);
};

TouchControls.prototype._pressButton = function (touchId, btn) {
  if (!btn) return;
  this._touches[touchId] = btn.id;
  if (!this._pressed[btn.id]) {
    this._pressed[btn.id] = true;
    this._fireKey(btn.key, true);
  }
};

TouchControls.prototype._releaseTouch = function (touchId) {
  var btnId = this._touches[touchId];
  if (!btnId) return;
  delete this._touches[touchId];
  var stillHeld = Object.values(this._touches).indexOf(btnId) !== -1;
  if (!stillHeld) {
    delete this._pressed[btnId];
    for (var i=0; i<this._buttons.length; i++) {
      if (this._buttons[i].id === btnId) { this._fireKey(this._buttons[i].key, false); break; }
    }
  }
};

TouchControls.prototype._onTouch = function (e, isStart) {
  var rect=this._overlay.getBoundingClientRect();
  var sx=this._overlay.width/rect.width, sy=this._overlay.height/rect.height;
  var touches=e.changedTouches;
  for (var i=0; i<touches.length; i++) {
    var t=touches[i];
    if (isStart) this._pressButton(t.identifier, this._hitBtn((t.clientX-rect.left)*sx,(t.clientY-rect.top)*sy));
    else this._releaseTouch(t.identifier);
  }
  this._draw();
};

TouchControls.prototype._onMove = function (e) {
  var rect=this._overlay.getBoundingClientRect();
  var sx=this._overlay.width/rect.width, sy=this._overlay.height/rect.height;
  var touches=e.changedTouches;
  for (var i=0; i<touches.length; i++) {
    var t=touches[i], oldId=this._touches[t.identifier];
    var newBtn=this._hitBtn((t.clientX-rect.left)*sx,(t.clientY-rect.top)*sy);
    var newId=newBtn ? newBtn.id : null;
    if (oldId !== newId) {
      this._releaseTouch(t.identifier);
      this._pressButton(t.identifier,newBtn);
    }
  }
  this._draw();
};

TouchControls.prototype._onPointer = function (e, isStart) {
  var rect=this._overlay.getBoundingClientRect();
  var btn=this._hitBtn(e.clientX-rect.left,e.clientY-rect.top);
  if (isStart) this._pressButton('mouse',btn); else this._releaseTouch('mouse');
  this._draw();
};

TouchControls.prototype.destroy = function () {
  Object.keys(this._touches).forEach(this._releaseTouch.bind(this));
  if (this._overlay) { this._overlay.remove(); this._overlay=null; }
};
