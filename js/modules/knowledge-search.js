// Поиск по базе знаний обучения

let _index = null; // Кэш индекса

// Построить индекс из статей в DOM
function _buildIndex() {
  if (_index) return _index;
  _index = [];
  document.querySelectorAll('.learn-article').forEach(article => {
    const id = article.id.replace('article-', '');
    const titleEl = article.querySelector('.la-hero-title');
    const title = titleEl ? titleEl.textContent : id;

    // Собрать текст из секций
    article.querySelectorAll('.la-section').forEach(section => {
      const sectionTitle = section.querySelector('.la-section-title');
      const sName = sectionTitle ? sectionTitle.textContent.trim() : '';

      // Собрать весь текст секции (без квиза)
      const texts = [];
      section.querySelectorAll('.la-text, .la-info, .la-highlight, .la-img-caption').forEach(el => {
        texts.push(el.textContent.trim());
      });
      // Текст таблиц
      section.querySelectorAll('.la-table td, .la-table th').forEach(el => {
        texts.push(el.textContent.trim());
      });

      const content = texts.join(' ');
      if (content.length > 10) {
        _index.push({ articleId: id, articleTitle: title, sectionTitle: sName, content });
      }
    });
  });
  return _index;
}

// Поиск
export function searchKnowledge(query) {
  const results = document.getElementById('ks-results');
  const clearBtn = document.getElementById('ks-clear');
  if (!results) return;

  if (clearBtn) clearBtn.style.display = query.length > 0 ? '' : 'none';

  if (query.length < 2) {
    results.innerHTML = '<div class="ks-hint">Введите запрос — например: «битум», «толщина», «расход», «бордюр»</div>';
    return;
  }

  const index = _buildIndex();
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter(w => w.length >= 2);

  // Поиск по всем секциям
  const matches = [];
  index.forEach(entry => {
    const lowerContent = entry.content.toLowerCase();
    const lowerTitle = entry.articleTitle.toLowerCase();
    const lowerSection = entry.sectionTitle.toLowerCase();

    // Все слова запроса должны быть найдены
    const allMatch = words.every(w => lowerContent.includes(w) || lowerTitle.includes(w) || lowerSection.includes(w));
    if (!allMatch) return;

    // Подсчёт релевантности
    let score = 0;
    words.forEach(w => {
      if (lowerTitle.includes(w)) score += 10;
      if (lowerSection.includes(w)) score += 5;
      // Количество вхождений в контенте
      let pos = 0;
      while ((pos = lowerContent.indexOf(w, pos)) !== -1) { score++; pos += w.length; }
    });

    // Сниппет — найти первое вхождение и вырезать кусок текста
    let snippet = '';
    const firstWord = words[0];
    const idx = lowerContent.indexOf(firstWord);
    if (idx !== -1) {
      const start = Math.max(0, idx - 60);
      const end = Math.min(entry.content.length, idx + firstWord.length + 120);
      snippet = (start > 0 ? '...' : '') + entry.content.slice(start, end) + (end < entry.content.length ? '...' : '');
    } else {
      snippet = entry.content.slice(0, 150) + '...';
    }

    matches.push({ ...entry, score, snippet });
  });

  // Сортировка по релевантности, дедупликация по статье (макс 2 секции на статью)
  matches.sort((a, b) => b.score - a.score);
  const seen = {};
  const filtered = [];
  matches.forEach(m => {
    seen[m.articleId] = (seen[m.articleId] || 0) + 1;
    if (seen[m.articleId] <= 2) filtered.push(m);
  });

  if (filtered.length === 0) {
    results.innerHTML = '<div class="ks-hint">Ничего не найдено по запросу «' + _escHtml(query) + '»</div>';
    return;
  }

  // Рендер результатов
  let html = '<div class="ks-count">Найдено: ' + filtered.length + ' результат' + _plural(filtered.length) + '</div>';
  filtered.slice(0, 20).forEach(m => {
    // Подсветить слова в сниппете
    let hl = _escHtml(m.snippet);
    words.forEach(w => {
      const re = new RegExp('(' + _escRegex(w) + ')', 'gi');
      hl = hl.replace(re, '<mark>$1</mark>');
    });

    html += '<div class="ks-item" onclick="goToArticle(\'' + m.articleId + '\')">';
    html += '<div class="ks-item-title">' + _escHtml(m.articleTitle) + '</div>';
    if (m.sectionTitle) html += '<div class="ks-item-section">' + _escHtml(m.sectionTitle) + '</div>';
    html += '<div class="ks-item-snippet">' + hl + '</div>';
    html += '</div>';
  });

  results.innerHTML = html;
}

// Перейти к статье из поиска
export function goToArticle(articleId) {
  closeKnowledgeSearch();
  // Переключиться на вкладку обучения
  if (window.tab) window.tab('learn');
  // Открыть статью
  setTimeout(() => {
    if (window.showArticle) window.showArticle(articleId);
  }, 100);
}

// Открыть/закрыть поиск
export function openKnowledgeSearch() {
  const modal = document.getElementById('ks-modal');
  if (modal) {
    modal.style.display = 'flex';
    const input = document.getElementById('ks-input');
    if (input) { input.value = ''; input.focus(); }
    const results = document.getElementById('ks-results');
    if (results) results.innerHTML = '<div class="ks-hint">Введите запрос — например: «битум», «толщина», «расход», «бордюр»</div>';
  }
}

export function closeKnowledgeSearch() {
  const modal = document.getElementById('ks-modal');
  if (modal) modal.style.display = 'none';
}

// Горячая клавиша Ctrl+K для открытия поиска
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    openKnowledgeSearch();
  }
  if (e.key === 'Escape') {
    closeKnowledgeSearch();
  }
});

// Утилиты
function _escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function _escRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function _plural(n) {
  if (n % 10 === 1 && n % 100 !== 11) return '';
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'а';
  return 'ов';
}

// Глобальные функции
window.searchKnowledge = searchKnowledge;
window.goToArticle = goToArticle;
window.openKnowledgeSearch = openKnowledgeSearch;
window.closeKnowledgeSearch = closeKnowledgeSearch;
