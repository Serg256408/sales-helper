// Геймификация: XP, уровни, бейджи, профиль, вопрос дня
// Хранение: localStorage ключ 'transkom_gamification'

import { getProgress, getOverallProgress, LEARN_MAP } from './learn-progress.js';

const GF_KEY = 'transkom_gamification';

// === Уровни ===
const LEVELS = [
  { name: 'Стажёр',       minXP: 0,   icon: '🟢' },
  { name: 'Специалист',   minXP: 100, icon: '🔵' },
  { name: 'Эксперт',      minXP: 300, icon: '🟣' },
  { name: 'Мастер ДСР',   minXP: 600, icon: '🏆' }
];

// === Бейджи ===
const BADGES = [
  { id: 'first-test',    name: 'Первый тест',       desc: 'Сдать первый тест на 80%+',          icon: '🎯' },
  { id: 'sniper',        name: 'Снайпер тестов',     desc: 'Сдать 5 тестов на 100%',             icon: '🎯' },
  { id: 'tech-expert',   name: 'Знаток технологий',  desc: 'Пройти все статьи категории «Технологии работ»', icon: '⚙️' },
  { id: 'materials-pro', name: 'Знаток материалов',  desc: 'Пройти все статьи категории «Смеси и материалы»', icon: '🧱' },
  { id: 'objection-master', name: 'Мастер возражений', desc: 'Пройти 3 сценария тренажёра', icon: '💬' },
  { id: 'full-course',   name: 'Выпускник',          desc: 'Пройти все тесты обучения',          icon: '🎓' },
  { id: 'streak-7',      name: 'Неделя подряд',      desc: '7 дней подряд заходить и отвечать на вопрос дня', icon: '🔥' },
  { id: 'streak-30',     name: 'Месяц дисциплины',   desc: '30 дней подряд отвечать на вопрос дня', icon: '💪' },
  { id: 'trainer-all',   name: 'Тренажёр пройден',   desc: 'Пройти все 6 сценариев тренажёра',   icon: '🏅' },
  { id: 'daily-10',      name: '10 вопросов дня',    desc: 'Правильно ответить на 10 вопросов дня', icon: '📅' }
];

// === Чтение/запись данных ===
export function getGFData() {
  try {
    const raw = localStorage.getItem(GF_KEY);
    return raw ? JSON.parse(raw) : _defaultData();
  } catch { return _defaultData(); }
}

function _defaultData() {
  return {
    name: '',
    xp: 0,
    badges: [],           // массив id полученных бейджей
    dailyStreak: 0,       // текущая серия дней
    lastDailyDate: null,   // дата последнего вопроса дня
    dailyCorrect: 0,       // всего правильных вопросов дня
    trainerCompleted: [],  // id пройденных сценариев
    perfectTests: 0        // тесты на 100%
  };
}

function _save(data) {
  localStorage.setItem(GF_KEY, JSON.stringify(data));
}

// === XP ===
export function addXP(amount, reason) {
  const data = getGFData();
  data.xp += amount;
  _save(data);
  _showXPToast(amount, reason);
  _checkBadges();
  updateProfileUI();
  return data.xp;
}

// === Уровень ===
export function getLevel(xp) {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.minXP) level = l;
  }
  return level;
}

export function getNextLevel(xp) {
  for (const l of LEVELS) {
    if (xp < l.minXP) return l;
  }
  return null; // максимальный уровень
}

// === Бейджи ===
export function checkAndAwardBadge(badgeId) {
  const data = getGFData();
  if (data.badges.includes(badgeId)) return false;
  data.badges.push(badgeId);
  _save(data);
  const badge = BADGES.find(b => b.id === badgeId);
  if (badge) _showBadgeToast(badge);
  return true;
}

function _checkBadges() {
  const data = getGFData();
  const progress = getProgress();

  // Первый тест
  const anyPassed = Object.values(progress).some(r => r.passed);
  if (anyPassed) checkAndAwardBadge('first-test');

  // Снайпер — 5 тестов на 100%
  const perfectCount = Object.values(progress).filter(r => r.pct === 100).length;
  if (perfectCount >= 5) checkAndAwardBadge('sniper');

  // Знаток технологий
  const techCat = LEARN_MAP.find(c => c.id === 'tech');
  if (techCat && techCat.articles.every(a => progress[a]?.passed)) {
    checkAndAwardBadge('tech-expert');
  }

  // Знаток материалов
  const matCat = LEARN_MAP.find(c => c.id === 'materials');
  if (matCat && matCat.articles.every(a => progress[a]?.passed)) {
    checkAndAwardBadge('materials-pro');
  }

  // Выпускник — все тесты
  const overall = getOverallProgress();
  if (overall.pct === 100) checkAndAwardBadge('full-course');

  // Серия 7 дней
  if (data.dailyStreak >= 7) checkAndAwardBadge('streak-7');

  // Серия 30 дней
  if (data.dailyStreak >= 30) checkAndAwardBadge('streak-30');

  // 10 правильных вопросов дня
  if (data.dailyCorrect >= 10) checkAndAwardBadge('daily-10');

  // Тренажёр — 3 сценария
  if (data.trainerCompleted.length >= 3) checkAndAwardBadge('objection-master');

  // Тренажёр — все 6
  if (data.trainerCompleted.length >= 6) checkAndAwardBadge('trainer-all');
}

// === Вопрос дня ===
export function recordDailyAnswer(correct) {
  const data = getGFData();
  const today = new Date().toISOString().slice(0, 10);

  if (correct) {
    data.dailyCorrect++;
    addXP(5, 'Вопрос дня');
  }

  // Серия
  if (data.lastDailyDate) {
    const last = new Date(data.lastDailyDate);
    const now = new Date(today);
    const diff = Math.round((now - last) / 86400000);
    if (diff === 1) {
      data.dailyStreak++;
      // Бонус за 7 дней подряд
      if (data.dailyStreak % 7 === 0) {
        addXP(20, 'Серия ' + data.dailyStreak + ' дней!');
      }
    } else if (diff > 1) {
      data.dailyStreak = 1;
    }
  } else {
    data.dailyStreak = 1;
  }

  data.lastDailyDate = today;
  _save(data);
  _checkBadges();
  updateProfileUI();
}

// === Запись тренажёра ===
export function recordTrainerScenario(scenarioId) {
  const data = getGFData();
  if (!data.trainerCompleted.includes(scenarioId)) {
    data.trainerCompleted.push(scenarioId);
    _save(data);
    addXP(15, 'Сценарий тренажёра');
  }
}

// === Установить имя ===
export function setManagerName(name) {
  const data = getGFData();
  data.name = name.trim();
  _save(data);
  updateProfileUI();
}

// === UI: Профиль в хедере ===
export function updateProfileUI() {
  const data = getGFData();
  const level = getLevel(data.xp);
  const next = getNextLevel(data.xp);

  // Профиль-кнопка
  const profileBtn = document.getElementById('gf-profile-btn');
  if (profileBtn) {
    const name = data.name || 'Менеджер';
    const shortName = name.length > 10 ? name.slice(0, 10) + '…' : name;
    profileBtn.innerHTML = `<span class="gf-level-icon">${level.icon}</span> <span class="gf-name">${shortName}</span> <span class="gf-xp">${data.xp} XP</span>`;
  }

  // Прогресс-бар уровня
  const progressBar = document.getElementById('gf-level-bar');
  if (progressBar && next) {
    const prevMin = level.minXP;
    const range = next.minXP - prevMin;
    const pct = Math.min(100, Math.round((data.xp - prevMin) / range * 100));
    progressBar.style.width = pct + '%';
  } else if (progressBar) {
    progressBar.style.width = '100%';
  }
}

// === UI: Модалка профиля ===
export function showProfileModal() {
  const data = getGFData();
  const level = getLevel(data.xp);
  const next = getNextLevel(data.xp);
  const modal = document.getElementById('gf-profile-modal');
  if (!modal) return;

  const prevMin = level.minXP;
  const range = next ? next.minXP - prevMin : 1;
  const pct = next ? Math.min(100, Math.round((data.xp - prevMin) / range * 100)) : 100;
  const nextText = next ? `До «${next.name}»: ${next.minXP - data.xp} XP` : 'Максимальный уровень!';

  let badgesHTML = BADGES.map(b => {
    const earned = data.badges.includes(b.id);
    return `<div class="gf-badge ${earned ? 'earned' : 'locked'}" title="${b.desc}">
      <span class="gf-badge-icon">${earned ? b.icon : '🔒'}</span>
      <span class="gf-badge-name">${b.name}</span>
    </div>`;
  }).join('');

  document.getElementById('gf-modal-body').innerHTML = `
    <div class="gf-modal-profile">
      <div class="gf-modal-avatar">${level.icon}</div>
      <div class="gf-modal-info">
        <div class="gf-modal-name" id="gf-modal-name-display">${data.name || '<i>Нажмите чтобы ввести имя</i>'}</div>
        <div class="gf-modal-level">${level.name}</div>
        <div class="gf-modal-xp">${data.xp} XP &middot; ${nextText}</div>
        <div class="gf-modal-bar-wrap"><div class="gf-modal-bar-fill" style="width:${pct}%"></div></div>
      </div>
    </div>
    <div class="gf-modal-stats">
      <div class="gf-stat"><span class="gf-stat-val">${data.dailyStreak}</span><span class="gf-stat-label">Дней подряд</span></div>
      <div class="gf-stat"><span class="gf-stat-val">${data.dailyCorrect}</span><span class="gf-stat-label">Вопросов дня</span></div>
      <div class="gf-stat"><span class="gf-stat-val">${data.trainerCompleted.length}</span><span class="gf-stat-label">Сценариев</span></div>
      <div class="gf-stat"><span class="gf-stat-val">${data.badges.length}/${BADGES.length}</span><span class="gf-stat-label">Бейджей</span></div>
    </div>
    <div class="gf-badges-title">Достижения</div>
    <div class="gf-badges-grid">${badgesHTML}</div>
  `;

  // Клик по имени — редактирование
  document.getElementById('gf-modal-name-display').onclick = () => {
    const current = data.name || '';
    const input = prompt('Введите ваше имя:', current);
    if (input !== null) {
      setManagerName(input);
      showProfileModal(); // обновить
    }
  };

  modal.style.display = 'flex';
}

export function closeProfileModal() {
  const modal = document.getElementById('gf-profile-modal');
  if (modal) modal.style.display = 'none';
}

// === UI: Тост +XP ===
function _showXPToast(amount, reason) {
  const toast = document.createElement('div');
  toast.className = 'gf-xp-toast';
  toast.innerHTML = `+${amount} XP <span class="gf-toast-reason">${reason || ''}</span>`;
  document.body.appendChild(toast);
  // Анимация
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// === UI: Тост бейджа ===
function _showBadgeToast(badge) {
  const toast = document.createElement('div');
  toast.className = 'gf-badge-toast';
  toast.innerHTML = `<div class="gf-bt-icon">${badge.icon}</div><div><div class="gf-bt-title">Новое достижение!</div><div class="gf-bt-name">${badge.name}</div><div class="gf-bt-desc">${badge.desc}</div></div>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// === Вопрос дня: модалка ===
import { DAILY_QUESTIONS } from '../data/daily-questions.js';

export function showDailyQuestion() {
  const data = getGFData();
  const today = new Date().toISOString().slice(0, 10);

  // Уже отвечал сегодня
  if (data.lastDailyDate === today) return false;

  // Выбрать вопрос по дню (стабильный выбор)
  const dayIndex = Math.floor(new Date(today).getTime() / 86400000);
  const q = DAILY_QUESTIONS[dayIndex % DAILY_QUESTIONS.length];

  const modal = document.getElementById('gf-daily-modal');
  if (!modal) return false;

  let optionsHTML = q.options.map((opt, i) =>
    `<label class="gf-dq-option"><input type="radio" name="gf-dq" value="${i}"><span>${opt}</span></label>`
  ).join('');

  document.getElementById('gf-daily-body').innerHTML = `
    <div class="gf-dq-streak">Серия: ${data.dailyStreak} дн.</div>
    <div class="gf-dq-question">${q.question}</div>
    <div class="gf-dq-options">${optionsHTML}</div>
    <button class="gf-dq-submit" id="gf-dq-submit-btn">Ответить</button>
    <div class="gf-dq-result" id="gf-dq-result" style="display:none"></div>
  `;

  document.getElementById('gf-dq-submit-btn').onclick = () => {
    const selected = modal.querySelector('input[name="gf-dq"]:checked');
    if (!selected) return;
    const answer = parseInt(selected.value);
    const correct = answer === q.correct;
    const resultEl = document.getElementById('gf-dq-result');

    // Заблокировать кнопки
    modal.querySelectorAll('input[name="gf-dq"]').forEach(inp => inp.disabled = true);
    document.getElementById('gf-dq-submit-btn').style.display = 'none';

    // Подсветить правильный/неправильный
    const labels = modal.querySelectorAll('.gf-dq-option');
    labels[q.correct].classList.add('correct');
    if (!correct) labels[answer].classList.add('wrong');

    resultEl.style.display = 'block';
    if (correct) {
      resultEl.className = 'gf-dq-result gf-dq-correct';
      resultEl.innerHTML = '✅ Правильно! +5 XP';
    } else {
      resultEl.className = 'gf-dq-result gf-dq-wrong';
      resultEl.innerHTML = `❌ Неправильно. ${q.explanation || ''}`;
    }

    recordDailyAnswer(correct);
    setTimeout(() => closeDailyModal(), 2500);
  };

  modal.style.display = 'flex';
  return true;
}

export function closeDailyModal() {
  const modal = document.getElementById('gf-daily-modal');
  if (modal) modal.style.display = 'none';
}

// === Инициализация ===
export function initGamification() {
  updateProfileUI();
  // Показать вопрос дня при загрузке (с задержкой)
  setTimeout(() => showDailyQuestion(), 1500);
}

// Экспорт констант для использования в других модулях
export { LEVELS, BADGES };

// Глобальные функции для onclick
window.showProfileModal = showProfileModal;
window.closeProfileModal = closeProfileModal;
window.closeDailyModal = closeDailyModal;
