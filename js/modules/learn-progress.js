// Система прогресса обучения
// Хранение: localStorage ключ 'transkom_learn_progress'

const STORAGE_KEY = 'transkom_learn_progress';
const PASS_THRESHOLD = 80; // 80% для прохождения теста

// Карта категорий и порядок статей (линейное прохождение внутри категории)
export const LEARN_MAP = [
  { id: 'materials', name: 'Смеси и материалы', articles: ['bitum-emulsion','asphalt-concrete','asphalt-crumb','special-asphalt','asphalt-sma','asphalt-mixes'] },
  { id: 'construction', name: 'Конструкции дороги', articles: ['road-base','concrete-base','road-pie','road-slabs'] },
  { id: 'tech', name: 'Технологии работ', articles: ['asphalt-laying','pothole-repair','crack-sealing','geomaterials','road-marking','asphalt-calc'] },
  { id: 'landscaping', name: 'Благоустройство', articles: ['curbs','paving-tiles','storm-trays','concrete-wells','lawns'] },
  { id: 'raw', name: 'Сырьё и техника', articles: ['road-sand','soil-drainage','road-machinery','crushed-stone'] },
  { id: 'tools', name: 'Инструменты', articles: ['planfix-intro','planfix-guide','base-calling'] }
];

// Чтение/запись прогресса
export function getProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Сохранить результат квиза
export function saveQuizResult(articleId, score, total) {
  const data = getProgress();
  const pct = Math.round(score / total * 100);
  const passed = pct >= PASS_THRESHOLD;
  data[articleId] = { score, total, pct, passed, date: new Date().toISOString().slice(0, 10) };
  saveProgress(data);
  return { pct, passed };
}

// Проверить, разблокирована ли статья
export function isArticleUnlocked(articleId) {
  const data = getProgress();
  for (const cat of LEARN_MAP) {
    const idx = cat.articles.indexOf(articleId);
    if (idx === -1) continue;
    // Категория «Инструменты» — без блокировки, всё доступно сразу
    if (cat.id === 'tools') return true;
    // Первая статья в категории всегда открыта
    if (idx === 0) return true;
    // Остальные — только если предыдущая сдана
    const prevId = cat.articles[idx - 1];
    return data[prevId]?.passed === true;
  }
  return true;
}

// Статус статьи: 'locked', 'available', 'passed'
export function getArticleStatus(articleId) {
  if (!isArticleUnlocked(articleId)) return 'locked';
  const data = getProgress();
  if (data[articleId]?.passed) return 'passed';
  return 'available';
}

// Прогресс по категории
export function getCategoryProgress(catId) {
  const data = getProgress();
  const cat = LEARN_MAP.find(c => c.id === catId);
  if (!cat) return { passed: 0, total: 0, pct: 0 };
  const passed = cat.articles.filter(a => data[a]?.passed).length;
  return { passed, total: cat.articles.length, pct: Math.round(passed / cat.articles.length * 100) };
}

// Общий прогресс
export function getOverallProgress() {
  const data = getProgress();
  let passed = 0, total = 0;
  for (const cat of LEARN_MAP) {
    total += cat.articles.length;
    passed += cat.articles.filter(a => data[a]?.passed).length;
  }
  return { passed, total, pct: total > 0 ? Math.round(passed / total * 100) : 0 };
}

// Полный отчёт для руководителя
export function getReport() {
  const data = getProgress();
  return LEARN_MAP.map(cat => ({
    ...cat,
    progress: getCategoryProgress(cat.id),
    articles: cat.articles.map(id => {
      const r = data[id];
      return { id, score: r?.score || 0, total: r?.total || 0, pct: r?.pct || 0, passed: r?.passed || false, date: r?.date || null };
    })
  }));
}

// Сброс прогресса
export function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

export { PASS_THRESHOLD };
