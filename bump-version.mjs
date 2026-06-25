// bump-version.mjs — кеш-бастинг для статического сайта (GitHub Pages).
//
// Зачем: после публикации браузер (особенно внутри PlanFix-iframe) может держать
// в кеше СТАРЫЕ js-файлы, из-за чего новая разметка и старый код не совпадают и
// что-то ломается. Этот скрипт проставляет свежую версию (?v=...) во входной
// <script> и во ВСЕ относительные импорты модулей — тогда после обновления
// браузер обязан скачать свежий код, а не брать из кеша.
//
// Это НЕ сборщик и не npm-зависимость: обычный одноразовый скрипт. Сайт остаётся
// статическим. Запускать ПЕРЕД публикацией изменений:
//
//     node bump-version.mjs
//     git add -A && git commit -m "..." && git push
//
// Версия — метка времени, поэтому каждый запуск уникален и руками ничего бить не надо.

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const VERSION = Date.now().toString(36); // компактная уникальная метка времени

// Рекурсивно собрать все .js в папке js/
function walk(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(p));
    else if (entry.name.endsWith('.js')) files.push(p);
  }
  return files;
}

// Проставить ?v=VERSION в относительные импорты (и заменить старую версию, если была)
function versionImports(code) {
  // ... from './x.js'  |  ... from '../data/x.js'
  code = code.replace(
    /(from\s*['"])(\.\.?\/[^'"?]+\.js)(?:\?v=[^'"]*)?(['"])/g,
    (_, a, spec, c) => `${a}${spec}?v=${VERSION}${c}`
  );
  // побочные импорты без from:  import './x.js'
  code = code.replace(
    /(import\s*['"])(\.\.?\/[^'"?]+\.js)(?:\?v=[^'"]*)?(['"])/g,
    (_, a, spec, c) => `${a}${spec}?v=${VERSION}${c}`
  );
  return code;
}

// 1) Все модули в js/
const jsDir = path.join(ROOT, 'js');
let changed = 0;
for (const file of walk(jsDir)) {
  const orig = fs.readFileSync(file, 'utf8');
  const next = versionImports(orig);
  if (next !== orig) { fs.writeFileSync(file, next); changed++; }
}

// 2) Входной скрипт в index.html
const indexPath = path.join(ROOT, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const beforeHtml = html;
html = html.replace(
  /(<script[^>]*src=["'])(js\/app\.js)(?:\?v=[^"']*)?(["'])/,
  (_, a, spec, c) => `${a}${spec}?v=${VERSION}${c}`
);
if (html !== beforeHtml) fs.writeFileSync(indexPath, html);

console.log(`Версия ${VERSION}: обновлено ${changed} JS-файлов + index.html`);
