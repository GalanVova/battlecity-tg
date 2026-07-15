function PlayerTankControllerFactory(eventManager) {
  this._eventManager = eventManager;
  this._eventManager.addSubscriber(this, [PlayerTankFactory.Event.PLAYER_TANK_CREATED]);
}

PlayerTankControllerFactory.prototype.notify = function (event) {
  if (event.name == PlayerTankFactory.Event.PLAYER_TANK_CREATED) {
    this.create(event.tank, event.controllerType);
  }
};

PlayerTankControllerFactory.prototype.create = function (tank, controllerType) {
  if (controllerType === 'player2') {
    return new Player2TankController(this._eventManager, tank);
  }
  return new TankController(this._eventManager, tank);
};