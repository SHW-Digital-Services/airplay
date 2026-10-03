import React, { useState } from 'react';
import { 
  Terminal, 
  Filter, 
  Search, 
  Download, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Layers, 
  CheckCircle2, 
  Copy, 
  Check, 
  X,
  FileCode,
  Radio
} from 'lucide-react';
import { ProtocolLog, ProtocolLayer } from '../types/airplay';
import { DEFAULT_BONJOUR_AIRPLAY, DEFAULT_BONJOUR_RAOP } from '../services/airplayProtocol';

interface ProtocolInspectorProps {
  logs: ProtocolLog[];
  onClearLogs?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const ProtocolInspector: React.FC<ProtocolInspectorProps> = ({
  logs,
  onClearLogs,
  isOpen,
  onClose,
}) => {
  const [selectedLayer, setSelectedLayer] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<ProtocolLog | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const layers: Array<{ id: string; label: string }> = [
    { id: 'ALL', label: 'All Layers' },
    { id: 'mDNS/Bonjour', label: 'Bonjour / mDNS' },
    { id: 'Pair-Setup (SRP)', label: 'SRP-6a Auth' },
    { id: 'FairPlay/AES', label: 'Curve25519 & Crypto' },
    { id: 'RTSP Control', label: 'RTSP 1.0 & Plist' },
    { id: 'RTP/AV', label: 'RTP / ALAC Stream' },
    { id: 'Miracast/WFD', label: 'Miracast / WFD' },
  ];

  const filteredLogs = logs.filter((log) => {
    const matchesLayer = selectedLayer === 'ALL' || log.layer === selectedLayer;
    const matchesSearch =
      searchQuery === '' ||
      log.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesLayer && matchesSearch;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `airplay-protocol-logs-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-blue-500" />
            <div>
              <h2 className="text-sm font-semibold text-white">Apple AirPlay Protocol Suite Inspector</h2>
              <p className="text-xs text-neutral-400">
                Live packet analyzer for mDNS, SRP-6a, Curve25519, RTSP, RTP/ALAC &amp; Windows Miracast
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-3 border-b border-neutral-800 bg-neutral-900 flex flex-col sm:flex-row items-center gap-2.5 justify-between">
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {layers.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedLayer(l.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  selectedLayer === l.id
                    ? 'bg-blue-600 text-white'
                    : 'text-neutral-400 hover:text-neutral-200 bg-neutral-950'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search packet summary or payload..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-blue-500"
            />
          </div>
        </div>

        {/* Content Body: Split View (Log List and Details) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Log List */}
          <div className="md:col-span-6 border-r border-neutral-800 overflow-y-auto p-2 space-y-1.5">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-xs text-neutral-500">
                No protocol packets recorded matching this filter.
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isSelected = selectedLog?.id === log.id;
                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all text-xs ${
                      isSelected
                        ? 'bg-blue-950/40 border-blue-500/50 text-white'
                        : 'bg-neutral-950 border-neutral-800/80 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        {log.direction === 'IN' && (
                          <span className="text-emerald-400 flex items-center gap-0.5">
                            <ArrowDownLeft className="w-3 h-3" /> IN
                          </span>
                        )}
                        {log.direction === 'OUT' && (
                          <span className="text-blue-400 flex items-center gap-0.5">
                            <ArrowUpRight className="w-3 h-3" /> OUT
                          </span>
                        )}
                        {log.direction === 'INTERNAL' && (
                          <span className="text-purple-400 flex items-center gap-0.5">
                            <Radio className="w-3 h-3" /> BRIDGE
                          </span>
                        )}
                        <span className="text-neutral-500">·</span>
                        <span className="text-sky-300 font-semibold">{log.layer}</span>
                      </div>
                      <span className="text-[10px] font-mono text-neutral-500">{log.timestamp}</span>
                    </div>

                    <p className="font-mono text-neutral-200 truncate">{log.summary}</p>
                  </div>
                );
              })
            )}
          </div>

          {/* Log Details Viewer */}
          <div className="md:col-span-6 bg-neutral-950 p-4 overflow-y-auto flex flex-col">
            {selectedLog ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <div>
                    <span className="text-[11px] font-mono text-blue-400 uppercase tracking-wider block">
                      {selectedLog.layer} Packet Detail
                    </span>
                    <h3 className="text-sm font-semibold text-white mt-0.5">{selectedLog.summary}</h3>
                  </div>
                  <button
                    onClick={() => handleCopy(selectedLog.details || selectedLog.summary, selectedLog.id)}
                    className="p-1.5 text-neutral-400 hover:text-white bg-neutral-900 rounded-lg border border-neutral-800 transition-colors"
                    title="Copy payload"
                  >
                    {copiedId === selectedLog.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-medium text-neutral-400">Header / Summary:</span>
                  <div className="p-2.5 bg-neutral-900 rounded-lg font-mono text-xs text-neutral-200 border border-neutral-800">
                    {selectedLog.summary}
                  </div>
                </div>

                {selectedLog.details && (
                  <div className="space-y-2 flex-1">
                    <span className="text-xs font-medium text-neutral-400">Decoded Payload / Plist / Parameters:</span>
                    <pre className="p-3 bg-neutral-900 rounded-lg font-mono text-[11px] text-sky-200 border border-neutral-800 whitespace-pre-wrap overflow-x-auto max-h-[45vh]">
                      {selectedLog.details}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-500">
                <Terminal className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs">Select any packet from the left list to inspect decoded headers and raw payload.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
