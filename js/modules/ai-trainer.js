// AI-тренажёр: свободный диалог с AI-клиентом через Claude API
// Модель: claude-haiku, API-ключ хранится в localStorage

import { addXP, getGFData } from './gamification.js?v=mqtc94ef';

const AI_KEY_STORAGE = 'transkom_ai_api_key';
const AI_MODEL = 'claude-haiku-4-5-20251001';

// Уровни сложности клиента
const DIFFICULTY_LEVELS = [
  { id: 'friendly', name: 'Дружелюбный', desc: 'Клиент открыт к диалогу, легко идёт на контакт', emoji: '😊' },
  { id: 'hesitant', name: 'Сомневающийся', desc: 'Клиент задаёт много вопросов, сравнивает с конкурентами', emoji: '🤔' },
  { id: 'tough', name: 'Сложный', desc: 'Клиент агрессивный, всё дорого, всё не то', emoji: '😤' }
];

// Чек-лист оценки разговора
const CHECKLIST = [
  { id: 'greeting', label: 'Представился (имя + компания)' },
  { id: 'need', label: 'Выявил потребность' },
  { id: 'tech', label: 'Рассказал про технологию / подход' },
  { id: 'presentation', label: 'Провёл мини-презентацию компании' },
  { id: 'objection', label: 'Отработал возражение' },
  { id: 'next-step', label: 'Предложил следующий шаг (замер, КП, встреча)' }
];

let chatHistory = [];
let currentDifficulty = 'friendly';
let isInitialized = false;

// Системный промпт для Claude
function getSystemPrompt(difficulty) {
  const diffConfig = {
    friendly: 'Ты дружелюбный клиент. Легко идёшь на контакт, отвечаешь подробно, готов рассмотреть предложение. Но у тебя есть реальная потребность — территория требует ремонта.',
    hesitant: 'Ты сомневающийся клиент. Задаёшь много вопросов, сравниваешь с другими компаниями, упоминаешь что "надо подумать". Не отказываешь сразу, но и не соглашаешься легко.',
    tough: 'Ты сложный, требовательный клиент. Говоришь что "дорого", "у нас есть подрядчик", "не интересно". Очень скептичен. Но если менеджер покажет экспертизу и настойчивость — можешь дать шанс.'
  };

  return `Ты играешь роль потенциального клиента компании, которой нужно асфальтирование / ремонт дороги / благоустройство территории.

Контекст:
- Ты — представитель компании (завхоз, главный инженер или директор)
- У тебя есть территория (парковка, двор, подъездная дорога) которая нуждается в ремонте
- Площадь примерно 300-800 м²
- Бюджет обсуждаемый, но ты хочешь понять ценность

Характер: ${diffConfig[difficulty]}

Правила:
1. Отвечай кратко (1-3 предложения), как в реальном телефонном разговоре
2. Не выходи из роли клиента
3. Реагируй реалистично на ответы менеджера
4. Если менеджер хорошо ведёт диалог — постепенно становись более открытым
5. НЕ пиши подсказки менеджеру — только реплики клиента
6. Первое сообщение клиента — "Алло, слушаю." (если менеджер начинает первым) или описание ситуации
7. Отвечай ТОЛЬКО на русском языке`;
}

// Инициализация UI
export function initAITrainer() {
  if (isInitialized) return;
  isInitialized = true;

  const settings = document.getElementById('ai-trainer-settings');
  const chat = document.getElementById('ai-trainer-chat');
  if (!settings || !chat) return;

  const apiKey = localStorage.getItem(AI_KEY_STORAGE) || '';

  settings.innerHTML = `
    <div class="ait-config">
      <div class="ait-key-row">
        <label>API-ключ Anthropic:</label>
        <input type="password" class="ait-key-input" id="ait-api-key" value="${apiKey}" placeholder="sk-ant-...">
        <button class="ait-key-save" onclick="saveAIKey()">Сохранить</button>
      </div>
      <div class="ait-key-hint">Ключ хранится только в вашем браузере. <a href="https://console.anthropic.com/" target="_blank">Получить ключ</a></div>
      <div class="ait-difficulty">
        <label>Уровень сложности клиента:</label>
        <div class="ait-diff-btns">
          ${DIFFICULTY_LEVELS.map(d => `<button class="ait-diff-btn ${d.id === currentDifficulty ? 'active' : ''}" onclick="setAIDifficulty('${d.id}')" title="${d.desc}">${d.emoji} ${d.name}</button>`).join('')}
        </div>
      </div>
      <button class="ait-start-btn" onclick="startAIChat()" id="ait-start-btn">Начать разговор</button>
    </div>
  `;

  chat.innerHTML = `
    <div class="ait-messages" id="ait-messages"></div>
    <div class="ait-input-row" id="ait-input-row" style="display:none">
      <input type="text" class="ait-msg-input" id="ait-msg-input" placeholder="Ваша реплика..." onkeydown="if(event.key==='Enter')sendAIMessage()">
      <button class="ait-send-btn" onclick="sendAIMessage()">Отправить</button>
    </div>
    <div class="ait-controls" id="ait-controls" style="display:none">
      <button class="ait-end-btn" onclick="endAIChat()">Завершить разговор</button>
    </div>
    <div class="ait-evaluation" id="ait-evaluation" style="display:none"></div>
  `;
}

// Сохранить API-ключ
export function saveAIKey() {
  const input = document.getElementById('ait-api-key');
  if (!input) return;
  localStorage.setItem(AI_KEY_STORAGE, input.value.trim());
  input.type = 'password';
  _showStatus('Ключ сохранён');
}

// Установить сложность
export function setAIDifficulty(level) {
  currentDifficulty = level;
  document.querySelectorAll('.ait-diff-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.ait-diff-btn[onclick*="${level}"]`);
  if (btn) btn.classList.add('active');
}

// Начать чат
export function startAIChat() {
  const apiKey = localStorage.getItem(AI_KEY_STORAGE);
  if (!apiKey) {
    alert('Введите API-ключ Anthropic');
    return;
  }

  chatHistory = [];
  const messages = document.getElementById('ait-messages');
  const inputRow = document.getElementById('ait-input-row');
  const controls = document.getElementById('ait-controls');
  const evaluation = document.getElementById('ait-evaluation');

  if (messages) messages.innerHTML = '<div class="ait-system-msg">Разговор начат. Вы — менеджер Транском. Позвоните клиенту!</div>';
  if (inputRow) inputRow.style.display = 'flex';
  if (controls) controls.style.display = 'flex';
  if (evaluation) { evaluation.style.display = 'none'; evaluation.innerHTML = ''; }

  document.getElementById('ait-msg-input')?.focus();
}

// Отправить сообщение
export async function sendAIMessage() {
  const input = document.getElementById('ait-msg-input');
  const messages = document.getElementById('ait-messages');
  if (!input || !messages) return;

  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.disabled = true;

  // Показать сообщение менеджера
  _addMessage(messages, 'manager', text);
  chatHistory.push({ role: 'user', content: text });

  // Показать индикатор печати
  const typing = document.createElement('div');
  typing.className = 'ait-msg ait-msg-client ait-typing';
  typing.innerHTML = '<span>Клиент печатает...</span>';
  messages.appendChild(typing);
  messages.scrollTop = messages.scrollHeight;

  try {
    const apiKey = localStorage.getItem(AI_KEY_STORAGE);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 300,
        system: getSystemPrompt(currentDifficulty),
        messages: chatHistory
      })
    });

    typing.remove();

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Клиент молчит...';

    chatHistory.push({ role: 'assistant', content: reply });
    _addMessage(messages, 'client', reply);
  } catch (err) {
    typing.remove();
    _addMessage(messages, 'system', `Ошибка: ${err.message}`);
  }

  input.disabled = false;
  input.focus();
}

// Завершить и оценить
export async function endAIChat() {
  const inputRow = document.getElementById('ait-input-row');
  const controls = document.getElementById('ait-controls');
  const evaluation = document.getElementById('ait-evaluation');
  if (inputRow) inputRow.style.display = 'none';
  if (controls) controls.style.display = 'none';
  if (!evaluation) return;

  evaluation.style.display = 'block';
  evaluation.innerHTML = '<div class="ait-eval-loading">Оцениваю разговор...</div>';

  // Попробовать автоматическую оценку через API
  const apiKey = localStorage.getItem(AI_KEY_STORAGE);
  if (apiKey && chatHistory.length >= 2) {
    try {
      const evalPrompt = `Проанализируй диалог менеджера по продажам (user) с клиентом (assistant).
Оцени по чек-листу (да/нет для каждого пункта):
1. Представился (имя + компания)
2. Выявил потребность клиента
3. Рассказал про технологию / подход к работе
4. Провёл мини-презентацию компании (опыт, техника, гарантии)
5. Отработал возражение
6. Предложил следующий шаг (замер, КП, встреча)

Также дай общую оценку от 1 до 10 и краткий совет (1-2 предложения).

Формат ответа (строго JSON):
{"items":[true,false,true,true,false,true],"score":7,"advice":"Краткий совет"}`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: AI_MODEL,
          max_tokens: 500,
          system: 'Ты — тренер продаж. Анализируй диалоги и давай оценку. Отвечай ТОЛЬКО JSON.',
          messages: [
            ...chatHistory,
            { role: 'user', content: evalPrompt }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.content?.[0]?.text || '';
        // Извлечь JSON из ответа
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const evalData = JSON.parse(jsonMatch[0]);
          _renderEvaluation(evaluation, evalData);

          // Начислить XP за хороший результат
          if (evalData.score >= 7) {
            addXP(15, 'AI-тренажёр');
          }
          return;
        }
      }
    } catch (err) {
      // Если API не сработал — ручная оценка
    }
  }

  // Фоллбэк: ручной чек-лист
  _renderManualChecklist(evaluation);
}

function _renderEvaluation(el, evalData) {
  const checklistHTML = CHECKLIST.map((item, i) => {
    const done = evalData.items?.[i];
    return `<div class="ait-check-item ${done ? 'ait-check-yes' : 'ait-check-no'}">
      <span>${done ? '✅' : '❌'}</span> ${item.label}
    </div>`;
  }).join('');

  const doneCount = (evalData.items || []).filter(Boolean).length;

  el.innerHTML = `
    <div class="ait-eval-title">Оценка разговора</div>
    <div class="ait-eval-score">
      <div class="ait-eval-number">${evalData.score || '?'}/10</div>
      <div class="ait-eval-checklist-count">${doneCount}/${CHECKLIST.length} пунктов чек-листа</div>
    </div>
    <div class="ait-eval-checklist">${checklistHTML}</div>
    ${evalData.advice ? `<div class="ait-eval-advice"><strong>Совет:</strong> ${evalData.advice}</div>` : ''}
    <button class="ait-start-btn" onclick="startAIChat()" style="margin-top:12px">Начать новый разговор</button>
  `;
}

function _renderManualChecklist(el) {
  const checklistHTML = CHECKLIST.map(item =>
    `<label class="ait-manual-check"><input type="checkbox" value="${item.id}"> ${item.label}</label>`
  ).join('');

  el.innerHTML = `
    <div class="ait-eval-title">Самооценка</div>
    <div class="ait-eval-desc">Отметьте, что вы сделали в разговоре:</div>
    <div class="ait-eval-checklist">${checklistHTML}</div>
    <button class="ait-start-btn" onclick="startAIChat()" style="margin-top:12px">Начать новый разговор</button>
  `;
}

// Добавить сообщение в чат
function _addMessage(container, type, text) {
  const msg = document.createElement('div');
  const labels = { manager: 'Вы (менеджер)', client: 'Клиент', system: 'Система' };
  msg.className = `ait-msg ait-msg-${type}`;
  msg.innerHTML = `<div class="ait-msg-label">${labels[type] || type}</div><div class="ait-msg-text">${text}</div>`;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function _showStatus(text) {
  const btn = document.querySelector('.ait-key-save');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = text;
    setTimeout(() => btn.textContent = orig, 1500);
  }
}

// Глобальные функции
window.initAITrainer = initAITrainer;
window.saveAIKey = saveAIKey;
window.setAIDifficulty = setAIDifficulty;
window.startAIChat = startAIChat;
window.sendAIMessage = sendAIMessage;
window.endAIChat = endAIChat;
