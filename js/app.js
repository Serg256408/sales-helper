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

// Запуск: режим по умолчанию — асфальт
setSvc('asphalt');
loadPfSettings();
autoLinkFromUrl();

// Инициализация системы прогресса обучения
updateLearnUI();
