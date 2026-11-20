/* Живой кружок-карта. Тот же стиль S1, что на статичных кружках в Paper (tools/minimap/arrows/style-drop.json):
   капля смотрит вперёд, карта крутится под ней, N и море ездят по ободку, жёлтая дуга показывает на точку,
   точка за краем садится на ободок, зона — жёлтая заливка без обводки, пунктира нет.
   «Земля» — два слоя из protomap.py (север вверху, метры от точки 1); всё остальное рисуется здесь. */
(() => {
  const MD = window.MAPDATA, C = MD.colors;
  const { el, clamp, lerp } = App;
  const NS = 'http://www.w3.org/2000/svg';
  const DROP_D = 'M131.37,22.87c-62.85,0-113.64,46.02-113.64,108.87,0,44.05,16.56,73.24,51.07,115.61l62.57,68.75,62.29-68.75c34.51-42.65,51.35-71.55,51.35-115.61,0-62.85-51.07-108.87-113.64-108.87Z';
  const DROP_T = 'rotate(180) scale(0.19) translate(-131.37 -148)';
  const rad = d => d * Math.PI / 180;
  const norm180 = a => ((a + 180) % 360 + 360) % 360 - 180;
  const bearing = (ax, ay, bx, by) => (Math.atan2(bx - ax, by - ay) * 180 / Math.PI + 360) % 360;   // 0 = север, по часовой

  // ---- ломаная в метрах: длина, точка на расстоянии s от начала, направление
  function Route(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const len = cum[cum.length - 1];
    const at = s => {
      s = clamp(s, 0, len);
      let i = 1;
      while (i < pts.length - 1 && cum[i] < s) i++;
      const seg = cum[i] - cum[i - 1] || 1, t = (s - cum[i - 1]) / seg;
      return { x: lerp(pts[i - 1][0], pts[i][0], t), y: lerp(pts[i - 1][1], pts[i][1], t), i,
               h: bearing(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) };
    };
    /* Ближайший заметный поворот впереди: { dist, side: 'right' | 'left' } или null, если дальше прямо. */
    const nextTurn = s => {
      const a = at(s);
      for (let i = a.i; i < pts.length - 1; i++) {
        // направление «до» и «после» берём на 12 м от угла, чтобы мелкие изломы улицы не считались поворотом
        const before = at(Math.max(cum[i] - 12, s)), after = at(Math.min(cum[i] + 12, len));
        const h0 = bearing(before.x, before.y, pts[i][0], pts[i][1]), h1 = bearing(pts[i][0], pts[i][1], after.x, after.y);
        const d = norm180(h1 - h0);
        if (Math.abs(d) > 38 && cum[i] - s > 4) return { dist: cum[i] - s, side: d > 0 ? 'right' : 'left' };
      }
      return null;
    };
    return { pts, cum, len, at, nextTurn };
  }

  const mk = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const a in attrs) e.setAttribute(a, attrs[a]); return e; };

  function MiniMap(host) {
    host.classList.add('mm');
    host.innerHTML = `
      <div class="mm-clip">
        <div class="mm-world">
          <div class="mm-layer far"><img src="${MD.layers.far.src}" width="${MD.layers.far.w}" height="${MD.layers.far.h}" alt=""></div>
          <div class="mm-layer near"><img src="${MD.layers.near.src}" width="${MD.layers.near.w}" height="${MD.layers.near.h}" alt=""></div>
          <svg class="mm-vec" width="1" height="1"><circle class="mm-zone" r="20"></circle><g class="mm-ripples"></g>
            <path class="mm-later"></path><path class="mm-route-c"></path><path class="mm-route"></path></svg>
          <div class="mm-labels"></div>
          <div class="mm-badges"></div>
        </div>
        <div class="mm-aim"></div>
        <div class="mm-glow"></div>
      </div>
      <svg class="mm-ring"><circle class="mm-ring-c"></circle><g class="mm-ticks"></g><path class="mm-arc"></path></svg>
      <div class="mm-disc mm-n">N</div>
      <div class="mm-disc mm-sea"><svg width="14" height="10" viewBox="0 0 14 10"><path d="M1 3c1.5-1.6 3-1.6 4.5 0s3 1.6 4.5 0 2-1.2 3-.4M1 7.4c1.5-1.6 3-1.6 4.5 0s3 1.6 4.5 0 2-1.2 3-.4" fill="none" stroke="${C.sea_icon}" stroke-width="1.5" stroke-linecap="round"/></svg></div>
      <div class="mm-disc mm-tgt"></div>
      <div class="mm-drop"><svg width="80" height="80" viewBox="-40 -40 80 80"><g class="mm-drop-g"><g transform="scale(0.83 0.92)">
        <path d="${DROP_D}" transform="${DROP_T}" fill="${C.outline}" stroke="${C.outline}" stroke-width="26" stroke-linejoin="round"/>
        <path d="${DROP_D}" transform="${DROP_T}" fill="${C.you}"/></g></g></svg></div>`;
    const q = s => host.querySelector(s);
    const world = q('.mm-world'), clip = q('.mm-clip'), ring = q('.mm-ring'), ringC = q('.mm-ring-c'), ticks = q('.mm-ticks'), arc = q('.mm-arc');
    const dN = q('.mm-n'), dSea = q('.mm-sea'), dTgt = q('.mm-tgt'), drop = q('.mm-drop-g'), glow = q('.mm-glow'), aim = q('.mm-aim');
    const zone = q('.mm-zone'), ripples = q('.mm-ripples'), pRoute = q('.mm-route'), pRouteC = q('.mm-route-c'), pLater = q('.mm-later');
    const labelsEl = q('.mm-labels'), badgesEl = q('.mm-badges'), nearLayer = q('.mm-layer.near');
    /* Стиль карты (19.11): у стилей с walk есть свои слои кружка — та же рисовка, что в каталоге.
       Остальные стили кружок пока показывает обычным. */
    function setStyle(st) {
      const own = st && st.walk;
      ['far', 'near'].forEach(name => { q(`.mm-layer.${name} img`).src = own ? `assets/map/styles/${st.id}/${name}.jpg` : MD.layers[name].src; });
      host.classList.toggle('dark', !!(own && st.dark));
    }

    ['far', 'near'].forEach(name => {
      const L = MD.layers[name], n = q('.mm-layer.' + name);
      n.style.cssText = `left:${L.x0}px;top:${-L.y1}px;width:${L.w}px;height:${L.h}px;transform:scale(${1 / L.ppm})`;
    });
    // 12 меток как на часах; на севере метки нет — там сидит N
    for (let d = 30; d < 360; d += 30) ticks.append(mk('line', { 'data-d': d, class: d % 90 === 0 ? 'card' : '' }));
    const labels = [];
    ['far', 'near'].forEach(level => MD.labels[level].forEach(l => {
      const n = el(`<div class="mm-label ${level}">${l.t}</div>`);
      labelsEl.append(n); labels.push(Object.assign({ n, level }, l));
    }));
    [22, 12, 4].forEach((r, i) => ripples.append(mk('circle', { r, class: 'rp', style: `opacity:${[0.3, 0.5, 0.8][i]}` })));

    /* Состояние. x, y — где человек (метры); h — куда смотрит; r — сколько метров видно до края;
       size — диаметр кружка в px; bx, by — левый верхний угол кружка на экране.
       target — { x, y, label } или null; zone — показывать зону точки; inZone — человек в зоне (капля в жёлтом);
       route — { r: Route, s: пройдено } путь от человека к точке; later — Route дальнейшего пути (бледный);
       points — другие точки: { x, y, label, state: 'later' | 'done' }. */
    const S = { x: 0, y: 0, h: 0, r: 180, size: 192, bx: 182, by: 612, target: null, zone: false, inZone: false,
                route: null, later: null, points: [], ripple: false };
    let badgeEls = [], badgeKey = '';

    function badge(b) { return el(`<div class="mm-badge ${b.state || ''}">${b.label}</div>`); }

    function render() {
      const R = S.size / 2, ppm = R / S.r, big = clamp((S.size - 192) / 128, 0, 1);
      const ringW = lerp(8, 10, big), discR = lerp(10, 12, big), rr = R - ringW / 2;
      host.style.left = S.bx + 'px'; host.style.top = S.by + 'px'; host.style.width = host.style.height = S.size + 'px';
      world.style.transform = `rotate(${-S.h}deg) scale(${ppm}) translate(${-S.x}px, ${S.y}px)`;
      // крупный слой — только когда весь кружок помещается в нём и масштаб уже крупный
      const fits = Math.abs(S.x) + S.r < 186 && Math.abs(S.y) + S.r < 186;
      nearLayer.style.opacity = fits ? 1 : 0;
      const zoomIn = ppm >= 1;

      // ободок, метки, дуга
      ring.setAttribute('width', S.size); ring.setAttribute('height', S.size); host.style.setProperty('--rw', ringW + 'px');
      ringC.setAttribute('cx', R); ringC.setAttribute('cy', R); ringC.setAttribute('r', rr); ringC.style.strokeWidth = ringW;
      ticks.setAttribute('transform', `rotate(${-S.h} ${R} ${R})`);
      [...ticks.children].forEach(t => {
        const a = rad(+t.dataset.d), card = t.classList.contains('card'), r1 = R - 1.4, r0 = r1 - (card ? 5 : 3.6);
        t.setAttribute('x1', R + r0 * Math.sin(a)); t.setAttribute('y1', R - r0 * Math.cos(a));
        t.setAttribute('x2', R + r1 * Math.sin(a)); t.setAttribute('y2', R - r1 * Math.cos(a));
      });
      const onRim = (deg, node, size) => {
        const a = rad(deg);
        node.style.width = node.style.height = size * 2 + 'px';
        node.style.transform = `translate(${R + rr * Math.sin(a) - size}px, ${R - rr * Math.cos(a) - size}px)`;
      };
      onRim(-S.h, dN, discR); dN.style.fontSize = lerp(10.5, 12.5, big) + 'px';
      onRim(270 - S.h, dSea, discR);

      // точка: в поле зрения — метка на карте, за краем — на ободке; дуга всегда в её сторону
      const T = S.target;
      let showRim = false, showArc = false;
      if (T && !S.inZone) {
        const d = Math.hypot(T.x - S.x, T.y - S.y), b = bearing(S.x, S.y, T.x, T.y) - S.h;
        showArc = d > 1;
        showRim = d * ppm > rr - discR * 1.2 - 2;
        if (showArc) {
          const a0 = rad(b - 15), a1 = rad(b + 15);
          arc.setAttribute('d', `M${R + rr * Math.sin(a0)} ${R - rr * Math.cos(a0)}A${rr} ${rr} 0 0 1 ${R + rr * Math.sin(a1)} ${R - rr * Math.cos(a1)}`);
          arc.style.strokeWidth = ringW;
          aim.style.transform = `translate(${R + rr * Math.sin(rad(b)) - 60}px, ${R - rr * Math.cos(rad(b)) - 60}px)`;
        }
        if (showRim) { onRim(b, dTgt, discR * 1.2); dTgt.textContent = T.label; dTgt.style.fontSize = lerp(12.6, 14.5, big) + 'px'; }
      }
      arc.style.opacity = showArc ? 1 : 0; aim.style.opacity = showArc ? .55 : 0;
      dTgt.style.opacity = showRim ? 1 : 0;

      // метки на карте: держат размер и стоят ровно, как бы карта ни крутилась
      const list = [];
      if (T && !S.inZone && !showRim) list.push({ x: T.x, y: T.y, label: T.label, state: 'target' });
      S.points.forEach(p => list.push(p));
      const key = list.map(b => b.label + (b.state || '')).join('|');
      if (key !== badgeKey) { badgeKey = key; badgesEl.innerHTML = ''; badgeEls = list.map(b => { const n = badge(b); badgesEl.append(n); return n; }); }
      list.forEach((b, i) => { badgeEls[i].style.transform = `translate(${b.x}px, ${-b.y}px) scale(${1 / ppm}) rotate(${S.h}deg) translate(-50%, -50%)`; });

      // зона точки и круги от неё
      if (T) { zone.setAttribute('cx', T.x); zone.setAttribute('cy', -T.y); ripples.setAttribute('transform', `translate(${T.x} ${-T.y}) scale(${1 / ppm})`); }
      zone.style.opacity = T && S.zone ? (S.inZone ? .6 : .22) : 0;
      ripples.style.opacity = T && S.ripple && !S.inZone ? 1 : 0;
      glow.style.opacity = S.inZone ? 1 : 0;

      // путь: от носа капли вперёд по оставшейся части маршрута
      if (S.route && !S.inZone) {
        const a = S.route.r.at(S.route.s), pts = S.route.r.pts;
        let d = `M${S.x} ${-S.y}`;
        for (let i = a.i; i < pts.length; i++) d += `L${pts[i][0]} ${-pts[i][1]}`;
        pRoute.setAttribute('d', d); pRouteC.setAttribute('d', d);
        // толщина в метрах карты: слой уменьшен в ppm раз, поэтому делим, чтобы на экране вышли те же пиксели
        const w = lerp(4.5, 6, big);
        pRoute.style.strokeWidth = w / ppm; pRouteC.style.strokeWidth = (w + lerp(3, 4, big)) / ppm;
        pRoute.style.opacity = pRouteC.style.opacity = 1;
      } else pRoute.style.opacity = pRouteC.style.opacity = 0;
      if (S.later) {
        pLater.setAttribute('d', 'M' + S.later.pts.map(p => `${p[0]} ${-p[1]}`).join('L'));
        pLater.style.strokeWidth = 2.5 / ppm; pLater.style.opacity = .3;
      } else pLater.style.opacity = 0;

      // подписи улиц: читаются слева направо при любом повороте карты, под каплей не показываются
      labels.forEach(l => {
        const on = (l.level === 'near') === zoomIn;
        if (!on) { l.n.style.opacity = 0; return; }
        const dx = (l.x - S.x) * ppm, dy = (l.y - S.y) * ppm, dist = Math.hypot(dx, dy);
        if (dist > R + 40 || dist < 30) { l.n.style.opacity = 0; return; }
        let rot = -l.a;
        if (Math.abs(norm180(rot - S.h)) > 90) rot += 180;
        l.n.style.opacity = 1;
        l.n.style.transform = `translate(${l.x}px, ${-l.y}px) scale(${1 / ppm}) rotate(${rot}deg) translate(-50%, -50%)`;
        l.n.style.fontSize = lerp(7.5, 8.5, big) + 'px';
      });

      drop.setAttribute('transform', `rotate(${S.face || 0}) scale(${lerp(0.612, 0.85, big)})`);   // face — куда смотрит человек, если карта стоит севером вверх
    }

    const api = {
      el: host, state: S,
      set(p) { Object.assign(S, p); render(); return api; },
      render, setStyle
    };
    render();
    if (App.mapStyle) setStyle(App.mapStyle);
    App.on('mapstyle', setStyle);
    return api;
  }

  window.Maps = { MiniMap, Route, bearing, norm180, routes: {} };
  Object.keys(MD.routes).forEach(k => { window.Maps.routes[k] = Route(MD.routes[k]); });
})();
