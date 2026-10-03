/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AirPlayReceiver } from './components/AirPlayReceiver';
import { AppleDeviceSender } from './components/AppleDeviceSender';
import { AirPlayReceiverState, ProtocolLog } from './types/airplay';
import { DEFAULT_BONJOUR_AIRPLAY, DEFAULT_BONJOUR_RAOP, generateSrpHandshakePayloads, generateRtspAnnouncePlist } from './services/airplayProtocol';

export default function App() {
  const [currentMode, setCurrentMode] = useState<'receiver' | 'sender' | 'presentation'>('receiver');
  const [roomId, setRoomId] = useState<string>('AIR-7492');
  const [pin, setPin] = useState<string>('4829');
  
  const [roomState, setRoomState] = useState<AirPlayReceiverState>({
    status: 'waiting',
    deviceName: 'AirPlay-PC-Receiver [AppleTV3,2]',
    clientModel: 'Unpaired Apple Device',
    protocolStage: 'mDNS Advertisement Active',
    handshakeProgress: 0,
    videoCodec: 'H.264 (AVC Baseline/High @ 60fps)',
    audioCodec: 'Apple Lossless (ALAC) 44.1kHz 16-bit',
    resolution: '1920x1080',
    fps: 60,
    windowsDisplayActive: false,
    miracastTarget: 'Local PC Display Engine (WFD/DirectX)',
    packetsReceived: 0,
    bytesReceived: 0,
  });

  const [protocolLogs, setProtocolLogs] = useState<ProtocolLog[]>([
    {
      id: 'log-0',
      timestamp: new Date().toLocaleTimeString(),
      layer: 'mDNS/Bonjour',
      direction: 'OUT',
      summary: 'Broadcasting _airplay._tcp.local on 224.0.0.251:5353',
      details: 'TXT: model=AppleTV3,2 features=0x5A7FFFF7,0x1E srcvers=220.68 flags=0x4 pk=3b92f7e4... pi=b08861a0...',
    },
    {
      id: 'log-1',
      timestamp: new Date().toLocaleTimeString(),
      layer: 'mDNS/Bonjour',
      direction: 'OUT',
      summary: 'Broadcasting _raop._tcp.local on 224.0.0.251:5353',
      details: 'TXT: cn=0,1,2,3 ch=2 ek=1 et=0,1 md=0,1,2 pw=false sr=44100 ss=16 tp=UDP vn=65537',
    },
  ]);

  const wsRef = useRef<WebSocket | null>(null);

  // Check URL query parameters for mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const roomParam = params.get('room');
    const pinParam = params.get('pin');

    if (modeParam === 'sender') {
      setCurrentMode('sender');
    } else if (modeParam === 'presentation') {
      setCurrentMode('presentation');
    }

    if (roomParam) setRoomId(roomParam);
    if (pinParam) setPin(pinParam);
  }, []);

  // Initialize WebSocket connection to backend
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (currentMode === 'receiver' || currentMode === 'presentation') {
        ws.send(JSON.stringify({
          type: 'REGISTER_RECEIVER',
          roomId,
          payload: { pin },
        }));
      }
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'ROOM_REGISTERED') {
          if (msg.payload?.roomState) setRoomState(msg.payload.roomState);
          if (msg.payload?.protocolLogs) setProtocolLogs(msg.payload.protocolLogs);
        } else if (msg.type === 'SENDER_CONNECTED') {
          if (msg.payload?.roomState) setRoomState(msg.payload.roomState);
          if (msg.payload?.logEntry) {
            setProtocolLogs((prev) => [...prev, msg.payload.logEntry]);
          }
        } else if (msg.type === 'ROOM_STATE_UPDATED') {
          setRoomState(msg.payload);
        } else if (msg.type === 'PROTOCOL_LOG_ADDED') {
          setProtocolLogs((prev) => [...prev, msg.payload]);
        } else if (msg.type === 'SENDER_DISCONNECTED') {
          setRoomState((prev) => ({
            ...prev,
            status: 'waiting',
            protocolStage: 'Awaiting Device Connection',
            handshakeProgress: 0,
          }));
          setProtocolLogs((prev) => [
            ...prev,
            {
              id: `log-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              layer: 'RTSP Control',
              direction: 'IN',
              summary: 'TEARDOWN rtsp://pc-receiver.local/stream RTSP/1.0',
              details: 'Session closed gracefully by Apple device.',
            },
          ]);
        }
      } catch (err) {
        console.error('Error handling receiver WS message:', err);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [roomId, pin, currentMode]);

  // Quick Test Handshake simulation
  const handleSimulateHandshake = () => {
    const srp = generateSrpHandshakePayloads(pin);

    // Sequence of simulated handshake events
    const log1: ProtocolLog = {
      id: `log-${Date.now()}-1`,
      timestamp: new Date().toLocaleTimeString(),
      layer: 'Pair-Setup (SRP)',
      direction: 'IN',
      summary: 'POST /pair-setup (Apple iPhone 16 Pro connecting via SRP-6a)',
      details: `Client Ephemeral Public Key A: ${srp.clientA}\nVerifying PIN code ${pin}...`,
    };

    const log2: ProtocolLog = {
      id: `log-${Date.now()}-2`,
      timestamp: new Date().toLocaleTimeString(),
      layer: 'Pair-Setup (SRP)',
      direction: 'OUT',
      summary: 'HTTP/1.1 200 OK (SRP Server Challenge B sent)',
      details: `Salt: ${srp.srpSalt}\nServer Ephemeral B: ${srp.serverB}\nPIN verification succeeded.`,
    };

    setProtocolLogs((prev) => [...prev, log1, log2]);
    setRoomState((prev) => ({
      ...prev,
      status: 'handshaking',
      clientModel: 'Apple iPhone 16 Pro (iOS 18.2)',
      protocolStage: 'Curve25519 Pair-Verify',
      handshakeProgress: 40,
    }));

    setTimeout(() => {
      const log3: ProtocolLog = {
        id: `log-${Date.now()}-3`,
        timestamp: new Date().toLocaleTimeString(),
        layer: 'FairPlay/AES',
        direction: 'IN',
        summary: 'POST /pair-verify (Curve25519 Shared Secret Derived)',
        details: `ECDH exchange completed. Master Key: ${srp.sessionKey}\nCipher: ChaCha20-Poly1305 AEAD`,
      };
      setProtocolLogs((prev) => [...prev, log3]);
      setRoomState((prev) => ({ ...prev, handshakeProgress: 75 }));
    }, 700);

    setTimeout(() => {
      const log4: ProtocolLog = {
        id: `log-${Date.now()}-4`,
        timestamp: new Date().toLocaleTimeString(),
        layer: 'RTSP Control',
        direction: 'IN',
        summary: 'ANNOUNCE & SETUP rtsp://pc-receiver.local/stream RTSP/1.0',
        details: generateRtspAnnouncePlist(1920, 1080, 60),
      };
      const log5: ProtocolLog = {
        id: `log-${Date.now()}-5`,
        timestamp: new Date().toLocaleTimeString(),
        layer: 'RTP/AV',
        direction: 'IN',
        summary: 'RECORD rtsp://pc-receiver.local/stream (H.264 & ALAC Stream Active)',
        details: 'UDP Ports: Video RTP 7000, Audio RTP 7001, NTP Clock Sync 7002.',
      };
      setProtocolLogs((prev) => [...prev, log4, log5]);
      setRoomState((prev) => ({
        ...prev,
        status: 'streaming',
        protocolStage: 'AirPlay 2 Mirroring Active',
        handshakeProgress: 100,
        resolution: '1920x1080',
        fps: 60,
      }));
    }, 1400);
  };

  const handleToggleMiracastBridge = (active: boolean) => {
    setRoomState((prev) => ({
      ...prev,
      windowsDisplayActive: active,
    }));

    const log: ProtocolLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      layer: 'Miracast/WFD',
      direction: 'INTERNAL',
      summary: active
        ? 'Windows Wireless Display (Miracast) Transcoder Activated'
        : 'Windows Wireless Display Bridge Deactivated',
      details: active
        ? 'Translating AirPlay H.264 RTP stream to WFD 1.1 MPEG-2 Transport Stream on port 19000.'
        : 'Miracast output stopped.',
    };
    setProtocolLogs((prev) => [...prev, log]);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'UPDATE_ROOM_STATE',
        roomId,
        payload: { windowsDisplayActive: active },
      }));
    }
  };

  if (currentMode === 'sender') {
    return (
      <AppleDeviceSender
        roomId={roomId}
        defaultPin={pin}
        onBackToReceiver={() => setCurrentMode('receiver')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <AirPlayReceiver
        roomId={roomId}
        pin={pin}
        roomState={roomState}
        protocolLogs={protocolLogs}
        onOpenMobileSender={() => setCurrentMode('sender')}
        onSimulateAppleHandshake={handleSimulateHandshake}
        onToggleMiracastBridge={handleToggleMiracastBridge}
        onClearLogs={() => setProtocolLogs([])}
      />
    </div>
  );
}
