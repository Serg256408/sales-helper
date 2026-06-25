// Точка входа — инициализация приложения

import { setSvc } from './modules/service-mode.js?v=mqtc94ef';
import { loadPfSettings, autoLinkFromUrl } from './modules/planfix.js?v=mqtc94ef';
import './modules/tabs.js?v=mqtc94ef';
import './modules/big3.js?v=mqtc94ef';
import './modules/tree.js?v=mqtc94ef';
import './modules/calculator.js?v=mqtc94ef';
import './modules/objections.js?v=mqtc94ef';
import { updateLearnUI } from './modules/learn.js?v=mqtc94ef';
import './modules/knowledge-search.js?v=mqtc94ef';
import { initGamification } from './modules/gamification.js?v=mqtc94ef';
import { initTrainer } from './modules/trainer.js?v=mqtc94ef';
import './modules/ai-trainer.js?v=mqtc94ef';
import './modules/voice-trainer.js?v=mqtc94ef';
import './modules/expertise-trainer.js?v=mqtc94ef';
import { renderFollowup } from './modules/deal-followup.js?v=mqtc94ef';

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
