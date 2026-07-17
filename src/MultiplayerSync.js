// MultiplayerSync — P1 является единственным хозяином игровой логики.
// P2 отправляет только управление и получает сжатые бинарные кадры с экрана P1.
function MultiplayerSync(ws, role, eventManager, canvasContext) {
  this._ws = ws;
  this._role = role;
  this._em = eventManager;
  this._ctx = canvasContext || null;
  this._encoding = false;
  this._drawing = false;
  this._queuedFrame = null;

  ws.binaryType = 'arraybuffer';

  var self = this;
  ws.onmessage = function (e) {
    if (typeof e.data !== 'string') {
      self._onBinaryFrame(e.data);
      return;
    }

    var msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    self._onMessage(msg);
  };
}

MultiplayerSync.prototype._onBinaryFrame = function (data) {
  if (this._role !== 'p2' || !this._ctx || !data) return;

  // Не создаём очередь из устаревших кадров: всегда оставляем только самый свежий.
  if (this._drawing) {
    this._queuedFrame = data;
    return;
  }

  this._drawBinaryFrame(data);
};

MultiplayerSync.prototype._drawBinaryFrame = function (data) {
  var self = this;
  this._drawing = true;

  var blob = data instanceof Blob ? data : new Blob([data], { type: 'image/webp' });

  if (window.createImageBitmap) {
    createImageBitmap(blob).then(function (bitmap) {
      if (self._ctx) {
        self._ctx.clearRect(0, 0, self._ctx.canvas.width, self._ctx.canvas.height);
        self._ctx.drawImage(bitmap, 0, 0, self._ctx.canvas.width, self._ctx.canvas.height);
      }
      if (bitmap.close) bitmap.close();
      self._finishFrameDraw();
    }).catch(function () {
      self._drawBlobWithImage(blob);
    });
    return;
  }

  this._drawBlobWithImage(blob);
};

MultiplayerSync.prototype._drawBlobWithImage = function (blob) {
  var self = this;
  var url = URL.createObjectURL(blob);
  var image = new Image();
  image.onload = function () {
    if (self._ctx) {
      self._ctx.clearRect(0, 0, self._ctx.canvas.width, self._ctx.canvas.height);
      self._ctx.drawImage(image, 0, 0, self._ctx.canvas.width, self._ctx.canvas.height);
    }
    URL.revokeObjectURL(url);
    self._finishFrameDraw();
  };
  image.onerror = function () {
    URL.revokeObjectURL(url);
    self._finishFrameDraw();
  };
  image.src = url;
};

MultiplayerSync.prototype._finishFrameDraw = function () {
  this._drawing = false;
  if (this._queuedFrame) {
    var latest = this._queuedFrame;
    this._queuedFrame = null;
    this._drawBinaryFrame(latest);
  }
};

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
  if (this._encoding || this._ws.bufferedAmount > 180000) return;

  var self = this;
  this._encoding = true;

  var finish = function () { self._encoding = false; };

  // WebP заметно меньше JPEG для пиксельной графики и не блокирует основной цикл.
  if (canvas.toBlob) {
    canvas.toBlob(function (blob) {
      if (blob && self._ws.readyState === 1 && self._ws.bufferedAmount < 180000) {
        self._ws.send(blob);
      }
      finish();
    }, 'image/webp', 0.72);
    return;
  }

  // Старый fallback для браузеров без toBlob.
  try {
    var dataUrl = canvas.toDataURL('image/jpeg', 0.5);
    var base64 = dataUrl.split(',')[1];
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    this._ws.send(bytes.buffer);
  } catch (e) {}
  finish();
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