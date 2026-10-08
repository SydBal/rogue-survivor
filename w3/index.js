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
// Dungeon state: acts of 3 free-choice rooms + a boss, then endless.
let actNumber = 1
let actMap = null
let currentRoom = null
let destinationMarker = null
let mapOpen = false
let roomClearOpen = false
// Act splash: full-screen "ACT N" card when a new act's map opens.
let actSplashT = 0
const ACT_SPLASH_SECS = 1.8
// Room countdown: 3-2-1-GO at room start; enemies and spawners frozen.
let countdownT = 0
let goT = 0
const COUNTDOWN_SECS = 3
const GO_SECS = 0.7
// Fade-through-black between full-screen states. startTransition swaps the
// state at the black point; it never stacks (re-entry just cuts).
// The route taken through the current act, as node ids. Drives path lighting.
let playerPath = []
let transitionT = 0
let transitionMid = null
const TRANSIT_SECS = 0.3
const startTransition = (midFn) => {
  if (transitionT > 0) { midFn(); return }
  transitionMid = midFn
  transitionT = TRANSIT_SECS
}
let roomClearInfo = null
let bossBag = []

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

class Menu {
  getSpacer = () => getScaledFontPixelValue(2)

  constructor() {
    this.openAnimT = 0 // 0..1, menu open fade+rise progress
  }

  // Call every update with whether the menu is currently shown.
  tickOpenAnim(visible) {
    this.openAnimT = visible ? Math.min(1, this.openAnimT + 1 / 14) : 0
  }

  // Inside draw(), within save()/restore(): fade in and rise slightly.
  applyOpenAnim() {
    const e = 1 - Math.pow(1 - this.openAnimT, 3) // easeOutCubic
    canvasContext.globalAlpha *= e
    canvasContext.translate(0, (1 - e) * Math.max(6, gameSize * 0.012))
  }

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
  constructor() {
    super()
    this.focus = new SurvivorFocusManager()
    this.container = new SurvivorContainer({ title: 'Rogue Survivor' })
    this.startButton = new SurvivorButton({
      id: 'start-game',
      label: 'Start Game',
      onClick: () => startTransition(() => newGame()),
    })
    this.howToButton = new SurvivorButton({
      id: 'how-to-play',
      label: 'How to Play',
      onClick: () => this.howToModal.open(this.focus),
    })
    this.buttons = [this.startButton, this.howToButton]
    this.focus.registerAll(this.buttons)
    this.focus.setFocusById('start-game')
    this.howToModal = new SurvivorModal({
      title: 'How to Play',
      bodyLines: [
        'You are a circle. Red circles want you dead.',
        'Your shield orbits you and smashes them.',
        'Circle color is your health: green to red.',
        { text: 'Move: WASD / arrows / left stick', dim: true },
        { text: 'Or: click / tap and drag', dim: true },
        { text: 'Pause: Escape', dim: true },
      ],
      buttons: [
        new SurvivorButton({
          id: 'close-how-to',
          label: 'Close',
          onClick: () => this.howToModal.close(),
        }),
      ],
    })
  }
  update() {
    if (!preGame) return
    // The open modal owns the pointer; menu buttons behind it stay inert.
    if (!this.howToModal.visible) updateMenuPanel(this)
    this.howToModal.update(getPointerPixels())
  }
  fitWidth() {
    return fitTitledPanel(this)
  }
  draw() {
    if (!preGame) return
    this.drawBackground()
    drawMenuPanel(this)
    this.howToModal.draw()
  }
  handleKeyDown(event) {
    if (!preGame) return false
    if (this.howToModal.visible) return this.howToModal.handleKeyDown(event)
    return this.focus.handleKeyDown(event)
  }
  handleGamepadEscape() {
    if (this.howToModal.visible) {
      this.howToModal.close()
      return true
    }
    return false
  }
}

class InGameMenu extends Menu {
  draw() {
    if (isGameOver) return
    const spacer = this.getSpacer()
    const padding = spacer / 2
    const roomLabel = currentRoom
      ? (currentRoom.type === 'boss' ? 'Boss' : `Room ${actMap.roundIndex + 1}/3`)
      : (mapOpen || roomClearOpen ? 'Choosing' : '')
    canvasContext.save()
    canvasContext.font = getScaledFont()
    canvasContext.fillStyle = CONFIG.colors.text
    canvasContext.textAlign = 'start'
    canvasContext.textBaseline = 'hanging'
    canvasContext.fillText(`Act ${actNumber}`, padding, padding)
    canvasContext.fillText(roomLabel, padding, padding + spacer)
    canvasContext.fillText(`Score: ${score}`, padding, padding + spacer * 2)
    canvasContext.fillText(`Time: ${gameTime}`, padding, padding + spacer * 3)
    canvasContext.restore()
  }
}

class EndGameMenu extends Menu {
  constructor() {
    super()
    this.focus = new SurvivorFocusManager()
    this.container = new SurvivorContainer({ title: 'Game Over' })
    this.restartButton = new SurvivorButton({
      id: 'play-again',
      label: 'Play Again',
      onClick: () => startTransition(() => newGame()),
    })
    this.buttons = [this.restartButton]
    this.focus.registerAll(this.buttons)
    this.focus.setFocusById('play-again')
  }
  statLines() {
    return [`Score: ${score}`, `Time: ${gameOverTime}`, `Level reached: ${level}`]
  }
  statFontPx() {
    return Math.round(uiFontBase() * SurvivorDimensions.statMul)
  }
  // Three stat lines between the title and the button.
  bodyHeight() {
    const D = SurvivorDimensions
    return uiPx(D.fontBase * D.lineHMul) * 3 + Math.round(uiFontBase() * D.gapMul)
  }
  fitWidth() {
    return fitTitledPanel(this, this.statLines(), this.statFontPx())
  }
  update() {
    this.tickOpenAnim(isGameOver && !preGame)
    if (!isGameOver || preGame) return
    updateMenuPanel(this)
  }
  draw() {
    if (!isGameOver || preGame) return
    canvasContext.save()
    this.applyOpenAnim()
    this.drawBackground()
    const lineH = uiPx(SurvivorDimensions.fontBase * SurvivorDimensions.lineHMul)
    const fontPx = this.statFontPx()
    const lines = this.statLines()
    drawMenuPanel(this, () => {
      const t = SurvivorUITheme
      canvasContext.font = `${fontPx}px ${t.fontFamily}`
      canvasContext.textAlign = 'center'
      canvasContext.textBaseline = 'middle'
      const cx = this.container.x + this.container.width / 2
      const topY = this.container.y + this.container.padding
        + this.container.headerHeight() + lineH / 2
      lines.forEach((line, i) => {
        canvasContext.fillStyle = i < 2 ? t.text : t.textDim
        canvasContext.fillText(line, cx, topY + i * lineH)
      })
    })
    canvasContext.restore()
  }
  handleKeyDown(event) {
    if (!isGameOver || preGame) return false
    return this.focus.handleKeyDown(event)
  }
  handleGamepadEscape() {
    return false
  }
}

class PauseMenu extends Menu {
  constructor() {
    super()
    this.focus = new SurvivorFocusManager()
    this.container = new SurvivorContainer({ title: 'Paused' })
    this.resumeButton = new SurvivorButton({
      id: 'resume',
      label: 'Resume',
      onClick: () => togglePause(),
    })
    this.restartButton = new SurvivorButton({
      id: 'restart',
      label: 'Restart',
      onClick: () => startTransition(() => {
        togglePause()
        newGame()
      }),
    })
    this.buttons = [this.resumeButton, this.restartButton]
    this.focus.registerAll(this.buttons)
    this.focus.setFocusById('resume')
  }
  fitWidth() {
    return fitTitledPanel(this)
  }
  update() {
    this.tickOpenAnim(pause)
    if (!pause) return
    updateMenuPanel(this)
  }
  draw() {
    if (!pause) return
    canvasContext.save()
    this.applyOpenAnim()
    // Dim the frozen game frame behind the panel.
    canvasContext.fillStyle = SurvivorUITheme.backdrop
    canvasContext.fillRect(0, 0, canvas.width, canvas.height)
    drawMenuPanel(this)
    canvasContext.restore()
  }
  handleKeyDown(event) {
    if (!pause) return false
    return this.focus.handleKeyDown(event)
  }
  handleGamepadEscape() {
    togglePause()
    return true
  }
}

// Which menu (if any) owns the screen right now. Keyboard and gamepad menu
// input routes here before the gameplay handlers see it.
const getActiveMenu = () => {
  if (roomClearOpen) return menus.find((menu) => menu instanceof RoomClearMenu)
  if (mapOpen) return menus.find((menu) => menu instanceof MapMenu)
  if (pause) return menus.find((menu) => menu instanceof PauseMenu)
  if (preGame) return menus.find((menu) => menu instanceof StartMenu)
  if (isGameOver) return menus.find((menu) => menu instanceof EndGameMenu)
  return undefined
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
    this.iframes = 0 // invulnerability ticks after taking a hit (boss contact)
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
    if (this.iframes > 0) this.iframes--
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
  if (pressed && event.key === 'Escape' && !isGameOver && !mapOpen && !roomClearOpen) togglePause()
  if (pressed && event.key === 'Enter' && isGameOver) startTransition(() => newGame())
}

document.addEventListener('keydown', (event) => {
  // Menus get first claim: Tab / arrows move focus, Enter / Space activates.
  const activeMenu = getActiveMenu()
  if (activeMenu && activeMenu.handleKeyDown(event)) {
    event.preventDefault()
    return
  }
  setKeyDirection(event, true)
})
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

// The listeners are non-passive and preventDefault: with touch-action: none
// in CSS this double-locks the browser out of hijacking the drag for
// scroll, pinch-zoom, or pull-to-refresh while steering.
document.addEventListener('touchstart', (event) => {
  event.preventDefault()
  if (event.touches.length) setPointerFromTouch(event.touches[0])
}, { passive: false })
document.addEventListener('touchmove', (event) => {
  event.preventDefault()
  if (event.touches.length) setPointerFromTouch(event.touches[0])
}, { passive: false })
document.addEventListener('touchend', (event) => {
  event.preventDefault()
  if (mouseController) mouseController.clicking = false
}, { passive: false })
document.addEventListener('touchcancel', () => {
  if (mouseController) mouseController.clicking = false
}, { passive: true })
// Legacy iOS pinch gesture.
document.addEventListener('gesturestart', (event) => event.preventDefault())

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

// Gamepad menu navigation: d-pad moves focus, A activates, B is Escape.
// Mirrors the keyboard path through each menu's focus manager (which honors
// modal focus trapping), so controller users get the same menus.
const handleGamepadMenu = (activeMenu, gamepad) => {
  const pressed = (i) => !!(gamepad.buttons[i] && gamepad.buttons[i].pressed)
  const prev = gamepadController.menuButtons || []
  const edge = (i) => pressed(i) && !prev[i]
  const focus = activeMenu.focus
  if (edge(12) || edge(14)) focus.focusPrevious()
  else if (edge(13) || edge(15)) focus.focusNext()
  else if (edge(0)) {
    const current = focus.getCurrentFocus()
    if (current && current.activate) current.activate()
  } else if (edge(1)) {
    activeMenu.handleGamepadEscape()
  }
  gamepadController.menuButtons = gamepad.buttons.map((button) => button.pressed)
}

const handleGamePad = () => {
  if (!gamepadController) return
  // AI fix: the original always read getGamepads()[0], ignoring which
  // controller actually connected.
  const currentGamepad = navigator.getGamepads()[gamepadController.index]
  if (!currentGamepad) return
  const activeMenu = getActiveMenu()
  if (activeMenu) {
    handleGamepadMenu(activeMenu, currentGamepad)
    return
  }
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
  // Bosses don't die on contact: shields chip their HP, and touching the
  // boss hurts the player (gated by invulnerability frames so one touch
  // isn't a multi-hit).
  if (enemy.isBoss) {
    if (collisionWithShield) enemy.takeShieldHit()
    if (collisionWithPlayer && player.iframes <= 0) {
      player.iframes = 90
      createExplosion({ x: collisionWithPlayer.x, y: collisionWithPlayer.y, size: enemy.size })
      player.health -= 1
    }
    return
  }
  removeSelfFromArray(enemy, enemies)
  if (collisionWithPlayer) {
    createExplosion({ x: collisionWithPlayer.x, y: collisionWithPlayer.y, size: enemy.size })
    player.health -= 1
  }
  if (collisionWithShield) {
    createExplosion({ x: enemy.x, y: enemy.y, size: enemy.size, color: enemy.color })
    incrementScore()
    if (currentRoom) currentRoom.kills++
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
// Dungeon — acts of 3 free-choice rooms + a boss, Slay-the-Spire style.
// Then endless acts with scaling difficulty.
//
// Flow: newGame → act 1 map → pick a room → clear it → room stats → map → …
// → boss room → boss dies → next act map → … Player death → game over.
// Everything (health, shields, score, time) carries between rooms; each room
// just resets enemies.
// ---------------------------------------------------------------------------
const ROOM_TYPES = {
  extermination: { label: 'Exterminate', color: '#ef4444', letter: 'E' },
  survival: { label: 'Survive', color: '#38bdf8', letter: 'S' },
  destination: { label: 'Reach', color: '#a78bfa', letter: 'R' },
}

const ENEMY_MIXES = {
  swarm: { label: 'Swarm', desc: 'fast chasers' },
  hunters: { label: 'Hunters', desc: 'smart homers' },
  brutes: { label: 'Brutes', desc: 'slow tanks' },
}
const MIX_CLASSES = { swarm: EnemyBall, hunters: SmartEnemyBall, brutes: SlowEnemyBall }

const BOSS_INFO = {
  tyrant: { name: 'Hive Tyrant', color: '#c2410c' },
  reaper: { name: 'Dash Reaper', color: '#a21caf' },
  warden: { name: 'The Warden', color: '#1e40af' },
}

const shuffled = (arr) => {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Shuffle-bag: cycle through all three bosses before any repeat.
const drawBossType = () => {
  if (!bossBag.length) bossBag = shuffled(Object.keys(BOSS_INFO))
  return bossBag.pop()
}

const generateAct = (actNum) => {
  const rounds = []
  for (let r = 0; r < 3; r++) {
    // Every round offers all three room types; enemy mixes are shuffled.
    const types = shuffled(Object.keys(ROOM_TYPES))
    const mixes = shuffled(Object.keys(ENEMY_MIXES))
    rounds.push(types.map((type, i) => ({ type, mix: mixes[i], picked: false })))
  }
  return { number: actNum, rounds, roundIndex: 0, bossType: drawBossType() }
}

const actSpeedMul = () => 1 + (actNumber - 1) * 0.12

class Room {
  constructor({ type, mix, act }) {
    this.type = type
    this.mix = mix
    this.act = act
    this.cleared = false
    this.kills = 0
    this.roomStartTime = gameTime
    if (type === 'survival') this.duration = 1500 // ~25s at 60fps
  }
  get label() {
    return `${ROOM_TYPES[this.type].label} · ${ENEMY_MIXES[this.mix].label}`
  }
  start() {
    enemies = []
    explosions = []
    destinationMarker = null
    this.kills = 0
    this.roomStartTime = gameTime
    if (this.type === 'extermination') this.toSpawn = 8 + this.act * 2
    if (this.type === 'destination') {
      const angle = Math.random() * Math.PI * 2
      destinationMarker = new DestinationMarker({ angle, distance: 2.5 })
    }
  }
  spawnOne() {
    const Cls = MIX_CLASSES[this.mix]
    const e = new Cls({})
    const sp = getPythagorean(e.speedX, e.speedY) * actSpeedMul()
    setSpeedTowardsTarget(e, player, sp || CONFIG.enemy.speed * actSpeedMul())
    enemies.push(e)
  }
  spawnTick() {
    if (!features.handleSpawnEnemies) return
    if (enemies.length >= CONFIG.enemy.maxCount) return
    if (this.type === 'extermination') {
      if (this.toSpawn <= 0) return
      if (gameTime % 40 === 0) {
        const n = Math.min(3, this.toSpawn)
        for (let i = 0; i < n; i++) this.spawnOne()
        this.toSpawn -= n
      }
      return
    }
    const every = this.type === 'destination' ? 150 : 45
    if (gameTime % every === 0) this.spawnOne()
  }
  checkCleared() {
    if (this.type === 'extermination') return this.toSpawn <= 0 && enemies.length === 0
    if (this.type === 'survival') return gameTime - this.roomStartTime >= this.duration
    if (this.type === 'destination') return !!destinationMarker && destinationMarker.reached()
    return false
  }
}

// A world-fixed point the player must reach. Shifts with the world exactly
// like enemies do, so steering toward it works with the inverted controls.
class DestinationMarker extends Entity {
  constructor({ angle, distance }) {
    super({})
    this.x = 0.5 + Math.cos(angle) * distance
    this.y = 0.5 + Math.sin(angle) * distance
    this.pulse = 0
  }
  update() {
    shiftEnemiesFromKeyboard(this)
    shiftEnemiesFromMouse(this)
    shiftEnemiesFromGamepad(this)
    this.pulse++
  }
  reached() {
    return getDistanceBetweenEntityCenters(this, player) < 0.06
  }
  draw() {
    const sx = this.x * gameSize - gameOffset.x
    const sy = this.y * gameSize - gameOffset.y
    const onScreen = sx > 0 && sx < canvas.width && sy > 0 && sy < canvas.height
    canvasContext.save()
    if (onScreen) {
      const r = (0.03 + 0.008 * Math.sin(this.pulse / 12)) * gameSize
      canvasContext.strokeStyle = '#a78bfa'
      canvasContext.lineWidth = 3
      canvasContext.beginPath()
      canvasContext.arc(sx, sy, r, 0, Math.PI * 2)
      canvasContext.stroke()
      const d = r * 0.45
      canvasContext.fillStyle = '#a78bfa'
      canvasContext.beginPath()
      canvasContext.moveTo(sx, sy - d)
      canvasContext.lineTo(sx + d, sy)
      canvasContext.lineTo(sx, sy + d)
      canvasContext.lineTo(sx - d, sy)
      canvasContext.closePath()
      canvasContext.fill()
    } else {
      // Off-screen: arrow on the nearest edge pointing toward it.
      const cx = Math.max(30, Math.min(canvas.width - 30, sx))
      const cy = Math.max(30, Math.min(canvas.height - 30, sy))
      canvasContext.translate(cx, cy)
      canvasContext.rotate(Math.atan2(sy - cy, sx - cx))
      canvasContext.fillStyle = '#a78bfa'
      canvasContext.beginPath()
      canvasContext.moveTo(18, 0)
      canvasContext.lineTo(-8, -12)
      canvasContext.lineTo(-8, 12)
      canvasContext.closePath()
      canvasContext.fill()
    }
    canvasContext.restore()
  }
}

// ---------------------------------------------------------------------------
// Bosses. Everything else dies in one shield hit; bosses have HP that shield
// hits decrement, and touching one hurts the player (gated by i-frames).
// ---------------------------------------------------------------------------
class BossBall extends Ball {
  constructor(props = {}) {
    super(props)
    this.isBoss = true
    this.hp = props.hp || 10
    this.maxHp = this.hp
  }
  takeShieldHit() {
    this.hp -= 1
    createExplosion({ x: this.x, y: this.y, size: this.size * 0.4, color: 'white' })
    if (this.hp <= 0) killBoss(this)
  }
  update() {
    super.update()
    shiftEnemiesFromKeyboard(this)
    shiftEnemiesFromMouse(this)
    shiftEnemiesFromGamepad(this)
    handleEnemyCollisions(this)
  }
  draw() {
    super.draw()
    const w = this.size * gameSize * 1.8
    const x = this.x * gameSize - gameOffset.x - w / 2
    const y = this.y * gameSize - gameOffset.y - this.size * gameSize - 14
    canvasContext.save()
    canvasContext.fillStyle = 'rgba(255,255,255,0.25)'
    canvasContext.fillRect(x, y, w, 6)
    canvasContext.fillStyle = '#e11d48'
    canvasContext.fillRect(x, y, w * Math.max(0, this.hp / this.maxHp), 6)
    canvasContext.restore()
  }
}

// Huge, slow, and fertile: births waves of chasers while you chip its HP.
class HiveTyrant extends BossBall {
  constructor(props = {}) {
    super({ hp: 10 + (props.act || 1) * 2, size: 0.07, color: BOSS_INFO.tyrant.color, ...props })
    this.spawnTimer = 0
    setRandomLocationOnEdge(this)
    setSpeedTowardsTarget(this, player, CONFIG.enemy.speed * 0.5)
  }
  update() {
    setSpeedTowardsTarget(this, player, CONFIG.enemy.speed * 0.5 * actSpeedMul())
    super.update()
    this.spawnTimer++
    if (this.spawnTimer % 220 === 0 && enemies.length < CONFIG.enemy.maxCount - 6) {
      spawnEnemyWave(EnemyBall, 4)
    }
  }
}

// Stalks, flashes, then dashes at where you were standing. Dodge the dash,
// punish the recovery.
class DashReaper extends BossBall {
  constructor(props = {}) {
    super({ hp: 8 + (props.act || 1) * 2, size: 0.05, color: BOSS_INFO.reaper.color, ...props })
    this.state = 'stalk'
    this.stateTimer = 0
    setRandomLocationOnEdge(this)
  }
  update() {
    this.stateTimer++
    const mul = actSpeedMul()
    if (this.state === 'stalk') {
      setSpeedTowardsTarget(this, player, CONFIG.enemy.speed * 0.7 * mul)
      if (this.stateTimer > 160) { this.state = 'telegraph'; this.stateTimer = 0 }
    } else if (this.state === 'telegraph') {
      this.speedX = 0
      this.speedY = 0
      if (this.stateTimer > 55) {
        this.state = 'dash'
        this.stateTimer = 0
        setSpeedTowardsTarget(this, player, CONFIG.enemy.speed * 6 * mul)
      }
    } else if (this.state === 'dash') {
      if (this.stateTimer > 40) { this.state = 'recover'; this.stateTimer = 0 }
    } else {
      this.speedX *= 0.94
      this.speedY *= 0.94
      if (this.stateTimer > 80) { this.state = 'stalk'; this.stateTimer = 0 }
    }
    super.update()
  }
  draw() {
    if (this.state === 'telegraph' && Math.floor(this.stateTimer / 6) % 2 === 0) {
      const original = this.color
      this.color = '#ffffff'
      super.draw()
      this.color = original
      return
    }
    super.draw()
  }
}

// A slow core ringed by guard orbs. Guards die like normal enemies but the
// Warden reforges one every few seconds — find angles through the ring.
class GuardOrb extends Ball {
  constructor({ boss, angle }) {
    super({ x: boss.x, y: boss.y, size: CONFIG.enemy.size * 0.85, color: '#60a5fa' })
    this.boss = boss
    this.orbitAngle = angle
  }
  update() {
    this.orbitAngle += 0.035
    const r = this.boss.size + 0.055
    setSpeedTowardsTarget(this,
      { x: this.boss.x + r * Math.cos(this.orbitAngle), y: this.boss.y + r * Math.sin(this.orbitAngle) },
      CONFIG.enemy.speed * 2.5)
    super.update()
    shiftEnemiesFromKeyboard(this)
    shiftEnemiesFromMouse(this)
    shiftEnemiesFromGamepad(this)
    handleEnemyCollisions(this)
  }
}

class Warden extends BossBall {
  constructor(props = {}) {
    super({ hp: 10 + (props.act || 1) * 2, size: 0.06, color: BOSS_INFO.warden.color, ...props })
    this.guardTimer = 0
    setRandomLocationOnEdge(this)
    for (let i = 0; i < 4; i++) this.spawnGuard(i)
  }
  spawnGuard(i) {
    enemies.push(new GuardOrb({ boss: this, angle: (i / 4) * Math.PI * 2 }))
  }
  liveGuards() {
    return enemies.filter((e) => e instanceof GuardOrb && e.boss === this)
  }
  update() {
    setSpeedTowardsTarget(this, player, CONFIG.enemy.speed * 0.55 * actSpeedMul())
    super.update()
    this.guardTimer++
    if (this.guardTimer % 260 === 0 && this.liveGuards().length < 4) {
      this.spawnGuard(this.guardTimer)
    }
  }
}

const BOSS_CLASSES = { tyrant: HiveTyrant, reaper: DashReaper, warden: Warden }

const killBoss = (boss) => {
  removeSelfFromArray(boss, enemies)
  createExplosion({ x: boss.x, y: boss.y, size: boss.size * 2, color: 'white' })
  createExplosion({ x: boss.x, y: boss.y, size: boss.size, color: boss.color })
  if (isGameOver) return // a dead run doesn't advance
  score += 100 * actNumber
  onActCleared()
}

// ---------------------------------------------------------------------------
// Dungeon flow.
// ---------------------------------------------------------------------------
const startRoom = (room) => {
  currentRoom = room
  room.start()
  countdownT = COUNTDOWN_SECS
  goT = 0
}

const startBossRoom = () => {
  enemies = []
  explosions = []
  destinationMarker = null
  const boss = new BOSS_CLASSES[actMap.bossType]({ act: actNumber })
  enemies.push(boss)
  currentRoom = {
    type: 'boss', mix: null, act: actNumber, cleared: false, kills: 0,
    label: `Boss · ${BOSS_INFO[actMap.bossType].name}`,
    spawnTick() {},
    checkCleared() { return false },
  }
  countdownT = COUNTDOWN_SECS
  goT = 0
}

const onRoomCleared = () => {
  currentRoom.cleared = true
  actMap.roundIndex++
  countdownT = 0
  goT = 0
  roomClearInfo = {
    title: 'Room Cleared!',
    subtitle: currentRoom.label,
    kills: currentRoom.kills,
  }
  currentRoom = null
  roomClearOpen = true
}

const onActCleared = () => {
  const bossName = BOSS_INFO[actMap.bossType].name
  const clearedAct = actNumber
  score += 250 * actNumber
  actNumber++
  level = actNumber // the shield's orbit speed-up follows acts now
  actMap = generateAct(actNumber)
  currentRoom = null
  countdownT = 0
  goT = 0
  playerPath = []
  roomClearInfo = {
    title: `${bossName} Slain!`,
    subtitle: `Act ${clearedAct} cleared.`,
    kills: 0,
  }
  roomClearOpen = true
}

// ---------------------------------------------------------------------------
// MapMenu — the Slay-the-Spire-style act map between rooms. Free choice for
// now: any node in the current round column (or the boss, when unlocked).
// ---------------------------------------------------------------------------
// Virtual map panel (Dymensions convention): the ENTIRE panel — title,
// subtitle, node grid, labels, hint — is authored in this fixed virtual
// space. One uniform scale maps it to the screen, so the panel hugs the map
// on every screen and the geometry is identical everywhere. No letterbox
// inside the panel, no morphing, no drift.
const MAP_VW = 1000
const MAP_VH = 880
const MAP_TITLE_Y = 58
const MAP_TITLE_PX = 48
const MAP_SUB_Y = 118
const MAP_SUB_PX = 26
const MAP_START_X = 70
const MAP_START_Y = 435
const mapColX = (col) => 280 + col * 210
const mapRowY = (row) => 205 + row * 230
const MAP_NODE_R = 42
const MAP_BOSS_R = 58
const MAP_LABEL_PX = 24
const MAP_LABEL_MIN_PX = 12 // legibility floor; pure Dymensions would go smaller
const MAP_HINT_Y = 835
const MAP_HINT_PX = 22

class MapMenu extends Menu {
  constructor() {
    super()
    this.focus = new SurvivorFocusManager()
    this.container = new SurvivorContainer({ title: 'Act 1' })
    // Scoped Dymensions: the same uniform-scale algorithm, applied to the
    // node field rect instead of the canvas.
    this.mapDym = createDymensions(MAP_VW, MAP_VH)
    this.wasDown = false
    this.lastMapKey = null
    this._splashMap = null
  }
  // The map panel is a Dymensions viewport: the whole panel is authored in
  // the virtual space above, mapped with one uniform scale.
  computeLayout() {
    // Dymensions for the whole panel: uniform min-fit scale, centered.
    const availW = canvas.width * 0.94
    const availH = canvas.height * 0.90
    this.mapDym.resize(availW, availH)
    const d = this.mapDym
    // Panel origin (centered avail box) + Dymensions letterbox offsets.
    // toPositionX/Y already include the offsets — don't add them twice.
    const px = (canvas.width - availW) / 2
    const py = (canvas.height - availH) / 2
    this.container.title = ''
    this.container.padding = 0
    this.container.setBounds(px + d.offsetX, py + d.offsetY, d.toScale(MAP_VW), d.toScale(MAP_VH))
    const sx = (vx) => px + d.toPositionX(vx)
    const sy = (vy) => py + d.toPositionY(vy)
    // Labels stay legible: they follow the uniform scale until the floor.
    const labelPx = Math.max(MAP_LABEL_PX * d.scale, MAP_LABEL_MIN_PX)
    const nodes = []
    actMap.rounds.forEach((roundNodes, col) => {
      roundNodes.forEach((node, row) => {
        nodes.push({ ref: node, type: node.type, mix: node.mix, isBoss: false,
          col, row, sx: sx(mapColX(col)), sy: sy(mapRowY(row)),
          r: d.toScale(MAP_NODE_R), labelPx })
      })
    })
    nodes.push({ isBoss: true, bossType: actMap.bossType, col: 3, row: 1,
      sx: sx(mapColX(3)), sy: sy(mapRowY(1)), r: d.toScale(MAP_BOSS_R), labelPx })
    const startNode = { id: 'start', sx: sx(MAP_START_X), sy: sy(MAP_START_Y),
      r: d.toScale(MAP_NODE_R * 0.8), labelPx }
    return {
      nodes, startNode, sx, sy,
      titlePx: MAP_TITLE_PX * d.scale,
      subPx: MAP_SUB_PX * d.scale,
      hintPx: Math.max(MAP_HINT_PX * d.scale, MAP_LABEL_MIN_PX),
    }
  }
  nodeState(n) {
    if (n.isBoss) return actMap.roundIndex >= 3 ? 'available' : 'locked'
    if (n.col < actMap.roundIndex) return n.ref.picked ? 'done' : 'skipped'
    if (n.col === actMap.roundIndex) return 'available'
    return 'locked'
  }
  nodeId(n) {
    return n.isBoss ? 'boss-node' : `node-${n.col}-${n.row}`
  }
  syncFocus() {
    const key = `${actNumber}:${actMap.roundIndex}`
    if (key === this.lastMapKey) return
    this.lastMapKey = key
    this.focus.clear()
    const avail = this.computeLayout().nodes.filter((n) => this.nodeState(n) === 'available')
    this.focus.registerAll(avail.map((n) => ({
      id: this.nodeId(n),
      isFocused: false,
      isDisabled: false,
      activate: () => this.choose(n),
    })))
    if (avail.length) this.focus.setFocusById(this.nodeId(avail[0]))
  }
  choose(n) {
    if (actSplashT > 0) return // splash blocks all map input
    if (transitionT > 0) return // never double-pick through a fade
    playerPath.push(this.nodeId(n))
    startTransition(() => {
      mapOpen = false
      this.lastMapKey = null
      if (n.isBoss) {
        startBossRoom()
      } else {
        n.ref.picked = true
        startRoom(new Room({ type: n.ref.type, mix: n.ref.mix, act: actNumber }))
      }
    })
  }
  update() {
    if (!mapOpen || !actMap) return
    // Act splash: fires once per act map, ticks down, blocks map input while up.
    if (this._splashMap !== actMap) {
      this._splashMap = actMap
      actSplashT = ACT_SPLASH_SECS
    }
    if (actSplashT > 0) actSplashT -= 1 / 60
    this.syncFocus()
    if (actSplashT > 0) return
    const pointer = getPointerPixels()
    const { nodes } = this.computeLayout()
    let hovered = null
    if (pointer) {
      nodes.forEach((n) => {
        if (this.nodeState(n) !== 'available') return
        const r = this.nodeRadius(n) * 1.7
        if (Math.hypot(pointer.x - n.sx, pointer.y - n.sy) < r) hovered = n
      })
      if (pointer.down && !this.wasDown && hovered) this.choose(hovered)
    }
    this.wasDown = pointer ? pointer.down : false
    this.hoveredId = hovered ? this.nodeId(hovered) : null
  }
  nodeRadius(n) {
    return n.r
  }
  drawNode(n) {
    const t = SurvivorUITheme
    const state = this.nodeState(n)
    const r = this.nodeRadius(n)
    const focusable = this.focus.focusables.find((f) => f.id === this.nodeId(n))
    const isFocused = focusable && focusable.isFocused
    const isHovered = this.hoveredId === this.nodeId(n)
    const baseColor = n.isBoss ? BOSS_INFO[n.bossType].color : ROOM_TYPES[n.type].color
    canvasContext.save()
    // Shadow + disc. Shadow offset follows the uniform field scale.
    const sh = Math.max(2, r * 0.14)
    canvasContext.fillStyle = t.shadow
    canvasContext.beginPath()
    canvasContext.arc(n.sx + sh, n.sy + sh, r, 0, Math.PI * 2)
    canvasContext.fill()
    canvasContext.globalAlpha = state === 'locked' || state === 'skipped' ? 0.25 : 1
    canvasContext.fillStyle = state === 'done' ? '#1c1c26' : '#14141b'
    canvasContext.beginPath()
    canvasContext.arc(n.sx, n.sy, r, 0, Math.PI * 2)
    canvasContext.fill()
    canvasContext.lineWidth = state === 'available' ? Math.max(2, r * 0.08) : Math.max(1.5, r * 0.05)
    canvasContext.strokeStyle = state === 'done' ? t.textDim
      : isFocused ? t.accent
        : isHovered ? t.text
          : baseColor
    canvasContext.beginPath()
    canvasContext.arc(n.sx, n.sy, r, 0, Math.PI * 2)
    canvasContext.stroke()
    // Glyph.
    canvasContext.globalAlpha = state === 'locked' || state === 'skipped' ? 0.35 : 1
    canvasContext.fillStyle = state === 'done' ? t.textDim : baseColor
    canvasContext.font = `700 ${Math.round(r * 0.9)}px ${t.fontFamily}`
    canvasContext.textAlign = 'center'
    canvasContext.textBaseline = 'middle'
    const glyph = n.isBoss ? 'B' : ROOM_TYPES[n.type].letter
    if (state === 'done') {
      canvasContext.strokeStyle = t.textDim
      canvasContext.lineWidth = Math.max(2, r * 0.12)
      canvasContext.beginPath()
      canvasContext.moveTo(n.sx - r * 0.35, n.sy)
      canvasContext.lineTo(n.sx - r * 0.05, n.sy + r * 0.3)
      canvasContext.lineTo(n.sx + r * 0.4, n.sy - r * 0.3)
      canvasContext.stroke()
    } else {
      canvasContext.fillText(glyph, n.sx, n.sy + 1)
    }
    // Label: two short lines, in virtual units with a legibility floor.
    const labelPx = Math.round(n.labelPx)
    canvasContext.font = `${labelPx}px ${t.fontFamily}`
    canvasContext.fillStyle = state === 'locked' || state === 'skipped' ? t.textDim : t.text
    if (n.isBoss) {
      canvasContext.fillText(BOSS_INFO[n.bossType].name, n.sx, n.sy + r + labelPx)
    } else {
      canvasContext.fillText(ROOM_TYPES[n.type].label, n.sx, n.sy + r + labelPx)
      canvasContext.fillStyle = t.textDim
      canvasContext.fillText(ENEMY_MIXES[n.mix].label, n.sx, n.sy + r + labelPx * 2.1)
    }
    canvasContext.restore()
  }
  draw() {
    if (!mapOpen || !actMap) return
    const t = SurvivorUITheme
    canvasContext.fillStyle = t.backdrop
    canvasContext.fillRect(0, 0, canvas.width, canvas.height)
    const L = this.computeLayout()
    this.container.draw()
    canvasContext.save()
    canvasContext.textAlign = 'center'
    canvasContext.textBaseline = 'middle'
    // Title + subtitle, in virtual units.
    canvasContext.font = `${L.titlePx}px ${t.fontFamily}`
    canvasContext.fillStyle = t.text
    canvasContext.fillText(`Act ${actNumber}`, L.sx(MAP_VW / 2), L.sy(MAP_TITLE_Y))
    canvasContext.font = `${L.subPx}px ${t.fontFamily}`
    canvasContext.fillStyle = t.textDim
    const sub = actMap.roundIndex >= 3
      ? 'All rooms cleared — choose your boss battle'
      : `Choose room ${actMap.roundIndex + 1} of 3 — free choice`
    canvasContext.fillText(sub, L.sx(MAP_VW / 2), L.sy(MAP_SUB_Y))
    // Path lines: a faint web between adjacent columns (visual only —
    // choice stays free). Traveled segments light up in accent.
    const nid = (n) => n.id || this.nodeId(n)
    const byCol = [[], [], [], []]
    L.nodes.forEach((n) => { if (!n.isBoss) byCol[n.col].push(n) })
    const bossNode = L.nodes.find((n) => n.isBoss)
    const segments = []
    byCol[0].forEach((b) => segments.push([L.startNode, b]))
    for (let c = 0; c < 3; c++) {
      const targets = c === 2 ? [bossNode] : byCol[c + 1]
      byCol[c].forEach((a) => targets.forEach((b) => segments.push([a, b])))
    }
    const lit = new Set()
    const seq = ['start', ...playerPath]
    for (let i = 1; i < seq.length; i++) lit.add(`${seq[i - 1]}>${seq[i]}`)
    const isLit = (a, b) => lit.has(`${nid(a)}>${nid(b)}`)
    canvasContext.strokeStyle = 'rgba(167, 167, 192, 0.16)'
    canvasContext.lineWidth = Math.max(1, L.titlePx * 0.025)
    segments.forEach(([a, b]) => {
      if (isLit(a, b)) return
      canvasContext.beginPath()
      canvasContext.moveTo(a.sx, a.sy)
      canvasContext.lineTo(b.sx, b.sy)
      canvasContext.stroke()
    })
    canvasContext.strokeStyle = t.accent
    canvasContext.globalAlpha = 0.9
    canvasContext.lineWidth = Math.max(2, L.titlePx * 0.06)
    canvasContext.shadowColor = t.accent
    canvasContext.shadowBlur = Math.max(4, L.titlePx * 0.15)
    segments.forEach(([a, b]) => {
      if (!isLit(a, b)) return
      canvasContext.beginPath()
      canvasContext.moveTo(a.sx, a.sy)
      canvasContext.lineTo(b.sx, b.sy)
      canvasContext.stroke()
    })
    canvasContext.shadowBlur = 0
    canvasContext.globalAlpha = 1
    L.nodes.forEach((n) => this.drawNode(n))
    // Start node: where the run begins. Not interactive.
    {
      const s = L.startNode
      const sr = s.r
      const sh = Math.max(2, sr * 0.14)
      canvasContext.save()
      canvasContext.fillStyle = t.shadow
      canvasContext.beginPath()
      canvasContext.arc(s.sx + sh, s.sy + sh, sr, 0, Math.PI * 2)
      canvasContext.fill()
      canvasContext.fillStyle = '#14141b'
      canvasContext.beginPath()
      canvasContext.arc(s.sx, s.sy, sr, 0, Math.PI * 2)
      canvasContext.fill()
      canvasContext.lineWidth = Math.max(2, sr * 0.08)
      canvasContext.strokeStyle = t.accent
      canvasContext.beginPath()
      canvasContext.arc(s.sx, s.sy, sr, 0, Math.PI * 2)
      canvasContext.stroke()
      canvasContext.font = `${Math.round(s.labelPx)}px ${t.fontFamily}`
      canvasContext.textAlign = 'center'
      canvasContext.textBaseline = 'middle'
      canvasContext.fillStyle = t.textDim
      canvasContext.fillText('Start', s.sx, s.sy + sr + s.labelPx)
      canvasContext.restore()
    }
    canvasContext.font = `${L.hintPx}px ${t.fontFamily}`
    canvasContext.fillStyle = t.textDim
    canvasContext.fillText('Click, tap, or Tab + Enter', L.sx(MAP_VW / 2), L.sy(MAP_HINT_Y))
    // Act splash overlay.
    if (actSplashT > 0) {
      const aIn = Math.min(1, (ACT_SPLASH_SECS - actSplashT) / 0.25)
      const aOut = Math.min(1, actSplashT / 0.35)
      const a = Math.max(0, Math.min(aIn, aOut))
      canvasContext.fillStyle = `rgba(4, 4, 9, ${0.93 * a})`
      canvasContext.fillRect(0, 0, canvas.width, canvas.height)
      canvasContext.textAlign = 'center'
      canvasContext.textBaseline = 'middle'
      canvasContext.fillStyle = `rgba(255, 255, 255, ${a})`
      canvasContext.font = `700 ${Math.max(28, Math.round(gameSize * 0.085))}px ${t.fontFamily}`
      canvasContext.fillText(`ACT ${actNumber}`, canvas.width / 2, canvas.height / 2 - gameSize * 0.03)
      canvasContext.fillStyle = `rgba(167, 167, 192, ${a})`
      canvasContext.font = `${Math.max(14, Math.round(gameSize * 0.028))}px ${t.fontFamily}`
      canvasContext.fillText(
        `${BOSS_INFO[actMap.bossType].name} awaits at the end`,
        canvas.width / 2, canvas.height / 2 + gameSize * 0.045,
      )
    }
    canvasContext.restore()
  }
  handleKeyDown(event) {
    if (!mapOpen) return false
    return this.focus.handleKeyDown(event)
  }
  handleGamepadEscape() {
    return false
  }
}

// ---------------------------------------------------------------------------
// RoomClearMenu — stats between rooms, then onward to the map.
// ---------------------------------------------------------------------------
class RoomClearMenu extends Menu {
  constructor() {
    super()
    this.focus = new SurvivorFocusManager()
    this.container = new SurvivorContainer({ title: 'Room Cleared!' })
    this.continueButton = new SurvivorButton({
      id: 'continue',
      label: 'Continue',
      onClick: () => startTransition(() => {
        roomClearOpen = false
        roomClearInfo = null
        mapOpen = true
      }),
    })
    this.buttons = [this.continueButton]
    this.focus.registerAll(this.buttons)
    this.focus.setFocusById('continue')
  }
  statLines() {
    const lines = []
    if (roomClearInfo) {
      lines.push(roomClearInfo.subtitle)
      if (roomClearInfo.kills) lines.push(`Kills: ${roomClearInfo.kills}`)
    }
    lines.push(`Score: ${score}`)
    lines.push(`Time: ${gameTime}`)
    lines.push(`HP: ${player ? player.health : 0}`)
    return lines
  }
  fitWidth() {
    const D = SurvivorDimensions
    return fitTitledPanel(this, this.statLines(), Math.round(uiFontBase() * D.statMul))
  }
  bodyHeight() {
    const D = SurvivorDimensions
    return uiPx(D.fontBase * D.lineHMul) * 5 + Math.round(uiFontBase() * D.gapMul)
  }
  update() {
    this.tickOpenAnim(roomClearOpen)
    if (!roomClearOpen) return
    if (roomClearInfo) this.container.title = roomClearInfo.title
    updateMenuPanel(this)
  }
  draw() {
    if (!roomClearOpen || !roomClearInfo) return
    canvasContext.save()
    this.applyOpenAnim()
    const t = SurvivorUITheme
    const D = SurvivorDimensions
    canvasContext.fillStyle = t.backdrop
    canvasContext.fillRect(0, 0, canvas.width, canvas.height)
    const lineH = uiPx(D.fontBase * D.lineHMul)
    const fontPx = Math.round(uiFontBase() * D.statMul)
    const lines = this.statLines()
    drawMenuPanel(this, () => {
      canvasContext.font = `${fontPx}px ${t.fontFamily}`
      canvasContext.textAlign = 'center'
      canvasContext.textBaseline = 'middle'
      const cx = this.container.x + this.container.width / 2
      const topY = this.container.y + this.container.padding
        + this.container.headerHeight() + lineH / 2
      lines.forEach((line, i) => {
        canvasContext.fillStyle = i === 0 ? t.textDim : t.text
        canvasContext.fillText(line, cx, topY + i * lineH)
      })
    })
    canvasContext.restore()
  }
  handleKeyDown(event) {
    if (!roomClearOpen) return false
    return this.focus.handleKeyDown(event)
  }
  handleGamepadEscape() {
    return false
  }
}

// ---------------------------------------------------------------------------
// Game loop (spawning and difficulty are room-driven now)
// ---------------------------------------------------------------------------
const update = () => {
  // Room-start countdown: the whole world holds its breath. Only the
  // countdown ticks and menus stay alive; the clock doesn't run either,
  // so survive rooms don't lose seconds to it.
  const frozen = countdownT > 0
  if (frozen) {
    countdownT -= 1 / 60
    if (countdownT <= 0) {
      countdownT = 0
      goT = GO_SECS
    }
  } else if (goT > 0) {
    goT -= 1 / 60
  }
  if (!frozen) {
    ;([
      player,
      ...shields,
      ...enemies,
      ...explosions,
      destinationMarker,
    ]).forEach((entity) => entity && entity.update && entity.update())
    if (currentRoom && !currentRoom.cleared && !isGameOver) {
      currentRoom.spawnTick()
      if (currentRoom.checkCleared()) onRoomCleared()
    }
    incrementTime()
  }
  ;[...menus].forEach((menu) => menu && menu.update && menu.update())
}

const draw = () => {
  drawBackground()
  ;([
    player,
    ...enemies,
    ...shields,
    ...explosions,
    destinationMarker,
  ]).forEach((entity) => entity && entity.draw && entity.draw())
  // Room-start countdown: big punching number over a dimmed world,
  // under the menus so the pause panel stays on top.
  if (countdownT > 0 || goT > 0) {
    const t = SurvivorUITheme
    canvasContext.fillStyle = 'rgba(0, 0, 0, 0.35)'
    canvasContext.fillRect(0, 0, canvas.width, canvas.height)
    const isGo = countdownT <= 0
    const label = isGo ? 'GO!' : String(Math.ceil(countdownT))
    const frac = isGo ? goT / GO_SECS : countdownT % 1
    const pop = 1 + 0.35 * frac
    canvasContext.font = `700 ${Math.max(24, Math.round(gameSize * 0.11 * pop))}px ${t.fontFamily}`
    canvasContext.textAlign = 'center'
    canvasContext.textBaseline = 'middle'
    canvasContext.fillStyle = isGo ? t.accent : t.text
    canvasContext.globalAlpha = isGo ? Math.min(1, (goT / GO_SECS) * 2) : 1
    canvasContext.fillText(label, canvas.width / 2, canvas.height / 2)
    canvasContext.globalAlpha = 1
  }
  ;[...menus].forEach((menu) => menu && menu.draw && menu.draw())
  // Fade-through-black overlay.
  if (transitionT > 0) {
    const half = TRANSIT_SECS / 2
    const raw = transitionT > half ? 1 - (transitionT - half) / half : transitionT / half
    canvasContext.fillStyle = `rgba(0, 0, 0, ${Math.max(0, Math.min(1, raw))})`
    canvasContext.fillRect(0, 0, canvas.width, canvas.height)
  }
}

window.addEventListener('resize', () => {
  canvas.height = window.innerHeight
  canvas.width = window.innerWidth
  gameSize = getGameSize()
  gameOffset = getGameOffset()
  Dymensions.resize(canvas.width, canvas.height)
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
  destinationMarker = null
  preGame = false
  isGameOver = false
  score = 0
  gameTime = 0
  level = 1
  // Dungeon run: act 1 starts on the map, choosing room 1.
  actNumber = 1
  bossBag = []
  actMap = generateAct(1)
  currentRoom = null
  mapOpen = true
  roomClearOpen = false
  roomClearInfo = null
  pause = false
  countdownT = 0
  goT = 0
  playerPath = []
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
  if (transitionT > 0) {
    transitionT -= 1 / 60
    if (transitionT <= TRANSIT_SECS / 2 && transitionMid) {
      const f = transitionMid
      transitionMid = null
      f()
    }
  }
  if (!isGameOver && checkIsGameOver()) gameOver()
  if (features.hyperTrails) {
    canvasContext.fillStyle = 'rgba(0,0,0,0.1)'
    canvasContext.fillRect(0, 0, canvas.width, canvas.height)
  } else {
    canvasContext.clearRect(0, 0, canvas.width, canvas.height)
  }
  if (!pause && !mapOpen && !roomClearOpen) {
    update()
  } else {
    // The world is frozen (paused or choosing on the map/stats), but menu UI
    // keeps updating so hover and clicks still work.
    menus.forEach((menu) => menu.update && menu.update())
  }
  draw()
  requestAnimationFrame(playGame)
}

const init = () => {
  idCounter = 0
  gameSize = getGameSize()
  gameOffset = getGameOffset()
  Dymensions.resize(canvas.width, canvas.height)
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
    new MapMenu(),
    new RoomClearMenu(),
  ]
  playGame()
}

init()
