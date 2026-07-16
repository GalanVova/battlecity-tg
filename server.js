// Battle City — Telegram Multiplayer Server
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.ogg': 'audio/ogg',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

const httpServer = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') urlPath = '/BattleCity.html';
  const filePath = path.join(__dirname, urlPath);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404); res.end('Not found: ' + urlPath); return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
});

const rooms = {};

function makeCode() {
  const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return rooms[code] ? makeCode() : code;
}

function sendTo(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg) {
  sendTo(room.p1, msg);
  sendTo(room.p2, msg);
}

const wss = new WebSocketServer({ server: httpServer, maxPayload: 2 * 1024 * 1024 });

wss.on('connection', (ws) => {
  ws._room = null;
  ws._role = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    switch (msg.type) {
      case 'CREATE_ROOM': {
        const code = makeCode();
        rooms[code] = {
          p1: ws,
          p2: null,
          p1Lvl: msg.p1Lvl || 0,
          p2Lvl: 0,
          p1Ready: false,
          p2Ready: false
        };
        ws._room = code;
        ws._role = 'p1';
        sendTo(ws, { type: 'ROOM_CREATED', code, role: 'p1' });
        console.log(`Room ${code} created`);
        break;
      }

      case 'JOIN_ROOM': {
        const code = String(msg.code || '').replace(/\D/g, '').slice(0, 4);
        const room = rooms[code];
        if (!room) return sendTo(ws, { type: 'ERROR', text: 'Комната не найдена' });
        if (room.p2) return sendTo(ws, { type: 'ERROR', text: 'Комната уже занята' });

        room.p2 = ws;
        room.p2Lvl = msg.p2Lvl || 0;
        ws._room = code;
        ws._role = 'p2';
        sendTo(ws, { type: 'ROOM_JOINED', code, role: 'p2', p1Lvl: room.p1Lvl });
        sendTo(room.p1, { type: 'PLAYER2_JOINED', p2Lvl: room.p2Lvl });
        console.log(`Room ${code}: P2 joined`);
        break;
      }

      case 'READY': {
        const room = rooms[ws._room];
        if (!room) return;
        if (ws._role === 'p1') {
          room.p1Ready = true;
          room.p1Lvl = msg.level || room.p1Lvl || 0;
        }
        if (ws._role === 'p2') {
          room.p2Ready = true;
          room.p2Lvl = msg.level || room.p2Lvl || 0;
        }
        if (room.p1Ready && room.p2Ready) {
          broadcast(room, {
            type: 'START_GAME',
            p1Lvl: room.p1Lvl,
            p2Lvl: room.p2Lvl
          });
          console.log(`Room ${ws._room}: game started`);
        }
        break;
      }

      case 'INPUT': {
        const room = rooms[ws._room];
        if (!room) return;
        broadcast(room, {
          type: 'INPUT',
          role: ws._role,
          key: msg.key,
          pressed: !!msg.pressed
        });
        break;
      }

      case 'FRAME': {
        const room = rooms[ws._room];
        if (!room || ws._role !== 'p1' || !room.p2) return;
        sendTo(room.p2, { type: 'FRAME', data: msg.data });
        break;
      }

      case 'PING':
        sendTo(ws, { type: 'PONG' });
        break;
    }
  });

  ws.on('close', () => {
    const code = ws._room;
    if (!code || !rooms[code]) return;
    const room = rooms[code];
    const other = ws._role === 'p1' ? room.p2 : room.p1;
    sendTo(other, { type: 'OPPONENT_LEFT' });
    delete rooms[code];
    console.log(`Room ${code}: ${ws._role} disconnected`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Battle City server listening on port ${PORT}`);
});