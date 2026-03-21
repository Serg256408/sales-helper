// Калькуляторы — Снег + Асфальт

import { PRICES } from '../data/prices.js';

let tariff = 'storm';

// Переключение тарифа (снегопад / после)
export function setTariff(t) {
  tariff = t;
  document.getElementById('b-st').className = 'tb' + (t === 'storm' ? ' on' : '');
  document.getElementById('b-af').className = 'tb' + (t === 'after' ? ' on' : '');
  calcSnow();
}

// Калькулятор СНЕГ
export function calcSnow() {
  const tk = +document.getElementById('c-t').value;
  const py = document.getElementById('c-p').value;
  const rr = Math.max(1, +document.getElementById('c-r').value || 1);
  const ld = document.getElementById('c-l').value === 'yes';

  const p = PRICES[tariff][tk];
  const tp = p[py];
  const lp = p['l' + py];
  const tt = tp * rr;
  const tl = ld ? lp : 0;
  const vol = tk * rr;

  let disc = 0, dn = '';
  if (tariff === 'after') {
    if (vol >= 350) { disc = 10; dn = '−10%'; }
    else if (vol >= 250) { disc = 6; dn = '−5–7%'; }
    else if (vol >= 100) { disc = 5; dn = '−5%'; }
  }

  const da = Math.round(tt * disc / 100);
  const fin = tt + tl - da;

  document.getElementById('ct').textContent = fin.toLocaleString('ru') + ' ₽';
  document.getElementById('cd').textContent = vol + ' м³ = ' + rr + '×' + tk + ' м³';

  let b = '<div class="cr-r"><span>Вывоз ' + rr + '×' + tp.toLocaleString('ru') + '</span><span>' + tt.toLocaleString('ru') + ' ₽</span></div>';
  if (ld) b += '<div class="cr-r"><span>' + (tk === 15 ? 'Мини-погрузчик' : 'Погрузчик') + '</span><span>' + lp.toLocaleString('ru') + ' ₽</span></div>';
  if (disc) b += '<div class="cr-r" style="color:#22c55e"><span>' + dn + '</span><span>−' + da.toLocaleString('ru') + ' ₽</span></div>';
  b += '<div class="cr-r" style="font-weight:700;border-top:1px solid rgba(255,255,255,.15);padding-top:5px;margin-top:3px"><span>ИТОГО</span><span>' + fin.toLocaleString('ru') + ' ₽</span></div>';
  document.getElementById('ccb').innerHTML = b;
}

// Авторасчёт по площади и высоте снега
export function calcSnowArea() {
  const a = +document.getElementById('c-area').value;
  const s = +document.getElementById('c-snow').value;

  if (a > 0 && s > 0) {
    const v = Math.round(a * (s / 100));
    const r25 = Math.ceil(v / 25);
    const r15 = Math.ceil(v / 15);

    document.getElementById('ah').style.display = 'block';
    document.getElementById('at').innerHTML = '<b>' + a + ' м² × ' + s + ' см = ' + v + ' м³</b> → 25 м³: <b>' + r25 + ' рейсов</b> | 15 м³: <b>' + r15 + '</b>';

    document.getElementById('c-r').value = document.getElementById('c-t').value === '25' ? r25 : r15;
    calcSnow();
  } else {
    document.getElementById('ah').style.display = 'none';
  }
}

// Калькулятор АСФАЛЬТ
export function calcAsphalt() {
  const type = document.getElementById('ca-type').value;
  const area = Math.max(1, +document.getElementById('ca-area').value || 500);
  const base = document.getElementById('ca-base').value;
  const load = document.getElementById('ca-load').value;
  const pay = document.getElementById('ca-pay').value;

  let priceMin = 0, priceMax = 0, unit = 'м²', breakdown = [];

  if (type === 'asphalt') {
    let baseMin = 0, baseMax = 0;
    if (base === 'ground') { baseMin = 600; baseMax = 1200; breakdown.push({ n: 'Подготовка основания (с нуля)', min: 600, max: 1200 }); }
    else if (base === 'old') { baseMin = 200; baseMax = 500; breakdown.push({ n: 'Фрезерование + подготовка', min: 200, max: 500 }); }
    else { baseMin = 100; baseMax = 200; breakdown.push({ n: 'Доп. подготовка', min: 100, max: 200 }); }

    let layerMin = 0, layerMax = 0;
    if (load === 'ped') { layerMin = 800; layerMax = 1400; breakdown.push({ n: 'Асфальт (пешеходная, 1–2 слоя)', min: 800, max: 1400 }); }
    else if (load === 'light') { layerMin = 1200; layerMax = 2200; breakdown.push({ n: 'Асфальт (легковой, 2–3 слоя)', min: 1200, max: 2200 }); }
    else { layerMin = 1800; layerMax = 3200; breakdown.push({ n: 'Асфальт (грузовой, полный пирог)', min: 1800, max: 3200 }); }

    priceMin = baseMin + layerMin;
    priceMax = baseMax + layerMax;
  } else if (type === 'curb') {
    unit = 'пог.м';
    priceMin = 800; priceMax = 1500;
    breakdown.push({ n: 'Бордюрный камень + установка', min: 800, max: 1500 });
  } else if (type === 'patch') {
    priceMin = 800; priceMax = 1500;
    breakdown.push({ n: 'Ямочный ремонт (вырубка + укладка)', min: 800, max: 1500 });
  } else {
    if (base === 'ground') { priceMin = 2500; priceMax = 5500; }
    else if (base === 'old') { priceMin = 1800; priceMax = 4000; }
    else { priceMin = 1500; priceMax = 3500; }
    breakdown.push({ n: 'Комплекс: основание + асфальт + бордюры + разметка', min: priceMin, max: priceMax });
  }

  // Корректировка по форме оплаты
  let payLabel = '';
  if (pay === 'cash') { priceMin = Math.round(priceMin * 0.9); priceMax = Math.round(priceMax * 0.9); payLabel = ' (наличные −10%)'; }
  else if (pay === 'ip') { priceMin = Math.round(priceMin * 0.95); priceMax = Math.round(priceMax * 0.95); payLabel = ' (ИП −5%)'; }

  const totalMin = priceMin * area;
  const totalMax = priceMax * area;

  document.getElementById('ca-total').textContent = totalMin.toLocaleString('ru') + ' — ' + totalMax.toLocaleString('ru') + ' ₽';
  document.getElementById('ca-detail').textContent = area + ' ' + unit + ' × ' + priceMin.toLocaleString('ru') + '–' + priceMax.toLocaleString('ru') + ' ₽/' + unit + payLabel;

  let bh = '';
  breakdown.forEach(r => {
    const rMin = r.min * area, rMax = r.max * area;
    bh += '<div class="cr-r"><span>' + r.n + '</span><span>' + rMin.toLocaleString('ru') + '–' + rMax.toLocaleString('ru') + ' ₽</span></div>';
  });
  bh += '<div class="cr-r" style="font-weight:700;border-top:1px solid rgba(255,255,255,.15);padding-top:5px;margin-top:3px"><span>ОРИЕНТИР' + payLabel + '</span><span>' + totalMin.toLocaleString('ru') + '–' + totalMax.toLocaleString('ru') + ' ₽</span></div>';
  document.getElementById('ca-breakdown').innerHTML = bh;
}

// Глобальные функции для onclick/oninput
window.setT = setTariff;
window.calc = calcSnow;
window.calcA = calcSnowArea;
window.calcA2 = calcAsphalt;
