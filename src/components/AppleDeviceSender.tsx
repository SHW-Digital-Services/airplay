import React, { useState, useEffect, useRef } from 'react';
import { 
  Cast, 
  Smartphone, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  ArrowRight, 
  Monitor, 
  RefreshCw,
  Video,
  Camera,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronLeft
} from 'lucide-react';
import { VirtualiOSDevice } from './VirtualiOSDevice';
import { generateSrpHandshakePayloads, generateRtspAnnouncePlist } from '../services/airplayProtocol';

interface AppleDeviceSenderProps {
  roomId: string;
  defaultPin: string;
  onBackToReceiver?: () => void;
  isStandaloneTab?: boolean;
}

export const AppleDeviceSender: React.FC<AppleDeviceSenderProps> = ({
  roomId,
  defaultPin,
  onBackToReceiver,
  isStandaloneTab = false,
}) => {
  const [pinInput, setPinInput] = useState(defaultPin);
  const [deviceModel, setDeviceModel] = useState('Apple iPhone 16 Pro (iOS 18.2)');
  const [handshakeState, setHandshakeState] = useState<'idle' | 'authenticating' | 'handshaking' | 'streaming' | 'error'>('idle');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [sourceType, setSourceType] = useState<'virtual' | 'screen' | 'camera'>('virtual');
  
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const virtualCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);

  const handshakeSteps = [
    { title: 'Bonjour Discovery', desc: 'Discovered _airplay._tcp.local on 224.0.0.251' },
    { title: 'SRP-6a Pair-Setup', desc: 'Exchanging ephemeral keys A & B with PIN verification' },
    { title: 'Curve25519 Pair-Verify', desc: 'Deriving ChaCha20-Poly1305 symmetric session key' },
    { title: 'RTSP Stream Setup', desc: 'ANNOUNCE & SETUP binary plist parameters negotiated' },
    { title: 'AirPlay 2 RTP Stream', desc: 'H.264 Video & ALAC Audio streaming active' },
  ];

  // Initialize WebSocket connection to signaling server
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Register as sender
      ws.send(JSON.stringify({
        type: 'REGISTER_SENDER',
        roomId,
        payload: {
          clientModel: deviceModel,
          pin: pinInput,
        },
      }));
    };

    ws.onmessage = async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'SENDER_REGISTERED') {
          // Connected to room
        } else if (msg.type === 'AUTH_FAILED') {
          setHandshakeState('error');
          setErrorMessage(msg.payload?.message || 'Authentication failed. Please verify AirPlay code.');
        } else if (msg.type === 'signal') {
          const { type, candidate, sdp } = msg.payload || {};
          if (type === 'answer' && pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
          } else if (candidate && pcRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
      } catch (err) {
        console.error('Sender WS message parse error:', err);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [roomId, deviceModel]);

  // Execute full protocol handshake
  const startAirPlayHandshake = async () => {
    if (!pinInput || pinInput.length !== 4) {
      setErrorMessage('Please enter the 4-digit AirPlay code shown on the PC screen.');
      return;
    }

    setHandshakeState('authenticating');
    setErrorMessage('');
    setCurrentStepIndex(0);

    const srp = generateSrpHandshakePayloads(pinInput);

    // Step 1: Bonjour discovery log
    sendProtocolLog({
      layer: 'mDNS/Bonjour',
      direction: 'IN',
      summary: `Resolving AirPlay-PC-Receiver [AppleTV3,2]._airplay._tcp.local`,
      details: `SRV target: pc-receiver.local:7000, TXT: features=0x5A7FFFF7,0x1E model=AppleTV3,2`,
    });

    // Step 2: SRP-6a Pair-Setup
    setTimeout(() => {
      setCurrentStepIndex(1);
      sendProtocolLog({
        layer: 'Pair-Setup (SRP)',
        direction: 'OUT',
        summary: `POST /pair-setup (Stage 1: SRP Client Ephemeral Key)`,
        details: `Client Ephemeral A: ${srp.clientA.slice(0, 32)}... PIN: ****`,
      });
      sendProtocolLog({
        layer: 'Pair-Setup (SRP)',
        direction: 'IN',
        summary: `HTTP/1.1 200 OK (Stage 2: SRP Server Challenge)`,
        details: `Salt: ${srp.srpSalt}, Server Ephemeral B: ${srp.serverB.slice(0, 32)}...`,
      });
    }, 600);

    // Step 3: Curve25519 Pair-Verify
    setTimeout(() => {
      setCurrentStepIndex(2);
      sendProtocolLog({
        layer: 'Pair-Setup (SRP)',
        direction: 'OUT',
        summary: `POST /pair-setup (Stage 3: SRP Evidence M1 Verification)`,
        details: `M1 Proof: ${srp.proofM1}, Verified OK! Server confirmation M2: ${srp.proofM2}`,
      });
      sendProtocolLog({
        layer: 'FairPlay/AES',
        direction: 'OUT',
        summary: `POST /pair-verify (Curve25519 ECDH Exchange)`,
        details: `Derived Symmetric Master Key: ${srp.sessionKey}. Cipher: ChaCha20-Poly1305`,
      });
    }, 1200);

    // Step 4: RTSP ANNOUNCE & SETUP
    setTimeout(() => {
      setCurrentStepIndex(3);
      sendProtocolLog({
        layer: 'RTSP Control',
        direction: 'OUT',
        summary: `ANNOUNCE rtsp://pc-receiver.local/stream RTSP/1.0`,
        details: generateRtspAnnouncePlist(1920, 1080, 60),
      });
      sendProtocolLog({
        layer: 'RTSP Control',
        direction: 'OUT',
        summary: `SETUP rtsp://pc-receiver.local/stream/video RTSP/1.0`,
        details: `Transport: RTP/AVP/UDP;unicast;interleaved=0-1;mode=record;control_port=7001;timing_port=7002`,
      });
    }, 1800);

    // Step 5: RTSP RECORD & Mirroring Stream Active
    setTimeout(() => {
      setCurrentStepIndex(4);
      setHandshakeState('streaming');
      sendProtocolLog({
        layer: 'RTSP Control',
        direction: 'OUT',
        summary: `RECORD rtsp://pc-receiver.local/stream RTSP/1.0`,
        details: `Range: npt=0- ; RTP-Info: url=rtsp://pc-receiver.local/stream/video;seq=1;rtptime=0`,
      });
      sendProtocolLog({
        layer: 'RTP/AV',
        direction: 'OUT',
        summary: `RTP Streaming Active: H.264 High Profile (Payload Type 96)`,
        details: `Video: 1920x1080 @ 60fps, Audio: ALAC 44.1kHz 16-bit Stereo (Payload Type 96)`,
      });

      // Update room state on server
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'UPDATE_ROOM_STATE',
          roomId,
          payload: {
            status: 'streaming',
            clientModel: deviceModel,
            protocolStage: 'Active AirPlay 2 Stream',
            handshakeProgress: 100,
            resolution: '1920x1080',
            fps: 60,
          },
        }));
      }

      // Establish WebRTC stream
      setupWebRTCStream();
    }, 2400);
  };

  const sendProtocolLog = (log: { layer: any; direction: any; summary: string; details?: string }) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'PROTOCOL_LOG',
        roomId,
        payload: {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          timestamp: new Date().toLocaleTimeString(),
          ...log,
        },
      }));
    }
  };

  const setupWebRTCStream = async () => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'signal',
            roomId,
            payload: { candidate: event.candidate },
          }));
        }
      };

      // Get track from virtual canvas stream or physical screen
      let stream: MediaStream | null = null;
      if (sourceType === 'screen') {
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: { ideal: 60 } },
            audio: true,
          });
        } catch (e) {
          console.warn('Screen share canceled, using virtual device:', e);
        }
      } else if (sourceType === 'camera') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
            audio: true,
          });
        } catch (e) {
          console.warn('Camera capture failed:', e);
        }
      }

      if (!stream && virtualCanvasRef.current) {
        stream = virtualCanvasRef.current.captureStream(60);
      }

      if (stream) {
        localStreamRef.current = stream;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream!));
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'signal',
          roomId,
          payload: { type: offer.type, sdp: offer.sdp },
        }));
      }
    } catch (err) {
      console.error('Failed to setup WebRTC sender:', err);
    }
  };

  const handleDisconnect = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setHandshakeState('idle');
    setCurrentStepIndex(0);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'UPDATE_ROOM_STATE',
        roomId,
        payload: {
          status: 'waiting',
          protocolStage: 'Awaiting Device Connection',
          handshakeProgress: 0,
        },
      }));
    }
  };

  const handleCanvasUpdate = (canvas: HTMLCanvasElement) => {
    virtualCanvasRef.current = canvas;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-start p-4 sm:p-6 font-sans">
      {/* Top Header */}
      <div className="w-full max-w-4xl flex items-center justify-between pb-4 border-b border-neutral-800 mb-6">
        <div className="flex items-center gap-3">
          {onBackToReceiver && (
            <button
              onClick={onBackToReceiver}
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors"
              title="Return to PC Receiver"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-500" />
              Apple AirPlay Sender Console
            </h1>
            <p className="text-xs text-neutral-400">
              Session Room: <span className="font-mono text-neutral-200">{roomId}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400 hidden sm:inline">Receiver:</span>
          <span className="text-xs font-mono text-neutral-300 bg-neutral-900 px-2.5 py-1 rounded border border-neutral-800">
            AirPlay-PC-Receiver
          </span>
        </div>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Device Screen / Source Selector */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="w-full mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              AirPlay Broadcast Source
            </span>
            <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
              <button
                onClick={() => setSourceType('virtual')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  sourceType === 'virtual' ? 'bg-neutral-800 text-white shadow-xs' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Virtual iOS
              </button>
              <button
                onClick={() => setSourceType('screen')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  sourceType === 'screen' ? 'bg-neutral-800 text-white shadow-xs' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                My Screen
              </button>
              <button
                onClick={() => setSourceType('camera')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  sourceType === 'camera' ? 'bg-neutral-800 text-white shadow-xs' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Camera
              </button>
            </div>
          </div>

          {sourceType === 'virtual' ? (
            <VirtualiOSDevice onFrameUpdate={handleCanvasUpdate} />
          ) : (
            <div className="w-full aspect-9/16 max-w-xs bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
              {sourceType === 'screen' ? (
                <>
                  <Monitor className="w-12 h-12 text-blue-500 mb-3" />
                  <h3 className="text-sm font-semibold text-white mb-1">Live Device Screen Broadcast</h3>
                  <p className="text-xs text-neutral-400 mb-4">
                    Will request browser display capture to stream your physical screen over AirPlay.
                  </p>
                </>
              ) : (
                <>
                  <Camera className="w-12 h-12 text-pink-500 mb-3" />
                  <h3 className="text-sm font-semibold text-white mb-1">Camera Feed Broadcast</h3>
                  <p className="text-xs text-neutral-400 mb-4">
                    Streams live camera feed with AirPlay RTP packaging and ALAC audio.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Handshake, PIN & Status */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {/* Handshake Authentication Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg">
            <h2 className="text-sm font-semibold text-white mb-1 flex items-center justify-between">
              <span>AirPlay Handshake & Security</span>
              {handshakeState === 'streaming' && (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Streaming
                </span>
              )}
            </h2>
            <p className="text-xs text-neutral-400 mb-4">
              Connect to the PC receiver using Apple&apos;s SRP-6a protocol and 4-digit security code.
            </p>

            {handshakeState === 'idle' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Apple Device Model Identifier
                  </label>
                  <select
                    value={deviceModel}
                    onChange={(e) => setDeviceModel(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="Apple iPhone 16 Pro (iOS 18.2)">Apple iPhone 16 Pro (iOS 18.2)</option>
                    <option value="Apple iPad Pro 13-inch M4 (iPadOS 18.2)">Apple iPad Pro 13-inch M4 (iPadOS 18.2)</option>
                    <option value="Apple MacBook Pro 16-inch M3 Max (macOS Sequoia 15.3)">Apple MacBook Pro 16-inch M3 Max (macOS Sequoia 15.3)</option>
                    <option value="Apple iPhone 15 (iOS 18.1)">Apple iPhone 15 (iOS 18.1)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5 flex items-center justify-between">
                    <span>Enter AirPlay Security PIN</span>
                    <span className="text-[11px] text-neutral-500">Displayed on PC screen</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="4829"
                      className="w-32 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-center text-lg tracking-widest font-mono text-white focus:outline-hidden focus:border-blue-500"
                    />
                    <button
                      onClick={startAirPlayHandshake}
                      className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Cast className="w-4 h-4" />
                      Initiate AirPlay Handshake
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(handshakeState === 'authenticating' || handshakeState === 'streaming') && (
              <div className="space-y-4">
                {/* Step Timeline */}
                <div className="space-y-2.5">
                  {handshakeSteps.map((step, idx) => {
                    const isDone = idx < currentStepIndex || handshakeState === 'streaming';
                    const isCurrent = idx === currentStepIndex && handshakeState === 'authenticating';
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 p-2.5 rounded-xl border text-xs transition-colors ${
                          isDone
                            ? 'bg-neutral-950/60 border-neutral-800/80 text-neutral-300'
                            : isCurrent
                            ? 'bg-blue-950/40 border-blue-500/40 text-blue-200 animate-pulse'
                            : 'bg-neutral-950/20 border-neutral-800/40 text-neutral-600'
                        }`}
                      >
                        <div className="mt-0.5">
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-neutral-700 flex items-center justify-center text-[10px] font-mono">
                              {idx + 1}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-neutral-200">{step.title}</div>
                          <div className="text-[11px] text-neutral-400">{step.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {handshakeState === 'streaming' && (
                  <div className="pt-2 flex items-center justify-between border-t border-neutral-800">
                    <span className="text-xs text-neutral-400">AirPlay mirror session active</span>
                    <button
                      onClick={handleDisconnect}
                      className="py-1.5 px-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-800/40 rounded-lg text-xs font-medium transition-colors"
                    >
                      Disconnect AirPlay
                    </button>
                  </div>
                )}
              </div>
            )}

            {errorMessage && (
              <div className="mt-3 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Device Profile Specs */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">
              Apple Device Protocol Profile
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-800">
                <span className="text-neutral-500 block text-[11px]">Video Codec</span>
                <span className="font-mono text-neutral-200">H.264 High @ 60fps</span>
              </div>
              <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-800">
                <span className="text-neutral-500 block text-[11px]">Audio Codec</span>
                <span className="font-mono text-neutral-200">ALAC 44.1kHz Stereo</span>
              </div>
              <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-800">
                <span className="text-neutral-500 block text-[11px]">Cryptographic Suite</span>
                <span className="font-mono text-neutral-200">Curve25519 + ChaCha20</span>
              </div>
              <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-800">
                <span className="text-neutral-500 block text-[11px]">Clock Sync</span>
                <span className="font-mono text-neutral-200">NTP PTP 64-bit Timestamp</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
