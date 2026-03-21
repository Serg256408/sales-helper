// Интеграция с PlanFix CRM

import { PF_B3_LABELS, B3_TOTAL } from '../data/big3-data.js';
import { getB3State } from './big3.js';

let pfLinkedTask = null;
const PF_STORAGE_KEY = 'transkom_pf_settings';

const PF_DEFAULTS = {
  url: 'transkom.planfix.ru',
  token: '',
  fields: ['76888', '76896', '76890', '76892'],
  summaryField: '76894'
};

export function getPfSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(PF_STORAGE_KEY) || '{}');
    return {
      url: saved.url || PF_DEFAULTS.url,
      token: saved.token || PF_DEFAULTS.token,
      fields: saved.fields && saved.fields[0] ? saved.fields : PF_DEFAULTS.fields,
      summaryField: saved.summaryField || PF_DEFAULTS.summaryField
    };
  } catch (e) {
    return { ...PF_DEFAULTS };
  }
}

export function savePfSettings() {
  const s = {
    url: (document.getElementById('pf-url').value || '').trim().replace(/\/+$/, '').replace(/^https?:\/\//, ''),
    token: (document.getElementById('pf-token').value || '').trim(),
    fields: [
      (document.getElementById('pf-f1').value || '').trim(),
      (document.getElementById('pf-f2').value || '').trim(),
      (document.getElementById('pf-f3').value || '').trim(),
      (document.getElementById('pf-f4').value || '').trim()
    ],
    summaryField: (document.getElementById('pf-f-summary').value || '').trim()
  };
  localStorage.setItem(PF_STORAGE_KEY, JSON.stringify(s));
  updatePfSaveBtn();
}

export function loadPfSettings() {
  const s = getPfSettings();
  if (s.url) document.getElementById('pf-url').value = s.url;
  if (s.token) document.getElementById('pf-token').value = s.token;
  if (s.fields) {
    for (let i = 0; i < 4; i++) {
      if (s.fields[i]) document.getElementById('pf-f' + (i + 1)).value = s.fields[i];
    }
  }
  if (s.summaryField) document.getElementById('pf-f-summary').value = s.summaryField;
  updatePfSaveBtn();
}

export function clearPfSettings() {
  localStorage.removeItem(PF_STORAGE_KEY);
  document.getElementById('pf-url').value = '';
  document.getElementById('pf-token').value = '';
  for (let i = 1; i <= 4; i++) document.getElementById('pf-f' + i).value = '';
  document.getElementById('pf-f-summary').value = '';
  unlinkPfTask();
  updatePfSaveBtn();
  showPfStatus('Настройки сброшены', '#999');
}

function showPfStatus(msg, color) {
  const el = document.getElementById('pf-status');
  el.style.display = 'block';
  el.style.color = color || '#333';
  el.style.background = (color === '#22c55e' ? '#f0fff0' : color === '#ef4444' ? '#fff0f0' : '#f5f5f5');
  el.textContent = msg;
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function pfApiUrl() {
  const s = getPfSettings();
  if (!s.url || !s.token) return null;
  return 'https://' + s.url + '/rest/';
}

async function pfFetch(endpoint, method, body) {
  const s = getPfSettings();
  const base = pfApiUrl();
  if (!base) throw new Error('PlanFix не настроен');
  const opts = {
    method: method || 'POST',
    headers: {
      'Authorization': 'Bearer ' + s.token,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(base + endpoint, opts);
  if (!resp.ok) {
    let errText = '';
    try { errText = await resp.text(); } catch (e) { }
    throw new Error('HTTP ' + resp.status + ': ' + errText);
  }
  return resp.json();
}

export async function testPfConnection() {
  try {
    showPfStatus('Подключаюсь...', '#1a73e8');
    const data = await pfFetch('task/list', 'POST', { offset: 0, pageSize: 1, fields: 'id,title' });
    showPfStatus('Подключено! Найдено задач: ' + (data.totalCount || 0), '#22c55e');
  } catch (e) {
    showPfStatus('Ошибка: ' + e.message, '#ef4444');
  }
}

export async function searchPfTask() {
  const q = (document.getElementById('pf-search').value || '').trim();
  if (!q) return;

  const res = document.getElementById('pf-results');
  res.style.display = 'block';
  res.innerHTML = '<div style="color:#999;font-size:13px">Ищу...</div>';

  try {
    const data = await pfFetch('task/list', 'POST', {
      offset: 0, pageSize: 10,
      fields: 'id,title,status,counterparty',
      filters: [{ type: 1, operator: 'equal', value: q, field: 1 }]
    });

    if (!data.tasks || !data.tasks.length) {
      const data2 = await pfFetch('task/list', 'POST', {
        offset: 0, pageSize: 10,
        fields: 'id,title,status,counterparty',
        filters: [{ type: 3, operator: 'equal', value: q }]
      });
      if (!data2.tasks || !data2.tasks.length) {
        res.innerHTML = '<div style="color:#999;font-size:13px;padding:8px">Ничего не найдено. Попробуйте другой запрос.</div>';
        return;
      }
      renderPfResults(data2.tasks);
    } else {
      renderPfResults(data.tasks);
    }
  } catch (e) {
    res.innerHTML = '<div style="color:#ef4444;font-size:13px;padding:8px">Ошибка: ' + e.message + '</div>';
  }
}

function renderPfResults(tasks) {
  const res = document.getElementById('pf-results');
  let h = '';
  tasks.forEach(t => {
    const name = t.title || 'Без названия';
    const cp = t.counterparty ? (' — ' + (t.counterparty.name || '')) : '';
    const st = t.status ? (' [' + t.status.name + ']') : '';
    h += '<div onclick="linkPfTask(' + t.id + ',\'' + name.replace(/'/g, "\\'") + cp.replace(/'/g, "\\'") + '\')" style="padding:10px 14px;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:13px;transition:.1s" onmouseover="this.style.background=\'#f5f5f5\'" onmouseout="this.style.background=\'#fff\'">';
    h += '<div style="font-weight:600">' + name + cp + '</div>';
    h += '<div style="font-size:11px;color:#999">#' + t.id + st + '</div></div>';
  });
  res.innerHTML = '<div style="border:2px solid #e5e5e5;border-radius:10px;overflow:hidden;max-height:300px;overflow-y:auto">' + h + '</div>';
}

export function linkPfTask(id, name) {
  pfLinkedTask = { id: id, name: name };
  document.getElementById('pf-results').style.display = 'none';
  document.getElementById('pf-linked').style.display = 'block';
  document.getElementById('pf-linked-name').textContent = name;
  document.getElementById('pf-linked-id').textContent = 'Задача #' + id;
  document.getElementById('pf-search').value = '';
  const badge = document.getElementById('pf-hdr-badge');
  badge.textContent = 'PF: ' + name;
  badge.classList.add('on');
  updatePfSaveBtn();
}

export function unlinkPfTask() {
  pfLinkedTask = null;
  document.getElementById('pf-linked').style.display = 'none';
  document.getElementById('pf-results').style.display = 'none';
  document.getElementById('pf-hdr-badge').classList.remove('on');
  updatePfSaveBtn();
}

function updatePfSaveBtn() {
  const s = getPfSettings();
  const show = pfLinkedTask && s.url && s.token;
  document.getElementById('pf-save-btn').style.display = show ? 'inline-block' : 'none';
}

export async function saveCallToPlanfix() {
  if (!pfLinkedTask) return;
  const s = getPfSettings();
  const b3state = getB3State();
  const btn = document.getElementById('pf-save-btn');
  const stat = document.getElementById('pf-save-status');
  btn.disabled = true;
  btn.textContent = 'Сохраняю...';
  stat.style.display = 'none';

  try {
    const customData = [];
    for (let i = 0; i < 4; i++) {
      if (s.fields && s.fields[i]) {
        customData.push({ field: { id: parseInt(s.fields[i]) }, value: b3state[i] ? 'Да' : 'Нет' });
      }
    }

    const summary = PF_B3_LABELS.map((l, i) => l + ': ' + (b3state[i] ? 'Да' : 'Нет')).join(' | ') + ' | Итого: ' + b3state.filter(x => x).length + '/' + B3_TOTAL;
    if (s.summaryField) {
      customData.push({ field: { id: parseInt(s.summaryField) }, value: summary });
    }

    await pfFetch('task/' + pfLinkedTask.id, 'POST', { customFieldData: customData });

    const now = new Date();
    const commentText = 'Итог звонка (' + now.toLocaleString('ru') + '): ' + summary;
    await pfFetch('task/' + pfLinkedTask.id + '/comments', 'POST', { description: commentText });

    btn.textContent = 'Сохранено!';
    btn.style.background = '#22c55e';
    stat.style.display = 'inline';
    stat.style.color = '#22c55e';
    stat.textContent = 'Данные отправлены в PlanFix';
    setTimeout(() => { btn.textContent = 'Сохранить в PlanFix'; btn.style.background = '#1a73e8'; btn.disabled = false; stat.style.display = 'none'; }, 3000);
  } catch (e) {
    btn.textContent = 'Ошибка!';
    btn.style.background = '#ef4444';
    stat.style.display = 'inline';
    stat.style.color = '#ef4444';
    stat.textContent = e.message;
    setTimeout(() => { btn.textContent = 'Сохранить в PlanFix'; btn.style.background = '#1a73e8'; btn.disabled = false; }, 3000);
  }
}

// Автолинковка из URL (для iframe в PlanFix)
export function autoLinkFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const taskId = params.get('taskId') || params.get('task_id') || params.get('id');
  const taskName = params.get('taskName') || params.get('task_name') || params.get('name') || '';
  if (taskId) {
    const name = taskName || ('Сделка #' + taskId);
    linkPfTask(parseInt(taskId), decodeURIComponent(name));
  }
}

// Глобальные функции для onclick
window.savePfSettings = savePfSettings;
window.clearPfSettings = clearPfSettings;
window.testPfConnection = testPfConnection;
window.searchPfTask = searchPfTask;
window.linkPfTask = linkPfTask;
window.unlinkPfTask = unlinkPfTask;
window.saveCallToPlanfix = saveCallToPlanfix;
