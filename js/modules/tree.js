// Рендер дерева скрипта продаж

import { TREE_SNOW } from '../data/tree-snow.js?v=mqtc94ef';
import { TREE_ASPHALT } from '../data/tree-asphalt.js?v=mqtc94ef';
import { getServiceMode } from './service-mode.js?v=mqtc94ef';
import { resetBig3 } from './big3.js?v=mqtc94ef';

// История навигации
let snowHistory = [];
let snowCbHistory = [];
let asphaltHistory = [];
let asphaltCbHistory = [];

function getTree() {
  return getServiceMode() === 'snow' ? TREE_SNOW : TREE_ASPHALT;
}

function getHistory(cId) {
  const mode = getServiceMode();
  if (mode === 'snow') {
    return cId === 'tree-render' ? snowHistory : snowCbHistory;
  } else {
    return cId === 'tree-render' ? asphaltHistory : asphaltCbHistory;
  }
}

export function renderTree(nodeId, cId, hist, treeData) {
  const tree = treeData || getTree();
  const n = tree[nodeId];
  if (!n) return;

  const c = document.getElementById(cId);
  let h = '<div class="tree-card">';

  // Хлебные крошки
  if (hist.length > 0) {
    h += '<div class="crumbs" style="padding:12px 20px 0">';
    hist.forEach((x, i) => {
      h += '<span onclick="goNode(\'' + x.id + '\',\'' + cId + '\',' + i + ')">' + x.t + '</span><span class="sep"> › </span>';
    });
    h += '<span style="color:#1a1a1a;font-weight:600">' + n.title + '</span></div>';
  }

  h += '<div class="tree-top"><div><div class="tree-stage">' + n.stage + '</div><div class="tree-title">' + n.title + '</div></div></div>';
  h += '<div class="tree-body">';

  // Блоки контента
  n.blocks.forEach(b => {
    if (b.t === 'say') {
      h += '<div class="say"><button class="cp" onclick="cpy(this)">Скопировать</button><div class="say-label">' + (b.label || 'Скажи') + '</div>' + b.text + '</div>';
    } else if (b.t === 'key') {
      h += '<div class="key-block"><div class="key-label">' + b.label + '</div><div class="key-text">' + b.text + '</div></div>';
    } else if (b.t === 'must') {
      h += '<div class="must"><div class="must-title">' + (b.title || 'Обязательно сделай') + '</div>';
      (b.checks || []).forEach(ch => {
        h += '<div class="chk"><input type="checkbox" onchange="this.parentElement.classList.toggle(\'done\',this.checked)"><span>' + ch + '</span></div>';
      });
      h += '</div>';
    } else if (b.t === 'tip') {
      h += '<div class="tip">' + b.text + '</div>';
    }
  });

  // Варианты ответа клиента
  if (n.choices && n.choices.length > 0) {
    h += '<div class="choices"><div class="choices-label">Что говорит клиент?</div>';
    n.choices.forEach(ch => {
      h += '<div class="choice" onclick="pick(\'' + ch.go + '\',\'' + cId + '\',\'' + nodeId + '\',\'' + n.title.replace(/'/g, "\\'") + '\')">';
      h += '<div class="choice-dot ' + ch.dot + '"></div>';
      h += '<div class="choice-text"><div class="choice-main">' + ch.text + '</div>' + (ch.hint ? '<div class="choice-hint">' + ch.hint + '</div>' : '') + '</div>';
      h += '<div class="choice-arrow">›</div></div>';
    });
    h += '</div>';
  }

  if (hist.length > 0) {
    h += '<button class="back-btn" onclick="goBack(\'' + cId + '\')">← Назад</button>';
  }
  h += '</div></div>';

  c.innerHTML = h;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function pick(go, cId, fromId, fromT) {
  const h = getHistory(cId);
  const mode = getServiceMode();

  // Сброс при возврате к началу
  if (mode === 'snow' && (go === 'start' || go === 'cb_start')) {
    h.length = 0;
    resetBig3();
  } else if (mode === 'asphalt' && (go === 'a_start' || go === 'a_cb_start')) {
    h.length = 0;
    resetBig3();
  }

  h.push({ id: fromId, t: fromT });
  renderTree(go, cId, h);
}

export function goBack(cId) {
  const h = getHistory(cId);
  if (!h.length) return;
  const p = h.pop();
  renderTree(p.id, cId, h);
}

export function goNode(id, cId, i) {
  const h = getHistory(cId);
  h.splice(i);
  renderTree(id, cId, h);
}

// Начальный рендер
export function initTrees(mode) {
  if (mode === 'snow') {
    renderTree('start', 'tree-render', snowHistory);
    renderTree('cb_start', 'cbtree-render', snowCbHistory);
  } else {
    renderTree('a_start', 'tree-render', asphaltHistory);
    renderTree('a_cb_start', 'cbtree-render', asphaltCbHistory);
  }
}

// Глобальные функции для onclick
window.pick = pick;
window.goBack = goBack;
window.goNode = goNode;
