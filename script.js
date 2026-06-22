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
  const card = document.getElementById('heroScrollCard'); // puede no existir si se quitó la tarjeta de video
  if (!container || !header) return;

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
    if (card) {
      card.style.transform = `translateY(${translate}px) rotateX(${rotate}deg) scale(${scale})`;
    }

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

// Hero: fondo animado con shader WebGL ("nubes" generativas), recreado en vanilla
// JS/WebGL2 a partir de un componente de referencia React, retinteado en tonos
// noche (negros/grises/blanco, sin tinte dorado) y sin frameworks.
(function () {
  const canvas = document.getElementById('heroShaderCanvas');
  const stage = document.getElementById('heroScroll');
  if (!canvas || !stage) return;

  const gl = canvas.getContext('webgl2');
  if (!gl) { canvas.remove(); return; } // sin soporte: queda el fondo plano de siempre

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const vertexSrc = `#version 300 es
precision highp float;
in vec4 position;
void main(){gl_Position=position;}`;

  // Mismo algoritmo de "nubes" fractales del componente original; sólo se retinta
  // el color final (antes naranja/amarillo) a los tonos dorado/carbón del sitio
  // y se reduce la velocidad para que funcione bien como fondo decorativo.
  const fragmentSrc = `#version 300 es
precision highp float;
out vec4 O;
uniform vec2 resolution;
uniform float time;
#define FC gl_FragCoord.xy
#define T time
#define R resolution
#define MN min(R.x,R.y)
float rnd(vec2 p){p=fract(p*vec2(12.9898,78.233));p+=dot(p,p+34.56);return fract(p.x*p.y);}
float noise(in vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);float a=rnd(i),b=rnd(i+vec2(1,0)),c=rnd(i+vec2(0,1)),d=rnd(i+1.);return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
float fbm(vec2 p){float t=.0,a=1.;mat2 m=mat2(1.,-.5,.2,1.2);for(int i=0;i<5;i++){t+=a*noise(p);p*=2.*m;a*=.5;}return t;}
float clouds(vec2 p){float d=1.,t=.0;for(float i=.0;i<3.;i++){float a=d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);t=mix(t,d,a);d=a;p*=2./(i+1.);}return t;}
void main(void){
  vec2 uv=(FC-.5*R)/MN, st=uv*vec2(2,1);
  vec3 col=vec3(0);
  float bg=clouds(vec2(st.x+T*.06,-st.y));
  uv*=1.-.3*(sin(T*.08)*.5+.5);
  for(float i=1.;i<12.;i++){
    uv+=.1*cos(i*vec2(.1+.01*i,.8)+i*i+T*.08+.1*uv.x);
    vec2 p=uv;
    float d=length(p);
    col+=.0009/d*vec3(0.72,0.72,0.72);
    float b=noise(i+p+bg*1.731);
    col+=.0014*b/length(max(p,vec2(b*p.x*.02,p.y)));
    col=mix(col,vec3(bg*.13),d);
  }
  O=vec4(col,1);
}`;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Hero shader error:', gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSrc));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSrc));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Hero shader link error:', gl.getProgramInfoLog(program));
    canvas.remove();
    return;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  const positionLoc = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

  const resolutionLoc = gl.getUniformLocation(program, 'resolution');
  const timeLoc = gl.getUniformLocation(program, 'time');
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);

  function resize() {
    const rect = stage.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  function render(now) {
    gl.clearColor(0.082, 0.090, 0.106, 1); // ~ var(--bg) #15171b
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
    gl.uniform1f(timeLoc, now * 1e-3);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  if (reduceMotion) {
    render(0);
  } else {
    let raf = requestAnimationFrame(loop);
    function loop(now) {
      render(now);
      raf = requestAnimationFrame(loop);
    }
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    });
  }
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

// Reproductor de video custom (sección Proyecto): play/pausa, progreso,
// volumen, velocidad y pantalla completa, todo en vanilla JS.
(function () {
  const player = document.getElementById('proyectoVideoPlayer');
  const video = document.getElementById('proyectoVideo');
  if (!player || !video) return;

  const bigPlay = player.querySelector('.video-bigplay');
  const playBtn = document.getElementById('videoPlayBtn');
  const iconPlay = playBtn.querySelector('.icon-play');
  const iconPause = playBtn.querySelector('.icon-pause');
  const iconReplay = playBtn.querySelector('.icon-replay');

  const muteBtn = document.getElementById('videoMuteBtn');
  const iconVolOn = muteBtn.querySelector('.icon-vol-on');
  const iconVolOff = muteBtn.querySelector('.icon-vol-off');
  const volumeSlider = document.getElementById('videoVolumeSlider');

  const timeLabel = document.getElementById('videoTime');
  const progress = document.getElementById('videoProgress');
  const progressFill = document.getElementById('videoProgressFill');
  const progressHandle = document.getElementById('videoProgressHandle');

  const speedWrap = document.getElementById('videoSpeed');
  const speedBtn = document.getElementById('videoSpeedBtn');
  const speedMenu = document.getElementById('videoSpeedMenu');

  const fsBtn = document.getElementById('videoFullscreenBtn');
  const iconFsOpen = fsBtn.querySelector('.icon-fs-open');
  const iconFsClose = fsBtn.querySelector('.icon-fs-close');

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function setPlayIcon(state) {
    // state: 'play' | 'pause' | 'replay'
    iconPlay.hidden = state !== 'play';
    iconPause.hidden = state !== 'pause';
    iconReplay.hidden = state !== 'replay';
  }

  function play() {
    const p = video.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  function togglePlay() {
    if (video.ended) {
      video.currentTime = 0;
      play();
    } else if (video.paused) {
      play();
    } else {
      video.pause();
    }
  }

  bigPlay.addEventListener('click', togglePlay);
  video.addEventListener('click', togglePlay);
  playBtn.addEventListener('click', togglePlay);

  video.addEventListener('play', () => {
    player.classList.add('is-playing');
    setPlayIcon('pause');
    playBtn.setAttribute('aria-label', 'Pausar');
    showControls();
    scheduleHide();
  });
  video.addEventListener('pause', () => {
    player.classList.remove('is-playing');
    setPlayIcon(video.ended ? 'replay' : 'play');
    playBtn.setAttribute('aria-label', 'Reproducir');
    showControls();
    clearHideTimer();
  });
  video.addEventListener('ended', () => {
    setPlayIcon('replay');
    showControls();
    clearHideTimer();
  });

  // Progreso y tiempo
  video.addEventListener('timeupdate', () => {
    const duration = video.duration || 0;
    const pct = duration ? (video.currentTime / duration) * 100 : 0;
    progressFill.style.width = pct + '%';
    progressHandle.style.left = pct + '%';
    progress.setAttribute('aria-valuenow', Math.round(pct));
    timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(duration)}`;
  });
  video.addEventListener('loadedmetadata', () => {
    timeLabel.textContent = `${formatTime(0)} / ${formatTime(video.duration)}`;
  });

  function seekFromEvent(clientX) {
    const rect = progress.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const duration = video.duration || 0;
    video.currentTime = ratio * duration;
  }
  let seeking = false;
  progress.addEventListener('pointerdown', (e) => {
    seeking = true;
    seekFromEvent(e.clientX);
  });
  window.addEventListener('pointermove', (e) => {
    if (seeking) seekFromEvent(e.clientX);
  });
  window.addEventListener('pointerup', () => { seeking = false; });
  progress.addEventListener('keydown', (e) => {
    const duration = video.duration || 0;
    if (e.key === 'ArrowRight') video.currentTime = Math.min(duration, video.currentTime + 5);
    if (e.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 5);
  });

  // Volumen
  function updateVolumeIcon() {
    const muted = video.muted || video.volume === 0;
    iconVolOn.hidden = muted;
    iconVolOff.hidden = !muted;
    muteBtn.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar');
  }
  muteBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) {
      video.volume = 1;
      volumeSlider.value = '1';
    }
    updateVolumeIcon();
  });
  volumeSlider.addEventListener('input', () => {
    const v = parseFloat(volumeSlider.value);
    video.volume = v;
    video.muted = v === 0;
    updateVolumeIcon();
  });
  updateVolumeIcon();

  // Velocidad
  function closeSpeedMenu() {
    speedWrap.classList.remove('is-open');
    speedBtn.setAttribute('aria-expanded', 'false');
  }
  speedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = !speedWrap.classList.contains('is-open');
    speedWrap.classList.toggle('is-open', willOpen);
    speedBtn.setAttribute('aria-expanded', String(willOpen));
  });
  speedMenu.querySelectorAll('button[data-speed]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rate = parseFloat(btn.getAttribute('data-speed'));
      video.playbackRate = rate;
      speedMenu.querySelectorAll('button[data-speed]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      speedBtn.textContent = (rate === 1 ? '1' : rate) + 'x';
      closeSpeedMenu();
    });
  });
  document.addEventListener('click', closeSpeedMenu);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSpeedMenu();
  });

  // Pantalla completa
  fsBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      (player.requestFullscreen || player.webkitRequestFullscreen || function () {}).call(player);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const isFs = document.fullscreenElement === player;
    iconFsOpen.hidden = isFs;
    iconFsClose.hidden = !isFs;
  });

  // Auto-ocultar controles durante la reproducción
  let hideTimer = null;
  let pointerOverControls = false;
  function showControls() { player.classList.remove('controls-hidden'); }
  function clearHideTimer() { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } }
  function scheduleHide() {
    clearHideTimer();
    hideTimer = setTimeout(() => {
      if (!video.paused && !pointerOverControls) player.classList.add('controls-hidden');
    }, 2800);
  }
  player.addEventListener('mousemove', () => {
    showControls();
    if (!video.paused) scheduleHide();
  });
  player.querySelector('.video-controls').addEventListener('mouseenter', () => { pointerOverControls = true; });
  player.querySelector('.video-controls').addEventListener('mouseleave', () => { pointerOverControls = false; });
  player.addEventListener('mouseleave', () => {
    if (!video.paused) player.classList.add('controls-hidden');
  });
})();
