/* Логотип Match на ножках. Риг и физика перенесены из match/motion/logo-walk.html (v31) без изменений
   в самой механике: знак — жёсткий блок, вся упругость в ножках, буквы только сдвигаются.
   Отличие: там сцена «запекалась» в бесшовный цикл, здесь актёр живёт в реальном времени,
   и его ведёт режиссёр (intro.js): actor.step(dt, команда). */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const G = 428.9;          // линия земли
  const CX = 313.85;        // центр знака по горизонтали
  const R_SC = 0.54;
  const R_WORD = `matrix(0 ${R_SC} ${-R_SC} 0 ${R_SC * 227.5} ${-R_SC * 596})`;
  const WORD_CY = R_SC * (596 - 313.85);
  const HALF_W = R_SC * 281.9, HALF_H = R_SC * 201.5;

  const SHAPES = {
    BAR:  '32,26 595.7,26 595.7,91.8 342.8,98.7 258,101 32,107.1',
    T:    '258,92 258,101 291.7,428.9 343.7,428.9 342.8,98.7 342.8,90',
    M_LL: '32,207.9 32,428.9 83.7,428.9 88,344.7 34,207.9',
    M_DG: '32,117.1 32,183 91.3,333.5 92.4,333.5 92.4,210.5 62.4,116.3',
    M_R:  '99.3,210.5 99.8,340.6 108.7,428.9 158.3,428.9 158.3,113.7 117.3,114.8',
    A_L:  '180,140.6 161.8,428.9 195.2,428.9 202.6,287.8 181.9,140.6',
    A_R:  '185.2,112.9 209.6,284.7 204.7,390.5 224.6,390.5 230,428.9 281.6,428.9 249.4,111.3',
    C_UR: 'M424.3,106.5l-6.5.2-6.1,134.3h50.9v-93c0-27.8-9.7-42.3-38.3-41.5Z',
    C_B:  'M405.2,383.2h-7.4l12.6-276.3-19.1.5c-25.2.7-38.3,16-38.3,41.8l.1,237.9c-.2,23.3,12.2,41.9,38.2,41.9h33c26,0,38.3-13.7,38.3-38.4v-102.6l-53,.1-4.4,95.1Z',
    H_L:  '473.4,105.1 474,428.9 519.6,428.9 533.3,103.5',
    H_R:  '544.3,213.9 536.1,213.9 531.3,325.2 539.5,325.2 535,428.9 595.7,428.9 595.7,101.8 549,103.1'
  };
  const PARTS = Object.keys(SHAPES);
  const PART_X = { BAR: 313.85, T: 300, M_LL: 60, M_DG: 62, M_R: 129, A_L: 182, A_R: 233,
                   C_UR: 437, C_B: 405, H_L: 503, H_R: 565 };
  const HF = PARTS.map(k => (596 - PART_X[k]) / 564);   // 0 у ножек, 1 на макушке
  const NP = PARTS.length;

  const fract = x => x - Math.floor(x);
  const easeInOut = u => 0.5 - 0.5 * Math.cos(Math.PI * u);
  const smooth = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mixColor = (a, b, t) => {
    const A = hexRgb(a), B = hexRgb(b);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
  };
  const f2 = n => n.toFixed(2);

  const EASE = {
    l: t => t, io: easeInOut, o: t => 1 - (1 - t) * (1 - t), i: t => t * t,
    ob: t => { const c = 1.7, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; }
  };
  function kf(t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1], [t1, v1, e = 'io'] = keys[i];
        return v0 + (v1 - v0) * EASE[e]((t - t0) / (t1 - t0));
      }
    }
    return keys[keys.length - 1][1];
  }

  const V = { T: 0.9, W: 38, stand: 84, hipDepth: 18, L0: 108, Lmax: 117, bowK: 0.55, bowMin: 4, bowMax: 24,
              S: 40, D: 0.3, H: 24, rise: 22, g: 0.3, toeUp: 16, heelUp: 28, restX: 15, shadow: 86,
              flipHop: 110, flipShadow: 150, flipDur: 1.3, flipAntic: 7, flipWobble: 3, flipBounce: 0.07,
              accelDur: 1.4, brakeDur: 0.9,
              leanCruise: 4, leanAccel: 7, leanBrake: 10, anticip: 5, nod: 7, leanFreq: 1.8, leanDamp: 0.32,
              springK: 0.7, springFreq: 2.6, springDamp: 0.3, springSpread: 0.3, springTop: 0.75 };

  function jogFoot(q, go, VV = V) {
    q = fract(q);
    const D = VV.D, S = VV.S * go;
    if (q < D) {
      const a = 0.05, b = 0.12;
      let phi = 0;
      if (q < a) phi = -VV.toeUp * (1 - smooth(q / a));
      else if (q > D - b) phi = VV.heelUp * smooth((q - (D - b)) / b);
      return { dx: S * (1 - 2 * q / D), h: 0, phi: phi * go, air: 0 };
    }
    const w = (q - D) / (1 - D);
    const ws = Math.pow(w, VV.sw || 1);
    const dx = w < 0.82 ? S * (-1 + 2.1 * easeInOut(Math.min(1, ws / 0.82))) : S * (1.1 - 0.1 * ((w - 0.82) / 0.18) ** 2);
    return { dx, h: VV.H * go * Math.sin(Math.PI * Math.pow(w, 0.85)),
             phi: (VV.heelUp - (VV.heelUp + VV.toeUp) * smooth(w)) * go,
             air: go * smooth(Math.min(w, 1 - w) / 0.2) };
  }

  const SPRING_N = 240;
  function bodyCurve(u, VV = V) {
    const dip = VV.rise * 4 * VV.g / (Math.PI * (1 - VV.g));
    if (u < VV.g) return dip * Math.sin(Math.PI * u / VV.g);
    const v = (u - VV.g) / (1 - VV.g);
    return -VV.rise * 4 * v * (1 - v);
  }
  const springTable = VV => VV._spring || (VV._spring = PARTS.map((k, i) => {
    const w = 2 * Math.PI * V.springFreq * (1 + V.springSpread * (((i * 7) % 11) / 10 - 0.5));
    const z = V.springDamp, sub = 8, dt = 1 / (SPRING_N * sub);
    let x = 0, vel = 0;
    const out = new Float32Array(SPRING_N);
    for (let per = 0; per < 10; per++) {
      for (let j = 0; j < SPRING_N; j++) {
        for (let q = 0; q < sub; q++) {
          const y = bodyCurve((j * sub + q) * dt, VV);
          vel += (-w * w * (x - y) - 2 * z * w * vel) * dt;
          x += vel * dt;
        }
        if (per === 9) out[j] = x - bodyCurve((j + 1) / SPRING_N % 1, VV);
      }
    }
    return out;
  }));
  function springParts(u, go, VV = V) {
    if (go <= 0) return null;
    const SPRING_T = springTable(VV);
    const j = u * SPRING_N, j0 = Math.floor(j) % SPRING_N, fr = j - Math.floor(j);
    return PARTS.map((k, i) => {
      const r = SPRING_T[i][j0] + (SPRING_T[i][(j0 + 1) % SPRING_N] - SPRING_T[i][j0]) * fr;
      return V.springK * (1 - V.springTop + V.springTop * HF[i]) * r * go;
    });
  }

  // Поворот между лежащим логотипом и стоящим словом: tip 0..1 ложится, 1..2 встаёт, 1 = лежит.
  const SOFT_E = 0.012, softAbs = x => Math.sqrt(x * x + SOFT_E * SOFT_E);
  function flipPose(P, tip) {
    const upPhase = tip > 1, u = upPhase ? Math.min(1, tip - 1) : Math.min(1, tip);
    const from = upPhase ? -90 : 0, to = upPhase ? 0 : -90;
    const dir = Math.sign(to - from), A = V.flipAntic;
    const t1 = 0.22, t2 = 0.68, dur = V.flipDur;
    const wd = 2 * Math.PI * 3, zeta = 0.35, wn = wd / Math.sqrt(1 - zeta * zeta);
    const vLand = V.flipWobble * wd;
    let a, h = 0;
    if (u < t1) a = from - dir * A * easeInOut(u / t1);
    else if (u < t2) {
      const w = (u - t1) / (t2 - t1), p0 = from - dir * A, m1 = dir * vLand * (t2 - t1) * dur;
      const w2 = w * w, w3 = w2 * w;
      a = (2 * w3 - 3 * w2 + 1) * p0 + (-2 * w3 + 3 * w2) * to + (w3 - w2) * m1;
      h = V.flipHop * Math.pow(Math.sin(Math.PI * w), 1.8);
    } else {
      const tau = (u - t2) * dur, w = (u - t2) / (1 - t2);
      a = to + dir * (vLand / wd) * Math.exp(-zeta * wn * tau) * Math.sin(wd * tau) * (1 - w) * (1 - w);
      const b = Math.min(1, w / 0.55);
      h = b < 1 ? V.flipHop * V.flipBounce * Math.pow(Math.sin(Math.PI * b), 2) : 0;
    }
    a += P.lean || 0;
    const th = (90 + a) * Math.PI / 180;
    const below = HALF_W * softAbs(Math.sin(th)) + HALF_H * softAbs(Math.cos(th)) - SOFT_E * HALF_H;
    const cy = G - below - h;
    const wide = 1 + (V.flipShadow / V.shadow - 1) * Math.cos(th) ** 2;
    const k = Math.min(1, h / 12) * (1 - 0.45 * Math.min(1, h / V.flipHop));
    return Object.assign(P, {
      body: `translate(${f2(CX)} ${f2(cy)}) rotate(${a.toFixed(3)}) translate(0 ${f2(WORD_CY)})`,
      clipY: G, clipH: 0, lean: 0, along: null, across: null,
      shadow: [CX, G + 3, V.shadow * wide * k, 5.5 * k], puffs: []
    });
  }

  const addParts = (a, b) => !a ? (b || null) : !b ? a : a.map((x, i) => x + b[i]);
  function pose(p, amp, tip, mot, act) {
    const VV = mot.gait || V, v = mot.v, lean = mot.lean + (act && act.lean || 0);
    const out = smooth(amp);
    const go = smooth((amp - 0.25) / 0.75) * v;
    const u = fract(2 * p);
    const dip = VV.rise * 4 * VV.g / (Math.PI * (1 - VV.g));
    let y;
    if (u < VV.g) y = dip * Math.sin(Math.PI * u / VV.g);
    else { const w = (u - VV.g) / (1 - VV.g); y = -VV.rise * 4 * w * (1 - w); }
    y *= go;
    const dy = act && act.dy || 0;
    const hb = Math.min(G, G - V.stand * out + y + dy);
    const hipY = hb - V.hipDepth;
    const L0 = V.hipDepth + (V.L0 - V.hipDepth) * out, Lmax = V.hipDepth + (V.Lmax - V.hipDepth) * out;
    const leg = (q, restX, a) => {
      const f = a ? { dx: a.x - restX, h: a.h || 0, phi: a.phi || 0, air: smooth((a.h || 0) / 12) } : jogFoot(q, go, VV);
      if (!a && VV.split && y < 0) f.dx *= 1 + VV.split * go * smooth(-y / VV.rise * 1.6);
      const half = V.W / 2;
      const fx0 = CX + f.dx + restX * (a ? 1 : 1 - go);
      const fy0 = G - f.h - half * Math.sin(Math.abs(f.phi) * Math.PI / 180);
      let fx = fx0, fy = fy0;
      let dx = fx - CX, dyy = fy - hipY, d = Math.hypot(dx, dyy);
      if (d > Lmax) { fx = CX + dx * Lmax / d; fy = hipY + dyy * Lmax / d; dx = fx - CX; dyy = fy - hipY; d = Lmax; }
      const ux = dx / d, uy = dyy / d;
      const fold = d < L0 ? V.bowK * Math.sqrt(L0 * L0 - d * d) / 2 * smooth((L0 - d) / 14) : 0;
      const bow = V.bowMax * Math.tanh(Math.hypot(fold, V.bowMin * out) / V.bowMax);
      const qx = CX + dx / 2 + uy * 2 * bow, qy = hipY + dyy / 2 - ux * 2 * bow;
      const tx = fx - qx, ty = fy - qy, tl = Math.hypot(tx, ty) || 1;
      const square = Math.atan2(ty, tx) * 180 / Math.PI - 90;
      const air = Math.max(f.air, smooth((fy0 - fy - 2) / 10));
      const sole = f.phi + (square - f.phi) * air;
      return {
        d: `M${f2(CX)},${f2(hipY)} Q${f2(qx)},${f2(qy)} ${f2(fx)},${f2(fy)} L${f2(fx + tx / tl * V.W)},${f2(fy + ty / tl * V.W)}`,
        sole: [fx, fy, sole]
      };
    };
    const near = leg(p, V.restX, act && act.near), far = leg(p + 0.5, -V.restX, act && act.far);
    let k = y < 0 ? 1 + 0.34 * y / VV.rise : 1 + 0.1 * y / dip;
    if (dy < 0) k *= Math.max(0.35, 1 + dy / 80);
    const puffs = [];
    [0, 0.5].forEach(ph => {
      const tau = fract(p - ph) / 0.3;
      if (tau >= 1) return;
      const x0 = CX + VV.S * go - V.W / 2 - (2 * VV.S / VV.D) * go * fract(p - ph);
      const pop = Math.min(1, tau * 6) * Math.pow(1 - tau, 1.4) * go;
      const e = 1 - (1 - tau) * (1 - tau);
      [[4, 5, 5.2], [15, 15, 4.2], [27, 8, 3.2]].forEach(([sx, sy, r]) => puffs.push([x0 - sx * e, G - 3 - sy * e, r * pop]));
    });
    const P = {
      body: `rotate(${lean.toFixed(3)} ${CX} ${f2(hipY)}) translate(${CX} ${f2(hb)})`,
      lean, pivotY: hipY, clipH: 2000, legs: [near, far], clipY: hb,
      shadow: [CX, G + 3, V.shadow * k * out, 5.5 * k * out], puffs,
      along: addParts(tip > 0 ? null : springParts(u, go, VV), act && act.along),
      across: act ? act.across || null : null
    };
    if (P.along) {
      const iH = PARTS.indexOf('H_L');
      P.clipY += Math.min(0, P.along[iH], P.along[iH + 1]);
    }
    return tip > 0 ? flipPose(P, tip) : P;
  }

  // ---- рисование
  const mk = (tag, attrs = {}) => {
    const e = document.createElementNS(NS, tag);
    for (const a in attrs) e.setAttribute(a, attrs[a]);
    return e;
  };
  const shapeEl = def => def.startsWith('M') ? mk('path', { d: def }) : mk('polygon', { points: def });
  let clipSeq = 0;
  /* theme: { ink — цвет знака, bg — фон под ним (дальняя ножка = ink, смешанный с фоном),
              shade — цвет тени или null, dot — пыль из-под ножек или null } */
  function makeRig(root, theme) {
    const id = `legclip-${++clipSeq}`;
    const clip = mk('clipPath', { id }), clipRect = mk('rect', { x: -400, width: 1600 });
    clip.append(clipRect);
    const shadow = mk('ellipse', { fill: theme.shade || 'none' });
    const puffG = mk('g', { fill: theme.dot || 'none' });
    const puffs = [0, 1, 2, 3, 4, 5].map(() => { const c = mk('circle', { display: 'none' }); puffG.append(c); return c; });
    const legsG = mk('g', { 'clip-path': `url(#${id})`, fill: 'none', 'stroke-linecap': 'butt', 'stroke-linejoin': 'round', 'stroke-width': V.W });
    const mkLeg = stroke => {
      const cid = `soleclip-${++clipSeq}`;
      const c = mk('clipPath', { id: cid }), r = mk('rect', { x: -700, y: -1400, width: 1400, height: 1400 });
      c.append(r); root.append(c);
      const path = mk('path', { stroke, 'clip-path': `url(#${cid})` });
      legsG.append(path);
      return { path, r };
    };
    const back = mkLeg(mixColor(theme.ink, theme.bg, 0.38)), front = mkLeg(theme.ink);
    const body = mk('g', { fill: theme.ink }), word = mk('g', { transform: R_WORD });
    const parts = PARTS.map(k => { const e = shapeEl(SHAPES[k]); word.append(e); return e; });
    let moved = false;
    body.append(word);
    root.append(clip, shadow, puffG, legsG, body);
    const setLeg = (L, def) => {
      L.path.setAttribute('d', def.d);
      L.r.setAttribute('transform', `translate(${f2(def.sole[0])} ${f2(def.sole[1])}) rotate(${f2(def.sole[2])})`);
    };
    return {
      apply(P) {
        body.setAttribute('transform', P.body);
        if (P.along || P.across) {
          parts.forEach((e, i) => {
            const a = P.along ? P.along[i] : 0, c = P.across ? P.across[i] : 0;
            e.setAttribute('transform', `translate(${f2(a / R_SC)} ${f2(-c / R_SC)})`);
          });
          moved = true;
        } else if (moved) { parts.forEach(e => e.removeAttribute('transform')); moved = false; }
        clipRect.setAttribute('y', f2(P.clipY - 2));
        clipRect.setAttribute('height', f2(P.clipH > 0 ? P.clipH + 2 : 0));
        clipRect.setAttribute('transform', P.lean ? `rotate(${P.lean.toFixed(3)} ${CX} ${f2(P.pivotY)})` : '');
        setLeg(front, P.legs[0]);
        setLeg(back, P.legs[1]);
        const sh = P.shadow;
        shadow.setAttribute('cx', f2(sh[0])); shadow.setAttribute('cy', f2(sh[1]));
        shadow.setAttribute('rx', f2(Math.max(0, sh[2]))); shadow.setAttribute('ry', f2(Math.max(0, sh[3])));
        puffs.forEach((c, i) => {
          const d = P.puffs[i];
          if (!d || d[2] < 0.2) { c.setAttribute('display', 'none'); return; }
          c.removeAttribute('display');
          c.setAttribute('cx', f2(d[0])); c.setAttribute('cy', f2(d[1])); c.setAttribute('r', f2(d[2]));
        });
      }
    };
  }

  // ---- разгон, торможение, сценки
  const brakeAt = w => ({ v: 1 - smooth(w), lean: V.leanCruise * (1 - smooth(w)) - V.leanBrake * 4 * w * (1 - w) });
  const accelAt = w => ({ v: smooth(w), lean: V.leanCruise * smooth(w) + V.leanAccel * 4 * w * (1 - w) });
  const nodAt = s => ({ v: 0, lean: s < 0.35 ? V.nod * Math.sin(Math.PI * s / 0.35) : 0 });
  const anticipAt = w => ({ v: 0, lean: -V.anticip * Math.sin(Math.PI * w) });

  // Балетные прыжки: большой шаг, шпагат в полёте.
  const LEAP = Object.assign({}, V, { T: 1.45, S: 50, D: 0.2, H: 30, rise: 82, g: 0.2, sw: 1.8, toeUp: 6, heelUp: 34, split: 2.6 });

  // Резкая остановка: тело откидывает, буквы по инерции летят вперёд и возвращаются.
  function withSkid(t, a, back = 14) {
    const scared = kf(t, [[0, 0], [0.12, 1, 'o'], [0.45, 1], [0.9, 0]]);
    const lurch = kf(t, [[0, 0], [0.1, 1, 'o'], [0.32, -0.5], [0.65, 0]]);
    return Object.assign({}, a, {
      lean: (a.lean || 0) - back * scared,
      dy: (a.dy || 0) + 8 * scared,
      along: HF.map((f, i) => (a.along ? a.along[i] : 0) + 4 * f * scared),
      across: HF.map((f, i) => (a.across ? a.across[i] : 0) + 9 * f * f * lurch)
    });
  }
  /* «Осматривается»: запрокидывает голову, будто перед ним небоскрёб. hold — сколько секунд смотрит вверх. */
  function lookUp(t, hold = 1.3) {
    const end = 0.42 + hold;
    const U = u => kf(u, [[0, 0], [0.12, -0.12], [0.42, 1, 'ob'], [0.42 + hold * 0.55, 1.12], [end, 1.18], [end + 0.5, 0]]);
    const up = U(t);
    return {
      lean: -16 * U(t - 0.06),
      dy: -6 * up,
      along: HF.map(f => -8 * f * up),
      across: HF.map(f => -13 * f * f * U(t - 0.08 * (1 - f))),
      near: { x: 15, h: 0, phi: 14 * Math.max(0, up) }, far: { x: -15, h: 0, phi: 14 * Math.max(0, up) }
    };
  }
  /* «Танцует балет»: плие, релеве и па-де-бурре, два антраша, финальное плие. 4 секунды. */
  function ballet(t) {
    const releve = kf(t, [[0, 0], [0.4, 0], [0.65, 1, 'o'], [2.0, 1], [2.3, 0]]);
    const bour = kf(t, [[0, 0], [0.65, 0], [0.8, 1], [1.85, 1], [2.0, 0]]);
    const bs = Math.sin(2 * Math.PI * 3 * (t - 0.65));
    const jump = kf(t, [[0, 0], [2.3, 0], [2.56, 1, 'o'], [2.86, 0, 'i'], [3.12, 1, 'o'], [3.42, 0, 'i']]);
    const beat = u => { for (const t0 of [2.34, 2.9]) { const w = (u - t0) / 0.48; if (w > 0 && w < 1) return Math.sin(Math.PI * w); } return 0; };
    const b = beat(t);
    const plie = kf(t, [[0, 0], [0.4, 1], [0.65, 0], [2.0, 0], [2.3, 1], [2.32, 0], [2.86, 0.8, 'i'], [2.88, 0], [3.42, 1, 'i'], [3.6, 1.2], [4.0, 0]]);
    const pride = kf(t, [[0, 0], [0.5, 1], [3.5, 1], [4.0, 0]]);
    const fifth = kf(t, [[0, 0], [0.4, 1], [3.5, 1], [4.0, 0]]);
    const toes = 30 * releve + 20 * jump;
    return {
      lean: 1.5 * bour * Math.sin(Math.PI * (t - 0.65)) + 3 * jump,
      dy: 9 * plie - 11 * releve + 1.5 * bour * bs - 62 * jump,
      along: HF.map(f => -5 * f * releve + 1.2 * f * bour * Math.sin(2 * Math.PI * 3 * (t - 0.65) - 1.5 * f) - 4 * f * jump),
      across: HF.map(f => -4 * f * f * pride),
      near: { x: 15 - 9 * fifth - 14 * b, h: bour * 9 * Math.max(0, bs), phi: toes },
      far: { x: -15 + 9 * fifth + 14 * b, h: bour * 9 * Math.max(0, -bs), phi: toes }
    };
  }

  // ---- живой актёр
  const spring = (freq, damp) => ({ w: 2 * Math.PI * freq, z: damp, x: 0, v: 0 });
  const follow = (sp, target, h) => {
    sp.v += (-sp.w * sp.w * (sp.x - target) - 2 * sp.z * sp.w * sp.v) * h;
    sp.x += sp.v * h;
    return sp.x;
  };
  const REST = [15, 0, 0, -15, 0, 0];

  /* svg — куда рисовать; theme — см. makeRig.
     actor.x, actor.y — точка на земле под центром знака (в координатах svg), actor.k — масштаб.
     actor.step(dt, c): c = { amp, tip, v, leanT, act, gait, shadowK }; возвращает, сколько земли
     ушло под ножками за кадр (в единицах рига; на экране умножить на k). */
  function makeActor(svg, theme) {
    const g = mk('g');
    svg.append(g);
    const rig = makeRig(g, theme);
    const S = {
      runLean: spring(V.leanFreq, V.leanDamp), actLean: spring(2.6, 0.55), dy: spring(3.2, 0.6),
      al: HF.map(f => spring(4.6 - 2.2 * f, 0.45)), ac: HF.map(f => spring(4.2 - 2.0 * f, 0.42)),
      ft: REST.map(() => spring(6, 0.85))
    };
    S.ft.forEach((sp, j) => { sp.x = REST[j]; });
    const A = {
      x: 0, y: 0, k: 1, rot: 0, phase: 0, ground: 0, g,
      place() {
        g.setAttribute('transform', `translate(${f2(A.x)} ${f2(A.y)}) rotate(${f2(A.rot)}) scale(${A.k.toFixed(4)}) translate(${-CX} ${-G})`);
      },
      step(dt, c) {
        dt = Math.min(dt, 0.05);
        const a = c.act, VV = c.gait || V, sub = 4, h = dt / sub;
        const feet = a && a.near ? [a.near.x, a.near.h || 0, a.near.phi || 0, a.far.x, a.far.h || 0, a.far.phi || 0] : REST;
        for (let q = 0; q < sub; q++) {
          follow(S.runLean, c.leanT || 0, h);
          follow(S.actLean, a ? a.lean || 0 : 0, h);
          follow(S.dy, a ? a.dy || 0 : 0, h);
          for (let i = 0; i < NP; i++) {
            follow(S.al[i], a && a.along ? a.along[i] : 0, h);
            follow(S.ac[i], a && a.across ? a.across[i] : 0, h);
          }
          for (let i = 0; i < 6; i++) follow(S.ft[i], feet[i], h);
        }
        const dp = dt * (0.45 + 0.55 * c.v) / VV.T;
        const go = smooth((c.amp - 0.25) / 0.75) * c.v;
        A.phase += dp;
        const dg = (2 * VV.S / VV.D) * go * dp;
        A.ground += dg;
        const act = { lean: 0, dy: S.dy.x, along: S.al.map(s => s.x), across: S.ac.map(s => s.x) };
        if (c.v < 1e-3 && c.amp > 0.99 && !c.tip) {            // стоит: ножки ведёт сценка, а не шаг
          act.near = { x: S.ft[0].x, h: Math.max(0, S.ft[1].x), phi: S.ft[2].x };
          act.far = { x: S.ft[3].x, h: Math.max(0, S.ft[4].x), phi: S.ft[5].x };
        }
        const P = pose(A.phase, c.amp, c.tip || 0, { v: c.v, lean: S.runLean.x + S.actLean.x, gait: c.gait }, act);
        if (c.shadowK != null) { P.shadow[2] *= c.shadowK; P.shadow[3] *= c.shadowK; }
        rig.apply(P);
        A.place();
        return dg;
      },
      remove() { g.remove(); }
    };
    return A;
  }

  // сколько земли уйдёт за резкую остановку длиной skid секунд (чтобы затормозить ровно перед телефоном)
  function skidDistance(skid) {
    let d = 0;
    const n = 200, dt = skid / n;
    for (let i = 0; i < n; i++) {
      const v = 1 - smooth((i + 0.5) / n);
      d += (2 * V.S / V.D) * v * dt * (0.45 + 0.55 * v) / V.T;
    }
    return d;
  }
  const cruiseSpeed = (2 * V.S / V.D) / V.T;    // единиц рига в секунду на полном ходу

  window.Logo = { V, G, CX, HALF_W, HALF_H, WORD_CY, LEAP, kf, smooth, easeInOut,
                  makeActor, brakeAt, accelAt, nodAt, anticipAt, withSkid, lookUp, ballet,
                  skidDistance, cruiseSpeed };
})();
