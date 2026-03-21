// Рендер и поиск возражений

import { OBJ_SNOW, OBJ_ASPHALT } from '../data/objections.js';

export function renderObjSnow() {
  document.getElementById('obj-c').innerHTML = OBJ_SNOW.map((o, i) =>
    '<div class="obj" id="ob-' + i + '" data-tags="' + o.tags + '">' +
    '<div class="obj-q" onclick="document.getElementById(\'ob-' + i + '\').classList.toggle(\'op\')">' +
    o.q + '<span class="ar">▾</span></div>' +
    '<div class="obj-a">' + o.a + '</div></div>'
  ).join('');
}

export function renderObjAsphalt() {
  document.getElementById('obj-c').innerHTML = OBJ_ASPHALT.map((o, i) =>
    '<div class="obj" id="ob-' + i + '" data-tags="' + o.tags + '">' +
    '<div class="obj-q" onclick="document.getElementById(\'ob-' + i + '\').classList.toggle(\'op\')">' +
    o.q + '<span class="ar">▾</span></div>' +
    '<div class="obj-a">' + o.a + '</div></div>'
  ).join('');
}

export function filterObj() {
  const q = document.getElementById('osrch').value.toLowerCase();
  document.querySelectorAll('.obj').forEach(e => {
    e.classList.toggle('hidden',
      q && !e.textContent.toLowerCase().includes(q) && !(e.dataset.tags || '').includes(q)
    );
  });
}

// Глобальная функция для oninput
window.fobj = filterObj;
