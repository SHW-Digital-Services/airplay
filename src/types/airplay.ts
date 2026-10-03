/**
 * AirPlay & Windows Wireless Display Protocol Types
 */

export type ProtocolLayer =
  | 'mDNS/Bonjour'
  | 'Pair-Setup (SRP)'
  | 'FairPlay/AES'
  | 'RTSP Control'
  | 'RTP/AV'
  | 'Miracast/WFD';

export interface ProtocolLog {
  id: string;
  timestamp: string;
  layer: ProtocolLayer;
  direction: 'IN' | 'OUT' | 'INTERNAL';
  summary: string;
  details?: string;
  rawPayload?: string;
}

export interface AirPlayReceiverState {
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
  bitrateMbps?: number;
  latencyMs?: number;
}

export interface HandshakeStep {
  id: string;
  name: string;
  layer: ProtocolLayer;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  rfcReference: string;
  timestamp?: string;
}

export interface BonjourRecord {
  service: string;
  domain: string;
  port: number;
  txtRecords: Record<string, string>;
}

export interface RTSPSession {
  cSeq: number;
  sessionId: string;
  clientUserAgent: string;
  activeStreams: {
    video: { port: number; controlPort: number; pt: number; codec: string };
    audio: { port: number; controlPort: number; timingPort: number; codec: string };
  };
  volume: number;
  playbackState: 'playing' | 'paused' | 'stopped';
}

export interface MiracastBridgeStatus {
  wfdActive: boolean;
  sessionState: 'M1_INIT' | 'M2_OPTIONS' | 'M3_GET_PARAMS' | 'M4_SET_PARAMS' | 'M5_PLAY' | 'M7_TEARDOWN' | 'IDLE';
  rtpPort: number;
  rtspPort: number;
  hdcpStatus: 'HDCP 2.2 Active' | 'Disabled (Clear)';
  transportMux: 'MPEG-2 TS (188 bytes)' | 'Raw PES H.264';
  targetDisplay: string;
  presentationApiSupported: boolean;
}
