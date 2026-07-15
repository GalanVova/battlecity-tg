function LivesView2(player) {
  this._player = player;
}

LivesView2.prototype.draw = function (ctx) {
  ctx.fillStyle = "#000000";
  ctx.font = "16px prstart";

  // Рисуем ниже P1 (P1 на y=256, P2 на y=320)
  ctx.drawImage(ImageManager.getImage('roman_one'), 468, 320);

  ctx.fillText("P", 482, 350 - 16);
  ctx.fillText(this._player.getLives(), 482, 350);

  ctx.drawImage(ImageManager.getImage('lives'), 465, 336);
};
