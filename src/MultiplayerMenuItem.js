function MultiplayerMenuItem(sceneManager) {
  MainMenuItem.call(this, sceneManager);
  this.setName("MULTIPLAYER");
}

MultiplayerMenuItem.subclass(MainMenuItem);

MultiplayerMenuItem.prototype.execute = function () {
  if (typeof window !== 'undefined' && window.openMultiplayerLobby) {
    window.openMultiplayerLobby();
  }
};
