#!/bin/bash
API_KEY="pza_LJSt9WDnbINklMkTvxGgAdxGq3zerK9B"
IMG_DIR="$(dirname "$0")/img"

generate() {
  local prompt="$1"
  local filename="$2"

  echo "Генерирую: $filename..."

  # Запуск генерации
  response=$(curl -sk --ssl-no-revoke -X POST "https://polza.ai/api/v1/images/generations" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"nano-banana\",\"prompt\":\"$prompt\",\"n\":1,\"size\":\"16:9\"}")

  requestId=$(echo "$response" | grep -o '"requestId":"[^"]*"' | cut -d'"' -f4)

  if [ -z "$requestId" ]; then
    echo "  Ошибка запуска: $response"
    return 1
  fi

  echo "  requestId: $requestId — жду результат..."

  # Polling
  for i in $(seq 1 30); do
    sleep 4
    result=$(curl -sk --ssl-no-revoke "https://polza.ai/api/v1/images/$requestId" \
      -H "Authorization: Bearer $API_KEY")

    status=$(echo "$result" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    url=$(echo "$result" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)

    if [ "$status" = "COMPLETED" ] && [ -n "$url" ]; then
      echo "  Скачиваю..."
      curl -sk --ssl-no-revoke -L "$url" -o "$IMG_DIR/$filename"
      echo "  Готово: $filename"
      return 0
    elif [ "$status" = "FAILED" ]; then
      echo "  FAILED: $result"
      return 1
    fi
    echo -n "."
  done

  echo "  Таймаут"
  return 1
}

generate "Aerial photo of premium SMA stone mastic asphalt road surface, dark textured pavement with visible coarse aggregate stones, highway or industrial road, high quality road construction, photorealistic" "learn_sma_1.jpg"
sleep 2
generate "Close-up cross-section diagram of SMA asphalt layer showing coarse stone skeleton filled with dark bitumen mastic, educational material, technical cut view of road pavement structure, photorealistic" "learn_sma_2.jpg"
sleep 2
generate "Photo of road construction workers preparing asphalt base surface: cleaning, applying bitumen emulsion primer coat with sprayer truck before paving, road construction site, photorealistic" "learn_sma_3.jpg"
sleep 2
generate "Photo of road construction quality control worker measuring asphalt temperature with infrared thermometer gun, hot fresh asphalt mix, road paving site, construction worker in safety vest, photorealistic" "learn_sma_4.jpg"
sleep 2
generate "Photo of modern asphalt paver finisher machine laying SMA stone mastic asphalt on industrial road, steam rising from hot mix, construction crew working, wide shot of paving operation, photorealistic" "learn_sma_5.jpg"
sleep 2
generate "Photo of completed premium asphalt road surface with visible coarse stone aggregate texture SMA surface, heavy trucks and industrial vehicles on smooth durable pavement, industrial facility area, photorealistic" "learn_sma_6.jpg"

echo ""
echo "Генерация завершена!"
