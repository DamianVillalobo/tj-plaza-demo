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
