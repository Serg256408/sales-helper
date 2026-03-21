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

  // Итог звонка — только на вкладках звонков
  const big3 = document.getElementById('big3mod');
  if (big3) {
    big3.style.display = (t === 'tree' || t === 'cbtree') ? '' : 'none';
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

// Глобальные функции для onclick
window.tab = tab;
window.cpy = cpy;
