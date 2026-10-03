import React, { useState, useEffect, useRef } from 'react';
import { 
  Wifi, 
  Battery, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  Cast, 
  ChevronRight, 
  Camera, 
  Image as ImageIcon, 
  Music, 
  MonitorPlay,
  RotateCw,
  Sliders
} from 'lucide-react';

interface VirtualiOSDeviceProps {
  onFrameUpdate?: (canvas: HTMLCanvasElement) => void;
  mode?: 'springboard' | 'photos' | 'music' | 'keynote';
  isPortrait?: boolean;
}

export const VirtualiOSDevice: React.FC<VirtualiOSDeviceProps> = ({
  onFrameUpdate,
  mode: initialMode = 'springboard',
  isPortrait = true,
}) => {
  const [currentApp, setCurrentApp] = useState<'springboard' | 'photos' | 'music' | 'keynote'>(initialMode);
  const [isPlayingMusic, setIsPlayingMusic] = useState(true);
  const [keynoteSlide, setKeynoteSlide] = useState(1);
  const [currentTime, setCurrentTime] = useState('9:41');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Sync clock time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Render virtual iOS screen to canvas for video capture/streaming
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let tick = 0;
    const render = () => {
      tick++;
      const width = canvas.width;
      const height = canvas.height;

      // Draw background
      if (currentApp === 'springboard') {
        // iOS 18 Wallpaper gradient
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#0a192f');
        grad.addColorStop(0.3, '#1e3a8a');
        grad.addColorStop(0.7, '#4338ca');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Subtle ambient light orbs
        ctx.save();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.beginPath();
        ctx.arc(width * 0.7, height * 0.3 + Math.sin(tick * 0.02) * 20, 160, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(236, 72, 153, 0.12)';
        ctx.beginPath();
        ctx.arc(width * 0.3, height * 0.7 + Math.cos(tick * 0.02) * 20, 180, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw app grid
        const apps = [
          { name: 'Photos', iconColor: '#f43f5e', letter: 'P' },
          { name: 'Music', iconColor: '#fa233b', letter: 'M' },
          { name: 'Keynote', iconColor: '#3b82f6', letter: 'K' },
          { name: 'Safari', iconColor: '#0284c7', letter: 'S' },
          { name: 'Camera', iconColor: '#64748b', letter: 'C' },
          { name: 'Settings', iconColor: '#94a3b8', letter: '⚙' },
          { name: 'Maps', iconColor: '#10b981', letter: 'M' },
          { name: 'Calendar', iconColor: '#ef4444', letter: '28' },
        ];

        const startY = height * 0.22;
        const colWidth = width / 4;
        apps.forEach((app, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const x = col * colWidth + colWidth / 2;
          const y = startY + row * 88;

          // App icon container
          ctx.save();
          ctx.fillStyle = app.iconColor;
          ctx.beginPath();
          ctx.roundRect(x - 28, y - 28, 56, 56, 14);
          ctx.fill();

          // Icon glyph
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(app.letter, x, y);

          // App label
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = '11px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(app.name, x, y + 42);
          ctx.restore();
        });

        // AirPlay Active Pill Widget
        ctx.save();
        ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(width * 0.1, height * 0.52, width * 0.8, 70, 18);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('AIRPLAY SCREEN MIRRORING ACTIVE', width * 0.15, height * 0.55);

        ctx.fillStyle = '#f8fafc';
        ctx.font = '14px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('AirPlay-PC-Receiver [AppleTV3,2]', width * 0.15, height * 0.585);

        // Animated broadcast signal waves
        const waveX = width * 0.82;
        const waveY = height * 0.565;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(waveX, waveY, 8 + (tick % 30) * 0.5, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(waveX, waveY, 14 + (tick % 30) * 0.5, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();
        ctx.restore();

        // Dock
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.beginPath();
        ctx.roundRect(width * 0.08, height - 90, width * 0.84, 72, 24);
        ctx.fill();
        ctx.restore();
      } else if (currentApp === 'music') {
        // Apple Music Now Playing Interface
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);

        // Dynamic album art glow
        const glow = ctx.createRadialGradient(width / 2, height * 0.4, 20, width / 2, height * 0.4, 240);
        glow.addColorStop(0, 'rgba(244, 63, 94, 0.35)');
        glow.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

        // Album artwork box
        ctx.save();
        ctx.fillStyle = '#1e1b4b';
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(width * 0.15, height * 0.22, width * 0.7, width * 0.7, 16);
        ctx.fill();
        ctx.stroke();

        // Inner album artwork design
        const artGrad = ctx.createLinearGradient(width * 0.15, height * 0.22, width * 0.85, height * 0.22 + width * 0.7);
        artGrad.addColorStop(0, '#e11d48');
        artGrad.addColorStop(0.5, '#7c3aed');
        artGrad.addColorStop(1, '#2563eb');
        ctx.fillStyle = artGrad;
        ctx.beginPath();
        ctx.roundRect(width * 0.18, height * 0.24, width * 0.64, width * 0.64, 12);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SOLAR DRIFT', width / 2, height * 0.22 + width * 0.35);
        ctx.font = '13px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText('Spatial Audio · Lossless ALAC', width / 2, height * 0.22 + width * 0.42);
        ctx.restore();

        // Song title and artist
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Cosmic Resonance', width * 0.15, height * 0.66);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '14px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Nova & Apple Lossless Ensemble', width * 0.15, height * 0.69);

        // Audio spectrum visualizer
        ctx.fillStyle = '#f43f5e';
        const numBars = 24;
        const barWidth = 6;
        const startX = width * 0.15;
        const baseY = height * 0.76;
        for (let b = 0; b < numBars; b++) {
          const barHeight = isPlayingMusic 
            ? Math.sin(tick * 0.1 + b * 0.4) * 16 + 20 + Math.random() * 8 
            : 4;
          ctx.beginPath();
          ctx.roundRect(startX + b * (barWidth + 4), baseY - barHeight, barWidth, barHeight, 3);
          ctx.fill();
        }

        // AirPlay Connected target indicator
        ctx.fillStyle = '#38bdf8';
        ctx.font = '12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('AirPlay 2: Audio Stream to PC Receiver (44.1kHz)', width * 0.15, height * 0.83);
        ctx.restore();
      } else if (currentApp === 'photos') {
        // Photos gallery view
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // Top photo header
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Library · Moments', width * 0.08, height * 0.12);

        // Photo grid
        const photoCols = 3;
        const photoSize = (width * 0.84) / photoCols;
        const colors = [
          '#0284c7', '#0d9488', '#16a34a', 
          '#d97706', '#dc2626', '#7c3aed', 
          '#db2777', '#475569', '#2563eb'
        ];

        colors.forEach((col, idx) => {
          const colIdx = idx % photoCols;
          const rowIdx = Math.floor(idx / photoCols);
          const px = width * 0.08 + colIdx * (photoSize + 4);
          const py = height * 0.16 + rowIdx * (photoSize + 4);

          ctx.save();
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.roundRect(px, py, photoSize, photoSize, 4);
          ctx.fill();

          // Subtle photo landscape simulation
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.beginPath();
          ctx.arc(px + photoSize * 0.3, py + photoSize * 0.35, photoSize * 0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        // AirPlay Cast indicator overlay
        ctx.save();
        ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(width * 0.08, height * 0.78, width * 0.84, 56, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '13px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Streaming High-Res 4K Slideshow to PC', width * 0.14, height * 0.815);
        ctx.restore();
      } else if (currentApp === 'keynote') {
        // Apple Keynote Presentation Slide Deck
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, width, height);

        // Slide canvas container
        const slideX = width * 0.06;
        const slideY = height * 0.18;
        const slideW = width * 0.88;
        const slideH = slideW * (9 / 16);

        ctx.save();
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(slideX, slideY, slideW, slideH, 10);
        ctx.fill();
        ctx.stroke();

        // Slide Content
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Apple Silicon & Wireless Streaming', slideX + 24, slideY + 40);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`Slide ${keynoteSlide} of 4 · AirPlay 2 Protocol Architecture`, slideX + 24, slideY + 64);

        // Bullet points
        const points = [
          '• Zeroconf mDNS advertising on _airplay._tcp.local:7000',
          '• SRP-6a PIN Challenge + Curve25519 Pair-Verify Handshake',
          '• Real-time RTSP/RTP Low Latency H.264 Video Pipeline',
          '• Miracast / Wi-Fi Display (WFD) Hardware Transcoder for Windows',
        ];

        points.forEach((p, pIdx) => {
          ctx.fillStyle = pIdx === keynoteSlide - 1 ? '#ffffff' : '#94a3b8';
          ctx.font = pIdx === keynoteSlide - 1 ? 'bold 12px "Plus Jakarta Sans", sans-serif' : '11px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(p, slideX + 24, slideY + 100 + pIdx * 24);
        });

        // Speaker notes
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Speaker Notes', width * 0.08, height * 0.58);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Explain how Windows PC receives the AirPlay stream and converts', width * 0.08, height * 0.61);
        ctx.fillText('it to Miracast / Wi-Fi Display for multi-monitor projection.', width * 0.08, height * 0.635);
        ctx.restore();
      }

      // Draw Top Status Bar & Dynamic Island
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(currentTime, width * 0.1, 32);

      // Icons on right
      ctx.textAlign = 'right';
      ctx.font = '12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('5G · 100%', width * 0.9, 32);

      // Dynamic Island pill
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(width / 2 - 50, 14, 100, 26, 13);
      ctx.fill();

      // Dynamic Island AirPlay icon indicator
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(width / 2 + 28, 27, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Home indicator bar at bottom
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.roundRect(width / 2 - 60, height - 12, 120, 4, 2);
      ctx.fill();
      ctx.restore();

      // Notify parent about frame update
      if (onFrameUpdate) {
        onFrameUpdate(canvas);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [currentApp, isPlayingMusic, keynoteSlide, currentTime, onFrameUpdate]);

  return (
    <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-xl max-w-sm w-full">
      {/* Device Frame */}
      <div className="relative rounded-[40px] p-2.5 bg-neutral-800 border-2 border-neutral-700 shadow-2xl overflow-hidden w-[300px]">
        {/* Screen Canvas */}
        <canvas
          ref={canvasRef}
          width={300}
          height={600}
          className="rounded-[32px] w-full block cursor-pointer bg-neutral-950"
          onClick={() => {
            if (currentApp === 'music') setIsPlayingMusic(!isPlayingMusic);
            if (currentApp === 'keynote') setKeynoteSlide((s) => (s % 4) + 1);
          }}
        />
      </div>

      {/* App Switcher for Interactive Demo */}
      <div className="mt-4 w-full flex items-center justify-between gap-1.5 p-1 bg-neutral-800 rounded-xl">
        <button
          onClick={() => setCurrentApp('springboard')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
            currentApp === 'springboard' ? 'bg-blue-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Home
        </button>
        <button
          onClick={() => setCurrentApp('music')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
            currentApp === 'music' ? 'bg-blue-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Music
        </button>
        <button
          onClick={() => setCurrentApp('photos')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
            currentApp === 'photos' ? 'bg-blue-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Photos
        </button>
        <button
          onClick={() => setCurrentApp('keynote')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
            currentApp === 'keynote' ? 'bg-blue-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Keynote
        </button>
      </div>

      <p className="mt-2 text-xs text-neutral-400 text-center">
        Tap simulated iPhone screen or buttons above to change active broadcast content.
      </p>
    </div>
  );
};
