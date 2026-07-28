// Register GSAP Plugins
const pluginsToRegister = [];
if (typeof Draggable !== "undefined") pluginsToRegister.push(Draggable);
if (typeof Flip !== "undefined") pluginsToRegister.push(Flip);
if (typeof CustomEase !== "undefined") pluginsToRegister.push(CustomEase);

if (typeof gsap !== "undefined") {
  gsap.registerPlugin(...pluginsToRegister);
}

class PreloaderManager {
  constructor() {
    this.overlay = null;
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.startTime = null;
    this.duration = 2000;
    this.createLoadingScreen();
  }

  createLoadingScreen() {
    this.overlay = document.getElementById("preloader-overlay");
    if (!this.overlay) return;
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 100000;
    `;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 300;
    this.canvas.height = 300;
    this.ctx = this.canvas.getContext("2d");
    this.overlay.appendChild(this.canvas);
    this.startAnimation();
  }

  startAnimation() {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    let time = 0;
    let lastTime = 0;
    const dotRings = [
      { radius: 20, count: 8 },
      { radius: 35, count: 12 },
      { radius: 50, count: 16 },
      { radius: 65, count: 20 },
      { radius: 80, count: 24 }
    ];

    const animate = (timestamp) => {
      if (!this.startTime) this.startTime = timestamp;
      if (!lastTime) lastTime = timestamp;
      const deltaTime = timestamp - lastTime;
      lastTime = timestamp;
      time += deltaTime * 0.001;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
      this.ctx.fillStyle = "rgba(44, 27, 20, 0.9)";
      this.ctx.fill();

      dotRings.forEach((ring, ringIndex) => {
        for (let i = 0; i < ring.count; i++) {
          const angle = (i / ring.count) * Math.PI * 2;
          const radiusPulse = Math.sin(time * 2 - ringIndex * 0.4) * 3;
          const x = centerX + Math.cos(angle) * (ring.radius + radiusPulse);
          const y = centerY + Math.sin(angle) * (ring.radius + radiusPulse);
          const opacityWave = 0.4 + Math.sin(time * 2 - ringIndex * 0.4 + i * 0.2) * 0.6;
          const isActive = Math.sin(time * 2 - ringIndex * 0.4 + i * 0.2) > 0.6;

          this.ctx.beginPath();
          this.ctx.moveTo(centerX, centerY);
          this.ctx.lineTo(x, y);
          this.ctx.lineWidth = 0.8;
          this.ctx.strokeStyle = isActive 
            ? `rgba(166, 75, 35, ${opacityWave * 0.7})` 
            : `rgba(44, 27, 20, ${opacityWave * 0.5})`;
          this.ctx.stroke();

          this.ctx.beginPath();
          this.ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          this.ctx.fillStyle = isActive 
            ? `rgba(166, 75, 35, ${opacityWave})` 
            : `rgba(44, 27, 20, ${opacityWave})`;
          this.ctx.fill();
        }
      });

      if (timestamp - this.startTime >= this.duration) {
        this.complete();
        return;
      }
      this.animationId = requestAnimationFrame(animate);
    };
    this.animationId = requestAnimationFrame(animate);
  }

  complete(onComplete) {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.overlay) {
      this.overlay.style.opacity = "0";
      this.overlay.style.transition = "opacity 0.8s ease";
      setTimeout(() => {
        this.overlay?.remove();
        if (onComplete) onComplete();
      }, 800);
    }
  }
}

class FashionGallery {
  constructor() {
    this.viewport = document.getElementById("viewport");
    this.canvasWrapper = document.getElementById("canvasWrapper");
    this.gridContainer = document.getElementById("gridContainer");
    this.splitScreenContainer = document.getElementById("splitScreenContainer");
    this.imageTitleOverlay = document.getElementById("imageTitleOverlay");
    this.closeButton = document.getElementById("closeButton");
    this.controlsContainer = document.getElementById("controlsContainer");
    this.soundToggle = document.getElementById("soundToggle");

    this.customEase = typeof CustomEase !== "undefined"
      ? CustomEase.create("smooth", ".87,0,.13,1")
      : "power2.inOut";
    this.centerEase = typeof CustomEase !== "undefined"
      ? CustomEase.create("center", ".25,.46,.45,.94")
      : "power2.out";

    this.config = {
      itemSize: 320,
      baseGap: 16,
      rows: 8,
      cols: 12,
      currentZoom: 0.6,
      currentGap: 32
    };

    this.zoomState = {
      isActive: false,
      selectedItem: null,
      flipAnimation: null,
      scalingOverlay: null
    };

    this.gridItems = [];
    this.gridDimensions = {};
    this.lastValidPosition = { x: 0, y: 0 };
    this.draggable = null;
    this.viewportObserver = null;

    this.initSoundSystem();
    this.initImageData();
  }

  initSoundSystem() {
    this.soundSystem = {
      enabled: false,
      sounds: {
        click: new Audio("https://assets.codepen.io/7558/glitch-fx-001.mp3"),
        open: new Audio("https://assets.codepen.io/7558/click-glitch-001.mp3"),
        close: new Audio("https://assets.codepen.io/7558/click-glitch-001.mp3"),
        "zoom-in": new Audio("https://assets.codepen.io/7558/whoosh-fx-001.mp3"),
        "zoom-out": new Audio("https://assets.codepen.io/7558/whoosh-fx-001.mp3"),
        "drag-start": new Audio("https://assets.codepen.io/7558/preloader-2s-001.mp3"),
        "drag-end": new Audio("https://assets.codepen.io/7558/preloader-2s-001.mp3")
      },
      play: (soundName) => {
        if (!this.soundSystem.enabled || !this.soundSystem.sounds[soundName]) return;
        try {
          const audio = this.soundSystem.sounds[soundName];
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } catch (e) {}
      },
      toggle: () => {
        this.soundSystem.enabled = !this.soundSystem.enabled;
        this.soundToggle.classList.toggle("active", this.soundSystem.enabled);
        if (this.zoomState.isActive) return;
        if (this.soundSystem.enabled) {
          setTimeout(() => this.soundSystem.play("click"), 50);
        }
      }
    };

    Object.values(this.soundSystem.sounds).forEach((audio) => {
      audio.preload = "auto";
      audio.volume = 0.3;
    });

    this.initSoundWave();
  }

  initSoundWave() {
    const canvas = document.getElementById("soundWaveCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = 32;
    const height = 16;
    const centerY = Math.floor(height / 2);
    let startTime = Date.now();
    let currentAmplitude = this.soundSystem.enabled ? 1 : 0;

    const animate = () => {
      const targetAmplitude = this.soundSystem.enabled ? 1 : 0;
      currentAmplitude += (targetAmplitude - currentAmplitude) * 0.08;
      ctx.clearRect(0, 0, width, height);

      const time = (Date.now() - startTime) / 1000;
      if (!this.soundSystem.enabled && currentAmplitude < 0.01) {
        ctx.fillStyle = "#D9C4AA";
        ctx.fillRect(0, centerY, width, 2);
      } else {
        ctx.fillStyle = "#2C1B14";
        for (let i = 0; i < width; i++) {
          const x = i - width / 2;
          const e = Math.exp((-x * x) / 50);
          const y = centerY + Math.cos(x * 0.4 - time * 8) * e * height * 0.35 * currentAmplitude;
          ctx.fillRect(i, Math.round(y), 1, 2);
        }
      }
      requestAnimationFrame(animate);
    };
    animate();
  }

  initImageData() {
    this.fashionImages = [];
    for (let i = 1; i <= 14; i++) {
      const paddedNumber = String(i).padStart(2, "0");
      this.fashionImages.push(`https://assets.codepen.io/7558/orange-portrait_${paddedNumber}.jpg`);
    }

    this.imageData = [
      { number: "01", title: "Begin Before You re Ready", description: "The work starts when you notice the quiet pull." },
      { number: "02", title: "Negative Space, Positive Signal", description: "Leave room around the idea." },
      { number: "03", title: "Friction Is a Teacher", description: "When the line resists, listen." }
    ];
  }

  splitTextIntoLines(element, text) {
    element.innerHTML = "";
    const lineSpan = document.createElement("span");
    lineSpan.className = "description-line";
    lineSpan.textContent = text;
    element.appendChild(lineSpan);
    return element.querySelectorAll(".description-line");
  }

  calculateGapForZoom(zoomLevel) {
    if (zoomLevel >= 1.0) return 16;
    else if (zoomLevel >= 0.6) return 32;
    else return 64;
  }

  calculateGridDimensions(gap = this.config.currentGap) {
    const totalWidth = this.config.cols * (this.config.itemSize + gap) - gap;
    const totalHeight = this.config.rows * (this.config.itemSize + gap) - gap;
    this.gridDimensions = {
      width: totalWidth,
      height: totalHeight,
      scaledWidth: totalWidth * this.config.currentZoom,
      scaledHeight: totalHeight * this.config.currentZoom,
      gap: gap
    };
    return this.gridDimensions;
  }

  generateGridItems() {
    this.config.currentGap = this.calculateGapForZoom(this.config.currentZoom);
    this.calculateGridDimensions();
    this.canvasWrapper.style.width = this.gridDimensions.width + "px";
    this.canvasWrapper.style.height = this.gridDimensions.height + "px";
    this.gridContainer.innerHTML = "";
    this.gridItems = [];

    let imageIndex = 0;
    for (let row = 0; row < this.config.rows; row++) {
      for (let col = 0; col < this.config.cols; col++) {
        const item = document.createElement("div");
        item.className = "grid-item";
        const x = col * (this.config.itemSize + this.config.currentGap);
        const y = row * (this.config.itemSize + this.config.currentGap);

        item.style.left = `${x}px`;
        item.style.top = `${y}px`;
        item.style.opacity = "0";

        const imageUrl = this.fashionImages[imageIndex % this.fashionImages.length];
        imageIndex++;

        const img = document.createElement("img");
        img.src = imageUrl;
        img.alt = `Fashion Portrait ${imageIndex}`;
        item.appendChild(img);

        const itemData = {
          element: item,
          img: img,
          row: row,
          col: col,
          baseX: x,
          baseY: y,
          imageUrl: imageUrl,
          index: this.gridItems.length
        };

        item.addEventListener("click", () => {
          if (!this.zoomState.isActive) {
            this.soundSystem.play("click");
            this.enterZoomMode(itemData);
          }
        });

        this.gridContainer.appendChild(item);
        this.gridItems.push(itemData);
      }
    }
  }

  setupViewportObserver() {
    if (this.viewportObserver) this.viewportObserver.disconnect();
    this.viewportObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (this.zoomState.selectedItem && entry.target === this.zoomState.selectedItem.element) return;
        if (entry.isIntersecting) {
          entry.target.classList.remove("out-of-view");
          gsap.to(entry.target, { opacity: 1, duration: 0.6, ease: "power2.out" });
        } else {
          entry.target.classList.add("out-of-view");
          gsap.to(entry.target, { opacity: 0.1, duration: 0.6, ease: "power2.out" });
        }
      });
    }, { threshold: 0.15 });

    this.gridItems.forEach((item) => this.viewportObserver.observe(item.element));
  }

  updateTitleOverlay(imageIndex) {
    const data = this.imageData[imageIndex % this.imageData.length];
    const numberElement = document.querySelector("#imageSlideNumber span");
    const titleElement = document.querySelector("#imageSlideTitle h1");
    const descriptionElement = document.getElementById("imageSlideDescription");

    if (numberElement && titleElement && descriptionElement) {
      numberElement.textContent = data.number;
      titleElement.textContent = data.title;
      this.descriptionLines = this.splitTextIntoLines(descriptionElement, data.description);
    }
  }

  createScalingOverlay(sourceImg) {
    const overlay = document.createElement("div");
    overlay.className = "scaling-image-overlay";
    const img = document.createElement("img");
    img.src = sourceImg.src;
    overlay.appendChild(img);
    document.body.appendChild(overlay);

    const sourceRect = sourceImg.getBoundingClientRect();
    gsap.set(overlay, {
      left: sourceRect.left,
      top: sourceRect.top,
      width: sourceRect.width,
      height: sourceRect.height,
      opacity: 1
    });
    return overlay;
  }

  enterZoomMode(selectedItemData) {
    if (this.zoomState.isActive) return;
    this.zoomState.isActive = true;
    this.zoomState.selectedItem = selectedItemData;
    this.soundSystem.play("open");

    if (this.draggable) this.draggable.disable();
    document.body.classList.add("zoom-mode");

    const splitContainer = this.splitScreenContainer;
    const zoomTarget = document.getElementById("zoomTarget");
    splitContainer.classList.add("active");

    gsap.to(splitContainer, { opacity: 1, duration: 1.2, ease: this.customEase });
    this.zoomState.scalingOverlay = this.createScalingOverlay(selectedItemData.img);
    gsap.set(selectedItemData.img, { opacity: 0 });

    if (typeof Flip !== "undefined") {
      this.zoomState.flipAnimation = Flip.fit(this.zoomState.scalingOverlay, zoomTarget, {
        duration: 1.2,
        ease: this.customEase,
        absolute: true,
        onComplete: () => {
          this.updateTitleOverlay(selectedItemData.index);
          this.imageTitleOverlay.classList.add("active");
          gsap.to(this.imageTitleOverlay, { opacity: 1, duration: 0.3 });
        }
      });
    }

    this.controlsContainer.classList.add("split-mode");
    gsap.fromTo(this.closeButton, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, delay: 0.9 });
    this.closeButton.classList.add("active");
  }

  exitZoomMode() {
    if (!this.zoomState.isActive) return;
    this.soundSystem.play("close");

    gsap.to(this.imageTitleOverlay, { opacity: 0, duration: 0.3 });
    gsap.to(this.closeButton, { duration: 0.3, opacity: 0, x: 40 });
    this.splitScreenContainer.classList.remove("active");
    this.controlsContainer.classList.remove("split-mode");

    if (typeof Flip !== "undefined" && this.zoomState.scalingOverlay) {
      Flip.fit(this.zoomState.scalingOverlay, this.zoomState.selectedItem.element, {
        duration: 1.2,
        ease: this.customEase,
        absolute: true,
        onComplete: () => {
          gsap.set(this.zoomState.selectedItem.img, { opacity: 1 });
          if (this.zoomState.scalingOverlay) {
            document.body.removeChild(this.zoomState.scalingOverlay);
            this.zoomState.scalingOverlay = null;
          }
          document.body.classList.remove("zoom-mode");
          this.closeButton.classList.remove("active");
          if (this.draggable) this.draggable.enable();
          this.zoomState.isActive = false;
          this.zoomState.selectedItem = null;
        }
      });
    } else {
      gsap.set(this.zoomState.selectedItem.img, { opacity: 1 });
      if (this.zoomState.scalingOverlay) {
        document.body.removeChild(this.zoomState.scalingOverlay);
        this.zoomState.scalingOverlay = null;
      }
      document.body.classList.remove("zoom-mode");
      if (this.draggable) this.draggable.enable();
      this.zoomState.isActive = false;
    }
  }

  calculateBounds() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { scaledWidth, scaledHeight } = this.gridDimensions;
    const marginX = this.config.currentGap * this.config.currentZoom;
    const marginY = this.config.currentGap * this.config.currentZoom;

    let minX = scaledWidth <= vw ? (vw - scaledWidth) / 2 : vw - scaledWidth - marginX;
    let maxX = scaledWidth <= vw ? minX : marginX;
    let minY = scaledHeight <= vh ? (vh - scaledHeight) / 2 : vh - scaledHeight - marginY;
    let maxY = scaledHeight <= vh ? minY : marginY;

    return { minX, maxX, minY, maxY };
  }

  initDraggable() {
    if (this.draggable) this.draggable.kill();
    this.calculateGridDimensions(this.config.currentGap);
    const bounds = this.calculateBounds();

    if (typeof Draggable !== "undefined") {
      this.draggable = Draggable.create(this.canvasWrapper, {
        type: "x,y",
        bounds: bounds,
        edgeResistance: 0.8,
        onDragStart: () => {
          document.body.classList.add("dragging");
          this.soundSystem.play("drag-start");
        },
        onDragEnd: () => {
          document.body.classList.remove("dragging");
          this.soundSystem.play("drag-end");
        }
      })[0];
    }
  }

  playIntroAnimation() {
    gsap.to(this.gridItems.map((item) => item.element), {
      duration: 0.2,
      left: (index) => this.gridItems[index].baseX,
      top: (index) => this.gridItems[index].baseY,
      opacity: 1,
      ease: "power2.out",
      stagger: { amount: 1.5, grid: [this.config.rows, this.config.cols] },
      onComplete: () => {
        this.controlsContainer.classList.add("visible");
        gsap.to(this.controlsContainer, { opacity: 1, duration: 0.5 });
      }
    });
  }

  setZoom(zoomLevel, buttonElement = null) {
    if (this.zoomState.isActive) {
      this.exitZoomMode();
      return;
    }
    this.config.currentZoom = zoomLevel;
    const newGap = this.calculateGapForZoom(zoomLevel);
    this.calculateGridDimensions(newGap);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const finalCenterX = (vw - this.gridDimensions.width * zoomLevel) / 2;
    const finalCenterY = (vh - this.gridDimensions.height * zoomLevel) / 2;

    gsap.to(this.canvasWrapper, {
      duration: 1.2,
      scale: zoomLevel,
      x: finalCenterX,
      y: finalCenterY,
      ease: this.customEase,
      onComplete: () => this.initDraggable()
    });

    document.getElementById("percentageIndicator").textContent = `${Math.round(zoomLevel * 100)}%`;
    document.querySelectorAll(".switch-button").forEach((btn) => btn.classList.remove("switch-button-current"));
    if (buttonElement) buttonElement.classList.add("switch-button-current");
  }

  autoFitZoom(buttonElement = null) {
    const fitZoom = 0.4;
    this.setZoom(fitZoom, buttonElement);
  }

  init() {
    this.config.currentGap = this.calculateGapForZoom(this.config.currentZoom);
    this.generateGridItems();
    gsap.set(this.viewport, { opacity: 1 });
    gsap.set(this.canvasWrapper, { scale: this.config.currentZoom });

    this.setupEventListeners();
    this.playIntroAnimation();
    gsap.to(".header, .footer", { duration: 1.2, opacity: 1, delay: 0.8 });

    setTimeout(() => {
      this.initDraggable();
      this.setupViewportObserver();
    }, 1500);
  }

  setupEventListeners() {
    this.closeButton.addEventListener("click", () => this.exitZoomMode());
    this.soundToggle.addEventListener("click", () => this.soundSystem.toggle());
  }
}

let gallery;
document.addEventListener("DOMContentLoaded", () => {
  const preloader = new PreloaderManager();
  setTimeout(() => {
    preloader.complete(() => {
      gallery = new FashionGallery();
      gallery.init();
    });
  }, 2000);
});