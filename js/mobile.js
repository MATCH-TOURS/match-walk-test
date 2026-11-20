/* Телефонная версия для теста на улице (20.11, после встречи с Полиной и Юлей).
   Включается сама на телефоне или по ?m; ?desk — всегда презентация с рамкой.
   20.11 вечер: вся прогулка, 16 точек, как в боте (было — первые 4). */
(() => {
  const q = location.search;
  const phone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
  const on = window.MOBILE = !/[?&]desk\b/.test(q) && (/[?&]m\b/.test(q) || phone);
  if (!on) return;
  document.documentElement.classList.add('mobile');
})();
