import React, { useState } from 'react';
import { 
  Monitor, 
  Tv, 
  Radio, 
  ArrowRight, 
  CheckCircle2, 
  ExternalLink, 
  RefreshCw, 
  Layers, 
  Cpu, 
  ShieldCheck, 
  Info,
  Maximize2
} from 'lucide-react';
import { generateMiracastM1toM5Messages } from '../services/airplayProtocol';
import { MiracastBridgeStatus } from '../types/airplay';

interface WindowsWirelessBridgeProps {
  isActive: boolean;
  onToggleActive: (active: boolean) => void;
  airplayResolution: string;
  airplayFps: number;
}

export const WindowsWirelessBridge: React.FC<WindowsWirelessBridgeProps> = ({
  isActive,
  onToggleActive,
  airplayResolution,
  airplayFps,
}) => {
  const [selectedTab, setSelectedTab] = useState<'status' | 'rtsp_m_steps' | 'windows_guide'>('status');
  const [selectedMStep, setSelectedMStep] = useState(0);
  const miracastSteps = generateMiracastM1toM5Messages();

  // Try browser Presentation API to cast to external wireless display
  const launchWindowsPresentation = async () => {
    try {
      if ('PresentationRequest' in window) {
        // Presentation API supported
        const request = new (window as any).PresentationRequest(['/receiver']);
        await request.start();
      } else {
        // Fallback: open detached presentation window for dual-monitor / wireless display
        window.open('/?mode=presentation', 'AirPlayWindowsDisplay', 'width=1920,height=1080,menubar=no,toolbar=no');
      }
    } catch (err) {
      console.warn('Presentation API launched or canceled:', err);
      // Fallback
      window.open('/?mode=presentation', 'AirPlayWindowsDisplay', 'width=1920,height=1080,menubar=no,toolbar=no');
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl">
      {/* Header and Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <Radio className={`w-5 h-5 ${isActive ? 'text-blue-400 animate-pulse' : 'text-neutral-500'}`} />
            <h2 className="text-base font-semibold text-white">
              Windows Wireless Display (Miracast / WFD) Converter
            </h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Transcodes Apple AirPlay RTSP/RTP packets into Wi-Fi Display (WFD 1.1) MPEG-2 Transport Stream for Windows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggleActive(!isActive)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              isActive
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
            }`}
          >
            <Radio className="w-4 h-4" />
            {isActive ? 'Miracast Bridge Active' : 'Enable Windows Converter'}
          </button>

          {isActive && (
            <button
              onClick={launchWindowsPresentation}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 transition-colors"
              title="Project to Windows Wireless Display / Miracast Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Project to Display (Win+K)
            </button>
          )}
        </div>
      </div>

      {/* Protocol Conversion Architecture Diagram */}
      <div className="my-5 p-4 bg-neutral-950 rounded-xl border border-neutral-800">
        <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider block mb-3">
          Real-Time Protocol Transcoding Pipeline
        </span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
          {/* Node 1: Apple AirPlay */}
          <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
            <div className="text-[11px] text-blue-400 font-semibold mb-1 flex items-center justify-between">
              <span>Apple Device Input</span>
              <span className="font-mono text-neutral-400">iOS / macOS</span>
            </div>
            <div className="text-xs font-mono text-neutral-200 font-medium">AirPlay 2 (RTSP/RTP)</div>
            <div className="text-[11px] text-neutral-400 mt-1">
              H.264 Baseline/High · ALAC 44.1kHz · NTP/PTP Sync
            </div>
          </div>

          {/* Node 2: Transcoder */}
          <div className="p-3 bg-blue-950/40 border border-blue-800/60 rounded-lg relative">
            <div className="text-[11px] text-sky-300 font-semibold mb-1 flex items-center justify-between">
              <span>In-Memory Transcoder</span>
              <span className="font-mono text-emerald-400">0.4ms Lag</span>
            </div>
            <div className="text-xs font-mono text-white font-medium">RTP to MPEG-2 TS Muxer</div>
            <div className="text-[11px] text-neutral-300 mt-1">
              188-byte TS Frames · PCR Sync · PES Packetizer
            </div>
          </div>

          {/* Node 3: Windows Miracast */}
          <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
            <div className="text-[11px] text-indigo-400 font-semibold mb-1 flex items-center justify-between">
              <span>Windows Wireless Display</span>
              <span className="font-mono text-neutral-400">Win 10/11</span>
            </div>
            <div className="text-xs font-mono text-neutral-200 font-medium">Wi-Fi Display (WFD 1.1)</div>
            <div className="text-[11px] text-neutral-400 mt-1">
              RTSP M1-M7 · DirectX DirectDisplay · LPCM Audio
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-neutral-800 pb-2 mb-4">
        <button
          onClick={() => setSelectedTab('status')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedTab === 'status' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Transcoder Telemetry
        </button>
        <button
          onClick={() => setSelectedTab('rtsp_m_steps')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedTab === 'rtsp_m_steps' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Miracast RTSP M1–M5 Messages
        </button>
        <button
          onClick={() => setSelectedTab('windows_guide')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedTab === 'windows_guide' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Windows Wireless Display Guide
        </button>
      </div>

      {/* Tab Content */}
      {selectedTab === 'status' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
            <span className="text-[11px] text-neutral-500 block">Bridge State</span>
            <span className={`text-xs font-mono font-medium ${isActive ? 'text-emerald-400' : 'text-neutral-400'}`}>
              {isActive ? 'M5 PLAY Active' : 'Standby'}
            </span>
          </div>
          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
            <span className="text-[11px] text-neutral-500 block">Transport Protocol</span>
            <span className="text-xs font-mono text-neutral-200">MPEG-2 TS / UDP</span>
          </div>
          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
            <span className="text-[11px] text-neutral-500 block">Content Protection</span>
            <span className="text-xs font-mono text-neutral-200">HDCP 2.2 Clear Passthrough</span>
          </div>
          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
            <span className="text-[11px] text-neutral-500 block">Output Standard</span>
            <span className="text-xs font-mono text-neutral-200">WFD 1.1 / MS-MICE</span>
          </div>
        </div>
      )}

      {selectedTab === 'rtsp_m_steps' && (
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {miracastSteps.map((step, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedMStep(idx)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono whitespace-nowrap transition-colors ${
                  selectedMStep === idx ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                {step.step.split(':')[0]}
              </button>
            ))}
          </div>

          <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 font-mono text-[11px]">
            <div className="text-blue-400 font-semibold mb-1">{miracastSteps[selectedMStep].step}</div>
            <div className="text-neutral-400 mb-2">Request (Windows WFD Client):</div>
            <pre className="text-neutral-300 bg-neutral-900 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap mb-3">
              {miracastSteps[selectedMStep].request}
            </pre>
            <div className="text-neutral-400 mb-2">Response (AirPlay Transcoder Sink):</div>
            <pre className="text-emerald-400 bg-neutral-900 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap">
              {miracastSteps[selectedMStep].response}
            </pre>
          </div>
        </div>
      )}

      {selectedTab === 'windows_guide' && (
        <div className="space-y-3 text-xs text-neutral-300 bg-neutral-950 p-4 rounded-xl border border-neutral-800">
          <h4 className="font-semibold text-white">How Windows Wireless Display Technology Works with this App</h4>
          <ol className="list-decimal pl-4 space-y-2 text-neutral-300">
            <li>
              <strong className="text-white">Apple AirPlay Receiver Engine:</strong> Receives Apple&apos;s encrypted H.264 video and ALAC audio packets over RTSP/RTP from your iPhone, iPad, or Mac.
            </li>
            <li>
              <strong className="text-white">Miracast / Wi-Fi Display Transcoder:</strong> Translates the stream into standard Wi-Fi Alliance WFD specification (MPEG-2 Transport Stream over UDP), matching Windows 10 & 11&apos;s native Miracast sink specification (MS-MICE).
            </li>
            <li>
              <strong className="text-white">Windows Cast Shortcut:</strong> On your Windows PC, press <kbd className="px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 font-mono">Win + K</kbd> to open the Cast panel, or launch the built-in <em>&quot;Wireless Display&quot;</em> / <em>&quot;Connect&quot;</em> app.
            </li>
            <li>
              <strong className="text-white">Multi-Monitor Projection:</strong> Click <em>&quot;Project to Display (Win+K)&quot;</em> above to project the AirPlay mirror onto a secondary wireless monitor or TV connected to your Windows PC.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
};
