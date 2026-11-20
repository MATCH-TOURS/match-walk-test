/* Ядро прототипа: размеры телефона, нажатия и перетаскивания, «вибрация», звук рассказа, фон. */
(() => {
  // ?fast — только для проверки: в скрытой вкладке браузер не даёт кадров, поэтому анимации идут по таймеру
  // ?timer — то же, но в настоящем темпе: все анимации и переходы идут как на показе
  if (/[?&](fast|timer)\b/.test(location.search)) window.requestAnimationFrame = f => setTimeout(() => f(performance.now()), 16);
  if (/[?&]fast\b/.test(location.search)) document.documentElement.classList.add('fast');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const fmt = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const App = window.App = { $, $$, el, clamp, lerp, ease, fmt, wait, scale: 1, phone: { x: 0, y: 0, s: 1 } };
  const phonePos = $('#phone-pos'), phone = $('#phone');

  // ---- телефон почти на всю высоту окна
  App.fitScale = () => window.MOBILE ? Math.min(innerWidth / 390, innerHeight / 790) : Math.min(innerHeight * 0.94 / 870, innerWidth * 0.9 / 416);
  App.placePhone = (x, y, s) => {
    App.phone = { x, y, s }; App.scale = s;
    phonePos.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
    document.documentElement.style.setProperty('--phone-r', (x + 390 * s).toFixed(1) + 'px');   // правый край телефона — для кружков стилей
  };
  App.centerPhone = () => { const s = App.fitScale(); if (window.MOBILE) {
    // в браузере на компьютере (?m) — экран телефона по центру на тёмном фоне, чтобы были видны его края
    const wide = innerWidth > 600, R = document.documentElement;
    R.classList.toggle('wide', wide);
    if (!wide) return App.placePhone((innerWidth - 390 * s) / 2, innerHeight - 844 * s, s);
    const k = innerHeight * 0.94 / 844, x = (innerWidth - 390 * k) / 2, y = (innerHeight - 844 * k) / 2;
    [['x', x], ['y', y], ['w', 390 * k], ['h', 844 * k]].forEach(([n, v]) => R.style.setProperty('--app-' + n, v + 'px'));
    return App.placePhone(x, y, k);
  } App.placePhone(innerWidth / 2 - 195 * s, innerHeight / 2 - 422 * s, s); };
  let resizeHook = null;
  App.onResize = fn => { resizeHook = fn; };
  addEventListener('resize', () => { if (resizeHook) resizeHook(); else App.centerPhone(); });

  // точка страницы -> точка экрана телефона (390 × 844)
  App.toScreen = (cx, cy) => ({ x: (cx - App.phone.x) / App.scale, y: (cy - App.phone.y) / App.scale });

  // ---- нажатие: всё с классом .tap сжимается под пальцем
  let pressed = null;
  addEventListener('pointerdown', e => {
    const t = e.target.closest && e.target.closest('.tap');
    if (t) { pressed = t; t.classList.add('pressed'); }
  }, true);
  const release = () => { if (pressed) { pressed.classList.remove('pressed'); pressed = null; } };
  addEventListener('pointerup', release, true);
  addEventListener('pointercancel', release, true);
  App.releasePress = release;

  /* Перетаскивание. h = { start(e) -> false чтобы отказаться, move(dx, dy, e), end(dx, dy, vx, vy, e), tap(e), axis: 'x' | 'y' | null }
     Смещения в пикселях экрана телефона (делим на масштаб). Скорость — px/с. Жест «захватывается» после 6 px;
     если задана ось и палец пошёл поперёк, жест отдаётся дальше (например, прокрутке списка). */
  App.drag = (node, h) => {
    node.addEventListener('pointerdown', e => {
      if (e.button) return;
      if (h.start && h.start(e) === false) return;
      const x0 = e.clientX, y0 = e.clientY;
      let on = false, dead = false, lx = x0, ly = y0, lt = performance.now(), vx = 0, vy = 0;
      const mv = ev => {
        if (dead) return;
        const dx = (ev.clientX - x0) / App.scale, dy = (ev.clientY - y0) / App.scale;
        if (!on) {
          if (Math.hypot(dx, dy) < 6) return;
          if (h.axis === 'x' && Math.abs(dy) > Math.abs(dx)) { dead = true; return; }
          if (h.axis === 'y' && Math.abs(dx) > Math.abs(dy)) { dead = true; return; }
          if (h.accept && h.accept(dx, dy) === false) { dead = true; return; }
          on = true; release();
          try { node.setPointerCapture(e.pointerId); } catch (_) {}
          if (h.grab) h.grab(ev);
        }
        const now = performance.now(), dt = Math.max(1, now - lt);
        vx = lerp(vx, (ev.clientX - lx) / App.scale / dt * 1000, .5);
        vy = lerp(vy, (ev.clientY - ly) / App.scale / dt * 1000, .5);
        lx = ev.clientX; ly = ev.clientY; lt = now;
        ev.preventDefault();
        h.move && h.move(dx, dy, ev);
      };
      const up = ev => {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
        const dx = (ev.clientX - x0) / App.scale, dy = (ev.clientY - y0) / App.scale;
        if (on) {
          if (performance.now() - lt > 90) { vx = 0; vy = 0; }
          node._dragged = performance.now();
          h.end && h.end(dx, dy, vx, vy, ev);
        } else if (!dead && h.tap && ev.type === 'pointerup') h.tap(e);     // e — само нажатие: у него верная цель
      };
      addEventListener('pointermove', mv, { passive: false }); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    });
  };
  /* Листание двумя пальцами на тачпаде: горизонтальный «скролл» листает на один кадр.
     fn(+1 | -1); пока жест не закончился, второй раз не листает. */
  App.wheelSwipe = (node, fn, ok = () => true) => {
    let acc = 0, lock = false, idle = 0;
    node.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || !ok()) return;
      e.preventDefault();
      clearTimeout(idle); idle = setTimeout(() => { acc = 0; lock = false; }, 180);
      if (lock) return;
      acc += e.deltaX;
      if (Math.abs(acc) > 40) { lock = true; fn(acc > 0 ? 1 : -1); acc = 0; }
    }, { passive: false });
  };
  // клик, который не срабатывает сразу после перетаскивания
  App.onTap = (node, fn) => node.addEventListener('click', e => {
    const d = e.target.closest('[data-nodrag]') ? 0 : (node._dragged || 0);
    if (performance.now() - d < 250) return;
    fn(e);
  });

  // ---- звук интерфейса (синтез, без файлов) и «вибрация»
  let actx = null;
  const ac = () => actx || (actx = new (window.AudioContext || window.webkitAudioContext)());
  App.unlockAudio = () => { try { ac().resume(); } catch (_) {} };
  function thump(at, f, len, gain) {
    const c = ac(), o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, at); o.frequency.exponentialRampToValueAtTime(f * .7, at + len);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + .008); g.gain.exponentialRampToValueAtTime(.0001, at + len);
    o.connect(g).connect(c.destination); o.start(at); o.stop(at + len + .02);
  }
  /* 19.11 Андрей: «убери из прототипа звучки и тряски экрана» — щелчки и вибрация молчат.
     Вызовы App.haptic / App.tick остаются по коду; звук-синтез (thump) не удалён — вернуть легко. */
  App.haptic = () => {};
  App.tick = () => {};
  void thump;

  // ---- строка состояния: тёмная на светлом, светлая на фото и тёмных экранах
  const sbStack = [];
  App.statusLight = (key, on) => {
    const i = sbStack.indexOf(key);
    if (on && i < 0) sbStack.push(key);
    if (!on && i >= 0) sbStack.splice(i, 1);
    phone.classList.toggle('sb-light', sbStack.length > 0);
  };

  // ---- фон вокруг телефона: размытое фото того, что сейчас на экране
  const bds = $$('#backdrop .bd'); let bdI = 0, bdSrc = '';
  App.backdrop = src => {
    if (!src || src === bdSrc) return;
    bdSrc = src;
    const img = new Image();
    img.onload = () => {
      if (bdSrc !== src) return;
      bdI = 1 - bdI;
      bds[bdI].style.backgroundImage = `url("${src}")`;
      bds[bdI].classList.add('on'); bds[1 - bdI].classList.remove('on');
    };
    img.src = src;
  };

  // ---- короткое сообщение внизу экрана
  let toastEl = null, toastT = 0;
  App.toast = text => {
    if (!toastEl) { toastEl = el('<div class="toast"></div>'); $('#app').append(toastEl); }
    toastEl.textContent = text; toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 1900);
  };

  // ---- события
  const subs = {};
  App.on = (name, fn) => { (subs[name] || (subs[name] = [])).push(fn); };
  App.emit = (name, a, b) => { (subs[name] || []).forEach(fn => fn(a, b)); };

  /* ---- рассказ: настоящие файлы Юли, по частям. Если файл не открылся, время идёт само,
     чтобы плеер в прототипе всё равно жил. События: audio:time, audio:state, audio:part, audio:done. */
  const A = App.audio = { el: new Audio(), key: null, parts: [], idx: 0, playing: false, sim: false, simT: 0, title: '' };
  A.el.preload = 'auto';
  A.dur = () => (A.parts[A.idx] ? (A.sim || !isFinite(A.el.duration) || !A.el.duration ? A.parts[A.idx].dur : A.el.duration) : 0);
  A.time = () => (A.sim ? A.simT : A.el.currentTime || 0);
  A.total = () => A.parts.reduce((s, p) => s + p.dur, 0);
  A.loadPart = (idx, t = 0) => {
    A.idx = idx; A.sim = false; A.simT = t;
    A.el.src = A.parts[idx].src;
    if (t) { const set = () => { try { A.el.currentTime = t; } catch (_) {} }; A.el.addEventListener('loadedmetadata', set, { once: true }); }
    App.emit('audio:part', idx);
    App.emit('audio:time');
  };
  A.load = (key, idx = 0, t = 0) => {
    const d = window.AUDIODATA[key];
    A.key = key; A.parts = d ? d.parts : [];
    A.pause();
    if (A.parts.length) A.loadPart(Math.min(idx, A.parts.length - 1), t);
  };
  A.play = () => {
    if (!A.parts.length) return;
    A.playing = true;
    if (!A.sim) { const p = A.el.play(); if (p && p.catch) p.catch(() => { A.sim = true; }); }
    App.emit('audio:state', true);
  };
  A.pause = () => { A.playing = false; try { A.el.pause(); } catch (_) {} App.emit('audio:state', false); };
  A.toggle = () => (A.playing ? A.pause() : A.play());
  A.seek = t => {
    t = clamp(t, 0, Math.max(0, A.dur() - .05));
    if (A.sim) A.simT = t; else { try { A.el.currentTime = t; } catch (_) {} }
    App.emit('audio:time');
  };
  A.partEnded = () => {
    if (A.idx < A.parts.length - 1) { const was = A.playing; A.loadPart(A.idx + 1); if (was) A.play(); }
    else { A.pause(); App.emit('audio:done'); }
  };
  // стрелки по правилу из «Навигации»: ⏮ в первые 3 секунды — прошлая часть, позже — к началу; ⏭ — следующая часть
  A.prev = () => {
    if (A.time() > 3 || A.idx === 0) return A.seek(0);
    const was = A.playing; A.loadPart(A.idx - 1); if (was) A.play();
  };
  A.next = () => A.partEnded();
  A.el.addEventListener('ended', () => A.partEnded());
  A.el.addEventListener('error', () => { if (A.parts.length) A.sim = true; });
  let lastT = performance.now();
  (function loop(now) {
    const dt = (now - lastT) / 1000; lastT = now;
    if (A.playing) {
      if (A.sim) { A.simT += dt; if (A.simT >= A.dur()) { A.simT = 0; A.partEnded(); } }
      App.emit('audio:time');
    }
    requestAnimationFrame(loop);
  })(lastT);
})();
