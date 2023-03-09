const gameState = {
  features: {
    drawCenterRetical: 0,
    drawGameGrid: 0,
    handleSpawnEnemies: 1,
    handleEnemyOutOfBounds: 1,
    createExplosion: 1,
    hyperTrails: 0,
  },
}

const gameCanvasId = 'gameCanvas'
const canvas = document.getElementById(gameCanvasId)
const canvasContext = canvas.getContext('2d')
canvas.height = window.innerHeight
canvas.width = window.innerWidth

const drawBackground = () => {
  if (gameState.features.hyperTrails) return
  canvasContext.save()
  canvasContext.fillStyle = "black";
  canvasContext.fillRect(0, 0, canvas.width, canvas.height);
  canvasContext.restore()
}

const getGameSize = () => Math.max(canvas.width, canvas.height)
gameState.size = getGameSize()

const getGameOffset = () => {
  if (canvas.width > canvas.height) {
    return {
      x: 0,
      y: (gameState.size - canvas.height) / 2
    }
  }
  if (canvas.width < canvas.height) {
    return {
      x: (gameState.size - canvas.width) / 2,
      y: 0
    }
  }
  return {x: 0, y: 0}
}
gameState.offset = getGameOffset()

const drawCenterRetical = () => {
  if (!gameState.features.drawCenterRetical) return
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
  if (!gameState.features.drawGameGrid) return
  canvasContext.save()
  canvasContext.strokeStyle = 'red'
  canvasContext.lineWidth = 1
  canvasContext.beginPath()
  // vertical grid lines
  for (let x = 0; x <= 10; x++) {
    canvasContext.moveTo(gameState.size * x * 0.1 - gameState.offset.x, 0 - gameState.offset.y)
    canvasContext.lineTo(gameState.size * x * 0.1 - gameState.offset.x, gameState.size)
    canvasContext.stroke()
  }
  // horizontal grid lines
  for (let y = 0; y <= 10; y++) {
    canvasContext.moveTo(0 - gameState.offset.x, gameState.size * y * 0.1 - gameState.offset.y)
    canvasContext.lineTo(gameState.size, gameState.size * y * 0.1 - gameState.offset.y)
    canvasContext.stroke()
  }
  canvasContext.restore()
}

const getScaledFont = (scalar = 1) => `${gameState.size * .02 * scalar}px sans-serif`

const getScaledFontPixelValue = (scalar = 1) => gameState.size * .02 * scalar

const spacer = getScaledFontPixelValue(2)

const incrementScore = () => !gameState.gameOver && gameState.score++

const incrementTime = () => gameState.t++

class StartMenu {
  update() {
    if (!gameState.preGame) return
    if (
      gameState.mouse
      && !gameState.mouse.clicking
      && .4 < gameState.mouse.x
      && gameState.mouse.x < .6
      && .4 < gameState.mouse.y
      && gameState.mouse.y < .6
    ) newGame()
  }
  draw() {
    if (!gameState.preGame) return
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

class InGameMenu {
  draw() {
    if (gameState.gameOver) return
    const padding = spacer / 2
    canvasContext.save()
    canvasContext.font = getScaledFont();
    canvasContext.fillStyle = 'white';
    canvasContext.textAlign = 'start'
    canvasContext.textBaseline = 'hanging'
    canvasContext.fillText(`Score: ${gameState.score}`, padding, padding);
    canvasContext.fillText(`Time: ${gameState.t}`, padding, padding + spacer);
    canvasContext.restore()
  }
}

class EndGameMenu {
  update() {
    if (!gameState.gameOver || gameState.preGame) return
    if (
      gameState.mouse
      && !gameState.mouse.clicking
      && .4 < gameState.mouse.x
      && gameState.mouse.x < .6
      && .4 < gameState.mouse.y
      && gameState.mouse.y < .6
    ) newGame()
  }
  draw() {
    if (!gameState.gameOver || gameState.preGame) return
    const spacer = getScaledFontPixelValue(2)
    canvasContext.save()
    canvasContext.font = getScaledFont(2);
    canvasContext.fillStyle = 'white';
    canvasContext.textAlign = 'center'
    canvasContext.textBaseline = 'ideographic'
    canvasContext.fillText(`Game Over`, canvas.width / 2, canvas.height / 2 - spacer * 2);
    canvasContext.font = getScaledFont(1.5);
    canvasContext.fillText(`Score: ${gameState.score}`, canvas.width / 2, canvas.height / 2 - spacer); 
    canvasContext.font = getScaledFont(1.5);
    canvasContext.fillText(`Time: ${gameState.gameOverTime}`, canvas.width / 2, canvas.height / 2); 
    canvasContext.font = getScaledFont(1.5);
    canvasContext.fillText(`Tap Enter to Restart`, canvas.width / 2, canvas.height / 2 + spacer); 
    canvasContext.font = getScaledFont(1);
    canvasContext.fillText(`Controls: Arrow Keys, WASD,`, canvas.width / 2, canvas.height / 2 + spacer * 2.2);
    canvasContext.fillText(`Tap, or Click and Drag`, canvas.width / 2, canvas.height / 2 + spacer * 3);
    canvasContext.restore()
  }
}

const togglePause = () => gameState.pause = !gameState.pause

const randomIntRange = (min = 1, max = 100) =>  Math.floor(Math.random() * (max + 1 - min) + min)

const getPythagorean = (a, b) => Math.sqrt(a * a + b * b)

const getAngleBetweenPoints = (
  {x: x1, y: y1},
  {x: x2, y: y2}
 ) => Math.atan2((y2 - y1), (x2 - x1))

let idCounter = 0

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
    this.x = props.x || .5
    this.y = props.y || .5
    this.speedX = props.speedX || 0
    this.speedY = props.speedY || 0
    this.text = props.text
    this.textColor = props.textColor || 'black'
  }

  update() {
    this.x += this.speedX
    this.y += this.speedY
  }

  draw() {
    const {x, y, text, textColor} = this
    const {offset, size: gameStateSize} = gameState
    if (text) {
      canvasContext.save()
      canvasContext.fillStyle = textColor;
      canvasContext.font = getScaledFont(1)
      canvasContext.textAlign = 'center'
      canvasContext.textBaseline = 'middle'
      canvasContext.fillText(
        text,
        x * gameStateSize - offset.x,
        y * gameStateSize - offset.y
      )
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
    const {offset, size: gameStateSize} = gameState
    canvasContext.save()
    canvasContext.fillStyle = color
    canvasContext.globalAlpha = opacity
    canvasContext.beginPath()
    canvasContext.arc(
      x * gameStateSize - offset.x,
      y * gameStateSize - offset.y,
      size *  gameStateSize,
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
    if (!gameState.gameOver) this.mouse = gameState.mouse
    this.text = this.health
    if (gameState.gameOver) {
      this.size = 0
      this.color = 'black'
      this.text = undefined
    } else {
      this.color = `hsl(${12 * this.health} 100% 50%)`
      this.textColor = this.textColor
    }
  }
}

const getClosestEnemy = () => {
  return gameState.enemies.length && gameState.enemies.reduce((enemyA, enemyB) => {
    enemyA.distanceToPlayer = enemyA.distanceToPlayer || getDistanceBetweenBallCenters(gameState.player, enemyA)
    enemyB.distanceToPlayer = getDistanceBetweenBallCenters(gameState.player, enemyB)
    return enemyA.distanceToPlayer < enemyB.distanceToPlayer
      ? enemyA
      : enemyB
  })
}

class AIPlayerBall extends PlayerBall {
  update() {
    super.update()
    if (!(gameState.t % 10 == 0)) return
    const closestEnemy = getClosestEnemy()
    if (!closestEnemy) return;
    const angleAwayFromEnemy = getAngleBetweenPoints(gameState.player, closestEnemy) + Math.PI;
    this.mouse = {
      clicked: true,
      x: Math.cos(angleAwayFromEnemy),
      y: Math.sin(angleAwayFromEnemy)
    }
  }
}

const moveBasedOnKeyBoard = (ball) => {
  if (gameState.keys) {
    ball.x += (gameState.keys.right ? -gameState.player.speed : 0) + (gameState.keys.left ? gameState.player.speed : 0)
    ball.y += (gameState.keys.down ? -gameState.player.speed : 0) + (gameState.keys.up ? gameState.player.speed : 0)
  }
}

const moveBasedOnMouse = (ball) => {
  if (gameState.player.mouse) {
    const distanceToPlayer = getDistanceBetweenBallCenters(gameState.player.mouse, gameState.player)
    if (distanceToPlayer <= gameState.player.size) return
    const angleToMouse = getAngleBetweenPoints(gameState.player, gameState.player.mouse)
    ball.x -= gameState.player.speed * Math.cos(angleToMouse)
    ball.y -= gameState.player.speed * Math.sin(angleToMouse)
  }
}

const setSpeedTowardsTarget = (ball1, ball2, speed) => {
  const angleToTarget = getAngleBetweenPoints(ball1, ball2)
  ball1.speedX = speed * Math.cos(angleToTarget)
  ball1.speedY = speed * Math.sin(angleToTarget)
}

const handleEnemyOutOfBounds = (enemy) => {
  if (!gameState.features.handleEnemyOutOfBounds) return
  if (enemy.x > 1.2 || enemy.x < -.2 || enemy.y > 1.2 || enemy.y < -.2) {
    removeSelfFromArray(enemy, gameState.enemies)
  }
}

const handleEnemyCollisions = (enemy) => {
  const collisionWithPlayer = getCollisionDetected(enemy, gameState.player)
  const collisionWithShield = gameState.shields.some(shield => getCollisionDetected(enemy, shield))
  if (collisionWithPlayer || collisionWithShield) {
    removeSelfFromArray(enemy, gameState.enemies)
    if (collisionWithPlayer) {
      createExplosion({x:collisionWithPlayer.x , y:collisionWithPlayer.y, size: enemy.size})
      gameState.player.health -= 1
    }
    if (collisionWithShield) {
      createExplosion({x:enemy.x , y:enemy.y, size: enemy.size,color: enemy.color})
      incrementScore()
    }
  }
}

const setRandomLocationOnEdge = (ball) => {
  const random = Math.random()
  if (random < .25) {
    ball.x = 0 - ball.size
    ball.y = Math.random()
  } else if(random < .5) {
    ball.x = 1 + ball.size
    ball.y = Math.random()
  } else if(random < .75) {
    ball.x = Math.random()
    ball.y = 0 - ball.size
  } else {
    ball.x = Math.random()
    ball.y = 1 + ball.size
  }
}

class EnemyBall extends Ball {
  constructor() {
    super()
    this.color = 'darkred'
    this.size = 0.02
    setRandomLocationOnEdge(this)
    setSpeedTowardsTarget(this, gameState.player, .003)
  }

  update(){
    this.x += this.speedX
    this.y += this.speedY
    moveBasedOnKeyBoard(this)
    moveBasedOnMouse(this);
    handleEnemyOutOfBounds(this);
    handleEnemyCollisions(this)
  }
}

class SlowEnemyBall extends EnemyBall {
  constructor() {
    super()
    this.speedX = this.speedX * .75
    this.speedY = this.speedY * .75
    this.size = 0.026
    this.color = 'orangered'
  }
}

class SmartEnemyBall extends EnemyBall {
  constructor() {
    super()
    this.color = 'red'
  }
  update() {
    super.update()
    setSpeedTowardsTarget(this, gameState.player, getPythagorean(this.speedX, this.speedY))
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
      removeSelfFromArray(this, gameState.explosions)
    }
  }
}

const createExplosion = ({x, y, color, size} = {}) => {
  if (!gameState.features.createExplosion) return
  gameState.explosions.push(new Explosion({x, y, color, size}))
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
    this.angle += Math.PI / 100 * this.speed
    this.x = .5 + (this.distanceFromCenter * Math.cos(this.angle))
    this.y = .5 + (this.distanceFromCenter * Math.sin(this.angle))
  }
}

const getDistanceBetweenBallCenters = (ball1, ball2) => 
  Math.sqrt(
    Math.pow(
      Math.abs(ball1.x - ball2.x),
      2
    )
    +
    Math.pow(
      Math.abs(ball1.y - ball2.y),
      2
    )
  )

const getCollisionDetected = (ball1, ball2) => {
  const distanceBetweenBallCenters = getDistanceBetweenBallCenters(ball1, ball2)

  if (distanceBetweenBallCenters < ball1.size + ball2.size) {
    return {
      x: ball1.x + (ball2.x - ball1.x) * (ball1.size / distanceBetweenBallCenters),
      y: ball1.y + (ball2.y - ball1.y) * (ball1.size / distanceBetweenBallCenters)
    }
  }
}

const handleSpawnEnemies = () => {
  if (!gameState.features.handleSpawnEnemies) return
  if (gameState.t % 4 === 0 && gameState.enemies.length < 200) {
    const random = randomIntRange(1, 3)
    const nEnemies = gameState.enemies.length
    switch (random) {
      case 1:
        gameState.enemies.push(new EnemyBall())
        break
      case 2:
        gameState.enemies.push(new SlowEnemyBall())
        break
      case 3:
        gameState.enemies.push(new SmartEnemyBall())
        break
    }
  }
}

const update = () => {
  ;([
    gameState.player,
    ...gameState.shields,
    ...gameState.enemies,
    ...gameState.explosions,
    gameState.inGameMenu,
    gameState.startMenu,
    gameState.endGameMenu,
  ]).forEach(entity => entity && entity.update && entity.update())
  handleSpawnEnemies()
}
 
const draw = () => {
  drawBackground()
  ;([
    gameState.player,
    ...gameState.shields,
    ...gameState.enemies,
    ...gameState.explosions,
    gameState.inGameMenu,
    gameState.startMenu,
    gameState.endGameMenu,
  ]).forEach(entity => entity && entity.draw && entity.draw())
}

window.addEventListener('resize', () => {
  canvas.height = window.innerHeight
  canvas.width = window.innerWidth
  gameState.size = getGameSize()
  gameState.offset = getGameOffset()
  update()
  draw()
})

document.addEventListener('keydown', (event) => {
  gameState.mouse = false
  if (!gameState.keys) gameState.keys = {}
  switch (event.key) {
    case "ArrowUp":
    case "w":
      if (gameState.gameOver) break;
      gameState.keys.up = true
      break
    case "ArrowDown":
    case "s":
      if (gameState.gameOver) break;
      gameState.keys.down = true
      break
    case "ArrowRight":
    case "d":
      if (gameState.gameOver) break;
      gameState.keys.right = true
      break
    case "ArrowLeft":
    case "a":
      if (gameState.gameOver) break;
      gameState.keys.left = true
      break
    case "Escape":
      if (gameState.gameOver) break;
      togglePause()
      break
    case "Enter":
      newGame()
      break
  }
})

document.addEventListener('keyup', (event) => {
  gameState.mouse = false
  switch (event.key) {
    case "ArrowUp":
    case "w":
      gameState.keys.up = false
      break;
    case "ArrowDown":
    case "s":
      gameState.keys.down = false
      break;
    case "ArrowRight":
    case "d":
      gameState.keys.right = false
      break;
    case "ArrowLeft":
    case "a":
      gameState.keys.left = false
      break;
  }
})

document.addEventListener('mousedown', (event) => {
  gameState.keys = false
  gameState.mouse = {
    clicking: true,
    x: event.pageX / canvas.width,
    y: event.pageY / canvas.height
  }
});

document.addEventListener('mouseup', (event) => {
  gameState.keys = false
  gameState.mouse = {
    clicking: false,
    x: event.pageX / canvas.width,
    y: event.pageY / canvas.height
  }
});

document.addEventListener('mousemove', (event) => {
  if (gameState.mouse && gameState.mouse.clicking) {
    gameState.mouse.x = event.pageX / canvas.width,
    gameState.mouse.y = event.pageY / canvas.height
  }
});

const newGame = () => {
  gameState.player = new PlayerBall()
  gameState.shields = [ new Shield() ]
  gameState.enemies = []
  gameState.explosions = []
  gameState.preGame = false
  gameState.gameOver = false
  gameState.score = 0
  gameState.t = 0
  gameState.keys = false
  gameState.mouse = false
}

const getIsGameOver = () => gameState.player.health <= 0

gameOver = () => {
  gameState.gameOver = true
  gameState.gameOverTime = gameState.t
  gameState.keys = false
  gameState.mouse = false
  gameState.player.mouse = false
  gameState.pause = false
}

const playGame = () => {
  if (!gameState.gameOver && getIsGameOver()) {
    gameOver()
  }
  if (gameState.features.hyperTrails) {
    canvasContext.fillStyle = 'rgba(0,0,0,0.1)';
    canvasContext.fillRect(0,0,canvas.width,canvas.height);
  } else {
    canvasContext.clearRect(0,0, canvas.width, canvas.height)
  }
  update()
  draw()
  incrementTime()
}

const runGame = () => {
  if (gameState.pause) {

  } else {
    playGame()
  }

  requestAnimationFrame(runGame)
}

const init = () => {
  gameState.t = 0
  gameState.gameOver = true
  gameState.preGame = true
  gameState.player = new AIPlayerBall()
  gameState.shields = []
  gameState.enemies = []
  gameState.explosions = []
  gameState.size = getGameSize()
  gameState.startMenu = new StartMenu()
  gameState.inGameMenu = new InGameMenu()
  gameState.endGameMenu = new EndGameMenu()
  runGame()
}

init()