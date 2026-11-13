# Cozy Tiles

Уютная онлайн-игра в плитки (числа 1–13, ряды и группы, котики-джокеры) для 2–5 друзей в браузере.
Комнаты по ссылке, чат, четыре темы оформления и лофай-музыка.

## Запуск

```bash
npm install
npm run dev        # сервер :3001 + клиент :5173 с горячей перезагрузкой
```

Продакшен-режим — один процесс отдаёт и страницу, и сокеты:

```bash
npm run build
npm start          # http://localhost:3001, порт задаётся через PORT
```

## Проверки

```bash
npm test           # правила, ход по таймеру, расстановка плиток на столе и в руке
npm run typecheck
```

## Стек

- **Клиент:** React 19, TypeScript, Vite. Без UI-библиотек: стили на чистом CSS, графика — SVG и canvas.
- **Сервер:** Node.js, Express 5, Socket.IO. Запускается через `tsx`, без отдельной сборки.
- **Звук:** Web Audio API — эффекты синтезируются в браузере, музыка играет из `public/music`.
- **Тесты:** встроенный `node:test`.
- **Хостинг:** Render (`render.yaml`), бесплатный тариф.

## Структура

```
core/      правила игры и типы, общие для сервера и клиента
server/    комнаты, ходы, таймер, чат; сервер проверяет каждый ход
src/       клиент, слои по Feature-Sliced Design
  app/       точка входа, переключение экранов, глобальные стили
  pages/     home, lobby, game
  widgets/   scene, controls, chat, players-bar, turn-actions, game-result, rules-dialog
  features/  arrange-tiles, drag-tiles, animate-tiles, turn-timer, room-session
  entities/  tile, player
  shared/    api (сокет), lib (звук, настройки), config, ui
```

Слой импортирует только те, что ниже него: `app → pages → widgets → features → entities → shared`.
Каждый срез открывает наружу только то, что перечислено в его `index.ts`.

Комнаты живут в памяти процесса, поэтому сервер должен работать в одном экземпляре,
а его перезапуск сбрасывает открытые партии.

## Музыка

Треки в `public/music` — из сборника «Happy Lo-Fi (Lofi Collection)» автора HoliznaCC0,
опубликованного на OpenGameArt под лицензией CC0 (общественное достояние):
https://opengameart.org/content/happy-lo-fi-lofi-collection
