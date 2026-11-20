/* Финал прогулки (20.11). В боте после Бялика: карточки на память (в приложение не переносим, решение Юли 13.11),
   «Что ещё посмотреть?» — пять мест, Instagram, анкета и скидка 20% на следующую прогулку на неделю.
   Здесь то же по порядку, в «журнальном» стиле каталога: пройденный маршрут, места, ссылки, следующая прогулка. */
(() => {
  const { el, $ } = App, D = window.DATA, AD = window.AUDIODATA;
  const OUT = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3.5 8.5l5-5M4.5 3.5h4v4" fill="none" stroke="#282828" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const X = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="#282828" stroke-width="1.6" stroke-linecap="round"/></svg>';
  // сколько звука в прогулке: все точки (приветствие — первая часть точки 1) и истории в дорогу
  const sec = Object.keys(AD).filter(k => /^(p\d+|road\d)$/.test(k)).reduce((s, k) => s + AD[k].parts.reduce((a, x) => a + x.dur, 0), 0);
  const MIN = Math.round(sec / 60);

  const node = el('<div class="fin"><div class="fin-in"></div></div>');
  $('#app').append(node);
  const box = node.querySelector('.fin-in');

  function render() {
    const C = window.Catalog, w = C && C.walks ? C.walks.find(x => x.star) : null;
    const price = w ? w.price || C.price : 100, sale = Math.round(price * 0.8);
    let k = 0; const rule = (t, r = '') => `<div class="j-rule"><span>${String(++k).padStart(2, '0')} — ${t}</span><span>${r}</span></div>`;
    box.innerHTML = `
      <div class="fin-head"><div class="j-rule"><span>Match · аудиопрогулка</span><span>Финал</span><button class="fin-x tap" aria-label="Закрыть">${X}</button></div>
        <h1>${D.walk.title}</h1>
        <div class="jf-meta"><span>Рассказывала ${D.walk.guide}</span><span>Пройдено ${D.walk.count} из ${D.walk.count}</span></div></div>
      <div class="jf-route fin-route"><img src="assets/map/route-card.svg" alt=""></div>
      <div class="jf-nums jf-nums-row fin-nums"><div><b>${D.walk.count}</b><span>точек</span></div><div><b>${D.walk.km} км</b><span>пешком</span></div><div><b>${MIN} мин</b><span>рассказов</span></div></div>
      <div class="jf-sec">${rule('Что ещё посмотреть', D.more.length)}
        <p class="fin-p">Пять мест, куда ещё можно сходить, если вас заинтересовала тема прогулки.</p>
        <div class="fin-more">${D.more.map((m, i) => `<div class="fin-m"><b class="fin-num">${i + 1}</b><div class="fin-mt">
          <h3>${m.name}</h3><p>${m.text}</p>
          <dl><dt>Адрес</dt><dd>${m.addr}</dd><dt>Часы</dt><dd>${m.hours}</dd><dt>Цена</dt><dd>${m.price}</dd></dl></div></div>`).join('')}</div></div>
      <div class="jf-sec">${rule('Расскажите о нас')}
        <p class="fin-p">Мы будем рады, если вам захочется рассказать о нас в соцсетях или просто друзьям при встрече. Давайте вместе делать жизнь в городе интереснее!</p>
        <a class="jf-go tap soft" href="${D.links.insta}" target="_blank" rel="noopener"><span>Instagram @match.walks</span>${OUT}</a></div>
      <div class="jf-sec">${rule('Анкета', '2 минуты')}
        <p class="fin-p">Если остались силы на двухминутное усилие, заполните, пожалуйста, небольшую анкету. Ваша обратная связь поможет нам становиться ещё лучше. Спасибо!</p>
        <a class="jf-go tap soft" href="${D.links.form}" target="_blank" rel="noopener"><span>Заполнить анкету</span>${OUT}</a></div>
      <div class="jf-sec">${rule('Следующая прогулка', '−20%')}
        <p class="fin-p">Если захотите пройти ещё одну прогулку — в течение недели на любую из них действует скидка 20%. До встреч!</p>
        ${w ? `<div class="fin-next"><div class="fin-th" style="background-image:url('${w.img}')"></div><div class="fin-nt"><b>${w.title}</b><span>${w.sub} · ${w.dur}</span>
          <span class="fin-price"><b>${sale} ₪</b><s>${price} ₪</s></span></div></div>` : ''}
        <button class="fin-buy tap soft" data-a="buy">Выбрать прогулку со скидкой</button>
        <div class="fin-note">Скидка действует 7 дней</div></div>
      <button class="jf-go tap soft fin-home" data-a="home"><span>На карту прогулок</span></button>`;
    box.querySelector('.fin-x').addEventListener('click', toCatalog);
    box.querySelector('[data-a="home"]').addEventListener('click', toCatalog);
    box.querySelector('[data-a="buy"]').addEventListener('click', () => { toCatalog(); App.toast('Скидка 20% на любую прогулку — 7 дней'); });
    box.querySelector('.fin-route').addEventListener('click', () => App.emit('map:open'));
  }
  function toCatalog() {
    hide();
    if (window.Catalog && window.Catalog.show) window.Catalog.show(); else window.Flow.go({ kind: 'far' });
  }
  function show() {
    render(); box.scrollTop = 0;
    node.classList.add('on'); App.walk.el.classList.add('gone');
    App.haptic && App.haptic('arrive');
  }
  function hide() {
    if (!node.classList.contains('on')) return;
    node.classList.remove('on'); App.walk.el.classList.remove('gone');
  }
  App.on('ui:closeall', hide);
  window.Finale = { show, hide, get isOpen() { return node.classList.contains('on'); } };
})();
