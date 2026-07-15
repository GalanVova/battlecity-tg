// ═══════════════════════════════════════════════════════════
//  Battle City — Telegram Multiplayer Server
//  Node.js + WebSocket
//  Запуск: node server.js
// ═══════════════════════════════════════════════════════════
const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// ── Статические файлы ─────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.ogg':  'audio/ogg',
  '.ttf':  'font/ttf',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
};

const httpServer = http.createServer((req, res) => {
  // Нормализуем URL
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') urlPath = '/BattleCity.html';

  const filePath = path.join(__dirname, urlPath);

  // Защита от path traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + urlPath);
      return;
    }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
});

// ── Комнаты ───────────────────────────────────────────────
// rooms[code] = { p1: ws, p2: ws, state: {...} }
const rooms = {};

function makeCode() {
  // 4-значный код из цифр/заглавных букв без похожих символов
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms[code] ? makeCode() : code; // без коллизий
}

function broadcast(room, msg) {
  const data = JSON.stringify(msg);
  if (room.p1 && room.p1.readyState === 1) room.p1.send(data);
  if (room.p2 && room.p2.readyState === 1) room.p2.send(data);
}

function sendTo(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

// ── WebSocket сервер ──────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  ws._room = null;
  ws._role = null; // 'p1' | 'p2'

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      // Создать комнату
      case 'CREATE_ROOM': {
        const code = makeCode();
        rooms[code] = { p1: ws, p2: null, p1Lvl: msg.p1Lvl || 0 };
        ws._room = code;
        ws._role = 'p1';
        sendTo(ws, { type: 'ROOM_CREATED', code, role: 'p1' });
        console.log(`Room ${code} created`);
        break;
      }

      // Войти в комнату
      case 'JOIN_ROOM': {
        const code = (msg.code || '').toUpperCase().trim();
        const room = rooms[code];
        if (!room) {
          sendTo(ws, { type: 'ERROR', text: 'Комната не найдена' }); return;
        }
        if (room.p2) {
          sendTo(ws, { type: 'ERROR', text: 'Комната уже занята' }); return;
        }
        room.p2 = ws;
        room.p2Lvl = msg.p2Lvl || 0;
        ws._room = code;
        ws._role = 'p2';
        sendTo(ws,    { type: 'ROOM_JOINED', code, role: 'p2', p1Lvl: room.p1Lvl });
        sendTo(room.p1, { type: 'PLAYER2_JOINED', p2Lvl: room.p2Lvl });
        console.log(`Room ${code}: P2 joined`);
        break;
      }

      // Игрок готов к старту
      case 'READY': {
        const room = rooms[ws._room];
        if (!room) return;
        if (ws._role === 'p1') room.p1Ready = true;
        if (ws._role === 'p2') room.p2Ready = true;
        if (room.p1Ready && room.p2Ready) {
          broadcast(room, {
            type:  'START_GAME',
            p1Lvl: room.p1Lvl,
            p2Lvl: room.p2Lvl,
          });
          console.log(`Room ${ws._room}: game started`);
        }
        break;
      }

      // Ввод игрока (клавиша нажата/отпущена или тач-кнопка)
      case 'INPUT': {
        const room = rooms[ws._room];
        if (!room) return;
        // Перенаправляем другому игроку
        const other = ws._role === 'p1' ? room.p2 : room.p1;
        sendTo(other, { type: 'INPUT', role: ws._role, key: msg.key, pressed: msg.pressed });
        break;
      }

      // Состояние игры (от "хоста" — p1 гоняет всю логику)
      case 'GAME_STATE': {
        const room = rooms[ws._room];
        if (!room || ws._role !== 'p1') return;
        sendTo(room.p2, { type: 'GAME_STATE', state: msg.state });
        break;
      }

      // Игрок выиграл/проиграл
      case 'GAME_OVER': {
        const room = rooms[ws._room];
        if (!room) return;
        broadcast(room, { type: 'GAME_OVER', won: msg.won });
        break;
      }
    }
  });

  ws.on('close', () => {
    const code = ws._room;
    if (!code || !rooms[code]) return;
    const room = rooms[code];
    const other = ws._role === 'p1' ? room.p2 : room.p1;
    sendTo(other, { type: 'OPPONENT_LEFT' });
    // Удаляем комнату через 10 сек
    setTimeout(() => { delete rooms[code]; }, 10000);
    console.log(`Room ${code}: ${ws._role} disconnected`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n✅  Battle City сервер запущен на http://localhost:${PORT}`);
  console.log(`    Открой ngrok: ngrok http ${PORT}\n`);
});
