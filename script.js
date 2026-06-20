// Año en footer
document.getElementById('year').textContent = new Date().getFullYear();

// Header: transparente sobre el hero, sólido al hacer scroll
(function () {
  const header = document.getElementById('siteHeader') || document.querySelector('.site-header');
  if (!header) return;
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// Hero: efecto 3D al hacer scroll (estilo "ContainerScroll") + video "scrubbed" con el scroll
(function () {
  const container = document.getElementById('heroScroll');
  const header = document.getElementById('heroScrollHeader');
  const card = document.getElementById('heroScrollCard');
  if (!container || !header || !card) return;

  const video = document.getElementById('heroScrubVideo');
  let videoDuration = 0;
  let videoReady = false;

  if (video) {
    const markReady = () => {
      if (video.duration && isFinite(video.duration)) {
        videoDuration = video.duration;
        videoReady = true;
      }
    };
    video.addEventListener('loadedmetadata', markReady);
    if (video.readyState >= 1) markReady();

    // En iOS/Safari el video no muestra frames via currentTime hasta que
    // se "desbloquea" con un play/pause inicial (no requiere gesto del usuario
    // porque está muted, pero sin esto algunos navegadores no pintan el canvas).
    const unlock = () => {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => video.pause()).catch(() => {});
      } else {
        video.pause();
      }
    };
    if (video.readyState >= 1) unlock();
    else video.addEventListener('loadedmetadata', unlock, { once: true });
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // CSS ya deja header y tarjeta sin transformar; video queda en su poster

  const isMobile = () => window.innerWidth <= 700;

  let ticking = false;

  function update() {
    ticking = false;
    const rect = container.getBoundingClientRect();
    const vh = window.innerHeight;
    const total = rect.height + vh;
    let progress = total > 0 ? (vh - rect.top) / total : 0;
    progress = Math.min(1, Math.max(0, progress));

    const rotate = 20 - 20 * progress; // 20deg -> 0deg
    const scale = isMobile() ? 0.7 + 0.2 * progress : 1.05 - 0.05 * progress;
    const translate = -100 * progress; // 0 -> -100px

    header.style.transform = `translateY(${translate}px)`;
    card.style.transform = `translateY(${translate}px) rotateX(${rotate}deg) scale(${scale})`;

    if (videoReady) {
      video.currentTime = progress * videoDuration;
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();

// Avance de obra (círculos de progreso, datos en avance-obra.js)
if (typeof avanceObra !== 'undefined') {
  const RADIUS = 60;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const DURATION = 1800; // ms

  const items = Array.from(document.querySelectorAll('.avance-item')).map(item => {
    const key = item.getAttribute('data-key');
    const percent = Math.max(0, Math.min(100, Number(avanceObra[key]) || 0));
    const progressCircle = item.querySelector('.avance-progress');
    const percentLabel = item.querySelector('.avance-percent');

    progressCircle.style.strokeDasharray = `${CIRCUMFERENCE}`;
    progressCircle.style.strokeDashoffset = `${CIRCUMFERENCE}`;
    percentLabel.textContent = '0%';

    return { percent, progressCircle, percentLabel, animated: false };
  });

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function animateItem(it) {
    if (it.animated) return;
    it.animated = true;
    const start = performance.now();

    function tick(now) {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = easeOutCubic(t);
      const current = Math.round(it.percent * eased);
      const offset = CIRCUMFERENCE * (1 - (it.percent * eased) / 100);
      it.progressCircle.style.strokeDashoffset = `${offset}`;
      it.percentLabel.textContent = `${current}%`;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const avanceSection = document.getElementById('avance');
  if ('IntersectionObserver' in window && avanceSection) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          items.forEach(animateItem);
          observer.disconnect();
        }
      });
    }, { threshold: 0.35 });
    observer.observe(avanceSection);
  } else {
    items.forEach(animateItem);
  }
}

// Efecto "typewriter" en los títulos de cada sección
(function () {
  const headings = Array.from(document.querySelectorAll('.section h2'));
  if (!headings.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // se muestran completos, sin animar

  const SPEED = 38; // ms por carácter

  function typeHeading(el) {
    if (el.dataset.twDone) return;
    el.dataset.twDone = 'true';
    const fullText = el.textContent;
    el.textContent = '';
    el.classList.add('tw-typing');
    let i = 0;
    function step() {
      if (i <= fullText.length) {
        el.textContent = fullText.slice(0, i);
        i++;
        setTimeout(step, SPEED);
      } else {
        el.classList.remove('tw-typing');
      }
    }
    step();
  }

  if ('IntersectionObserver' in window) {
    const headingObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          typeHeading(entry.target);
          headingObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    headings.forEach(h => headingObserver.observe(h));
  } else {
    headings.forEach(typeHeading);
  }
})();

// Acordeón de características (generales / construcción): ocultas por defecto
(function () {
  const items = Array.from(document.querySelectorAll('.accordion-item'));
  if (!items.length) return;

  items.forEach(item => {
    const trigger = item.querySelector('.accordion-trigger');
    const panel = item.querySelector('.accordion-panel');
    if (!trigger || !panel) return;

    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      if (isOpen) {
        panel.style.maxHeight = '0px';
        item.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      } else {
        panel.style.maxHeight = panel.scrollHeight + 'px';
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });

    // Si la ventana cambia de tamaño mientras está abierto, recalcular alto
    window.addEventListener('resize', () => {
      if (item.classList.contains('is-open')) {
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    }, { passive: true });
  });
})();

// Renders: carrusel en abanico (fan carousel) vanilla, inspirado en un componente
// de referencia React/GSAP que el cliente pidió "probar" en esta sección — recreado
// sin frameworks para que funcione igual que el resto del sitio (HTML/CSS/JS plano).
(function () {
  const stage = document.getElementById('rendersGallery');
  if (!stage) return;
  const cards = Array.from(stage.querySelectorAll('.fan-card'));
  const total = cards.length;
  if (!total) return;

  const MAX_VISIBLE = 7;
  const FAN_POSITIONS = [
    { rot: -21, scale: 0.7756, x: -30, y: 7.3, z: 1 },
    { rot: -14, scale: 0.8498, x: -22, y: 4.0, z: 2 },
    { rot: -7,  scale: 0.9346, x: -11, y: 1.3, z: 3 },
    { rot: 0,   scale: 1.0,    x: 0,   y: 0.0, z: 10 },
    { rot: 7,   scale: 0.9346, x: 11,  y: 1.3, z: 3 },
    { rot: 14,  scale: 0.8498, x: 22,  y: 4.0, z: 2 },
    { rot: 21,  scale: 0.7756, x: 30,  y: 7.3, z: 1 },
  ];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function respMultiplier(w) {
    if (w < 480) return 0.4;
    if (w < 640) return 0.52;
    if (w < 768) return 0.66;
    if (w < 1024) return 0.82;
    return 1;
  }

  function slotConfig(count, slot) {
    if (count >= MAX_VISIBLE) return FAN_POSITIONS[slot];
    const center = (count - 1) / 2;
    const dist = count > 1 ? (slot - center) / center : 0;
    const abs = Math.abs(dist);
    return {
      rot: dist * 21,
      scale: 1 - 0.2244 * abs * abs,
      x: dist * 30,
      y: abs * abs * 7.3,
      z: 10 - Math.round(Math.abs(slot - center)),
    };
  }

  function applyTransform(card, cfg, mult) {
    card.style.transform =
      `translateX(${cfg.x * mult}rem) translateY(${cfg.y * mult}rem) rotate(${cfg.rot}deg) scale(${cfg.scale})`;
    card.style.zIndex = cfg.z;
  }

  function layout(hoverIndex) {
    const mult = respMultiplier(window.innerWidth);
    cards.forEach((card, i) => {
      const base = slotConfig(total, i);
      let { x, y, rot, scale, z } = base;
      if (hoverIndex !== null) {
        if (i === hoverIndex) {
          y -= 2.4;
          scale *= 1.1;
          z = 20;
        } else {
          const dist = Math.abs(i - hoverIndex);
          const push = 7 * (1 + 0.25 * Math.max(0, 3 - dist));
          if (i < hoverIndex) { x -= push; rot -= 3 / (dist + 1); }
          else { x += push; rot += 3 / (dist + 1); }
        }
      }
      applyTransform(card, { x, y, rot, scale, z }, mult);
    });
  }

  cards.forEach((card, i) => {
    card.style.transition = reduceMotion
      ? 'none'
      : 'transform .55s cubic-bezier(.22,1.12,.36,1), box-shadow .3s ease';
    card.addEventListener('mouseenter', () => layout(i));
  });
  stage.addEventListener('mouseleave', () => layout(null));
  window.addEventListener('resize', () => layout(null));

  function reveal() {
    layout(null);
    cards.forEach((card, i) => {
      card.style.transitionDelay = reduceMotion ? '0s' : `${i * 0.07}s`;
      card.style.opacity = '1';
    });
  }

  if (reduceMotion) {
    reveal();
  } else if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          reveal();
          obs.disconnect();
        }
      });
    }, { threshold: 0.3 });
    obs.observe(stage);
  } else {
    reveal();
  }
})();

// Menú mobile
const navToggle = document.getElementById('navToggle');
const nav = document.getElementById('nav');
navToggle.addEventListener('click', () => nav.classList.toggle('open'));
nav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => nav.classList.remove('open'));
});

// Lightbox para renders y plano
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxClose = document.getElementById('lightboxClose');

document.querySelectorAll('[data-full]').forEach(el => {
  el.addEventListener('click', () => {
    lightboxImg.src = el.getAttribute('data-full');
    lightboxImg.alt = el.querySelector('img') ? el.querySelector('img').alt : '';
    lightbox.classList.add('open');
  });
});

function closeLightbox() {
  lightbox.classList.remove('open');
  lightboxImg.src = '';
}
lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});
