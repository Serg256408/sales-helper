// Скрипт генерации изображений для обучающих статей
// Использует polza.ai API (dall-e-3)

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'pza_LJSt9WDnbINklMkTvxGgAdxGq3zerK9B';
const API_BASE = 'polza.ai';

function apiRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: API_BASE,
      path: '/api/v1' + endpoint,
      method,
      headers: {
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Type': 'application/json',
      },
      rejectUnauthorized: false,
    };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch(e) { reject(new Error('Parse error: ' + Buffer.concat(chunks).toString().substring(0,200))); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateImage(prompt, filename) {
  console.log(`Генерирую: ${filename}...`);
  // Запуск генерации
  const gen = await apiRequest('POST', '/images/generations', {
    model: 'nano-banana',
    prompt,
    n: 1,
    size: '16:9'
  });

  if (!gen.requestId) {
    console.log('  Ошибка:', JSON.stringify(gen));
    return false;
  }

  // Ждём результат
  let result = null;
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    result = await apiRequest('GET', '/images/' + gen.requestId);
    if (result.status === 'COMPLETED' && result.url) break;
    if (result.status === 'FAILED') { console.log('  FAILED:', JSON.stringify(result)); return false; }
    process.stdout.write('.');
  }

  if (!result || !result.url) {
    console.log('  Таймаут');
    return false;
  }

  // Скачиваем
  console.log(`  Скачиваю... (${Math.round(result.usage?.cost || 0)} ₽)`);
  await downloadFile(result.url, path.join(__dirname, 'img', filename));
  console.log(`  Готово: ${filename}`);
  return true;
}

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : require('http');
    mod.get(url, { rejectUnauthorized: false }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, filepath).then(resolve).catch(reject);
      }
      const ws = fs.createWriteStream(filepath);
      res.pipe(ws);
      ws.on('finish', () => { ws.close(); resolve(); });
      ws.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  const article = process.argv[2];

  const articles = {
    'asphalt-concrete': [
      { file: 'learn_asphalt_1.jpg', prompt: 'Professional aerial photo of freshly laid black asphalt road with road markings, wide highway, construction equipment visible, bright sunny day, photorealistic high quality' },
      { file: 'learn_asphalt_2.jpg', prompt: 'Close-up photo of asphalt concrete mixture components: crushed stone gravel, sand, black bitumen liquid, mineral powder in separate piles on construction site, educational reference photo, photorealistic' },
      { file: 'learn_asphalt_3.jpg', prompt: 'Photo of different types of crushed stone and gravel for road construction, sorted by size from large to small, labeled samples of construction aggregates, educational photo, photorealistic' },
      { file: 'learn_asphalt_4.jpg', prompt: 'Cross-section photo of asphalt road layers (road pavement structure), showing soil base, sand layer, gravel layer, and black asphalt top layers, educational diagram style, photorealistic' },
      { file: 'learn_asphalt_5.jpg', prompt: 'Photo of asphalt batch plant (asphalt mixing factory), industrial facility producing hot asphalt mix, conveyor belts, storage silos, trucks loading, photorealistic' },
      { file: 'learn_asphalt_6.jpg', prompt: 'Photo comparing hot asphalt laying (steaming black mix with paver machine) vs cold asphalt patch repair (workers filling pothole by hand), split image, construction site, photorealistic' },
      { file: 'learn_asphalt_7.jpg', prompt: 'Photo of road roller compacting fresh hot asphalt, heavy vibration roller, steam rising from black surface, road construction site, orange safety cones, photorealistic' },
      { file: 'learn_asphalt_8.jpg', prompt: 'Beautiful photo of completed smooth asphalt road with fresh white lane markings, curbs on sides, modern parking lot or residential area, perfect finish quality, sunny day, photorealistic' },
    ],
    'asphalt-sma': [
      { file: 'learn_sma_1.jpg', prompt: 'Aerial photo of premium SMA stone mastic asphalt road surface, dark textured pavement with visible coarse aggregate stones, highway or industrial road, high quality road construction, photorealistic' },
      { file: 'learn_sma_2.jpg', prompt: 'Close-up cross-section diagram of SMA asphalt layer showing coarse stone skeleton filled with dark bitumen mastic, educational material, technical cut view of road pavement structure, photorealistic' },
      { file: 'learn_sma_3.jpg', prompt: 'Photo of road construction workers preparing asphalt base surface: cleaning, applying bitumen emulsion primer coat with sprayer truck before paving, road construction site, photorealistic' },
      { file: 'learn_sma_4.jpg', prompt: 'Photo of road construction quality control worker measuring asphalt temperature with infrared thermometer gun, hot fresh asphalt mix, road paving site, construction worker in safety vest, photorealistic' },
      { file: 'learn_sma_5.jpg', prompt: 'Photo of modern asphalt paver finisher machine laying SMA stone mastic asphalt on industrial road, steam rising from hot mix, construction crew working, wide shot of paving operation, photorealistic' },
      { file: 'learn_sma_6.jpg', prompt: 'Photo of completed premium asphalt road surface with visible coarse stone aggregate texture (SMA surface), heavy trucks and industrial vehicles on smooth durable pavement, industrial facility area, photorealistic' },
    ],
    'asphalt-laying': [
      { file: 'learn_laying_1.jpg', prompt: 'Professional photo of asphalt paver machine in action, laying hot asphalt mix on road, workers guiding the process, wide shot of construction site, photorealistic' },
      { file: 'learn_laying_2.jpg', prompt: 'Photo of construction crew working with asphalt paver machine, operator in cabin, workers with shovels smoothing edges, dump truck feeding mix into paver hopper, photorealistic' },
      { file: 'learn_laying_3.jpg', prompt: 'Photo of workers manually laying asphalt by hand with shovels and rakes on narrow sidewalk area, manual asphalt paving, small construction site, photorealistic' },
      { file: 'learn_laying_4.jpg', prompt: 'Photo comparing mechanized vs manual asphalt laying side by side: large paver machine on road vs workers with hand tools on sidewalk, split composition, photorealistic' },
      { file: 'learn_laying_5.jpg', prompt: 'Photo of road construction quality control: worker checking asphalt layer thickness with measuring tool, temperature measurement of hot mix, construction quality inspection, photorealistic' },
    ]
  };

  if (!article || !articles[article]) {
    console.log('Использование: node generate-images.js <article-id>');
    console.log('Доступные статьи:', Object.keys(articles).join(', '));
    return;
  }

  const images = articles[article];
  console.log(`Генерация ${images.length} изображений для статьи "${article}"...\n`);

  for (const img of images) {
    await generateImage(img.prompt, img.file);
    await sleep(2000); // пауза между запросами
  }

  console.log('\nГотово!');
}

main().catch(e => console.error('Ошибка:', e.message));
