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

const gameCanvasId = 'gameCanvas'
const canvas = document.getElementById(gameCanvasId)
const canvasContext = canvas.getContext('2d')
canvas.height = window.innerHeight
canvas.width = window.innerWidth

const drawBackground = () => {
  if (features.hyperTrails) return
  canvasContext.save()
  canvasContext.fillStyle = "black";
  canvasContext.fillRect(0, 0, canvas.width, canvas.height);
  canvasContext.restore()
}

const getGameSize = () =>
  features.zoomOut
    ? Math.min(canvas.width, canvas.height)
    : Math.max(canvas.width, canvas.height)

const getGameOffset = () => {
  if (
    features.zoomOut
      ? canvas.width < canvas.height
      : canvas.width > canvas.height
  ) {
    return {
      x: 0,
      y: (gameSize - canvas.height) / 2
    }
  }
  if (
    features.zoomOut
     ? canvas.width > canvas.height
     : canvas.width < canvas.height
  ) {
    return {
      x: (gameSize - canvas.width) / 2,
      y: 0
    }
  }
  return {x: 0, y: 0}
}

const drawCenterRetical = () => {
  if (!features.drawCenterRetical) return
  canvasContext.save()
  canvasContext.strokeStyle = 'red'
  canvasContext.lineWidth = 3
  canvasContext.beginPath()
  canvasContext.moveTo(canvas.width / 2 - 10, canvas.heigh / 2)
  canvasContext.lineTo(canvas.width/ 2 + 10, canvas.height / 2)
  canvasContext.stroke()
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
  canvasContext.beginPath()
  // vertical grid lines
  for (let x = 0; x <= 10; x++) {
    canvasContext.moveTo(gameSize * x * 0.1 - gameOffset.x, 0 - gameOffset.y)
    canvasContext.lineTo(gameSize * x * 0.1 - gameOffset.x, gameSize)
    canvasContext.stroke()
  }
  // horizontal grid lines
  for (let y = 0; y <= 10; y++) {
    canvasContext.moveTo(0 - gameOffset.x, gameSize * y * 0.1 - gameOffset.y)
    canvasContext.lineTo(gameSize, gameSize * y * 0.1 - gameOffset.y)
    canvasContext.stroke()
  }
  canvasContext.restore()
}

const getScaledFont = (scalar = 1) => `${gameSize * .02 * scalar}px sans-serif`

const getScaledFontPixelValue = (scalar = 1) => gameSize * .02 * scalar

const incrementScore = () => !isGameOver && score++

const incrementTime = () => gameTime++

class Menu {
  getSpacer = () => getScaledFontPixelValue(2)
  
  drawBackground() {
    canvasContext.save()
    canvasContext.fillStyle = 'black'
    canvasContext.globalAlpha = .3
    canvasContext.beginPath()
    canvasContext.arc(
      .5 * gameSize - gameOffset.x,
      .5 * gameSize - gameOffset.y,
      .15 *  gameSize,
      0,
      Math.PI * 2)
    canvasContext.fill()
    canvasContext.arc(
      .5 * gameSize - gameOffset.x,
      .5 * gameSize - gameOffset.y,
      .3 *  gameSize,
      0,
      Math.PI * 2)
    canvasContext.fill()
    canvasContext.arc(
      .5 * gameSize - gameOffset.x,
      .5 * gameSize - gameOffset.y,
      .45 *  gameSize,
      0,
      Math.PI * 2)
    canvasContext.fill()
    canvasContext.restore()
  }
}

class StartMenu extends Menu {
  update() {
    if (!preGame) return
    if (
      mouseController
      && mouseController.clicking
      && .4 < mouseController.x
      && mouseController.x < .6
      && .4 < mouseController.y
      && mouseController.y < .6
    ) newGame()
  }
  draw() {
    if (!preGame) return
    this.drawBackground()
    const spacer = this.getSpacer()
    canvasContext.save()
    canvasContext.font = getScaledFont(2);
    canvasContext.fillStyle = 'white';
    canvasContext.textAlign = 'center'
    canvasContext.textBaseline = 'ideographic'
    canvasContext.fillText(`Survivor Prototype`, canvas.width / 2, canvas.height / 2);
    canvasContext.font = getScaledFont(1.5);
    canvasContext.fillText(`Tap Enter to Start`, canvas.width / 2, canvas.height / 2 + spacer); 
    canvasContext.font = getScaledFont(1);
    canvasContext.fillText(`Controls: Arrow Keys, WASD,`, canvas.width / 2, canvas.height / 2 + (spacer * 2.2));
    canvasContext.fillText(`Tap, or Click and Drag`, canvas.width / 2, canvas.height / 2 + (spacer * 3));
    canvasContext.restore()
  }
}

class InGameMenu extends Menu {
  draw() {
    if (isGameOver) return
    const spacer = this.getSpacer()
    const padding = spacer / 2
    canvasContext.save()
    canvasContext.font = getScaledFont();
    canvasContext.fillStyle = 'white';
    canvasContext.textAlign = 'start'
    canvasContext.textBaseline = 'hanging'
    canvasContext.fillText(`Level ${level}`, padding, padding);
    canvasContext.fillText(`Score: ${score}`, padding, padding + spacer);
    canvasContext.fillText(`Time: ${gameTime}`, padding, padding + spacer * 2);
    canvasContext.restore()
  }
}

class EndGameMenu extends Menu {
  update() {
    if (!isGameOver || preGame) return
    if (
      mouseController
      && mouseController.clicking
      && .4 < mouseController.x
      && mouseController.x < .6
      && .4 < mouseController.y
      && mouseController.y < .6
    ) newGame()
  }
  draw() {
    if (!isGameOver || preGame) return
    this.drawBackground()
    const spacer = this.getSpacer()
    canvasContext.save()
    canvasContext.font = getScaledFont(2);
    canvasContext.fillStyle = 'white';
    canvasContext.textAlign = 'center'
    canvasContext.textBaseline = 'ideographic'
    canvasContext.fillText(`Game Over`, canvas.width / 2, canvas.height / 2 - spacer * 2);
    canvasContext.font = getScaledFont(1.5);
    canvasContext.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 - spacer); 
    canvasContext.font = getScaledFont(1.5);
    canvasContext.fillText(`Time: ${gameOverTime}`, canvas.width / 2, canvas.height / 2); 
    canvasContext.font = getScaledFont(1.5);
    canvasContext.fillText(`Tap Enter to Restart`, canvas.width / 2, canvas.height / 2 + spacer); 
    canvasContext.font = getScaledFont(1);
    canvasContext.fillText(`Controls: Arrow Keys, WASD,`, canvas.width / 2, canvas.height / 2 + spacer * 2.2);
    canvasContext.fillText(`Tap, or Click and Drag`, canvas.width / 2, canvas.height / 2 + spacer * 3);
    canvasContext.restore()
  }
}

class PauseMenu extends Menu {
  draw() {
    if (!pause) return
    this.drawBackground()
    canvasContext.fillStyle = 'white';
    canvasContext.font = getScaledFont(1.5);
    canvasContext.textAlign = 'center'
    canvasContext.textBaseline = 'middle'
    canvasContext.fillText(`Paused`, canvas.width / 2, canvas.height / 2);
  }
}

const randomIntRange = (min = 1, max = 100) =>  Math.floor(Math.random() * (max + 1 - min) + min)

const getPythagorean = (a, b) => Math.sqrt(a * a + b * b)

const getAngleBetweenPoints = (
  {x: x1, y: y1},
  {x: x2, y: y2}
) => Math.atan2((y2 - y1), (x2 - x1))

const findOwnIndexInArray = (entity, array) => array.findIndex((element) => element.id === entity.id)

const removeSelfFromArray = (entity, array) => {
  const selfIndex = findOwnIndexInArray(entity, array)
  if (selfIndex >= 0) {
    array.splice(selfIndex, 1)
  }
}

class Entity {
  constructor(props = {}) {
    this.id = ++idCounter
    this.createdDate = new Date()
    this.x = props.x !== undefined ? props.x : .5
    this.y = props.y !== undefined ? props.y : .5
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
    const {x, y, speedX, speedY, text, textColor, textScale} = this
    if (text) {
      canvasContext.save()
      canvasContext.fillStyle = textColor;
      canvasContext.font = getScaledFont(textScale)
      canvasContext.textAlign = 'center'
      canvasContext.textBaseline = 'middle'
      canvasContext.fillText(
        text,
        x * gameSize - gameOffset.x,
        y * gameSize - gameOffset.y
      )
      canvasContext.restore()
    }
    if (features.drawEntityVelocityVector) {
      canvasContext.save()
      canvasContext.beginPath()
      canvasContext.moveTo(
        x * gameSize - gameOffset.x,
        y * gameSize - gameOffset.y
      )
      canvasContext.lineTo(
        ((x + (speedX * 10)) * gameSize - gameOffset.x),
        ((y + (speedY * 10)) * gameSize - gameOffset.y)
      )
      canvasContext.strokeStyle = 'red'
      canvasContext.stroke()
      canvasContext.closePath();
      canvasContext.restore()
    }
  }

  getVelocityMagnitude() {
    return getPythagorean(this.speedX, this.speedY)
  }

  getVelocityAngle() {
    return getAngleBetweenPoints(
      { x: 0, y: 0 },
      { x: this.speedX, y: this.speedY }
    )
  }
}

class Ball extends Entity {
  constructor(props = {}) {
    super(props)
    this.size = props.size || 0.03
    this.color = props.color || 'white'
    this.opacity = props.opacity || 1
    this.textColor = 'black'
  }

  draw() {
    const {color, x, y, size, opacity} = this
    canvasContext.save()
    canvasContext.fillStyle = color
    canvasContext.globalAlpha = opacity
    canvasContext.beginPath()
    canvasContext.arc(
      x * gameSize - gameOffset.x,
      y * gameSize - gameOffset.y,
      size *  gameSize,
      0,
      Math.PI * 2)
    canvasContext.fill()
    canvasContext.restore()
    super.draw()
  }
}

class PlayerBall extends Ball {
  constructor(props = {}) {
    super(props)
    this.health = props.health || 10
    this.text = this.health
    this.color = `hsl(${12 * this.health} 100% 50%)`
    this.speed = 0.005
  }
  update() {
    this.text = this.health
    if (isGameOver) {
      this.size = 0
      this.color = 'black'
      this.text = undefined
    } else {
      this.color = `hsl(${12 * this.health} 100% 50%)`
      this.textColor = this.textColor
    }
  }
}

class KeysController {}

document.addEventListener('keydown', (event) => {
  if (!features.keysControl) return
  if (!keysController) keysController = new KeysController()
  switch (event.key) {
    case "ArrowUp":
    case "w":
      if (isGameOver) break;
      player.controller = keysController
      keysController.up = true
      break
    case "ArrowDown":
    case "s":
      if (isGameOver) break;
      player.controller = keysController
      keysController.down = true
      break
    case "ArrowRight":
    case "d":
      if (isGameOver) break;
      player.controller = keysController
      keysController.right = true
      break
    case "ArrowLeft":
    case "a":
      if (isGameOver) break;
      player.controller = keysController
      keysController.left = true
      break
    case "Escape":
      if (isGameOver) break;
      togglePause()
      break
    case "Enter":
      if (isGameOver) newGame()
      break
  }
})

document.addEventListener('keyup', (event) => {
  if (!features.keysControl) return
  if (!keysController) keysController = new KeysController()
  switch (event.key) {
    case "ArrowUp":
    case "w":
      if (isGameOver) break;
      player.controller = keysController
      keysController.up = false
      break;
    case "ArrowDown":
    case "s":
      if (isGameOver) break;
      player.controller = keysController
      keysController.down = false
      break;
    case "ArrowRight":
    case "d":
      if (isGameOver) break;
      player.controller = keysController
      keysController.right = false
      break;
    case "ArrowLeft":
    case "a":
      if (isGameOver) break;
      player.controller = keysController
      keysController.left = false
      break;
  }
})

class MouseController {}

document.addEventListener('mousedown', (event) => {
  if (!features.mouseControl) return
  if (!mouseController) mouseController = new MouseController()
  if (!isGameOver) player.controller = mouseController
  mouseController.clicking = true
  mouseController.x = event.pageX / canvas.width
  mouseController.y = event.pageY / canvas.height
});

document.addEventListener('mouseup', (event) => {
  if (!features.mouseControl) return
  if (!mouseController) mouseController = new MouseController()
  if (!isGameOver) player.controller = mouseController
  mouseController.clicking = false
  mouseController.x = event.pageX / canvas.width
  mouseController.y = event.pageY / canvas.height
});

document.addEventListener('mousemove', (event) => {
  if (!features.mouseControl) return
  if (!mouseController) mouseController = new MouseController()
  if (!isGameOver && mouseController.clicking) player.controller = mouseController
  if (mouseController.clicking) {
    mouseController.x = event.pageX / canvas.width,
    mouseController.y = event.pageY / canvas.height
  }
});

class GamepadController {}

window.addEventListener("gamepadconnected", (e) => {
  const connectedGamepad = navigator.getGamepads()[e.gamepad.index]
  console.log("Gamepad connected.", connectedGamepad);
  gamepadController = new GamepadController()
  gamepadController.index = e.gamepad.index
  gamepadController.axes = connectedGamepad.axes
  gamepadController.buttons = connectedGamepad.buttons
});

window.addEventListener("gamepaddisconnected", (e) => {
  console.log("Gamepad disconnected.", e);
  if (e.gamepad.index === gamepadController.index) gamepadController = false
});

const handleGamePad = () => {
  if (gamepadController) {
    const currentGamepad = navigator.getGamepads()[0]
    if (
      gamepadController.axes[0] == currentGamepad.axes[0]
      && gamepadController.axes[1] == currentGamepad.axes[1]
    ) return
    gamepadController.axes = currentGamepad.axes
    gamepadController.buttons = currentGamepad.buttons
    if (!isGameOver) {
      if (
        gamepadController.axes[0] > 0.25
        || gamepadController.axes[0] < -0.25
        || gamepadController.axes[1] > 0.25
        || gamepadController.axes[1] < -0.25
      ) {
        gamepadController.x = gamepadController.axes[0]
        gamepadController.y = gamepadController.axes[1]
      } else {
        gamepadController.x = 0
        gamepadController.y = 0
      }
      player.controller = gamepadController
    }
  }
}


const getClosestEnemy = () => {
  return enemies.length && enemies.reduce((enemyA, enemyB) => {
    enemyA.distanceToPlayer = enemyA.distanceToPlayer || getDistanceBetweenEntityCenters(player, enemyA)
    enemyB.distanceToPlayer = getDistanceBetweenEntityCenters(player, enemyB)
    return enemyA.distanceToPlayer < enemyB.distanceToPlayer
      ? enemyA
      : enemyB
  })
}

class AIPlayerBall extends PlayerBall {
  constructor(props = {}){
    super(props)
    this.controller = new MouseController()
    this.controller.x = .5
    this.controller.y = .5
  }
  update() {
    super.update()
    if (!(enemies && enemies.length)) return
    if (!(gameTime % 10 == 0)) return
    const closestEnemy = getClosestEnemy()
    if (!closestEnemy) return;
    const angleAwayFromEnemy = getAngleBetweenPoints(player, closestEnemy) + Math.PI;
    this.controller.clicked = true,
    this.controller.x = Math.cos(angleAwayFromEnemy)
    this.controller.y = Math.sin(angleAwayFromEnemy)
  }
}

const moveBasedOnKeyBoard = (entity) => {
  if (
    player.controller instanceof KeysController
  ) {
    entity.x += (keysController.right ? -player.speed : 0) + (keysController.left ? player.speed : 0)
    entity.y += (keysController.down ? -player.speed : 0) + (keysController.up ? player.speed : 0)
  }
}

const moveBasedOnMouse = (ball) => {
  if (
    player.controller instanceof MouseController
  ) {
    const distanceToPlayer = getDistanceBetweenEntityCenters(player.controller, player)
    if (distanceToPlayer <= player.size) return
    const angleToMouse = getAngleBetweenPoints(player, player.controller)
    ball.x -= player.speed * Math.cos(angleToMouse)
    ball.y -= player.speed * Math.sin(angleToMouse)
  }
}

const moveBasedOnGamepad = (ball) => {
  if (
    player.controller instanceof GamepadController
  ) {
    if (player.controller.x === 0 && player.controller.y === 0) {
      return
    }
    relativeX = player.controller.x + player.x
    relativeY = player.controller.y + player.y
    const angleToGamepad = getAngleBetweenPoints(player, {x:relativeX, y:relativeY})
    ball.x -= player.speed * Math.cos(angleToGamepad)
    ball.y -= player.speed * Math.sin(angleToGamepad)
  }
}

const setSpeedTowardsTarget = (ball1, ball2, speed) => {
  const angleToTarget = getAngleBetweenPoints(ball1, ball2)
  ball1.speedX = speed * Math.cos(angleToTarget)
  ball1.speedY = speed * Math.sin(angleToTarget)
}

const handleEnemyOutOfBounds = (enemy) => {
  if (!features.handleEnemyOutOfBounds) return
  if (enemy.x > 1.2 || enemy.x < -.2 || enemy.y > 1.2 || enemy.y < -.2) {
    removeSelfFromArray(enemy, enemies)
  }
}

const handleEnemyCollisions = (enemy) => {
  const collisionWithPlayer = getBallCollisionDetected(enemy, player)
  const collisionWithShield = shields.some(shield => getBallCollisionDetected(enemy, shield))
  if (collisionWithPlayer || collisionWithShield) {
    removeSelfFromArray(enemy, enemies)
    if (collisionWithPlayer) {
      createExplosion({x:collisionWithPlayer.x , y:collisionWithPlayer.y, size: enemy.size})
      player.health -= 1
    }
    if (collisionWithShield) {
      createExplosion({x:enemy.x , y:enemy.y, size: enemy.size,color: enemy.color})
      incrementScore()
    }
  }
}

const setRandomLocationOnEdge = (entity) => {
  const random = Math.random()
  if (random < .25) {
    entity.x = 0 - entity.size
    entity.y = Math.random()
  } else if(random < .5) {
    entity.x = 1 + entity.size
    entity.y = Math.random()
  } else if(random < .75) {
    entity.x = Math.random()
    entity.y = 0 - entity.size
  } else {
    entity.x = Math.random()
    entity.y = 1 + entity.size
  }
}

class EnemyBall extends Ball {
  constructor(props = {}) {
    super(props)
    this.color = 'darkred'
    this.size = 0.02
    if (props.x === undefined && props.y === undefined) setRandomLocationOnEdge(this)
    if (props.speedX === undefined  && props.speedY === undefined) setSpeedTowardsTarget(this, player, .003)
  }

  update(){
    this.x += this.speedX
    this.y += this.speedY
    moveBasedOnKeyBoard(this)
    moveBasedOnMouse(this)
    moveBasedOnGamepad(this)
    handleEnemyOutOfBounds(this)
    handleEnemyCollisions(this)
  }
}

const spawnEnemyWave = (EnemyType = EnemyBall, nEnemies = 5, angle, enemyProps) => {
  const originEnemy = new EnemyType({...enemyProps})
  const wave = [originEnemy]
  for (let i = 0; i < nEnemies - 1; i++) {
    const odd = i % 2
    wave.push(new EnemyType({
      x: originEnemy.x
        + (originEnemy.size * 2 * (
          angle
            ? Math.cos(angle)
            : Math.cos(
              getAngleBetweenPoints(originEnemy, player)
              + (Math.PI / 2)
            )
        ) * (odd ? -1 : 1) * (Math.floor(i / 2) + 1)
      ),
      y: originEnemy.y
        + (originEnemy.size * 2 * (
          angle
            ? Math.sin(angle)
            : Math.sin(
              getAngleBetweenPoints(originEnemy, player)
              + (Math.PI / 2)
            )
        ) * (odd ? -1 : 1) * (Math.floor(i / 2) + 1)
      ),
      speedX: originEnemy.speedX,
      speedY: originEnemy.speedY,
      ...enemyProps
    }))
  }
  wave.forEach(enemy => enemies.push(enemy))
  // console.log(wave)
  // debugger
}

class SmartEnemyBall extends EnemyBall {
  constructor(props = {}) {
    super(props)
    this.color = 'red'
  }
  update() {
    super.update()
    setSpeedTowardsTarget(this, player, getPythagorean(this.speedX, this.speedY))
  }
}

class SlowEnemyBall extends SmartEnemyBall {
  constructor(props = {}) {
    super(props)
    this.speedX = this.speedX * .75
    this.speedY = this.speedY * .75
    this.size = 0.026
    this.color = 'orangered'
  }
}

class Explosion extends Ball {  
  constructor(props = {}) {
    super(props)
    this.size = props.size || 0.01
    this.color = props.color || 'BlueViolet'
  }

  update() {
    super.update()
    this.size += 0.001
    this.opacity -= 0.1
    if (this.opacity <= 0) {
      removeSelfFromArray(this, explosions)
    }
  }
}

const createExplosion = ({x, y, color, size} = {}) => {
  if (!features.createExplosion) return
  explosions.push(new Explosion({x, y, color, size}))
}

class Shield extends Ball {
  constructor(props = {}) {
    super(props)
    this.size = 0.02
    this.color = 'deepskyblue'
    this.opacity = 1
    this.x = .5
    this.y = .55
    this.angle = 0
    this.distanceFromCenter = .1
    this.speed = 1
  }
  update() {
    this.angle += Math.PI / (100 / Math.min(level, 11)) * this.speed
    this.x = .5 + (this.distanceFromCenter * Math.cos(this.angle))
    this.y = .5 + (this.distanceFromCenter * Math.sin(this.angle))
  }
}

const getDistanceBetweenEntityCenters = (entity1, entity2) => 
  Math.sqrt(
    Math.pow(
      Math.abs(entity1.x - entity2.x),
      2
    )
    +
    Math.pow(
      Math.abs(entity1.y - entity2.y),
      2
    )
  )

const getBallCollisionDetected = (ball1, ball2) => {
  const distanceBetweenBallCenters = getDistanceBetweenEntityCenters(ball1, ball2)
  if (distanceBetweenBallCenters < ball1.size + ball2.size) {
    return {
      x: ball1.x + (ball2.x - ball1.x) * (ball1.size / distanceBetweenBallCenters),
      y: ball1.y + (ball2.y - ball1.y) * (ball1.size / distanceBetweenBallCenters)
    }
  }
}

const handleLevel = () => {
  if (gameTime % 1000 === 0 && gameTime !== 0) level++
}

const handleSpawnEnemies = () => {
  if (!features.handleSpawnEnemies) return
  if (level === 1) {
    if ((gameTime % 5) === 0 && enemies.length < 200) {
      enemies.push(new EnemyBall())
    }
  }
  if (level === 2) {
    if ((gameTime % 7) === 0 && enemies.length < 200) {
      spawnEnemyWave(EnemyBall, 3)
    }
  }
  if (level === 3) {
    if ((gameTime % 5) === 0 && enemies.length < 200) {
      spawnEnemyWave(EnemyBall, 5)
    }
  }
  if (level > 3 &&gameTime % (11 - Math.min(10, level)) === 0 && enemies.length < 200) {
    const random = randomIntRange(1, 3)
    switch (random) {
      case 1:
        enemies.push(new EnemyBall())
        break
      case 2:
        enemies.push(new SlowEnemyBall())
        break
      case 3:
        enemies.push(new SmartEnemyBall())
        break
    }
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
  ]).forEach(entity => entity && entity.update && entity.update())
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
  ]).forEach(entity => entity && entity.draw && entity.draw())
}

window.addEventListener('resize', () => {
  canvas.height = window.innerHeight
  canvas.width = window.innerWidth
  gameSize = getGameSize()
  gameOffset = getGameOffset()
  update()
  draw()
})

const togglePause = () => pause = !pause

const newGame = () => {
  player = new PlayerBall()
  mouseController = false
  shields = [ new Shield() ]
  enemies = []
  explosions = []
  preGame = false
  isGameOver = false
  score = 0
  gameTime = 0
  level = 1
}

const checkIsGameOver = () => player.health <= 0

gameOver = () => {
  isGameOver = true
  gameOverTime = gameTime
  player.controller = false
  mouseController = false
  pause = false
}

const playGame = () => {
  handleGamePad()
  if (!isGameOver && checkIsGameOver()) {
    gameOver()
  }
  if (features.hyperTrails) {
    canvasContext.fillStyle = 'rgba(0,0,0,0.1)';
    canvasContext.fillRect(0,0,canvas.width,canvas.height);
  } else {
    canvasContext.clearRect(0,0, canvas.width, canvas.height)
  }
  if (!pause) {
    update()
  }
  draw()
  requestAnimationFrame(playGame)
}

const init = () => {
  idCounter = 0
  gameSize = getGameSize()
  gameOffset = getGameOffset()
  pause = false
  mouseController = false
  keysController = false
  gamepadController = false
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