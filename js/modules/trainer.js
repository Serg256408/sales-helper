// Тренажёр продаж: сценарии с выбором ответа
// Интеграция с геймификацией (XP, бейджи)

import { TRAINER_SCENARIOS } from '../data/trainer-scenarios.js';
import { addXP, recordTrainerScenario, getGFData } from './gamification.js';

let currentScenario = null;
let currentStep = 0;
let scenarioScore = 0;

// Инициализация — список сценариев
export function initTrainer() {
  renderScenariosList();
}

function renderScenariosList() {
  const list = document.getElementById('trainer-scenarios-list');
  if (!list) return;

  const data = getGFData();
  const completed = data.trainerCompleted || [];

  list.innerHTML = '<div class="tr-list-title">Выберите сценарий для тренировки:</div>' +
    TRAINER_SCENARIOS.map(s => {
      const done = completed.includes(s.id);
      return `<div class="tr-scenario-card ${done ? 'tr-done' : ''}" onclick="startScenario('${s.id}')">
        <div class="tr-sc-icon">${s.icon}</div>
        <div class="tr-sc-info">
          <div class="tr-sc-name">${s.name} ${done ? '<span class="tr-sc-check">✓</span>' : ''}</div>
          <div class="tr-sc-desc">${s.desc}</div>
          <div class="tr-sc-steps">${s.steps.length} шагов</div>
        </div>
      </div>`;
    }).join('');
}

// Начать сценарий
export function startScenario(scenarioId) {
  currentScenario = TRAINER_SCENARIOS.find(s => s.id === scenarioId);
  if (!currentScenario) return;

  currentStep = 0;
  scenarioScore = 0;

  const list = document.getElementById('trainer-scenarios-list');
  const area = document.getElementById('trainer-play-area');
  if (list) list.style.display = 'none';
  if (area) area.style.display = 'block';

  renderStep();
}

function renderStep() {
  const area = document.getElementById('trainer-play-area');
  if (!area || !currentScenario) return;

  const step = currentScenario.steps[currentStep];
  const progress = `${currentStep + 1}/${currentScenario.steps.length}`;

  area.innerHTML = `
    <div class="tr-play-header">
      <button class="tr-back-btn" onclick="exitScenario()">← Назад</button>
      <div class="tr-play-title">${currentScenario.icon} ${currentScenario.name}</div>
      <div class="tr-play-step">Шаг ${progress}</div>
    </div>
    <div class="tr-progress-bar"><div class="tr-progress-fill" style="width:${(currentStep + 1) / currentScenario.steps.length * 100}%"></div></div>
    <div class="tr-client-msg">
      <div class="tr-client-label">Клиент:</div>
      <div class="tr-client-text">${step.client}</div>
    </div>
    <div class="tr-options">
      ${step.options.map((opt, i) => `<div class="tr-option" onclick="selectOption(${i})" id="tr-opt-${i}">${opt}</div>`).join('')}
    </div>
    <div class="tr-feedback" id="tr-feedback" style="display:none"></div>
    <div class="tr-score">Баллы: ${scenarioScore}/${currentStep}</div>
  `;
}

// Выбор варианта
export function selectOption(idx) {
  const step = currentScenario.steps[currentStep];
  const correct = idx === step.correct;
  const options = document.querySelectorAll('.tr-option');
  const feedback = document.getElementById('tr-feedback');

  // Заблокировать все варианты
  options.forEach((opt, i) => {
    opt.onclick = null;
    opt.style.cursor = 'default';
    if (i === step.correct) opt.classList.add('tr-correct');
    if (i === idx && !correct) opt.classList.add('tr-wrong');
  });

  if (correct) {
    scenarioScore++;
    feedback.className = 'tr-feedback tr-fb-correct';
    feedback.innerHTML = '✅ Правильно!';
  } else {
    feedback.className = 'tr-feedback tr-fb-wrong';
    feedback.innerHTML = `❌ Не совсем. ${step.feedback}`;
  }
  feedback.style.display = 'block';

  // Обновить счёт
  const scoreEl = document.querySelector('.tr-score');
  if (scoreEl) scoreEl.textContent = `Баллы: ${scenarioScore}/${currentStep + 1}`;

  // Кнопка «Далее»
  setTimeout(() => {
    const nextBtn = document.createElement('button');
    nextBtn.className = 'tr-next-btn';
    nextBtn.textContent = currentStep < currentScenario.steps.length - 1 ? 'Далее →' : 'Завершить';
    nextBtn.onclick = () => {
      if (currentStep < currentScenario.steps.length - 1) {
        currentStep++;
        renderStep();
      } else {
        finishScenario();
      }
    };
    feedback.appendChild(nextBtn);
  }, 600);
}

// Завершение сценария
function finishScenario() {
  const area = document.getElementById('trainer-play-area');
  if (!area) return;

  const total = currentScenario.steps.length;
  const pct = Math.round(scenarioScore / total * 100);
  const passed = pct >= 70;

  // Начислить XP и записать прохождение
  if (passed) {
    recordTrainerScenario(currentScenario.id);
  }

  area.innerHTML = `
    <div class="tr-result">
      <div class="tr-result-icon">${passed ? '🏆' : '📝'}</div>
      <div class="tr-result-title">${passed ? 'Отлично!' : 'Попробуйте ещё раз'}</div>
      <div class="tr-result-score">${scenarioScore} из ${total} (${pct}%)</div>
      <div class="tr-result-msg">${passed ? 'Сценарий пройден! +15 XP' : 'Нужно минимум 70% правильных ответов для прохождения.'}</div>
      <div class="tr-result-actions">
        <button class="tr-btn" onclick="startScenario('${currentScenario.id}')">Пройти снова</button>
        <button class="tr-btn tr-btn-outline" onclick="exitScenario()">К списку сценариев</button>
      </div>
    </div>
  `;
}

// Выход к списку
export function exitScenario() {
  currentScenario = null;
  currentStep = 0;
  scenarioScore = 0;

  const list = document.getElementById('trainer-scenarios-list');
  const area = document.getElementById('trainer-play-area');
  if (list) list.style.display = '';
  if (area) { area.style.display = 'none'; area.innerHTML = ''; }

  renderScenariosList();
}

// Переключение режимов тренажёра
export function switchTrainerMode(mode) {
  const wraps = {
    scenarios: document.getElementById('trainer-scenarios-wrap'),
    ai: document.getElementById('trainer-ai-wrap'),
    voice: document.getElementById('trainer-voice-wrap')
  };
  const btns = {
    scenarios: document.getElementById('trainer-mode-scenarios'),
    ai: document.getElementById('trainer-mode-ai'),
    voice: document.getElementById('trainer-mode-voice')
  };

  // Скрыть все, убрать active
  Object.values(wraps).forEach(w => { if (w) w.style.display = 'none'; });
  Object.values(btns).forEach(b => { if (b) b.classList.remove('active'); });

  // Показать выбранный
  if (wraps[mode]) wraps[mode].style.display = '';
  if (btns[mode]) btns[mode].classList.add('active');

  // Инициализация при первом переключении
  if (mode === 'ai' && window.initAITrainer) window.initAITrainer();
  if (mode === 'voice' && window.initVoiceTrainer) window.initVoiceTrainer();
}

// Глобальные функции
window.startScenario = startScenario;
window.selectOption = selectOption;
window.exitScenario = exitScenario;
window.switchTrainerMode = switchTrainerMode;
