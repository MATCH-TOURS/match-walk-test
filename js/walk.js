/* Экран прогулки: шапка, фото-галерея, заголовок, плитка слева, кружок-карта справа.
   Всё, что делает экран, — показывает состояние, которое ему даёт сценарий (flow.js). */
(() => {
  const { $, el, clamp } = App, D = window.DATA;

  const ICON = App.icons = {
    x: c => `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="${c || '#282828'}" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    play14: c => `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1.5l9.5 5.5L3 12.5z" fill="${c || '#282828'}"/></svg>`,
    route: '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="5" cy="15.5" r="2" fill="none" stroke="#FFFCF5" stroke-width="1.6"/><circle cx="15" cy="4.5" r="2" fill="none" stroke="#FFFCF5" stroke-width="1.6"/><path d="M7 15.5h6.5a2.75 2.75 0 0 0 0-5.5h-7a2.75 2.75 0 0 1 0-5.5H13" fill="none" stroke="#FFFCF5" stroke-width="1.6" stroke-linecap="round"/></svg>',
    replay: '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M1 4v6h6" fill="none" stroke="#282828" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" fill="none" stroke="#282828" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrow: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="#282828" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    turn: '<svg width="40" height="40" viewBox="0 0 40 40"><path d="M12 35V20a7 7 0 0 1 7-7h13" fill="none" stroke="#FFFCF5" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 6l8 7-8 7" fill="none" stroke="#FFFCF5" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    uturn: '<svg width="40" height="40" viewBox="0 0 40 40"><path d="M11 35V17a8.5 8.5 0 0 1 17 0v12" fill="none" stroke="#FFFCF5" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.5 23l7.5 7.5 7.5-7.5" fill="none" stroke="#FFFCF5" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    ahead: '<svg width="40" height="40" viewBox="0 0 40 40"><path d="M20 35V8" fill="none" stroke="#FFFCF5" stroke-width="3.6" stroke-linecap="round"/><path d="M11 16l9-9 9 9" fill="none" stroke="#FFFCF5" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pause: (c, s = 16) => `<svg class="i-pause" width="${s}" height="${s}" viewBox="0 0 16 16"><rect x="3.5" y="2.5" width="3.2" height="11" rx="1" fill="${c}"/><rect x="9.3" y="2.5" width="3.2" height="11" rx="1" fill="${c}"/></svg>`,
    play: (c, s = 16) => `<svg class="i-play" width="${s}" height="${s}" viewBox="0 0 16 16"><path d="M4.5 2.4L13.5 8L4.5 13.6Z" fill="${c}" stroke="${c}" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
    prev: (c, w = 16, h = 14) => `<svg width="${w}" height="${h}" viewBox="0 0 16 14"><rect x="1.5" y="1" width="2.8" height="12" rx="1" fill="${c}"/><path d="M14.5 1.2L5.5 7L14.5 12.8Z" fill="${c}" stroke="${c}" stroke-linejoin="round"/></svg>`,
    next: (c, w = 16, h = 14) => `<svg width="${w}" height="${h}" viewBox="0 0 16 14"><path d="M1.5 1.2L10.5 7L1.5 12.8Z" fill="${c}" stroke="${c}" stroke-linejoin="round"/><rect x="11.7" y="1" width="2.8" height="12" rx="1" fill="${c}"/></svg>`,
    hint: '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 4L4 9L9 14M15 4L10 9L15 14" fill="none" stroke="#282828" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    logo: c => `<svg class="t-logo" viewBox="32 26 563.7 402.9"><g fill="${c}"><polygon points="180 140.6 161.8 428.9 195.2 428.9 202.6 287.8 181.9 140.6 180 140.6"/><path d="M424.3,106.5l-6.5.2-6.1,134.3h50.9v-93c0-27.8-9.7-42.3-38.3-41.5Z"/><path d="M405.2,383.2h-7.4l12.6-276.3-19.1.5c-25.2.7-38.3,16-38.3,41.8l.1,237.9c-.2,23.3,12.2,41.9,38.2,41.9h33c26,0,38.3-13.7,38.3-38.4v-102.6l-53,.1-4.4,95.1Z"/><polygon points="32 26 32 107.1 258 101 291.7 428.9 343.7 428.9 342.8 98.7 595.7 91.8 595.7 26 32 26"/><polygon points="185.2 112.9 209.6 284.7 204.7 390.5 224.6 390.5 230 428.9 281.6 428.9 249.4 111.3 185.2 112.9"/><polygon points="473.4 105.1 474 428.9 519.6 428.9 533.3 103.5 473.4 105.1"/><polygon points="544.3 213.9 536.1 213.9 531.3 325.2 539.5 325.2 535 428.9 595.7 428.9 595.7 101.8 549 103.1 544.3 213.9"/><polygon points="32 207.9 32 428.9 83.7 428.9 88 344.7 34 207.9 32 207.9"/><polygon points="99.3 210.5 99.8 340.6 108.7 428.9 158.3 428.9 158.3 113.7 117.3 114.8 99.3 210.5"/><polygon points="32 117.1 32 183 91.3 333.5 92.4 333.5 92.4 210.5 62.4 116.3 32 117.1"/></g></svg>`
  };

  const root = el(`
    <div class="walk" data-layout="far" data-hdr="go">
      <div class="w-gal"></div>
      <div class="w-ttl"></div>
      <button class="w-btn w-replay tap off" aria-label="Ещё раз">${ICON.replay}</button>
      <button class="w-song w-arrive tap soft"><span></span>${ICON.arrow}</button>
      <a class="w-song tap soft" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M6 12.2V3.4l7-1.6v8.6" fill="none" stroke="#282828" stroke-width="1.6" stroke-linejoin="round"/><circle cx="4.3" cy="12.3" r="1.9" fill="#282828"/><circle cx="11.3" cy="10.6" r="1.9" fill="#282828"/></svg><span></span><svg width="12" height="12" viewBox="0 0 12 12"><path d="M3.5 8.5l5-5M4.5 3.5h4v4" fill="none" stroke="#282828" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
      <div class="w-map tap"></div>
      <div class="w-tile"></div>
      <button class="w-cta tap soft">${ICON.route}<span>Как добраться до старта</span></button>
      <button class="w-btn w-x tap" aria-label="Закрыть">${ICON.x()}</button>
      <button class="w-btn w-go tap">${ICON.play14()}<span>К прогулке</span></button>
      <div class="w-title">${D.walk.title}</div>
      <button class="w-btn w-pill tap"><b>1</b>/${D.walk.count}</button>
    </div>`);
  $('#app').append(root);
  const q = s => root.querySelector(s);

  // ---------------------------------------------------------------- галерея
  function Gallery(host) {
    const nudge = el('<div class="g-nudge"></div>');
    host.append(nudge);
    let track = null, cards = [], slides = [], key = '', index = 0, mode = 'peek', hint = null;
    const cw = () => (mode === 'wide' || slides.length < 2 ? 358 : 330);
    // текущая карточка: первая у левого края, последняя у правого, средние по центру — соседние всегда выглядывают
    const left = i => (cw() === 358 ? 16 : i === 0 ? 16 : i === slides.length - 1 ? 44 : 30);
    const gap = () => (cw() === 358 ? 32 : 8);          // широкая карточка одна на экране, соседняя не видна
    const tx = i => left(i) - i * (cw() + gap());
    function layout() {
      cards.forEach((c, i) => {
        c.style.left = i * (cw() + gap()) + 'px'; c.style.width = cw() + 'px';
        c.classList.toggle('cur', i === index);
      });
      track.style.transform = `translateX(${tx(index)}px)`;
    }
    function build(opts) {
      track = el('<div class="g-track in"></div>');
      cards = slides.map((s, i) => {
        const c = el(`<div class="g-card tap" data-i="${i}">
          <img src="${s.src}" alt="" style="object-position:${s.pos || '50% 50%'}">
          <div class="g-grad${s.dim ? ' dim' : ''}"></div><div class="g-chip"></div>
          ${slides.length > 1 ? `<div class="g-count">${i + 1} из ${slides.length}</div>` : ''}
          <div class="g-cap"><b></b><span></span></div></div>`);
        track.append(c); return c;
      });
      nudge.append(track);
    }
    function texts(opts) {
      cards.forEach((c, i) => {
        const s = slides[i];
        c.querySelector('.g-chip').textContent = opts.chip || s.chip;
        c.querySelector('.g-cap b').textContent = s.title;
        c.querySelector('.g-cap span').textContent = i === 0 && opts.sub ? opts.sub : s.sub;
      });
    }
    function stopHint() {
      nudge.classList.remove('go');
      if (hint) { hint.classList.add('off'); App.hintSeen = true; }
    }
    const G = {
      get index() { return index; }, get slides() { return slides; }, get key() { return key; },
      /* k — имя набора фото; тот же набор не пересоздаётся (карточка просто переезжает),
         новый — плавно сменяет старый. opts: { mode: 'wide' | 'peek', chip, sub, hint, index } */
      set(k, opts = {}) {
        mode = opts.mode || 'peek';
        if (k !== key) {
          if (track) { const old = track; old.classList.remove('in'); old.classList.add('out'); setTimeout(() => old.remove(), 420); }
          key = k; slides = D.galleries[k]; index = opts.index || 0; hint = null;
          build(opts);
          nudge.classList.remove('go');
          // подсказка «Листайте» — один раз, на первом фото прогулки; галерея сама сдвигается и возвращается
          // 19.11 Андрей: «убери» — подсказки «Листайте» нет; соседнее фото и так выглядывает сбоку
          if (false && opts.hint && slides.length > 1 && !App.hintSeen) {
            hint = el(`<div class="g-hint">${ICON.hint}<span>Листайте</span></div>`);
            cards[0].append(hint);
            void nudge.offsetWidth; nudge.classList.add('go');
          }
        }
        texts(opts); layout();
        App.backdrop(slides[index].src);
      },
      go(i) {
        i = clamp(i, 0, slides.length - 1);
        if (i !== index) { index = i; stopHint(); App.tick(); App.emit('gallery:change', i); App.backdrop(slides[i].src); }
        layout();
      },
      // где сейчас карточка на экране телефона — чтобы фото раскрывалось из неё и возвращалось в неё
      rect(i = index) {
        const r = cards[i].getBoundingClientRect(), p = App.toScreen(r.left, r.top);
        return { x: p.x, y: p.y, w: r.width / App.scale, h: r.height / App.scale };
      },
      // где карточка окажется, когда встанет на место (пока она ещё едет)
      finalRect(i = index) { return { x: left(i), y: host.offsetTop, w: cw(), h: host.offsetHeight }; },
      // встать на кадр без анимации: галерея под раскрытым фото
      jump(i) {
        i = clamp(i, 0, slides.length - 1);
        if (i !== index) { index = i; stopHint(); App.emit('gallery:change', i); }
        track.classList.add('drag'); layout(); void track.offsetWidth; track.classList.remove('drag');
      },
      card: (i = index) => cards[i]
    };
    App.drag(host, {
      axis: 'x',
      start: () => !!track && slides.length > 0,
      grab() { track.classList.add('drag'); nudge.classList.remove('go'); },
      move(dx) {
        const n = slides.length;
        if ((index === 0 && dx > 0) || (index === n - 1 && dx < 0)) dx *= 0.3;   // у края тянется туго
        track.style.transform = `translateX(${tx(index) + dx}px)`;
      },
      end(dx, dy, vx) {
        track.classList.remove('drag');
        let ni = index;
        if (dx < -70 || vx < -450) ni++; else if (dx > 70 || vx > 450) ni--;
        G.go(ni);
      },
      tap(e) {
        const c = e.target.closest('.g-card');
        if (!c) return;
        const i = +c.dataset.i;
        if (i !== index) G.go(i); else App.emit('gallery:open', index);
      }
    });
    App.wheelSwipe(host, d => G.go(index + d), () => !!track && slides.length > 1);
    return G;
  }

  // ---------------------------------------------------------------- плитка
  function Tile(host) {
    let face = null, type = null;
    const swap = (t, node) => {
      if (face) { const old = face; old.classList.remove('in'); old.classList.add('out'); setTimeout(() => old.remove(), 260); }
      face = node; type = t; node.classList.add('in'); host.append(node);
      return node;
    };
    const dark = (cls, top, big, small, ev) => {
      const n = el(`<div class="t-face t-dark ${cls} ${ev ? 'tap' : ''}"><div class="t-top">${top}</div><div class="t-txt"><b>${big}</b><span>${small}</span></div></div>`);
      if (ev) n.addEventListener('click', () => App.emit(ev));
      return n;
    };
    const T = {
      get type() { return type; }, get face() { return face; },
      /* подсказка о повороте: d = { icon: 'right' | 'left' | 'uturn' | 'ahead', big: '200 м', sub: 'и направо' } */
      turn(d) {
        if (type !== 'turn') swap('turn', el(`<div class="t-face t-dark t-turn"><div class="t-ico">
          <svg class="i-right" width="40" height="40" viewBox="0 0 40 40">${ICON.turn.replace(/<\/?svg[^>]*>/g, '')}</svg>
          <svg class="i-left" width="40" height="40" viewBox="0 0 40 40"><g transform="translate(40 0) scale(-1 1)">${ICON.turn.replace(/<\/?svg[^>]*>/g, '')}</g></svg>
          <svg class="i-uturn" width="40" height="40" viewBox="0 0 40 40">${ICON.uturn.replace(/<\/?svg[^>]*>/g, '')}</svg>
          <svg class="i-ahead" width="40" height="40" viewBox="0 0 40 40">${ICON.ahead.replace(/<\/?svg[^>]*>/g, '')}</svg>
          </div><div class="t-txt"><b></b><span></span></div></div>`));
        face.querySelectorAll('.t-ico svg').forEach(s => s.classList.toggle('off', !s.classList.contains('i-' + d.icon)));
        face.querySelector('b').textContent = d.big;
        face.querySelector('span').textContent = d.sub;
      },
      // телефон (20.11): точки рядом, GPS их не различит — человек сам говорит, что дошёл
      here(p) { swap('here', dark('t-go', `<div class="t-num">${p.n}</div><div class="t-round">${ICON.arrow}</div>`, 'Я на месте', `${p.name} · ${p.step} м`, 'tile:here')); },
      // последняя точка: в боте «Когда дослушаете, нажимайте последнюю кнопку» → финал
      finish() { swap('finish', dark('t-go t-start', `${ICON.logo('#FFFCF5')}<div class="t-round">${ICON.arrow}</div>`, 'Дальше', 'Финал прогулки', 'tile:finish')); },
      // после точек 7, 10 и 15 в боте вместо «Вперёд» кнопка «История в дорогу»
      road(p, r) { swap('road', dark('t-go', `<div class="t-num">${p.n}</div><div class="t-round">${ICON.play('#282828', 18)}</div>`, 'История в дорогу', `На ходу · ${App.fmt(r.total)}`, 'tile:road')); },
      start() { swap('start', dark('t-go t-start', `${ICON.logo('#FFFCF5')}<div class="t-round">${ICON.arrow}</div>`, 'Начать прогулку', `${D.walk.pts} · ${D.walk.km} км`, 'tile:start')); },
      next(p) { swap('next', dark('t-go', `<div class="t-num">${p.n}</div><div class="t-round">${ICON.arrow}</div>`, 'Идём дальше', `${p.name} · ${p.step} м`, 'tile:next')); },
      listen(p) { swap('listen', dark('', `<div class="t-num">${p.n}</div><div class="t-round">${ICON.play('#282828', 18)}</div>`, 'Слушать рассказ', p.meta, 'tile:listen')); },
      player(p, photo) {
        const A = App.audio;
        const n = swap('player', el(`<div class="t-face t-player">
          <div class="tp-card tap soft">
            <div class="tp-disc"><div class="tp-spin" style="background-image:url('${photo}')"></div><div class="tp-hole"></div></div>
            <div class="tp-info"><div class="tp-name">${p.audioTitle}</div><div class="tp-segs"></div><div class="tp-time"><b>0:00</b><span></span></div></div>
          </div>
          <button class="tp-play tap" data-nodrag aria-label="Пауза">${ICON.pause('#1C1B19')}${ICON.play('#1C1B19')}</button>
          <div class="tp-step"><button class="tp-prev tap" aria-label="Назад">${ICON.prev('#F0EADE')}</button><i></i><button class="tp-next tap" aria-label="Дальше">${ICON.next('#F0EADE')}</button></div>
        </div>`));
        n.querySelector('.tp-segs').innerHTML = A.parts.map(() => '<i><b></b></i>').join('');
        n.querySelector('.tp-card').addEventListener('click', () => App.emit('tile:player'));
        n.querySelector('.tp-play').addEventListener('click', e => { e.stopPropagation(); A.toggle(); });
        n.querySelector('.tp-prev').addEventListener('click', () => A.prev());
        n.querySelector('.tp-next').addEventListener('click', () => A.next());
        T.syncPlayer();
      },
      // плеер в плитке повторяет то, что происходит со звуком
      syncPlayer() {
        if (type !== 'player' || !face) return;
        const A = App.audio, t = A.time(), d = A.dur();
        face.classList.toggle('playing', A.playing);
        face.querySelectorAll('.tp-segs b').forEach((b, i) => { b.style.width = (i < A.idx ? 100 : i === A.idx ? clamp(t / d * 100, 0, 100) : 0) + '%'; });
        face.querySelector('.tp-time b').textContent = App.fmt(t);
        face.querySelector('.tp-time span').textContent = ' / ' + App.fmt(d);
        face.querySelector('.tp-play').setAttribute('aria-label', A.playing ? 'Пауза' : 'Играть');
      },
      setPhoto(src) { if (type === 'player') face.querySelector('.tp-spin').style.backgroundImage = `url('${src}')`; },
      clear() { if (face) { const old = face; old.classList.add('out'); setTimeout(() => old.remove(), 260); } face = null; type = null; }
    };
    App.on('audio:time', T.syncPlayer); App.on('audio:state', T.syncPlayer); App.on('audio:part', T.syncPlayer);
    return T;
  }

  // ---------------------------------------------------------------- заголовок под фото
  const ttl = q('.w-ttl');
  let ttlNode = null, ttlH = null;
  function setTitle(h, p) {
    if (h === ttlH && ttlNode) { ttlNode.querySelector('p').textContent = p; return; }
    if (ttlNode) { const old = ttlNode; old.classList.add('out'); setTimeout(() => old.remove(), 320); }
    ttlH = h;
    ttlNode = el('<div class="w-ttl-in pre"><h1></h1><p></p></div>');
    ttlNode.querySelector('h1').textContent = h; ttlNode.querySelector('p').textContent = p;
    ttl.append(ttlNode);
    void ttlNode.offsetWidth; ttlNode.classList.remove('pre');
  }

  const pillB = q('.w-pill b');
  const W = App.walk = {
    el: root,
    gallery: Gallery(q('.w-gal')),
    tile: Tile(q('.w-tile')),
    map: window.Maps.MiniMap(q('.w-map')),
    layout: v => { root.dataset.layout = v; },
    hdr: v => { root.dataset.hdr = v; },
    title: setTitle,
    pill(n) { if (pillB.textContent != n) { pillB.textContent = n; pillB.classList.remove('bump'); void pillB.offsetWidth; pillB.classList.add('bump'); } },
    replay: on => q('.w-replay').classList.toggle('off', !on),
    // «Песня в дорогу»: ссылка на YouTube под названием точки
    // «История в дорогу» длиннее пути: дошли раньше — «Я уже у точки», рассказ встаёт на паузу
    arrive(n) { const b = q('.w-arrive'); b.classList.toggle('on', !!n); if (n) b.querySelector('span').textContent = `Я уже у точки ${n}`; },
    song(x) { const a = q('a.w-song'); a.classList.toggle('on', !!x); if (x) { a.href = x.url; a.querySelector('span').textContent = `${x.title} · ${x.who}`; } },
    box: { far: { bx: 35, by: 118, size: 320 }, walk: { bx: 182, by: 612, size: 192 } }
  };
  q('.w-x').addEventListener('click', () => App.emit('ui:x'));
  q('.w-go').addEventListener('click', () => App.emit('ui:go'));
  q('.w-pill').addEventListener('click', () => App.emit('ui:pill'));
  q('.w-cta').addEventListener('click', () => App.emit('ui:routes'));
  q('.w-replay').addEventListener('click', () => App.emit('ui:replay'));
  q('.w-arrive').addEventListener('click', () => App.emit('tile:arrive'));
  q('.w-map').addEventListener('click', () => App.emit('map:open'));
})();
