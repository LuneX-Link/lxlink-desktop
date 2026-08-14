// Pure canvas dot matrix effect (no Three.js)
export class DotMatrix {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private dots: Dot[] = []
  private animFrame = 0
  private running = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext("2d")!
    this.resize()
    this.initDots()
  }

  resize() {
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = window.innerWidth * dpr
    this.canvas.height = window.innerHeight * dpr
    this.canvas.style.width = `${window.innerWidth}px`
    this.canvas.style.height = `${window.innerHeight}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.initDots()
  }

  private initDots() {
    this.dots = []
    const spacing = 18
    const cols = Math.ceil(window.innerWidth / spacing)
    const rows = Math.ceil(window.innerHeight / spacing)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * spacing + spacing / 2
        const y = r * spacing + spacing / 2
        const distFromCenter = Math.sqrt(
          Math.pow(x - window.innerWidth / 2, 2) +
          Math.pow(y - window.innerHeight / 2, 2)
        )
        const maxDist = Math.sqrt(
          Math.pow(window.innerWidth / 2, 2) +
          Math.pow(window.innerHeight / 2, 2)
        )

        this.dots.push({
          x, y,
          baseOpacity: 0,
          opacity: 0,
          targetOpacity: 0,
          delay: (distFromCenter / maxDist) * 1.5,
          size: 1.5 + Math.random() * 1,
          color: Math.random() > 0.85 ? "#dc2626" : "#ffffff",
        })
      }
    }
  }

  start() {
    this.running = true
    this.animate()
  }

  stop() {
    this.running = false
  }

  setProgress(progress: number) {
    const t = progress / 100
    for (const dot of this.dots) {
      const adjustedT = Math.max(0, Math.min(1, (t - dot.delay) / (1 - dot.delay)))
      dot.targetOpacity = adjustedT * (0.15 + Math.random() * 0.25)
    }
  }

  private animate() {
    if (!this.running) return

    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

    for (const dot of this.dots) {
      dot.opacity += (dot.targetOpacity - dot.opacity) * 0.08
      if (dot.opacity < 0.01) continue

      this.ctx.globalAlpha = dot.opacity
      this.ctx.fillStyle = dot.color
      this.ctx.beginPath()
      this.ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2)
      this.ctx.fill()
    }

    this.ctx.globalAlpha = 1
    this.animFrame = requestAnimationFrame(() => this.animate())
  }

  destroy() {
    this.running = false
    cancelAnimationFrame(this.animFrame)
  }
}

interface Dot {
  x: number
  y: number
  baseOpacity: number
  opacity: number
  targetOpacity: number
  delay: number
  size: number
  color: string
}
