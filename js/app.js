// Точка входа — инициализация приложения

import { setSvc } from './modules/service-mode.js';
import { loadPfSettings, autoLinkFromUrl } from './modules/planfix.js';
import './modules/tabs.js';
import './modules/big3.js';
import './modules/tree.js';
import './modules/calculator.js';
import './modules/objections.js';
import { updateLearnUI } from './modules/learn.js';
import './modules/knowledge-search.js';
import { initGamification } from './modules/gamification.js';
import { initTrainer } from './modules/trainer.js';
import './modules/ai-trainer.js';
import './modules/voice-trainer.js';
import './modules/expertise-trainer.js';
import { renderFollowup } from './modules/deal-followup.js';

// Запуск: режим по умолчанию — асфальт
setSvc('asphalt');
loadPfSettings();
autoLinkFromUrl();

// Инициализация системы прогресса обучения
updateLearnUI();

// Инициализация геймификации и тренажёра
initGamification();
initTrainer();
renderFollowup();
