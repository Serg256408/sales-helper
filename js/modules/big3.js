// Модуль «Итог звонка» — 4 обязательных чекбокса

import { B3_SNOW_LABELS, B3_SNOW_HINTS, B3_SNOW_DETAILS, B3_ASPHALT_LABELS, B3_ASPHALT_HINTS, B3_ASPHALT_DETAILS, B3_TOTAL } from '../data/big3-data.js';

let b3state = [false, false, false, false];
let b3min = false;

export function getB3State() {
  return b3state;
}

export function toggleB3(n) {
  b3state[n - 1] = !b3state[n - 1];
  const el = document.getElementById('b3-' + n);
  const cb = document.getElementById('b3cb-' + n);
  el.classList.toggle('checked', b3state[n - 1]);
  cb.innerHTML = b3state[n - 1] ? '✓' : '';

  const done = b3state.filter(x => x).length;
  document.getElementById('b3fill').style.width = (done / B3_TOTAL * 100) + '%';
  document.getElementById('b3count').textContent = done + ' / ' + B3_TOTAL;

  if (done === B3_TOTAL) {
    document.getElementById('b3count').textContent = '✓ ВСЕ ' + B3_TOTAL + '!';
    document.getElementById('b3fill').style.background = '#22c55e';
  } else {
    document.getElementById('b3fill').style.background = '#ffc107';
  }
}

export function toggleB3Detail(n) {
  document.getElementById('b3d-' + n).classList.toggle('show');
}

export function toggleBig3() {
  b3min = !b3min;
  document.getElementById('big3mod').classList.toggle('minimized', b3min);
  document.querySelector('.big3-toggle').textContent = b3min ? '▲ ИТОГ ЗВОНКА' : '▼ СВЕРНУТЬ';
}

export function resetBig3() {
  b3state = [false, false, false, false];
  for (let i = 1; i <= B3_TOTAL; i++) {
    document.getElementById('b3-' + i).classList.remove('checked');
    document.getElementById('b3cb-' + i).innerHTML = '';
    document.getElementById('b3d-' + i).classList.remove('show');
  }
  document.getElementById('b3fill').style.width = '0%';
  document.getElementById('b3fill').style.background = '#ffc107';
  document.getElementById('b3count').textContent = '0 / ' + B3_TOTAL;
}

export function renderBig3(mode) {
  const labels = mode === 'snow' ? B3_SNOW_LABELS : B3_ASPHALT_LABELS;
  const hints = mode === 'snow' ? B3_SNOW_HINTS : B3_ASPHALT_HINTS;
  const details = mode === 'snow' ? B3_SNOW_DETAILS : B3_ASPHALT_DETAILS;

  const items = document.querySelectorAll('.big3-item');
  items.forEach((el, i) => {
    el.querySelector('.big3-label').textContent = labels[i];
    el.querySelector('.big3-hint').textContent = hints[i];
    el.querySelector('.big3-detail').textContent = details[i];
  });
  resetBig3();
}

// Глобальные функции для onclick
window.toggleB3 = toggleB3;
window.toggleB3Detail = toggleB3Detail;
window.toggleBig3 = toggleBig3;
