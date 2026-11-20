/* Интро. Логотип лежит по центру. Клик — он подпрыгивает, встаёт на ножки и бежит.
   Из-за края выезжает айфон; логотип резко тормозит перед ним и запрокидывает голову.
   Потом приседает, запрыгивает в экран, танцует маленькую балетную связку, ложится логотипом —
   и это уже заставка приложения. Клик во время интро пропускает его. */
(() => {
  const L = window.Logo, V = L.V;
  const { $, clamp, lerp, ease } = App;
  const svg = $('#actor-svg'), gsvg = $('#ground-svg'), gline = $('#ground-line'), floor = $('#splash-floor');
  const THEME = { ink: '#464646', bg: '#E2D8C8', shade: 'rgba(40,40,40,.14)', dot: '#B3A78F' };
  const SKID = 0.35, LOOK = 2.35, FLY = 0.82;
  const skidD = L.skidDistance(SKID);

  let M, actor, st = 'idle', ts = 0, cam = 0, crane = -1, phoneWorld = 0, xStop = 0, camStop = 0, last = 0, raf = 0;

  function metrics() {
    const W = innerWidth, H = innerHeight, s = App.fitScale();
    const k0 = clamp(0.42 * H / 389, 0.55, 1.3);
    const kin = Math.min(k0 * 0.62, 0.54 * 390 * s / 218);
    const kS = 196 * s / 304;
    const py = H / 2 - 422 * s;
    return { W, H, s, k0, kin, kS, py, px: W / 2 - 195 * s,
             idleY: H / 2 + L.HALF_H * k0, runY: H / 2 + 422 * s - 6,
             gap: 190 * k0, floorY: py + 577 * s, splashY: py + 400 * s + L.HALF_H * kS };
  }

  const groundY = () => (crane < 0 ? M.idleY : lerp(M.idleY, M.runY, ease(clamp(crane / 1.95, 0, 1))));
  function drawGround(gy) {
    const y = gy + 17 * M.k0;
    gline.setAttribute('y1', y); gline.setAttribute('y2', y);
    gline.style.strokeWidth = 7 * M.k0;
    gline.style.strokeDasharray = `0 ${20 * M.k0}`;
    gline.style.strokeDashoffset = cam % (20 * M.k0);
  }
  const go = name => { st = name; ts = 0; };

  let manual = false;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!manual) update(dt);
    if (st !== 'done') raf = requestAnimationFrame(frame);
  }
  function update(dt) {
    ts += dt;
    if (crane >= 0) crane += dt;
    let c = { amp: 0, tip: 1, v: 0, leanT: 0, act: null };
    const gy = groundY();
    const outside = st === 'idle' || st === 'up' || st === 'legs' || st === 'accel' || st === 'cruise' || st === 'skid' || st === 'crouch';
    if (outside) { actor.x = M.W / 2; actor.y = gy; actor.k = M.k0; }
    else if (st === 'land' || st === 'ballet' || st === 'legsin') { actor.x = M.W / 2; actor.y = M.floorY; actor.k = M.kin; }
    switch (st) {
      case 'idle': break;
      case 'up':
        c.tip = 1 + Math.min(1, ts / V.flipDur);
        if (ts >= V.flipDur) { crane = 0; go('legs'); }
        break;
      case 'legs': {
        const w = Math.min(1, ts / 0.55);
        c = { amp: L.smooth(w), tip: 0, v: 0, leanT: L.anticipAt(w).lean };
        if (w >= 1) go('accel');
        break;
      }
      case 'accel': {
        const w = Math.min(1, ts / V.accelDur), m = L.accelAt(w);
        c = { amp: 1, tip: 0, v: m.v, leanT: m.lean };
        if (w >= 1) { phoneWorld = cam + M.W + 70; go('cruise'); }
        break;
      }
      case 'cruise':
        c = { amp: 1, tip: 0, v: 1, leanT: V.leanCruise };
        if (phoneWorld - cam - M.W / 2 <= M.gap + skidD * M.k0) go('skid');
        break;
      case 'skid': {
        const v = 1 - L.smooth(ts / SKID);
        c = { amp: 1, tip: 0, v, leanT: V.leanCruise * v, act: L.withSkid(ts, L.lookUp(ts - 0.15, 1.15), 0) };
        if (ts >= LOOK) { xStop = phoneWorld - cam; camStop = cam; go('crouch'); }
        break;
      }
      case 'crouch': {
        const w = Math.min(1, ts / 0.4), e = ease(w);
        c = { amp: 1, tip: 0, v: 0, leanT: 0, act: { dy: 22 * e, lean: -7 * e, along: null, across: null } };
        if (w >= 1) go('fly');
        break;
      }
      case 'fly': {
        const u = Math.min(1, ts / FLY), e = ease(u);
        const px = lerp(xStop, M.px, e);                       // камера доезжает: телефон встаёт по центру
        cam = camStop + (xStop - px);
        App.placePhone(px, M.py, M.s);
        actor.x = lerp(M.W / 2, px + 195 * M.s, u);
        actor.y = lerp(M.runY, M.floorY, u) - 0.2 * M.H * 4 * u * (1 - u);
        actor.k = lerp(M.k0, M.kin, L.smooth(u));
        const tuck = Math.sin(Math.PI * Math.min(1, u * 1.15));
        c = { amp: 1, tip: 0, v: 0, leanT: 0, shadowK: Math.pow(Math.abs(2 * u - 1), 3),
              act: { dy: -4 * tuck, lean: 13 * tuck - 4 * (1 - u), near: { x: 15 + 16 * tuck, h: 30 * tuck, phi: 30 * tuck }, far: { x: -15 - 12 * tuck, h: 46 * tuck, phi: 38 * tuck } } };
        if (u > 0.55) floor.classList.add('on');
        if (u >= 1) { actor.k = M.kin; go('land'); }
        break;
      }
      case 'land': {
        const squash = L.kf(ts, [[0, 0], [0.1, 1, 'o'], [0.5, 0]]);
        c = { amp: 1, tip: 0, v: 0, leanT: 0, act: { dy: 16 * squash, lean: 4 * squash } };
        if (ts >= 0.55) go('ballet');
        break;
      }
      case 'ballet':
        c = { amp: 1, tip: 0, v: 0, leanT: 0, act: L.ballet(ts) };
        if (ts >= 4.0) go('legsin');
        break;
      case 'legsin': {
        const w = Math.min(1, ts / 0.5);
        c = { amp: 1 - L.smooth(w), tip: 0, v: 0, leanT: 0 };
        if (w >= 1) {
          go('down');
          floor.classList.remove('on'); gsvg.style.opacity = 0;
          document.body.classList.remove('intro'); document.body.classList.add('live');
        }
        break;
      }
      case 'down': {
        const w = Math.min(1, ts / V.flipDur), e = ease(w);
        c = { amp: 0, tip: w, v: 0, leanT: 0 };
        actor.x = M.W / 2; actor.y = lerp(M.floorY, M.splashY, e); actor.k = lerp(M.kin, M.kS, e);
        if (w >= 1) go('hold');
        break;
      }
      case 'hold':
        c = { amp: 0, tip: 1, v: 0, leanT: 0 };
        actor.x = M.W / 2; actor.y = M.splashY; actor.k = M.kS;
        if (ts >= 0.55) { finish(true); return; }
        break;
    }
    const dg = actor.step(dt, c);
    cam += dg * M.k0;
    if (st === 'cruise' || st === 'skid' || st === 'crouch') App.placePhone(phoneWorld - cam, M.py, M.s);
    drawGround(gy);
  }

  // интро закончилось: телефон по центру, заставка растворяется в первый экран
  function finish(soft) {
    cancelAnimationFrame(raf);
    st = 'done';
    document.body.classList.remove('intro', 'idle'); document.body.classList.add('live');
    gsvg.style.opacity = 0; floor.classList.remove('on');
    App.onResize(null); App.centerPhone();
    svg.style.transition = `opacity ${soft ? .6 : .25}s ease`; svg.style.opacity = 0;
    setTimeout(() => { if (actor) { actor.remove(); actor = null; } svg.style.display = 'none'; }, 700);
    App.startApp(soft);
  }

  function start() {
    if (st !== 'idle') return;
    document.body.classList.remove('idle');
    App.unlockAudio();
    gsvg.style.opacity = 1;
    go('up');
  }

  function init() {
    M = metrics();
    document.body.classList.add('idle');
    App.placePhone(M.W + 80, M.py, M.s);
    actor = L.makeActor(svg, THEME);
    actor.x = M.W / 2; actor.y = M.idleY; actor.k = M.k0;
    App.onResize(() => { if (st === 'idle') { M = metrics(); App.placePhone(M.W + 80, M.py, M.s); } });
    addEventListener('pointerdown', onDown);
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function onDown(e) {
    if (st === 'done') return removeEventListener('pointerdown', onDown);
    if (e.target.closest && e.target.closest('#hud')) return;
    if (st === 'idle') start(); else finish(false);
  }
  addEventListener('keydown', e => {
    if (st === 'done') return;
    // Esc — тихий пропуск интро сразу к каталогу (для Андрея, нигде не подписан)
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); finish(false); return; }
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); if (st === 'idle') start(); else finish(false); }
  }, true);

  // для проверки кадров: Intro.at('ballet', 1.2) ставит сцену и время внутри неё
  window.Intro = { start, finish, state: () => st, get M() { return M; }, get actor() { return actor; },
    // ручная прокрутка: Intro.advance(1.5) проигрывает полторы секунды интро сразу
    advance(sec) { manual = true; for (let i = 0, n = Math.round(sec * 60); i < n && st !== 'done'; i++) update(1 / 60); return st + ' ' + ts.toFixed(2); } };

  if (/[?&]skip\b/.test(location.search) || window.MOBILE) { M = metrics(); st = 'idle'; finish(false); } else init();
})();
