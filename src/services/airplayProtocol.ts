import { ProtocolLog, HandshakeStep, BonjourRecord, MiracastBridgeStatus } from '../types/airplay';

export const DEFAULT_BONJOUR_AIRPLAY: BonjourRecord = {
  service: '_airplay._tcp.local',
  domain: 'local.',
  port: 7000,
  txtRecords: {
    deviceid: '00:2B:67:8A:14:CE',
    features: '0x5A7FFFF7,0x1E',
    model: 'AppleTV3,2',
    srcvers: '220.68',
    flags: '0x4',
    vv: '2',
    pk: '3b92f7e4c2810a9f5d34e6e1274c52089b02a713da46928e4e9f7831d45763b1',
    pi: 'b08861a0-3272-11ee-be56-0242ac120002',
    psi: '9211c430-8451-4f9e-a89f-293e43485d11',
  },
};

export const DEFAULT_BONJOUR_RAOP: BonjourRecord = {
  service: '_raop._tcp.local',
  domain: 'local.',
  port: 5000,
  txtRecords: {
    cn: '0,1,2,3',
    ch: '2',
    ek: '1',
    et: '0,1',
    md: '0,1,2',
    pw: 'false',
    sr: '44100',
    ss: '16',
    tp: 'UDP',
    vn: '65537',
    vs: '220.68',
    am: 'AppleTV3,2',
  },
};

export const STANDARD_HANDSHAKE_STEPS: HandshakeStep[] = [
  {
    id: 'step-mdns',
    name: 'mDNS / Bonjour Advertising',
    layer: 'mDNS/Bonjour',
    description: 'Broadcasts _airplay._tcp and _raop._tcp Zeroconf records on local network interface.',
    status: 'completed',
    rfcReference: 'RFC 6762 / Apple Bonjour DNS-SD',
  },
  {
    id: 'step-srp-setup',
    name: 'SRP-6a Mutual Authentication (Pair-Setup)',
    layer: 'Pair-Setup (SRP)',
    description: 'Client connects over HTTP port 7000. PIN code challenge, generates ephemeral keys A & B, computes proof M1 & M2.',
    status: 'pending',
    rfcReference: 'RFC 5054 / Apple SRP-6a Protocol Spec',
  },
  {
    id: 'step-pair-verify',
    name: 'Curve25519 ECDH Key Exchange (Pair-Verify)',
    layer: 'FairPlay/AES',
    description: 'Establishes transient shared secret via X25519, verifies Ed25519 signature, derives ChaCha20-Poly1305 session cipher.',
    status: 'pending',
    rfcReference: 'RFC 7748 / Apple HomeKit Accessory Protocol',
  },
  {
    id: 'step-rtsp-announce',
    name: 'RTSP Stream ANNOUNCE & Plist Negotiation',
    layer: 'RTSP Control',
    description: 'Sends RTSP 1.0 ANNOUNCE with Apple binary plist payload specifying H.264 profile, timing sync, and buffer parameters.',
    status: 'pending',
    rfcReference: 'RFC 2326 (RTSP 1.0) / Apple Plist v1.0',
  },
  {
    id: 'step-rtsp-setup',
    name: 'RTSP Stream SETUP (Video & ALAC Audio)',
    layer: 'RTSP Control',
    description: 'Allocates UDP RTP ports for video stream (PT 96), audio stream (PT 96 ALAC), control (RTCP) and NTP timing clock.',
    status: 'pending',
    rfcReference: 'RFC 3550 (RTP/RTCP) / Apple AirPlay Mirroring Spec',
  },
  {
    id: 'step-rtsp-record',
    name: 'RTSP RECORD & Active Transmission',
    layer: 'RTP/AV',
    description: 'Initiates active real-time mirroring feed with sub-30ms latency clock synchronization.',
    status: 'pending',
    rfcReference: 'RFC 2326 Section 10.6',
  },
  {
    id: 'step-miracast-transcode',
    name: 'Windows Wireless Display (Miracast/WFD) Conversion',
    layer: 'Miracast/WFD',
    description: 'Encapsulates incoming H.264 stream into Wi-Fi Display (WFD) MPEG-2 Transport Stream for Windows PC projection.',
    status: 'pending',
    rfcReference: 'Wi-Fi Display Technical Spec v1.1.0 / MS-MICE',
  },
];

export function generateSrpHandshakePayloads(pin: string) {
  return {
    srpSalt: 'a9b8c7d6e5f40123456789abcdef0123',
    serverB: 'b8483f98c8e1049281a8b12f45819e68341a99042b362847c18a24e908234125',
    clientA: 'c7493a1804921b4a8e29381745a90234b81c2039485718293049581029384756',
    proofM1: 'd9e8471928374650192837465019283746501928',
    proofM2: 'f1a2b3c4d5e6f708192837465019283746501928',
    sessionKey: '7c89a0b1c2d3e4f5061728394a5b6c7d',
    pinVerified: true,
  };
}

export function generateRtspAnnouncePlist(width = 1920, height = 1080, fps = 60): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>audioFormat</key>
  <integer>262144</integer> <!-- Apple Lossless (ALAC) 44.1kHz 16-bit -->
  <key>latency</key>
  <integer>11025</integer> <!-- 250ms buffer at 44.1kHz -->
  <key>latencyMs</key>
  <integer>24</integer>
  <key>model</key>
  <string>AppleTV3,2</string>
  <key>name</key>
  <string>AirPlay-PC-Receiver</string>
  <key>screenWidth</key>
  <integer>${width}</integer>
  <key>screenHeight</key>
  <integer>${height}</integer>
  <key>maxFPS</key>
  <integer>${fps}</integer>
  <key>overscanned</key>
  <false/>
  <key>refreshRate</key>
  <real>60.0</real>
  <key>version</key>
  <string>220.68</string>
</dict>
</plist>`;
}

export function generateMiracastM1toM5Messages(): Array<{ step: string; request: string; response: string }> {
  return [
    {
      step: 'M1: RTSP GET OPTIONS',
      request: `OPTIONS * RTSP/1.0\r\nCSeq: 1\r\nRequire: org.wfa.wfd1.0\r\nUser-Agent: Windows/10.0 (Miracast/WFD DirectDisplay)\r\n\r\n`,
      response: `RTSP/1.0 200 OK\r\nCSeq: 1\r\nPublic: org.wfa.wfd1.0, GET_PARAMETER, SET_PARAMETER\r\n\r\n`,
    },
    {
      step: 'M2: RTSP WFD QUERY',
      request: `OPTIONS * RTSP/1.0\r\nCSeq: 2\r\nRequire: org.wfa.wfd1.0\r\nSupported: org.wfa.wfd1.0\r\n\r\n`,
      response: `RTSP/1.0 200 OK\r\nCSeq: 2\r\nPublic: org.wfa.wfd1.0, GET_PARAMETER, SET_PARAMETER\r\n\r\n`,
    },
    {
      step: 'M3: RTSP GET_PARAMETER (Capabilities)',
      request: `GET_PARAMETER rtsp://localhost/wfd1.0 RTSP/1.0\r\nCSeq: 3\r\nContent-Type: text/parameters\r\nContent-Length: 98\r\n\r\nwfd_video_formats\r\nwfd_audio_codecs\r\nwfd_client_rtp_ports\r\nwfd_content_protection\r\n`,
      response: `RTSP/1.0 200 OK\r\nCSeq: 3\r\nContent-Type: text/parameters\r\n\r\nwfd_video_formats: 00 00 02 02 00000040 00000000 00000000 00 0000 0000 00 none none\r\nwfd_audio_codecs: LPCM 00000002 00\r\nwfd_content_protection: none\r\n`,
    },
    {
      step: 'M4: RTSP SET_PARAMETER (Session Config)',
      request: `SET_PARAMETER rtsp://localhost/wfd1.0 RTSP/1.0\r\nCSeq: 4\r\nContent-Type: text/parameters\r\nContent-Length: 122\r\n\r\nwfd_presentation_URL: rtsp://127.0.0.1/wfd1.0/streamid=0 none\r\nwfd_client_rtp_ports: RTP/AVP/UDP;unicast 19000 0 mode=play\r\n`,
      response: `RTSP/1.0 200 OK\r\nCSeq: 4\r\n\r\n`,
    },
    {
      step: 'M5: RTSP PLAY (Active Windows Stream)',
      request: `PLAY rtsp://127.0.0.1/wfd1.0/streamid=0 RTSP/1.0\r\nCSeq: 5\r\nSession: 382947192;timeout=60\r\n\r\n`,
      response: `RTSP/1.0 200 OK\r\nCSeq: 5\r\nSession: 382947192;timeout=60\r\nRange: npt=now-\r\n\r\n`,
    },
  ];
}
