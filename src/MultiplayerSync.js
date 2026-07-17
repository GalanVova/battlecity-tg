// MultiplayerSync — P1 является единственным хозяином игровой логики.
// Основной видеоканал: WebRTC canvas stream. Бинарные кадры остаются fallback.
function MultiplayerSync(ws, role, eventManager, canvasContext) {
  this._ws = ws;
  this._role = role;
  this._em = eventManager;
  this._ctx = canvasContext || null;
  this._encoding = false;
  this._drawing = false;
  this._queuedFrame = null;
  this._peer = null;
  this._video = null;
  this._videoLoop = null;
  this._rtcConnected = false;

  ws.binaryType = 'arraybuffer';

  var self = this;
  ws.onmessage = function (e) {
    if (typeof e.data !== 'string') {
      if (!self._rtcConnected) self._onBinaryFrame(e.data);
      return;
    }

    var msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    self._onMessage(msg);
  };

  this._startWebRTC();
}

MultiplayerSync.prototype._startWebRTC = function () {
  if (!window.RTCPeerConnection) return;

  var self = this;
  var peer;
  try {
    peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
  } catch (e) {
    return;
  }

  this._peer = peer;

  peer.onicecandidate = function (event) {
    if (!event.candidate || self._ws.readyState !== 1) return;
    self._ws.send(JSON.stringify({
      type: 'SIGNAL',
      data: { kind: 'candidate', candidate: event.candidate }
    }));
  };

  peer.onconnectionstatechange = function () {
    self._rtcConnected = peer.connectionState === 'connected';
  };

  if (this._role === 'p1') {
    var canvas = this._ctx && this._ctx.canvas;
    if (!canvas || !canvas.captureStream) return;

    try {
      var stream = canvas.captureStream(30);
      var tracks = stream.getVideoTracks();
      for (var i = 0; i < tracks.length; i++) peer.addTrack(tracks[i], stream);

      peer.createOffer({ offerToReceiveVideo: false }).then(function (offer) {
        return peer.setLocalDescription(offer);
      }).then(function () {
        if (self._ws.readyState === 1) {
          self._ws.send(JSON.stringify({
            type: 'SIGNAL',
            data: { kind: 'description', description: peer.localDescription }
          }));
        }
      }).catch(function () {});
    } catch (e) {}
    return;
  }

  peer.ontrack = function (event) {
    var stream = event.streams && event.streams[0];
    if (!stream) return;

    var video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.style.display = 'none';
    document.body.appendChild(video);
    self._video = video;

    var start = function () {
      self._rtcConnected = true;
      self._drawVideoLoop();
    };
    var playPromise = video.play();
    if (playPromise && playPromise.then) playPromise.then(start).catch(function () {});
    else start();
  };
};

MultiplayerSync.prototype._handleSignal = function (data) {
  if (!this._peer || !data) return;
  var self = this;

  if (data.kind === 'candidate' && data.candidate) {
    this._peer.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(function () {});
    return;
  }

  if (data.kind !== 'description' || !data.description) return;

  this._peer.setRemoteDescription(new RTCSessionDescription(data.description)).then(function () {
    if (self._role !== 'p2' || data.description.type !== 'offer') return null;
    return self._peer.createAnswer().then(function (answer) {
      return self._peer.setLocalDescription(answer);
    }).then(function () {
      if (self._ws.readyState === 1) {
        self._ws.send(JSON.stringify({
          type: 'SIGNAL',
          data: { kind: 'description', description: self._peer.localDescription }
        }));
      }
    });
  }).catch(function () {});
};

MultiplayerSync.prototype._drawVideoLoop = function () {
  if (this._role !== 'p2' || !this._video || !this._ctx) return;
  var self = this;

  var draw = function () {
    if (!self._video || !self._ctx) return;
    if (self._video.readyState >= 2) {
      self._ctx.drawImage(
        self._video,
        0,
        0,
        self._ctx.canvas.width,
        self._ctx.canvas.height
      );
    }
    self._videoLoop = requestAnimationFrame(draw);
  };

  if (this._videoLoop) cancelAnimationFrame(this._videoLoop);
  this._videoLoop = requestAnimationFrame(draw);
};

MultiplayerSync.prototype._onBinaryFrame = function (data) {
  if (this._role !== 'p2' || !this._ctx || !data) return;
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
  if (this._queuedFrame && !this._rtcConnected) {
    var latest = this._queuedFrame;
    this._queuedFrame = null;
    this._drawBinaryFrame(latest);
  } else {
    this._queuedFrame = null;
  }
};

MultiplayerSync.prototype._onMessage = function (msg) {
  if (msg.type === 'INPUT') {
    if (this._role !== 'p1') return;

    var key = msg.role === 'p2'
      ? (MultiplayerSync.P2_KEY_MAP[msg.key] || msg.key)
      : msg.key;

    if (msg.role === 'p1') return;

    this._em.fireEvent({
      name: msg.pressed ? Keyboard.Event.KEY_PRESSED : Keyboard.Event.KEY_RELEASED,
      key: key
    });
  }
  else if (msg.type === 'SIGNAL') {
    this._handleSignal(msg.data);
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
  if (this._rtcConnected) return;
  if (this._role !== 'p1' || !canvas || this._ws.readyState !== 1) return;
  if (this._encoding || this._ws.bufferedAmount > 120000) return;

  var self = this;
  this._encoding = true;
  var finish = function () { self._encoding = false; };

  if (canvas.toBlob) {
    canvas.toBlob(function (blob) {
      if (blob && self._ws.readyState === 1 && self._ws.bufferedAmount < 120000) {
        self._ws.send(blob);
      }
      finish();
    }, 'image/webp', 0.45);
    return;
  }

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