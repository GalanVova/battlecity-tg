function LoadingScene(sceneManager) {
  this._sceneManager = sceneManager;
  this._loadingProgress = 0;
  this._openedNextScene = false;
}

LoadingScene.prototype.update = function () {
  this._loadingProgress = ImageManager.getLoadingProgress();
  if (this._loadingProgress != 100 || this._openedNextScene) return;

  // В Telegram/на телефоне сразу открываем сетевое лобби,
  // но только когда WebSocket уже подключён.
  if (window._bcAutoMultiplayer) {
    if (window._bcWs && window._bcWs.readyState === 1 && window.openMultiplayerLobby) {
      this._openedNextScene = true;
      window.openMultiplayerLobby();
    }
    return;
  }

  this._openedNextScene = true;
  this._sceneManager.toMainMenuScene(false);
};

LoadingScene.prototype.draw = function (ctx) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('LOADING ' + ('' + this._loadingProgress).lpad(' ', 3) + '%', 160, 240);
  if (this._loadingProgress === 100 && window._bcAutoMultiplayer && (!window._bcWs || window._bcWs.readyState !== 1)) {
    ctx.fillText('CONNECTING...', 150, 270);
  }
};
