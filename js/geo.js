/* GPS и компас для теста на улице (телефон, 20.11).
   - До старта ведёт GPS: далеко (> 250 м) → рядом → «Вы на месте» у точки 1 (ближе 30 м).
     Пути до старта мы не знаем, поэтому в кружке нет линии: «1» на ободе показывает, куда идти,
     плитка слева говорит «прямо / направо / налево / обернитесь».
   - Точки 1–4 стоят в одном дворе в пределах 30 м — GPS их не различит. Между ними кнопка «Я на месте»
     (в скоупе так и записано: дальше — только по кнопке).
   - Компас крутит карту в кружке: человек поворачивается — поворачивается карта.
   - В Тель-Авиве — настоящая позиция. Не в Тель-Авиве (или с ?anchor) — 20.11 Андрей: «ставить нужную нам точку… в Тель-Авиве».
     Человек появляется в начале готового пути к старту (Maps.routes.toStart, ~1,4 км пешком — там же «Я» на большой карте)
     и дальше двигается своими шагами. Пока он на этом пути (ближе 60 м), в кружке линия по улицам до точки 1;
     сошёл с пути или в Тель-Авиве по-настоящему — прямая линия до точки 1 (пути по улицам от любого места у нас нет).
   - ?debug — строка с координатами, точностью, курсом и состоянием. */
(() => {
  if (!window.MOBILE) return;
  const { el, clamp } = App, W = App.walk, mm = W.map, M = window.Maps, A = App.audio, D = window.DATA, F = window.Flow;
  const O = [32.0633976, 34.7695211], KX = 111320 * Math.cos(O[0] * Math.PI / 180), KY = 110540;   // точка 1, как в protomap.py
  const NEAR = 250, BACK = 350, ZONE = 30;
  const TLV = { s: 32.03, n: 32.15, w: 34.74, e: 34.86 };                          // Тель-Авив–Яффо, с запасом
  const TO = M.routes.toStart;                                                       // путь к старту, метры от точки 1
  const q = location.search, DEBUG = /[?&]debug\b/.test(q);
  const FAR_BOX = window.MAPDATA.layers.far.box;

  let off = null, fix = null, heading = null, err = '', sim = false;
  const raw = (lat, lon) => [(lon - O[1]) * KX, (lat - O[0]) * KY];

  // ---- GPS
  function onPos(lat, lon, acc) {
    if (sim) return;
    const r = raw(lat, lon);
    if (!off) {
      const inTlv = lat > TLV.s && lat < TLV.n && lon > TLV.w && lon < TLV.e;
      if (!inTlv || /[?&]anchor\b/.test(q)) {
        const y = TO.pts[0];
        off = [r[0] - y[0], r[1] - y[1]];
        App.toast('Вы не в Тель-Авиве — для прототипа ставим вас в центр города');
      } else off = [0, 0];
    }
    fix = { x: r[0] - off[0], y: r[1] - off[1], acc, lat, lon, t: Date.now() };
    update();
  }
  function startGeo() {
    if (!navigator.geolocation) { err = 'нет геолокации'; return; }
    navigator.geolocation.watchPosition(p => { err = ''; onPos(p.coords.latitude, p.coords.longitude, p.coords.accuracy || 50); },
      e => { err = e.code === 1 ? 'геопозиция запрещена' : 'нет сигнала'; if (e.code === 1) App.toast('Геопозиция недоступна. Чтобы начать, нажмите «К прогулке»'); dbg(); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  }

  // ---- компас: iOS даёт курс в webkitCompassHeading (от севера по часовой)
  function onOrient(e) {
    let h = e.webkitCompassHeading;
    if (h == null && e.absolute && e.alpha != null) h = 360 - e.alpha;
    if (h == null || isNaN(h)) return;
    heading = (h + (screen.orientation && screen.orientation.angle || 0) + 360) % 360;
  }
  function startCompass() {
    const DO = window.DeviceOrientationEvent;
    // разрешение спрашивается сразу в нажатии, без await до вызова — иначе iOS откажет
    if (DO && typeof DO.requestPermission === 'function') {
      return DO.requestPermission().then(s => { if (s === 'granted') addEventListener('deviceorientation', onOrient); else App.toast('Компас выключен — карта не будет поворачиваться'); }).catch(() => {});
    }
    addEventListener('deviceorientationabsolute', onOrient);
    addEventListener('deviceorientation', onOrient);
  }

  // ---- состояние до старта: далеко / рядом / на месте
  const before = st => st && (st.kind === 'far' || st.kind === 'near');
  const hidden = () => (window.Catalog && window.Catalog.isOpen) || (App.overlayOpen && App.overlayOpen());
  function jump(st) { F.go(st); F.stop(); if (st.kind === 'site') mm.set(F.key(st)); else update(true); }
  /* Где человек на пути к старту: ближайшая точка линии. { s, dist } */
  function onPath(x, y) {
    let best = { s: 0, dist: Infinity };
    for (let i = 1; i < TO.pts.length; i++) {
      const [x1, y1] = TO.pts[i - 1], [x2, y2] = TO.pts[i], dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
      const t = clamp(((x - x1) * dx + (y - y1) * dy) / L2, 0, 1), d = Math.hypot(x - x1 - dx * t, y - y1 - dy * t);
      if (d < best.dist) best = { s: TO.cum[i - 1] + t * Math.sqrt(L2), dist: d };
    }
    return best;
  }
  function update(force) {
    const st = F.state;
    dbg();
    if (!fix || !before(st) || (window.Catalog && window.Catalog.isOpen)) return;
    const d = Math.hypot(fix.x, fix.y);
    if (d <= Math.max(ZONE, Math.min(fix.acc, 45))) return jump({ kind: 'site', n: 1 });
    if (st.kind === 'far' && d < NEAR) return jump({ kind: 'near' });
    if (st.kind === 'near' && d > BACK) return jump({ kind: 'far' });
    if (F.busy && !force) return;
    const m = 150;
    const cx = clamp(fix.x, FAR_BOX[0] + m, FAR_BOX[2] - m), cy = clamp(fix.y, FAR_BOX[1] + m, FAR_BOX[3] - m);
    const far = st.kind === 'far';
    // 20.11 Андрей: «нет линии маршрута до 1 точки» — по улицам, если человек на готовом пути, иначе по прямой
    const pp = onPath(fix.x, fix.y), along = pp.dist < 60;
    const route = along ? { r: TO, s: pp.s } : { r: M.Route([[fix.x, fix.y], [0, 0]]), s: 0 };
    const rem = along ? TO.len - pp.s : d;
    mm.set({ ...(far ? W.box.far : W.box.walk), x: cx, y: cy, r: far ? clamp(d * 1.15, 150, 650) : clamp(d * 0.5 + 34, 40, 180), route, later: null, points: [],
             target: { x: 0, y: 0, label: '1' }, zone: !far && d < 70, inZone: false, ripple: !far && d < 70 });
    W.title(far ? 'Ждём вас на старте' : 'Вы почти на месте', `${F.km(rem)} · ${F.mins(rem)}`);
    if (!far) {
      const to = M.bearing(fix.x, fix.y, 0, 0), rel = heading == null ? 0 : M.norm180(to - heading), a = Math.abs(rel);
      const icon = a < 35 ? 'ahead' : a > 145 ? 'uturn' : rel > 0 ? 'right' : 'left';
      W.tile.turn({ icon, big: F.km(d), sub: { ahead: 'прямо', uturn: 'обернитесь', right: 'направо', left: 'налево' }[icon] });
    }
  }
  App.on('flow:state', () => setTimeout(() => update(true), 0));

  // ---- карта поворачивается за телефоном (без компаса до старта — «1» наверху)
  (function spin() {
    requestAnimationFrame(spin);
    const st = F.state;
    if (!st || hidden() || F.busy || F.locked) return;
    let h = heading;
    if (h == null) { if (!before(st) || !fix) return; h = M.bearing(fix.x, fix.y, 0, 0); }
    const S = mm.state, dd = M.norm180(h - S.h);
    if (Math.abs(dd) > 0.3) mm.set({ h: S.h + dd * 0.15, face: 0 });
  })();

  // ---- экран не гаснет, пока открыто приложение
  let wl = null;
  const wake = async () => { try { if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (_) {} };
  document.addEventListener('visibilitychange', wake);

  // ---- плеер на заблокированном экране: название рассказа, пауза, части
  const ms = navigator.mediaSession;
  function meta() {
    if (!ms || !window.MediaMetadata || !A.key) return;
    const p = D.points.find(x => x.audio === A.key);
    const art = new URL((p && p.thumb) || D.walk.cover, location.href).href;
    ms.metadata = new MediaMetadata({ title: p ? `${p.n}. ${p.audioTitle}` : (window.AUDIODATA[A.key] || {}).name || 'Match',
      artist: `Рассказывает ${D.walk.guide}`, album: D.walk.title, artwork: [{ src: art, sizes: '512x512', type: 'image/jpeg' }] });
  }
  if (ms) {
    const on = (a, f) => { try { ms.setActionHandler(a, f); } catch (_) {} };
    on('play', () => A.play()); on('pause', () => A.pause());
    on('nexttrack', () => A.next()); on('previoustrack', () => A.prev());
    App.on('audio:part', meta);
    App.on('audio:state', p => { meta(); try { ms.playbackState = p ? 'playing' : 'paused'; } catch (_) {} });
  }

  // ---- щипок не должен увеличивать всю страницу
  document.addEventListener('gesturestart', e => e.preventDefault());

  // ---- первый экран: установить на «Домой» и дать разрешения
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const LOGO = '<svg class="g-logo" viewBox="0 0 346.5 247.7" aria-label="Match"><g fill="currentColor"><polygon points="91,70.4 79.8,247.7 100.3,247.7 104.9,160.9 92.2,70.4"/><path d="M241.1,49.5l-4,0.1l-3.7,82.5h31.3V75C264.7,57.9,258.7,49,241.1,49.5z"/><path d="M229.4,219.5h-4.6l7.7-169.8L220.8,50c-15.5,0.4-23.5,9.8-23.5,25.7l0,146.2c-0.2,14.4,7.5,25.7,23.5,25.7h20.3c16,0,23.5-8.4,23.5-23.6v-63l-32.6,0L229.4,219.5z"/><polygon points="0,0 0,49.9 138.9,46.1 159.6,247.7 191.6,247.7 191,44.7 346.5,40.5 346.5,0"/><polygon points="94.2,53.4 109.2,159 106.2,224.1 118.4,224.1 121.7,247.7 153.4,247.7 133.6,52.4"/><polygon points="271.3,48.6 271.7,247.7 299.7,247.7 308.2,47.7"/><polygon points="314.9,115.5 309.9,115.5 306.9,183.9 311.9,183.9 309.2,247.7 346.5,247.7 346.5,46.6 317.8,47.4"/><polygon points="0,111.8 0,247.7 31.8,247.7 34.4,195.9 1.3,111.8"/><polygon points="41.4,113.4 41.7,193.4 47.2,247.7 77.7,247.7 77.7,53.9 52.5,54.6"/><polygon points="0,56 0,96.5 36.4,189 37.1,189 37.1,113.4 18.7,55.5"/></g></svg>';
  const SHARE = '<svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true"><path d="M9 1v13M5 5l4-4 4 4M6 9H3.5A1.5 1.5 0 0 0 2 10.5v8A1.5 1.5 0 0 0 3.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 14.5 9H12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // где кнопка «Поделиться»: в Safari 26 она в меню «⋯» внизу справа, в Safari 18 — внизу по центру
  const sv = +((/Version\/(\d+)/.exec(navigator.userAgent) || [])[1] || 26);
  const v26 = sv >= 26;
  const DOTS = '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="6.5" cy="11" r="1.5" fill="currentColor"/><circle cx="11" cy="11" r="1.5" fill="currentColor"/><circle cx="15.5" cy="11" r="1.5" fill="currentColor"/></svg>';
  const ADD = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><rect x="1.5" y="1.5" width="17" height="17" rx="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 6v8M6 10h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const steps = (v26 ? [
    `Нажмите ${DOTS} внизу справа`,
    `Выберите «Поделиться» ${SHARE}`,
    `Пролистайте и выберите «На экран „Домой“» ${ADD}`,
    'Нажмите «Добавить»'
  ] : [
    `Нажмите «Поделиться» ${SHARE} внизу по центру`,
    `Пролистайте и выберите «На экран „Домой“» ${ADD}`,
    'Нажмите «Добавить» вверху справа'
  ]).map((t, i) => `<li><span>${i + 1}</span><em>${t}</em></li>`).join('');
  const gate = el(`<div id="gate">
    <div class="g-scroll"><div class="g-in">
      ${LOGO}
      <div class="g-step g-install"${standalone ? ' hidden' : ''}>
        <p class="g-kick">Прототип приложения</p>
        <h1>Добавьте Match на экран «Домой»</h1>
        <p>С&nbsp;экрана «Домой» прототип откроется на весь экран, как обычное приложение.</p>
        <ol>${steps}</ol>
        <div class="g-result">
          <figure><img src="assets/icon-180.png" alt=""><figcaption>Match</figcaption></figure>
          <p>Появится иконка Match. Открывайте прототип с&nbsp;неё.</p>
        </div>
        <button class="g-link" type="button">Продолжить в Safari</button>
      </div>
      <div class="g-step g-perm"${standalone ? '' : ' hidden'}>
        <p class="g-kick">Прототип приложения</p>
        <h1>Тель-Авив 100 лет назад</h1>
        <p class="g-sub">Тест на улице · 16 точек · 2,6 км</p>
        <ul>
          <li><b>Геопозиция</b> ведёт к старту — во двор со статуей Дрейфуса.</li>
          <li><b>Компас</b> поворачивает карту, когда поворачиваетесь вы.</li>
          <li>Точки стоят близко, GPS их не всегда различает. Дойдя до следующей, нажмите <b>«Я на месте»</b>.</li>
          <li>Дома тоже можно слушать: откройте плеер и выберите рассказ в списке точек.</li>
        </ul>
        <button class="g-go" type="button">Разрешить и начать</button>
        <p class="g-note">Если вы не в Тель-Авиве, прототип поставит вас в центр города, в 1,4 км пешком от старта.</p>
      </div>
    </div></div>
    <div class="g-arrow ${v26 ? 'is-right' : 'is-center'}"${standalone ? ' hidden' : ''} aria-hidden="true"><span>${v26 ? 'Кнопка «⋯»' : 'Кнопка «Поделиться»'}</span><svg width="24" height="28" viewBox="0 0 24 28"><path d="M12 2v22M3 15l9 9 9-9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
  </div>`);
  document.body.append(gate);
  gate.querySelector('.g-link').addEventListener('click', () => { gate.querySelector('.g-install').hidden = true; gate.querySelector('.g-arrow').hidden = true; gate.querySelector('.g-perm').hidden = false; });
  gate.querySelector('.g-go').addEventListener('click', () => {
    startCompass();                    // первым и без await: iOS разрешает только прямо в нажатии
    startGeo();
    App.unlockAudio();
    try { A.el.muted = true; const p = A.el.play(); if (p && p.catch) p.catch(() => {}); A.el.pause(); A.el.muted = false; } catch (_) {}
    wake();
    gate.classList.add('off'); setTimeout(() => gate.remove(), 500);
  });

  // ---- ?debug: что видит телефон
  let dbgEl = null;
  function dbg() {
    if (!DEBUG) return;
    if (!dbgEl) { dbgEl = el('<div id="geo-dbg"></div>'); document.body.append(dbgEl); dbgEl.addEventListener('click', simStep); }
    const st = F.state, d = fix ? Math.round(Math.hypot(fix.x, fix.y)) : '–';
    dbgEl.textContent = `${fix ? fix.lat.toFixed(5) + ', ' + fix.lon.toFixed(5) + ' ±' + Math.round(fix.acc) + ' м' : 'нет GPS'} · до 1: ${d} м · курс ${heading == null ? '–' : Math.round(heading)}° · ${st ? st.kind + (st.n || '') : '–'}${off && (off[0] || off[1]) ? ' · сдвиг' : ''}${err ? ' · ' + err : ''}`;
  }
  if (DEBUG) setInterval(dbg, 1000);
  /* Проверка на компьютере: нажатие на строку ?debug — «прошли» ещё часть пути к старту.
     Первое нажатие ставит человека в 600 м к северу, дальше каждый раз ближе: 600 → 330 → 180 → 100 → 55 → 30. */
  function simStep() {
    sim = true;
    const f = fix && fix.x != null ? { x: fix.x * 0.55, y: fix.y * 0.55 } : { x: 0, y: 600 };
    if (!fix) heading = heading == null ? 180 : heading;
    const lat = O[0] + f.y / KY, lon = O[1] + f.x / KX;
    off = [0, 0];
    fix = { x: f.x, y: f.y, acc: 8, lat, lon, t: Date.now() };
    update();
  }

  // для проверки без улицы: Geo.feed(32.0634, 34.7695, 8), Geo.heading(90)
  window.Geo = { feed: (lat, lon, acc = 8) => onPos(lat, lon, acc), heading: h => { heading = h; }, get fix() { return fix; }, reset() { off = null; fix = null; } };
})();
