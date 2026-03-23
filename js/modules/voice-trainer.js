// Голосовой AI-тренажёр: естественный диалог с AI-клиентом
// STT: Web Speech API (авто-определение пауз, continuous: false)
// AI: Gemini через Polza.ai
// TTS: ElevenLabs через Polza.ai
// Цикл: слушаю → пауза → AI думает → AI говорит → снова слушаю

import { addXP } from './gamification.js';

const POLZA_KEY_STORAGE = 'transkom_polza_api_key';
const POLZA_API = 'https://api.polza.ai/api/v1';
const CHAT_MODEL = 'google/gemini-2.5-flash-lite'; // для диалога — быстрая
const EVAL_MODEL = 'google/gemini-2.5-flash';      // для анализа — умная
const TTS_MODEL = 'elevenlabs/text-to-speech-turbo-2-5';

const DIFFICULTY = [
  { id: 'friendly', name: 'Дружелюбный', emoji: '😊' },
  { id: 'hesitant', name: 'Сомневающийся', emoji: '🤔' },
  { id: 'tough', name: 'Сложный', emoji: '😤' }
];

const VOICES = [
  'Roger', 'George', 'Charlie', 'Liam', 'Daniel', 'Brian',
  'Rachel', 'Aria', 'Sarah', 'Laura', 'Charlotte', 'Alice', 'Jessica', 'Lily'
];

// Состояния
const STATE = { IDLE: 0, LISTENING: 1, THINKING: 2, SPEAKING: 3 };
let state = STATE.IDLE;
let chatHistory = [];
let callDuration = 0;
let callTimer = null;
let currentDifficulty = 'friendly';
let currentVoice = 'Roger';
let currentAudio = null;
let isCallActive = false;
let currentScenario = null; // фиксируется при старте звонка

// Чек-лист скрипта продаж (что менеджер ДОЛЖЕН сделать в разговоре)
const SCRIPT_CHECKLIST = [
  // Приветствие и квалификация
  { id: 'greeting', label: 'Приветствие: имя + компания Транском + чем занимаемся' },
  { id: 'qualify', label: 'Квалификация: уточнил кто отвечает за территорию (ЛПР)' },

  // Выявление потребности
  { id: 'need', label: 'Потребность: адрес, площадь, что делать, основание, нагрузки, сроки' },

  // ПРЕЗЕНТАЦИЯ (детально)
  { id: 'pres-age', label: 'Презентация — возраст: более 10 лет / с 2014 года' },
  { id: 'pres-team', label: 'Презентация — команда: 5 бригад, геодезист, проектировщик в штате' },
  { id: 'pres-services', label: 'Презентация — услуги: полный цикл дорожных работ и благоустройство' },
  { id: 'pres-docs', label: 'Презентация — документы: чистая фирма, НДС, все закрывающие документы (договор, акты, счета-фактуры)' },
  { id: 'pres-quality', label: 'Презентация — качество: проверенные поставщики, паспорта качества на материалы' },
  { id: 'pres-clients', label: 'Презентация — клиенты: госзаказчики, юрлица, строительные компании' },

  // Портфолио
  { id: 'portfolio', label: 'Портфолио: назвал конкретные объекты (Западная Долина, ЖК Московские, Микояновский)' },

  // Технология (должна соответствовать запросу клиента!)
  { id: 'tech-pie', label: 'Технология — конструкция: описал подходящую конструкцию для задачи клиента (пирог/фрезерование/нарезка — по ситуации)' },
  { id: 'tech-materials', label: 'Технология — материалы: назвал конкретные характеристики (тип/марка смеси, фракции, ГОСТ, эмульсия — что релевантно)' },
  { id: 'tech-process', label: 'Технология — процесс: описал этапы работ с экспертными деталями (температура, уплотнение, оборудование)' },

  // Результат для клиента
  { id: 'result', label: 'Результат: описал что клиент получит в итоге (ровное покрытие, срок службы, внешний вид, решение проблемы)' },

  // Процесс и закрытие
  { id: 'process', label: 'Процесс: заявка → бесплатный замер → смета → договор → работа → гарантия' },
  { id: 'measurement', label: 'Призыв: предложил бесплатный выезд замерщика/бригадира' },
  { id: 'objection', label: 'Возражения: отработал если были' },
  { id: 'closing', label: 'Закрытие: назначил конкретную дату (замер / перезвон / отправка КП)' }
];

// Рандомные сценарии — каждый звонок уникальный
const SCENARIOS = [
  { role: 'завхоз ТСЖ', area: '150 м²', task: 'ямочный ремонт двора', details: 'Ямы по всему двору, жители жалуются. Бюджет ограничен.' },
  { role: 'главный инженер завода', area: '3000 м²', task: 'асфальтирование промплощадки', details: 'Ездят фуры и погрузчики, нужно прочное покрытие. Старый асфальт 15 лет.' },
  { role: 'управляющий бизнес-центра', area: '800 м²', task: 'ремонт парковки', details: 'Парковка на 50 машин, трещины, лужи. Нужно с ливнёвкой.' },
  { role: 'директор автосервиса', area: '200 м²', task: 'площадка перед автосервисом', details: 'Сейчас щебень, нужен асфальт. Клиенты жалуются на грязь.' },
  { role: 'прораб строительной компании', area: '5000 м²', task: 'дороги в коттеджном посёлке', details: 'Новый посёлок, 30 домов, нужны подъездные дороги с нуля по грунту.' },
  { role: 'завхоз школы', area: '400 м²', task: 'ремонт школьного двора', details: 'Бюджетная организация, нужен НДС и полный пакет документов. Покрытие разбитое.' },
  { role: 'директор склада', area: '2000 м²', task: 'площадка для разгрузки фур', details: 'Тяжёлый грузовой транспорт, нужен усиленный пирог. Сейчас бетонные плиты, разбились.' },
  { role: 'председатель гаражного кооператива', area: '10 м² × 20 ям', task: 'ямочный ремонт проездов', details: 'Узкие проезды между гаражами, много ям. Бюджет собираем с членов.' },
  { role: 'менеджер торгового центра', area: '1500 м²', task: 'благоустройство территории', details: 'Нужен асфальт + бордюры + тротуарная плитка + разметка парковки.' },
  { role: 'инженер муниципалитета', area: '4000 м²', task: 'ремонт дороги в посёлке', details: 'Госзаказ, нужна исполнительная документация, сметы по ФЕР, акты.' }
];

function _getRandomScenario() {
  return SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
}

function _prompt(diff) {
  const c = {
    friendly: 'Ты дружелюбный клиент. Отвечаешь спокойно, слушаешь.',
    hesitant: 'Ты сомневающийся клиент. Иногда говоришь "надо подумать", "а гарантии какие?".',
    tough: 'Ты сложный клиент. Говоришь "дорого", "есть подрядчик", "не интересно". Скептичен.'
  };

  // Сценарий фиксируется при старте звонка, не меняется
  if (!currentScenario) currentScenario = _getRandomScenario();
  const sc = currentScenario;

  return `Ты играешь роль клиента, который САМ ПОЗВОНИЛ в компанию Транском (входящий звонок).
Ты нашёл их в интернете или тебе порекомендовали.
Менеджер уже взял трубку и представился. Теперь ТЫ рассказываешь зачем звонишь.
В ПЕРВОЙ реплике коротко скажи что тебе нужно: «Добрый день, мне нужно ${sc.task}. ${sc.details.split('.')[0]}.»

ТВОЯ РОЛЬ: ${sc.role}.
ОБЪЕКТ: ${sc.area}, задача — ${sc.task}.
СИТУАЦИЯ: ${sc.details}

Характер: ${c[diff]}

КАК ВЕСТИ СЕБЯ — ты живой человек, а не робот:
- Говори 1-3 предложения, как реальный человек по телефону
- Реагируй на КОНКРЕТИКУ: если менеджер назвал цифру/факт — переспроси или прокомментируй («5 бригад? Это прилично», «С 2014? Ну неплохо»)
- Если менеджер рассказал технологию с деталями — прояви интерес: «А щебень какой фракции кладёте?», «А толщина покрытия какая будет?»
- Если менеджер льёт воду без конкретики — перебей: «Подождите, а конкретно что вы предлагаете?», «Это всё красиво, а цена какая?»
- Задавай ЕСТЕСТВЕННЫЕ вопросы клиента: «А сколько это стоит?», «А гарантия есть?», «А сроки какие?», «А если дождь пойдёт?»
- Когда менеджер спросит про объект — расскажи свою ситуацию: ${sc.area}, ${sc.task}. ${sc.details}
- Если не спросил — сам не рассказывай, жди
- НЕ подсказывай что говорить дальше, НЕ говори «расскажите про компанию» или «а какая технология»
- Веди себя как занятой человек — у тебя мало времени, говори по делу

ТОЛЬКО русский. НЕ выходи из роли.`;
}

// ==================== UI ====================

export function initVoiceTrainer() {
  const wrap = document.getElementById('trainer-voice-wrap');
  if (!wrap) return;

  // Проверка поддержки
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    wrap.innerHTML = '<div class="vt-error">Нужен Google Chrome для распознавания речи.</div>';
    return;
  }

  const apiKey = localStorage.getItem(POLZA_KEY_STORAGE) || '';

  wrap.innerHTML = `
    <div class="vt-setup" id="vt-setup">
      <div class="vt-info-banner">
        Входящий звонок — клиент звонит вам. Берите трубку, представляйтесь и ведите по скрипту.
      </div>
      <div class="vt-key-row">
        <label>Ключ Polza.ai:</label>
        <input type="password" class="vt-key-input" id="vt-api-key" value="${apiKey}" placeholder="pol-...">
        <button class="vt-key-save" onclick="saveVoiceKey()">Сохранить</button>
      </div>
      <div class="vt-key-hint"><a href="https://polza.ai/" target="_blank">Получить ключ</a></div>
      <div class="vt-config-grid">
        <div class="vt-config-item">
          <label>Сложность:</label>
          <div class="vt-diff-btns">
            ${DIFFICULTY.map(d => `<button class="vt-diff-btn ${d.id === currentDifficulty ? 'active' : ''}" onclick="setVoiceDifficulty('${d.id}')">${d.emoji} ${d.name}</button>`).join('')}
          </div>
        </div>
        <div class="vt-config-item">
          <label>Голос:</label>
          <select class="vt-voice-select" id="vt-voice-select" onchange="currentVoice=this.value">
            ${VOICES.map(v => `<option value="${v}" ${v === currentVoice ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="vt-call-btn" onclick="startVoiceCall()">📞 Начать звонок</button>
    </div>

    <div class="vt-call-screen" id="vt-call-screen" style="display:none">
      <div class="vt-call-header">
        <div class="vt-call-status" id="vt-status">Подключение...</div>
        <div class="vt-call-timer" id="vt-timer">00:00</div>
      </div>
      <div class="vt-visualizer">
        <div class="vt-avatar">
          <div class="vt-avatar-icon">👤</div>
          <div class="vt-avatar-pulse" id="vt-pulse"></div>
        </div>
        <div class="vt-avatar-name">Клиент</div>
      </div>
      <div class="vt-state-indicator" id="vt-state">
        <div class="vt-state-icon" id="vt-state-icon">⏳</div>
        <div class="vt-state-text" id="vt-state-text">Подключение...</div>
      </div>
      <div class="vt-live-text" id="vt-live-text"></div>
      <div class="vt-call-actions">
        <button class="vt-hangup-btn" onclick="endVoiceCall()">📵 Завершить звонок</button>
      </div>
      <div id="vt-log" style="display:none"></div>
    </div>

    <div class="vt-result" id="vt-result" style="display:none"></div>
  `;
}

// ==================== СОСТОЯНИЯ ====================

function _setState(newState, detail) {
  state = newState;
  const icon = document.getElementById('vt-state-icon');
  const text = document.getElementById('vt-state-text');
  const status = document.getElementById('vt-status');
  if (!icon || !text) return;

  switch (newState) {
    case STATE.LISTENING:
      icon.textContent = '🎙️';
      text.textContent = 'Слушаю вас...';
      status.textContent = '🟢 На связи';
      icon.parentElement.className = 'vt-state-indicator vt-st-listening';
      break;
    case STATE.THINKING:
      icon.textContent = '💭';
      text.textContent = 'Клиент думает...';
      status.textContent = '⏳ Обработка';
      icon.parentElement.className = 'vt-state-indicator vt-st-thinking';
      break;
    case STATE.SPEAKING:
      icon.textContent = '🔊';
      text.textContent = detail || 'Клиент говорит...';
      status.textContent = '🔊 Клиент говорит';
      icon.parentElement.className = 'vt-state-indicator vt-st-speaking';
      break;
    default:
      icon.textContent = '⏹';
      text.textContent = detail || '';
      status.textContent = 'Отключено';
      icon.parentElement.className = 'vt-state-indicator';
  }
}

// ==================== РАСПОЗНАВАНИЕ ====================

let _activeRec = null;
let _sendTimer = null;
let _accumulated = '';

function _startListening() {
  if (!isCallActive) return;

  state = STATE.IDLE;
  _accumulated = '';
  clearTimeout(_sendTimer);
  console.log('[STT] Запуск...');

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SpeechRecognition();
  rec.lang = 'ru-RU';
  rec.continuous = true;       // Не останавливается — слушает пока мы не остановим
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  _activeRec = rec;

  rec.onstart = () => {
    console.log('[STT] Слушаю...');
    _setState(STATE.LISTENING);
    document.getElementById('vt-live-text').textContent = '';
  };

  rec.onresult = (event) => {
    let interim = '';
    let allFinal = '';

    for (let i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        allFinal += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }

    // Показать текст в реальном времени
    const display = allFinal + (interim ? ' ' + interim : '');
    const live = document.getElementById('vt-live-text');
    if (live) live.textContent = display;

    if (allFinal) _accumulated = allFinal;

    // ВСЕГДА сбрасывать таймер — и на interim, и на final
    // Пока есть любая речь — не отправлять
    clearTimeout(_sendTimer);

    // Отправить только когда есть финальный текст И пауза 1.5 сек
    // Если есть interim — значит человек ещё говорит, не запускать таймер
    if (_accumulated.trim() && !interim) {
      _sendTimer = setTimeout(() => {
        const text = _accumulated.trim();
        if (text && isCallActive && state === STATE.LISTENING) {
          console.log('[STT] Пауза, отправляю:', text);
          _stopListening();
          _processUserSpeech(text);
        }
      }, 1500);
    }
  };

  rec.onend = () => {
    console.log('[STT] onend');
    // Авто-рестарт если мы не остановили специально
    if (isCallActive && state === STATE.LISTENING) {
      console.log('[STT] Авто-рестарт...');
      setTimeout(() => {
        if (isCallActive && state === STATE.LISTENING) {
          try { rec.start(); } catch {}
        }
      }, 200);
    }
  };

  rec.onerror = (e) => {
    console.log('[STT] error:', e.error);
    if (e.error === 'no-speech' && isCallActive && state === STATE.LISTENING) {
      setTimeout(() => {
        if (isCallActive && state === STATE.LISTENING) {
          try { rec.start(); } catch {}
        }
      }, 300);
    }
  };

  try {
    rec.start();
  } catch (err) {
    console.error('[STT] start error:', err);
    setTimeout(() => _startListening(), 1000);
  }
}

function _stopListening() {
  clearTimeout(_sendTimer);
  _accumulated = '';
  if (_activeRec) {
    try { _activeRec.stop(); } catch {}
    _activeRec = null;
  }
  document.getElementById('vt-live-text').textContent = '';
}

// ==================== ПАЙПЛАЙН ====================

async function _processUserSpeech(text) {
  if (!isCallActive) return;

  _stopListening();
  _setState(STATE.THINKING);
  _addLog('manager', text);
  chatHistory.push({ role: 'user', content: text });

  const apiKey = localStorage.getItem(POLZA_KEY_STORAGE);

  // 1. Получить ответ AI
  let aiText;
  try {
    const resp = await fetch(`${POLZA_API}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        max_tokens: 150,
        messages: [
          { role: 'system', content: _prompt(currentDifficulty) },
          ...chatHistory
        ]
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${resp.status}`);
    }
    const data = await resp.json();
    aiText = data.choices?.[0]?.message?.content?.trim();
    if (!aiText) throw new Error('Пустой ответ');
  } catch (err) {
    _addLog('system', 'Ошибка: ' + err.message);
    _setState(STATE.IDLE, 'Ошибка AI');
    if (isCallActive) setTimeout(() => _startListening(), 1000);
    return;
  }

  chatHistory.push({ role: 'assistant', content: aiText });
  _addLog('client', aiText);

  // 2. Озвучить ответ
  _setState(STATE.SPEAKING, aiText.slice(0, 50) + (aiText.length > 50 ? '...' : ''));
  document.getElementById('vt-pulse')?.classList.add('speaking');

  try {
    await _speakTTS(aiText, apiKey);
  } catch (err) {
    console.error('[Voice] TTS error:', err);
  }

  // 3. Сразу слушаем
  document.getElementById('vt-pulse')?.classList.remove('speaking');
  if (isCallActive) _startListening();
}

// Вызвать TTS через Polza.ai и проиграть результат
// Идентичная логика из test-voice.html шаг 4 (который работает)
async function _speakTTS(text, apiKey) {
  console.log('[TTS] Запрос:', text, 'voice:', currentVoice);

  const resp = await fetch(`${POLZA_API}/audio/speech`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: TTS_MODEL, input: text, voice: currentVoice, response_format: 'mp3', language_code: 'ru' })
  });

  console.log('[TTS] HTTP', resp.status, 'content-type:', resp.headers.get('content-type'));
  if (!resp.ok) throw new Error('TTS HTTP ' + resp.status);

  // Polza.ai возвращает JSON с base64 аудио в поле "audio"
  const json = await resp.json();
  console.log('[TTS] JSON keys:', Object.keys(json));

  if (!json.audio) {
    console.error('[TTS] Нет поля audio в ответе:', JSON.stringify(json).slice(0, 200));
    throw new Error('Нет аудио в ответе');
  }

  // Декодировать base64 → blob → Audio
  const binary = atob(json.audio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/mp3' });
  const audioUrl = URL.createObjectURL(blob);

  console.log('[TTS] Blob:', blob.size, 'bytes, playing...');

  return new Promise((resolve) => {
    currentAudio = new Audio(audioUrl);
    currentAudio.onended = () => {
      console.log('[TTS] Finished playing');
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      resolve();
    };
    currentAudio.onerror = (e) => {
      console.error('[TTS] Play error:', e);
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      resolve();
    };
    currentAudio.play().catch((err) => {
      console.error('[TTS] play() rejected:', err);
      resolve();
    });
  });
}

// ==================== ЗВОНОК ====================

export function startVoiceCall() {
  if (!localStorage.getItem(POLZA_KEY_STORAGE)) { alert('Введите API-ключ Polza.ai'); return; }

  document.getElementById('vt-setup').style.display = 'none';
  document.getElementById('vt-call-screen').style.display = '';
  document.getElementById('vt-result').style.display = 'none';
  document.getElementById('vt-log').innerHTML = '';
  document.getElementById('vt-live-text').textContent = '';

  chatHistory = [];
  callDuration = 0;
  isCallActive = true;
  state = STATE.IDLE;
  currentScenario = _getRandomScenario(); // новый сценарий для каждого звонка
  _updateTimer();
  callTimer = setInterval(() => { callDuration++; _updateTimer(); }, 1000);

  // Приветствие клиента
  _greet();
}

async function _greet() {
  // Входящий звонок — менеджер берёт трубку и представляется первым
  // Сразу включаем микрофон, клиент молчит и ждёт
  _setState(STATE.LISTENING);
  if (isCallActive) _startListening();
}

export async function endVoiceCall() {
  isCallActive = false;
  state = STATE.IDLE;
  _stopListening();
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  if (callTimer) { clearInterval(callTimer); callTimer = null; }

  const mc = chatHistory.filter(m => m.role === 'user').length;
  let xp = 0;
  if (callDuration >= 30 && mc >= 2) { xp = 20; addXP(20, 'Голосовой тренажёр'); }

  document.getElementById('vt-call-screen').style.display = 'none';
  const r = document.getElementById('vt-result');
  r.style.display = '';

  // Сначала показать базовый результат + "Анализирую..."
  const min = Math.floor(callDuration / 60);
  const sec = callDuration % 60;
  r.innerHTML = `
    <div class="vt-result-card">
      <div class="vt-result-icon">📞</div>
      <div class="vt-result-title">Звонок завершён</div>
      <div class="vt-result-duration">${min} мин ${sec} сек</div>
      <div class="vt-result-stats">
        <div class="vt-result-stat"><span>${chatHistory.length}</span>реплик</div>
        <div class="vt-result-stat"><span>${mc}</span>ваших</div>
        ${xp ? `<div class="vt-result-stat"><span>+${xp}</span>XP</div>` : ''}
      </div>
      <div class="vt-report" id="vt-report">
        <div class="vt-report-loading">⏳ Анализирую разговор по скрипту продаж...</div>
      </div>
      <div class="vt-result-actions">
        <button class="vt-call-btn" onclick="startVoiceCall()">📞 Ещё звонок</button>
        <button class="vt-back-btn" onclick="backToVoiceSetup()">← Назад</button>
      </div>
    </div>`;

  // AI-анализ разговора
  await _generateReport(min, sec, mc);
}

// ==================== ОТЧЁТ ====================

async function _generateReport(min, sec, managerReplies) {
  const reportEl = document.getElementById('vt-report');
  if (!reportEl || chatHistory.length < 2) {
    if (reportEl) reportEl.innerHTML = '<div class="vt-report-empty">Слишком короткий разговор для анализа.</div>';
    return;
  }

  const apiKey = localStorage.getItem(POLZA_KEY_STORAGE);
  const transcript = chatHistory.map(m =>
    (m.role === 'user' ? 'МЕНЕДЖЕР' : 'КЛИЕНТ') + ': ' + m.content
  ).join('\n');

  const checklistText = SCRIPT_CHECKLIST.map((c, i) => `${i + 1}. ${c.label}`).join('\n');

  try {
    const resp = await fetch(`${POLZA_API}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EVAL_MODEL,
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Проанализируй диалог менеджера по продажам компании Транском (асфальтирование и благоустройство).

ДИАЛОГ:
${transcript}

ЧЕК-ЛИСТ СКРИПТА (что менеджер ДОЛЖЕН был сделать):
${checklistText}

ВАЖНЕЙШЕЕ ПРАВИЛО — ТЕХНОЛОГИЯ ДОЛЖНА СООТВЕТСТВОВАТЬ ЗАПРОСУ КЛИЕНТА:
- Если клиент хочет ЯМОЧНЫЙ РЕМОНТ — технология: нарезка контура, демонтаж, проливка битумной эмульсией, укладка, уплотнение виброплитой. НЕ нужен полный пирог и расклинцовка.
- Если клиент хочет ЗАМЕНУ АСФАЛЬТА (старый есть) — технология: фрезерование старого покрытия, подгрунтовка эмульсией, укладка в 1-2 слоя. Расклинцовка НЕ нужна если основание целое.
- Если клиент хочет ДОРОГУ С НУЛЯ по грунту — тогда ДА: полный пирог, песок, щебень с расклинцовкой, асфальт в 2 слоя.
- Если БЛАГОУСТРОЙСТВО (плитка, бордюры) — соответствующая технология.

Менеджер должен рассказать технологию РЕЛЕВАНТНУЮ запросу клиента. Если рассказал про расклинцовку когда клиенту нужен ямочный ремонт — это ОШИБКА (не засчитывать, отметить в советах).

ПРАВИЛА ОЦЕНКИ — будь ВНИМАТЕЛЬНЫМ к каждому слову менеджера:
- Если менеджер сказал «5 бригад» или «пять бригад» → пункт про команду = true
- Если сказал «геодезист» или «проектировщик» → пункт про команду = true
- Если сказал «с 2014» или «более 10 лет» или «больше 10 лет» → пункт про возраст = true
- Если сказал «НДС» или «закрывающие документы» или «акты» → пункт про документы = true
- Если сказал «проверенные поставщики» или «паспорта качества» → пункт про качество = true
- Если назвал конкретный объект (Западная Долина, Московские, Микояновский и т.д.) → портфолио = true
- Если использовал технические термины (фракция, расклинцовка, ГОСТ, тип Б, эмульсия, виброплита) → пункты технологии = true
- Общие слова БЕЗ конкретики («мы хорошо делаем», «качественно») — НЕ засчитывать

Внимательно прочитай КАЖДУЮ реплику менеджера. Не пропускай упомянутые факты.

Оцени каждый пункт: true/false. Общая оценка 1-10. Конкретные советы (2-3 пункта).

ОТВЕТЬ СТРОГО В JSON (${SCRIPT_CHECKLIST.length} пунктов в items):
{"items":[${SCRIPT_CHECKLIST.map(() => 'false').join(',')}],"score":5,"advice":"Совет 1. Совет 2. Совет 3."}`
        }]
      })
    });

    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const evalData = JSON.parse(jsonMatch[0]);
      _renderReport(reportEl, evalData, transcript, min, sec, managerReplies);
    } else {
      throw new Error('Не удалось разобрать ответ');
    }
  } catch (err) {
    console.error('[Report] error:', err);
    // Фоллбэк — показать транскрипт без оценки
    reportEl.innerHTML = `
      <div class="vt-report-title">Транскрипт разговора</div>
      <div class="vt-report-transcript">${transcript.replace(/\n/g, '<br>')}</div>
      <div class="vt-report-actions">
        <button class="vt-btn-report" onclick="downloadVoiceReport()">📥 Скачать отчёт</button>
        <button class="vt-btn-report" onclick="copyVoiceReport()">📋 Копировать</button>
      </div>`;
  }
}

function _renderReport(el, evalData, transcript, min, sec, managerReplies) {
  const doneCount = (evalData.items || []).filter(Boolean).length;
  const total = SCRIPT_CHECKLIST.length;
  const scoreColor = evalData.score >= 7 ? '#2e7d32' : evalData.score >= 4 ? '#e65100' : '#c62828';

  const checklistHTML = SCRIPT_CHECKLIST.map((c, i) => {
    const done = evalData.items?.[i];
    return `<div class="vt-rp-item ${done ? 'vt-rp-yes' : 'vt-rp-no'}">
      <span>${done ? '✅' : '❌'}</span> ${c.label}
    </div>`;
  }).join('');

  // Сохранить данные для скачивания
  window._lastVoiceReport = {
    date: new Date().toLocaleString('ru-RU'),
    duration: `${min} мин ${sec} сек`,
    replies: managerReplies,
    score: evalData.score,
    checklist: SCRIPT_CHECKLIST.map((c, i) => ({ ...c, done: !!evalData.items?.[i] })),
    advice: evalData.advice,
    transcript
  };

  el.innerHTML = `
    <div class="vt-report-title">📊 Оценка по скрипту продаж</div>
    <div class="vt-report-score" style="color:${scoreColor}">
      <span class="vt-report-score-num">${evalData.score}/10</span>
      <span class="vt-report-score-label">${doneCount}/${total} пунктов скрипта</span>
    </div>
    <div class="vt-report-checklist">${checklistHTML}</div>
    ${evalData.advice ? `<div class="vt-report-advice"><strong>Рекомендации:</strong><br>${evalData.advice}</div>` : ''}
    <details class="vt-report-details">
      <summary>Транскрипт разговора</summary>
      <div class="vt-report-transcript">${transcript.replace(/\n/g, '<br>')}</div>
    </details>
    <div class="vt-report-actions">
      <button class="vt-btn-report" onclick="reanalyzeVoiceReport()">🔄 Переанализировать</button>
      <button class="vt-btn-report" onclick="downloadVoiceReport()">📥 Скачать отчёт</button>
      <button class="vt-btn-report" onclick="copyVoiceReport()">📋 Копировать</button>
    </div>`;
}

// Скачать отчёт как HTML-файл (наглядный)
export function downloadVoiceReport() {
  const r = window._lastVoiceReport;
  if (!r) return;

  const doneCount = r.checklist.filter(c => c.done).length;
  const total = r.checklist.length;
  const pct = Math.round(doneCount / total * 100);
  const scoreColor = r.score >= 7 ? '#2e7d32' : r.score >= 4 ? '#e65100' : '#c62828';
  const barColor = r.score >= 7 ? '#4caf50' : r.score >= 4 ? '#ff9800' : '#f44336';

  const checklistHTML = r.checklist.map(c => `
    <tr>
      <td style="width:40px;text-align:center;font-size:20px">${c.done ? '✅' : '❌'}</td>
      <td style="padding:8px;${c.done ? '' : 'color:#c62828;font-weight:600'}">${c.label}</td>
    </tr>`).join('');

  // Разбить транскрипт по ролям
  const transcriptHTML = r.transcript.split('\n').map(line => {
    if (line.startsWith('МЕНЕДЖЕР:')) {
      return `<div style="background:#e3f2fd;padding:8px 12px;border-radius:8px;margin:4px 0;margin-left:40px"><b style="color:#1565c0">Менеджер:</b> ${line.replace('МЕНЕДЖЕР: ', '')}</div>`;
    } else if (line.startsWith('КЛИЕНТ:')) {
      return `<div style="background:#f5f5f5;padding:8px 12px;border-radius:8px;margin:4px 0;margin-right:40px"><b style="color:#e65100">Клиент:</b> ${line.replace('КЛИЕНТ: ', '')}</div>`;
    }
    return '';
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Отчёт тренажёра — Транском</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#1a1a1a;background:#fff}
  .header{text-align:center;padding:20px 0;border-bottom:3px solid #1a1a1a}
  .header h1{font-size:22px;margin:0}
  .header .sub{color:#888;font-size:13px;margin-top:4px}
  .meta{display:flex;justify-content:space-around;padding:16px 0;border-bottom:1px solid #eee}
  .meta-item{text-align:center}
  .meta-val{font-size:24px;font-weight:800}
  .meta-label{font-size:11px;color:#888}
  .score-block{text-align:center;padding:20px 0}
  .score-num{font-size:56px;font-weight:900;color:${scoreColor}}
  .score-label{font-size:14px;color:#666}
  .bar-wrap{height:12px;background:#eee;border-radius:6px;margin:10px 0;overflow:hidden}
  .bar-fill{height:100%;background:${barColor};border-radius:6px;width:${pct}%}
  .section{margin:20px 0}
  .section h2{font-size:16px;border-bottom:2px solid #eee;padding-bottom:6px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse}
  tr{border-bottom:1px solid #f0f0f0}
  .advice{background:#fff3e0;border-radius:10px;padding:14px;font-size:14px;line-height:1.6}
  .transcript{margin-top:12px}
  .footer{text-align:center;color:#bbb;font-size:11px;margin-top:30px;padding-top:10px;border-top:1px solid #eee}
  @media print{body{padding:0}.bar-fill{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>

<div class="header">
  <h1>ТРАНСКОМ — Отчёт тренажёра продаж</h1>
  <div class="sub">${r.date}</div>
</div>

<div class="meta">
  <div class="meta-item"><div class="meta-val">${r.duration}</div><div class="meta-label">Длительность</div></div>
  <div class="meta-item"><div class="meta-val">${r.replies}</div><div class="meta-label">Реплик менеджера</div></div>
  <div class="meta-item"><div class="meta-val">${doneCount}/${total}</div><div class="meta-label">Пунктов скрипта</div></div>
</div>

<div class="score-block">
  <div class="score-num">${r.score}/10</div>
  <div class="score-label">Общая оценка</div>
  <div class="bar-wrap"><div class="bar-fill"></div></div>
</div>

<div class="section">
  <h2>📋 Соблюдение скрипта продаж</h2>
  <table>${checklistHTML}</table>
</div>

${r.advice ? `<div class="section"><h2>💡 Рекомендации</h2><div class="advice">${r.advice}</div></div>` : ''}

<div class="section">
  <h2>💬 Транскрипт разговора</h2>
  <div class="transcript">${transcriptHTML}</div>
</div>

<div class="footer">Сгенерировано тренажёром ТРАНСКОМ • ${r.date}</div>

</body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transkom-otchet-${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Копировать отчёт в буфер
export function copyVoiceReport() {
  const r = window._lastVoiceReport;
  if (!r) return;

  let text = `ТРАНСКОМ — Отчёт тренажёра (${r.date})\n`;
  text += `Длительность: ${r.duration} | Оценка: ${r.score}/10\n\n`;
  r.checklist.forEach(c => { text += `${c.done ? '✓' : '✗'} ${c.label}\n`; });
  if (r.advice) text += `\nРекомендации: ${r.advice}\n`;
  text += '\nТранскрипт:\n' + r.transcript;

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.vt-btn-report:last-child');
    if (btn) { btn.textContent = '✓ Скопировано'; setTimeout(() => btn.textContent = '📋 Копировать', 1500); }
  });
}

// Переанализировать последний разговор
export async function reanalyzeVoiceReport() {
  const r = window._lastVoiceReport;
  if (!r) { alert('Нет данных для анализа'); return; }

  const reportEl = document.getElementById('vt-report');
  if (!reportEl) return;
  reportEl.innerHTML = '<div class="vt-report-loading">🔄 Переанализирую новой моделью...</div>';

  // Восстановить chatHistory из транскрипта
  const oldHistory = r.transcript.split('\n').map(line => {
    if (line.startsWith('МЕНЕДЖЕР: ')) return { role: 'user', content: line.replace('МЕНЕДЖЕР: ', '') };
    if (line.startsWith('КЛИЕНТ: ')) return { role: 'assistant', content: line.replace('КЛИЕНТ: ', '') };
    return null;
  }).filter(Boolean);

  chatHistory = oldHistory;
  const min = parseInt(r.duration) || 0;
  const sec = 0;
  const mc = oldHistory.filter(m => m.role === 'user').length;

  await _generateReport(min, sec, mc);
}

export function backToVoiceSetup() {
  document.getElementById('vt-result').style.display = 'none';
  document.getElementById('vt-setup').style.display = '';
}

// ==================== HELPERS ====================

function _addLog(role, text) {
  const list = document.getElementById('vt-log');
  if (!list) return;
  const labels = { manager: 'Вы', client: 'Клиент', system: 'Система' };
  const el = document.createElement('div');
  el.className = `vt-tr-entry vt-tr-${role}`;
  el.innerHTML = `<span class="vt-tr-role">${labels[role]}:</span> <span class="vt-tr-text">${text}</span>`;
  list.appendChild(el);
  list.scrollTop = list.scrollHeight;
}

function _updateTimer() {
  const el = document.getElementById('vt-timer');
  if (el) el.textContent = `${String(Math.floor(callDuration/60)).padStart(2,'0')}:${String(callDuration%60).padStart(2,'0')}`;
}

export function saveVoiceKey() {
  const inp = document.getElementById('vt-api-key');
  if (!inp) return;
  localStorage.setItem(POLZA_KEY_STORAGE, inp.value.trim());
  const btn = document.querySelector('.vt-key-save');
  if (btn) { btn.textContent = '✓'; setTimeout(() => btn.textContent = 'Сохранить', 1500); }
}

export function setVoiceDifficulty(level) {
  currentDifficulty = level;
  document.querySelectorAll('.vt-diff-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.vt-diff-btn[onclick*="${level}"]`)?.classList.add('active');
}

window.initVoiceTrainer = initVoiceTrainer;
window.saveVoiceKey = saveVoiceKey;
window.setVoiceDifficulty = setVoiceDifficulty;
window.startVoiceCall = startVoiceCall;
window.endVoiceCall = endVoiceCall;
window.backToVoiceSetup = backToVoiceSetup;
window.downloadVoiceReport = downloadVoiceReport;
window.copyVoiceReport = copyVoiceReport;
window.reanalyzeVoiceReport = reanalyzeVoiceReport;
