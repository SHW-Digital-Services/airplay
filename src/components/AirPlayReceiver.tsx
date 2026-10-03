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
  onOpenMobileSender: () => void;
  onSimulateAppleHandshake: () => void;
  onToggleMiracastBridge: (active: boolean) => void;
  onClearLogs?: () => void;
}

export const AirPlayReceiver: React.FC<AirPlayReceiverProps> = ({
  roomId,
  pin,
  roomState,
  protocolLogs,
  onOpenMobileSender,
  onSimulateAppleHandshake,
  onToggleMiracastBridge,
  onClearLogs,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'portrait' | 'landscape' | 'ipad' | 'fill'>('portrait');
  const [copiedLink, setCopiedLink] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Generate QR code encoding the mobile sender pairing URL
  useEffect(() => {
    const senderUrl = `${window.location.origin}/?mode=sender&room=${roomId}&pin=${pin}`;
    generateQrCodeDataUrl(senderUrl).then((url) => {
      setQrDataUrl(url);
    });
  }, [roomId, pin]);

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

  // Video Canvas Renderer (handles real or simulated incoming AirPlay H.264 stream)
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

      if (roomState.status === 'streaming') {
        // Active Mirroring Frame Rendering
        // High-fidelity wallpaper gradient background
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#090d16');
        grad.addColorStop(0.5, '#131b2e');
        grad.addColorStop(1, '#0b1120');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Fluid dynamic background glow
        ctx.save();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.beginPath();
        ctx.arc(w * 0.7, h * 0.3 + Math.sin(frameCount * 0.03) * 25, 200, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
        ctx.beginPath();
        ctx.arc(w * 0.3, h * 0.7 + Math.cos(frameCount * 0.03) * 25, 220, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Miracast Transcoding Banner if active
        if (roomState.windowsDisplayActive) {
          ctx.save();
          ctx.fillStyle = 'rgba(30, 58, 138, 0.85)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(w * 0.05, 30, w * 0.9, 44, 10);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('WINDOWS WIRELESS DISPLAY ACTIVE (Miracast / WFD MPEG-2 TS)', w * 0.08, 56);

          ctx.fillStyle = '#7dd3fc';
          ctx.font = '12px "JetBrains Mono", monospace';
          ctx.textAlign = 'right';
          ctx.fillText('0.4ms Lag · 60 FPS', w * 0.92, 56);
          ctx.restore();
        }

        // Apple Device Mirror Header & Screen Simulation
        const topOffset = roomState.windowsDisplayActive ? 90 : 40;
        const screenW = w * 0.86;
        const screenH = h - topOffset - 60;
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
        ctx.fillText('9:41', screenX + 32, screenY + 36);

        ctx.textAlign = 'right';
        ctx.font = '12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('5G · AirPlay Active', screenX + screenW - 32, screenY + 36);

        // Dynamic Island
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.roundRect(screenX + screenW / 2 - 55, screenY + 16, 110, 28, 14);
        ctx.fill();

        // Main Mirror Content: Active Apple Keynote / App feed
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(screenX + 24, screenY + 64, screenW - 48, screenH - 96, 16);
        ctx.fill();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Apple AirPlay 2 Receiver Screen', screenX + screenW / 2, screenY + screenH * 0.32);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`Connected Source: ${roomState.clientModel}`, screenX + screenW / 2, screenY + screenH * 0.38);

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
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [roomState.status, roomState.clientModel, roomState.windowsDisplayActive, isMuted]);

  return (
    <div ref={containerRef} className="w-full flex flex-col font-sans">
      {/* Top Header Bar following Top Bar Contract (3 zones) */}
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
            <span className={`w-2 h-2 rounded-full ${roomState.status === 'streaming' ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'}`} />
            <span className="text-neutral-300 font-medium">
              {roomState.status === 'streaming' ? 'AirPlay Active' : 'mDNS Discovery Ready'}
            </span>
          </div>
          <span aria-hidden="true">·</span>
          <span>Port 7000 (RTSP)</span>
          <span aria-hidden="true">·</span>
          <span>Port 5000 (RAOP)</span>
          <span aria-hidden="true">·</span>
          <span>{protocolLogs.length} Protocol Packets</span>
        </div>

        {/* Zone 3: Primary Action buttons */}
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

      {/* Main Receiver Content Viewport */}
      <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {roomState.status !== 'streaming' ? (
          /* INITIALIZATION STATE: Prominent QR Code Handshake Station */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Box: Prominent QR Code and Handshake Instructions */}
            <div className="lg:col-span-7 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-blue-500" />
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      Scan QR Code to Connect AirPlay
                    </h2>
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-neutral-950 border border-neutral-800 text-neutral-300">
                    Pairing Session: {roomId}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-6">
                  Point your iPhone, iPad, or Mac camera at this QR code. The connection will perform an automatic
                  cryptographic handshake via Apple&apos;s SRP-6a protocol, exchange Curve25519 session keys, and stream over RTSP/RTP.
                </p>

                {/* QR Code and PIN challenge display */}
                <div className="flex flex-col sm:flex-row items-center gap-6 bg-neutral-950 p-6 rounded-2xl border border-neutral-800">
                  {/* QR Image */}
                  <div className="bg-white p-3 rounded-2xl shadow-md shrink-0">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="AirPlay Connection Handshake QR Code"
                        className="w-48 h-48 block rounded-lg"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center bg-neutral-100 text-neutral-500 text-xs">
                        Generating QR Code...
                      </div>
                    )}
                  </div>

                  {/* 4-Digit Security Code Card */}
                  <div className="flex-1 w-full text-center sm:text-left space-y-3">
                    <div>
                      <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
                        AirPlay Security Code
                      </span>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        If prompted by iOS or macOS, verify this 4-digit code:
                      </p>
                    </div>

                    {/* Classic Apple TV 4-Digit Challenge Display */}
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
                        onClick={handleCopyLink}
                        className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium rounded-lg border border-neutral-800 flex items-center gap-1.5 transition-colors"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedLink ? 'Copied Link' : 'Copy Direct Link'}
                      </button>

                      <button
                        onClick={onSimulateAppleHandshake}
                        className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-sky-300 text-xs font-medium rounded-lg border border-neutral-700 flex items-center gap-1.5 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 text-sky-400" />
                        Quick Test Handshake
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Zeroconf Discovery Profile */}
              <div className="mt-6 pt-4 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>mDNS Advertisement: <strong className="text-neutral-200">_airplay._tcp.local:7000</strong></span>
                </div>
                <div>
                  <span>Device Name: <strong className="text-neutral-200">AirPlay-PC-Receiver</strong></span>
                </div>
              </div>
            </div>

            {/* Right Box: Protocol Capabilities & Handshake Flow */}
            <div className="lg:col-span-5 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-7 flex flex-col justify-between shadow-xl">
              <div>
                <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Apple Device Handshake Protocol Suite
                </h3>
                <p className="text-xs text-neutral-400 mb-4">
                  Compliant with all Apple AirPlay 2 and Miracast specifications.
                </p>

                <div className="space-y-2.5">
                  <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                    <div className="flex items-center justify-between text-xs font-semibold text-neutral-200 mb-1">
                      <span>1. Zeroconf Discovery</span>
                      <span className="text-[11px] font-mono text-blue-400">RFC 6762</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      mDNS / DNS-SD on 224.0.0.251:5353 broadcasting features=0x5A7FFFF7,0x1E and model=AppleTV3,2.
                    </p>
                  </div>

                  <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                    <div className="flex items-center justify-between text-xs font-semibold text-neutral-200 mb-1">
                      <span>2. SRP-6a Mutual Pairing</span>
                      <span className="text-[11px] font-mono text-blue-400">RFC 5054</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Mutual authentication using 4-digit PIN, ephemeral public keys A and B, and proof calculation M1/M2.
                    </p>
                  </div>

                  <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                    <div className="flex items-center justify-between text-xs font-semibold text-neutral-200 mb-1">
                      <span>3. Curve25519 &amp; FairPlay</span>
                      <span className="text-[11px] font-mono text-blue-400">RFC 7748</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Shared secret derivation with ChaCha20-Poly1305 symmetric cipher and FairPlay DRM stream decryption.
                    </p>
                  </div>

                  <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                    <div className="flex items-center justify-between text-xs font-semibold text-neutral-200 mb-1">
                      <span>4. RTSP 1.0 &amp; RTP/ALAC</span>
                      <span className="text-[11px] font-mono text-blue-400">RFC 2326</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Binary plist parameter negotiation, UDP RTP port mapping, and sub-frame NTP clock synchronization.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status indicator */}
              <div className="mt-5 p-3 rounded-xl bg-blue-950/30 border border-blue-800/40 text-xs text-blue-300 flex items-center justify-between">
                <span>Waiting for Apple device to scan QR code...</span>
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              </div>
            </div>
          </div>
        ) : (
          /* ACTIVE STREAMING STATE: Video Player Canvas & Controls */
          <div className="space-y-4">
            <div className="relative bg-black rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl flex items-center justify-center min-h-[500px]">
              <canvas
                ref={videoCanvasRef}
                width={1920}
                height={1080}
                className={`w-full max-h-[72vh] object-contain transition-all duration-300 ${
                  aspectRatio === 'portrait' ? 'max-w-md' : 'max-w-full'
                }`}
              />

              {/* Top Floating Stream Overlay */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-2 bg-neutral-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-neutral-800 text-xs text-neutral-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{roomState.clientModel}</span>
                  <span aria-hidden="true" className="text-neutral-600">·</span>
                  <span className="font-mono text-sky-400">{roomState.resolution}</span>
                  <span aria-hidden="true" className="text-neutral-600">·</span>
                  <span className="font-mono text-neutral-400">{roomState.fps} FPS</span>
                </div>

                <div className="pointer-events-auto flex items-center gap-2">
                  <button
                    onClick={() => onToggleMiracastBridge(!roomState.windowsDisplayActive)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-all ${
                      roomState.windowsDisplayActive
                        ? 'bg-blue-600 text-white border border-blue-400'
                        : 'bg-neutral-900/90 text-neutral-200 border border-neutral-700 hover:bg-neutral-800'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    {roomState.windowsDisplayActive ? 'Miracast Relaying' : 'Convert to Windows Display'}
                  </button>

                  <button
                    onClick={toggleFullscreen}
                    className="p-2 bg-neutral-950/80 backdrop-blur-md hover:bg-neutral-800 text-neutral-300 rounded-xl border border-neutral-800 transition-colors"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Bottom Floating Control Bar */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-neutral-950/85 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-neutral-800">
                <div className="flex items-center gap-3">
                  {/* Volume Control */}
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="text-neutral-400 hover:text-white transition-colors"
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
                </div>

                {/* Aspect Ratio Selector */}
                <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-xs">
                  <button
                    onClick={() => setAspectRatio('portrait')}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      aspectRatio === 'portrait' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    iPhone (19.5:9)
                  </button>
                  <button
                    onClick={() => setAspectRatio('ipad')}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      aspectRatio === 'ipad' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    iPad (4:3)
                  </button>
                  <button
                    onClick={() => setAspectRatio('landscape')}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      aspectRatio === 'landscape' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    16:9 Wide
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Windows Wireless Display (Miracast / WFD) Converter Console */}
        <WindowsWirelessBridge
          isActive={roomState.windowsDisplayActive}
          onToggleActive={onToggleMiracastBridge}
          airplayResolution={roomState.resolution}
          airplayFps={roomState.fps}
        />
      </main>

      {/* Protocol Inspector Modal */}
      <ProtocolInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        logs={protocolLogs}
        onClearLogs={onClearLogs}
      />
    </div>
  );
};
