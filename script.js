// Register GSAP Plugins
const pluginsToRegister = [];
if (typeof Draggable !== "undefined") pluginsToRegister.push(Draggable);
if (typeof Flip !== "undefined") pluginsToRegister.push(Flip);
if (typeof CustomEase !== "undefined") pluginsToRegister.push(CustomEase);

if (typeof gsap !== "undefined") {
  gsap.registerPlugin(...pluginsToRegister);
}

refreshItemsVisibility() {
  this.gridItems.forEach((item) => {
    const rect = item.element.getBoundingClientRect();
    const inView = (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );

    if (inView) {
      item.element.classList.remove("out-of-view");
      gsap.to(item.element, { opacity: 1, duration: 0.3, overwrite: "auto" });
    } else {
      item.element.classList.add("out-of-view");
      gsap.to(item.element, { opacity: 0.2, duration: 0.3, overwrite: "auto" });
    }
  });
}

class PreloaderManager {
  constructor() {
    this.overlay = null;
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.startTime = null;
    this.duration = 1500;
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
      this.ctx.fillStyle = "rgba(217, 72, 97, 0.9)";
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
            ? `rgba(217, 72, 97, ${opacityWave * 0.7})` 
            : `rgba(60, 60, 60, ${opacityWave * 0.5})`;
          this.ctx.stroke();

          this.ctx.beginPath();
          this.ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          this.ctx.fillStyle = isActive 
            ? `rgba(217, 72, 97, ${opacityWave})` 
            : `rgba(60, 60, 60, ${opacityWave})`;
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

    this.config = {
      itemSize: 300,
      baseGap: 20,
      rows: 3,
      cols: 6,
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
        close: new Audio("https://assets.codepen.io/7558/click-glitch-001.mp3")
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
        if (this.soundToggle) this.soundToggle.classList.toggle("active", this.soundSystem.enabled);
        if (this.soundSystem.enabled) {
          setTimeout(() => this.soundSystem.play("click"), 50);
        }
      }
    };
  }

  initImageData() {
    this.fashionImages = [];
    for (let i = 1; i <= 18; i++) {
      const paddedNumber = String(i).padStart(2, "0");
      this.fashionImages.push(`./${paddedNumber}.jpg`);
    }

    this.imageData = Array.from({ length: 18 }, (_, i) => ({
      number: String(i + 1).padStart(2, "0"),
      title: `Camellia Reference ${i + 1}`,
      description: `Концептуальний референс та елемент моделі №${i + 1}.`
    }));
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
        if (imageIndex >= this.fashionImages.length) break;

        const item = document.createElement("div");
        item.className = "grid-item";
        const x = col * (this.config.itemSize + this.config.currentGap);
        const y = row * (this.config.itemSize + this.config.currentGap);

        item.style.left = `${x}px`;
        item.style.top = `${y}px`;
        item.style.opacity = "0";

        const imageUrl = this.fashionImages[imageIndex];

        const img = document.createElement("img");
        img.src = imageUrl;
        img.alt = `Camellia Photo ${imageIndex + 1}`;
        img.onerror = () => { img.src = `https://via.placeholder.com/300?text=Image+${imageIndex + 1}`; };
        item.appendChild(img);

        const itemData = {
          element: item,
          img: img,
          row: row,
          col: col,
          baseX: x,
          baseY: y,
          imageUrl: imageUrl,
          index: imageIndex
        };

        item.addEventListener("click", () => {
          if (!this.zoomState.isActive) {
            this.soundSystem.play("click");
            this.enterZoomMode(itemData);
          }
        });

        this.gridContainer.appendChild(item);
        this.gridItems.push(itemData);
        imageIndex++;
      }
    }
  }

  setupViewportObserver() {
    if (this.viewportObserver) this.viewportObserver.disconnect();
    this.viewportObserver = new IntersectionObserver((entries) => {
      // Ігноруємо обсервер під час відкриття картки
      if (this.zoomState.isActive) return;

      entries.forEach((entry) => {
        if (this.zoomState.selectedItem && entry.target === this.zoomState.selectedItem.element) return;
        if (entry.isIntersecting) {
          entry.target.classList.remove("out-of-view");
          gsap.to(entry.target, { opacity: 1, duration: 0.6, ease: "power2.out" });
        } else {
          entry.target.classList.add("out-of-view");
          gsap.to(entry.target, { opacity: 0.2, duration: 0.6, ease: "power2.out" });
        }
      });
    }, { threshold: 0.1 });

    this.gridItems.forEach((item) => this.viewportObserver.observe(item.element));
  }

  updateTitleOverlay(imageIndex) {
    const data = this.imageData[imageIndex];
    const numberElement = document.querySelector("#imageSlideNumber span");
    const titleElement = document.querySelector("#imageSlideTitle h1");
    const descriptionElement = document.getElementById("imageSlideDescription");

    if (numberElement) numberElement.textContent = data.number;
    if (titleElement) titleElement.textContent = data.title;
    if (descriptionElement) descriptionElement.textContent = data.description;
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
          if (this.imageTitleOverlay) {
            this.imageTitleOverlay.classList.add("active");
            gsap.to(this.imageTitleOverlay, { opacity: 1, duration: 0.3 });
          }
        }
      });
    }

    if (this.controlsContainer) this.controlsContainer.classList.add("split-mode");
    if (this.closeButton) {
      gsap.fromTo(this.closeButton, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, delay: 0.9 });
      this.closeButton.classList.add("active");
    }
  }

  exitZoomMode() {
    if (!this.zoomState.isActive) return;
    this.soundSystem.play("close");

    if (this.imageTitleOverlay) gsap.to(this.imageTitleOverlay, { opacity: 0, duration: 0.3 });
    if (this.closeButton) gsap.to(this.closeButton, { duration: 0.3, opacity: 0, x: 40 });
    this.splitScreenContainer.classList.remove("active");
    if (this.controlsContainer) this.controlsContainer.classList.remove("split-mode");

    const restoreAllGridItems = () => {
      // Примусово повертаємо чіткість і видимість всім карткам (фікс туману)
      this.gridItems.forEach((item) => {
        gsap.to(item.element, { opacity: 1, duration: 0.4, ease: "power2.out" });
        gsap.to(item.img, { opacity: 1, duration: 0.2 });
      });

      if (this.zoomState.scalingOverlay && this.zoomState.scalingOverlay.parentNode) {
        this.zoomState.scalingOverlay.parentNode.removeChild(this.zoomState.scalingOverlay);
      }
      this.zoomState.scalingOverlay = null;

      document.body.classList.remove("zoom-mode");
      if (this.closeButton) this.closeButton.classList.remove("active");
      if (this.draggable) this.draggable.enable();

      this.zoomState.isActive = false;
      this.zoomState.selectedItem = null;
    };

    if (typeof Flip !== "undefined" && this.zoomState.scalingOverlay && this.zoomState.selectedItem) {
      Flip.fit(this.zoomState.scalingOverlay, this.zoomState.selectedItem.element, {
        duration: 1.2,
        ease: this.customEase,
        absolute: true,
        onComplete: restoreAllGridItems
      });
    } else {
      restoreAllGridItems();
    }
  }

  calculateBounds() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { scaledWidth, scaledHeight } = this.gridDimensions;
    const marginX = 100;
    const marginY = 100;

    let minX = vw - scaledWidth - marginX;
    let maxX = marginX;
    let minY = vh - scaledHeight - marginY;
    let maxY = marginY;

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
        edgeResistance: 0.3, // Полегшене перетягування
        dragClickables: false,
        onDragStart: () => document.body.classList.add("dragging"),
        onDragEnd: () => document.body.classList.remove("dragging")
      })[0];
    }
  }

  setupWheelScroll() {
  const scrollSpeed = 1.5;

  window.addEventListener("wheel", (e) => {
    // Якщо відкрита картка або ми проскролили сторінку вниз к тексту — не рухаємо полотно
    if (this.zoomState.isActive || !this.canvasWrapper) return;

    // Скролимо галерею тільки коли знаходимося в самому верху сторінки
    if (window.scrollY === 0 && e.deltaY < 0 && gsap.getProperty(this.canvasWrapper, "y") >= this.calculateBounds().maxY) {
      // Дозволяємо стандартний скрол сторінки вниз, якщо досягли верхньої межі
      return;
    }

    // Якщо це горизонтальний скрол або скрол всередині меж галереї:
    if (window.scrollY === 0) {
      const currentX = gsap.getProperty(this.canvasWrapper, "x");
      const currentY = gsap.getProperty(this.canvasWrapper, "y");

      const bounds = this.calculateBounds();
      
      let targetX = currentX - (e.shiftKey ? e.deltaY : e.deltaX) * scrollSpeed;
      let targetY = currentY - (e.shiftKey ? 0 : e.deltaY) * scrollSpeed;

      // Перевіряємо, чи ми не виходимо за межі галереї
      const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, targetX));
      const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, targetY));

      // Якщо досягли крайньої нижньої межі галереї і крутимо далі вниз — даємо сторінці скролитись до тексту
      if (targetY < bounds.minY && e.deltaY > 0) {
        return; 
      }

      gsap.to(this.canvasWrapper, {
        x: clampedX,
        y: clampedY,
        duration: 0.25,
        ease: "power1.out",
        overwrite: "auto",
        onUpdate: () => {
          // Ручне оновлення видимості під час скролу, щоб зняти баг туману
          this.refreshItemsVisibility();
        }
      });
    }
  }, { passive: true });
}

  playIntroAnimation() {
    gsap.to(this.gridItems.map((item) => item.element), {
      duration: 0.4,
      opacity: 1,
      ease: "power2.out",
      stagger: { amount: 1.0, grid: [this.config.rows, this.config.cols] },
      onComplete: () => {
        if (this.controlsContainer) {
          this.controlsContainer.classList.add("visible");
          gsap.to(this.controlsContainer, { opacity: 1, duration: 0.5 });
        }
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

    const indicator = document.getElementById("percentageIndicator");
    if (indicator) indicator.textContent = `${Math.round(zoomLevel * 100)}%`;
    document.querySelectorAll(".switch-button").forEach((btn) => btn.classList.remove("switch-button-current"));
    if (buttonElement) buttonElement.classList.add("switch-button-current");
  }

  init() {
    this.config.currentGap = this.calculateGapForZoom(this.config.currentZoom);
    this.generateGridItems();
    gsap.set(this.viewport, { opacity: 1 });
    gsap.set(this.canvasWrapper, { scale: this.config.currentZoom });

    // Центрування сітки
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const initialX = (vw - this.gridDimensions.width * this.config.currentZoom) / 2;
    const initialY = (vh - this.gridDimensions.height * this.config.currentZoom) / 2;
    gsap.set(this.canvasWrapper, { x: initialX, y: initialY });

    this.setupEventListeners();
    this.playIntroAnimation();

    setTimeout(() => {
      this.initDraggable();
      this.setupViewportObserver();
    }, 1000);
  }

  setupEventListeners() {
    if (this.closeButton) this.closeButton.addEventListener("click", () => this.exitZoomMode());
    if (this.soundToggle) this.soundToggle.addEventListener("click", () => this.soundSystem.toggle());

    this.setupWheelScroll();

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.zoomState.isActive) {
        this.exitZoomMode();
      }
    });
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
  }, 1500);
});
