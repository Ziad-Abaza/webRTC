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
  const rawCors = process.env.NEXUS_CORS_ORIGIN || '*';
  const corsOrigin = rawCors.includes(',') ? rawCors.split(',').map((s) => s.trim()) : rawCors;

  return {
    port: parseInt(process.env.NEXUS_PORT || '4000', 10),
    host: process.env.NEXUS_HOST || '0.0.0.0',
    jwtSecret: process.env.NEXUS_JWT_SECRET || 'nexusrtc-super-secret-jwt-key-minimum-32-chars-long',
    apiKey: process.env.NEXUS_API_KEY || 'nexusrtc-master-api-key',
    corsOrigin,
    defaultMediaProvider: process.env.NEXUS_MEDIA_PROVIDER || 'jitsi',
    storageProvider: process.env.NEXUS_STORAGE_PROVIDER || 'local',
    databaseAdapter: process.env.NEXUS_DATABASE_ADAPTER || 'sqlite',
    sqlitePath: process.env.NEXUS_SQLITE_PATH || './storage/nexusrtc.sqlite',
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
