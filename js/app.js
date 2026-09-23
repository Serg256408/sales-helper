// Точка входа — инициализация приложения

import { setSvc } from './modules/service-mode.js?v=mqtc94ef';
import { loadPfSettings, autoLinkFromUrl } from './modules/planfix.js?v=mqtc94ef';
import './modules/tabs.js?v=mqtc94ef';
import './modules/big3.js?v=mqtc94ef';
import './modules/tree.js?v=mqtc94ef';
import './modules/calculator.js?v=mqtc94ef';
import './modules/objections.js?v=mqtc94ef';
import { updateLearnUI } from './modules/learn.js?v=planfix-next-step-20260812';
import './modules/knowledge-search.js?v=mqtc94ef';
import { initGamification } from './modules/gamification.js?v=mqtc94ef';
import { initTrainer } from './modules/trainer.js?v=mqtc94ef';
import './modules/ai-trainer.js?v=mqtc94ef';
import './modules/voice-trainer.js?v=mqtc94ef';
import './modules/expertise-trainer.js?v=mqtc94ef';
import { renderFollowup } from './modules/deal-followup.js?v=mqtc94ef';
import { renderSnowTraining } from './modules/snow-training.js?v=5';

// Прямая ссылка на обучение снегу открывает снеговой режим.
setSvc(window.location.hash.startsWith('#snow-') ? 'snow' : 'asphalt');
loadPfSettings();
autoLinkFromUrl();

// Инициализация системы прогресса обучения
updateLearnUI();

// Инициализация геймификации и тренажёра
initGamification();
initTrainer();
renderFollowup();
renderSnowTraining();
if (window.location.hash.startsWith('#snow-')) window.tab('snow-learn');
