export interface ServerConfig {
  port: number;
  host: string;
  jwtSecret: string;
  apiKey: string;
  corsOrigin: string | string[];
  defaultMediaProvider: string;
  storageProvider: string;
  databaseAdapter: string;
  sqlitePath: string;
  jitsi: {
    domain: string;
    appId: string;
    appSecret: string;
  };
  storage: {
    localDir: string;
  };
}

export function loadConfig(): ServerConfig {
  const rawCors = process.env.WEBRTC_CORS_ORIGIN || process.env.NEXUS_CORS_ORIGIN || '*';
  const corsOrigin = rawCors.includes(',') ? rawCors.split(',').map((s) => s.trim()) : rawCors;

  return {
    port: parseInt(process.env.WEBRTC_PORT || process.env.NEXUS_PORT || '4000', 10),
    host: process.env.WEBRTC_HOST || process.env.NEXUS_HOST || '0.0.0.0',
    jwtSecret: process.env.WEBRTC_JWT_SECRET || process.env.NEXUS_JWT_SECRET || 'webrtc-super-secret-jwt-key-minimum-32-chars-long',
    apiKey: process.env.WEBRTC_API_KEY || process.env.NEXUS_API_KEY || 'webrtc-master-api-key',
    corsOrigin,
    defaultMediaProvider: process.env.WEBRTC_MEDIA_PROVIDER || process.env.NEXUS_MEDIA_PROVIDER || 'jitsi',
    storageProvider: process.env.WEBRTC_STORAGE_PROVIDER || process.env.NEXUS_STORAGE_PROVIDER || 'local',
    databaseAdapter: process.env.WEBRTC_DATABASE_ADAPTER || process.env.NEXUS_DATABASE_ADAPTER || 'sqlite',
    sqlitePath: process.env.WEBRTC_SQLITE_PATH || process.env.NEXUS_SQLITE_PATH || './storage/webrtc.sqlite',
    jitsi: {
      domain: process.env.JITSI_DOMAIN || 'meet.jit.si',
      appId: process.env.JITSI_APP_ID || '',
      appSecret: process.env.JITSI_APP_SECRET || ''
    },
    storage: {
      localDir: process.env.STORAGE_LOCAL_DIR || './storage/recordings'
    }
  };
}
