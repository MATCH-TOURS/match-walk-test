/* Поверх экрана прогулки: раскрытое фото, карта на весь экран, шторки «Как добраться» и «Пауза»,
   плеер на весь экран со списком точек (вариант B″ с доски «Навигация»), главная с «Продолжить». */
(() => {
  const { $, el, clamp, lerp } = App, D = window.DATA, W = App.walk, A = App.audio, ICON = App.icons, G = W.gallery;
  const app = $('#app');
  const SHEET = 'cubic-bezier(.32,.72,0,1)';
  const opened = [];                                      // что сейчас открыто, сверху последнее
  const mark = (name, on, close) => { const i = opened.findIndex(o => o.name === name); if (i >= 0) opened.splice(i, 1); if (on) opened.push({ name, close }); };
  App.overlayOpen = () => opened.length > 0;
  App.on('ui:escape', () => { const o = opened[opened.length - 1]; if (o) o.close(); });
  App.on('ui:closeall', () => { [...opened].reverse().forEach(o => o.close(true)); });

  // размеры фото нужны заранее, чтобы раскрывать его сразу в нужную рамку
  const SZ = {};
  Object.values(D.galleries).forEach(list => list.forEach(s => { const i = new Image(); i.onload = () => { SZ[s.src] = [i.naturalWidth, i.naturalHeight]; }; i.src = s.src; }));
  const CY = 388;                                         // центр фото по вертикали: чуть выше середины, снизу подпись
  function fit(src) {
    if (!SZ[src]) { const im = new Image(); im.src = src; if (im.complete && im.naturalWidth) SZ[src] = [im.naturalWidth, im.naturalHeight]; }
    const [nw, nh] = SZ[src] || [4, 3];
    let w = 390, h = 390 * nh / nw;
    if (h > 560) { h = 560; w = 560 * nw / nh; }
    return { x: (390 - w) / 2, y: CY - h / 2, w, h };
  }
  const px = r => ({ left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });

  // ================================================================ раскрытое фото
  const Viewer = (() => {
    const node = el(`<div class="viewer"><div class="v-bg"></div><div class="v-track"></div><img class="v-fly" alt="">
      <div class="v-ui"><button class="v-x tap" aria-label="Закрыть">${ICON.x('#FFFCF5')}</button><div class="v-count"></div>
      <div class="v-cap"><b></b><span></span></div><div class="v-thumbs"></div></div></div>`);
    app.append(node);
    const q = s => node.querySelector(s);
    const bg = q('.v-bg'), track = q('.v-track'), fly = q('.v-fly'), count = q('.v-count'), cap = q('.v-cap'), thumbs = q('.v-thumbs');
    let slides = [], index = 0, busy = false, mode = null, slideEls = [];
    function show(i) {
      index = clamp(i, 0, slides.length - 1);
      const s = slides[index];
      track.style.transform = `translateX(${-index * 390}px)`;
      count.textContent = slides.length > 1 ? `${index + 1} из ${slides.length}` : '';
      cap.querySelector('b').textContent = s.title;
      cap.querySelector('span').textContent = s.long || s.sub || '';
      [...thumbs.children].forEach((b, k) => b.classList.toggle('cur', k === index));
      App.backdrop(s.src);
    }
    let S = G, hid = null;                               // откуда раскрыто: галерея прогулки или фото в шторке каталога
    function open(i, src) {
      if (busy || node.classList.contains('on')) return;
      busy = true; S = src || G; slides = S.slides; index = i;
      const from = S.rect(i), to = fit(slides[i].src);
      track.innerHTML = ''; thumbs.innerHTML = '';
      slideEls = slides.map(s => {
        const n = el(`<div class="v-slide"><img src="${s.src}" alt=""></div>`), r = fit(s.src);
        Object.assign(n.firstChild.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
        track.append(n); return n;
      });
      if (slides.length > 1) slides.forEach((s, k) => { const b = el(`<button class="tap"><img src="${s.src}" alt=""></button>`); b.addEventListener('click', () => { App.tick(); show(k); }); thumbs.append(b); });
      node.classList.toggle('single', slides.length < 2);
      track.style.opacity = 0; track.classList.add('drag'); show(i); void track.offsetWidth; track.classList.remove('drag');
      node.classList.add('on'); mark('viewer', true, close); App.statusLight('viewer', true);
      hid = S.card(i); hid.style.visibility = 'hidden';   // запомнить: если пролистать и закрыть на другом фото, это надо вернуть
      fly.src = slides[i].src; fly.style.display = 'block'; fly.style.objectPosition = slides[i].pos || '50% 50%';
      bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, fill: 'forwards', easing: 'ease' });
      const a = fly.animate([{ ...px(from), borderRadius: S.radius || '0px' }, { ...px(to), borderRadius: '0px' }], { duration: 460, easing: SHEET, fill: 'forwards' });
      const ready = () => { if (!busy || !node.classList.contains('on')) return; track.style.opacity = 1; fly.style.display = 'none'; node.classList.add('ready'); busy = false; };
      a.onfinish = ready; setTimeout(ready, 700);
    }
    function close(instant, dy = 0) {
      if ((busy && instant !== true) || !node.classList.contains('on')) return;
      busy = true; node.classList.remove('ready');
      S.jump(index);                                       // галерея под фото уже стоит на том же кадре
      const card = S.card(index); card.style.visibility = 'hidden';
      const r = fit(slides[index].src), k = 1 - dy / 1600;
      const from = { x: r.x + r.w * (1 - k) / 2, y: r.y + dy + r.h * (1 - k) / 2, w: r.w * k, h: r.h * k }, to = S.finalRect(index);
      track.style.opacity = 0; slideEls.forEach(n => { n.style.transform = ''; });
      fly.src = slides[index].src; fly.style.display = 'block'; fly.style.objectPosition = slides[index].pos || '50% 50%';
      const o0 = +getComputedStyle(bg).opacity;
      bg.getAnimations().forEach(x => x.cancel()); bg.style.opacity = '';
      const done = () => {
        node.classList.remove('on'); fly.style.display = 'none'; card.style.visibility = ''; if (hid) hid.style.visibility = ''; hid = null; busy = false;
        mark('viewer', false); App.statusLight('viewer', false);
        if (S === G) App.emit('viewer:closed', index);
      };
      if (instant === true) return done();
      bg.animate([{ opacity: o0 }, { opacity: 0 }], { duration: 300, fill: 'forwards', easing: 'ease' });
      let fin = false; const end = () => { if (!fin) { fin = true; done(); } };
      fly.animate([{ ...px(from), borderRadius: '0px' }, { ...px(to), borderRadius: S.radius || '0px' }], { duration: 420, easing: SHEET, fill: 'forwards' }).onfinish = end;
      setTimeout(end, 700);
    }
    q('.v-x').addEventListener('click', () => close(false));
    App.drag(node, {
      start: e => !busy && node.classList.contains('ready') && !e.target.closest('button'),
      move(dx, dy) {
        if (!mode) mode = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (mode === 'x') {
          if ((index === 0 && dx > 0) || (index === slides.length - 1 && dx < 0)) dx *= 0.3;
          track.classList.add('drag'); track.style.transform = `translateX(${-index * 390 + dx}px)`;
        } else {
          const d = Math.max(0, dy);                       // тянем вниз: фото уходит за пальцем, фон светлеет
          slideEls[index].style.transform = `translateY(${d}px) scale(${1 - d / 1600})`;
          bg.getAnimations().forEach(x => x.cancel()); bg.style.opacity = clamp(1 - d / 420, 0, 1);
          q('.v-ui').style.opacity = clamp(1 - d / 140, 0, 1);
        }
      },
      end(dx, dy, vx, vy) {
        const m = mode; mode = null;
        if (m === 'x') {
          track.classList.remove('drag');
          let ni = index; if (dx < -70 || vx < -450) ni++; else if (dx > 70 || vx > 450) ni--;
          if (clamp(ni, 0, slides.length - 1) !== index) App.tick();
          show(ni);
        } else {
          q('.v-ui').style.opacity = '';
          if (dy > 110 || vy > 650) close(false, Math.max(0, dy));
          else { const n = slideEls[index]; n.style.transition = `transform .4s ${SHEET}`; n.style.transform = ''; bg.style.opacity = 1; setTimeout(() => { n.style.transition = ''; }, 420); }
        }
      }
    });
    App.wheelSwipe(node, d => { const ni = clamp(index + d, 0, slides.length - 1); if (ni !== index) { App.tick(); show(ni); } }, () => node.classList.contains('ready'));
    return { open, close, get isOpen() { return node.classList.contains('on'); } };
  })();
  App.on('gallery:open', i => Viewer.open(i));
  /* Фото из шторки каталога (19.11, Андрей: «при клике на любую фото… на весь экран, и если там галерея — галерею»).
     slides: [{src, title, sub}], els — элементы на экране, jump(i) — встать под фото на тот же кадр */
  const rectOf = n => { const r = n.getBoundingClientRect(), p = App.toScreen(r.left, r.top); return { x: p.x, y: p.y, w: r.width / App.scale, h: r.height / App.scale }; };
  App.photos = (slides, i, els, jump = () => {}, radius) => {
    slides.forEach(s => { if (!SZ[s.src]) { const im = new Image(); im.onload = () => { SZ[s.src] = [im.naturalWidth, im.naturalHeight]; }; im.src = s.src; } });
    Viewer.open(i, { slides, radius, rect: k => rectOf(els[k]), finalRect: k => rectOf(els[k]), jump, card: k => els[k] });
  };

  // ================================================================ карта на весь экран
  const MapFull = (() => {
    const node = el(`<div class="mapfull"><div class="mf-pan"><img alt=""></div><button class="w-btn mf-x tap" aria-label="Закрыть">${ICON.x()}</button>
      <div class="mf-card"><b>${D.walk.title}</b><span class="mf-sub"></span><div class="mf-legend"><span><i style="background:#CFC6B2"></i>Пройдено</span><span><i class="mf-ahead" style="background:#F2CF4AD9"></i>Впереди</span><span><svg width="10" height="12" viewBox="0 0 10 12" style="vertical-align:-1px;margin-right:6px"><path d="M5 .8C2.6.8.8 2.6.8 4.9c0 1.7.7 2.9 2 4.5L5 11.2l2.2-1.8c1.3-1.6 2-2.8 2-4.5C9.2 2.6 7.4.8 5 .8Z" fill="#282828"/></svg>Вы здесь</span></div></div></div>`);
    app.append(node);
    const pan = node.querySelector('.mf-pan'), img = pan.firstChild, sub = node.querySelector('.mf-sub');
    let z = 1, x = 0, y = 0, x0 = 0, y0 = 0, c = { cx: 278, cy: 708, r: 96 }, busy = false;
    /* До старта (и из каталога) карта больше экрана: «Я», путь к старту и бледный маршрут прогулки,
       её можно прокручивать и зумить (19.11). Экран сначала стоит на (195, 278) — там весь путь */
    let MW = 390, MH = 844, ZMIN = 1, X0 = 0, Y0 = 0;
    const legend = node.querySelector('.mf-legend');
    const LEG_WALK = legend.innerHTML;
    const LEG_START = '<span><i style="background:#282828"></i>К старту</span><span><i style="background:#F2CF4AD9"></i>Маршрут</span><span><svg width="10" height="12" viewBox="0 0 10 12" style="vertical-align:-1px;margin-right:6px"><path d="M5 .8C2.6.8.8 2.6.8 4.9c0 1.7.7 2.9 2 4.5L5 11.2l2.2-1.8c1.3-1.6 2-2.8 2-4.5C9.2 2.6 7.4.8 5 .8Z" fill="#282828"/></svg>Вы здесь</span>';
    const apply = () => { x = clamp(x, 390 - MW * z, 0); y = clamp(y, 844 - MH * z, 0); pan.style.transform = `translate(${x}px, ${y}px) scale(${z})`; };
    const zoomAt = (nz, sx, sy) => { nz = clamp(nz, ZMIN, 3.2); x = sx - (sx - x) * nz / z; y = sy - (sy - y) * nz / z; z = nz; apply(); };
    let box = null;                                       // раскрыто из карточки маршрута в каталоге: растёт из её прямоугольника
    const clip = (r, k = 1) => `inset(${r.y * k}px ${(390 - r.x - r.w) * k}px ${(844 - r.y - r.h) * k}px ${r.x * k}px)`;
    function open(fromEl) {
      if (busy || node.classList.contains('on')) return;
      box = fromEl ? rectOf(fromEl) : null;
      const st = box ? null : window.Flow.state, m = W.map.state;
      const n = !st || st.kind === 'far' || st.kind === 'near' ? 0 : st.kind === 'to' || st.kind === 'road' ? st.n - 1 : st.kind === 'end' ? 16 : st.n;
      const ms = App.mapStyle, toStart = box || !st || st.kind === 'far' || st.kind === 'near';
      if (toStart) {
        img.src = `assets/map/overview-${st && st.kind === 'near' ? 'near' : 'far'}.svg`;
        MW = 780; MH = 1400; ZMIN = 844 / 1400; X0 = -195; Y0 = -278;
      } else {
        // 20.11 вся прогулка: обзор на каждую точку есть только в «Схеме»; Тушь и Старый план нарисованы для точек 0–3
        img.src = ms && ms.walk && n <= 3 ? `assets/map/styles/${ms.id}/overview-${n}.jpg` : `assets/map/overview-${Math.min(n, 16)}.svg`;
        MW = 390; MH = 844; ZMIN = 1; X0 = 0; Y0 = 0;
      }
      img.style.width = MW + 'px'; img.style.height = MH + 'px';
      legend.innerHTML = toStart ? LEG_START : LEG_WALK;
      // на тёмной линогравюре маршрут впереди жёлтый — легенда и статус-строка под неё
      const ah = node.querySelector('.mf-ahead'); if (ah) ah.style.background = ms && ms.walk && !ms.dark ? '#282828' : '#F2CF4AD9';   // 20.11: в «Схеме» маршрут жёлтый
      App.statusLight('mapfull', !toStart && !!(ms && ms.walk && ms.dark));
      const left = st && st.kind === 'near' ? 630 : window.Maps.routes.toStart.len, kmt = m => (m / 1000).toFixed(1).replace('.', ',') + ' км';
      sub.textContent = toStart ? `До старта ${kmt(left)} · маршрут ${D.walk.km} км, ${D.walk.pts}` : `${D.walk.km} км · ${D.walk.pts} · ${n ? `вы на точке ${n}` : 'прогулка ещё не началась'}`;
      z = 1; x = X0; y = Y0; apply();
      node.classList.add('on'); mark('map', true, close); busy = true;
      if (box) { node.animate([{ clipPath: clip(box) }, { clipPath: clip(box, 0) }], { duration: 520, easing: SHEET }).onfinish = () => { busy = false; }; setTimeout(() => { busy = false; }, 800); return; }
      c = { cx: m.bx + m.size / 2, cy: m.by + m.size / 2, r: m.size / 2 };
      node.animate([{ clipPath: `circle(${c.r}px at ${c.cx}px ${c.cy}px)` }, { clipPath: `circle(1000px at ${c.cx}px ${c.cy}px)` }], { duration: 620, easing: 'cubic-bezier(.4,0,.1,1)' }).onfinish = () => { busy = false; }; setTimeout(() => { busy = false; }, 900);
    }
    function close(instant) {
      if ((busy && instant !== true) || !node.classList.contains('on')) return;
      const done = () => { node.classList.remove('on'); pan.style.transition = ''; busy = false; mark('map', false); App.statusLight('mapfull', false); };
      if (instant === true) return done();
      busy = true;
      pan.style.transition = 'transform .3s ease'; z = 1; x = X0; y = Y0; apply();
      if (box) { node.animate([{ clipPath: clip(box, 0) }, { clipPath: clip(box) }], { duration: 420, easing: SHEET }).onfinish = done; setTimeout(() => node.classList.contains('on') && busy && done(), 700); return; }
      node.animate([{ clipPath: `circle(1000px at ${c.cx}px ${c.cy}px)` }, { clipPath: `circle(${c.r}px at ${c.cx}px ${c.cy}px)` }], { duration: 480, easing: 'cubic-bezier(.4,0,.1,1)' }).onfinish = done; setTimeout(() => node.classList.contains('on') && busy && done(), 800);
    }
    node.querySelector('.mf-x').addEventListener('click', () => close(false));
    App.drag(pan, { grab() { x0 = x; y0 = y; }, move(dx, dy) { x = x0 + dx; y = y0 + dy; apply(); } });
    // щипок на тачпаде (ctrl + колесо) — зум; два пальца — прокрутка
    node.addEventListener('wheel', e => {
      e.preventDefault(); const p = App.toScreen(e.clientX, e.clientY);
      if (e.ctrlKey) zoomAt(z * Math.exp(-e.deltaY * 0.01), p.x, p.y);
      else { x -= e.deltaX / App.scale; y -= e.deltaY / App.scale; apply(); }
    }, { passive: false });
    node.addEventListener('dblclick', e => { const p = App.toScreen(e.clientX, e.clientY); pan.style.transition = `transform .35s ${SHEET}`; zoomAt(z > 1.4 ? 1 : 2.2, p.x, p.y); setTimeout(() => { pan.style.transition = ''; }, 360); });
    let gz = 1;
    node.addEventListener('gesturestart', e => { e.preventDefault(); gz = z; });
    node.addEventListener('gesturechange', e => { e.preventDefault(); const p = App.toScreen(e.clientX, e.clientY); zoomAt(gz * e.scale, p.x, p.y); });
    return { open, close };
  })();
  App.on('map:open', () => MapFull.open());
  App.mapFrom = n => MapFull.open(n);

  // ================================================================ шторки
  function Sheet(name, node, o = {}) {
    const wrap = el('<div class="sheet-wrap"><div class="sheet-dim"></div></div>');
    wrap.append(node); app.append(wrap);
    const S = {
      open() { if (S.isOpen()) return; o.onOpen && o.onOpen(); wrap.classList.add('on'); mark(name, true, () => S.close('dismiss')); },
      close(why) { if (!S.isOpen()) return; wrap.classList.remove('on'); node.style.transform = ''; mark(name, false); o.onClose && o.onClose(why); },
      isOpen: () => wrap.classList.contains('on')
    };
    wrap.firstChild.addEventListener('click', () => S.close('dismiss'));
    App.drag(node, {
      axis: 'y', accept: (dx, dy) => dy > 0 && (!o.accept || o.accept()),   // o.accept: шторка с прокруткой тянется вниз только от верха
      grab() { node.classList.add('drag'); },
      move(dx, dy) { node.style.transform = `translateY(${Math.max(0, dy)}px)`; },
      end(dx, dy, vx, vy) { node.classList.remove('drag'); node.style.transform = ''; if (dy > 110 || vy > 700) S.close('dismiss'); }
    });
    return S;
  }
  const GRAB = '<div class="sheet-grab"><i></i></div>';
  App.Sheet = Sheet; App.GRAB = GRAB;

  // «Как добраться»
  const routesNode = el(`<div class="sheet sh-routes">${GRAB}<h2>Как добраться до старта</h2>${D.routes.map(g => `<div class="rt-group"><h3>${g.head}</h3>${g.items.map(i =>
    `<div class="rt-row"><img src="assets/icons/${i.icon}" alt=""><div class="rt-t"><b>${i.name}</b><span>${i.sub}</span></div><button class="tap ${i.act === 'Установить' ? 'get' : ''}" data-app="${i.name}" data-act="${i.act}">${i.act}</button></div>`).join('')}</div>`).join('')}</div>`);
  const Routes = Sheet('routes', routesNode);
  routesNode.addEventListener('click', e => { const b = e.target.closest('button'); if (b) App.toast(b.dataset.act === 'Открыть' ? `Откроется ${b.dataset.app}` : `Откроется App Store: ${b.dataset.app}`); });
  App.on('ui:routes', () => Routes.open());

  // «Пауза в прогулке»: ничего не теряется, поэтому без красного
  const pauseNode = el(`<div class="sheet sh-pause">${GRAB}<div class="sh-head"><h2>Пауза</h2><div class="sh-sub"></div></div>
    <div class="sh-btns"><button class="b-main tap soft" data-a="go">${ICON.play14('#FFFCF5')}<span>Продолжить</span></button>
    <button class="b-soft tap soft" data-a="exit">Выйти и продолжить позже</button><button class="tap soft" data-a="end">Завершить прогулку</button></div></div>`);
  let wasPlaying = false;
  const Pause = Sheet('pause', pauseNode, {
    onOpen() {
      const st = window.Flow.state;
      wasPlaying = A.playing; A.pause();
      pauseNode.querySelector('.sh-sub').textContent = `Точка ${st.n} из ${D.walk.count}${st.kind === 'story' || st.kind === 'road' ? ' · ' + App.fmt(A.time()) : ''} · место сохранено`;
    },
    onClose(why) { if (why === 'dismiss' && wasPlaying) A.play(); }
  });
  pauseNode.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'go') Pause.close('dismiss');
    else if (a === 'exit') { Pause.close('exit'); Home.show(); }
    else { Pause.close('end'); leaveWalk(); }
  });
  const leaveWalk = () => { if (window.Catalog && window.Catalog.show) window.Catalog.show(); else window.Flow.go({ kind: 'far' }); };
  App.on('ui:x', () => {
    const st = window.Flow.state; if (!st) return;
    if (st.kind === 'far' || st.kind === 'near' || (st.kind === 'site' && st.n === 1)) leaveWalk(); else Pause.open();
  });

  // ================================================================ плеер на весь экран + точки прогулки
  const Player = (() => {
    const node = el(`<div class="player">
      <div class="pl-hero"><img alt=""><img alt="" class="out"></div>
      <button class="w-btn pl-x tap" aria-label="Свернуть"><svg width="18" height="18" viewBox="0 0 18 18"><path d="M4 7L9 12L14 7" fill="none" stroke="#282828" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <div class="pl-chip"></div><div class="pl-name"><b></b><span></span></div>
      <div class="pl-bar"></div><div class="pl-times"><span>0:00</span><span>0:00</span></div>
      <div class="pl-ctl"><button class="tap pl-prev" aria-label="Назад">${ICON.prev('#282828', 26, 24)}</button>
        <button class="tap pl-play" aria-label="Пауза">${ICON.pause('#FFFCF5', 26)}${ICON.play('#FFFCF5', 26)}</button>
        <button class="tap pl-next" aria-label="Дальше">${ICON.next('#282828', 26, 24)}</button></div>
      <div class="pl-list"><div class="pl-grab"><i></i></div><div class="pl-lhead"><b>${D.walk.title}</b><span>${D.walk.pts}</span></div><div class="pl-rows"></div></div>
    </div>`);
    app.append(node);
    const q = s => node.querySelector(s);
    const hero = q('.pl-hero'), imgs = [...hero.querySelectorAll('img')], bar = q('.pl-bar'), list = q('.pl-list'), rows = q('.pl-rows');
    let heroI = 0, heroSrc = '', sel = 0, segKey = '';
    const now = () => (A.key && /^p\d+$/.test(A.key) ? +A.key.slice(1) : 0);
    const here = () => { const st = window.Flow.state; return !st || !st.n ? 0 : st.kind === 'to' || st.kind === 'road' ? st.n - 1 : st.n; };
    // «История в дорогу» играет — n точки, к которой идём
    const road = () => { const st = window.Flow.state; return st && st.kind === 'road' && D.roads[st.n] && A.key === D.roads[st.n].key ? st.n : 0; };

    rows.innerHTML = D.points.map(p => `<div class="pl-row tap soft" data-n="${p.n}">
      <div class="pl-th" ${p.thumb ? `style="background-image:url('${p.thumb}')"` : ''}>${p.thumb ? '' : p.n}<div class="bars"><i></i><i></i><i></i></div></div>
      <div class="pl-t"><b>${p.n}. ${p.name}</b><span></span></div><div class="pl-d"></div><div class="pl-here">Вы здесь</div>
      <div class="pl-acts"><button class="a-lead tap" data-nodrag aria-label="Вести сюда"><svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 1.5L15.5 16L9 12.6L2.5 16Z" fill="#282828" stroke="#282828" stroke-width="1.2" stroke-linejoin="round"/></svg></button>
      <button class="a-play tap" data-nodrag aria-label="Слушать здесь">${ICON.play('#FFFCF5', 16)}</button></div></div>`).join('');

    function setHero(src) {
      if (src === heroSrc) return; heroSrc = src;
      heroI = 1 - heroI; imgs[heroI].src = src; imgs[heroI].classList.remove('out'); imgs[1 - heroI].classList.add('out');
    }
    function refresh() {
      const n = now(), h = here(), p = n ? D.point(n) : null, rn = road();
      node.classList.toggle('playing', A.playing);
      if (rn) {
        setHero(D.galleries['road' + rn][0].src); q('.pl-chip').textContent = 'В дорогу';
        q('.pl-name b').textContent = 'История в дорогу';
        q('.pl-name span').textContent = `По пути к точке ${rn}${A.parts.length > 1 ? ` · часть ${A.idx + 1} из ${A.parts.length}` : ''}`;
        const k = A.key + ':' + A.parts.length;
        if (k !== segKey) { segKey = k; bar.innerHTML = A.parts.map(x => `<i style="flex:${x.dur} 1 0"><b></b></i>`).join(''); }
      }
      if (p) {
        const g = D.galleries[window.Flow.gal('then', n)], s = W.gallery.key === 'story' + n ? g[W.gallery.index] : g[0];
        setHero(s.src); q('.pl-chip').textContent = s.chip;
        q('.pl-name b').textContent = p.audioTitle;
        q('.pl-name span').textContent = `${p.n}. ${p.name}${A.parts.length > 1 ? ` · часть ${A.idx + 1} из ${A.parts.length}` : ''}`;
        const k = A.key + ':' + A.parts.length;
        if (k !== segKey) { segKey = k; bar.innerHTML = A.parts.map(x => `<i style="flex:${x.dur} 1 0"><b></b></i>`).join(''); }
      }
      let acc = 0;
      [...rows.children].forEach(r => {
        const m = +r.dataset.n, pt = D.point(m);
        if (m > h) acc += pt.step;
        r.classList.toggle('now', m === n); r.classList.toggle('sel', m === sel);
        r.querySelector('.pl-here').style.display = m === h ? '' : 'none';
        r.querySelector('.pl-d').textContent = m > h ? window.Flow.km(acc) : '';
        r.querySelector('.pl-d').style.display = m === h ? 'none' : '';
        r.querySelector('.pl-t span').textContent = m === sel && m > h ? `${App.fmt(pt.total)} · ${window.Flow.km(acc)}` : pt.meta;
      });
      tick();
    }
    function tick() {
      if (!node.classList.contains('on')) return;
      const t = A.time(), d = A.dur() || 1;
      [...bar.children].forEach((s, i) => { s.firstChild.style.width = (i < A.idx ? 100 : i === A.idx ? clamp(t / d * 100, 0, 100) : 0) + '%'; });
      const sp = q('.pl-times').children; sp[0].textContent = App.fmt(t); sp[1].textContent = App.fmt(A.dur());
    }
    function open() {
      if (node.classList.contains('on')) return;
      const st = window.Flow.state;
      if (!now() && !road() && st && st.n) A.load(D.point(here() || st.n).audio);
      sel = 0; list.classList.remove('up'); rows.scrollTop = 0;
      refresh();
      node.classList.add('on'); W.el.classList.add('back'); mark('player', true, close); App.statusLight('player', true);
    }
    function close() {
      if (!node.classList.contains('on')) return;
      node.classList.remove('on'); node.style.transform = ''; W.el.classList.remove('back'); mark('player', false); App.statusLight('player', false);
    }
    q('.pl-x').addEventListener('click', close);
    q('.pl-prev').addEventListener('click', () => A.prev());
    q('.pl-next').addEventListener('click', () => A.next());
    q('.pl-play').addEventListener('click', () => {
      const st = window.Flow.state;
      // если рассказ уже доигран или ещё не начат — включаем рассказ этой точки как шаг сценария
      if (!A.playing && st && st.kind !== 'story' && st.kind !== 'road' && now()) return window.Flow.listen(now());
      A.toggle();
    });
    // перемотка: тянуть по полоске, части — отдельные отрезки
    const seekAt = e => {
      const r = bar.getBoundingClientRect(), total = A.total(), gaps = 4 * (A.parts.length - 1);
      let xx = clamp((e.clientX - r.left) / App.scale, 0, 358);
      for (let i = 0; i < A.parts.length; i++) {
        const w = (358 - gaps) * A.parts[i].dur / total;
        if (xx <= w + 2 || i === A.parts.length - 1) {
          const t = clamp(xx / w, 0, 1) * A.parts[i].dur;
          if (i !== A.idx) { const was = A.playing; A.loadPart(i, t); if (was) A.play(); } else A.seek(t);
          return;
        }
        xx -= w + 4;
      }
    };
    App.drag(bar, { grab() { bar.classList.add('scrub'); }, move(dx, dy, e) { seekAt(e); }, end() { bar.classList.remove('scrub'); }, tap: seekAt });
    // потянуть фото вниз — свернуть плеер
    App.drag(hero, { axis: 'y', accept: (dx, dy) => dy > 0, grab() { node.classList.add('drag'); }, move(dx, dy) { node.style.transform = `translateY(${Math.max(0, dy)}px)`; },
      end(dx, dy, vx, vy) { node.classList.remove('drag'); node.style.transform = ''; if (dy > 120 || vy > 700) close(); } });
    // список точек: потянуть вверх — все 16
    let top0 = 562;
    const setUp = up => { list.classList.toggle('up', up); list.style.top = ''; if (!up) rows.scrollTop = 0; };
    [q('.pl-grab'), q('.pl-lhead')].forEach(h => {
      App.drag(h, { axis: 'y', grab() { top0 = list.classList.contains('up') ? 116 : 562; list.classList.add('drag'); },
        move(dx, dy) { list.style.top = clamp(top0 + dy, 116, 562) + 'px'; },
        end(dx, dy, vx, vy) { list.classList.remove('drag'); setUp(vy < -300 || (vy < 300 && top0 + dy < 340)); },
        tap() { setUp(!list.classList.contains('up')); } });
    });
    list.addEventListener('wheel', e => {
      const up = list.classList.contains('up');
      if (!up && e.deltaY > 0) { e.preventDefault(); setUp(true); }
      else if (up && e.deltaY < 0 && rows.scrollTop <= 0) setUp(false);
    }, { passive: false });
    rows.addEventListener('click', e => {
      const r = e.target.closest('.pl-row'); if (!r) return;
      const n = +r.dataset.n;
      if (e.target.closest('.a-lead')) { close(); return window.Flow.leadTo(n); }
      if (e.target.closest('.a-play')) { sel = 0; return window.Flow.listen(n); }
      sel = sel === n ? 0 : n; App.tick(); refresh();
    });
    ['audio:state', 'audio:part', 'flow:state', 'gallery:change'].forEach(ev => App.on(ev, () => node.classList.contains('on') && refresh()));
    App.on('audio:time', tick);
    return { open, close };
  })();
  App.on('ui:pill', () => Player.open());
  App.on('tile:player', () => Player.open());

  // ================================================================ главная: «Продолжить»
  const Home = (() => {
    const node = el(`<div class="home"><div class="h-in">
      <div class="h-head"><b>Прогулки</b><div class="h-prof"><svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="6" r="3.2" fill="none" stroke="#282828" stroke-width="1.6"/><path d="M3 16c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5" fill="none" stroke="#282828" stroke-width="1.6" stroke-linecap="round"/></svg></div></div>
      <div class="h-card"><div class="h-top"><img alt=""><div><i>Продолжить</i><b>${D.walk.title}</b><span></span></div></div>
        <div class="h-segs">${D.points.map(() => '<i></i>').join('')}</div>
        <button class="h-go tap soft">${ICON.play14('#FFFCF5')}<span></span></button></div>
      <div class="h-more"><b>Ещё в Тель-Авиве</b><div class="h-ph"></div><div class="h-l1"></div><div class="h-l2"></div></div>
    </div></div>`);
    app.append(node);
    let saved = null;
    function show() {
      const st = window.Flow.state, p = D.point(st.n);
      saved = { st: { ...st }, part: A.idx, t: A.time() };
      node.querySelector('.h-top img').src = D.galleries[window.Flow.gal('then', st.n)][0].src;
      node.querySelector('.h-top span').textContent = `Точка ${st.n} из ${D.walk.count} · ${p.name}`;
      [...node.querySelectorAll('.h-segs i')].forEach((s, i) => s.classList.toggle('on', i < st.n));
      node.querySelector('.h-go span').textContent = st.kind === 'story' || st.kind === 'road' ? `Продолжить с ${App.fmt(saved.t)}` : 'Продолжить';
      node.classList.add('on'); W.el.classList.add('gone'); mark('home', true, back);
      App.hud('home');
    }
    function back() {
      if (!node.classList.contains('on')) return;
      node.classList.remove('on'); W.el.classList.remove('gone'); mark('home', false);
      if (saved.st.kind === 'story' || saved.st.kind === 'road') window.Flow.resume(saved.st.n, saved.part, saved.t, saved.st.kind); else window.Flow.go(saved.st);
    }
    node.querySelector('.h-go').addEventListener('click', back);
    return { show, back };
  })();

  window.Overlays = { Viewer, MapFull, Routes, Pause, Player, Home };
})();
