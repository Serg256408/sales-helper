// Модуль «Ведение сделки» — поводы для звонков с ценностью
import { FOLLOWUP_REASONS_ASPHALT, FOLLOWUP_REASONS_SNOW } from '../data/deal-followup.js?v=mqtc94ef';

function getReasons() {
  const isSnow = document.body.classList.contains('mode-snow');
  return isSnow ? FOLLOWUP_REASONS_SNOW : FOLLOWUP_REASONS_ASPHALT;
}

// Рендер списка поводов
export function renderFollowup() {
  const el = document.getElementById('followup-render');
  if (!el) return;

  const reasons = getReasons();

  let h = '<div class="fu-wrap">';

  h += '<div class="fu-header">';
  h += '<div class="fu-title">Звонок по текущей сделке</div>';
  h += '<div class="fu-sub">Каждый звонок = ценность для клиента. Выбери повод — получи скрипт.</div>';
  h += '</div>';

  h += '<div class="fu-principle">';
  h += '<strong>Принцип:</strong> Не звони просто спросить «ну что, решили?». ';
  h += 'Каждый раз давай клиенту что-то полезное: план работ, фото, консультацию, выгодное предложение. ';
  h += 'Тогда клиент ждёт твоего звонка, а не избегает его.';
  h += '</div>';

  h += '<div class="fu-grid">';
  reasons.forEach(r => {
    h += '<div class="fu-card" onclick="window._showFuDetail(\'' + r.id + '\')">';
    h += '<div class="fu-card-icon">' + r.icon + '</div>';
    h += '<div class="fu-card-body">';
    h += '<div class="fu-card-title">' + r.title + '</div>';
    h += '<div class="fu-card-when">' + r.when + '</div>';
    h += '</div>';
    h += '<div class="fu-card-arrow">&#8250;</div>';
    h += '</div>';
  });
  h += '</div>';

  h += '</div>';
  el.innerHTML = h;
}

// Показать детали повода
function showDetail(id) {
  const reasons = getReasons();
  const r = reasons.find(x => x.id === id);
  if (!r) return;

  const el = document.getElementById('followup-render');
  let h = '<div class="fu-wrap">';

  h += '<button class="back-btn" onclick="window._renderFu()" style="margin:0 0 16px">';
  h += '&#8592; Назад к списку</button>';

  h += '<div class="fu-detail-header">';
  h += '<span class="fu-detail-icon">' + r.icon + '</span>';
  h += '<div><div class="fu-detail-title">' + r.title + '</div>';
  h += '<div class="fu-detail-when">' + r.when + '</div></div>';
  h += '</div>';

  h += '<div class="fu-value">';
  h += '<div class="fu-value-label">Ценность для к��иента:</div>';
  h += r.value;
  h += '</div>';

  h += '<div class="say"><button class="cp" onclick="cpy(this)">Скопировать</button>';
  h += '<div class="say-label">Скажи</div>';
  h += r.script;
  h += '</div>';

  h += '<div class="must"><div class="must-title">Обязательно сделай</div>';
  r.checklist.forEach(ch => {
    h += '<div class="chk"><input type="checkbox" onchange="this.parentElement.classList.toggle(\'done\',this.checked)">';
    h += '<span>' + ch + '</span></div>';
  });
  h += '</div>';

  h += '</div>';
  el.innerHTML = h;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Глобальные функции для onclick
window._showFuDetail = showDetail;
window._renderFu = renderFollowup;
