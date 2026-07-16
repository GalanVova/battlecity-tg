function MainMenuController(eventManager, mainMenu) {
  this._eventManager = eventManager;
  this._eventManager.addSubscriber(this, [Keyboard.Event.KEY_PRESSED]);
  this._menu = mainMenu;
  this._active = true;
}

MainMenuController.prototype.notify = function (event) {
  if (event.name == Keyboard.Event.KEY_PRESSED) {
    this.keyPressed(event.key);
  }
};

MainMenuController.prototype.keyPressed = function (key) {
  if (!this._active) return;

  // На компьютере меню теперь можно листать стрелками,
  // при этом старый CTRL/SELECT остаётся рабочим.
  if (key == Keyboard.Key.SELECT || key == Keyboard.Key.DOWN || key == Keyboard.Key.RIGHT) {
    this._menu.nextItem();
  }
  else if (key == Keyboard.Key.UP || key == Keyboard.Key.LEFT) {
    // В старом меню есть только nextItem(), поэтому идём по кругу назад
    // через несколько шагов. Для 4 пунктов достаточно 3 вызовов.
    this._menu.nextItem();
    this._menu.nextItem();
    this._menu.nextItem();
  }
  else if (key == Keyboard.Key.START || key == Keyboard.Key.SPACE) {
    this._menu.executeCurrentItem();
  }
};

MainMenuController.prototype.activate = function () {
  this._active = true;
};

MainMenuController.prototype.deactivate = function () {
  this._active = false;
};
