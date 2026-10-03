import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const httpServer = createServer(app);

app.use(express.json());

interface SessionRoom {
  roomId: string;
  pin: string;
  createdAt: number;
  receiverWs?: WebSocket;
  senderWs?: WebSocket;
  state: {
    status: 'waiting' | 'handshaking' | 'connected' | 'streaming';
    deviceName: string;
    clientModel: string;
    protocolStage: string;
    handshakeProgress: number;
    videoCodec: string;
    audioCodec: string;
    resolution: string;
    fps: number;
    windowsDisplayActive: boolean;
    miracastTarget: string;
    packetsReceived: number;
    bytesReceived: number;
  };
  protocolLogs: Array<{
    id: string;
    timestamp: string;
    layer: 'mDNS/Bonjour' | 'Pair-Setup (SRP)' | 'FairPlay/AES' | 'RTSP Control' | 'RTP/AV' | 'Miracast/WFD';
    direction: 'IN' | 'OUT' | 'INTERNAL';
    summary: string;
    details?: string;
  }>;
}

const activeRooms = new Map<string, SessionRoom>();

function getOrCreateRoom(roomId: string, defaultPin = '4829'): SessionRoom {
  let room = activeRooms.get(roomId);
  if (!room) {
    room = {
      roomId,
      pin: defaultPin,
      createdAt: Date.now(),
      state: {
        status: 'waiting',
        deviceName: 'AirPlay-PC-Receiver [AppleTV3,2]',
        clientModel: 'Unpaired Apple Device',
        protocolStage: 'mDNS Advertisement Active',
        handshakeProgress: 0,
        videoCodec: 'H.264 (AVC Baseline/Main @ 60fps)',
        audioCodec: 'Apple Lossless (ALAC) 44.1kHz 16-bit',
        resolution: '1920x1080',
        fps: 60,
        windowsDisplayActive: false,
        miracastTarget: 'Local PC Display Engine (WFD/DirectX)',
        packetsReceived: 0,
        bytesReceived: 0,
      },
      protocolLogs: [
        {
          id: 'log-0',
          timestamp: new Date().toLocaleTimeString(),
          layer: 'mDNS/Bonjour',
          direction: 'OUT',
          summary: 'Broadcasting _airplay._tcp.local on 224.0.0.251:5353',
          details: 'TXT: model=AppleTV3,2 features=0x5A7FFFF7,0x1E srcvers=220.68 flags=0x4 pk=3b92f7... flags=0x200',
        },
        {
          id: 'log-1',
          timestamp: new Date().toLocaleTimeString(),
          layer: 'mDNS/Bonjour',
          direction: 'OUT',
          summary: 'Broadcasting _raop._tcp.local (Remote Audio Output Protocol)',
          details: 'TXT: cn=0,1,2,3 ch=2 ek=1 et=0,1 md=0,1,2 pw=false sr=44100 ss=16 tp=UDP vn=65537',
        },
      ],
    };
    activeRooms.set(roomId, room);
  }
  return room;
}

// WebSocket server setup
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws: WebSocket, req) => {
  let currentRoomId: string | null = null;
  let clientRole: 'receiver' | 'sender' | null = null;

  ws.on('message', (data: string | Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      const { type, roomId, payload } = message;

      if (type === 'REGISTER_RECEIVER') {
        currentRoomId = roomId;
        clientRole = 'receiver';
        const room = getOrCreateRoom(roomId, payload?.pin || '4829');
        room.receiverWs = ws;
        ws.send(JSON.stringify({
          type: 'ROOM_REGISTERED',
          payload: { roomState: room.state, protocolLogs: room.protocolLogs },
        }));
        return;
      }

      if (type === 'REGISTER_SENDER') {
        currentRoomId = roomId;
        clientRole = 'sender';
        const room = activeRooms.get(roomId);
        if (!room) {
          ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Session expired or not found. Please rescan QR.' } }));
          return;
        }

        // Verify PIN if provided
        if (payload?.pin && payload.pin !== room.pin) {
          ws.send(JSON.stringify({ type: 'AUTH_FAILED', payload: { message: 'Invalid AirPlay pairing code. Check PC screen.' } }));
          return;
        }

        room.senderWs = ws;
        room.state.clientModel = payload?.clientModel || 'Apple iPhone (iOS 18.2)';
        room.state.status = 'handshaking';
        room.state.protocolStage = 'Pair-Setup Initiated';
        room.state.handshakeProgress = 25;

        // Log pairing attempt
        const logEntry = {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          timestamp: new Date().toLocaleTimeString(),
          layer: 'Pair-Setup (SRP)' as const,
          direction: 'IN' as const,
          summary: `Incoming AirPlay connection request from ${room.state.clientModel}`,
          details: `Client IPv4/IPv6 handshake initiated. SRP-6a client ephemeral public key A received.`,
        };
        room.protocolLogs.push(logEntry);

        // Notify receiver that sender joined and started handshake
        if (room.receiverWs && room.receiverWs.readyState === WebSocket.OPEN) {
          room.receiverWs.send(JSON.stringify({
            type: 'SENDER_CONNECTED',
            payload: { clientModel: room.state.clientModel, roomState: room.state, logEntry },
          }));
        }

        ws.send(JSON.stringify({
          type: 'SENDER_REGISTERED',
          payload: { status: 'handshaking', roomState: room.state },
        }));
        return;
      }

      // Forward signaling messages (WebRTC offer, answer, ice-candidate, etc.)
      if (currentRoomId) {
        const room = activeRooms.get(currentRoomId);
        if (room) {
          if (type === 'PROTOCOL_LOG') {
            room.protocolLogs.push(payload);
            if (room.protocolLogs.length > 100) room.protocolLogs.shift();
            // Broadcast log to receiver
            if (room.receiverWs && room.receiverWs.readyState === WebSocket.OPEN) {
              room.receiverWs.send(JSON.stringify({ type: 'PROTOCOL_LOG_ADDED', payload }));
            }
            return;
          }

          if (type === 'UPDATE_ROOM_STATE') {
            room.state = { ...room.state, ...payload };
            if (room.receiverWs && room.receiverWs.readyState === WebSocket.OPEN) {
              room.receiverWs.send(JSON.stringify({ type: 'ROOM_STATE_UPDATED', payload: room.state }));
            }
            if (room.senderWs && room.senderWs.readyState === WebSocket.OPEN) {
              room.senderWs.send(JSON.stringify({ type: 'ROOM_STATE_UPDATED', payload: room.state }));
            }
            return;
          }

          // Route WebRTC signaling and data
          const targetWs = clientRole === 'receiver' ? room.senderWs : room.receiverWs;
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify({ type, payload }));
          }
        }
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomId) {
      const room = activeRooms.get(currentRoomId);
      if (room) {
        if (clientRole === 'sender') {
          room.senderWs = undefined;
          room.state.status = 'waiting';
          room.state.protocolStage = 'Awaiting Device Connection';
          room.state.handshakeProgress = 0;
          if (room.receiverWs && room.receiverWs.readyState === WebSocket.OPEN) {
            room.receiverWs.send(JSON.stringify({
              type: 'SENDER_DISCONNECTED',
              payload: { message: 'Apple device disconnected.' },
            }));
          }
        } else if (clientRole === 'receiver') {
          room.receiverWs = undefined;
        }
      }
    }
  });
});

// REST API routes
app.get('/api/receiver/specs', (req, res) => {
  res.json({
    receiverName: 'AirPlay-PC-Receiver [AppleTV3,2]',
    features: '0x5A7FFFF7,0x1E',
    protocols: {
      discovery: ['mDNS / DNS-SD Zeroconf (_airplay._tcp, _raop._tcp)'],
      cryptography: ['SRP-6a (RFC 5054)', 'Curve25519 ECDH', 'Ed25519 Signatures', 'ChaCha20-Poly1305 AEAD'],
      control: ['RTSP 1.0 (ANNOUNCE, SETUP, RECORD, GET_PARAMETER, SET_PARAMETER, TEARDOWN)'],
      mirroring: ['Apple Binary Plist /stream header', 'H.264 / AVC Annex-B NALU (Payload Type 96)', 'NTP / PTP Clock Sync'],
      audio: ['Apple Lossless (ALAC)', 'AAC-ELD (Ultra Low Latency)', 'LPCM 16-bit/44.1kHz or 48kHz Stereo'],
      windowsBridge: ['Miracast / WFD (Wi-Fi Display Spec M1-M7)', 'Presentation API / Win+K Wireless Display Target', 'MPEG-2 Transport Stream Packaging'],
    },
  });
});

app.get('/api/room/:roomId', (req, res) => {
  const room = activeRooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({
    roomId: room.roomId,
    pin: room.pin,
    state: room.state,
    logCount: room.protocolLogs.length,
  });
});

// Serve Vite frontend in dev or dist in prod
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`AirPlay Web Receiver server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
