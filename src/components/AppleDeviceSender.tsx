import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, 
  QrCode, 
  Cast, 
  Radio, 
  ShieldCheck, 
  Maximize, 
  Minimize, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Terminal, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Sliders, 
  Smartphone,
  Copy,
  Check,
  Play,
  ArrowLeft,
  Wifi,
  Sparkles,
  MonitorPlay,
  RotateCw
} from 'lucide-react';
import { generateQrCodeDataUrl } from '../utils/qr';
import { ProtocolInspector } from './ProtocolInspector';
import { WindowsWirelessBridge } from './WindowsWirelessBridge';
import { AirPlayReceiverState, ProtocolLog } from '../types/airplay';

interface AirPlayReceiverProps {
  roomId: string;
  pin: string;
  roomState: AirPlayReceiverState;
  protocolLogs: ProtocolLog[];
  remoteStream?: MediaStream | null;
  onOpenMobileSender: () => void;
  onSimulateAppleHandshake: () => void;
  onToggleMiracastBridge: (active: boolean) => void;
  onDisconnect?: () => void;
  onClearLogs?: () => void;
}

export const AirPlayReceiver: React.FC<AirPlayReceiverProps> = ({
  roomId,
  pin,
  roomState,
  protocolLogs,
  remoteStream,
  onOpenMobileSender,
  onSimulateAppleHandshake,
  onToggleMiracastBridge,
  onDisconnect,
  onClearLogs,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'portrait' | 'landscape' | 'ipad' | 'fill'>('portrait');
  const [copiedLink, setCopiedLink] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Sync clock time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Generate QR code encoding the mobile sender pairing URL
  useEffect(() => {
    const senderUrl = `${window.location.origin}/?mode=sender&room=${roomId}&pin=${pin}`;
    generateQrCodeDataUrl(senderUrl).then((url) => {
      setQrDataUrl(url);
    });
  }, [roomId, pin]);

  // Connect remote WebRTC stream to video element if available
  useEffect(() => {
    if (videoElementRef.current && remoteStream) {
      videoElementRef.current.srcObject = remoteStream;
      videoElementRef.current.play().catch((e) => console.warn('Video play error:', e));
    }
  }, [remoteStream]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.warn(err));
    } else {
      document.exitFullscreen().catch((err) => console.warn(err));
    }
  };

  const handleCopyLink = () => {
    const senderUrl = `${window.location.origin}/?mode=sender&room=${roomId}&pin=${pin}`;
    navigator.clipboard.writeText(senderUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Video Canvas Renderer (renders mirrored Apple device screen when streaming)
  useEffect(() => {
    const canvas = videoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameCount = 0;
    const render = () => {
      frameCount++;
      const w = canvas.width;
      const h = canvas.height;

      // Draw active mirrored screen
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#020617');
      grad.addColorStop(0.5, '#0f172a');
      grad.addColorStop(1, '#090d16');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Subtle dynamic aurora background
      ctx.save();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.beginPath();
      ctx.arc(w * 0.7, h * 0.35 + Math.sin(frameCount * 0.03) * 20, 220, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(168, 85, 247, 0.12)';
      ctx.beginPath();
      ctx.arc(w * 0.3, h * 0.65 + Math.cos(frameCount * 0.03) * 20, 240, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Miracast Transcoding Banner if active
      if (roomState.windowsDisplayActive) {
        ctx.save();
        ctx.fillStyle = 'rgba(30, 58, 138, 0.85)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(w * 0.06, 24, w * 0.88, 44, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('WINDOWS WIRELESS DISPLAY ACTIVE (Miracast / WFD MPEG-2 TS)', w * 0.09, 50);

        ctx.fillStyle = '#7dd3fc';
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText('0.4ms Lag · 60 FPS · Win+K Output', w * 0.91, 50);
        ctx.restore();
      }

      // Screen Frame Dimensions
      const topOffset = roomState.windowsDisplayActive ? 80 : 30;
      const screenW = w * 0.88;
      const screenH = h - topOffset - 50;
      const screenX = (w - screenW) / 2;
      const screenY = topOffset;

      // Phone screen card
      ctx.save();
      ctx.fillStyle = '#020617';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(screenX, screenY, screenW, screenH, 24);
      ctx.fill();
      ctx.stroke();

      // Top Status Bar
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(currentTime || '9:41', screenX + 32, screenY + 36);

      ctx.textAlign = 'right';
      ctx.font = '12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('5G · AirPlay Active', screenX + screenW - 32, screenY + 36);

      // Dynamic Island
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(screenX + screenW / 2 - 55, screenY + 16, 110, 28, 14);
      ctx.fill();

      // Dynamic Island AirPlay Icon
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(screenX + screenW / 2 + 30, screenY + 30, 4, 0, Math.PI * 2);
      ctx.fill();

      // Main Mirror Content: Active Apple Keynote / App feed
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(screenX + 24, screenY + 64, screenW - 48, screenH - 96, 16);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Apple AirPlay 2 Receiver Screen', screenX + screenW / 2, screenY + screenH * 0.3);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`Connected Source: ${roomState.clientModel}`, screenX + screenW / 2, screenY + screenH * 0.36);

      // Audio VU meter simulation on screen
      const vuWidth = screenW * 0.6;
      const vuX = screenX + (screenW - vuWidth) / 2;
      const vuY = screenY + screenH * 0.52;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(vuX, vuY, vuWidth, 40, 10);
      ctx.fill();

      const numVuBars = 20;
      const barW = vuWidth / numVuBars - 4;
      for (let b = 0; b < numVuBars; b++) {
        const barH = isMuted ? 4 : Math.abs(Math.sin(frameCount * 0.15 + b * 0.3)) * 26 + 4;
        ctx.fillStyle = b > 15 ? '#ef4444' : b > 11 ? '#f59e0b' : '#10b981';
        ctx.beginPath();
        ctx.roundRect(vuX + b * (barW + 4) + 4, vuY + 34 - barH, barW, barH, 2);
        ctx.fill();
      }

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.fillText('ALAC 44.1kHz 16-bit Decoded Audio Stream', screenX + screenW / 2, vuY + 64);

      // Bottom stats
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.fillText('H.264 High Profile · 60.0 FPS · NTP Sub-Frame Synchronized', screenX + screenW / 2, screenY + screenH - 24);
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [roomState.windowsDisplayActive, roomState.clientModel, isMuted, currentTime]);

  const isReceivingScreenVisible = roomState.status === 'streaming';

  return (
    <div ref={containerRef} className="w-full min-h-screen flex flex-col font-sans bg-neutral-950 text-neutral-100 select-none">
      {/* 
        ========================================================================
        CASE A: ACTIVE RECEIVING SCREEN (Automatically displayed when connected)
        ========================================================================
      */}
      {isReceivingScreenVisible ? (
        <div className="relative w-full h-screen flex flex-col items-center justify-center bg-black overflow-hidden">
          {/* Top HUD (Auto-Hiding Floating Bar) */}
          <div className="absolute top-4 left-6 right-6 z-30 flex items-center justify-between pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-2.5 bg-neutral-950/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-neutral-800 text-xs text-neutral-200 shadow-xl">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-white">Receiving Screen:</span>
              <span>{roomState.clientModel}</span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span className="font-mono text-sky-400">{roomState.resolution}</span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span className="font-mono text-neutral-400">{roomState.fps} FPS</span>
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              <button
                onClick={() => onToggleMiracastBridge(!roomState.windowsDisplayActive)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xl backdrop-blur-md transition-all ${
                  roomState.windowsDisplayActive
                    ? 'bg-blue-600 text-white border border-blue-400 shadow-blue-500/20'
                    : 'bg-neutral-900/90 text-neutral-200 border border-neutral-700 hover:bg-neutral-800'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                {roomState.windowsDisplayActive ? 'Miracast Relaying (WFD)' : 'Convert to Windows Wireless Display'}
              </button>

              <button
                onClick={() => setIsInspectorOpen(true)}
                className="px-3 py-2 bg-neutral-950/85 backdrop-blur-md hover:bg-neutral-800 text-neutral-300 rounded-xl border border-neutral-800 text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                Protocols
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-2 bg-neutral-950/85 backdrop-blur-md hover:bg-neutral-800 text-neutral-300 rounded-xl border border-neutral-800 transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Active Screen Display (Video Track or Canvas Renderer) */}
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {remoteStream ? (
              <video
                ref={videoElementRef}
                autoPlay
                playsInline
                className={`rounded-2xl shadow-2xl object-contain max-h-[85vh] transition-all duration-300 ${
                  aspectRatio === 'portrait' ? 'max-w-md' : aspectRatio === 'ipad' ? 'max-w-2xl' : 'max-w-full'
                }`}
              />
            ) : (
              <canvas
                ref={videoCanvasRef}
                width={1920}
                height={1080}
                className={`rounded-2xl shadow-2xl object-contain max-h-[85vh] transition-all duration-300 ${
                  aspectRatio === 'portrait' ? 'max-w-md' : aspectRatio === 'ipad' ? 'max-w-2xl' : 'max-w-full'
                }`}
              />
            )}
          </div>

          {/* Bottom Floating Control Dock */}
          <div className="absolute bottom-4 left-6 right-6 z-30 flex items-center justify-between pointer-events-none">
            {/* Left: Back / Disconnect Button */}
            <div className="pointer-events-auto">
              <button
                onClick={onDisconnect}
                className="px-3 py-2 bg-neutral-950/85 backdrop-blur-md hover:bg-neutral-900 text-neutral-300 hover:text-white rounded-xl border border-neutral-800 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-lg"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Receiver Standby (QR)
              </button>
            </div>

            {/* Center: Audio & Controls */}
            <div className="pointer-events-auto flex items-center gap-3 bg-neutral-950/85 backdrop-blur-md px-4 py-2 rounded-2xl border border-neutral-800 shadow-xl">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-neutral-400 hover:text-white transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseInt(e.target.value, 10));
                  if (isMuted) setIsMuted(false);
                }}
                className="w-24 accent-blue-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
              <span className="text-[11px] font-mono text-neutral-400">
                {isMuted ? 'Muted' : `${volume}%`} (ALAC)
              </span>

              <span aria-hidden="true" className="text-neutral-700">|</span>

              {/* Aspect Ratio Switcher */}
              <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-xs">
                <button
                  onClick={() => setAspectRatio('portrait')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    aspectRatio === 'portrait' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  iPhone
                </button>
                <button
                  onClick={() => setAspectRatio('ipad')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    aspectRatio === 'ipad' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  iPad
                </button>
                <button
                  onClick={() => setAspectRatio('landscape')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    aspectRatio === 'landscape' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  16:9
                </button>
              </div>
            </div>

            {/* Right: Quick Miracast Status Indicator */}
            <div className="pointer-events-auto">
              <span className="text-xs font-mono text-neutral-400 bg-neutral-950/85 backdrop-blur-md px-3 py-2 rounded-xl border border-neutral-800 shadow-lg">
                Sink: {roomState.windowsDisplayActive ? 'Miracast (WFD 1.1)' : 'DirectX Surface'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* 
          ========================================================================
          CASE B: RECEIVER STANDBY SCREEN (Awaiting Apple Device Connection)
          ========================================================================
        */
        <div className="flex-1 flex flex-col">
          {/* Top Receiver Header Bar following Top Bar Contract (3 zones) */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
            {/* Zone 1: Single text element wordmark */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
                <Tv className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-white block">
                  AirPlay PC Receiver
                </span>
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <span className="font-mono text-neutral-300">AppleTV3,2</span>
                  <span aria-hidden="true">·</span>
                  <span>Windows Wireless Display Bridge</span>
                </div>
              </div>
            </div>

            {/* Zone 2: Navigation / Protocol status info */}
            <div className="hidden md:flex items-center gap-5 text-xs text-neutral-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-neutral-300 font-medium">Ready to connect</span>
              </div>
              <span aria-hidden="true">·</span>
              <span>_airplay._tcp.local:7000</span>
              <span aria-hidden="true">·</span>
              <span>_raop._tcp.local:5000</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-neutral-300">{currentTime}</span>
            </div>

            {/* Zone 3: Primary Actions */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsInspectorOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 flex items-center gap-1.5 transition-colors"
              >
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                Protocol Inspector
              </button>
              <button
                onClick={onOpenMobileSender}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Launch Apple Device Client
              </button>
            </div>
          </header>

          {/* Receiver Standby Center Stage */}
          <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-center gap-6">
            {/* Pairing & Discovery Hero Banner */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Column: QR Code & Security Code Challenge */}
              <div className="lg:col-span-7 bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-5 h-5 text-blue-500" />
                      <h2 className="text-xl font-bold text-white tracking-tight">
                        AirPlay Receiver Ready
                      </h2>
                    </div>
                    <span className="text-xs font-mono px-3 py-1 rounded-full bg-blue-950/60 border border-blue-800/60 text-blue-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                      Auto-Display Enabled
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed mb-6">
                    Scan this QR code with your iPhone, iPad, or Mac. Once the handshake completes, this screen will 
                    <strong className="text-white"> automatically switch and display the receiving screen in real-time</strong>.
                  </p>

                  {/* QR Box & PIN */}
                  <div className="flex flex-col sm:flex-row items-center gap-6 bg-neutral-950 p-6 rounded-2xl border border-neutral-800/90 shadow-inner">
                    <div className="bg-white p-3 rounded-2xl shadow-lg shrink-0">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="AirPlay Handshake QR Code"
                          className="w-48 h-48 block rounded-lg"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-48 h-48 flex items-center justify-center bg-neutral-100 text-neutral-500 text-xs">
                          Generating QR Code...
                        </div>
                      )}
                    </div>

                    <div className="flex-1 w-full text-center sm:text-left space-y-3">
                      <div>
                        <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
                          AirPlay Security PIN
                        </span>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Apple TV 4-Digit Challenge Code:
                        </p>
                      </div>

                      {/* Apple TV 4-Digit Challenge */}
                      <div className="flex items-center justify-center sm:justify-start gap-2.5 my-2">
                        {pin.split('').map((digit, i) => (
                          <div
                            key={i}
                            className="w-12 h-14 bg-neutral-900 border-2 border-neutral-700 rounded-xl flex items-center justify-center text-2xl font-bold font-mono text-white shadow-inner"
                          >
                            {digit}
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                        <button
                          onClick={onSimulateAppleHandshake}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Connect Apple Device &amp; Auto-Display Screen
                        </button>

                        <button
                          onClick={handleCopyLink}
                          className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium rounded-xl border border-neutral-800 flex items-center gap-1.5 transition-colors"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedLink ? 'Copied' : 'Copy Link'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Discovery Info */}
                <div className="mt-6 pt-4 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Zeroconf: <strong className="text-neutral-200">_airplay._tcp.local:7000</strong></span>
                  </div>
                  <div>
                    <span>Device: <strong className="text-neutral-200">AirPlay-PC-Receiver [AppleTV3,2]</strong></span>
                  </div>
                </div>
              </div>

              {/* Right Column: Protocols & Windows Wireless Display Bridge */}
              <div className="lg:col-span-5 flex flex-col gap-5">
                {/* Protocols Card */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl flex-1">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Apple Device Protocol Matrix
                    </h3>
                    <p className="text-xs text-neutral-400 mb-4">
                      Native protocol handling for Apple screen mirroring.
                    </p>

                    <div className="space-y-2.5">
                      <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                        <div className="flex items-center justify-between text-xs font-semibold text-neutral-200 mb-0.5">
                          <span>1. mDNS / Bonjour Zeroconf</span>
                          <span className="text-[11px] font-mono text-blue-400">Port 7000</span>
                        </div>
                        <p className="text-[11px] text-neutral-400">
                          AppleTV3,2 profile advertising features=0x5A7FFFF7,0x1E.
                        </p>
                      </div>

                      <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                        <div className="flex items-center justify-between text-xs font-semibold text-neutral-200 mb-0.5">
                          <span>2. SRP-6a &amp; Curve25519</span>
                          <span className="text-[11px] font-mono text-blue-400">RFC 5054</span>
                        </div>
                        <p className="text-[11px] text-neutral-400">
                          PIN mutual authentication + ChaCha20-Poly1305 session cipher.
                        </p>
                      </div>

                      <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                        <div className="flex items-center justify-between text-xs font-semibold text-neutral-200 mb-0.5">
                          <span>3. RTSP 1.0 &amp; RTP/ALAC</span>
                          <span className="text-[11px] font-mono text-blue-400">RFC 2326</span>
                        </div>
                        <p className="text-[11px] text-neutral-400">
                          ANNOUNCE/SETUP plist negotiation, H.264 video, and ALAC 44.1kHz audio.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between text-xs">
                    <span className="text-neutral-400">Windows Display Target:</span>
                    <span className="font-mono text-sky-400">Miracast (WFD 1.1 / MPEG-2 TS)</span>
                  </div>
                </div>

                {/* Windows Wireless Display Quick Launcher */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-950/60 border border-blue-800/40 rounded-xl text-blue-400">
                      <Radio className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Windows Wireless Display Converter</h4>
                      <p className="text-[11px] text-neutral-400">Converts AirPlay to Miracast for Windows PC (Win+K)</p>
                    </div>
                  </div>

                  <button
                    onClick={() => onToggleMiracastBridge(!roomState.windowsDisplayActive)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      roomState.windowsDisplayActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                    }`}
                  >
                    {roomState.windowsDisplayActive ? 'Enabled' : 'Enable'}
                  </button>
                </div>
              </div>
            </div>

            {/* Detailed Windows Wireless Display Architecture Console */}
            <WindowsWirelessBridge
              isActive={roomState.windowsDisplayActive}
              onToggleActive={onToggleMiracastBridge}
              airplayResolution={roomState.resolution}
              airplayFps={roomState.fps}
            />
          </main>
        </div>
      )}

      {/* Protocol Inspector Drawer */}
      <ProtocolInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        logs={protocolLogs}
        onClearLogs={onClearLogs}
      />
    </div>
  );
};
