# Battle City — Telegram Multiplayer
## Установка и запуск на Mac

### 1. Установи Node.js
```bash
# Через Homebrew (рекомендуется)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node

# Проверь
node --version   # должно быть v18+
```

### 2. Установи ngrok
```bash
brew install ngrok/ngrok/ngrok
# Зарегистрируйся на https://ngrok.com (бесплатно) и получи токен
ngrok config add-authtoken ВАШ_ТОКЕН
```

### 3. Установи зависимости игры
```bash
cd battlecity-tg
npm install
```

### 4. Запусти сервер
```bash
node server.js
# Увидишь: ✅ Battle City сервер запущен на http://localhost:3000
```

### 5. В другом терминале — запусти ngrok
```bash
ngrok http 3000
# Увидишь строку типа:
# Forwarding  https://xxxx-xx-xx.ngrok-free.app -> http://localhost:3000
# Скопируй HTTPS ссылку — это твой публичный URL
```

### 6. Настрой Telegram бота
Открой @BotFather в Telegram:
```
/setmenubutton
→ выбери своего бота
→ URL: https://xxxx-xx-xx.ngrok-free.app/BattleCity.html
→ Текст кнопки: 🎮 Играть
```

Или используй команду /newapp для создания Mini App.

### 7. Играйте!
1. Ты открываешь бота → нажимаешь "Играть"
2. Выбираешь "СОЗДАТЬ КОМНАТУ" → видишь 4-значный код
3. Говоришь код жене (или отправляешь в чат)
4. Жена открывает бота → "ВВЕСТИ КОД" → вводит код
5. Оба выбирают мощность танка → игра начинается!

## Управление
### На телефоне
- Виртуальный джойстик появляется автоматически
- 🔥 — кнопка огня

### На ПК (для тестирования)
- P1: Стрелки + Пробел
- P2: WASD + E

## Если ngrok отключился
Просто перезапусти ngrok и обнови URL в @BotFather.
Для постоянного URL нужен платный план ngrok или VPS.

## Структура проекта
```
battlecity-tg/
├── server.js              ← Node.js WebSocket сервер
├── package.json           ← зависимости
├── BattleCity.html        ← главный файл игры
├── src/
│   ├── MultiplayerLobby.js   ← экран создания/входа в комнату
│   ├── MultiplayerSync.js    ← синхронизация между игроками  
│   ├── TouchControls.js      ← тач-управление
│   ├── TankPowerSelectScene.js
│   ├── TwoPlayersMenuItem.js
│   ├── Player2TankController.js
│   └── ... (оригинальный код без изменений)
├── images/                ← оригинальные спрайты
├── sound/                 ← оригинальные звуки
└── SETUP.md               ← эта инструкция
```
