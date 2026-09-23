// Обзор всех материалов по вывозу снега для обсуждения с руководителем.
// Цены и сценарии берём из рабочих данных помощника, не ведём вторую копию.
import { PRICES } from '../data/prices.js';
import { TREE_SNOW } from '../data/tree-snow.js';
import { OBJ_SNOW } from '../data/objections.js';
import { FOLLOWUP_REASONS_SNOW } from '../data/deal-followup.js';
import { CHEAT_SNOW } from '../data/cheat-sheets.js';

const money = value => value.toLocaleString('ru-RU') + ' ₽';
const entries = Object.entries(TREE_SNOW);
const newClient = entries.filter(([id]) => !id.startsWith('cb_'));
const baseCalls = entries.filter(([id]) => id.startsWith('cb_'));
const offers = [
  { volume: 25, rate: 600, loader: 'экскаватор-погрузчик', loading: 33000 },
  { volume: 15, rate: 850, loader: 'мини-погрузчик', loading: 40000 }
];

function offerText(offer) {
  const haul = offer.volume * offer.rate;
  return [
    'КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ — ТРАНСКОМ',
    'Погрузка и вывоз снега',
    '',
    'Предлагаем следующий вариант выполнения работ:',
    `Техника: самосвал ${offer.volume} м³ и ${offer.loader}.`,
    `Стоимость вывоза: ${money(offer.rate)} за 1 м³.`,
    `Один рейс самосвала ${offer.volume} м³: ${money(haul)}.`,
    `Погрузка ${offer.loader.toLowerCase()}: ${money(offer.loading)} отдельно.`,
    'Все указанные цены включают НДС 22%.',
    '',
    `Стоимость вывоза = количество рейсов × ${money(haul)}.`,
    'Количество рейсов, объём погрузки и дату работ согласуем после уточнения объекта.',
    '',
    'ООО «Транском» · ИНН 5001098904',
    'Тел. +7 (499) 450-76-21 · info@asfaltsneg.ru · asfaltsneg.ru'
  ].join('\n');
}

function offersSection() {
  return `<section class="st-section" id="snow-offers"><div class="st-section-head"><div><span class="st-eyebrow">Готово для отправки клиенту</span><h2>Коммерческие предложения</h2><p>Стоимость самосвала указана за один рейс; число рейсов зависит от объёма снега. Погрузка показана отдельно. Все цены включают НДС 22%.</p></div></div>
    <div class="st-offers">${offers.map((offer, index) => {
      const haul = offer.volume * offer.rate;
      return `<article class="st-offer"><div class="st-offer-header st-offer-header-${offer.volume}"><span>Вариант ${index + 1} · Погрузка и вывоз снега</span><h3>Самосвал ${offer.volume} м³</h3><p>+ ${offer.loader}</p><small>Иллюстрация техники</small></div><div class="st-offer-breakdown"><div><span>Тариф за 1 м³ вывоза</span><b>${money(offer.rate)}</b></div><div><span>Погрузка отдельно</span><b>${money(offer.loading)}</b></div></div><div class="st-offer-total"><span>Один рейс самосвала</span><strong>${money(haul)}</strong></div><p class="st-offer-formula">Вывоз: число рейсов × ${money(haul)}. Погрузка рассчитывается отдельно. Цены с НДС 22%.</p><div class="st-offer-actions"><a class="st-download-offer" data-offer-download="${index}" href="output/pdf/transkom-snow-${offer.volume}m3.pdf?v=5" download>Скачать КП · PDF</a><button type="button" class="st-copy-offer-link" data-offer-link="${index}">Скопировать ссылку</button><button type="button" class="st-copy-offer" data-offer-index="${index}">Скопировать текст</button></div><p class="st-download-help">PDF около 4–5 МБ. Во встроенном браузере окно сохранения может не появиться: проверьте папку «Загрузки».</p><p class="st-download-status" role="status" aria-live="polite" hidden></p><details class="st-offer-preview"><summary>Посмотреть текст КП</summary><pre>${offerText(offer)}</pre></details></article>`;
    }).join('')}</div><div class="st-note">Это предложения с тарифами. Адрес объекта, дату, количество рейсов и порядок оплаты согласуйте при оформлении заказа.</div></section>`;
}

function priceTable(tariff, title, subtitle) {
  const rows = [25, 15].map(volume => {
    const p = PRICES[tariff][volume];
    return `<tr><th scope="row">${volume} м³</th><td>${money(p.bn)}</td><td>${money(p.cash)}</td><td>${money(p.ip)}</td><td>${money(p.lbn)}</td><td>${money(p.lcash)}</td><td>${money(p.lip)}</td></tr>`;
  }).join('');
  return `<section class="st-price-card">
    <div class="st-price-heading"><div><h3>${title}</h3><p>${subtitle}</p></div><span>за рейс</span></div>
    <div class="st-table-scroll"><table class="st-price-table">
      <thead><tr><th rowspan="2" scope="col">Машина</th><th colspan="3" scope="colgroup">Вывоз</th><th colspan="3" scope="colgroup">Погрузка</th></tr>
      <tr><th scope="col">Безнал с НДС</th><th scope="col">Наличные</th><th scope="col">ИП</th><th scope="col">Безнал с НДС</th><th scope="col">Наличные</th><th scope="col">ИП</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>`;
}

function renderBlock(block) {
  if (block.checks) {
    return `<div class="st-block st-must"><strong>${block.title || 'Проверить'}</strong><ul>${block.checks.map(check => `<li>${check}</li>`).join('')}</ul></div>`;
  }
  return `<div class="st-block st-${block.t || 'say'}"><strong>${block.label || (block.t === 'tip' ? 'Подсказка' : 'Скажи')}</strong><div>${block.text || ''}</div></div>`;
}

function scenario([id, step], index) {
  const choices = step.choices?.length ? `<div class="st-branches"><div class="st-small-label">Если клиент отвечает</div>${step.choices.map(choice => {
    const target = TREE_SNOW[choice.go];
    return `<button type="button" class="st-branch" data-snow-target="${choice.go}"><span>${choice.text}</span><small>→ ${target?.title || choice.go}</small></button>`;
  }).join('')}</div>` : '';
  return `<details class="st-scenario" id="snow-step-${id}" ${index === 0 ? 'open' : ''}>
    <summary><span class="st-index">${String(index + 1).padStart(2, '0')}</span><span class="st-scenario-heading"><small>${step.stage}</small><b>${step.title}</b></span><span class="st-chevron">⌄</span></summary>
    <div class="st-scenario-body">${(step.blocks || []).map(renderBlock).join('')}${choices}</div>
  </details>`;
}

function scenariosSection(id, title, intro, list) {
  return `<section class="st-section" id="${id}"><div class="st-section-head"><div><span class="st-eyebrow">Сценарии · ${list.length} шагов</span><h2>${title}</h2><p>${intro}</p></div></div>
    <div class="st-scenario-list">${list.map(scenario).join('')}</div></section>`;
}

function objectionsSection() {
  return `<section class="st-section" id="snow-objections"><div class="st-section-head"><div><span class="st-eyebrow">Ответы · ${OBJ_SNOW.length} ситуаций</span><h2>Возражения клиента</h2><p>Готовые ответы из действующего снегового режима.</p></div></div>
    <div class="st-objection-grid">${OBJ_SNOW.map((item, index) => `<details class="st-objection"><summary><span>${String(index + 1).padStart(2, '0')}</span>${item.q}<b>⌄</b></summary><div class="st-objection-body">${item.a}</div></details>`).join('')}</div></section>`;
}

function followupSection() {
  return `<section class="st-section" id="snow-followup"><div class="st-section-head"><div><span class="st-eyebrow">После первого разговора · ${FOLLOWUP_REASONS_SNOW.length} поводов</span><h2>Как вернуться к клиенту</h2><p>Для каждой ситуации есть повод, фраза и действия менеджера.</p></div></div>
    <div class="st-followup-grid">${FOLLOWUP_REASONS_SNOW.map(item => `<article class="st-followup-card"><div class="st-followup-top"><span>${item.icon}</span><div><small>${item.when}</small><h3>${item.title}</h3></div></div><p>${item.value}</p><blockquote>${item.script}</blockquote><details><summary>Что сделать после звонка</summary><ul>${item.checklist.map(check => `<li>${check}</li>`).join('')}</ul></details></article>`).join('')}</div></section>`;
}

export function renderSnowTraining() {
  const root = document.getElementById('snow-training-root');
  if (!root) return;
  root.innerHTML = `<div class="st-page">
    <header class="st-hero"><div class="st-hero-main"><span class="st-kicker">ТРАНСКОМ / МАТЕРИАЛЫ ДЛЯ МЕНЕДЖЕРА</span><h1>Вывоз снега<span>Всё для разговора с клиентом</span></h1><p>Прайс, сценарии нового звонка и прозвона базы, ответы на возражения и поводы для повторного контакта. Материал собран из действующих разделов помощника для проверки и дополнения.</p><div class="st-hero-stats"><span><b>2</b> тарифа</span><span><b>${entries.length}</b> шага разговора</span><span><b>${OBJ_SNOW.length}</b> возражений</span><span><b>${FOLLOWUP_REASONS_SNOW.length}</b> поводов</span></div></div><div class="st-hero-mark" aria-hidden="true">❄</div></header>
    <nav class="st-jump" aria-label="Разделы обучения"><a href="#snow-offers">Два КП</a><a href="#snow-prices">Прайс</a><a href="#snow-cheat">Шпаргалка</a><a href="#snow-new-client">Новый клиент</a><a href="#snow-base">Прозвон базы</a><a href="#snow-objections">Возражения</a><a href="#snow-followup">Ведение сделки</a><a href="#snow-review">Что проверить</a></nav>
    ${offersSection()}
    <section class="st-section" id="snow-prices"><div class="st-section-head"><div><span class="st-eyebrow">На сверку с новыми КП</span><h2>Прайс из действующего калькулятора</h2><p>Ниже сохранены текущие тарифы помощника. Цены погрузки в них отличаются от двух новых КП выше. Погрузка в калькуляторе добавляется к стоимости вывоза.</p></div></div><div class="st-prices">${priceTable('storm', 'Во время снегопада', 'Тариф «Снегопад»')}${priceTable('after', 'После снегопада', 'Тариф «После»')}</div><div class="st-note"><b>Скидки после снегопада:</b> от 100 м³ — 5%, от 250 м³ — 6%, от 350 м³ — 10%. Калькулятор применяет скидку к вывозу, а не к погрузке.</div></section>
    <section class="st-section" id="snow-cheat"><div class="st-section-head"><div><span class="st-eyebrow">Перед звонком</span><h2>Шпаргалка по услуге</h2><p>Действующие подсказки: как работаем, что уточнить у клиента и какие аргументы использовать.</p></div></div><details class="st-cheat"><summary>Открыть всю снеговую шпаргалку <span>⌄</span></summary><div class="st-cheat-body">${CHEAT_SNOW}</div></details></section>
    ${scenariosSection('snow-new-client', 'Новый клиент', 'Все развилки действующего скрипта: от первого «Алло» до заказа, отказа и рекомендации.', newClient)}
    ${scenariosSection('snow-base', 'Прозвон базы', 'Отдельные шаги для клиентов, с которыми уже был контакт.', baseCalls)}
    ${objectionsSection()}
    ${followupSection()}
    <section class="st-section" id="snow-review"><div class="st-section-head"><div><span class="st-eyebrow">На проверку</span><h2>Что нужно подтвердить</h2><p>Эти вопросы заметны при сопоставлении действующих материалов.</p></div></div><div class="st-review-grid"><div><b>КП и старые подсказки</b><p>Для новых КП вы указали 600 ₽/м³ и 850 ₽/м³. В некоторых действующих скриптах остался ориентир «от 550 ₽/м³»; цены погрузки в калькуляторе тоже отличаются от новых КП. Перед использованием подсказки нужно согласовать.</p></div><div><b>Условия и обещания</b><p>В скриптах есть «техника завтра», «свободные машины всегда», скидка за наличные и регулярный вывоз без предоплаты. Проверьте, какие обещания действуют сейчас.</p></div><div><b>Видео и проверка знаний</b><p>В репозитории есть текст для видеоурока по снегу, но в этой вкладке пока нет самого видео и отдельного теста. Их можно добавить после согласования содержания.</p></div></div></section>
  </div>`;

  root.addEventListener('click', event => {
    const download = event.target.closest('[data-offer-download]');
    if (download) {
      const status = download.closest('.st-offer').querySelector('.st-download-status');
      status.hidden = false;
      status.textContent = `Загрузка началась. Подождите немного и проверьте папку «Загрузки»: transkom-snow-${offers[Number(download.dataset.offerDownload)].volume}m3.pdf`;
      return;
    }
    const linkCopy = event.target.closest('[data-offer-link]');
    if (linkCopy) {
      const offer = offers[Number(linkCopy.dataset.offerLink)];
      if (!offer) return;
      const url = new URL(`output/pdf/transkom-snow-${offer.volume}m3.pdf`, document.baseURI).href;
      navigator.clipboard.writeText(url).then(() => {
        linkCopy.textContent = 'Ссылка скопирована';
        setTimeout(() => { linkCopy.textContent = 'Скопировать ссылку'; }, 2200);
      }).catch(() => {
        const status = linkCopy.closest('.st-offer').querySelector('.st-download-status');
        status.hidden = false;
        status.textContent = url;
      });
      return;
    }
    const copy = event.target.closest('[data-offer-index]');
    if (copy) {
      const offer = offers[Number(copy.dataset.offerIndex)];
      if (!offer) return;
      navigator.clipboard.writeText(offerText(offer)).then(() => {
        copy.textContent = 'КП скопировано';
        setTimeout(() => { copy.textContent = 'Скопировать текст'; }, 2200);
      }).catch(() => { copy.textContent = 'Не удалось скопировать'; });
      return;
    }
    const branch = event.target.closest('[data-snow-target]');
    if (!branch) return;
    const target = document.getElementById('snow-step-' + branch.dataset.snowTarget);
    if (!target) return;
    target.open = true;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
