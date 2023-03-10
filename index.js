const gameState = {}

const features = {
  drawCenterRetical: 0,
  drawGameGrid: 0,
  drawEntityVelocityVector: 0,
  handleSpawnEnemies: 1,
  handleEnemyOutOfBounds: 1,
  createExplosion: 1,
  hyperTrails: 0,
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

const getGameSize = () => Math.max(canvas.width, canvas.height)

const getGameOffset = () => {
  if (canvas.width > canvas.height) {
    return {
      x: 0,
      y: (gameSize - canvas.height) / 2
    }
  }
  if (canvas.width < canvas.height) {
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
  spacer = getScaledFontPixelValue(2)
}

class StartMenu extends Menu {
  update() {
    if (!preGame) return
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
    if (!preGame) return
    canvasContext.save()
    canvasContext.font = getScaledFont(2);
    canvasContext.fillStyle = 'white';
    canvasContext.textAlign = 'center'
    canvasContext.textBaseline = 'ideographic'
    canvasContext.fillText(`Survivor Prototype`, canvas.width / 2, canvas.height / 2);
    canvasContext.font = getScaledFont(1.5);
    canvasContext.fillText(`Tap Enter to Start`, canvas.width / 2, canvas.height / 2 + this.spacer); 
    canvasContext.font = getScaledFont(1);
    canvasContext.fillText(`Controls: Arrow Keys, WASD,`, canvas.width / 2, canvas.height / 2 + (this.spacer * 2.2));
    canvasContext.fillText(`Tap, or Click and Drag`, canvas.width / 2, canvas.height / 2 + (this.spacer * 3));
    canvasContext.restore()
  }
}

class InGameMenu extends Menu {
  draw() {
    if (isGameOver) return
    const padding = this.spacer / 2
    canvasContext.save()
    canvasContext.font = getScaledFont();
    canvasContext.fillStyle = 'white';
    canvasContext.textAlign = 'start'
    canvasContext.textBaseline = 'hanging'
    canvasContext.fillText(`Level ${level}`, padding, padding);
    canvasContext.fillText(`Score: ${score}`, padding, padding + this.spacer);
    canvasContext.fillText(`Time: ${gameTime}`, padding, padding + this.spacer * 2);
    canvasContext.restore()
  }
}

class EndGameMenu extends Menu {
  update() {
    if (!isGameOver || preGame) return
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
    if (!isGameOver || preGame) return
    canvasContext.save()
    canvasContext.font = getScaledFont(2);
    canvasContext.fillStyle = 'white';
    canvasContext.textAlign = 'center'
    canvasContext.textBaseline = 'ideographic'
    canvasContext.fillText(`Game Over`, canvas.width / 2, canvas.height / 2 - this.spacer * 2);
    canvasContext.font = getScaledFont(1.5);
    canvasContext.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 - this.spacer); 
    canvasContext.font = getScaledFont(1.5);
    canvasContext.fillText(`Time: ${gameOverTime}`, canvas.width / 2, canvas.height / 2); 
    canvasContext.font = getScaledFont(1.5);
    canvasContext.fillText(`Tap Enter to Restart`, canvas.width / 2, canvas.height / 2 + this.spacer); 
    canvasContext.font = getScaledFont(1);
    canvasContext.fillText(`Controls: Arrow Keys, WASD,`, canvas.width / 2, canvas.height / 2 + this.spacer * 2.2);
    canvasContext.fillText(`Tap, or Click and Drag`, canvas.width / 2, canvas.height / 2 + this.spacer * 3);
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
    const {x, y, speedX, speedY, text, textColor} = this
    if (text) {
      canvasContext.save()
      canvasContext.fillStyle = textColor;
      canvasContext.font = getScaledFont(1)
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
    if (!isGameOver) this.playerControlledDirection = gameState[gameState.lastUsedController]
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
    gameState.lastUsedController = 'mouse'
  }
  update() {
    super.update()
    if (!(gameTime % 10 == 0)) return
    const closestEnemy = getClosestEnemy()
    if (!closestEnemy) return;
    const angleAwayFromEnemy = getAngleBetweenPoints(player, closestEnemy) + Math.PI;
    this.playerControlledDirection = {
      clicked: true,
      x: Math.cos(angleAwayFromEnemy),
      y: Math.sin(angleAwayFromEnemy)
    }
  }
}

const moveBasedOnKeyBoard = (ball) => {
  if (
    gameState.lastUsedController === 'keys'
    && gameState.keys
  ) {
    ball.x += (gameState.keys.right ? -player.speed : 0) + (gameState.keys.left ? player.speed : 0)
    ball.y += (gameState.keys.down ? -player.speed : 0) + (gameState.keys.up ? player.speed : 0)
  }
}

const moveBasedOnMouse = (ball) => {
  if (
    gameState.lastUsedController === 'mouse'
    && player.playerControlledDirection
  ) {
    const distanceToPlayer = getDistanceBetweenEntityCenters(player.playerControlledDirection, player)
    if (distanceToPlayer <= player.size) return
    const angleToMouse = getAngleBetweenPoints(player, player.playerControlledDirection)
    ball.x -= player.speed * Math.cos(angleToMouse)
    ball.y -= player.speed * Math.sin(angleToMouse)
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
    setRandomLocationOnEdge(this)
    setSpeedTowardsTarget(this, player, .003)
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
  if (gameTime % (11 - Math.min(10, level)) === 0 && enemies.length < 200) {
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
    inGameMenu,
    startMenu,
    endGameMenu,
  ]).forEach(entity => entity && entity.update && entity.update())
  handleSpawnEnemies()
  incrementTime()
}
 
const draw = () => {
  drawBackground()
  ;([
    player,
    ...shields,
    ...enemies,
    ...explosions,
    inGameMenu,
    startMenu,
    endGameMenu,
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

document.addEventListener('keydown', (event) => {
  if (!isGameOver) gameState.lastUsedController = 'keys'
  if (!gameState.keys) gameState.keys = {}
  switch (event.key) {
    case "ArrowUp":
    case "w":
      if (isGameOver) break;
      gameState.keys.up = true
      break
    case "ArrowDown":
    case "s":
      if (isGameOver) break;
      gameState.keys.down = true
      break
    case "ArrowRight":
    case "d":
      if (isGameOver) break;
      gameState.keys.right = true
      break
    case "ArrowLeft":
    case "a":
      if (isGameOver) break;
      gameState.keys.left = true
      break
    case "Escape":
      if (isGameOver) break;
      togglePause()
      break
    case "Enter":
      newGame()
      break
  }
})

document.addEventListener('keyup', (event) => {
  if (!isGameOver) gameState.lastUsedController = 'keys'
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
  if (!isGameOver) gameState.lastUsedController = 'mouse'
  gameState.mouse = {
    clicking: true,
    x: event.pageX / canvas.width,
    y: event.pageY / canvas.height
  }
});

document.addEventListener('mouseup', (event) => {
  if (!isGameOver) gameState.lastUsedController = 'mouse'
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
  player = new PlayerBall()
  shields = [ new Shield() ]
  enemies = []
  explosions = []
  preGame = false
  isGameOver = false
  score = 0
  gameTime = 0
  level = 1
  gameState.lastUsedController = undefined
}

const checkIsGameOver = () => player.health <= 0

gameOver = () => {
  isGameOver = true
  gameOverTime = gameTime
  gameState.lastUsedController = undefined
  player.playerControlledDirection = false
  gameState.pause = false
}

const playGame = () => {
  if (!isGameOver && checkIsGameOver()) {
    gameOver()
  }
  if (features.hyperTrails) {
    canvasContext.fillStyle = 'rgba(0,0,0,0.1)';
    canvasContext.fillRect(0,0,canvas.width,canvas.height);
  } else {
    canvasContext.clearRect(0,0, canvas.width, canvas.height)
  }
  if (gameState.pause) {

  } else {
    update()
  }
  draw()
  requestAnimationFrame(playGame)
}

const init = () => {
  idCounter = 0
  gameSize = getGameSize()
  gameOffset = getGameOffset()
  gameTime = 0
  isGameOver = true
  preGame = true
  level = 3
  player = new AIPlayerBall()
  shields = []
  enemies = []
  explosions = []
  startMenu = new StartMenu()
  inGameMenu = new InGameMenu()
  endGameMenu = new EndGameMenu()
  playGame()
}

init()