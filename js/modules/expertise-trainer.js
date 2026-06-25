// Голосовой экзамен на экспертность.
// AI-клиент задаёт технические вопросы голосом, менеджер отвечает голосом,
// AI сверяет ответ с эталоном (keyPoints + reference из учебных статей) и выставляет оценку.
//
// Инфраструктура — как в голосовом тренажёре (voice-trainer.js), чтобы не плодить ключи:
//   STT  — Web Speech API браузера (нужен Chrome)
//   AI   — Polza.ai (OpenAI-совместимый), модель Gemini — оценка ответа
//   TTS  — Polza.ai (+ запасной браузерный голос)
//   Ключ — тот же, что у голосового тренажёра: transkom_polza_api_key
//
// Два режима: тренировка по теме / полный экзамен (случайные вопросы из всех тем).
// Прогресс мастерства по темам: localStorage transkom_expertise_progress.

import { addXP } from './gamification.js';
import { EXPERTISE_TOPICS } from '../data/expertise-questions.js';

const POLZA_KEY_STORAGE = 'transkom_polza_api_key';
const PROGRESS_STORAGE = 'transkom_expertise_progress';
const POLZA_API = 'https://api.polza.ai/api/v1';
const EVAL_MODEL = 'google/gemini-2.5-flash';
const TTS_MODEL = 'openai/tts-1';                       // запасная модель TTS
const TTS_MODEL_EXPRESSIVE = 'openai/gpt-4o-mini-tts';  // выразительная: принимает инструкцию тона
let _ttsModel = TTS_MODEL_EXPRESSIVE;                   // авто-откат на tts-1, если недоступна
const EXAM_SIZE = 15;   // вопросов в полном экзамене
const PASS_PCT = 70;    // порог зачёта

const VOICES = [
  { id: 'onyx', name: 'Onyx (мужской, низкий)' },
  { id: 'echo', name: 'Echo (мужской)' },
  { id: 'fable', name: 'Fable (мужской, мягкий)' },
  { id: 'alloy', name: 'Alloy (нейтральный)' },
  { id: 'nova', name: 'Nova (женский)' },
  { id: 'shimmer', name: 'Shimmer (женский, мягкий)' }
];

// ==================== СОСТОЯНИЕ ====================
const STATE = { IDLE: 0, ASKING: 1, LISTENING: 2, THINKING: 3, FEEDBACK: 4 };
let state = STATE.IDLE;
let currentVoice = 'onyx';
let mode = 'topic';        // 'topic' | 'exam'
let queue = [];            // вопросы текущего прохождения (с полями topicId/topicName/icon)
let qIndex = 0;
let results = [];          // [{ q, topicId, topicName, score, verdict, comment }]
let currentAudio = null;
let isActive = false;
let sttSupported = ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);

// ==================== ПРОГРЕСС ====================
function _getProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_STORAGE)) || {}; }
  catch { return {}; }
}
function _saveTopicMastery(topicId, pct) {
  const d = _getProgress();
  const prev = d[topicId]?.best || 0;
  d[topicId] = { best: Math.max(prev, pct), last: pct, date: new Date().toISOString().slice(0, 10) };
  localStorage.setItem(PROGRESS_STORAGE, JSON.stringify(d));
}

// ==================== ВЫБОР ВОПРОСОВ ====================
function _shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function _withTopic(t) {
  return t.questions.map(q => ({ ...q, topicId: t.id, topicName: t.name, icon: t.icon }));
}
function _allQuestions() {
  const out = [];
  EXPERTISE_TOPICS.forEach(t => out.push(..._withTopic(t)));
  return out;
}

// ==================== UI: НАСТРОЙКА ====================
export function initExpertiseTrainer() {
  const wrap = document.getElementById('trainer-expertise-wrap');
  if (!wrap) return;

  const apiKey = localStorage.getItem(POLZA_KEY_STORAGE) || '';
  const prog = _getProgress();

  const topicCards = EXPERTISE_TOPICS.map(t => {
    const m = prog[t.id];
    const best = m?.best || 0;
    const badge = best > 0
      ? `<span class="et-topic-mastery ${best >= PASS_PCT ? 'et-tm-pass' : ''}">${best}%</span>`
      : '<span class="et-topic-mastery et-tm-new">новая</span>';
    return `<div class="et-topic-card" onclick="startExpertiseTopic('${t.id}')">
      <div class="et-topic-icon">${t.icon}</div>
      <div class="et-topic-body">
        <div class="et-topic-name">${t.name}</div>
        <div class="et-topic-meta">${t.questions.length} вопрос(ов) ${badge}</div>
      </div>
    </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="et-setup" id="et-setup">
      <div class="et-info-banner">
        🎓 Экзамен на экспертность: клиент <b>голосом</b> задаёт технические вопросы — про основания, фракции, щебень, уклоны и т.д. Отвечайте голосом, как реальному клиенту. AI проверит ответ и покажет эталон.
        ${sttSupported ? '' : '<br><b>⚠️ Голосовой ввод недоступен в этом браузере (нужен Chrome).</b> Можно отвечать текстом.'}
      </div>

      <div class="et-key-row">
        <label>Ключ Polza.ai:</label>
        <input type="password" class="et-key-input" id="et-api-key" value="${apiKey}" placeholder="pol-...">
        <button class="et-key-save" onclick="saveExpertiseKey()">Сохранить</button>
      </div>
      <div class="et-key-hint">Тот же ключ, что у голосового тренажёра. <a href="https://polza.ai/" target="_blank">Получить ключ</a></div>

      <div class="et-config-item">
        <label>Голос клиента:</label>
        <select class="et-voice-select" id="et-voice-select" onchange="setExpertiseVoice(this.value)">
          ${VOICES.map(v => `<option value="${v.id}" ${v.id === currentVoice ? 'selected' : ''}>${v.name}</option>`).join('')}
        </select>
      </div>

      <div class="et-mode-row">
        <button class="et-mode-btn ${mode === 'topic' ? 'active' : ''}" id="et-mode-topic" onclick="setExpertiseMode('topic')">📚 Тренировка по теме</button>
        <button class="et-mode-btn ${mode === 'exam' ? 'active' : ''}" id="et-mode-exam" onclick="setExpertiseMode('exam')">🏆 Полный экзамен</button>
      </div>

      <div id="et-topic-block" style="${mode === 'topic' ? '' : 'display:none'}">
        <div class="et-section-label">Выберите тему — погоняем по ней:</div>
        <div class="et-topic-grid">${topicCards}</div>
      </div>

      <div id="et-exam-block" style="${mode === 'exam' ? '' : 'display:none'}">
        <div class="et-section-label">Полный экзамен: ${EXAM_SIZE} случайных вопросов из всех тем. В конце — общая оценка экспертности.</div>
        <button class="et-start-btn" onclick="startExpertiseExam()">🏆 Начать экзамен (${EXAM_SIZE} вопросов)</button>
      </div>
    </div>

    <div class="et-exam-screen" id="et-exam-screen" style="display:none">
      <div class="et-exam-header">
        <button class="et-back-btn" onclick="quitExpertiseExam()">← Выйти</button>
        <div class="et-exam-progress" id="et-exam-progress"></div>
      </div>
      <div class="et-progress-bar"><div class="et-progress-fill" id="et-progress-fill"></div></div>

      <div class="et-topic-tag" id="et-topic-tag"></div>
      <div class="et-question-card">
        <div class="et-q-label">👤 Клиент спрашивает:</div>
        <div class="et-q-text" id="et-q-text"></div>
        <button class="et-replay-btn" onclick="replayExpertiseQuestion()" title="Озвучить ещё раз">🔊 Повторить вопрос</button>
      </div>

      <div class="et-state" id="et-state">
        <span class="et-state-icon" id="et-state-icon">⏳</span>
        <span class="et-state-text" id="et-state-text">Подключение...</span>
      </div>
      <div class="et-live-text" id="et-live-text"></div>

      <div class="et-answer-row" id="et-answer-row">
        <input type="text" class="et-answer-input" id="et-answer-input" placeholder="…или введите ответ текстом и нажмите Enter" onkeydown="if(event.key==='Enter')submitExpertiseText()">
        <button class="et-answer-send" onclick="submitExpertiseText()">Ответить</button>
      </div>

      <div class="et-feedback" id="et-feedback" style="display:none"></div>
    </div>

    <div class="et-result" id="et-result" style="display:none"></div>
  `;
}

// ==================== НАСТРОЙКИ ====================
export function saveExpertiseKey() {
  const inp = document.getElementById('et-api-key');
  if (!inp) return;
  localStorage.setItem(POLZA_KEY_STORAGE, inp.value.trim());
  const btn = document.querySelector('.et-key-save');
  if (btn) { btn.textContent = '✓'; setTimeout(() => btn.textContent = 'Сохранить', 1500); }
}
export function setExpertiseVoice(v) { currentVoice = v; }
export function setExpertiseMode(m) {
  mode = m;
  document.getElementById('et-mode-topic')?.classList.toggle('active', m === 'topic');
  document.getElementById('et-mode-exam')?.classList.toggle('active', m === 'exam');
  const tb = document.getElementById('et-topic-block');
  const eb = document.getElementById('et-exam-block');
  if (tb) tb.style.display = m === 'topic' ? '' : 'none';
  if (eb) eb.style.display = m === 'exam' ? '' : 'none';
}

// ==================== СТАРТ ====================
export function startExpertiseTopic(topicId) {
  const t = EXPERTISE_TOPICS.find(x => x.id === topicId);
  if (!t) return;
  if (!_ensureKey()) return;
  mode = 'topic';
  queue = _shuffle(_withTopic(t));
  _beginRun();
}
export function startExpertiseExam() {
  if (!_ensureKey()) return;
  mode = 'exam';
  queue = _shuffle(_allQuestions()).slice(0, EXAM_SIZE);
  _beginRun();
}
function _ensureKey() {
  if (!localStorage.getItem(POLZA_KEY_STORAGE)) {
    alert('Введите API-ключ Polza.ai (тот же, что в голосовом тренажёре)');
    return false;
  }
  return true;
}
function _beginRun() {
  qIndex = 0;
  results = [];
  isActive = true;
  document.getElementById('et-setup').style.display = 'none';
  document.getElementById('et-result').style.display = 'none';
  document.getElementById('et-exam-screen').style.display = '';
  _askCurrent();
}

// ==================== ВОПРОС ====================
async function _askCurrent() {
  if (!isActive) return;
  const q = queue[qIndex];
  state = STATE.ASKING;

  // прогресс
  const progEl = document.getElementById('et-exam-progress');
  if (progEl) progEl.textContent = `Вопрос ${qIndex + 1} из ${queue.length}`;
  const fill = document.getElementById('et-progress-fill');
  if (fill) fill.style.width = `${(qIndex) / queue.length * 100}%`;

  const tag = document.getElementById('et-topic-tag');
  if (tag) tag.textContent = `${q.icon || '📘'} ${q.topicName}`;
  const qText = document.getElementById('et-q-text');
  if (qText) qText.textContent = q.clientQ;

  // сброс полей
  const fb = document.getElementById('et-feedback');
  if (fb) { fb.style.display = 'none'; fb.innerHTML = ''; }
  const ai = document.getElementById('et-answer-input');
  if (ai) { ai.value = ''; ai.disabled = false; }
  _showAnswerRow(true);
  _setState(STATE.ASKING, 'Клиент задаёт вопрос...');

  // озвучить вопрос, затем слушать
  await _speak(q.clientQ);
  if (!isActive) return;
  if (sttSupported) _listen();
  else _setState(STATE.LISTENING, 'Введите ответ текстом ниже');
}

export function replayExpertiseQuestion() {
  const q = queue[qIndex];
  if (q) _speak(q.clientQ);
}

// ==================== РАСПОЗНАВАНИЕ (один ответ) ====================
let _rec = null, _sendTimer = null, _acc = '';

function _listen() {
  if (!isActive || !sttSupported) return;
  _acc = '';
  clearTimeout(_sendTimer);

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = 'ru-RU';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  _rec = rec;

  rec.onstart = () => { _setState(STATE.LISTENING, 'Слушаю ваш ответ...'); };

  rec.onresult = (event) => {
    let interim = '', allFinal = '';
    for (let i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) allFinal += event.results[i][0].transcript;
      else interim += event.results[i][0].transcript;
    }
    const live = document.getElementById('et-live-text');
    if (live) live.textContent = allFinal + (interim ? ' ' + interim : '');
    if (allFinal) _acc = allFinal;

    clearTimeout(_sendTimer);
    if (_acc.trim() && !interim) {
      _sendTimer = setTimeout(() => {
        const text = _acc.trim();
        if (text && isActive && state === STATE.LISTENING) {
          _stopListen();
          _processAnswer(text);
        }
      }, 1500);
    }
  };

  rec.onend = () => {
    if (isActive && state === STATE.LISTENING) {
      setTimeout(() => { if (isActive && state === STATE.LISTENING) { try { rec.start(); } catch {} } }, 200);
    }
  };
  rec.onerror = (e) => {
    if (e.error === 'no-speech' && isActive && state === STATE.LISTENING) {
      setTimeout(() => { if (isActive && state === STATE.LISTENING) { try { rec.start(); } catch {} } }, 300);
    }
  };

  state = STATE.LISTENING;
  try { rec.start(); } catch { setTimeout(() => _listen(), 800); }
}

function _stopListen() {
  clearTimeout(_sendTimer);
  _acc = '';
  if (_rec) { try { _rec.stop(); } catch {} _rec = null; }
  const live = document.getElementById('et-live-text');
  if (live) live.textContent = '';
}

export function submitExpertiseText() {
  const inp = document.getElementById('et-answer-input');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  _stopListen();
  _processAnswer(text);
}

// ==================== ОБРАБОТКА ОТВЕТА ====================
async function _processAnswer(answer) {
  if (!isActive) return;
  state = STATE.THINKING;
  _showAnswerRow(false);
  _setState(STATE.THINKING, 'AI проверяет ваш ответ...');

  const q = queue[qIndex];
  let evalData;
  try {
    evalData = await _grade(q, answer);
  } catch (err) {
    // Фоллбэк — ручная самооценка
    _renderManualFeedback(q, answer);
    return;
  }
  _renderFeedback(q, answer, evalData);
}

async function _grade(q, answer) {
  const apiKey = localStorage.getItem(POLZA_KEY_STORAGE);
  const kp = q.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n');

  const prompt = `Ты — строгий, но справедливый экзаменатор по дорожным технологиям компании «Транском». Менеджер по продажам отвечает клиенту на технический вопрос. Оцени его ответ.

ВОПРОС КЛИЕНТА: ${q.clientQ}

КЛЮЧЕВЫЕ ФАКТЫ, которые менеджер должен раскрыть (эталон):
${kp}

ЭТАЛОННЫЙ ОТВЕТ (ориентир): ${q.reference}

ОТВЕТ МЕНЕДЖЕРА (распознан с голоса — возможны мелкие ошибки распознавания, оценивай по СМЫСЛУ, а не дословно): "${answer}"

Правила оценки:
- Для каждого ключевого факта реши, раскрыт ли он в ответе менеджера по смыслу (true/false).
- verdict: "correct" — раскрыто большинство фактов и нет грубых ошибок; "partial" — раскрыта часть; "wrong" — почти ничего не раскрыто или есть фактические ошибки.
- score: 0–100 — доля раскрытых фактов с поправкой на ошибки.
- comment: 1–2 коротких предложения — что хорошо и что не так.
- missing: чего не хватило в ответе (коротко), либо пустая строка.

Ответь СТРОГО в JSON (ровно ${q.keyPoints.length} элемент(ов) в массиве covered), без пояснений:
{"covered":[${q.keyPoints.map(() => 'false').join(',')}],"verdict":"partial","score":50,"comment":"...","missing":"..."}`;

  const resp = await fetch(`${POLZA_API}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EVAL_MODEL,
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Не удалось разобрать ответ');
  return JSON.parse(m[0]);
}

// ==================== ОБРАТНАЯ СВЯЗЬ ====================
function _verdictMeta(verdict, score) {
  if (verdict === 'correct' || score >= 80) return { icon: '✅', label: 'Верно', cls: 'et-fb-correct' };
  if (verdict === 'wrong' || score < 40) return { icon: '❌', label: 'Мимо', cls: 'et-fb-wrong' };
  return { icon: '🟡', label: 'Частично', cls: 'et-fb-partial' };
}

function _renderFeedback(q, answer, evalData) {
  state = STATE.FEEDBACK;
  const score = typeof evalData.score === 'number' ? evalData.score : 0;
  const meta = _verdictMeta(evalData.verdict, score);

  results.push({ q, topicId: q.topicId, topicName: q.topicName, score, verdict: evalData.verdict || 'partial', comment: evalData.comment || '' });

  const kpHtml = q.keyPoints.map((p, i) => {
    const done = evalData.covered?.[i];
    return `<div class="et-kp ${done ? 'et-kp-yes' : 'et-kp-no'}"><span>${done ? '✅' : '➖'}</span> ${_esc(p)}</div>`;
  }).join('');

  const fb = document.getElementById('et-feedback');
  _setState(STATE.FEEDBACK, 'Ответ оценён');
  fb.style.display = 'block';
  fb.className = `et-feedback ${meta.cls}`;
  fb.innerHTML = `
    <div class="et-fb-head">
      <span class="et-fb-verdict">${meta.icon} ${meta.label}</span>
      <span class="et-fb-score">${score}/100</span>
    </div>
    <div class="et-fb-your"><b>Ваш ответ:</b> ${_esc(answer)}</div>
    ${evalData.comment ? `<div class="et-fb-comment">${_esc(evalData.comment)}</div>` : ''}
    <div class="et-fb-kp-title">Что нужно было раскрыть:</div>
    <div class="et-fb-kp">${kpHtml}</div>
    <details class="et-fb-ref"><summary>📖 Эталонный ответ</summary><div class="et-fb-ref-text">${_esc(q.reference)}</div></details>
    <button class="et-next-btn" onclick="nextExpertiseQuestion()">${qIndex < queue.length - 1 ? 'Следующий вопрос →' : 'Завершить и узнать результат 🏁'}</button>
  `;
}

// Фоллбэк при сбое API: ручная самооценка
function _renderManualFeedback(q, answer) {
  state = STATE.FEEDBACK;
  const fb = document.getElementById('et-feedback');
  _setState(STATE.FEEDBACK, 'Оцените себя сами (AI недоступен)');
  fb.style.display = 'block';
  fb.className = 'et-feedback et-fb-partial';
  const kpHtml = q.keyPoints.map(p => `<div class="et-kp"><span>•</span> ${_esc(p)}</div>`).join('');
  fb.innerHTML = `
    <div class="et-fb-head"><span class="et-fb-verdict">⚠️ AI-оценка недоступна</span></div>
    <div class="et-fb-your"><b>Ваш ответ:</b> ${_esc(answer)}</div>
    <div class="et-fb-kp-title">Сверьтесь — это нужно было раскрыть:</div>
    <div class="et-fb-kp">${kpHtml}</div>
    <details class="et-fb-ref" open><summary>📖 Эталонный ответ</summary><div class="et-fb-ref-text">${_esc(q.reference)}</div></details>
    <div class="et-fb-self">Как ответили?
      <button class="et-self-btn" onclick="selfRateExpertise(100)">✅ Знал</button>
      <button class="et-self-btn" onclick="selfRateExpertise(50)">🟡 Частично</button>
      <button class="et-self-btn" onclick="selfRateExpertise(0)">❌ Не знал</button>
    </div>
  `;
}
export function selfRateExpertise(score) {
  const q = queue[qIndex];
  results.push({ q, topicId: q.topicId, topicName: q.topicName, score, verdict: score >= 80 ? 'correct' : score >= 40 ? 'partial' : 'wrong', comment: '(самооценка)' });
  nextExpertiseQuestion();
}

// ==================== НАВИГАЦИЯ ====================
export function nextExpertiseQuestion() {
  if (qIndex < queue.length - 1) {
    qIndex++;
    _askCurrent();
  } else {
    _finish();
  }
}
export function quitExpertiseExam() {
  isActive = false;
  _stopListen();
  if (currentAudio) { try { currentAudio.pause(); } catch {} currentAudio = null; }
  if (results.length > 0) { _finish(); return; }
  _backToSetup();
}
function _backToSetup() {
  document.getElementById('et-exam-screen').style.display = 'none';
  document.getElementById('et-result').style.display = 'none';
  initExpertiseTrainer(); // перерисовать (обновить мастерство тем)
}
export function backToExpertiseSetup() { isActive = false; _backToSetup(); }

// ==================== РЕЗУЛЬТАТ ====================
function _finish() {
  isActive = false;
  _stopListen();
  if (currentAudio) { try { currentAudio.pause(); } catch {} currentAudio = null; }

  document.getElementById('et-exam-screen').style.display = 'none';
  const r = document.getElementById('et-result');
  r.style.display = '';

  const answered = results.length;
  const avg = answered ? Math.round(results.reduce((s, x) => s + x.score, 0) / answered) : 0;

  // мастерство по темам (среди отвеченных)
  const byTopic = {};
  results.forEach(x => {
    if (!byTopic[x.topicId]) byTopic[x.topicId] = { name: x.topicName, scores: [] };
    byTopic[x.topicId].scores.push(x.score);
  });
  Object.entries(byTopic).forEach(([id, t]) => {
    const pct = Math.round(t.scores.reduce((s, v) => s + v, 0) / t.scores.length);
    t.pct = pct;
    _saveTopicMastery(id, pct);
  });

  // XP
  let xp = 0;
  if (answered >= 3) {
    if (avg >= 90) xp = 25;
    else if (avg >= PASS_PCT) xp = 18;
    else xp = 8;
    addXP(xp, mode === 'exam' ? 'Экзамен на экспертность' : 'Тренировка экспертности');
  }

  const passed = avg >= PASS_PCT;
  const scoreColor = avg >= PASS_PCT ? '#2e7d32' : avg >= 40 ? '#e65100' : '#c62828';

  const topicRows = Object.values(byTopic).map(t => {
    const cls = t.pct >= PASS_PCT ? 'et-tr-pass' : t.pct >= 40 ? 'et-tr-mid' : 'et-tr-low';
    return `<div class="et-res-topic ${cls}"><span class="et-res-topic-name">${_esc(t.name)}</span><span class="et-res-topic-pct">${t.pct}%</span></div>`;
  }).join('');

  // слабые вопросы
  const weak = results.filter(x => x.score < PASS_PCT);
  const weakHtml = weak.length
    ? `<div class="et-res-weak-title">Над чем поработать (${weak.length}):</div>` +
      weak.map(x => `<div class="et-res-weak"><span class="et-res-weak-q">${_esc(x.q.clientQ)}</span><details><summary>эталон</summary><div>${_esc(x.q.reference)}</div></details></div>`).join('')
    : '<div class="et-res-allgood">🎉 Все вопросы раскрыты на уровне зачёта — отличная экспертность!</div>';

  window._lastExpertiseReport = {
    date: new Date().toLocaleString('ru-RU'),
    mode: mode === 'exam' ? 'Полный экзамен' : 'Тренировка по теме',
    answered, avg,
    topics: Object.values(byTopic),
    results
  };

  r.innerHTML = `
    <div class="et-res-card">
      <div class="et-res-icon">${passed ? '🏆' : '📝'}</div>
      <div class="et-res-title">${mode === 'exam' ? 'Экзамен завершён' : 'Тренировка завершена'}</div>
      <div class="et-res-score" style="color:${scoreColor}">${avg}%</div>
      <div class="et-res-sub">Экспертность · ответов: ${answered}${xp ? ` · +${xp} XP` : ''}</div>

      <div class="et-res-topics">${topicRows}</div>
      <div class="et-res-weak-block">${weakHtml}</div>

      <div class="et-res-actions">
        <button class="et-start-btn" onclick="backToExpertiseSetup()">↩ К темам</button>
        <button class="et-res-dl" onclick="downloadExpertiseReport()">📥 Отчёт</button>
        <button class="et-res-dl" onclick="copyExpertiseReport()">📋 Копировать</button>
      </div>
    </div>
  `;
}

// ==================== ОТЧЁТ (Word / буфер) ====================
export function copyExpertiseReport() {
  const r = window._lastExpertiseReport;
  if (!r) return;
  let text = `ТРАНСКОМ — Экзамен на экспертность (${r.date})\n`;
  text += `Режим: ${r.mode} | Экспертность: ${r.avg}% | Ответов: ${r.answered}\n\n`;
  text += 'По темам:\n';
  r.topics.forEach(t => { text += `  ${t.name}: ${t.pct}%\n`; });
  text += '\nОтветы:\n';
  r.results.forEach((x, i) => { text += `${i + 1}. [${x.score}%] ${x.q.clientQ}\n`; });
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.et-res-dl:last-child');
    if (btn) { btn.textContent = '✓'; setTimeout(() => btn.textContent = '📋 Копировать', 1500); }
  });
}

export function downloadExpertiseReport() {
  const r = window._lastExpertiseReport;
  if (!r) return;
  const scoreColor = r.avg >= PASS_PCT ? '#2e7d32' : r.avg >= 40 ? '#e65100' : '#c62828';

  const topicRows = r.topics.map(t => `
    <tr><td style="padding:6px 10px;border:1px solid #ddd">${t.name}</td>
    <td style="width:80px;text-align:center;padding:6px;border:1px solid #ddd;font-weight:bold;color:${t.pct >= PASS_PCT ? '#2e7d32' : '#c62828'}">${t.pct}%</td></tr>`).join('');

  const qRows = r.results.map((x, i) => `
    <tr>
      <td style="width:30px;text-align:center;padding:6px;border:1px solid #ddd">${i + 1}</td>
      <td style="padding:6px 10px;border:1px solid #ddd">${x.q.clientQ}</td>
      <td style="width:60px;text-align:center;padding:6px;border:1px solid #ddd;font-weight:bold;color:${x.score >= PASS_PCT ? '#2e7d32' : '#c62828'}">${x.score}%</td>
    </tr>`).join('');

  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<style>
  body { font-family:'Calibri','Segoe UI',sans-serif; font-size:12pt; color:#1a1a1a; margin:40px; }
  h1 { font-size:18pt; text-align:center; margin-bottom:4px; }
  h2 { font-size:14pt; border-bottom:2px solid #333; padding-bottom:4px; margin-top:20px; }
  .date { text-align:center; color:#888; font-size:10pt; margin-bottom:20px; }
  table { width:100%; border-collapse:collapse; margin:10px 0; }
  .score { text-align:center; font-size:40pt; font-weight:bold; color:${scoreColor}; margin:10px 0; }
  .score-sub { text-align:center; font-size:11pt; color:#666; margin-bottom:10px; }
  @page { size:A4; margin:2cm; }
</style></head>
<body>
<h1>ТРАНСКОМ — Экзамен на экспертность</h1>
<div class="date">${r.date} · ${r.mode}</div>
<div class="score">${r.avg}%</div>
<div class="score-sub">Экспертность · ответов: ${r.answered}</div>
<h2>По темам</h2>
<table>${topicRows}</table>
<h2>Вопросы и оценки</h2>
<table>${qRows}</table>
</body></html>`;

  const blob = new Blob(['﻿' + doc], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Транском_экспертность_${new Date().toISOString().slice(0, 10)}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==================== TTS ====================
async function _speak(text) {
  const apiKey = localStorage.getItem(POLZA_KEY_STORAGE);
  document.getElementById('et-state-icon')?.classList.add('et-speaking');
  try {
    await _speakStream(text, apiKey);
  } catch (err) {
    await _speakBrowser(text);
  }
  document.getElementById('et-state-icon')?.classList.remove('et-speaking');
}

// Тон клиента на экзамене — заинтересованный, как реальный звонящий
function _voiceInstr() {
  return 'Говори естественно и заинтересованно, как реальный клиент, который по телефону задаёт вопрос специалисту.';
}

// Разбить вопрос на короткие фразы для потоковой озвучки (убирает паузу-тишину)
function _splitSentences(text) {
  const parts = text.match(/[^.!?…]+[.!?…]+|\S[^.!?…]*$/g) || [text];
  const out = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    if (out.length && out[out.length - 1].length < 18) out[out.length - 1] += ' ' + t;
    else out.push(t);
  }
  return out;
}

// Один запрос к TTS → готовый объект Audio
async function _ttsFetch(text, apiKey) {
  const body = { model: _ttsModel, input: text, voice: currentVoice, response_format: 'mp3' };
  if (_ttsModel.includes('gpt-4o')) body.instructions = _voiceInstr();

  const resp = await fetch(`${POLZA_API}/audio/speech`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error('TTS HTTP ' + resp.status);

  const contentType = resp.headers.get('content-type') || '';
  let blob;
  if (contentType.includes('audio') || contentType.includes('octet-stream')) {
    blob = await resp.blob();
  } else {
    const json = await resp.json();
    if (!json.audio) throw new Error('Нет аудио');
    const binary = atob(json.audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: 'audio/mp3' });
  }
  const audio = new Audio(URL.createObjectURL(blob));
  audio.preload = 'auto';
  return audio;
}

// TTS с авто-откатом: выразительная модель → ровная tts-1
async function _ttsToAudio(text, apiKey) {
  try {
    return await _ttsFetch(text, apiKey);
  } catch (err) {
    if (_ttsModel !== TTS_MODEL) { _ttsModel = TTS_MODEL; return await _ttsFetch(text, apiKey); }
    throw err;
  }
}

// Проиграть готовый Audio до конца
function _playAudio(audio) {
  return new Promise((resolve) => {
    currentAudio = audio;
    const done = () => { try { URL.revokeObjectURL(audio.src); } catch {} if (currentAudio === audio) currentAudio = null; resolve(); };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(() => done());
  });
}

// Потоковая озвучка: следующую фразу готовим, пока играет текущая
async function _speakStream(text, apiKey) {
  const sentences = _splitSentences(text);
  if (!sentences.length) return;

  let next = _ttsToAudio(sentences[0], apiKey).catch(() => null);
  for (let i = 0; i < sentences.length; i++) {
    const audio = await next;
    next = (i + 1 < sentences.length) ? _ttsToAudio(sentences[i + 1], apiKey).catch(() => null) : null;
    if (!isActive) { if (audio) { try { URL.revokeObjectURL(audio.src); } catch {} } return; }
    if (audio) await _playAudio(audio);
    else await _speakBrowser(sentences[i]);
  }
}

function _speakBrowser(text) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'ru-RU';
    utt.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const ru = voices.find(v => v.lang.startsWith('ru'));
    if (ru) utt.voice = ru;
    utt.onend = () => resolve();
    utt.onerror = () => resolve();
    window.speechSynthesis.speak(utt);
  });
}

// ==================== ХЕЛПЕРЫ ====================
function _setState(newState, detail) {
  state = newState;
  const icon = document.getElementById('et-state-icon');
  const txt = document.getElementById('et-state-text');
  const box = document.getElementById('et-state');
  if (!icon || !txt || !box) return;
  const map = {
    [STATE.ASKING]: { i: '🔊', c: 'et-st-asking' },
    [STATE.LISTENING]: { i: '🎙️', c: 'et-st-listening' },
    [STATE.THINKING]: { i: '💭', c: 'et-st-thinking' },
    [STATE.FEEDBACK]: { i: '📊', c: 'et-st-feedback' }
  };
  const m = map[newState] || { i: '⏳', c: '' };
  icon.textContent = m.i;
  txt.textContent = detail || '';
  box.className = `et-state ${m.c}`;
}

function _showAnswerRow(show) {
  const row = document.getElementById('et-answer-row');
  if (row) row.style.display = show ? '' : 'none';
}

function _esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ==================== ГЛОБАЛЬНЫЕ ФУНКЦИИ (onclick) ====================
window.initExpertiseTrainer = initExpertiseTrainer;
window.saveExpertiseKey = saveExpertiseKey;
window.setExpertiseVoice = setExpertiseVoice;
window.setExpertiseMode = setExpertiseMode;
window.startExpertiseTopic = startExpertiseTopic;
window.startExpertiseExam = startExpertiseExam;
window.replayExpertiseQuestion = replayExpertiseQuestion;
window.submitExpertiseText = submitExpertiseText;
window.nextExpertiseQuestion = nextExpertiseQuestion;
window.quitExpertiseExam = quitExpertiseExam;
window.backToExpertiseSetup = backToExpertiseSetup;
window.selfRateExpertise = selfRateExpertise;
window.downloadExpertiseReport = downloadExpertiseReport;
window.copyExpertiseReport = copyExpertiseReport;
