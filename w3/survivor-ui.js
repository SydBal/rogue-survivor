/* ============================================================================
 * Survivor UI — canvas buttons, containers, modals, and keyboard focus.
 *
 * Inspired by Classic Scoundrel's UI system (its FocusManager, ScoundrelButton,
 * ScoundrelContainer, and ScoundrelModal), redrawn in Rogue Survivor's own
 * style: plain boxes, no cropped corners, hard offset shadows like the ones
 * on dominic.balass.one (`box-shadow: 6px 6px 0 var(--accent-soft)`).
 *
 * DESIGN DECISION — one scale factor, like the game and like Dymensions:
 * Classic Scoundrel lays out all UI in a virtual resolution and maps it onto
 * the canvas with a single scale (Dymensions.toScale). Rogue Survivor's game
 * world does the same thing with `gameSize`: every entity length is a
 * fraction of it. The menus follow both: EVERY menu length below is a
 * fraction of `gameSize` (see SurvivorDimensions), so menus and game can
 * never drift apart on ultrawide, laptop, or portrait phones. There are no
 * fixed-pixel widths anywhere — panels measure their own text with
 * measureText and size to fit, which is what keeps labels inside their boxes
 * at every aspect ratio. (Week 1 of this UI hardcoded 440px panels while
 * fonts scaled with gameSize; on ultrawide the title spilled out of its box.)
 *
 * This file must load BEFORE index.js. It only defines classes and helpers;
 * everything it touches from the engine (canvasContext, gameSize, canvas,
 * mouseController) is resolved at call time, when index.js has already run.
 * ========================================================================== */

const SurvivorUITheme = {
  fontFamily: 'sans-serif',
  panelFill: '#0c0c11',
  buttonFill: '#14141b',
  buttonFillHover: '#1d1d28',
  buttonFillPressed: '#09090d',
  text: '#ffffff',
  textDim: '#a7a7c0',
  border: '#3d3d52',
  accent: '#a78bfa', // site dark-theme --accent
  shadow: '#221c38', // site dark-theme --accent-soft
  backdrop: 'rgba(0, 0, 0, 0.65)',
  disabledFill: '#101016',
  disabledText: '#55556a',
  borderWidth: 2,
}

// ---------------------------------------------------------------------------
// SurvivorDimensions — the single-scale layout system. All values are
// fractions of `gameSize`, the same unit the game world is drawn in.
// ---------------------------------------------------------------------------
const SurvivorDimensions = {
  fontBase: 0.02, // the game's own base font fraction (getScaledFontPixelValue)
  titleMul: 1.6, // panel title font = fontBase * titleMul
  bodyMul: 0.95, // modal body font = fontBase * bodyMul
  statMul: 1.1, // game-over stat lines = fontBase * statMul
  buttonHMul: 1.9, // button height = fontBase * buttonHMul
  buttonWRatio: 0.62, // button width = panelWidth * buttonWRatio
  gapMul: 0.55, // vertical gaps = fontBase * gapMul
  padMul: 0.8, // panel padding = fontBase * padMul
  lineHMul: 1.3, // stat/body line height = fontBase * lineHMul
  shadow: 0.006, // hard offset shadow, like the site's 6px 6px 0
  minPanel: 0.22, // panels never narrower than this fraction of gameSize...
  maxPanel: 0.6, // ...nor wider than this
}

const uiPx = (fraction) => Math.max(1, Math.round(fraction * gameSize))
const uiFontBase = () => uiPx(SurvivorDimensions.fontBase)
const buttonLabelPx = (buttonHeight) => Math.max(12, Math.round(buttonHeight * 0.4))

const measureTextWidth = (text, fontPx) => {
  canvasContext.font = `${fontPx}px ${SurvivorUITheme.fontFamily}`
  return canvasContext.measureText(text).width
}

// Panel width from content: the widest of the title, body lines, and button
// labels (labels are scaled up because buttons only span buttonWRatio of the
// panel). Clamped to the screen and to sane fractions so nothing can overflow.
const fitPanelWidth = ({ title, titlePx, lines = [], linePx, buttonLabels = [], labelPx }) => {
  const D = SurvivorDimensions
  let need = 0
  if (title) need = Math.max(need, measureTextWidth(title, titlePx))
  lines.forEach((line) => {
    need = Math.max(need, measureTextWidth(line, linePx))
  })
  buttonLabels.forEach((label) => {
    need = Math.max(need, measureTextWidth(label, labelPx) / D.buttonWRatio)
  })
  const pad = uiPx(D.fontBase * D.padMul)
  const minW = uiPx(D.minPanel)
  const maxW = Math.max(minW, Math.min(canvas.width * 0.94, uiPx(D.maxPanel)))
  return Math.min(maxW, Math.max(minW, Math.round(need + pad * 2 + uiPx(0.02))))
}

// Standard fit for a titled panel with buttons and optional body lines.
const fitTitledPanel = (menu, lines = [], linePx = uiFontBase()) => {
  const D = SurvivorDimensions
  return fitPanelWidth({
    title: menu.container.title,
    titlePx: menu.container.titleFontPx(),
    lines,
    linePx,
    buttonLabels: menu.buttons.map((b) => b.label),
    labelPx: buttonLabelPx(uiPx(D.fontBase * D.buttonHMul)),
  })
}

// Pointer in canvas pixels, from whichever mouse/touch controller is live.
const getPointerPixels = () => {
  if (typeof mouseController === 'undefined' || !mouseController) return null
  return {
    x: mouseController.x * canvas.width,
    y: mouseController.y * canvas.height,
    down: !!mouseController.clicking,
  }
}

// ---------------------------------------------------------------------------
// SurvivorFocusManager — keyboard focus navigation, à la Classic Scoundrel's
// FocusManager: a registry of focusables, Tab/arrow cycling that wraps around,
// Enter/Space activation, disabled skipping, and modal focus trapping.
// ---------------------------------------------------------------------------
class SurvivorFocusManager {
  constructor() {
    this.focusables = []
    this.currentFocusIndex = -1
    this.isModalMode = false
    this.modalFocusables = []
    this.savedFocusIndex = -1
    this.savedFocusId = null
  }

  activeList() {
    return this.isModalMode ? this.modalFocusables : this.focusables
  }

  navigable(list) {
    return list.filter((f) => !f.isDisabled)
  }

  register(focusable) {
    // Normalize on registration so stale flags from a previous screen can't leak.
    focusable.isFocused = false
    if (!this.focusables.some((f) => f.id === focusable.id)) {
      this.focusables.push(focusable)
    }
  }

  registerAll(focusables) {
    focusables.forEach((f) => this.register(f))
  }

  unregister(id) {
    const drop = (list) => {
      const index = list.findIndex((f) => f.id === id)
      if (index === -1) return list
      const [item] = list.splice(index, 1)
      if (item.isFocused) {
        item.isFocused = false
        if (item.onBlur) item.onBlur()
      }
      return list
    }
    this.focusables = drop(this.focusables)
    this.modalFocusables = drop(this.modalFocusables)
    if (this.currentFocusIndex >= this.activeList().length) {
      this.currentFocusIndex = this.activeList().length - 1
    }
  }

  clear() {
    this.activeList().forEach((f) => {
      f.isFocused = false
      if (f.onBlur) f.onBlur()
    })
    this.focusables = []
    this.modalFocusables = []
    this.currentFocusIndex = -1
    this.isModalMode = false
    this.savedFocusIndex = -1
    this.savedFocusId = null
  }

  clearCurrentFocus() {
    const list = this.navigable(this.activeList())
    const current = list[this.currentFocusIndex]
    if (current) {
      current.isFocused = false
      if (current.onBlur) current.onBlur()
    }
  }

  applyFocus() {
    const list = this.navigable(this.activeList())
    // Single-focus invariant: blur everything before focusing the next one.
    this.focusables.concat(this.modalFocusables).forEach((f) => {
      if (f.isFocused) {
        f.isFocused = false
        if (f.onBlur) f.onBlur()
      }
    })
    const next = list[this.currentFocusIndex]
    if (next) {
      next.isFocused = true
      if (next.onFocus) next.onFocus()
    }
  }

  focusNext() {
    const list = this.navigable(this.activeList())
    if (!list.length) return
    this.clearCurrentFocus()
    this.currentFocusIndex = (this.currentFocusIndex + 1) % list.length
    this.applyFocus()
  }

  focusPrevious() {
    const list = this.navigable(this.activeList())
    if (!list.length) return
    this.clearCurrentFocus()
    this.currentFocusIndex = (this.currentFocusIndex - 1 + list.length) % list.length
    this.applyFocus()
  }

  setFocusById(id) {
    const list = this.navigable(this.activeList())
    const index = list.findIndex((f) => f.id === id)
    if (index === -1) return
    this.clearCurrentFocus()
    this.currentFocusIndex = index
    this.applyFocus()
  }

  getCurrentFocus() {
    const list = this.navigable(this.activeList())
    return list[this.currentFocusIndex] || null
  }

  // Trap focus inside a modal's buttons. Call when the modal opens.
  enterModalMode(modalFocusables, initialFocusIndex = 0) {
    const current = this.getCurrentFocus()
    this.savedFocusIndex = this.currentFocusIndex
    this.savedFocusId = current ? current.id : null
    this.clearCurrentFocus()
    this.isModalMode = true
    this.modalFocusables = modalFocusables
    this.currentFocusIndex = Math.max(0, initialFocusIndex)
    this.applyFocus()
  }

  // Leave the trap and restore whatever was focused before. Call on close.
  exitModalMode() {
    this.clearCurrentFocus()
    this.isModalMode = false
    this.modalFocusables = []
    const savedId = this.savedFocusId
    const savedIndex = this.savedFocusIndex
    this.savedFocusId = null
    this.savedFocusIndex = -1
    if (savedId) {
      const restored = this.focusables.findIndex((f) => f.id === savedId)
      if (restored >= 0) {
        this.currentFocusIndex = restored
        this.applyFocus()
        return
      }
    }
    this.currentFocusIndex = savedIndex >= 0
      ? Math.min(savedIndex, this.focusables.length - 1)
      : -1
    this.applyFocus()
  }

  isInModalMode() {
    return this.isModalMode
  }

  // Returns true when the key was consumed by menu navigation.
  handleKeyDown(event) {
    const key = event.key
    if (key === 'Tab') {
      if (event.shiftKey) this.focusPrevious()
      else this.focusNext()
      return true
    }
    if (key === 'ArrowDown' || key === 'ArrowRight') {
      this.focusNext()
      return true
    }
    if (key === 'ArrowUp' || key === 'ArrowLeft') {
      this.focusPrevious()
      return true
    }
    if ((key === 'Enter' || key === ' ') && !event.repeat) {
      const current = this.getCurrentFocus()
      if (current && current.activate) {
        current.activate()
        return true
      }
      // Nothing focused: let the caller's fallback keys handle it.
      return false
    }
    return false
  }
}

// ---------------------------------------------------------------------------
// SurvivorButton — a plain box with a hard offset shadow. States: default,
// hovered, focused (accent border, the keyboard-focus indicator), pressed
// (shifts down-right, shadow shrinks), disabled.
// ---------------------------------------------------------------------------
class SurvivorButton {
  constructor({ id, label, onClick, disabled = false }) {
    this.id = id
    this.label = label
    this.onClick = onClick
    this.isDisabled = disabled
    this.x = 0
    this.y = 0
    this.width = 0
    this.height = 0
    this.isHovered = false
    this.isPressed = false
    this.isFocused = false
    this.wasDown = false
  }

  setBounds(x, y, width, height) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }

  contains(px, py) {
    return px >= this.x && px <= this.x + this.width
      && py >= this.y && py <= this.y + this.height
  }

  // pointer: { x, y, down } in canvas pixels, or null when no pointer is live.
  update(pointer) {
    if (this.isDisabled || !pointer) {
      this.isHovered = false
      this.isPressed = false
      this.wasDown = pointer ? pointer.down : false
      return
    }
    const inside = this.contains(pointer.x, pointer.y)
    this.isHovered = inside
    if (pointer.down && !this.wasDown && inside) this.isPressed = true
    if (!pointer.down && this.wasDown && this.isPressed && inside) this.activate()
    if (!pointer.down) this.isPressed = false
    this.wasDown = pointer.down
  }

  // Keyboard / gamepad / focus-manager activation.
  activate() {
    if (this.isDisabled) return
    if (this.onClick) this.onClick()
  }

  draw() {
    const t = SurvivorUITheme
    const s = uiPx(SurvivorDimensions.shadow)
    const pressed = this.isPressed
    // Pressed buttons shift down-right and their shadow shrinks: pushed in.
    const ox = pressed ? 2 : 0
    const oy = pressed ? 2 : 0
    const x = this.x + ox
    const y = this.y + oy

    canvasContext.fillStyle = t.shadow
    if (pressed) canvasContext.fillRect(x + 2, y + 2, this.width, this.height)
    else canvasContext.fillRect(x + s, y + s, this.width, this.height)

    canvasContext.fillStyle = this.isDisabled
      ? t.disabledFill
      : pressed ? t.buttonFillPressed
        : this.isHovered ? t.buttonFillHover
          : t.buttonFill
    canvasContext.fillRect(x, y, this.width, this.height)

    canvasContext.lineWidth = t.borderWidth
    canvasContext.strokeStyle = this.isDisabled
      ? t.border
      : this.isFocused ? t.accent
        : this.isHovered ? t.text
          : t.border
    canvasContext.strokeRect(x, y, this.width, this.height)

    canvasContext.font = `${buttonLabelPx(this.height)}px ${t.fontFamily}`
    canvasContext.textAlign = 'center'
    canvasContext.textBaseline = 'middle'
    canvasContext.fillStyle = this.isDisabled ? t.disabledText : t.text
    canvasContext.fillText(this.label, x + this.width / 2, y + this.height / 2 + 1)
  }
}

// ---------------------------------------------------------------------------
// SurvivorContainer — a plain panel with a hard offset shadow and an optional
// title. Content is drawn through a callback, Classic Scoundrel style.
// ---------------------------------------------------------------------------
class SurvivorContainer {
  constructor({ title = '', padding = 24 }) {
    this.title = title
    this.padding = padding
    this.x = 0
    this.y = 0
    this.width = 0
    this.height = 0
  }

  setBounds(x, y, width, height) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }

  titleFontPx() {
    return uiFontBase() * SurvivorDimensions.titleMul
  }

  // Vertical space the title occupies, including its breathing room.
  headerHeight() {
    if (!this.title) return 0
    return Math.round(this.titleFontPx() * 1.5)
  }

  draw(drawContent) {
    const t = SurvivorUITheme
    const s = uiPx(SurvivorDimensions.shadow)

    canvasContext.fillStyle = t.shadow
    canvasContext.fillRect(this.x + s, this.y + s, this.width, this.height)

    canvasContext.fillStyle = t.panelFill
    canvasContext.fillRect(this.x, this.y, this.width, this.height)

    canvasContext.lineWidth = t.borderWidth
    canvasContext.strokeStyle = t.border
    canvasContext.strokeRect(this.x, this.y, this.width, this.height)

    let contentY = this.y + this.padding
    if (this.title) {
      const fontPx = this.titleFontPx()
      canvasContext.font = `${fontPx}px ${t.fontFamily}`
      canvasContext.textAlign = 'center'
      canvasContext.textBaseline = 'middle'
      canvasContext.fillStyle = t.text
      canvasContext.fillText(this.title, this.x + this.width / 2, contentY + fontPx / 2)
      contentY += this.headerHeight()
    }

    if (drawContent) {
      drawContent({
        x: this.x + this.padding,
        y: contentY,
        width: Math.max(0, this.width - this.padding * 2),
        height: Math.max(0, this.y + this.height - this.padding - contentY),
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Shared menu-panel layout: centers a content-fitted container on screen and
// stacks its buttons. Pure math from the current canvas size, re-run every
// frame, so resizes just work. Menus implement fitWidth() (via fitTitledPanel)
// and optionally bodyHeight().
// ---------------------------------------------------------------------------
const layoutMenuPanel = (menu) => {
  const D = SurvivorDimensions
  const fontBase = uiFontBase()
  const width = menu.fitWidth()
  const gap = Math.round(fontBase * D.gapMul)
  const buttonHeight = Math.round(fontBase * D.buttonHMul)
  const pad = Math.round(fontBase * D.padMul)
  const headerH = menu.container.headerHeight()
  const bodyH = menu.bodyHeight ? menu.bodyHeight() : 0
  const buttonsH = menu.buttons.length * buttonHeight
    + Math.max(0, menu.buttons.length - 1) * gap
  const height = pad + headerH + bodyH + buttonsH + pad
  const x = Math.round((canvas.width - width) / 2)
  const y = Math.round((canvas.height - height) / 2)
  menu.container.setBounds(x, y, width, height)
  menu.container.padding = pad
  const buttonWidth = Math.round(width * D.buttonWRatio)
  let buttonY = y + pad + headerH + bodyH
  menu.buttons.forEach((button) => {
    button.setBounds(Math.round(x + (width - buttonWidth) / 2), Math.round(buttonY), buttonWidth, buttonHeight)
    buttonY += buttonHeight + gap
  })
}

const updateMenuPanel = (menu) => {
  layoutMenuPanel(menu)
  const pointer = getPointerPixels()
  menu.buttons.forEach((button) => button.update(pointer))
}

const drawMenuPanel = (menu, drawBody) => {
  layoutMenuPanel(menu)
  menu.container.draw(() => {
    if (drawBody) drawBody()
    menu.buttons.forEach((button) => button.draw())
  })
}

// ---------------------------------------------------------------------------
// SurvivorModal — dim backdrop, centered content-fitted SurvivorContainer,
// body lines, and a button stack. Opens into the owning menu's focus manager
// as a trap; closing restores whatever was focused before.
// ---------------------------------------------------------------------------
class SurvivorModal {
  // bodyLines: array of strings, or { text, dim: true } for secondary lines.
  constructor({ title = '', bodyLines = [], buttons = [] }) {
    this.title = title
    this.bodyLines = bodyLines
    this.buttons = buttons
    this.visible = false
    this.container = new SurvivorContainer({ title })
    this.focusManager = null
  }

  open(focusManager) {
    this.focusManager = focusManager
    focusManager.registerAll(this.buttons)
    focusManager.enterModalMode(this.buttons, 0)
    this.visible = true
  }

  close() {
    if (this.focusManager) {
      this.buttons.forEach((b) => this.focusManager.unregister(b.id))
      if (this.focusManager.isInModalMode()) this.focusManager.exitModalMode()
      this.focusManager = null
    }
    this.visible = false
  }

  fitWidth() {
    const D = SurvivorDimensions
    return fitPanelWidth({
      title: this.title,
      titlePx: uiFontBase() * D.titleMul,
      lines: this.bodyLines.map((line) => (typeof line === 'string' ? line : line.text)),
      linePx: uiFontBase() * D.bodyMul,
      buttonLabels: this.buttons.map((b) => b.label),
      labelPx: buttonLabelPx(uiPx(D.fontBase * D.buttonHMul)),
    })
  }

  layout() {
    const D = SurvivorDimensions
    const fontBase = uiFontBase()
    const width = this.fitWidth()
    const gap = Math.round(fontBase * D.gapMul)
    const buttonHeight = Math.round(fontBase * D.buttonHMul)
    const pad = Math.round(fontBase * D.padMul)
    const lineH = Math.round(fontBase * D.lineHMul)
    const headerH = this.container.headerHeight()
    const bodyH = this.bodyLines.length * lineH + (this.bodyLines.length ? gap : 0)
    const buttonsH = this.buttons.length * buttonHeight
      + Math.max(0, this.buttons.length - 1) * gap
    const height = pad + headerH + bodyH + buttonsH + pad
    const x = Math.round((canvas.width - width) / 2)
    const y = Math.round((canvas.height - height) / 2)
    this.container.setBounds(x, y, width, height)
    this.container.padding = pad
    const buttonWidth = Math.round(width * D.buttonWRatio)
    let buttonY = y + pad + headerH + bodyH
    this.buttons.forEach((button) => {
      button.setBounds(Math.round(x + (width - buttonWidth) / 2), Math.round(buttonY), buttonWidth, buttonHeight)
      buttonY += buttonHeight + gap
    })
    this.bodyLayout = {
      lineH,
      firstLineY: y + pad + headerH + lineH / 2,
      centerX: x + width / 2,
    }
  }

  update(pointer) {
    if (!this.visible) return
    this.layout()
    this.buttons.forEach((button) => button.update(pointer))
  }

  draw() {
    if (!this.visible) return
    const t = SurvivorUITheme
    const D = SurvivorDimensions
    canvasContext.fillStyle = t.backdrop
    canvasContext.fillRect(0, 0, canvas.width, canvas.height)
    this.layout()
    const { lineH, firstLineY, centerX } = this.bodyLayout
    const fontPx = Math.round(uiFontBase() * D.bodyMul)
    this.container.draw(() => {
      canvasContext.font = `${fontPx}px ${t.fontFamily}`
      canvasContext.textAlign = 'center'
      canvasContext.textBaseline = 'middle'
      this.bodyLines.forEach((line, i) => {
        const text = typeof line === 'string' ? line : line.text
        const dim = typeof line === 'object' && line.dim
        canvasContext.fillStyle = dim ? t.textDim : t.text
        canvasContext.fillText(text, centerX, firstLineY + i * lineH)
      })
      this.buttons.forEach((button) => button.draw())
    })
  }

  handleKeyDown(event) {
    if (!this.visible) return false
    if (event.key === 'Escape' && !event.repeat) {
      this.close()
      return true
    }
    return this.focusManager ? this.focusManager.handleKeyDown(event) : false
  }
}
