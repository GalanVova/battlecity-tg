// Player2TankController — управление вторым игроком
// Клавиши: W=вверх, S=вниз, A=влево, D=вправо, E=огонь
function Player2TankController(eventManager, tank) {
  this._eventManager = eventManager;
  this._tank = tank;
  this._active = true;
  this._pauseListener = new PauseListener(this._eventManager);
  this._eventManager.addSubscriber(this, [
    Keyboard.Event.KEY_PRESSED,
    Keyboard.Event.KEY_RELEASED,
    BaseExplosion.Event.DESTROYED
  ]);
}

Player2TankController.Key = {
  W: 87, A: 65, S: 83, D: 68, E: 69
};

Player2TankController.prototype.notify = function (event) {
  if (event.name === BaseExplosion.Event.DESTROYED) {
    this._tank.stop();
    this._active = false;
    return;
  }
  if (this._pauseListener.isPaused()) return;

  if (event.name === Keyboard.Event.KEY_PRESSED) {
    this._keyPressed(event.key);
  } else if (event.name === Keyboard.Event.KEY_RELEASED) {
    this._keyReleased(event.key);
  }
};

Player2TankController.prototype._keyPressed = function (key) {
  if (!this._active || !this._tank.canMove()) return;
  if (key === Player2TankController.Key.A) {
    this._tank.setDirection(Sprite.Direction.LEFT);
    this._tank.toNormalSpeed();
  } else if (key === Player2TankController.Key.D) {
    this._tank.setDirection(Sprite.Direction.RIGHT);
    this._tank.toNormalSpeed();
  } else if (key === Player2TankController.Key.W) {
    this._tank.setDirection(Sprite.Direction.UP);
    this._tank.toNormalSpeed();
  } else if (key === Player2TankController.Key.S) {
    this._tank.setDirection(Sprite.Direction.DOWN);
    this._tank.toNormalSpeed();
  } else if (key === Player2TankController.Key.E) {
    this._tank.shoot();
  }
};

Player2TankController.prototype._keyReleased = function (key) {
  var dir = this._tank.getDirection();
  if ((dir === Sprite.Direction.LEFT  && key === Player2TankController.Key.A) ||
      (dir === Sprite.Direction.RIGHT && key === Player2TankController.Key.D) ||
      (dir === Sprite.Direction.UP    && key === Player2TankController.Key.W) ||
      (dir === Sprite.Direction.DOWN  && key === Player2TankController.Key.S)) {
    this._tank.stop();
  }
};
