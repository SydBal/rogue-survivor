const gameState = {
  t: 0,
  keys: {
    up: false,
    down: false,
    left: false,
    right: false,
  },
  features: {
    drawCenterRetical: 0,
    drawGameGrid: 0,
    handleEnemyUpdate: 1,
    createExplosion: 1,
    hyperTrails: 0,
  },
}

const gameCanvasId = 'gameCanvas'
const canvas = document.getElementById(gameCanvasId)
const ctx = canvas.getContext('2d')
canvas.height = window.innerHeight
canvas.width = window.innerWidth

const drawBackground = () => {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

let getGameSize = () => Math.max(canvas.width, canvas.height)
gameState.size = getGameSize()

let getGameOffset = () => {
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
  ctx.strokeStyle = 'red'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(canvas.width / 2 - 10, canvas.heigh / 2)
  ctx.lineTo(canvas.width/ 2 + 10, canvas.height / 2)
  ctx.stroke()
  ctx.moveTo(canvas.width / 2, canvas.height / 2 - 10)
  ctx.lineTo(canvas.width / 2, canvas.height / 2 + 10)
  ctx.stroke()
}

const drawGameGrid = () => {
  if (!gameState.features.drawGameGrid) return
  ctx.strokeStyle = 'red'
  ctx.lineWidth = 1
  ctx.beginPath()
  // vertical grid lines
  for (let x = 0; x <= 10; x++) {
    ctx.moveTo(gameState.size * x * 0.1 - gameState.offset.x, 0 - gameState.offset.y)
    ctx.lineTo(gameState.size * x * 0.1 - gameState.offset.x, gameState.size)
    ctx.stroke()
  }
  // horizontal grid lines
  for (let y = 0; y <= 10; y++) {
    ctx.moveTo(0 - gameState.offset.x, gameState.size * y * 0.1 - gameState.offset.y)
    ctx.lineTo(gameState.size, gameState.size * y * 0.1 - gameState.offset.y)
    ctx.stroke()
  }
}

const getScaledFont = (scalar = 1) => `${gameState.size * .02 * scalar}px sans-serif`

const getScaledFontPixelValue = (scalar = 1) => gameState.size * .02 * scalar

const incrementScore = () => !gameState.gameOver && gameState.score++

class StartMenu {
  draw() {
    const spacer = getScaledFontPixelValue(2)
    ctx.font = getScaledFont(2);
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center'
    ctx.textBaseline = 'ideographic'
    ctx.fillText(`Survivor Prototype`, canvas.width / 2, canvas.height / 2);
    ctx.font = getScaledFont(1.5);
    ctx.fillText(`Tap Enter to Start`, canvas.width / 2, canvas.height / 2 + spacer); 
    ctx.font = getScaledFont(1);
    ctx.fillText(`Controls: Arrow Keys, WASD,`, canvas.width / 2, canvas.height / 2 + (spacer * 2.2));
    ctx.fillText(`Tap, or Click and Drag`, canvas.width / 2, canvas.height / 2 + (spacer * 3));
  }
  update() {
    if (
      gameState.mouse
      && !gameState.mouse.clicking
      && .4 < gameState.mouse.x
      && gameState.mouse.x < .6
      && .4 < gameState.mouse.y
      && gameState.mouse.y < .6
    ) newGame()
  }
}

class InGameMenu {
  draw() {
    const padding = getScaledFontPixelValue()
    ctx.font = getScaledFont();
    ctx.fillStyle = 'white';
    ctx.textAlign = 'start'
    ctx.textBaseline = 'hanging'
    ctx.fillText(`Score: ${gameState.score}`, padding, padding);
  }
}

class EndGameMenu {
  draw() {
    const spacer = getScaledFontPixelValue(2)
    ctx.font = getScaledFont(2);
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center'
    ctx.textBaseline = 'ideographic'
    ctx.fillText(`Game Over`, canvas.width / 2, canvas.height / 2 - spacer);
    ctx.font = getScaledFont(1.5);
    ctx.fillText(`Score: ${gameState.score}`, canvas.width / 2, canvas.height / 2); 
    ctx.font = getScaledFont(1.5);
    ctx.fillText(`Tap Enter to Restart`, canvas.width / 2, canvas.height / 2 + spacer); 
    ctx.font = getScaledFont(1);
    ctx.fillText(`Controls: Arrow Keys, WASD,`, canvas.width / 2, canvas.height / 2 + (spacer * 2.2));
    ctx.fillText(`Tap, or Click and Drag`, canvas.width / 2, canvas.height / 2 + (spacer * 3));
  }
  update() {
    if (
      gameState.mouse
      && !gameState.mouse.clicking
      && .4 < gameState.mouse.x
      && gameState.mouse.x < .6
      && .4 < gameState.mouse.y
      && gameState.mouse.y < .6
    ) newGame()
  }
}

const togglePause = () => gameState.pause = !gameState.pause

const randomIntRange = (min = 1, max = 100) =>  Math.floor(Math.random() * (max + 1 - min) + min)

class Ball {
  constructor({
    x,
    y,
    size,
    speedX,
    speedY,
    color,
    opacity
  } = {}) {
    this.x = x || .5
    this.y = y || .5
    this.size = size || 0.03
    this.speedX = speedX || 0
    this.speedY = speedY || 0
    this.color = color || 'black'
    this.opacity = opacity || 1
    this.text = undefined
    this.textColor = 'black'
  }
  update() {
    this.x += this.speedX
    this.y += this.speedY
  }
  draw() {
    const {color, x, y, size, opacity} = this
    const {offset, size: gameStateSize} = gameState
    ctx.fillStyle = color
    ctx.globalAlpha = opacity
    ctx.beginPath()
    ctx.arc(
      x * gameStateSize - offset.x,
      y * gameStateSize - offset.y,
      size *  gameStateSize,
      0,
      Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    if (this.text) {
      ctx.fillStyle = this.textColor;
      ctx.font = getScaledFont(1)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        this.text,
        x * gameStateSize - offset.x,
        y * gameStateSize - offset.y
      )
    }
  }
}

class PlayerBall extends Ball {
  constructor(props) {
    super(props)
    this.health = props ? props.health : 10
    this.text = this.health
    this.color = `hsl(${12 * this.health} 100% 50%)`
    this.textColor = 'black'
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
    const angleAwayFromEnemy = getAngleToLocation(gameState.player, closestEnemy) + Math.PI;
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
    const angleToMouse = getAngleToLocation(gameState.player, gameState.player.mouse)
    ball.x -= gameState.player.speed * Math.cos(angleToMouse)
    ball.y -= gameState.player.speed * Math.sin(angleToMouse)
  }
}

const setSpeedTowardsTarget = (ball1, ball2, speed) => {
  const angleToTarget = getAngleToLocation(ball1, ball2)
  ball1.speedX = speed * Math.cos(angleToTarget)
  ball1.speedY = speed * Math.sin(angleToTarget)
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
    this.color = 'red'
    this.size = 0.02

    setRandomLocationOnEdge(this)
    setSpeedTowardsTarget(this, gameState.player, .003)
  }

  update(){
    this.x += this.speedX
    this.y += this.speedY

    moveBasedOnKeyBoard(this)
    moveBasedOnMouse(this);
    setSpeedTowardsTarget(this, gameState.player, getPythagorean(this.speedX, this.speedY))
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

class DumbEnemyBall extends EnemyBall {
  constructor() {
    super()
    this.color = 'darkred'
  }
  update() {
    this.x += this.speedX
    this.y += this.speedY

    moveBasedOnKeyBoard(this)
    moveBasedOnMouse(this);
  }
}

class Explosion extends Ball {  
  constructor(props) {
    super(props)
    this.size = props.size || 0.01
    this.color = props.color || 'BlueViolet'
    this.opacity = 1
  }
  update() {
    super.update()
    this.size += 0.001
    this.opacity -= 0.1
  }
}

class Shield extends Ball {
  constructor() {
    super()
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

const createExplosion = ({x, y, ...other}) => {
  if (!gameState.features.createExplosion) return
  gameState.explosions.push(new Explosion({x, y, ...other}))
}

const getPythagorean = (a, b) => Math.sqrt(a * a + b * b)

const getAngleToLocation = (ball1, ball2) => {
  return Math.atan2((ball2.y - ball1.y), (ball2.x - ball1.x))
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

const handleShieldsUpdate = () => {
  gameState.shields.forEach(shield => shield.update())
}

const handleEnemyUpdate = () => {
  if (!gameState.features.handleEnemyUpdate) return

  gameState.enemies.forEach((enemy, i) => {
    enemy.update()
    // delete out of bounds enemies
    if (enemy.x > 1.2 || enemy.x < -.2 || enemy.y > 1.2 || enemy.y < -.2) {
      gameState.enemies.splice(i, 1)
      return
    }
    // collisions
    const collisionWithPlayer = getCollisionDetected(enemy, gameState.player)
    const collisionWithShield = gameState.shields.some(shield => getCollisionDetected(enemy, shield))
    if (collisionWithPlayer || collisionWithShield) {
      gameState.enemies.splice(i, 1)
      if (collisionWithPlayer) {
        createExplosion({x:collisionWithPlayer.x , y:collisionWithPlayer.y, size: enemy.size})
        gameState.player.health -= 1
      }
      if (collisionWithShield) {
        createExplosion({x:enemy.x , y:enemy.y, size: enemy.size,color: enemy.color})
        incrementScore()
      }
    }
  })
  
  if (gameState.t % 4 === 0 && gameState.enemies.length < 200) {
    const random = randomIntRange(1, 3)
    switch (random) {
      case 1:
        gameState.enemies.push(new EnemyBall())
        break
      case 2:
        gameState.enemies.push(new SlowEnemyBall())
        break
      case 3:
        gameState.enemies.push(new DumbEnemyBall())
        break
    }
  }
}

const handleExplosionUpdate = () => {
  gameState.explosions.forEach((explosion, i) => {
    explosion.update()
    if (explosion.opacity <= 0) {
      gameState.explosions.splice(i, 1)
    }
  })
}

const handleMenuUpdate = () => {
  const {
    startMenu,
    endGameMenu
  } = gameState
  if (startMenu) startMenu.update()
  if (endGameMenu) endGameMenu.update()
}

const update = () => {
  gameState.player.update()
  handleShieldsUpdate()
  handleEnemyUpdate()
  handleExplosionUpdate()
  handleMenuUpdate()
}

const drawShields = () => {
  gameState.shields.forEach(shield => shield.draw())
}

const drawEnemies = () => {
  for (enemy of gameState.enemies) {
    enemy.draw()
  }
}

const drawExplosions = () => {
  for (explosion of gameState.explosions) {
    explosion.draw()
  }
}

const drawInGameMenu = () => {
  if (gameState.inGameMenu) gameState.inGameMenu.draw()
}

const drawStartMenu = () => {
  if (gameState.startMenu) gameState.startMenu.draw()
}

const drawEndGameMenu = () => {
  if (gameState.endGameMenu) gameState.endGameMenu.draw()
}
 
const draw = () => {
  !gameState.features.hyperTrails && drawBackground()
  gameState.player.draw()
  drawShields()
  drawEnemies()
  drawExplosions()
  drawCenterRetical()
  drawGameGrid()
  drawInGameMenu()
  drawStartMenu()
  drawEndGameMenu()
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
  gameState.gameOver = false
  gameState.score = 0
  gameState.keys = false
  gameState.mouse = false
  gameState.startMenu = false
  gameState.endGameMenu = false
  gameState.inGameMenu = new InGameMenu()
}

const getIsGameOver = () => gameState.player.health <= 0

gameOver = () => {
  gameState.gameOver = true
  gameState.keys = false
  gameState.mouse = false
  gameState.player.mouse = false
  gameState.pause = false
  gameState.inGameMenu = false
  gameState.endGameMenu = new EndGameMenu()
}

const playGame = () => {
  if (!gameState.gameOver && getIsGameOver()) {
    gameOver()
  }
  if (gameState.features.hyperTrails) {
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  } else {
    ctx.clearRect(0,0, canvas.width, canvas.height)
  }
  update()
  draw()
  gameState.t += 1
}

const runGame = () => {
  if (gameState.pause) {

  } else {
    playGame()
  }

  requestAnimationFrame(runGame)
}

const init = () => {
  gameState.gameOver = true
  gameState.preGame = true
  gameState.player = new AIPlayerBall()
  gameState.shields = []
  gameState.enemies = []
  gameState.explosions = []
  gameState.size = getGameSize()
  gameState.startMenu = new StartMenu()
  runGame() 
}

init()