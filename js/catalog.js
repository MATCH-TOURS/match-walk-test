/* Каталог: карта города, метки прогулок, шторка прогулки (пик → раскрыта), выбор города, список.
   Доска «Каталог · карта города» в UI. Настоящие данные — только у «Тель-Авив 100 лет назад»:
   старт, фото, маршрут, голос Юли. У остальных прогулок названия и длительности с сайта, метки стоят
   примерно по району, обложек и текстов нет — там заглушки. Цены 100 / 160 шек. не подтверждены.
   Покупка в прототипе условная: кнопка «покупает» сразу. Фрагмент — это приветствие Юли из прогулки. */
(() => {
  const { $, el, clamp, lerp } = App, D = window.DATA, C = window.CITYDATA, ICON = App.icons;
  const PIN = 'M131.37,22.87c-62.85,0-113.64,46.02-113.64,108.87,0,44.05,16.56,73.24,51.07,115.61l62.57,68.75,62.29-68.75c34.51-42.65,51.35-71.55,51.35-115.61,0-62.85-51.07-108.87-113.64-108.87Z';
  const PIN_N = PIN + 'M118.18,220.13h-26.1v-89.79h1.12l33.39,57.8-8.42,31.99ZM129.13,176.92h-.84l-36.2-64.26v-35.92h18.52l18.52,57.8v42.37ZM172.34,220.13h-25.53l-10.1-37.32-.56-48.26,13.47-57.8h22.73v143.38Z';
  // 20.11 Андрей: у проработанной прогулки на пине маленькая четырёхлучевая звёздочка (справа сверху), жёлтая с тёмным краем
  const STAR = 'M0-62Q8-8 62 0Q8 8 0 62Q-8 8-62 0Q-8-8 0-62Z';
  const pinSvg = (w, h, outline, star) => `<svg width="${w}" height="${h}" viewBox="0 0 262.74 338.97"${star ? ' style="overflow:visible"' : ''}>${outline ? `<path d="${PIN}" fill="#FFFCF5" stroke="#FFFCF5" stroke-width="30" stroke-linejoin="round"/>` : ''}<path d="${PIN_N}" fill="#282828"/>${star ? `<g class="pin-star" transform="translate(250 22)"><path d="${STAR}" fill="#FFFCF5" stroke="#FFFCF5" stroke-width="34" stroke-linejoin="round"/><path d="${STAR}" fill="#F2CF4A" stroke="#282828" stroke-width="10" stroke-linejoin="round"/></g>` : ''}</svg>`;
  const PRICE = '100 ₪';
  const J = 'assets/img/j/';
  const WALKS = [
    { id: '100 лет назад', title: D.walk.title, sub: `${D.walk.pts} · ${D.walk.km} км`, dur: D.walk.dur, real: true, img: J + 'cover-sq.jpg' },
    { id: 'Белый город', title: 'Белый город', sub: 'Рождение главного бренда', dur: '1,5 часа', img: J + 'white-city.jpg' },
    { id: 'Ротшильд', title: 'Бульвар Ротшильда', sub: 'В гостях у первых горожан', dur: '1,5 часа', img: J + 'rothschild.jpg', star: true },   // 20.11: звёздочка заранее, данные Андрей даст позже. 20.11 вечер Андрей: звёздочку у Ротшильда убрать (флаг star оставлен — им пользуются сортировка списка и финал)
    { id: 'Эклектика', title: 'Эклектика', sub: 'Город в поисках себя', dur: '1 час', img: J + 'eclectic.jpg', rev: 'Эклектик' },
    { id: 'Йеменский район', title: 'Йеменский район', sub: 'История спасения', dur: '1 час', img: J + 'yemenite.jpg' },
    { id: 'От песков', label: 'От песков · детям', title: 'От песков к небоскрёбам', sub: 'Для детей и подростков', dur: '1 час', img: J + 'sands-kids.jpg' },
    { id: 'Стрит-арт', title: 'Андеграундный Тель-Авив', sub: 'История стрит-арта', dur: '2,5–3 часа', img: J + 'street-art.jpg' },
    { id: 'Богемные следы', title: 'По богемным следам', sub: 'Ранний Тель-Авив', dur: '1,5 часа', img: J + 'bohemian.jpg' },
    { id: 'Как рождался', label: 'Как рождался · бесплатно', title: 'Как рождался Тель-Авив', sub: 'Бесплатно · 10 минут', dur: '10 минут', free: true }
  ];
  const proj = ll => ({ x: C.w / 2 + (ll[1] - C.lon0) * C.kx * C.ppm, y: C.h / 2 - (ll[0] - C.lat0) * C.ky * C.ppm });
  WALKS.forEach(w => { w.ll = C.pins.find(p => p.id === w.id).ll; w.p = proj(w.ll); });
  const YOU = proj(C.pins.find(p => p.id === 'вы').ll), VIEW = proj(C.view);
  const fromYou = w => { const m = Math.hypot((w.ll[0] - C.pins.find(p => p.id === 'вы').ll[0]) * C.ky, (w.ll[1] - C.pins.find(p => p.id === 'вы').ll[1]) * C.kx) * 1.3; const km = `${(Math.round(m / 100) / 10).toString().replace('.', ',')} км от вас`, walk = `${Math.max(1, Math.round(m / 75))} минут пешком`; return { m, km, walk, text: `${km} · ${walk}` }; };
  const frag = window.AUDIODATA.hello.parts[0];
  /* 20.11 Андрей: на карте ещё три вида объектов, круглые значки.
     art — стрит-арт, бесплатно, для всех; museum — музеи-партнёры; head — герои «100 лет назад» парят над картой и рассказывают о себе.
     Фото — Wikimedia Commons (подписи авторов в шторке). Голоса — нейроголоса Microsoft (edge-tts): Дмитрий (Герцль), Светлана (Ира Ян); тексты рядом со звуком, assets/audio/heads/*.txt.
     Места чуть разведены, чтобы значки не легли друг на друга (мозаика Гутмана и Зал Независимости в жизни в ~100 м). */
  const POIS = [
    { id: 'gutman', kind: 'art', ll: [32.0617, 34.7697], title: 'Мозаика Нахума Гутмана', addr: 'Бульвар Ротшильда, 1', img: 'assets/img/poi/art-gutman.jpg', credit: 'Фото: Baruch Niv · CC BY 2.5 · Wikimedia Commons',
      text: ['История Тель-Авива и Яффо в одном фонтане. Пророк Иона и кит, кедры для Храма, которые везли через яффский порт, Наполеон, первые дома Ахузат-Байта.',
        'Гутман вырос вместе с городом и рисовал его всю жизнь. Мозаику повесили в 1976 году на старую мэрию у площади Бялика, а в 2011-м перенесли сюда, в начало бульвара Ротшильда.',
        'Рисованию Гутмана учила Ира Ян — найдите её голову на карте.'] },
    { id: 'meiri', kind: 'art', ll: [32.0835, 34.7676], title: 'Мурал Рами Мейри', addr: 'Набережная у пляжа Гордон', img: 'assets/img/poi/art-meiri.jpg', credit: 'Фото: Avishai Teicher · CC BY 2.5 · Wikimedia Commons',
      text: ['Рами Мейри — один из первых, кто стал расписывать стены Тель-Авива. Свой первый мурал он нарисовал на городской набережной, ещё студентом художественного института «Авни».',
        'С тех пор его стены — по всему городу: люди, сцены из жизни, город, каким его видят прохожие. Этот — у пляжа Гордон, его видно прямо с променада.'] },
    { id: 'amose', kind: 'art', ll: [32.0582, 34.7734], title: 'Мурал Amose во Флорентине', addr: 'Улица ха-Алия, 25', img: 'assets/img/poi/art-amose.jpg', credit: 'Фото: Nizzan Cohen · CC BY 4.0 · Wikimedia Commons',
      text: ['Флорентин — главный район стрит-арта в Тель-Авиве. Граффити здесь на каждом углу, и картинки меняются каждый год: старые закрашивают, поверх рисуют новые.',
        'Этот мурал в ноябре 2017 года нарисовал французский художник Amose. Если не найдёте его — значит, на стене уже что-то новое.'] },
    { id: 'beithair', kind: 'museum', ll: [32.0738, 34.7722], title: 'Бейт ха-Ир', addr: 'Площадь Бялика, 27', img: 'assets/img/poi/mus-beithair.jpg', credit: 'Фото: acediscovery · CC BY 4.0 · Wikimedia Commons',
      lead: 'Музей истории Тель-Авива в здании старой мэрии',
      secs: [['История', 'Дом построили в 1925 году. До 1965-го здесь работала мэрия Тель-Авива, а на фасаде висела мозаика Нахума Гутмана — теперь она на бульваре Ротшильда.'],
        ['Что внутри', 'Выставки об истории города и восстановленный кабинет первого мэра, Меира Дизенгофа.'],
        ['Рядом', 'Площадь Бялика — одна из самых тихих в центре. На соседней улице — дом поэта Хаима Нахмана Бялика.']] },
    { id: 'independence', kind: 'museum', ll: [32.0620, 34.7730], title: 'Зал Независимости', addr: 'Бульвар Ротшильда, 16', img: 'assets/img/poi/mus-independence.jpg', credit: 'Фото: Шломо Родед · CC BY 2.5 · Wikimedia Commons',
      lead: 'Дом Дизенгофа, где 14 мая 1948 года провозгласили Израиль',
      secs: [['История', 'Участок для дома Меир и Зина Дизенгоф получили в 1909 году на том самом розыгрыше ракушек, с которого начался Тель-Авив. После смерти Зины в 1930 году Дизенгоф отдал дом городу под музей.'],
        ['Что здесь было', 'С 1932 по 1971 год — Тельавивский музей искусств. 14 мая 1948 года в главном зале Давид Бен-Гурион зачитал Декларацию независимости.'],
        ['Сейчас', 'Здание на реконструкции. Перед походом проверьте на сайте музея, открыт ли он.']] },
    { id: 'herzl', kind: 'head', ll: [32.0752, 34.7655], name: 'Теодор Герцль', short: 'Герцль', years: '1860–1904', img: 'assets/img/heads/herzl.jpg', audio: 'assets/audio/heads/herzl.m4a', dur: 129 },
    { id: 'iraj', kind: 'head', ll: [32.0764, 34.7716], name: 'Ира Ян', short: 'Ира Ян', years: '1869–1919', img: 'assets/img/heads/iraj.jpg', audio: 'assets/audio/heads/iraj.m4a', dur: 115 }
  ];
  POIS.forEach(o => { o.p = proj(o.ll); });
  /* 20.11 Андрей: «чтобы головы понемногу двигались по улицам, как будто гуляют по городу».
     Петли по настоящим улицам — tools/minimap/heads_paths.py → js/headpaths.js. Голова идёт не спеша,
     на поворотах иногда стоит, «оглядывается». Пока рассказывает о себе — стоит на месте. */
  // 20.11 Андрей: «немного прыгают, сделай более плавное движение и чуть медленнее» — углы петли скругляем (Чайкин),
  // двигаем через transform (без привязки к пикселям), к остановкам подходят и трогаются плавно
  const arc = pts => { const len = [0]; for (let k = 1; k < pts.length; k++) len.push(len[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y)); return len; };
  const chaikin = ring => { const o = []; ring.forEach((a, k) => { const b = ring[(k + 1) % ring.length]; o.push({ x: a.x * .75 + b.x * .25, y: a.y * .75 + b.y * .25 }, { x: a.x * .25 + b.x * .75, y: a.y * .25 + b.y * .75 }); }); return o; };
  POIS.filter(o => o.kind === 'head' && window.HEADPATHS && HEADPATHS[o.id]).forEach(o => {
    const raw = HEADPATHS[o.id].map(proj), rawLen = arc(raw);
    // повороты круче 45° — места, где можно постоять (по исходной ломаной)
    const turns = [];
    for (let k = 1; k < raw.length - 1; k++) {
      const a = Math.atan2(raw[k].y - raw[k - 1].y, raw[k].x - raw[k - 1].x), b = Math.atan2(raw[k + 1].y - raw[k].y, raw[k + 1].x - raw[k].x);
      if (Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) > Math.PI / 4) turns.push(rawLen[k]);
    }
    let ring = raw.slice(0, -1); for (let n = 0; n < 3; n++) ring = chaikin(ring);
    const pts = ring.concat([ring[0]]), len = arc(pts), total = len[len.length - 1], f = total / rawLen[rawLen.length - 1];
    o.path = { pts, len, total, turns: turns.map(t => t * f) };
    o.s = 0; o.p = { ...pts[0] };
  });
  const PI = {   // значки в кружках: фотоаппарат — стрит-арт, колонны — музей
    art: '<svg width="16" height="16" viewBox="0 0 16 16"><g fill="none" stroke="#FFFCF5" stroke-width="1.5" stroke-linejoin="round"><path d="M2 5.2c0-.6.4-1 1-1h2l1.1-1.7h3.8L11 4.2h2c.6 0 1 .4 1 1v7.1c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1z"/><circle cx="8" cy="8.6" r="2.5"/></g></svg>',
    museum: '<svg width="16" height="16" viewBox="0 0 16 16"><g fill="none" stroke="#FFFCF5" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M2 5.6L8 2.4l6 3.2zM3.6 7.6v4.6M6.5 7.6v4.6M9.5 7.6v4.6M12.4 7.6v4.6M2 13.8h12"/></g></svg>'
  };
  /* Стили карты (19.11, выбор в профиле). Картинки — tools/minimap/proto_maps.py, растр @3x под зум.
     dark — карта тёмная, строка состояния светлая. */
  // 19.11 Андрей: на каталоге переключаются все стили, а на экраны прогулки переходят только «Схема» и «Тушь»
  // (walk: true). Остальные там показывают обычную карту. Нигде не подписано — Андрей это знает.
  // «Карандаш» и «Акварель» убраны из кружков 19.11 (картинки остались в assets/map/styles)
  // «Крафт» (реф. путеводитель Patagonia) заменил «Линогравюру» 19.11; её картинки остались в assets/map/styles/lino*
  // 20.11 Андрей: оставили только проработанные стили — те, у которых есть и кружок прогулки (Схема — обычный кружок).
  // «Крафт» (guide), «Ризограф» (riso), «Фломастер» (marker) убраны из переключателя; картинки остались в assets/map/styles
  const STYLES = [
    { id: 'base', name: 'Схема' }, { id: 'ink', name: 'Тушь', walk: true },
    // 19.11 «Старый план» (реф. Holborn): Андрей попросил в прототип и чтобы шёл дальше в прогулку
    { id: 'survey', name: 'Старый план', walk: true }
  ].map(s => ({ ...s, src: `assets/map/styles/${s.id}.jpg`, thumb: `assets/map/styles/${s.id}-th.jpg` }));
  let style = STYLES[0];
  try { style = STYLES.find(s => s.id === localStorage.getItem('match.mapStyle')) || style; } catch (_) {}
  const PHOTOS = [
    { src: 'assets/img/herzl-street.jpg', title: 'Улица Герцля, 1911', sub: 'Одна из точек прогулки' },
    { src: 'assets/img/sands.jpg', title: 'Пески', sub: 'Так выглядело всё вокруг' },
    { src: 'assets/img/ahad-haam.jpg', title: 'Дом Ахад ха-Ама', sub: 'Дом, которого больше нет' }
  ];
  // настоящие сообщения гостей из хайлайта «Отзывы» @match.walks (style/reviews/ig/cut)
  const REVIEWS = [
    { src: J + 'review-1.png', title: 'Гостья', sub: 'версия на иврите, Telegram' },
    { src: J + 'review-2.png', title: 'Маша', sub: 'про вводный рассказ, WhatsApp' },
    { src: J + 'review-3.png', title: 'Гостья', sub: 'про «Эклектику», Telegram' }
  ];
  // иконки «Полезно знать» (Андрей 19.11: «знак бесконечности, сердечко, без интернета»)
  const KI = {
    inf: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 10c-1.6-2.2-3-3.4-4.6-3.4a3.4 3.4 0 0 0 0 6.8C7 13.4 8.4 12.2 10 10Zm0 0c1.6 2.2 3 3.4 4.6 3.4a3.4 3.4 0 0 0 0-6.8C13 6.6 11.6 7.8 10 10Z" fill="none" stroke="#282828" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    heart: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 16.2S3.2 12.3 3.2 7.7A3.4 3.4 0 0 1 10 6.3a3.4 3.4 0 0 1 6.8 1.4c0 4.6-6.8 8.5-6.8 8.5Z" fill="none" stroke="#282828" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    off: '<svg width="20" height="20" viewBox="0 0 20 20"><g fill="none" stroke="#282828" stroke-width="1.5" stroke-linecap="round"><path d="M2.8 7.6a10.4 10.4 0 0 1 14.4 0M5.4 10.4a6.6 6.6 0 0 1 9.2 0M8 13.1a2.9 2.9 0 0 1 4 0"/><path d="M3.5 3.5l13 13"/></g><circle cx="10" cy="15.6" r="1.1" fill="#282828"/></svg>'
  };
  // «Как добраться»: знак поворота, как в навигаторе
  const TURN = '<svg width="18" height="18" viewBox="0 0 18 18"><g fill="none" stroke="#282828" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><rect x="3.3" y="3.3" width="11.4" height="11.4" rx="1.6" transform="rotate(45 9 9)"/><path d="M7 11.5V9.2c0-.6.4-1 1-1h3.4M10 6.7l1.6 1.5L10 9.7"/></g></svg>';

  // Знак Match в тёмном кружке — чип города (макет «Город · чип»)
  const MARK = `<svg width="32" height="32" viewBox="0 0 300 300"><circle cx="150" cy="150" r="150" fill="#282828"/><g transform="translate(150 150) scale(1.1) translate(-132.2 -148.4)"><path d="M118.18,220.13h-26.1v-89.79h1.12l33.39,57.8-8.42,31.99ZM129.13,176.92h-.84l-36.2-64.26v-35.92h18.52l18.52,57.8v42.37ZM172.34,220.13h-25.53l-10.1-37.32-.56-48.26,13.47-57.8h22.73v143.38Z" fill="#F4F0E6"/></g></svg>`;
  // ✕ в шапке шторки (Андрей 19.11: «Вернуть ✕»)
  const XB = (sz = 24) => `<button class="cs-close tap" style="width:${sz}px;height:${sz}px" aria-label="Закрыть"><svg width="${sz > 30 ? 12 : 10}" height="${sz > 30 ? 12 : 10}" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" fill="none" stroke="#282828" stroke-width="1.6" stroke-linecap="round"/></svg></button>`;
  /* 20.11 Андрей: «при клике давай показывать путь прогулки на карте». Путь есть только у «100 лет назад»
     (Maps.routes.walk и точки — метры от точки 1, как в protomap.py); переводим в пиксели карты каталога. */
  const O1 = [32.0633976, 34.7695211], KX1 = 111320 * Math.cos(O1[0] * Math.PI / 180);
  const m2px = ([x, y]) => proj([O1[0] + y / 110540, O1[1] + x / KX1]);
  const MDW = window.MAPDATA;
  const ROUTE_C = (() => { const ps = MDW.routes.walk.map(m2px), xs = ps.map(p => p.x), ys = ps.map(p => p.y);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }; })();   // середина пути: на неё ставим карту
  const routeSvg = (() => {
    const d = 'M' + MDW.routes.walk.map(m2px).map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L');
    const dots = MDW.points.map(p => m2px([p.x, p.y])).map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2"/>`).join('');
    return `<svg class="c-route" viewBox="0 0 ${C.w} ${C.h}" width="${C.w}" height="${C.h}" aria-hidden="true">
      <path d="${d}" fill="none" stroke="#282828" stroke-opacity=".22" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <path d="${d}" fill="none" stroke="#F2CF4A" stroke-opacity=".9" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <g fill="#F2CF4A" stroke="#282828" stroke-width="1.2" vector-effect="non-scaling-stroke">${dots}</g></svg>`;
  })();
  const PLAY = `<svg class="i-play" width="14" height="16" viewBox="0 0 16 18"><path d="M2 1l13 8-13 8z" fill="#282828"/></svg>`;
  const node = el(`<div class="cat">
    <div class="c-map"><div class="c-pan"><img class="c-img" src="${style.src}" alt="">${routeSvg}
      <div class="c-you" style="left:${YOU.x}px;top:${YOU.y}px"><i></i></div>
      ${WALKS.map((w, i) => `<div class="c-pin" data-i="${i}" style="left:${w.p.x}px;top:${w.p.y}px">${pinSvg(28, 36, true, w.real)}<b>${w.label || w.id}</b></div>`).join('')}
      ${POIS.map((o, i) => o.kind === 'head'
        ? `<div class="c-head" data-p="${i}" style="left:${o.p.x}px;top:${o.p.y}px"><s></s><div class="h-fl"><div class="h-ball" style="background-image:url(${o.img})"></div></div><b class="h-name">${o.short}</b><div class="h-say"><span class="h-wave"><i></i><i></i><i></i><i></i><i></i></span><span>${o.short}</span><em></em></div></div>`
        : `<div class="c-poi k-${o.kind}" data-p="${i}" style="left:${o.p.x}px;top:${o.p.y}px" aria-label="${o.title}">${PI[o.kind]}</div>`).join('')}
    </div></div>
    <div class="c-list"><h2>${WALKS.filter(w => !w.free).length} прогулок</h2><div class="c-sort"><span>Сначала</span><button class="on tap" data-s="near">Ближе</button><button class="tap" data-s="cheap">Дешевле</button></div><div class="c-feed"></div><div class="c-fade"></div></div>
    <button class="c-chip c-city tap">${MARK}<span>Тель-Авив</span><svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" fill="none" stroke="#282828" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <button class="c-chip c-style tap" aria-label="Стиль карты"><i></i></button>
    <button class="c-chip c-layers tap" aria-label="Слои карты"><svg width="20" height="20" viewBox="0 0 20 20"><g stroke="#282828" stroke-width="1.6" stroke-linecap="round"><path d="M3 5.5h14M3 10h14M3 14.5h14"/></g><g fill="#FFFCF5" stroke="#282828" stroke-width="1.6"><circle cx="13" cy="5.5" r="2"/><circle cx="7" cy="10" r="2"/><circle cx="11.5" cy="14.5" r="2"/></g></svg></button>
    <button class="c-chip c-prof tap" aria-label="Профиль"><svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="6.8" r="4" fill="#282828"/><path d="M2.9 17.4c.9-3.7 3.7-5.8 7.1-5.8s6.2 2.1 7.1 5.8c.1.6-.3 1.1-.9 1.1H3.8c-.6 0-1-.5-.9-1.1z" fill="#282828"/></svg></button>
    <div class="c-ctl"><div class="c-seg"><i></i><button class="on" data-v="map">Карта</button><button data-v="list">Список</button></div>
      <button class="c-loc tap" aria-label="Я здесь"><svg width="22" height="22" viewBox="0 0 22 22"><path d="M19 3L3.5 9.6l6.3 2.6 2.6 6.3L19 3z" fill="#282828" stroke="#282828" stroke-width="1.8" stroke-linejoin="round"/></svg></button></div>
    <div class="c-dim"></div>
    <div class="cs"><div class="cs-grab"></div><button class="cs-x tap" aria-label="Закрыть"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9" fill="none" stroke="#282828" stroke-width="1.8" stroke-linecap="round"/></svg></button>
      <div class="cs-top"><div class="r">${XB(36)}<b></b><button class="cs-buy tap soft"><span></span></button></div></div>
      <div class="cs-peek"></div><div class="cs-full"></div></div>
    <div class="c-buy"><button class="c-frag tap soft" aria-label="Фрагмент">${PLAY}${ICON.pause('#282828', 16)}</button><button class="c-pay tap soft"><span></span></button></div>
  </div>`);
  $('#app').append(node);
  const q = s => node.querySelector(s), qa = s => [...node.querySelectorAll(s)];
  const pan = q('.c-pan'), pins = qa('.c-pin'), pois = qa('.c-poi, .c-head'), sheet = q('.cs'), peek = q('.cs-peek'), full = q('.cs-full'), dim = q('.c-dim'), fragBtn = q('.c-frag'), payBtn = q('.c-pay'), topBuy = q('.cs-buy');

  /* ---- карта: двигается пальцем, при выборе метки подвозит её в центр над шторкой.
     Зум: щипок на тачпаде (wheel + ctrl), двойной тап. Два пальца на тачпаде — прокрутка.
     Картинка растягивается, метки остаются своего размера и переезжают на свои места. */
  let tx = 0, ty = 0, tx0 = 0, ty0 = 0, z = 1;
  const ZMIN = Math.max(390 / C.w, 844 / C.h, .55), ZMAX = 2.4;
  const mapEl = q('.c-map'), you = q('.c-you');
  function place() {
    node.querySelectorAll('.c-img, .c-route').forEach(i => { i.style.width = C.w * z + 'px'; i.style.height = C.h * z + 'px'; });
    pins.forEach((p, i) => { p.style.left = WALKS[i].p.x * z + 'px'; p.style.top = WALKS[i].p.y * z + 'px'; });
    pois.forEach(p => { const o = POIS[p.dataset.p]; if (o.path) return; p.style.left = o.p.x * z + 'px'; p.style.top = o.p.y * z + 'px'; });   // идущие головы ставит stroll()
    you.style.left = YOU.x * z + 'px'; you.style.top = YOU.y * z + 'px';
  }
  const setPan = (x, y) => { tx = clamp(x, 390 - C.w * z, 0); ty = clamp(y, 844 - C.h * z, 0); pan.style.transform = `translate(${tx}px, ${ty}px)`; };
  const center = (p, sx = 195, sy = 422) => setPan(sx - p.x * z, sy - p.y * z);
  let zt = 0;
  function zoomAt(nz, sx, sy, anim) {
    nz = clamp(nz, ZMIN, ZMAX); if (Math.abs(nz - z) < 1e-4) return;
    const mx = (sx - tx) / z, my = (sy - ty) / z;            // точка карты под пальцем остаётся под пальцем
    clearTimeout(zt);
    mapEl.classList.toggle('zanim', !!anim); pan.classList.toggle('drag', !anim);
    z = nz; place(); setPan(sx - mx * z, sy - my * z);
    zt = setTimeout(() => { mapEl.classList.remove('zanim'); pan.classList.remove('drag'); }, anim ? 420 : 160);
  }
  mapEl.addEventListener('wheel', e => {
    e.preventDefault();
    const p = App.toScreen(e.clientX, e.clientY);
    if (e.ctrlKey) return zoomAt(z * Math.exp(-e.deltaY * 0.012), p.x, p.y);
    clearTimeout(zt); pan.classList.add('drag');
    setPan(tx - e.deltaX, ty - e.deltaY);
    zt = setTimeout(() => pan.classList.remove('drag'), 160);
  }, { passive: false });
  mapEl.addEventListener('dblclick', e => {
    if (e.target.closest('.c-pin')) return;
    const p = App.toScreen(e.clientX, e.clientY);
    zoomAt(z > 1.7 ? 1 : Math.min(ZMAX, z * 2), p.x, p.y, true);
  });
  let gz = 1;
  mapEl.addEventListener('gesturestart', e => { e.preventDefault(); gz = z; });
  mapEl.addEventListener('gesturechange', e => { e.preventDefault(); const p = App.toScreen(e.clientX, e.clientY); zoomAt(gz * e.scale, p.x, p.y); });
  App.drag(mapEl, {
    grab() { tx0 = tx; ty0 = ty; pan.classList.add('drag'); },
    move(dx, dy) { setPan(tx0 + dx, ty0 + dy); },
    end() { pan.classList.remove('drag'); },
    tap(e) { const o = e.target.closest('.c-poi, .h-fl, .h-say'); if (o) return poiTap(+o.closest('[data-p]').dataset.p); const p = e.target.closest('.c-pin'); if (p) pick(+p.dataset.i); else if (sel >= 0) setSheet(''); }
  });

  // ---- фрагмент: свой звук, отдельно от рассказа прогулки
  const fa = new Audio(frag.src); fa.preload = 'auto';
  const fragUI = () => {
    const on = !fa.paused, t = fa.currentTime || 0, d = fa.duration || frag.dur;
    node.classList.toggle('fplay', on);
    // кнопка внизу — только ▶/❚❚ (классы .i-play/.i-pause); время и полоска — на «Пластинке» в шторке
    const u = full.querySelector('.jf-lab u'); if (u) { u.style.width = t / d * 100 + '%'; full.querySelector('.jf-lab span').textContent = App.fmt(on || t > 0 ? t : d); }
  };
  const fragToggle = () => { if (fa.paused) { App.audio.pause(); fa.play().catch(() => {}); } else fa.pause(); };
  ['play', 'pause', 'timeupdate', 'ended'].forEach(ev => fa.addEventListener(ev, fragUI));
  fa.addEventListener('ended', () => { fa.currentTime = 0; });
  fragBtn.addEventListener('click', () => (WALKS[sel] && WALKS[sel].real ? fragToggle() : App.toast('В прототипе фрагмент есть только у «100 лет назад»')));

  // ---- шторка прогулки
  let sel = -1, state = '';
  const TOP = { '': 860, peek: 536, full: 59 };
  function setSheet(s) {
    state = s; node.dataset.sheet = s;
    sheet.style.transform = `translateY(${TOP[s]}px)`;
    sheet.classList.toggle('full', s === 'full');
    dim.style.opacity = s === 'full' ? .4 : 0;
    sbUpdate();
    if (!s) {
      node.classList.remove('picked'); pins.forEach(p => p.classList.remove('sel')); sel = -1;
      if (!fa.paused) fa.pause();
      full.scrollTop = 0; sheet.classList.remove('scrolled'); node.classList.remove('scrolled');
    }
  }
  // прокрутили ниже заголовка — сверху компактная шапка с «Купить», нижняя полоса уезжает
  // 19.11 Андрей: прокрутили — шторка становится полноценным экраном (до самого верха), ✕ в шапке
  full.addEventListener('scroll', () => {
    const on = state === 'full' && full.scrollTop > 150; if (on === sheet.classList.contains('scrolled')) return;
    sheet.classList.toggle('scrolled', on); node.classList.toggle('scrolled', on);
    sheet.style.transform = `translateY(${on ? 0 : TOP.full}px)`;
  });
  full.addEventListener('click', e => {
    const c = e.target.closest('.jf-cover'); if (!c) return;
    const w = WALKS[sel]; App.tick(); App.photos([{ src: w.img, title: w.title, sub: w.sub }], 0, [c]);
  });
  sheet.addEventListener('click', e => { if (e.target.closest('.cs-close')) { e.stopPropagation(); App.tick(); setSheet(''); } }, true);
  /* Шторка «Журнал» (19.11): шапка с линейкой, квадратные фото, заголовок капсом, разделы 01–05.
     Структура и тексты — из макетов «Шторка · Журнал · пик / раскрыта / прокрутили». */
  /* Лента в шторке: тянем мышью/пальцем или двумя пальцами на тачпаде, кадр встаёт по месту;
     «1 / 3 →» в линейке листает вперёд; тап по кадру раскрывает его на весь экран с галереей */
  const STEP = 204;
  function strip(sec, items, radius) {
    const s = sec.querySelector('.jf-strip'), n = sec.querySelector('.jf-n'), cap = sec.querySelector('.cap'), els = [...s.children];
    let cur = 0, l0 = 0;
    const set = i => {
      i = clamp(i, 0, items.length - 1); if (i === cur) return; cur = i;
      cap.innerHTML = `<b>${items[i].title}</b><span>${items[i].sub}</span>`;
      if (n) n.textContent = `${i + 1} / ${items.length} ${i === items.length - 1 ? '←' : '→'}`;
    };
    const go = i => s.scrollTo({ left: clamp(i, 0, items.length - 1) * STEP, behavior: 'smooth' });
    s.addEventListener('scroll', () => set(Math.round(s.scrollLeft / STEP)));
    App.drag(s, {
      axis: 'x',
      grab() { l0 = s.scrollLeft; s.classList.add('drag'); },
      move(dx) { s.scrollLeft = l0 - dx; },
      end(dx, dy, vx) {
        let i = Math.round(l0 / STEP);
        if (dx < -40 || vx < -400) i++; else if (dx > 40 || vx > 400) i--;
        if (clamp(i, 0, items.length - 1) !== Math.round(l0 / STEP)) App.tick();
        s.style.scrollSnapType = 'none'; go(i); setTimeout(() => { s.classList.remove('drag'); s.style.scrollSnapType = ''; }, 450);
      }
    });
    s.addEventListener('click', e => {
      if (performance.now() - (s._dragged || 0) < 300) return;
      const c = e.target.closest('[data-i]'); if (!c) return;
      App.tick(); App.photos(items, +c.dataset.i, els, i => { s.scrollLeft = i * STEP; set(i); }, radius);
    });
    if (n) n.addEventListener('click', () => { App.tick(); go(cur >= items.length - 1 ? 0 : cur + 1); });   // у одного отзыва счётчика нет
  }
  const thBg = w => w.img ? `style="background-image:url(${w.img})"` : '';
  const ttl = w => w.real ? 'Тель-Авив<br>100 лет назад' : w.title;
  let ph = 0;
  function fill(w) {
    const d = fromYou(w);
    peek.innerHTML = `<div class="j-rule"><span>Match · аудиопрогулка</span><span>${d.km}</span></div>
      <div class="row"><div class="th" ${thBg(w)}></div>
        <div class="tx"><b>${ttl(w)}</b><span>${w.real ? `${w.dur} · ${D.walk.pts} · ${D.walk.km} км<br>Рассказывает ${D.walk.guide}` : `${w.sub}<br>${w.dur}`}</span></div></div>
      <div class="start"><b>${w.real ? 'Старт у статуи Дрейфуса' : 'Старт — на метке'}</b><span>${d.walk}</span></div>`;
    q('.cs-top b').innerHTML = ttl(w);
    const idx = WALKS.indexOf(w) + 1;
    if (w.real) {
      ph = 0;
      full.innerHTML = `<div class="jf-head"><div class="j-rule"><span>Match · аудиопрогулка</span><span>Тель-Авив</span><span>${idx} / ${WALKS.length}</span>${XB()}</div>
          <h1>${ttl(w)}</h1><div class="jf-meta"><span>Рассказывает ${D.walk.guide}</span><span>${w.dur} · ${D.walk.pts} · ${D.walk.km} км</span></div></div>
        <div class="jf-cover" ${thBg(w)}></div>
        <div class="jf-quote"><p>«16 точек в центре города. Пески на месте улиц, розыгрыш участков и дом, которого больше нет»</p>
          <div class="jf-fly"><div class="jf-rec"><div class="jf-card"><div class="jf-disc"><s></s><em></em><button class="pb tap" aria-label="Фрагмент"><b><svg class="i-play" width="16" height="16" viewBox="0 0 16 16"><path d="M4.5 2.5L13 8L4.5 13.5Z" fill="#1C1B19" stroke="#1C1B19" stroke-width="1.5" stroke-linejoin="round"/></svg>${ICON.pause('#1C1B19', 16)}</b></button></div>
              <div class="jf-lab">Фрагмент<i><u></u></i><span>${App.fmt(frag.dur)}</span></div></div>
              <div class="jf-steps"><button class="tap" data-a="back" aria-label="Сначала"><svg width="16" height="14" viewBox="0 0 16 14"><rect x="1.5" y="1" width="2.8" height="12" rx="1" fill="#F0EADE"/><path d="M14.5 1.2L5.5 7L14.5 12.8Z" fill="#F0EADE" stroke="#F0EADE" stroke-linejoin="round"/></svg></button><i></i><button class="tap" data-a="fwd" aria-label="Вперёд на 15 секунд"><svg width="16" height="14" viewBox="0 0 16 14"><path d="M1.5 1.2L10.5 7L1.5 12.8Z" fill="#F0EADE" stroke="#F0EADE" stroke-linejoin="round"/><rect x="11.7" y="1" width="2.8" height="12" rx="1" fill="#F0EADE"/></svg></button></div></div>
            <div class="jf-nums"><div><b>16</b><span>точек в центре</span></div><div><b>35</b><span>коротких рассказов</span></div><div><b>2,6 км</b><span>пешком, 1,5 часа</span></div></div></div></div>
        <div class="jf-sec"><div class="j-rule"><span>01 — Тогда</span><button class="jf-n tap">1 / ${PHOTOS.length} →</button></div>
          <div class="jf-pair jf-then"><div class="cap"><b>${PHOTOS[0].title}</b><span>${PHOTOS[0].sub}</span></div><div class="jf-strip">${PHOTOS.map((p, i) => `<div class="jf-ph" data-i="${i}" style="background-image:url(${p.src})"></div>`).join('')}</div></div></div>
        <div class="jf-sec"><div class="j-rule"><span>02 — Что внутри</span><span>3</span></div>
          <div class="jf-abc"><div><i>a.</i>Около 35 коротких рассказов</div><div><i>b.</i>Архивные фото на точках</div><div><i>c.</i>Истории и песни в дорогу</div></div></div>
        <div class="jf-sec"><div class="j-rule"><span>03 — Маршрут</span><span>${D.walk.pts}</span></div>
          <div class="jf-route"><img src="${routeCard()}" alt=""></div>
          <div class="jf-start"><div><b>Старт: двор со статуей Дрейфуса</b><span>${d.text}</span></div><button class="jf-go tap soft" data-a="routes">${TURN}<span>Как добраться до старта</span></button></div></div>
        <div class="jf-sec"><div class="j-rule"><span>04 — Отзывы</span><button class="jf-n tap">1 / ${REVIEWS.length} →</button></div>
          <div class="jf-pair jf-revs"><div class="cap"><b>${REVIEWS[0].title}</b><span>${REVIEWS[0].sub}</span></div><div class="jf-strip">${REVIEWS.map((r, i) => `<img class="jf-shot" data-i="${i}" src="${r.src}" alt="">`).join('')}</div></div></div>
        <div class="jf-sec"><div class="j-rule"><span>05 — Полезно знать</span></div>
          <div class="jf-know"><div><b>${KI.inf}Когда угодно</b><span>Прогулка остаётся у вас навсегда</span></div>
            <div><b>${KI.heart}Вдвоём</b><div class="jf-two"><span>160 ₪ на двоих вместо&nbsp;200&nbsp;₪</span>${w.owned ? '' : '<button class="jf-buy2 tap soft">Купить на двоих</button>'}</div></div>
            <div><b>${KI.off}Без интернета</b><span>Скачайте прогулку заранее — в пути интернет не нужен</span></div></div></div>`;
      // «01 — Тогда» и «04 — Отзывы»: лента, следующий кадр торчит справа; тап — на весь экран
      strip(full.querySelector('.jf-then').parentNode, PHOTOS);
      strip(full.querySelector('.jf-revs').parentNode, REVIEWS, '12px');
      const rt = full.querySelector('.jf-route'); rt.addEventListener('click', () => { App.tick(); App.mapFrom(rt); });
      full.querySelector('.pb').addEventListener('click', fragToggle);
      full.querySelector('[data-a=back]').addEventListener('click', () => { fa.currentTime = 0; fragUI(); });
      full.querySelector('[data-a=fwd]').addEventListener('click', () => { fa.currentTime = Math.min((fa.duration || frag.dur) - .5, fa.currentTime + 15); fragUI(); });
      full.querySelector('[data-a=routes]').addEventListener('click', () => App.emit('ui:routes'));
      // «Вдвоём»: сразу купить на двоих (Андрей 19.11), та же условная покупка
      const b2 = full.querySelector('.jf-buy2'); if (b2) b2.addEventListener('click', () => { b2.textContent = 'Покупаем на двоих…'; buy(); });
    } else {
      /* 20.11 Андрей: «собери из того, что есть». На лендинге у этих прогулок только название, подзаголовок и длительность,
         на странице оплаты — цена. Точек, фрагмента и маршрута нет — их не выдумываем. */
      const revs = REVIEWS.filter(r => w.rev && r.sub.includes(w.rev));
      const nums = w.free
        ? `<div><b>${w.dur}</b><span>слушать</span></div><div><b>0 ₪</b><span>бесплатно</span></div><div><b>${d.km.replace(' от вас', '')}</b><span>от вас до старта</span></div>`
        : `<div><b>${w.dur}</b><span>пешком</span></div><div><b>${PRICE}</b><span>за одного</span></div><div><b>160 ₪</b><span>на двоих</span></div>`;
      let n = 0; const sec = t => `<div class="j-rule"><span>${String(++n).padStart(2, '0')} — ${t}</span></div>`;
      full.innerHTML = `<div class="jf-head"><div class="j-rule"><span>Match · аудиопрогулка</span><span>Тель-Авив</span><span>${idx} / ${WALKS.length}</span>${XB()}</div>
          <h1>${ttl(w)}</h1><div class="jf-meta"><span>${w.sub}</span><span>${w.dur}</span></div></div>
        ${w.img ? `<div class="jf-cover" ${thBg(w)}></div>` : ''}
        <div class="jf-quote"><div class="jf-fly"><div class="jf-nums jf-nums-row">${nums}</div></div></div>
        <div class="jf-sec">${sec('Старт')}
          <div class="jf-start"><div><b>Старт — на метке на карте</b><span>${d.text}</span></div><button class="jf-go tap soft" data-a="routes">${TURN}<span>Как добраться до старта</span></button></div></div>
        ${revs.length ? `<div class="jf-sec">${sec('Отзыв')}<div class="jf-pair jf-revs"><div class="cap"><b>${revs[0].title}</b><span>${revs[0].sub}</span></div><div class="jf-strip">${revs.map((r, i) => `<img class="jf-shot" data-i="${i}" src="${r.src}" alt="">`).join('')}</div></div></div>` : ''}
        <div class="jf-sec">${sec('Полезно знать')}
          <div class="jf-know"><div><b>${KI.inf}Когда угодно</b><span>${w.free ? 'Слушайте в любой день и сколько угодно раз' : 'Прогулка остаётся у вас навсегда'}</span></div>
            ${w.free ? '' : `<div><b>${KI.heart}Вдвоём</b><div class="jf-two"><span>160 ₪ на двоих вместо&nbsp;200&nbsp;₪</span></div></div>`}
            <div><b>${KI.off}Без интернета</b><span>Скачайте прогулку заранее — в пути интернет не нужен</span></div></div></div>
        <div class="jf-note">В прототипе у этой прогулки нет фрагмента, точек и карты маршрута</div>`;
      if (revs.length) strip(full.querySelector('.jf-revs').parentNode, revs, '12px');
      full.querySelector('[data-a=routes]').addEventListener('click', () => App.emit('ui:routes'));
    }
    [payBtn, topBuy].forEach(b => { b.classList.toggle('free', !!w.free); b.classList.toggle('owned', !!w.owned); b.innerHTML = `<span>${w.owned ? 'Начать прогулку' : w.free ? 'Слушать бесплатно' : `Купить · ${PRICE}`}</span>`; });
    fragUI();
    // пик по высоте содержимого: кнопки внизу всегда на одном месте (как в макете — 308 px у «100 лет назад»)
    TOP.peek = 844 - (22 + peek.offsetHeight + 14 + 48 + 36);
    node.style.setProperty('--ctl-up', `${TOP.peek - 10 - 816}px`);
  }
  function pick(i, to = 'peek') {
    const w = WALKS[i];
    if (PoiSheet.isOpen()) PoiSheet.close();
    if (sel !== i) { if (!fa.paused) fa.pause(); fa.currentTime = 0; sel = i; fill(w); App.tick(); }
    node.classList.add('picked'); pins.forEach((p, k) => p.classList.toggle('sel', k === i));
    q('.c-route').classList.toggle('on', !!w.real);
    center(w.real ? ROUTE_C : w.p, 195, w.real ? 290 : 300);   // у «100 лет назад» — весь путь над шторкой
    setSheet(to);
  }
  q('.cs-x').addEventListener('click', () => setSheet(''));

  /* ---- арт, музеи, головы (20.11) */
  const poiNode = el(`<div class="sheet sh-poi">${App.GRAB}<div class="po-in"></div></div>`);
  const PoiSheet = App.Sheet('poi', poiNode, { accept: () => poiNode.querySelector('.po-in').scrollTop <= 0, onClose() { pois.forEach(p => p.classList.remove('sel')); } });
  const poiIn = poiNode.querySelector('.po-in');
  function poiOpen(i) {
    const o = POIS[i], d = fromYou(o), museum = o.kind === 'museum';
    poiIn.innerHTML = `<div class="j-rule"><span>${museum ? 'Музей · партнёр Match' : 'Стрит-арт · бесплатно'}</span><span>${d.km}</span></div>
      <h2>${o.title}</h2><div class="po-sub">${museum ? o.lead : `${o.addr} · ${d.walk}`}</div>
      <div class="po-ph" style="background-image:url(${o.img})"></div><div class="po-cr">${o.credit}</div>
      ${museum
        ? `${o.secs.map(([h, t], k) => `<div class="po-sec"><div class="j-rule"><span>${String(k + 1).padStart(2, '0')} — ${h}</span></div><p>${t}</p></div>`).join('')}
           <div class="po-addr"><b>${o.addr}</b><span>${d.text}</span></div>
           <div class="po-note">В прототипе: условия для гостей Match ещё не определены</div>`
        : `<div class="po-tx">${o.text.map(t => `<p>${t}</p>`).join('')}</div>`}
      <button class="jf-go tap soft po-go">${TURN}<span>Как добраться</span></button>`;
    poiNode.classList.toggle('museum', museum);
    poiIn.scrollTop = 0;
    poiIn.querySelector('.po-go').addEventListener('click', () => App.emit('ui:routes'));
    poiIn.querySelector('.po-ph').addEventListener('click', e => { App.tick(); App.photos([{ src: o.img, title: o.title, sub: o.credit }], 0, [e.currentTarget]); });
    pois.forEach(p => p.classList.toggle('sel', +p.dataset.p === i));
    PoiSheet.open();
  }
  // голова: тап — рассказывает о себе, ещё тап — замолкает. Над ней значок с волной и временем.
  let ha = null, hi = -1;
  const heads = pois.filter(p => p.classList.contains('c-head'));
  function hush() {
    if (ha) { ha.pause(); ha = null; }
    heads.forEach(h => h.classList.remove('talk')); hi = -1;
  }
  function talk(i) {
    if (hi === i) { hush(); return; }
    hush(); if (!fa.paused) fa.pause(); App.audio.pause();
    const o = POIS[i], h = heads.find(x => +x.dataset.p === i), t = h.querySelector('.h-say em');
    const a = ha = new Audio(o.audio); hi = i;
    const left = () => { t.textContent = App.fmt(Math.max(0, (a.duration || o.dur) - a.currentTime)); };
    ha.addEventListener('timeupdate', left); ha.addEventListener('ended', hush);
    left(); h.classList.add('talk'); App.haptic && App.haptic('tap');
    ha.play().catch(() => { hush(); App.toast('Не получилось включить звук'); });
  }
  /* прогулка голов: ~9 м/с по карте (на экране — около 2 px/с). На части поворотов останавливаются на 1,5–3 с:
     к остановке замедляются, потом плавно трогаются. Позиция — transform с дробными пикселями, зум берём
     из настоящей ширины картинки, чтобы при анимированном зуме головы ехали вместе с картой. */
  const STROLL = 9 * C.ppm, EASE = 5;   // EASE — за сколько пикселей до остановки начинают тормозить
  const img = q('.c-img');
  const walkers = heads.map(h => ({ h, o: POIS[h.dataset.p], wait: 0, v: 1, stopAt: Infinity })).filter(w => w.o.path);
  walkers.forEach((w, k) => { w.h.style.left = w.h.style.top = '0px'; w.o.s = w.o.path.total * (k * .37); plan(w); });   // стартуют с разных мест петли
  function plan(w) {   // следующая остановка: один из поворотов впереди, примерно каждый третий
    const T = w.o.path.turns.filter(t => t > w.o.s + EASE * 2);
    w.stopAt = (T.find(() => Math.random() < .35) ?? Infinity);
  }
  function at(P, s) {
    let k = 1; while (k < P.len.length - 1 && P.len[k] < s) k++;
    const a = P.pts[k - 1], b = P.pts[k], f = (s - P.len[k - 1]) / ((P.len[k] - P.len[k - 1]) || 1);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tPrev = 0;
  function stroll(t) {
    requestAnimationFrame(stroll);
    const dt = Math.min(.1, (t - (tPrev || t)) / 1000); tPrev = t;
    if (document.hidden || !node.classList.contains('on') || node.classList.contains('list')) return;
    const zz = img.offsetWidth / C.w || z, move = !still;
    walkers.forEach(w => {
      const o = w.o, P = o.path, i = +w.h.dataset.p;
      if (move) {
        if (w.wait > 0) w.wait -= dt;
        const goal = hi === i || w.wait > 0 ? 0 : Math.min(1, Math.sqrt(Math.max(0, w.stopAt - o.s) / EASE));
        w.v += (goal - w.v) * Math.min(1, dt * (goal < w.v ? 6 : 1.4));   // тормозят быстро, трогаются мягко
        o.s = Math.min(o.s + STROLL * w.v * dt, w.stopAt);
        if (o.s >= w.stopAt - .05 && w.wait <= 0 && hi !== i) { w.wait = 1.5 + Math.random() * 1.5; w.stopAt = Infinity; w.replan = true; }
        if (w.replan && w.wait <= 0) { w.replan = false; plan(w); }
        if (o.s >= P.total) { o.s -= P.total; plan(w); }
        o.p = at(P, o.s);
      }
      w.h.style.transform = `translate3d(${(o.p.x * zz).toFixed(2)}px, ${(o.p.y * zz).toFixed(2)}px, 0)`;
    });
  }
  if (walkers.length) requestAnimationFrame(stroll);
  /* 20.11 Андрей: кнопка слоёв под кружком стиля. Одна иконка, по тапу по кругу:
     всё вместе → только прогулки Match → только бесплатный слой (арт, музеи, головы) → всё вместе */
  const LAYERS = [{ id: 'all', name: 'Всё вместе' }, { id: 'walks', name: 'Только прогулки Match' }, { id: 'extra', name: 'Только бесплатный слой: арт, музеи, герои' }];
  let layer = 0;
  q('.c-layers').addEventListener('click', () => {
    layer = (layer + 1) % LAYERS.length; const L = LAYERS[layer];
    node.dataset.layer = L.id;
    if (L.id === 'walks') { hush(); PoiSheet.close(); }
    if (L.id === 'extra' && state) setSheet('');
    App.toast(`Слои: ${L.name}`);
  });
  function poiTap(i) {
    App.tick();
    if (POIS[i].kind === 'head') return talk(i);
    if (state) setSheet('');
    poiOpen(i);
  }
  dim.addEventListener('click', () => setSheet('peek'));
  // тянем шторку: вверх — на весь экран, вниз — обратно к карте
  let y0 = 0;
  App.drag(sheet, {
    axis: 'y',
    start: e => !e.target.closest('.jf-steps, .jf-disc'),
    accept: (dx, dy) => state !== 'full' || (dy > 0 && full.scrollTop <= 0),
    grab() { y0 = TOP[state]; sheet.classList.add('drag'); },
    move(dx, dy) {
      const y = clamp(y0 + dy, 59, 860);
      sheet.style.transform = `translateY(${y}px)`;
      dim.style.opacity = clamp((TOP.peek - y) / (TOP.peek - 59), 0, 1) * .4;
      sheet.classList.toggle('full', y < 300);
    },
    end(dx, dy, vx, vy) {
      sheet.classList.remove('drag');
      const y = y0 + dy;
      if (vy < -500 || (vy < 300 && y < 300)) setSheet('full');
      else if (y > 700 || (vy > 900 && y0 === TOP.peek)) setSheet('');
      else setSheet('peek');
    }
  });
  sheet.addEventListener('wheel', e => { if (state === 'peek' && e.deltaY > 0) { e.preventDefault(); setSheet('full'); } else if (state === 'full' && e.deltaY < 0 && full.scrollTop <= 0) setSheet('peek'); }, { passive: false });
  peek.addEventListener('click', () => state === 'peek' && setSheet('full'));

  /* Покупка условная: настоящего экрана оплаты в UI пока нет. Кнопка показывает, что прогулка куплена,
     и каталог раскрывается в прогулку: «Андрей, ждём вас на точке старта». */
  let paying = false;
  const say = text => [payBtn, topBuy].forEach(b => { const o = b.querySelector('span:not(.out)'); const n = el(`<span class="pre">${text}</span>`); b.append(n); void n.offsetWidth; if (o) { o.classList.add('out'); setTimeout(() => o.remove(), 300); } n.classList.remove('pre'); });
  const buy = async () => {
    const w = WALKS[sel]; if (!w || paying) return;
    if (!w.real) return App.toast('В прототипе работает только «100 лет назад»');
    // куплено: кнопка становится чёрной «Начать прогулку», прогулка начинается по второму нажатию (Андрей 19.11)
    if (w.owned) { fa.pause(); Catalog.hide(true); window.Flow.go({ kind: 'far' }); return; }
    paying = true; fa.pause();
    say('Покупаем…'); await App.wait(750);
    say('Прогулка ваша'); App.haptic('tap'); await App.wait(850);
    w.owned = true; [payBtn, topBuy].forEach(b => b.classList.add('owned')); say('Начать прогулку');
    const b2 = full.querySelector('.jf-buy2'); if (b2) b2.remove();
    paying = false;
  };
  payBtn.addEventListener('click', buy); topBuy.addEventListener('click', buy);

  // ---- «Карта / Список»
  const seg = q('.c-seg'), thumb = seg.querySelector('i'), segBtns = [...seg.querySelectorAll('button')];
  function view(v) {
    node.classList.toggle('list', v === 'list'); sbUpdate();
    segBtns.forEach(b => b.classList.toggle('on', b.dataset.v === v));
    const b = segBtns.find(x => x.dataset.v === v);
    thumb.style.width = b.offsetWidth + 'px'; thumb.style.transform = `translateX(${b.offsetLeft - 4}px)`;
    if (v === 'list' && state) setSheet('');
  }
  segBtns.forEach(b => b.addEventListener('click', () => { App.tick(); view(b.dataset.v); }));
  const feed = q('.c-feed');
  /* список «Журнал»: плоские строки с линейками. Бесплатная в списке скрыта, как в макете (Андрей 19.11) — она только на карте.
     Сортировка (19.11): «Сначала: Ближе / Дешевле» справа от «8 прогулок». Расстояние видно в каждой строке.
     Цены пока у всех 100 ₪, поэтому «Дешевле» внутри одной цены тоже ставит ближние выше. */
  const listed = WALKS.filter(w => !w.free);
  listed.forEach(w => { w.dist = fromYou(w); w.price = w.price || 100; });
  // 20.11 Андрей: проработанные прогулки — наверху списка и со звёздочкой в углу фото, как у пина на карте
  const top = w => w.real ? 0 : w.star ? 1 : 2;
  const thStar = `<svg class="th-star" width="18" height="18" viewBox="-80 -80 160 160"><path d="${STAR}" fill="#FFFCF5" stroke="#FFFCF5" stroke-width="30" stroke-linejoin="round"/><path d="${STAR}" fill="#F2CF4A" stroke="#282828" stroke-width="9" stroke-linejoin="round"/></svg>`;
  feed.innerHTML = listed.map(w => `<div class="c-card tap soft" data-id="${w.id}"><div class="th" ${thBg(w)}>${w.real ? thStar : ''}</div><div class="tx"><b>${w.title}</b><span>${w.sub}</span><div><span>${w.dur} · ${w.dist.km}</span><em>${PRICE}</em></div></div></div>`).join('');
  let sortBy = 'near';
  function sortList(by, anim) {
    sortBy = by;
    const cmp0 = by === 'cheap' ? (a, b) => a.price - b.price || a.dist.m - b.dist.m : (a, b) => a.dist.m - b.dist.m, cmp = (a, b) => top(a) - top(b) || cmp0(a, b);
    const cards = [...feed.children], before = new Map(cards.map(c => [c, c.offsetTop]));
    [...listed].sort(cmp).forEach(w => feed.append(feed.querySelector(`[data-id="${w.id}"]`)));
    if (anim) cards.forEach(c => {                                     // строки переезжают на новые места
      const dy = before.get(c) - c.offsetTop; if (!dy) return;
      c.style.transition = 'none'; c.style.transform = `translateY(${dy}px)`; void c.offsetWidth;
      c.style.transition = 'transform .5s var(--sheet)'; c.style.transform = '';
    });
    node.querySelectorAll('.c-sort button').forEach(b => b.classList.toggle('on', b.dataset.s === by));
  }
  sortList('near');
  node.querySelector('.c-sort').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.dataset.s === sortBy) return; App.tick(); sortList(b.dataset.s, true); });
  App.onTap(feed, e => { const c = e.target.closest('.c-card'); if (!c) return; view('map'); pick(WALKS.findIndex(w => w.id === c.dataset.id), 'full'); });

  // ---- «я здесь» и город
  q('.c-loc').addEventListener('click', () => { if (state) setSheet(''); center(YOU); const y = q('.c-you'); y.classList.remove('ping'); void y.offsetWidth; y.classList.add('ping'); });
  const CHK = '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7.5l3.2 3.2L12 3.8" fill="none" stroke="#FFFCF5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const cityNode = el(`<div class="sheet sh-city"><div class="cs-grab"></div><h2>Город</h2><div>
    <div class="ct-row on tap soft" data-c="tlv"><div class="ph" style="background-image:url(${J}tlv.jpg)"></div><div class="tx"><b>Тель-Авив</b><span>город на песке</span><small>Вы здесь · ${WALKS.length} прогулок</small></div><i>${CHK}</i></div>
    <div class="ct-row tap soft" data-c="jer"><div class="ph" style="background-image:url(${J}jerusalem.jpg)"></div><div class="tx"><b>Иерусалим</b><span>город на холмах</span><small>54 км от вас</small></div><i>${CHK}</i></div>
    <div class="ct-row soon"><div class="ph" style="background-image:url(${J}haifa.jpg)"></div><div class="tx"><b>Хайфа</b><span>город на горе</span><small>Готовим прогулки</small></div><em>Скоро</em></div></div></div>`);
  const City = App.Sheet('city', cityNode);
  q('.c-city').addEventListener('click', () => City.open());
  cityNode.addEventListener('click', async e => {
    const r = e.target.closest('.ct-row'); if (!r || !r.dataset.c) return;
    if (r.dataset.c === 'tlv') return City.close();
    // Иерусалима в прототипе нет: показываем выбор и честно возвращаемся
    const rows = [...cityNode.querySelectorAll('.ct-row[data-c]')];
    rows.forEach(x => x.classList.toggle('on', x === r)); App.tick();
    await App.wait(450); City.close(); App.toast('Иерусалима в прототипе нет');
    await App.wait(500); rows.forEach(x => x.classList.toggle('on', x.dataset.c === 'tlv'));
  });

  // ---- стиль карты: строка состояния светлая на тёмной карте, пока карта видна
  function sbUpdate() {
    App.statusLight('cat', !!style.dark && node.classList.contains('on') && !node.classList.contains('list') && state !== 'full');
  }
  function setStyle(id) {
    const s = STYLES.find(x => x.id === id); if (!s || s === style) return;
    style = s;
    try { localStorage.setItem('match.mapStyle', s.id); } catch (_) {}
    const old = [...node.querySelectorAll('.c-img')], n = el(`<img class="c-img fresh" src="${s.src}" alt="">`);
    old[old.length - 1].after(n); place();
    let shown = false;
    const show = () => { if (shown) return; shown = true; n.classList.remove('fresh'); setTimeout(() => old.forEach(o => o.remove()), 450); };
    (n.decode ? n.decode() : Promise.resolve()).then(show, show);
    setTimeout(show, 1200);                                   // если decode завис (фоновая вкладка) — всё равно показываем
    node.classList.toggle('dark', !!s.dark); sbUpdate();
    App.mapStyle = s; App.emit('mapstyle', s);
    const rc = full.querySelector('.jf-route img'); if (rc) rc.src = routeCard();
  }
  function routeCard() { return style.walk ? `assets/map/styles/${style.id}/route-card.jpg` : 'assets/map/route-card.svg'; }

  q('.c-prof').addEventListener('click', () => App.toast('Профиля в прототипе нет'));

  /* ---- кружок стиля на карте (20.11, вместо кружков справа от телефона): нажатие — следующий стиль.
     В кружке — превью стиля, который включится. */
  const styleBtn = q('.c-style');
  const nextStyle = () => STYLES[(STYLES.indexOf(style) + 1) % STYLES.length];
  const styleMark = () => { styleBtn.querySelector('i').style.backgroundImage = `url(${nextStyle().thumb})`; };
  styleBtn.addEventListener('click', () => { const s = nextStyle(); setStyle(s.id); styleMark(); pickMark(); App.toast(`Стиль карты: ${s.name}`); });
  styleMark();

  /* ---- кружки стилей справа от телефона (19.11): ведущий щёлкает и показывает, как меняется карта.
     Это не часть приложения — как подсказки слева, прячется клавишей H и виден только на каталоге. */
  const picker = el(`<aside id="mapstyles"><div class="ms-k">Стиль карты</div>${STYLES.map(s => `<button class="ms-b" data-s="${s.id}" type="button"><i style="background-image:url(${s.thumb})"></i><span>${s.name}</span></button>`).join('')}</aside>`);
  document.body.append(picker);
  const pickMark = () => picker.querySelectorAll('.ms-b').forEach(b => b.classList.toggle('on', b.dataset.s === style.id));
  picker.addEventListener('click', e => { const b = e.target.closest('.ms-b'); if (!b) return; App.tick(); setStyle(b.dataset.s); pickMark(); });
  pickMark();

  const Catalog = window.Catalog = {
    show() {
      App.emit('ui:closeall');
      WALKS.forEach(w => { delete w.owned; });          // для показа: каждый раз заново «Купить»
      if (window.Flow) window.Flow.cancel();
      App.audio.pause();
      node.classList.remove('leave'); node.classList.add('on'); App.walk.el.classList.add('gone');
      view('map'); setSheet(''); z = 1; place(); center(VIEW); sbUpdate();
      // метки падают на карту одна за другой
      pins.forEach((p, i) => { p.classList.remove('drop'); void p.offsetWidth; p.style.animationDelay = 0.25 + i * 0.07 + 's'; p.querySelector('svg').style.animationDelay = 0.25 + i * 0.07 + 's'; p.classList.add('drop'); });
      App.backdrop(D.walk.cover); App.hud('catalog'); document.body.classList.add('cat-on');
    },
    hide(zoom) {
      if (!fa.paused) fa.pause(); hush(); PoiSheet.close();
      setSheet('');
      if (zoom) { node.classList.add('leave'); setTimeout(() => node.classList.remove('on', 'leave'), 650); } else node.classList.remove('on');
      App.walk.el.classList.remove('gone');
      App.statusLight('cat', false); document.body.classList.remove('cat-on');
    },
    get isOpen() { return node.classList.contains('on'); },
    walks: WALKS, price: parseInt(PRICE, 10)   // финал прогулки: следующая прогулка со скидкой
  };
  node.classList.toggle('dark', !!style.dark);
  App.mapStyle = style; App.emit('mapstyle', style);
  place(); setPan(195 - VIEW.x, 422 - VIEW.y);
})();
