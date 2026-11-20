/* Сценарий прогулки. Состояние — { kind, n }:
     far   далеко от старта            near  рядом со стартом
     site  на месте (n — номер точки)  story рассказ играет      done  рассказ окончен
     to    идём к точке n             road  «История в дорогу» на пути к точке n (после 7, 10 и 15, как в боте)
     end   финал: пройденный маршрут, пять мест «Что ещё посмотреть», скидка на следующую прогулку
   По сценарию шаги идут сами: по GPS и по концу аудио. GPS в прототипе нет, поэтому «идти» —
   это стрелка вправо или кнопка слева от телефона. Всё остальное — настоящие нажатия на экране. */
(() => {
  const { $, clamp, lerp, ease } = App;
  const W = App.walk, D = window.DATA, M = window.Maps, MD = window.MAPDATA, mm = W.map, G = W.gallery, tile = W.tile, A = App.audio;
  const P = n => D.point(n);
  const toStart = M.routes.toStart, NEAR_S = toStart.len - 630;
  const LAST = D.walk.count;

  // ---- путь между соседними точками: 1→2 и 2→3 выверены по двору, дальше — куски общего маршрута
  const walkPts = MD.routes.walk;
  const idx = [0];
  D.points.forEach((p, i) => {
    let best = idx[i], bd = 1e9;
    for (let k = idx[i]; k < walkPts.length; k++) { const d = Math.hypot(walkPts[k][0] - p.x, walkPts[k][1] - p.y); if (d < bd) { bd = d; best = k; } }
    idx.push(best);
  });
  const legCache = {};
  function leg(n) {                       // путь от точки n-1 к точке n
    if (legCache[n]) return legCache[n];
    let r;
    if (n === 2) r = M.routes.p1p2; else if (n === 3) r = M.routes.p2p3;
    else {
      const a = P(n - 1), b = P(n), mid = walkPts.slice(idx[n - 1] + 1, idx[n]);
      r = M.Route([[a.x, a.y], ...mid, [b.x, b.y]]);
    }
    return (legCache[n] = r);
  }
  // расстояние до точки — длина этого пути, округлённая до 5 м (везде одно и то же число)
  D.points.forEach(p => { if (p.n > 1) p.step = Math.max(10, Math.round(leg(p.n).len / 5) * 5); });
  const later = n => (n === 2 ? M.routes.after1 : n === 3 ? M.routes.after2 : n < LAST ? leg(n + 1) : null);

  // ---- что показывает кружок в каждом состоянии. На остановках совпадает со статичными кружками из Paper.
  const T = n => ({ x: P(n).x, y: P(n).y, label: String(n) });
  const headAt = (r, s) => { const a = r.at(s), b = r.at(Math.min(r.len, s + 18)); return Math.hypot(b.x - a.x, b.y - a.y) < 1 ? a.h : M.bearing(a.x, a.y, b.x, b.y); };
  // соседние точки на карте: пройденные приглушены, следующие тёмные. Точка, где человек стоит, — под каплей.
  const others = n => D.points.filter(p => p.n !== n && p.n !== n - 1 && p.n >= n - 2 && p.n <= n + 2)
    .map(p => ({ x: p.x, y: p.y, label: String(p.n), state: p.n < n ? 'done' : 'later' }));
  function key(st) {
    let n = st.n; const box = W.box.walk;
    // 19.11 Андрей: «крутить каплю» — далеко от старта карта стоит севером вверх, поворачивается капля
    if (st.kind === 'far') { const a = toStart.at(0); return { x: a.x, y: a.y, h: headAt(toStart, 0), face: 0, r: 420, ...W.box.far, target: T(1), zone: false, inZone: false, route: { r: toStart, s: 0 }, later: null, points: [], ripple: false }; }
    if (st.kind === 'near') { const a = toStart.at(NEAR_S); return { x: a.x, y: a.y, h: headAt(toStart, NEAR_S), face: 0, r: 180, ...box, target: T(1), zone: false, inZone: false, route: { r: toStart, s: NEAR_S }, later: null, points: [], ripple: false }; }
    if (st.kind === 'to' || st.kind === 'road' || st.kind === 'end') {
      if (st.kind === 'end') n = LAST;
      const r = leg(n), a = r.at(0);
      return { x: a.x, y: a.y, face: 0, h: n === 2 ? MD.stops.toP2.heading : headAt(r, 0), r: n === 2 ? 24 : n === 3 ? 22 : clamp(r.len * 0.9, 24, 140), ...box,
               target: T(n), zone: false, inZone: false, route: { r, s: 0 }, later: later(n), points: others(n), ripple: false };
    }
    // на месте, рассказ, рассказ окончен: капля в жёлтой зоне, пути нет
    const pos = n === 1 ? MD.stops.onSite1.pos : [P(n).x, P(n).y];
    const h = n === 1 ? MD.stops.onSite1.heading : n === 2 ? MD.stops.onSite2.heading : headAt(leg(n), Math.max(0, leg(n).len - 6));
    return { x: pos[0], y: pos[1], h, face: 0, r: 40, ...box, target: T(n), zone: true, inZone: true, route: null, later: null, points: [], ripple: false };
  }

  // ---- анимации
  let token = 0, busy = false, speed = 1;
  const CAP = /[?&]fast\b/.test(location.search) ? 5 : 0.05;     // ?fast — для проверки в фоновой вкладке, где кадры редкие
  function anim(dur, fn) {
    const my = ++token; busy = true;
    return new Promise(res => {
      let t = 0, last = performance.now();
      const f = now => {
        if (my !== token) return res(false);
        const dt = Math.min(CAP, (now - last) / 1000) * speed; last = now; t += dt;
        const u = Math.min(1, t / dur);
        fn(u, dt);
        if (u < 1) requestAnimationFrame(f); else { busy = false; speed = 1; res(true); }
      };
      requestAnimationFrame(f);
    });
  }
  const stopAnim = () => { token++; busy = false; speed = 1; };
  function mapTween(to, dur) {
    const a = { ...mm.state }, dh = M.norm180(to.h - a.h), f0 = a.face || 0, df = M.norm180((to.face || 0) - f0);
    const rest = { ...to }; ['x', 'y', 'h', 'face', 'r', 'bx', 'by', 'size'].forEach(k => delete rest[k]);
    mm.set(rest);
    return anim(dur, u => {
      const e = ease(u);
      mm.set({ x: lerp(a.x, to.x, e), y: lerp(a.y, to.y, e), h: a.h + dh * e, face: f0 + df * e, r: lerp(a.r, to.r, e),
               bx: lerp(a.bx, to.bx, e), by: lerp(a.by, to.by, e), size: lerp(a.size, to.size, e) });
    });
  }

  const km = m => (m >= 1000 ? `${(Math.round(m / 100) / 10).toString().replace('.', ',')} км` : `${m >= 100 ? Math.round(m / 10) * 10 : Math.max(5, Math.round(m / 5) * 5)} м`);
  const mins = m => { const n = Math.max(1, Math.round(m / 75)), a = n % 10, b = n % 100; return `${n} ${a === 1 && b !== 11 ? 'минута' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'минуты' : 'минут'} пешком`; };
  function turnTile(r, s, rem) {
    const t = r.nextTurn(s);
    if (t && t.dist < rem - 6) tile.turn({ icon: t.side, big: km(t.dist), sub: t.side === 'right' ? 'и направо' : 'и налево' });
    else tile.turn({ icon: 'ahead', big: km(rem), sub: 'прямо' });
  }

  /* Идём по пути: человек движется, карта поворачивается за ним с небольшим запозданием, как компас.
     o = { r0, r1 | rOf(rem), box, onFrame(rem) } */
  function walkAlong(r, s0, s1, dur, o) {
    const a0 = { ...mm.state }, f0 = a0.face || 0;
    let h = a0.h + f0;                                   // карта сразу берёт направление взгляда, капля встаёт носом вверх
    return anim(dur, (u, dt) => {
      const e = ease(u), s = lerp(s0, s1, e), a = r.at(s), rem = r.len - s;
      h += M.norm180(headAt(r, s) - h) * (1 - Math.exp(-dt * 5));
      const b = o.box ? ease(clamp(u * dur / 0.9, 0, 1)) : 0;
      const fk = f0 ? Math.max(0, 1 - u * dur / 0.6) : 0;
      mm.set({ x: a.x, y: a.y, h: h - f0 * fk, face: f0 * fk, r: o.rOf ? o.rOf(rem, e) : lerp(o.r0, o.r1, e), route: { r, s },
               ...(o.box ? { bx: lerp(a0.bx, o.box.bx, b), by: lerp(a0.by, o.box.by, b), size: lerp(a0.size, o.box.size, b) } : {}) });
      o.onFrame && o.onFrame(rem, s);
    });
  }
  /* Быстрые переходы (19.11, Андрей: «везде сделать быстрые переходы анимацией, что на карте мы как бы проходим путь»).
     Весь путь одной линией: от «далеко» к старту и дальше через все точки. Любой переход без своей анимации
     (назад, цифры, список точек, «Продолжить») — карта бежит по этой линии от прежнего места к новому,
     посередине чуть отдаляется, чтобы было видно, где идём. */
  const TRACK_PTS = [...MD.routes.toStart, ...walkPts.slice(1)];
  const walkCum = [0];
  for (let k = 1; k < walkPts.length; k++) walkCum.push(walkCum[k - 1] + Math.hypot(walkPts[k][0] - walkPts[k - 1][0], walkPts[k][1] - walkPts[k - 1][1]));
  const TRACK = M.Route(TRACK_PTS);
  const posS = st => !st ? null : st.kind === 'far' ? 0 : st.kind === 'near' ? NEAR_S
    : st.kind === 'end' ? toStart.len + walkCum[idx[LAST]]
    : toStart.len + walkCum[idx[st.kind === 'to' || st.kind === 'road' ? Math.max(1, st.n - 1) : st.n] || 0];
  function segment(a, b) {
    const n = Math.max(2, Math.ceil(Math.abs(b - a) / 4)), pts = [];
    for (let i = 0; i <= n; i++) { const q = TRACK.at(lerp(a, b, i / n)); pts.push([q.x, q.y]); }
    return M.Route(pts);
  }
  async function settle(st, prev) {
    const k = key(st), a = posS(prev), b = posS(st);
    if (a == null || Math.abs(b - a) < 8) { mm.set(k); return true; }
    const r = segment(a, b), d = r.len, r0 = mm.state.r, lift = Math.min(260, d * 0.22);
    mm.set({ zone: false, inZone: false, ripple: false, target: k.target, points: [], later: null });
    const ok = await walkAlong(r, 0, d, clamp(d / 380, 0.9, 2.4), { rOf: (rem, e) => lerp(r0, k.r, e) + Math.sin(Math.PI * e) * lift, box: { bx: k.bx, by: k.by, size: k.size } });
    if (!ok) return false;
    return mapTween(k, 0.45);
  }
  async function arrive(st) {
    App.haptic('arrive');
    mm.set({ zone: true, inZone: true, ripple: false });
    await mapTween(key(st), 0.9);
  }

  // ---- подсказки ведущему: шаги со сценарной полосы доски «Путь к старту»
  const HUD = {
    far: ['Шаг 1', 'Далеко от старта', 'Большая карта ведёт к старту. Фото показывает, куда прийти', 'Идти к старту'],
    near: ['Шаг 2', 'Рядом со стартом', 'Фото крупнее, карта меньше, слева подсказка о повороте', 'Дойти до точки'],
    site1: ['Шаг 3', 'На месте, запускаем', 'Подсказка превращается в кнопку «Начать прогулку»', 'Начать прогулку'],
    story1: ['Шаг 4', 'Первый дроп', 'Рассказ идёт по частям. Фото листаются, соседнее выглядывает сбоку', 'Следующая часть'],
    done: ['Шаг 5', 'Рассказ окончен', 'Плеер превращается в кнопку «Идём дальше»', 'Идём дальше'],
    to: ['Шаг 5', 'Идём к следующей точке', 'Карта ведёт, фото подсказывает, что искать', 'Дойти до точки'],
    site: ['Шаг 6', 'На нужной точке', 'Вибрация, «Вы на месте», кнопка «Слушать рассказ»', 'Слушать рассказ'],
    story: ['Шаг 7', 'Следующий дроп', 'Тот же экран, что в шаге 4: фото, аудио, подписи', 'Следующая часть'],
    road: ['В пути', 'История в дорогу', 'Аудио на ходу: карта ведёт к следующей точке, Юля рассказывает', 'Следующая часть'],
    end: ['Финал', 'Прогулка пройдена', 'Маршрут, пять мест «Что ещё посмотреть», анкета и скидка на следующую прогулку', ''],
    home: ['Выход и возврат', 'Продолжить на главной', 'После «Выйти» прогулка стоит первой карточкой и продолжается с того же места', ''],
    catalog: ['До прогулки', 'Карта и выбор прогулки', 'Нажмите на метку. Карту можно двигать и приближать щипком или двойным кликом. Стиль карты меняет кружок под профилем', '']
  };
  const hudBtn = $('#hud-walk');
  function hud(k) {
    const h = HUD[k]; if (!h) return;
    $('.hud-kicker').textContent = h[0]; $('.hud-title').textContent = h[1]; $('.hud-desc').textContent = h[2];
    hudBtn.querySelector('span').textContent = h[3] || 'Дальше';
    hudBtn.disabled = !h[3];
  }
  App.hud = hud;

  // ---- галерея для точки: где встать и «тогда»; если фото нет — обложка точки
  const galKey = (kind, n) => {
    const k = (kind === 'where' ? 'to' : 'story') + n;
    if (!D.galleries[k]) {
      const p = P(n);
      D.galleries[k] = [{ src: p.thumb || D.walk.cover, chip: kind === 'where' ? 'Что искать' : 'Тогда', title: p.name, sub: kind === 'where' ? `Точка ${n}` : p.audioTitle, long: '' }];
    }
    return k;
  };
  const storySub = n => (n === 1 && A.idx === 0 ? `Приветствие · рассказывает ${D.walk.guide}`
    : n === 15 && A.idx === 1 ? 'Часть 2 из 2 · вернитесь к Кинг Джордж'
    : A.parts.length > 1 ? `Часть ${A.idx + 1} из ${A.parts.length} · рассказывает ${D.walk.guide}` : `Рассказывает ${D.walk.guide}`);

  // ---- состояния
  let cur = null;
  const name = st => st.kind + (st.n || '');
  /* Войти в состояние. how: 'jump' — сразу, 'step' — с переходом от предыдущего шага сценария. */
  async function go(st, how = 'jump') {
    const prev = cur; cur = st;
    stopAnim(); walkToken++; Flow.locked = false;
    if (window.Catalog && window.Catalog.isOpen) window.Catalog.hide();
    const n = st.n, p = n ? P(n) : null, stepped = how === 'step' || how === 'listen';
    Flow.state = st;
    App.emit('flow:state', st);
    W.replay(st.kind === 'done');
    if (st.kind !== 'story' && st.kind !== 'road') A.pause();
    W.song(null); W.arrive(null);
    if (window.Finale && st.kind !== 'end') window.Finale.hide();
    hud(st.kind === 'site' && n === 1 ? 'site1' : st.kind === 'story' && n === 1 ? 'story1' : st.kind);

    if (st.kind === 'far') {
      W.layout('far'); W.hdr('go'); tile.clear();
      G.set('yard', { mode: 'wide' });
      W.title(window.MOBILE ? 'Ждём вас на старте' : 'Андрей, ждём вас на старте', `${km(toStart.len)} · ${mins(toStart.len)}`);
      settle(st, prev);
    }
    else if (st.kind === 'near') {
      W.layout('walk'); W.hdr('go');
      G.set('yard', { mode: 'peek' });
      W.title('Вы почти на месте', `${km(630)} · ${mins(630)}`);
      turnTile(toStart, NEAR_S, 630);
      if (stepped && prev && prev.kind === 'far') {
        await walkAlong(toStart, 0, NEAR_S, 3.6, { r0: 420, r1: 180, box: W.box.walk, onFrame: (rem, s) => {
          W.title(rem > 700 ? 'Андрей, ждём вас на старте' : 'Вы почти на месте', `${km(rem)} · ${mins(rem)}`);
          turnTile(toStart, s, rem);
        } });
      } else settle(st, prev);
    }
    else if (st.kind === 'site') {
      W.layout('walk'); W.hdr(n === 1 ? 'x' : 'walk'); if (n > 1) W.pill(n);
      if (n === 1) G.set('yard', { mode: 'peek', chip: 'Перед вами' });
      else G.set(galKey('where', n), { chip: 'Перед вами', sub: n === 3 ? 'Смотрите на него, пока слушаете' : null });
      const landed = () => {
        W.title('Вы на месте', n === 1 ? 'Можно начинать' : `Точка ${n} · ${p.name}`);
        if (n === 1) tile.start(); else tile.listen(p);
      };
      if (stepped && prev && prev.kind === 'near' && n === 1) {
        // от 630 метров до двора: чем ближе точка, тем крупнее карта; у края зоны от «1» идут круги
        mm.set({ zone: true });
        const ok = await walkAlong(toStart, NEAR_S, toStart.len - 16, 4.2, { rOf: rem => clamp(rem * 0.5 + 34, 40, 180), onFrame: (rem, s) => {
          W.title('Вы почти на месте', `${km(rem)} · ${mins(rem)}`);
          turnTile(toStart, s, rem);
          if (rem < 70 && !mm.state.ripple) mm.set({ ripple: true });
        } });
        if (!ok) return;
        landed(); await arrive(st);
      } else if (stepped && prev && prev.kind === 'to' && prev.n === n) {
        const r = leg(n), s0 = mm.state.route ? mm.state.route.s : 0;
        if (n === 2) {
          // точка за спиной: сначала человек оборачивается (карта делает пол-оборота), потом идёт
          tile.turn({ icon: 'ahead', big: km(r.len), sub: 'прямо' });
          const ok = await mapTween({ ...mm.state, h: headAt(r, 0) }, 1.3);
          if (!ok) return;
        }
        mm.set({ zone: true });
        const r0 = mm.state.r;
        const ok = await walkAlong(r, s0, Math.max(s0, r.len - 3), clamp(r.len / 14, 1.6, 4.5), { rOf: (rem, e) => lerp(r0, 40, e), onFrame: (rem, s) => {
          W.title(p.name, `Точка ${n} · ${km(Math.max(rem, 5))} пешком`);
          if (n !== 2) turnTile(r, s, rem); else tile.turn({ icon: 'ahead', big: km(rem), sub: 'прямо' });
        } });
        if (!ok) return;
        landed(); await arrive(st);
      } else { landed(); settle(st, prev); }
    }
    else if (st.kind === 'story') {
      W.layout('walk'); W.hdr('walk'); W.pill(n);
      const gk = galKey('then', n);
      const same = G.key === gk;
      G.set(gk, { hint: n === 1, index: same ? G.index : 0 });
      if (how !== 'resume') { A.load(p.audio, st.part || 0, st.t || 0); }
      W.title(p.name, storySub(n));
      tile.player(p, D.galleries[gk][0].src);
      if (!stepped || !prev || prev.kind !== 'site') settle(st, prev);
      // 19.11 Андрей: «аудио я сам запускал, а не автоматически при переходе» — играет только после «Продолжить»
      // нажали «Слушать рассказ» / «Продолжить» — играет; шаг ведущего (→) только открывает рассказ
      if (how === 'resume' || how === 'listen') A.play();
    }
    else if (st.kind === 'done') {
      W.layout('walk'); W.hdr('walk'); W.pill(n);
      G.set(galKey('then', n), { index: G.key === galKey('then', n) ? G.index : 0 });
      // в конце Шенкина и Бялика в боте — «Песня в дорогу» со ссылкой на YouTube
      W.title(p.name, D.songs[n] ? '' : 'Рассказ окончен');
      W.song(D.songs[n]);
      if (n === LAST) tile.finish(); else if (D.roads[n + 1]) tile.road(P(n + 1), D.roads[n + 1]); else tile.next(P(n + 1));
      settle(st, prev);
    }
    else if (st.kind === 'road') {
      // «История в дорогу»: слушаем на ходу, карта уже ведёт к следующей точке
      W.layout('walk'); W.hdr('walk'); W.pill(n);
      G.set('road' + n, {});
      if (how !== 'resume') A.load(D.roads[n].key, st.part || 0, st.t || 0);
      W.title('История в дорогу', ''); W.arrive(n);
      tile.player({ audioTitle: 'В дорогу' }, D.galleries['road' + n][0].src);
      if (stepped && prev && prev.kind === 'done' && prev.n === n - 1) mapTween(key(st), 1.1); else settle(st, prev);
      if (how === 'resume' || how === 'listen') A.play();
    }
    else if (st.kind === 'end') {
      W.hdr('walk'); W.pill(LAST); tile.clear();
      settle(st, prev);
      window.Finale.show();
    }
    else if (st.kind === 'to') {
      W.layout('walk'); W.hdr('walk'); W.pill(n);
      G.set(galKey('where', n), {});
      const r = leg(n);
      W.title(p.name, `Точка ${n} · ${km(p.step)} пешком`);
      if (window.MOBILE) tile.here(p); else if (n === 2) tile.turn({ icon: 'uturn', big: km(p.step), sub: 'обернитесь' }); else turnTile(r, 0, r.len);
      if (stepped && prev && prev.kind === 'done' && prev.n === n - 1) await mapTween(key(st), 1.1); else settle(st, prev);
    }
  }

  // что считать следующим шагом сценария
  function step() {
    if (Flow.locked) return;
    if (busy) { speed = 6; return; }          // второй раз — доиграть переход быстро
    const s = cur; if (!s) return;
    if (s.kind === 'far') go({ kind: 'near' }, 'step');
    else if (s.kind === 'near') go({ kind: 'site', n: 1 }, 'step');
    else if (s.kind === 'site') (s.n === 1 ? startWalk() : go({ kind: 'story', n: s.n }, 'step'));
    else if (s.kind === 'story' || s.kind === 'road') A.next();
    else if (s.kind === 'done') go(s.n === LAST ? { kind: 'end' } : { kind: D.roads[s.n + 1] ? 'road' : 'to', n: s.n + 1 }, 'step');
    else if (s.kind === 'to') go({ kind: 'site', n: s.n }, 'step');
  }
  const ORDER = [{ kind: 'far' }, { kind: 'near' }, { kind: 'site', n: 1 }, { kind: 'story', n: 1 }, { kind: 'done', n: 1 }, { kind: 'to', n: 2 }, { kind: 'site', n: 2 }, { kind: 'story', n: 2 }, { kind: 'done', n: 2 }, { kind: 'to', n: 3 }];
  // шаг назад по сценарию
  function before(c) {
    const n = c.n;
    switch (c.kind) {
      case 'near': return { kind: 'far' };
      case 'site': return n === 1 ? { kind: 'near' } : { kind: 'to', n };
      case 'story': return { kind: 'site', n };
      case 'done': return { kind: 'story', n };
      case 'road': return { kind: 'done', n: n - 1 };
      case 'to': return D.roads[n] ? { kind: 'road', n } : { kind: 'done', n: n - 1 };
      case 'end': return { kind: 'done', n: LAST };
      default: return null;
    }
  }
  function back() {
    if (Flow.locked || !cur) return;
    const b = before(cur); if (b) go(b);
  }

  /* «Начать прогулку»: логотип на кнопке встаёт на ножки и убегает из плитки, начинается первый рассказ.
     Так записано на доске в «Как работает кружок». */
  let walkToken = 0;
  function startWalk() {
    if (Flow.locked) return;                               // логотип уже бежит — второе нажатие не считается
    if (tile.type !== 'start' || CAP > 1) return go({ kind: 'story', n: 1 }, 'step');   // ?fast — без анимации
    Flow.locked = true;
    const my = ++walkToken, face = tile.face, L = window.Logo, V = L.V;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 't-actor');
    face.append(svg);
    face.querySelector('.t-logo').style.opacity = 0;
    const actor = L.makeActor(svg, { ink: '#FFFCF5', bg: '#282828', shade: null, dot: null });
    const k0 = 64 / (2 * L.HALF_W);
    actor.x = 52; actor.y = 66; actor.k = k0;
    let st = 'up', ts = 0, total = 0, last = performance.now(), over = false;
    const finish = () => { if (over) return; over = true; Flow._tick = null; if (my === walkToken) { Flow.locked = false; go({ kind: 'story', n: 1 }, 'step'); } };
    // один кадр: встаёт с подскоком, выпускает ножки, разгоняется и убегает вправо за край плитки
    const tick = dt => {
      if (over) return;
      if (my !== walkToken) { over = true; return; }       // за это время ушли в другое состояние — не мешаем
      ts += dt; total += dt;
      let c;
      if (st === 'up') { const e = ease(Math.min(1, ts / V.flipDur)); c = { amp: 0, tip: 1 + Math.min(1, ts / V.flipDur), v: 0, leanT: 0 }; actor.k = lerp(k0, k0 * 1.2, e); actor.y = lerp(66, 158, e); if (ts >= V.flipDur) { st = 'legs'; ts = 0; } }
      else if (st === 'legs') { const w = Math.min(1, ts / 0.5); c = { amp: L.smooth(w), tip: 0, v: 0, leanT: L.anticipAt(w).lean }; if (w >= 1) { st = 'run'; ts = 0; } }
      else { const m = L.accelAt(Math.min(1, ts / 0.8)); c = { amp: 1, tip: 0, v: m.v, leanT: m.lean }; }
      const dg = actor.step(dt, c);
      actor.x += dg * actor.k * 1.6;
      if (actor.x >= 215 || total > 9) finish();           // убежал (или что-то пошло не так — не держим экран)
    };
    Flow._tick = sec => { for (let i = 0, n = Math.round(sec * 60); i < n; i++) tick(1 / 60); return st + ' x=' + actor.x.toFixed(0); };
    const f = now => {
      const dt = Math.min(CAP, (now - last) / 1000) * 1.5; last = now;
      if (!Flow._manual) tick(Math.min(dt, 0.08));
      if (!over) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
    setTimeout(finish, 9000);
    face.querySelector('.t-txt').style.cssText = 'transition:opacity .5s ease .5s;opacity:.0';
    face.querySelector('.t-round').style.cssText = 'transition:opacity .4s ease .3s, transform .5s ease .3s;opacity:0;transform:translateX(30px)';
  }

  /* «Далеко от старта»: человек крутится на месте с телефоном — капля поворачивается носом к курсору,
     карта стоит севером вверх (Андрей 19.11: сначала крутилась карта, потом выбрал «Крутить каплю»). */
  let look = null;
  addEventListener('pointermove', e => { look = e; });
  document.addEventListener('pointerleave', () => { look = null; });
  (function lookTick() {
    requestAnimationFrame(lookTick);
    if (window.MOBILE || !cur || cur.kind !== 'far' || busy || Flow.locked) return;
    if ((App.overlayOpen && App.overlayOpen()) || (window.Catalog && window.Catalog.isOpen)) return;
    // 19.11 Андрей: капля смотрит вперёд, крутится карта и значки на ободе (N, море, «1»); чёрный диск стоит
    const S = mm.state, h0 = key(cur).h;
    let target = h0;
    if (look) {
      const p = App.toScreen(look.clientX, look.clientY), dx = p.x - (S.bx + S.size / 2), dy = p.y - (S.by + S.size / 2);
      target = Math.hypot(dx, dy) > 24 ? h0 + Math.atan2(dx, -dy) * 180 / Math.PI : S.h;
    }
    const d = M.norm180(target - S.h);
    if (Math.abs(d) > 0.05) mm.set({ h: S.h + d * 0.1, face: 0 });
  })();

  // ---- события экрана
  App.on('tile:start', startWalk);
  App.on('tile:here', () => cur && cur.kind === 'to' && go({ kind: 'site', n: cur.n }, 'step'));
  App.on('tile:finish', () => cur && cur.kind === 'done' && go({ kind: 'end' }, 'step'));
  App.on('tile:next', () => cur.kind === 'done' && cur.n < LAST && go({ kind: 'to', n: cur.n + 1 }, 'step'));
  App.on('tile:arrive', () => cur && cur.kind === 'road' && go({ kind: 'site', n: cur.n }, 'step'));
  App.on('tile:road', () => cur.kind === 'done' && D.roads[cur.n + 1] && go({ kind: 'road', n: cur.n + 1 }, 'listen'));
  App.on('tile:listen', () => cur.kind === 'site' && go({ kind: 'story', n: cur.n }, 'listen'));
  App.on('ui:go', () => { if (cur.kind === 'far' || cur.kind === 'near') { go({ kind: 'site', n: 1 }); App.haptic('arrive'); } });
  App.on('ui:replay', () => cur.kind === 'done' && go({ kind: 'story', n: cur.n }, 'listen'));
  App.on('audio:part', () => { if (cur && cur.kind === 'story') W.title(P(cur.n).name, storySub(cur.n));  });
  App.on('audio:done', () => { if (cur && cur.kind === 'story') go({ kind: 'done', n: cur.n }, 'step'); else if (cur && cur.kind === 'road') go({ kind: 'to', n: cur.n }, 'step'); });

  const Flow = window.Flow = {
    state: null, locked: false, go, step, back, leg, km, mins, key, gal: galKey, get busy() { return busy; }, stop: stopAnim,
    // уйти из прогулки (в каталог): остановить всё, что ещё едет или бежит
    cancel() { stopAnim(); walkToken++; Flow.locked = false; cur = null; },   // из каталога прогулка начинается заново, без пробежки по карте
    // из списка точек: «вести» и «слушать здесь»
    leadTo: n => go({ kind: 'to', n }, 'step'),
    listen: n => go({ kind: 'story', n }, 'step'),
    resume: (n, part, t, kind = 'story') => go({ kind, n, part, t }, 'listen'),
    outro() { document.body.classList.add('intro'); document.body.classList.remove('live'); $('#phone-pos').style.cssText += ';transition:opacity .6s ease;opacity:0'; setTimeout(() => location.assign(location.pathname), 800); }
  };

  // R — назад к карте с прогулками: всё закрывается, звук стоп, подсказка «Листайте» покажется снова
  function toCatalog() {
    App.emit('ui:closeall'); App.audio.pause(); App.hintSeen = false;
    if (window.Catalog && window.Catalog.show) window.Catalog.show(); else go({ kind: 'far' });
  }

  // ---- клавиши ведущего
  addEventListener('keydown', e => {
    if (!document.body.classList.contains('live') || e.metaKey || e.ctrlKey) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === ' ') { e.preventDefault(); if (!App.overlayOpen || !App.overlayOpen()) step(); }
    else if (k === 'ArrowLeft') back();
    else if (k === '.' || k === 'ю') { if (cur && (cur.kind === 'story' || cur.kind === 'road')) A.seek(A.dur() - 4); }
    else if (k === 'r' || k === 'R' || k === 'к' || k === 'К') toCatalog();
    else if (k === 'h' || k === 'H' || k === 'р' || k === 'Р') document.body.classList.toggle('hud-off');
    else if (k === 'Escape') App.emit('ui:escape');
    else if (/^[0-9]$/.test(k)) { const i = k === '0' ? 9 : +k - 1; if (ORDER[i]) { App.emit('ui:closeall'); go(ORDER[i]); } }
  });
  hudBtn.addEventListener('click', step);

  /* Интро закончилось: показываем приложение. Если есть каталог — начинаем с него. */
  App.startApp = soft => {
    $('#app').classList.add('on'); $('#splash').classList.add('off');
    const m = /[?&]state=([a-z]+)(\d*)/.exec(location.search);
    if (m) return go({ kind: m[1], n: m[2] ? +m[2] : undefined });
    if (window.Catalog && window.Catalog.show) window.Catalog.show(); else go({ kind: 'far' });
  };
})();
