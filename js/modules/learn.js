// Обучение: статьи + квизы + система прогресса

import {
  LEARN_MAP, PASS_THRESHOLD, getProgress, saveQuizResult,
  isArticleUnlocked, getArticleStatus, getCategoryProgress,
  getOverallProgress, getReport, resetProgress
} from './learn-progress.js?v=mqtc94ef';
import { addXP } from './gamification.js?v=mqtc94ef';

// Определить articleId по quizId (маппинг из реальных onclick в HTML)
function _quizToArticle(quizId) {
  const map = {
    'quiz-bitum': 'bitum-emulsion',
    'quiz-asphalt': 'asphalt-concrete',
    'quiz-crumb': 'asphalt-crumb',
    'quiz-spec': 'special-asphalt',
    'sma': 'asphalt-sma',
    'amix': 'asphalt-mixes',
    'quiz-base': 'road-base',
    'quiz-conc': 'concrete-base',
    'quiz-pie': 'road-pie',
    'slabs': 'road-slabs',
    'quiz-laying': 'asphalt-laying',
    'quiz-pothole': 'pothole-repair',
    'quiz-resurface': 'resurface',
    'quiz-asphalt-main': 'asphalt-main',
    'quiz-equipment': 'equipment-guide',
    'quiz-crack-sealing': 'crack-sealing',
    'quiz-geo': 'geomaterials',
    'marking': 'road-marking',
    'quiz-asphalt-calc': 'asphalt-calc',
    'quiz-curbs': 'curbs',
    'quiz-paving': 'paving-tiles',
    'quiz-tray': 'storm-trays',
    'quiz-wells': 'concrete-wells',
    'quiz-lawns': 'lawns',
    'sand': 'road-sand',
    'drain': 'soil-drainage',
    'machinery': 'road-machinery',
    'stone': 'crushed-stone',
    'pf-intro': 'planfix-intro',
    'quiz-pf': 'planfix-guide',
    'base-call': 'base-calling',
    'quiz-pain-sales': 'pain-sales'
  };
  return map[quizId] || null;
}

// Свернуть/развернуть категорию в сайдбаре
export function toggleLearnCat(el) {
  const items = el.nextElementSibling;
  const isOpen = el.classList.contains('open');
  if (isOpen) {
    el.classList.remove('open');
    el.querySelector('.learn-cat-arrow').innerHTML = '&#9654;';
    items.style.display = 'none';
  } else {
    el.classList.add('open');
    el.querySelector('.learn-cat-arrow').innerHTML = '&#9660;';
    items.style.display = '';
  }
}

// Показать статью
export function showArticle(id) {
  // Проверка блокировки
  if (!isArticleUnlocked(id)) {
    // Найти предыдущую несданную статью
    for (const cat of LEARN_MAP) {
      const idx = cat.articles.indexOf(id);
      if (idx > 0) {
        const prevName = document.querySelector('[onclick*="showArticle(\'' + cat.articles[idx - 1] + '\')"] .ll-text');
        alert('Сначала сдайте тест по теме «' + (prevName?.textContent || 'предыдущая статья') + '»');
        break;
      }
    }
    return;
  }

  // Переключение активного пункта в сайдбаре
  document.querySelectorAll('.learn-list-item').forEach(e => e.classList.remove('active'));
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
    // Автораскрытие категории
    const catItems = event.currentTarget.closest('.learn-cat-items');
    if (catItems) {
      const cat = catItems.previousElementSibling;
      if (cat && !cat.classList.contains('open')) {
        cat.classList.add('open');
        cat.querySelector('.learn-cat-arrow').innerHTML = '&#9660;';
        catItems.style.display = '';
      }
    }
  }

  // Скрыть все статьи, показать нужную
  document.querySelectorAll('.learn-article').forEach(a => a.style.display = 'none');
  const article = document.getElementById('article-' + id);
  if (article) {
    article.style.display = 'block';
    article.style.animation = 'fi .3s ease';
    const wrap = document.querySelector('.learn-wrap');
    if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Проверить квиз
export function checkQuiz(quizId, answers) {
  const quiz = document.getElementById('quiz-' + quizId) || document.getElementById(quizId);
  let score = 0, total = 0;

  if (answers) {
    // Новый формат
    const questions = quiz.querySelectorAll('.la-question');
    total = questions.length;
    questions.forEach(q => {
      const inputs = q.querySelectorAll('input[type=radio]');
      const name = inputs[0]?.name;
      const correct = answers[name];
      const labels = q.querySelectorAll('label');
      labels.forEach(lb => lb.classList.remove('correct', 'wrong'));
      const selected = q.querySelector('input[type=radio]:checked');
      if (selected) {
        const parentLabel = selected.closest('label');
        if (selected.value === correct) { parentLabel.classList.add('correct'); score++; }
        else parentLabel.classList.add('wrong');
      }
    });
    const resultEl = document.getElementById('quiz-' + quizId + '-result') || document.getElementById(quizId + '-result');
    _showResult(resultEl, score, total, quizId);
    return;
  }

  // Старый формат
  const questions = quiz.querySelectorAll('.la-q');
  total = questions.length;
  questions.forEach(q => {
    const correct = q.getAttribute('data-correct');
    const labels = q.querySelectorAll('.la-q-opts label');
    const selected = q.querySelector('input[type=radio]:checked');
    labels.forEach(lb => lb.classList.remove('correct', 'wrong'));
    if (selected) {
      const parentLabel = selected.closest('label');
      if (selected.value === correct) { parentLabel.classList.add('correct'); score++; }
      else parentLabel.classList.add('wrong');
    }
  });
  const resultEl = document.getElementById(quizId + '-result');
  _showResult(resultEl, score, total, quizId);
}

function _showResult(el, score, total, quizId) {
  if (!el) return;
  const pct = Math.round(score / total * 100);
  const passed = pct >= PASS_THRESHOLD;

  // Сохранить результат и обновить UI
  const articleId = _quizToArticle(quizId);
  if (articleId) {
    saveQuizResult(articleId, score, total);
    updateLearnUI();
  }

  if (passed) {
    // Начислить XP за тест
    const xpAmount = pct === 100 ? 20 : 10;
    addXP(xpAmount, pct === 100 ? 'Тест на 100%!' : 'Тест сдан');

    // Сдал — показать результат
    el.style.display = 'block';
    el.className = 'quiz-result good';
    el.innerHTML = '&#127942; Результат: <strong>' + score + ' из ' + total + '</strong> (' + pct + '%) — Тест сдан! +' + xpAmount + ' XP';
  } else {
    // Не сдал — показать результат, через 2 сек сбросить и скролл к началу статьи
    el.style.display = 'block';
    el.className = 'quiz-result ' + (pct >= 50 ? 'ok' : 'bad');
    el.innerHTML = '&#128308; Результат: <strong>' + score + ' из ' + total + '</strong> (' + pct + '%) — Нужно <strong>' + PASS_THRESHOLD + '%</strong>. Перечитайте статью и попробуйте снова.';

    setTimeout(() => {
      // Сбросить все ответы в квизе
      const quiz = el.closest('.la-quiz');
      if (quiz) {
        quiz.querySelectorAll('input[type=radio]').forEach(inp => inp.checked = false);
        quiz.querySelectorAll('label').forEach(lb => lb.classList.remove('correct', 'wrong'));
      }
      el.style.display = 'none';
      // Скролл к началу статьи
      const article = el.closest('.learn-article');
      if (article) article.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 2500);
  }
}

// Обновить весь UI обучения: замки, галочки, прогресс
export function updateLearnUI() {
  _updateSidebarStatus();
  _updateProgressPanel();
  _updateCategoryBadges();
}

// Обновить иконки замков и галочек в сайдбаре
function _updateSidebarStatus() {
  document.querySelectorAll('.learn-list-item').forEach(item => {
    const onclick = item.getAttribute('onclick') || '';
    const match = onclick.match(/showArticle\('([^']+)'\)/);
    if (!match) return;
    const id = match[1];
    const status = getArticleStatus(id);
    const iconEl = item.querySelector('.ll-icon');
    const textEl = item.querySelector('.ll-text');

    // Убираем старые классы
    item.classList.remove('ll-locked', 'll-passed');
    // Убираем старые бейджи статуса
    const oldBadge = item.querySelector('.ll-status');
    if (oldBadge) oldBadge.remove();

    if (status === 'locked') {
      item.classList.add('ll-locked');
      const badge = document.createElement('span');
      badge.className = 'll-status ll-lock';
      badge.innerHTML = '&#128274;';
      item.appendChild(badge);
    } else if (status === 'passed') {
      item.classList.add('ll-passed');
      const badge = document.createElement('span');
      badge.className = 'll-status ll-check';
      badge.innerHTML = '&#10004;';
      item.appendChild(badge);
    }
  });
}

// Обновить прогресс-бары категорий
function _updateCategoryBadges() {
  const cats = document.querySelectorAll('.learn-cat');
  const catItems = document.querySelectorAll('.learn-cat-items');
  const mapIds = LEARN_MAP.map(c => c.id);
  let catIdx = 0;

  cats.forEach((catEl, i) => {
    if (catIdx >= LEARN_MAP.length) return;
    const cat = LEARN_MAP[catIdx];
    const prog = getCategoryProgress(cat.id);
    catIdx++;

    // Обновить счётчик
    const countEl = catEl.querySelector('.learn-cat-count');
    if (countEl) {
      if (prog.passed === prog.total && prog.total > 0) {
        countEl.textContent = '✓ ' + prog.total;
        countEl.classList.add('lc-done');
      } else {
        countEl.textContent = prog.passed + '/' + prog.total;
        countEl.classList.remove('lc-done');
      }
    }
  });
}

// Обновить панель общего прогресса
function _updateProgressPanel() {
  const panel = document.getElementById('learn-progress-panel');
  if (!panel) return;

  const overall = getOverallProgress();
  const fillEl = panel.querySelector('.lp-fill');
  const textEl = panel.querySelector('.lp-text');
  const statusEl = panel.querySelector('.lp-status');

  if (fillEl) fillEl.style.width = overall.pct + '%';
  if (textEl) textEl.textContent = 'Пройдено: ' + overall.passed + ' из ' + overall.total + ' тестов (' + overall.pct + '%)';

  if (statusEl) {
    if (overall.pct === 100) {
      statusEl.innerHTML = '&#127942; <strong>Обучение пройдено!</strong>';
      statusEl.className = 'lp-status lp-done';
    } else if (overall.passed > 0) {
      statusEl.innerHTML = '&#128214; В процессе обучения';
      statusEl.className = 'lp-status lp-progress';
    } else {
      statusEl.innerHTML = '&#128204; Начните обучение — откройте первую статью';
      statusEl.className = 'lp-status';
    }
  }
}

// Показать отчёт для руководителя
export function showLearnReport() {
  const report = getReport();
  const overall = getOverallProgress();
  const modal = document.getElementById('learn-report-modal');
  const body = document.getElementById('learn-report-body');
  if (!modal || !body) return;

  let html = '<div class="lr-summary">';
  html += '<div class="lr-overall">';
  html += '<div class="lr-overall-pct">' + overall.pct + '%</div>';
  html += '<div class="lr-overall-label">Общий прогресс: ' + overall.passed + ' из ' + overall.total + ' тестов</div>';
  html += '</div></div>';

  report.forEach(cat => {
    html += '<div class="lr-cat">';
    html += '<div class="lr-cat-title">' + cat.name + ' <span class="lr-cat-prog">' + cat.progress.passed + '/' + cat.progress.total + '</span></div>';
    html += '<table class="lr-table"><thead><tr><th>Статья</th><th>Балл</th><th>Дата</th><th>Статус</th></tr></thead><tbody>';
    cat.articles.forEach(a => {
      const statusText = a.passed ? '&#10004; Сдан' : (a.date ? '&#10060; Не сдан' : '—');
      const statusClass = a.passed ? 'lr-pass' : (a.date ? 'lr-fail' : '');
      // Получить название из сайдбара
      const nameEl = document.querySelector('[onclick*="showArticle(\'' + a.id + '\')"] .ll-text');
      const name = nameEl ? nameEl.textContent : a.id;
      html += '<tr class="' + statusClass + '">';
      html += '<td>' + name + '</td>';
      html += '<td>' + (a.date ? a.score + '/' + a.total + ' (' + a.pct + '%)' : '—') + '</td>';
      html += '<td>' + (a.date || '—') + '</td>';
      html += '<td>' + statusText + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  });

  body.innerHTML = html;
  modal.style.display = 'flex';
}

// Закрыть отчёт
export function closeLearnReport() {
  const modal = document.getElementById('learn-report-modal');
  if (modal) modal.style.display = 'none';
}

// Сбросить прогресс
export function resetLearnProgress() {
  if (confirm('Сбросить весь прогресс обучения? Это действие нельзя отменить.')) {
    resetProgress();
    updateLearnUI();
    // Сбросить визуал квизов
    document.querySelectorAll('.quiz-result').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.la-q-opts label, .la-question label').forEach(lb => lb.classList.remove('correct', 'wrong'));
    document.querySelectorAll('.la-q-opts input, .la-question input').forEach(inp => inp.checked = false);
  }
}

// Скопировать отчёт текстом в буфер обмена
export function copyLearnReport() {
  const report = getReport();
  const overall = getOverallProgress();
  let text = 'ОТЧЁТ ПО ОБУЧЕНИЮ — ТРАНСКОМ\n';
  text += 'Дата: ' + new Date().toLocaleDateString('ru-RU') + '\n';
  text += 'Общий прогресс: ' + overall.passed + '/' + overall.total + ' (' + overall.pct + '%)\n\n';

  report.forEach(cat => {
    text += cat.name + ' (' + cat.progress.passed + '/' + cat.progress.total + ')\n';
    cat.articles.forEach(a => {
      const nameEl = document.querySelector('[onclick*="showArticle(\'' + a.id + '\')"] .ll-text');
      const name = nameEl ? nameEl.textContent : a.id;
      const status = a.passed ? '✓ Сдан' : (a.date ? '✗ Не сдан' : '—');
      const score = a.date ? a.score + '/' + a.total + ' (' + a.pct + '%)' : '—';
      text += '  ' + name + ': ' + score + ' ' + status + (a.date ? ' [' + a.date + ']' : '') + '\n';
    });
    text += '\n';
  });

  navigator.clipboard.writeText(text).then(() => {
    alert('Отчёт скопирован в буфер обмена');
  }).catch(() => {
    // Фоллбэк для старых браузеров
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    alert('Отчёт скопирован в буфер обмена');
  });
}

// Глобальные функции для onclick
window.showArticle = showArticle;
window.checkQuiz = checkQuiz;
window.toggleLearnCat = toggleLearnCat;
window.showLearnReport = showLearnReport;
window.closeLearnReport = closeLearnReport;
window.resetLearnProgress = resetLearnProgress;
window.copyLearnReport = copyLearnReport;
