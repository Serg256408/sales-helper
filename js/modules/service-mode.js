// Переключение режимов: Снег / Асфальт

import { initTrees } from './tree.js';
import { calcSnow, calcAsphalt } from './calculator.js';
import { renderObjSnow, renderObjAsphalt } from './objections.js';
import { renderBig3 } from './big3.js';
import { tab } from './tabs.js';
import { CHEAT_SNOW, CHEAT_ASPHALT } from '../data/cheat-sheets.js';

let serviceMode = 'asphalt';

export function getServiceMode() {
  return serviceMode;
}

export function setSvc(mode) {
  serviceMode = mode;

  // Кнопки переключения
  const snowBtn = document.getElementById('b-svc-snow');
  const asphBtn = document.getElementById('b-svc-asph');
  snowBtn.className = 'svc-btn' + (mode === 'snow' ? ' on-snow' : '');
  asphBtn.className = 'svc-btn' + (mode === 'asphalt' ? ' on-asphalt' : '');

  // Тариф снега
  document.getElementById('snow-tariff-toggle').style.display = mode === 'snow' ? 'flex' : 'none';

  // Подзаголовок
  document.getElementById('hdr-sub-text').textContent = mode === 'snow'
    ? 'Помощник МОП · Вывоз снега · с 2014 года'
    : 'Помощник МОП · Асфальтирование и благоустройство · с 2014 года';

  // Тема
  document.body.classList.remove('mode-snow', 'mode-asphalt');
  document.body.classList.add(mode === 'snow' ? 'mode-snow' : 'mode-asphalt');

  // Деревья скриптов
  initTrees(mode);

  // Калькулятор
  document.getElementById('tab-calc').style.display = mode === 'snow' ? '' : 'none';
  document.getElementById('tab-calc-a').style.display = mode === 'asphalt' ? '' : 'none';
  if (mode === 'asphalt') calcAsphalt(); else calcSnow();

  // Возражения
  if (mode === 'snow') renderObjSnow(); else renderObjAsphalt();

  // Шпаргалка
  const cheatEl = document.getElementById('tab-cheat');
  cheatEl.innerHTML = mode === 'snow' ? CHEAT_SNOW : CHEAT_ASPHALT;

  // Big3 итог звонка
  renderBig3(mode);

  // Если на вкладке калькулятора — показать нужный
  const activeTab = document.querySelector('.tc.act');
  if (activeTab && (activeTab.id === 'tab-calc' || activeTab.id === 'tab-calc-a')) {
    document.getElementById('tab-calc').classList.toggle('act', mode === 'snow');
    document.getElementById('tab-calc-a').classList.toggle('act', mode === 'asphalt');
  }

  tab(document.querySelector('.nav-i.act')?.dataset?.tab || 'tree');
}

// Глобальная функция для onclick
window.setSvc = setSvc;
