// The canvas is RES times larger than the 800 x 600 view (the camera zooms by RES), so everything is rendered smoothly in high resolution.
new Phaser.Game({
  type: Phaser.AUTO, width: 800 * RES, height: 600 * RES, parent: 'game',
  backgroundColor: '#1d2b24', pixelArt: false, antialias: true, roundPixels: false,
  scale: { mode: Phaser.Scale.FIT },
  scene: [GameScene]
});
