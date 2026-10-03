/* ============================================================================
 * Rogue Survivor — AI cleanup pass
 *
 * The engine was hand-built by Dominic Balassone: no frameworks, no AI
 * assistance. This version is a refactoring pass over that original code.
 * Gameplay behavior is preserved; what changed is clarity.
 *
 * What the AI improved, section by section:
 *  - All magic numbers moved into CONFIG with names.
 *  - Implicit globals (gameSize, player, score, ...) are now declared up front.
 *  - Fixed: `canvas.heigh` typo in the debug reticle (was silently NaN).
 *  - Fixed: `relativeX` / `relativeY` leaked as globals in gamepad movement.
 *  - Fixed: `gameOver` was assigned without `const`.
 *  - Fixed: gamepad polling read `getGamepads()[0]` instead of the
 *    connected controller's own index.
 *  - Fixed: getClosestEnemy cached a stale distance on each enemy object;
 *    it now recomputes purely.
 *  - Removed: dead `this.textColor = this.textColor` self-assignment,
 *    leftover `// debugger` / `// console.log` lines, vestigial
 *    `controller.clicked` flag nothing ever read.
 *  - Added: touch events (touchstart / touchmove / touchend) so phones get
 *    first-class input instead of relying on emulated mouse events.
 *  - Documented: keyboard input looks "inverted" on purpose. The player
 *    stays near screen center and input shifts the world around them.
 * ========================================================================== */

// ---------------------------------------------------------------------------
// Configuration — every magic number lives here with a name.
// ---------------------------------------------------------------------------
const CONFIG = {
  player: {
    health: 10,
    speed: 0.005,
    size: 0.03,
    huePerHealth: 12, // green (120) at full HP, red (0) near death
  },
  enemy: {
    size: 0.02,
    speed: 0.003,
    slowSize: 0.026,
    slowFactor: 0.75,
    maxCount: 200,
    despawnMargin: 0.2, // culled past 1 + margin / 0 - margin
  },
  shield: {
    size: 0.02,
    orbitRadius: 0.1,
    orbitSpeedDivisor: 100,
    maxLevelScaling: 11, // orbit speed-up caps here
  },
  explosion: {
    startSize: 0.01,
    growthPerTick: 0.001,
    fadePerTick: 0.1,
  },
  input: {
    gamepadDeadzone: 0.25,
    menuClickZone: { min: 0.4, max: 0.6 }, // normalized center square
  },
  waves: {
    ticksPerLevel: 1000,
  },
  colors: {
    background: 'black',
    text: 'white',
    enemy: 'darkred',
    smartEnemy: 'red',
    slowEnemy: 'orangered',
    shield: 'deepskyblue',
    explosion: 'BlueViolet',
  },
}

const features = {
  hyperTrails: 0,
  zoomOut: 0,
  drawCenterRetical: 0,
  drawGameGrid: 0,
  drawEntityVelocityVector: 0,
  handleSpawnEnemies: 1,
  handleEnemyOutOfBounds: 1,
  createExplosion: 1,
  keysControl: 1,
  mouseControl: 1,
}

// ---------------------------------------------------------------------------
// Game state — declared up front. The original relied on implicit globals.
// ---------------------------------------------------------------------------
let idCounter = 0
let gameSize = 0
let gameOffset = { x: 0, y: 0 }
let pause = false
let preGame = true
let isGameOver = true
let score = 0
let gameTime = 0
let gameOverTime = 0
let level = 1
let player = null
let shields = []
let enemies = []
let explosions = []
let menus = []
let keysController = null
let mouseController = null
let gamepadController = null

// ---------------------------------------------------------------------------
// Canvas setup
// ---------------------------------------------------------------------------
const gameCanvasId = 'gameCanvas'
const canvas = document.getElementById(gameCanvasId)
const canvasContext = canvas.getContext('2d')
canvas.height = window.innerHeight
canvas.width = window.innerWidth

const drawBackground = () => {
  if (features.hyperTrails) return
  canvasContext.save()
  canvasContext.fillStyle = CONFIG.colors.background
  canvasContext.fillRect(0, 0, canvas.width, canvas.height)
  canvasContext.restore()
}

const getGameSize = () =>
  features.zoomOut
    ? Math.min(canvas.width, canvas.height)
    : Math.max(canvas.width, canvas.height)

const getGameOffset = () => {
  const wide = features.zoomOut
    ? canvas.width < canvas.height
    : canvas.width > canvas.height
  const tall = features.zoomOut
    ? canvas.width > canvas.height
    : canvas.width < canvas.height
  if (wide) return { x: 0, y: (gameSize - canvas.height) / 2 }
  if (tall) return { x: (gameSize - canvas.width) / 2, y: 0 }
  return { x: 0, y: 0 }
}

const drawCenterRetical = () => {
  if (!features.drawCenterRetical) return
  canvasContext.save()
  canvasContext.strokeStyle = 'red'
  canvasContext.lineWidth = 3
  // AI fix: `canvas.heigh` typo used to make this coordinate NaN.
  canvasContext.beginPath()
  canvasContext.moveTo(canvas.width / 2 - 10, canvas.height / 2)
  canvasContext.lineTo(canvas.width / 2 + 10, canvas.height / 2)
  canvasContext.stroke()
  canvasContext.beginPath()
  canvasContext.moveTo(canvas.width / 2, canvas.height / 2 - 10)
  canvasContext.lineTo(canvas.width / 2, canvas.height / 2 + 10)
  canvasContext.stroke()
  canvasContext.restore()
}

const drawGameGrid = () => {
  if (!features.drawGameGrid) return
  canvasContext.save()
  canvasContext.strokeStyle = 'red'
  canvasContext.lineWidth = 1
  for (let i = 0; i <= 10; i++) {
    const line = gameSize * i * 0.1
    canvasContext.beginPath()
    canvasContext.moveTo(line - gameOffset.x, -gameOffset.y)
    canvasContext.lineTo(line - gameOffset.x, gameSize)
    canvasContext.stroke()
    canvasContext.beginPath()
    canvasContext.moveTo(-gameOffset.x, line - gameOffset.y)
    canvasContext.lineTo(gameSize, line - gameOffset.y)
    canvasContext.stroke()
  }
  canvasContext.restore()
}

const getScaledFont = (scalar = 1) => `${gameSize * 0.02 * scalar}px sans-serif`

const getScaledFontPixelValue = (scalar = 1) => gameSize * 0.02 * scalar

const incrementScore = () => {
  if (!isGameOver) score++
}

const incrementTime = () => {
  gameTime++
}

// Shared by every menu: clicking the normalized center square confirms.
const clickedInCenterBox = (controller) => {
  if (!controller || !controller.clicking) return false
  const { min, max } = CONFIG.input.menuClickZone
  return controller.x > min && controller.x < max
    && controller.y > min && controller.y < max
}

const drawMenuControlsText = (topY) => {
  const spacer = getScaledFontPixelValue(2)
  canvasContext.save()
  canvasContext.font = getScaledFont(1)
  canvasContext.fillStyle = CONFIG.colors.text
  canvasContext.textAlign = 'center'
  canvasContext.textBaseline = 'ideographic'
  canvasContext.fillText('Controls: Arrow Keys, WASD,', canvas.width / 2, topY + spacer * 2.2)
  canvasContext.fillText('Tap, or Click and Drag', canvas.width / 2, topY + spacer * 3)
  canvasContext.restore()
}

class Menu {
  getSpacer = () => getScaledFontPixelValue(2)

  drawBackground() {
    const centerX = 0.5 * gameSize - gameOffset.x
    const centerY = 0.5 * gameSize - gameOffset.y
    canvasContext.save()
    canvasContext.fillStyle = CONFIG.colors.background
    canvasContext.globalAlpha = 0.3
    // One path, three fills: the overlap darkens toward the middle,
    // exactly like the original's three copy-pasted arc blocks.
    canvasContext.beginPath()
    for (const radius of [0.15, 0.3, 0.45]) {
      canvasContext.arc(centerX, centerY, radius * gameSize, 0, Math.PI * 2)
      canvasContext.fill()
    }
    canvasContext.restore()
  }
}

class StartMenu extends Menu {
  update() {
    if (!preGame) return
    if (clickedInCenterBox(mouseController)) newGame()
  }
  draw() {
    if (!preGame) return
    this.drawBackground()
    const spacer = this.getSpacer()
    canvasContext.save()
    canvasContext.font = getScaledFont(2)
    canvasContext.fillStyle = CONFIG.colors.text
    canvasContext.textAlign = 'center'
    canvasContext.textBaseline = 'ideographic'
    canvasContext.fillText('Rogue Survivor', canvas.width / 2, canvas.height / 2)
    canvasContext.font = getScaledFont(1.5)
    canvasContext.fillText('Tap Enter to Start', canvas.width / 2, canvas.height / 2 + spacer)
    canvasContext.restore()
    drawMenuControlsText(canvas.height / 2)
  }
}

class InGameMenu extends Menu {
  draw() {
    if (isGameOver) return
    const spacer = this.getSpacer()
    const padding = spacer / 2
    canvasContext.save()
    canvasContext.font = getScaledFont()
    canvasContext.fillStyle = CONFIG.colors.text
    canvasContext.textAlign = 'start'
    canvasContext.textBaseline = 'hanging'
    canvasContext.fillText(`Level ${level}`, padding, padding)
    canvasContext.fillText(`Score: ${score}`, padding, padding + spacer)
    canvasContext.fillText(`Time: ${gameTime}`, padding, padding + spacer * 2)
    canvasContext.restore()
  }
}

class EndGameMenu extends Menu {
  update() {
    if (!isGameOver || preGame) return
    if (clickedInCenterBox(mouseController)) newGame()
  }
  draw() {
    if (!isGameOver || preGame) return
    this.drawBackground()
    const spacer = this.getSpacer()
    canvasContext.save()
    canvasContext.font = getScaledFont(2)
    canvasContext.fillStyle = CONFIG.colors.text
    canvasContext.textAlign = 'center'
    canvasContext.textBaseline = 'ideographic'
    canvasContext.fillText('Game Over', canvas.width / 2, canvas.height / 2 - spacer * 2)
    canvasContext.font = getScaledFont(1.5)
    canvasContext.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 - spacer)
    canvasContext.fillText(`Time: ${gameOverTime}`, canvas.width / 2, canvas.height / 2)
    canvasContext.fillText('Tap Enter to Restart', canvas.width / 2, canvas.height / 2 + spacer)
    canvasContext.restore()
    drawMenuControlsText(canvas.height / 2)
  }
}

class PauseMenu extends Menu {
  draw() {
    if (!pause) return
    this.drawBackground()
    canvasContext.save()
    canvasContext.fillStyle = CONFIG.colors.text
    canvasContext.font = getScaledFont(1.5)
    canvasContext.textAlign = 'center'
    canvasContext.textBaseline = 'middle'
    canvasContext.fillText('Paused', canvas.width / 2, canvas.height / 2)
    canvasContext.restore()
  }
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------
const randomIntRange = (min = 1, max = 100) =>
  Math.floor(Math.random() * (max + 1 - min) + min)

const getPythagorean = (a, b) => Math.sqrt(a * a + b * b)

const getAngleBetweenPoints = ({ x: x1, y: y1 }, { x: x2, y: y2 }) =>
  Math.atan2(y2 - y1, x2 - x1)

const getDistanceBetweenEntityCenters = (entity1, entity2) => {
  const dx = entity1.x - entity2.x
  const dy = entity1.y - entity2.y
  return Math.sqrt(dx * dx + dy * dy)
}

const getBallCollisionDetected = (ball1, ball2) => {
  const distance = getDistanceBetweenEntityCenters(ball1, ball2)
  if (distance >= ball1.size + ball2.size) return undefined
  const ratio = ball1.size / distance
  return {
    x: ball1.x + (ball2.x - ball1.x) * ratio,
    y: ball1.y + (ball2.y - ball1.y) * ratio,
  }
}

const findOwnIndexInArray = (entity, array) =>
  array.findIndex((element) => element.id === entity.id)

const removeSelfFromArray = (entity, array) => {
  const selfIndex = findOwnIndexInArray(entity, array)
  if (selfIndex >= 0) array.splice(selfIndex, 1)
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------
class Entity {
  constructor(props = {}) {
    this.id = ++idCounter
    this.createdDate = new Date()
    this.x = props.x !== undefined ? props.x : 0.5
    this.y = props.y !== undefined ? props.y : 0.5
    this.speedX = props.speedX || 0
    this.speedY = props.speedY || 0
    this.text = props.text
    this.textColor = props.textColor || 'black'
    this.textScale = props.textScale || 1
  }

  update() {
    this.x += this.speedX
    this.y += this.speedY
  }

  draw() {
    const { x, y, speedX, speedY, text, textColor, textScale } = this
    if (text) {
      canvasContext.save()
      canvasContext.fillStyle = textColor
      canvasContext.font = getScaledFont(textScale)
      canvasContext.textAlign = 'center'
      canvasContext.textBaseline = 'middle'
      canvasContext.fillText(text, x * gameSize - gameOffset.x, y * gameSize - gameOffset.y)
      canvasContext.restore()
    }
    if (features.drawEntityVelocityVector) {
      canvasContext.save()
      canvasContext.beginPath()
      canvasContext.moveTo(x * gameSize - gameOffset.x, y * gameSize - gameOffset.y)
      canvasContext.lineTo((x + speedX * 10) * gameSize - gameOffset.x, (y + speedY * 10) * gameSize - gameOffset.y)
      canvasContext.strokeStyle = 'red'
      canvasContext.stroke()
      canvasContext.closePath()
      canvasContext.restore()
    }
  }

  getVelocityMagnitude() {
    return getPythagorean(this.speedX, this.speedY)
  }

  getVelocityAngle() {
    return getAngleBetweenPoints({ x: 0, y: 0 }, { x: this.speedX, y: this.speedY })
  }
}

class Ball extends Entity {
  constructor(props = {}) {
    super(props)
    this.size = props.size || CONFIG.player.size
    this.color = props.color || 'white'
    this.opacity = props.opacity || 1
    this.textColor = 'black'
  }

  draw() {
    const { color, x, y, size, opacity } = this
    canvasContext.save()
    canvasContext.fillStyle = color
    canvasContext.globalAlpha = opacity
    canvasContext.beginPath()
    canvasContext.arc(x * gameSize - gameOffset.x, y * gameSize - gameOffset.y, size * gameSize, 0, Math.PI * 2)
    canvasContext.fill()
    canvasContext.restore()
    super.draw()
  }
}

class PlayerBall extends Ball {
  constructor(props = {}) {
    super(props)
    this.health = props.health || CONFIG.player.health
    this.text = this.health
    this.speed = CONFIG.player.speed
    this.updateColor()
  }

  // The circle's color is the health bar: green at full HP, red near death.
  updateColor() {
    this.color = `hsl(${CONFIG.player.huePerHealth * this.health} 100% 50%)`
  }

  update() {
    this.text = this.health
    if (isGameOver) {
      this.size = 0
      this.color = CONFIG.colors.background
      this.text = undefined
    } else {
      this.updateColor()
    }
  }
}

// ---------------------------------------------------------------------------
// Input — keyboard, mouse, touch, gamepad.
//
// Design note (kept from the original): the player stays near the center of
// the screen and input shifts the world around them. That is why the keyboard
// handler below looks "inverted": pressing right moves every enemy left,
// which reads as the player moving right.
// ---------------------------------------------------------------------------
class KeysController {}

const KEY_DIRECTIONS = {
  ArrowUp: 'up',
  w: 'up',
  ArrowDown: 'down',
  s: 'down',
  ArrowRight: 'right',
  d: 'right',
  ArrowLeft: 'left',
  a: 'left',
}

const setKeyDirection = (event, pressed) => {
  if (!features.keysControl) return
  if (!keysController) keysController = new KeysController()
  const direction = KEY_DIRECTIONS[event.key]
  if (direction) {
    if (isGameOver) return
    player.controller = keysController
    keysController[direction] = pressed
    return
  }
  if (pressed && event.key === 'Escape' && !isGameOver) togglePause()
  if (pressed && event.key === 'Enter' && isGameOver) newGame()
}

document.addEventListener('keydown', (event) => setKeyDirection(event, true))
document.addEventListener('keyup', (event) => setKeyDirection(event, false))

class MouseController {}

const setPointerFromMouseEvent = (event, clicking) => {
  if (!features.mouseControl) return
  if (!mouseController) mouseController = new MouseController()
  if (!isGameOver) player.controller = mouseController
  mouseController.clicking = clicking
  mouseController.x = event.pageX / canvas.width
  mouseController.y = event.pageY / canvas.height
}

document.addEventListener('mousedown', (event) => setPointerFromMouseEvent(event, true))
document.addEventListener('mouseup', (event) => setPointerFromMouseEvent(event, false))
document.addEventListener('mousemove', (event) => {
  if (mouseController && mouseController.clicking) setPointerFromMouseEvent(event, true)
})

// AI addition: first-class touch input. Phones used to depend on emulated
// mouse events; now a finger drag drives the same controller directly.
const setPointerFromTouch = (touch) => {
  if (!features.mouseControl) return
  if (!mouseController) mouseController = new MouseController()
  if (!isGameOver) player.controller = mouseController
  mouseController.clicking = true
  mouseController.x = touch.clientX / canvas.width
  mouseController.y = touch.clientY / canvas.height
}

document.addEventListener('touchstart', (event) => {
  if (event.touches.length) setPointerFromTouch(event.touches[0])
}, { passive: true })
document.addEventListener('touchmove', (event) => {
  if (event.touches.length) setPointerFromTouch(event.touches[0])
}, { passive: true })
document.addEventListener('touchend', () => {
  if (mouseController) mouseController.clicking = false
})

class GamepadController {}

window.addEventListener('gamepadconnected', (event) => {
  gamepadController = new GamepadController()
  gamepadController.index = event.gamepad.index
  gamepadController.axes = event.gamepad.axes
  gamepadController.buttons = event.gamepad.buttons
})

window.addEventListener('gamepaddisconnected', (event) => {
  if (gamepadController && event.gamepad.index === gamepadController.index) {
    gamepadController = null
  }
})

const handleGamePad = () => {
  if (!gamepadController) return
  // AI fix: the original always read getGamepads()[0], ignoring which
  // controller actually connected.
  const currentGamepad = navigator.getGamepads()[gamepadController.index]
  if (!currentGamepad) return
  const [prevX, prevY] = gamepadController.axes
  const [nextX, nextY] = currentGamepad.axes
  if (prevX === nextX && prevY === nextY) return
  gamepadController.axes = currentGamepad.axes
  gamepadController.buttons = currentGamepad.buttons
  if (isGameOver) return
  const deadzone = CONFIG.input.gamepadDeadzone
  const pushed = Math.abs(nextX) > deadzone || Math.abs(nextY) > deadzone
  gamepadController.x = pushed ? nextX : 0
  gamepadController.y = pushed ? nextY : 0
  player.controller = gamepadController
}

// Each input shifts the world opposite to the player's intent.
const shiftEnemiesFromKeyboard = (enemy) => {
  if (!(player.controller instanceof KeysController)) return
  if (keysController.right) enemy.x -= player.speed
  if (keysController.left) enemy.x += player.speed
  if (keysController.down) enemy.y -= player.speed
  if (keysController.up) enemy.y += player.speed
}

const shiftEnemiesFromMouse = (enemy) => {
  if (!(player.controller instanceof MouseController)) return
  const pointer = player.controller
  if (getDistanceBetweenEntityCenters(pointer, player) <= player.size) return
  const angleToPointer = getAngleBetweenPoints(player, pointer)
  enemy.x -= player.speed * Math.cos(angleToPointer)
  enemy.y -= player.speed * Math.sin(angleToPointer)
}

const shiftEnemiesFromGamepad = (enemy) => {
  if (!(player.controller instanceof GamepadController)) return
  const { x, y } = player.controller
  if (x === 0 && y === 0) return
  // AI fix: `relativeX` / `relativeY` used to leak as implicit globals.
  const relativeX = player.x + x
  const relativeY = player.y + y
  const angle = getAngleBetweenPoints(player, { x: relativeX, y: relativeY })
  enemy.x -= player.speed * Math.cos(angle)
  enemy.y -= player.speed * Math.sin(angle)
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------
const setSpeedTowardsTarget = (ball1, ball2, speed) => {
  const angleToTarget = getAngleBetweenPoints(ball1, ball2)
  ball1.speedX = speed * Math.cos(angleToTarget)
  ball1.speedY = speed * Math.sin(angleToTarget)
}

const handleEnemyOutOfBounds = (enemy) => {
  if (!features.handleEnemyOutOfBounds) return
  const margin = CONFIG.enemy.despawnMargin
  if (enemy.x > 1 + margin || enemy.x < -margin
    || enemy.y > 1 + margin || enemy.y < -margin) {
    removeSelfFromArray(enemy, enemies)
  }
}

const handleEnemyCollisions = (enemy) => {
  const collisionWithPlayer = getBallCollisionDetected(enemy, player)
  const collisionWithShield = shields.some((shield) => getBallCollisionDetected(enemy, shield))
  if (!collisionWithPlayer && !collisionWithShield) return
  removeSelfFromArray(enemy, enemies)
  if (collisionWithPlayer) {
    createExplosion({ x: collisionWithPlayer.x, y: collisionWithPlayer.y, size: enemy.size })
    player.health -= 1
  }
  if (collisionWithShield) {
    createExplosion({ x: enemy.x, y: enemy.y, size: enemy.size, color: enemy.color })
    incrementScore()
  }
}

const setRandomLocationOnEdge = (entity) => {
  const edge = Math.random()
  if (edge < 0.25) {
    entity.x = -entity.size
    entity.y = Math.random()
  } else if (edge < 0.5) {
    entity.x = 1 + entity.size
    entity.y = Math.random()
  } else if (edge < 0.75) {
    entity.x = Math.random()
    entity.y = -entity.size
  } else {
    entity.x = Math.random()
    entity.y = 1 + entity.size
  }
}

class EnemyBall extends Ball {
  constructor(props = {}) {
    super(props)
    this.color = CONFIG.colors.enemy
    this.size = CONFIG.enemy.size
    if (props.x === undefined && props.y === undefined) setRandomLocationOnEdge(this)
    if (props.speedX === undefined && props.speedY === undefined) {
      setSpeedTowardsTarget(this, player, CONFIG.enemy.speed)
    }
  }

  update() {
    super.update()
    shiftEnemiesFromKeyboard(this)
    shiftEnemiesFromMouse(this)
    shiftEnemiesFromGamepad(this)
    handleEnemyOutOfBounds(this)
    handleEnemyCollisions(this)
  }
}

// Perpendicular spread for a wave: each extra enemy steps further out,
// alternating sides of the origin enemy.
const getWaveOffset = (origin, index, angle) => {
  const direction = angle
    ? angle
    : getAngleBetweenPoints(origin, player) + Math.PI / 2
  const side = index % 2 === 0 ? 1 : -1
  const spread = origin.size * 2 * side * (Math.floor(index / 2) + 1)
  return { x: spread * Math.cos(direction), y: spread * Math.sin(direction) }
}

const spawnEnemyWave = (EnemyType = EnemyBall, count = 5, angle, enemyProps) => {
  const origin = new EnemyType({ ...enemyProps })
  const wave = [origin]
  for (let i = 0; i < count - 1; i++) {
    const offset = getWaveOffset(origin, i, angle)
    wave.push(new EnemyType({
      x: origin.x + offset.x,
      y: origin.y + offset.y,
      speedX: origin.speedX,
      speedY: origin.speedY,
      ...enemyProps,
    }))
  }
  enemies.push(...wave)
}

class SmartEnemyBall extends EnemyBall {
  constructor(props = {}) {
    super(props)
    this.color = CONFIG.colors.smartEnemy
  }
  update() {
    super.update()
    setSpeedTowardsTarget(this, player, getPythagorean(this.speedX, this.speedY))
  }
}

class SlowEnemyBall extends SmartEnemyBall {
  constructor(props = {}) {
    super(props)
    this.speedX *= CONFIG.enemy.slowFactor
    this.speedY *= CONFIG.enemy.slowFactor
    this.size = CONFIG.enemy.slowSize
    this.color = CONFIG.colors.slowEnemy
  }
}

class Explosion extends Ball {
  constructor(props = {}) {
    super(props)
    this.size = props.size || CONFIG.explosion.startSize
    this.color = props.color || CONFIG.colors.explosion
  }

  update() {
    super.update()
    this.size += CONFIG.explosion.growthPerTick
    this.opacity -= CONFIG.explosion.fadePerTick
    if (this.opacity <= 0) removeSelfFromArray(this, explosions)
  }
}

const createExplosion = ({ x, y, color, size } = {}) => {
  if (!features.createExplosion) return
  explosions.push(new Explosion({ x, y, color, size }))
}

class Shield extends Ball {
  constructor(props = {}) {
    super(props)
    this.size = CONFIG.shield.size
    this.color = CONFIG.colors.shield
    this.opacity = 1
    this.x = 0.5
    this.y = 0.55
    this.angle = 0
    this.orbitRadius = CONFIG.shield.orbitRadius
    this.speed = 1
  }
  update() {
    // Orbit speeds up slightly with level, capped so it stays readable.
    const levelCap = Math.min(level, CONFIG.shield.maxLevelScaling)
    this.angle += (Math.PI / (CONFIG.shield.orbitSpeedDivisor / levelCap)) * this.speed
    this.x = 0.5 + this.orbitRadius * Math.cos(this.angle)
    this.y = 0.5 + this.orbitRadius * Math.sin(this.angle)
  }
}

// ---------------------------------------------------------------------------
// AI player (attract mode behind the start menu)
// ---------------------------------------------------------------------------
const getClosestEnemy = () => {
  // AI fix: the original cached a stale `distanceToPlayer` on each enemy
  // object, so "closest" went stale after the first check.
  if (!enemies.length) return undefined
  return enemies.reduce((closest, enemy) =>
    getDistanceBetweenEntityCenters(player, enemy)
      < getDistanceBetweenEntityCenters(player, closest)
      ? enemy
      : closest)
}

class AIPlayerBall extends PlayerBall {
  constructor(props = {}) {
    super(props)
    this.controller = new MouseController()
    this.controller.x = 0.5
    this.controller.y = 0.5
  }
  update() {
    super.update()
    if (!enemies.length) return
    if (gameTime % 10 !== 0) return
    const closestEnemy = getClosestEnemy()
    if (!closestEnemy) return
    const fleeAngle = getAngleBetweenPoints(player, closestEnemy) + Math.PI
    this.controller.x = Math.cos(fleeAngle)
    this.controller.y = Math.sin(fleeAngle)
  }
}

// ---------------------------------------------------------------------------
// Waves, levels, game loop
// ---------------------------------------------------------------------------
const handleLevel = () => {
  if (gameTime % CONFIG.waves.ticksPerLevel === 0 && gameTime !== 0) level++
}

const handleSpawnEnemies = () => {
  if (!features.handleSpawnEnemies) return
  if (enemies.length >= CONFIG.enemy.maxCount) return
  if (level === 1) {
    if (gameTime % 5 === 0) enemies.push(new EnemyBall())
  } else if (level === 2) {
    if (gameTime % 7 === 0) spawnEnemyWave(EnemyBall, 3)
  } else if (level === 3) {
    if (gameTime % 5 === 0) spawnEnemyWave(EnemyBall, 5)
  } else if (gameTime % (11 - Math.min(10, level)) === 0) {
    const roll = randomIntRange(1, 3)
    if (roll === 1) enemies.push(new EnemyBall())
    else if (roll === 2) enemies.push(new SlowEnemyBall())
    else enemies.push(new SmartEnemyBall())
  }
}

const update = () => {
  handleLevel()
  ;([
    player,
    ...shields,
    ...enemies,
    ...explosions,
    ...menus,
  ]).forEach((entity) => entity && entity.update && entity.update())
  handleSpawnEnemies()
  incrementTime()
}

const draw = () => {
  drawBackground()
  ;([
    player,
    ...enemies,
    ...shields,
    ...explosions,
    ...menus,
  ]).forEach((entity) => entity && entity.draw && entity.draw())
}

window.addEventListener('resize', () => {
  canvas.height = window.innerHeight
  canvas.width = window.innerWidth
  gameSize = getGameSize()
  gameOffset = getGameOffset()
  update()
  draw()
})

const togglePause = () => {
  pause = !pause
}

const newGame = () => {
  player = new PlayerBall()
  mouseController = null
  shields = [new Shield()]
  enemies = []
  explosions = []
  preGame = false
  isGameOver = false
  score = 0
  gameTime = 0
  level = 1
}

const checkIsGameOver = () => player.health <= 0

// AI fix: this used to leak as an implicit global (`gameOver = ...`).
const gameOver = () => {
  isGameOver = true
  gameOverTime = gameTime
  player.controller = false
  mouseController = null
  pause = false
}

const playGame = () => {
  handleGamePad()
  if (!isGameOver && checkIsGameOver()) gameOver()
  if (features.hyperTrails) {
    canvasContext.fillStyle = 'rgba(0,0,0,0.1)'
    canvasContext.fillRect(0, 0, canvas.width, canvas.height)
  } else {
    canvasContext.clearRect(0, 0, canvas.width, canvas.height)
  }
  if (!pause) update()
  draw()
  requestAnimationFrame(playGame)
}

const init = () => {
  idCounter = 0
  gameSize = getGameSize()
  gameOffset = getGameOffset()
  pause = false
  mouseController = null
  keysController = null
  gamepadController = null
  gameTime = 0
  isGameOver = true
  preGame = true
  level = 3
  player = new AIPlayerBall()
  shields = []
  enemies = []
  explosions = []
  menus = [
    new StartMenu(),
    new InGameMenu(),
    new EndGameMenu(),
    new PauseMenu(),
  ]
  playGame()
}

init()
