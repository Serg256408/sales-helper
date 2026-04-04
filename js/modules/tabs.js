// Навигация по вкладкам + утилиты

import { getServiceMode } from './service-mode.js';

// Переключение вкладки
export function tab(t) {
  document.querySelectorAll('.tc').forEach(e => e.classList.remove('act'));
  document.querySelectorAll('.nav-i').forEach(e => e.classList.remove('act'));

  if (t === 'calc') {
    const mode = getServiceMode();
    if (mode === 'snow') {
      document.getElementById('tab-calc').classList.add('act');
    } else {
      document.getElementById('tab-calc-a').classList.add('act');
    }
  } else {
    const el = document.getElementById('tab-' + t);
    if (el) el.classList.add('act');
  }

  const n = document.querySelector('.nav-i[data-tab="' + t + '"]');
  if (n) n.classList.add('act');

  // Ведение сделки — перерендер при переключении
  if (t === 'followup' && typeof window._renderFu === 'function') {
    window._renderFu();
  }

  // Итог звонка — только на вкладках звонков
  const big3 = document.getElementById('big3mod');
  if (big3) {
    big3.style.display = (t === 'tree' || t === 'cbtree' || t === 'followup') ? '' : 'none';
  }
}

// Копирование текста в буфер
export function cpy(btn) {
  const s = btn.parentElement;
  const t = s.innerText
    .replace('Скопировать', '')
    .replace(/^[А-Яа-яЁё ]+\n/, '')
    .trim();
  navigator.clipboard.writeText(t).then(() => {
    btn.textContent = '✓';
    setTimeout(() => btn.textContent = 'Скопировать', 1500);
  });
}

// Лайтбокс — увеличение фото по клику
document.addEventListener('click', e => {
  const img = e.target.closest('.la-img img');
  if (img) {
    const box = document.createElement('div');
    box.className = 'img-lightbox';
    box.innerHTML = '<img src="' + img.src + '">';
    box.onclick = () => box.remove();
    document.addEventListener('keydown', function esc(ev) {
      if (ev.key === 'Escape') { box.remove(); document.removeEventListener('keydown', esc); }
    });
    document.body.appendChild(box);
  }
  // Закрытие лайтбокса по клику
  if (e.target.closest('.img-lightbox')) {
    e.target.closest('.img-lightbox').remove();
  }
});

// Глобальные функции для onclick
window.tab = tab;
window.cpy = cpy;
