const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = IS_SERVERLESS
  ? path.join(os.tmpdir(), 'wareact-studio-data')
  : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

/**
 * Persistensi eksternal (Upstash Redis REST) + fallback file.
 *
 * Kenapa: di Vercel serverless filesystem bersifat ephemeral — data/db.json
 * hilang tiap cold start. Dengan Redis, providers/campaigns/logs persisten
 * antar invokasi.
 *
 * Env (opsional — tanpa ini app otomatis pakai file seperti sebelumnya):
 *   UPSTASH_REDIS_REST_URL    — contoh: https://xxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN  — token REST Upstash
 *   REDIS_KEY                 — kunci Redis (default: d4tech:db:v1)
 *
 * Desain: data selalu ada di memori (this.data) sehingga API sinkron lama
 * tetap jalan. save() menulis async (write-through) ke Redis + file cache.
 * ensureLoaded() wajib di-await middleware sebelum menangani request API
 * agar cold start memuat data terbaru dari Redis.
 */

const REDIS_KEY = process.env.REDIS_KEY || 'd4tech:db:v1';

function getRedisConfig() {
  const url = String(process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/\/+$/, '');
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!url || !token) return null;
  return { url, token };
}

async function redisCommand(command) {
  const cfg = getRedisConfig();
  if (!cfg) return null;
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  if (!res.ok) {
    throw new Error(`Redis HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json && json.error) throw new Error(json.error);
  return json ? json.result : null;
}

async function redisGet() {
  return redisCommand(['GET', REDIS_KEY]);
}

async function redisSet(value) {
  return redisCommand(['SET', REDIS_KEY, value]);
}

async function redisPing() {
  await redisCommand(['PING']);
  return true;
}

const FREE_POOL_PROVIDER = {
  id: 'prov_free_pool',
  name: '⚡ API Gratis Publik (Multi-Server Otomatis)',
  type: 'free_pool',
  currency: 'IDR',
  description:
    'Langsung aktif tanpa API Key & tanpa deposit (Rp 0). Menghubungkan otomatis ke jaringan Bot Pool Gratis publik (Leovan 7-Cluster Violetics, XIYU Cloud RCHv2, & DavidCyril SocialBoost) lengkap dengan sistem failover otomatis bila salah satu server penuh.',
  config: {
    preferredGateway: 'auto', // 'auto' | 'leovan' | 'xiyu_cloud' | 'cyril_pool' | 'cyril_alt'
    dispatchMode: 'combined_pool', // 'combined_pool' (1 request gabungan semua emoji - aman dari limit) | 'per_emoji'
    useWeightedEmojis: true,
    timeoutMs: 35000
  },
  emojiServiceMap: {},
  cachedServices: [],
  lastBalance: { balance: 0, currency: 'FREE', checkedAt: new Date().toISOString() }
};

const DEFAULT_SANDBOX_SERVICES = [
  { id: '9001', name: 'WhatsApp Channel Post Reaction [❤️ Red Heart] - Cepat & Stabil', rate: 6500, min: 1, max: 50000, emoji: '❤️', category: 'WhatsApp Channel Reactions' },
  { id: '9002', name: 'WhatsApp Channel Post Reaction [👍 Thumbs Up] - Instant', rate: 6200, min: 1, max: 50000, emoji: '👍', category: 'WhatsApp Channel Reactions' },
  { id: '9003', name: 'WhatsApp Channel Post Reaction [🔥 Fire] - High Quality', rate: 6800, min: 1, max: 50000, emoji: '🔥', category: 'WhatsApp Channel Reactions' },
  { id: '9004', name: 'WhatsApp Channel Post Reaction [😂 Laughing] - Instant', rate: 6500, min: 1, max: 50000, emoji: '😂', category: 'WhatsApp Channel Reactions' },
  { id: '9005', name: 'WhatsApp Channel Post Reaction [😮 Surprised] - Cepat', rate: 6500, min: 1, max: 50000, emoji: '😮', category: 'WhatsApp Channel Reactions' },
  { id: '9006', name: 'WhatsApp Channel Post Reaction [😢 Crying / Sad] - Cepat', rate: 6500, min: 1, max: 50000, emoji: '😢', category: 'WhatsApp Channel Reactions' },
  { id: '9007', name: 'WhatsApp Channel Post Reaction [🙏 Pray / Folded Hands] - Cepat', rate: 6500, min: 1, max: 50000, emoji: '🙏', category: 'WhatsApp Channel Reactions' },
  { id: '9008', name: 'WhatsApp Channel Post Reaction [🎉 Party / Tada] - Instant', rate: 7000, min: 1, max: 50000, emoji: '🎉', category: 'WhatsApp Channel Reactions' },
  { id: '9009', name: 'WhatsApp Channel Post Reaction [💯 Hundred] - High Speed', rate: 7000, min: 1, max: 50000, emoji: '💯', category: 'WhatsApp Channel Reactions' },
  { id: '9010', name: 'WhatsApp Channel Post Reaction [😍 Heart Eyes] - Natural', rate: 6800, min: 1, max: 50000, emoji: '😍', category: 'WhatsApp Channel Reactions' },
  { id: '9011', name: 'WhatsApp Channel Post Reaction [👏 Clapping Hands] - Cepat', rate: 6500, min: 1, max: 50000, emoji: '👏', category: 'WhatsApp Channel Reactions' },
  { id: '9012', name: 'WhatsApp Channel Post Reaction [🚀 Rocket] - Viral Boost', rate: 7200, min: 1, max: 50000, emoji: '🚀', category: 'WhatsApp Channel Reactions' },
  { id: '9099', name: 'WhatsApp Channel Post Reaction [🎲 Random Positif Mix] - Murah', rate: 5500, min: 1, max: 100000, emoji: '*', category: 'WhatsApp Channel Reactions' }
];

function createDefaultDb() {
  return {
    activeProviderId: 'prov_free_pool',
    sandboxBalance: 250000,
    providers: [
      { ...FREE_POOL_PROVIDER },
      {
        id: 'prov_sandbox',
        name: 'Mode Simulasi / Sandbox (Latihan Offline)',
        type: 'sandbox',
        currency: 'IDR',
        description:
          'Simulator SMM Panel bawaan untuk latihan menguji antrean bertahap (drip-feed), kalkulasi biaya, dan pelacakan status tanpa mengirim ke WhatsApp asli.',
        config: {
          simulatedLatencyMs: 550
        },
        emojiServiceMap: {
          '❤️': '9001',
          '👍': '9002',
          '🔥': '9003',
          '😂': '9004',
          '😮': '9005',
          '😢': '9006',
          '🙏': '9007',
          '🎉': '9008',
          '💯': '9009',
          '😍': '9010',
          '👏': '9011',
          '🚀': '9012',
          '*': '9099'
        },
        cachedServices: DEFAULT_SANDBOX_SERVICES,
        lastBalance: { balance: 250000, currency: 'IDR', checkedAt: new Date().toISOString() }
      },
      {
        id: 'prov_smm_v2',
        name: 'SMM Panel Standar (API v2 Global/Lokal)',
        type: 'smm_v2',
        currency: 'IDR',
        description:
          'Kompatibel dengan mayoritas SMM Panel berbasis PerfectPanel / Standar v2 (parameter: key, action=add, service, link, quantity).',
        config: {
          apiUrl: 'https://namapanel-anda.com/api/v2',
          apiKey: '',
          timeoutMs: 25000
        },
        emojiServiceMap: {
          '❤️': '',
          '👍': '',
          '🔥': '',
          '😂': '',
          '😮': '',
          '😢': '',
          '🙏': '',
          '🎉': '',
          '*': ''
        },
        cachedServices: [],
        lastBalance: null
      },
      {
        id: 'prov_smm_id',
        name: 'SMM Panel Indonesia (api_id + api_key)',
        type: 'smm_id',
        currency: 'IDR',
        description:
          'Kompatibel dengan SMM Panel lokal Indonesia (seperti MedanPedia, IrvanKede, BuzzerPanel, PusatPanel) yang memakai api_id & api_key atau secret_key.',
        config: {
          baseUrl: 'https://api.medanpedia.co.id',
          mode: 'multi_endpoint',
          apiId: '',
          apiKey: '',
          secretKey: '',
          orderPath: '/order',
          statusPath: '/status',
          servicesPath: '/services',
          profilePath: '/profile',
          fieldService: 'service',
          fieldTarget: 'target',
          fieldQuantity: 'quantity',
          timeoutMs: 25000
        },
        emojiServiceMap: {
          '❤️': '',
          '👍': '',
          '🔥': '',
          '😂': '',
          '😮': '',
          '😢': '',
          '🙏': '',
          '🎉': '',
          '*': ''
        },
        cachedServices: [],
        lastBalance: null
      },
      {
        id: 'prov_direct',
        name: 'Direct Reaction REST API / Custom Webhook',
        type: 'direct_api',
        currency: 'IDR',
        description:
          'Untuk endpoint API Reaction WhatsApp kustom lainnya (mengirim link, emoji, dan quantity langsung via JSON/Query/Form).',
        config: {
          endpointUrl: 'https://api-provider-anda.com/api/wa-react',
          method: 'POST',
          contentType: 'application/json',
          apiKey: '',
          authHeaderName: 'Authorization',
          authHeaderPrefix: 'Bearer ',
          dispatchStyle: 'per_emoji',
          bodyTemplate: JSON.stringify(
            {
              link: '{{link}}',
              channelId: '{{channelCode}}',
              postId: '{{postId}}',
              emoji: '{{emoji}}',
              quantity: '{{quantity}}',
              apiKey: '{{apiKey}}'
            },
            null,
            2
          ),
          ratePer1000: 0,
          timeoutMs: 25000
        },
        emojiServiceMap: {},
        cachedServices: [],
        lastBalance: null
      }
    ],
    campaigns: [],
    logs: []
  };
}

function ensureFreePool(parsed) {
  if (!parsed || !Array.isArray(parsed.providers)) return parsed;
  const hasFreePool = parsed.providers.some((p) => p.id === 'prov_free_pool');
  if (!hasFreePool) {
    parsed.providers.unshift({ ...FREE_POOL_PROVIDER });
    parsed.activeProviderId = 'prov_free_pool';
  }
  return parsed;
}

class Store {
  constructor() {
    this.redisConfigured = Boolean(getRedisConfig());
    this.dbType = this.redisConfigured ? 'redis' : 'file';
    this.dbOk = false;
    this.lastError = null;
    // Data awal langsung tersedia (sinkron) agar require() lama tidak pecah.
    // ensureLoaded() akan menggantinya dengan data Redis/file saat siap.
    this.data = createDefaultDb();
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch {
      // Abaikan — direktori mungkin read-only di serverless; Redis tetap jalan.
    }
    this._saveQueue = Promise.resolve();
    this._loadPromise = this._loadAsync();
  }

  async ensureLoaded() {
    try {
      await this._loadPromise;
    } catch {
      // _loadAsync tidak pernah reject; ini pengaman saja.
    }
    return this.data;
  }

  getDbInfo() {
    return {
      type: this.dbType,
      ok: this.dbOk,
      key: this.redisConfigured ? REDIS_KEY : null,
      file: DB_FILE,
      serverless: IS_SERVERLESS,
      lastError: this.lastError
    };
  }

  async pingDb() {
    const started = Date.now();
    try {
      if (this.redisConfigured) {
        await redisPing();
      } else {
        // File: pastikan bisa ditulis (cek direktori ada + file bisa dibaca/ditulis)
        try {
          if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        } catch {
          // Abaikan
        }
      }
      this.dbOk = true;
      this.lastError = null;
      return { ok: true, latencyMs: Date.now() - started };
    } catch (err) {
      this.dbOk = false;
      this.lastError = err.message;
      return { ok: false, latencyMs: Date.now() - started, error: err.message };
    }
  }

  _loadFile() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.providers)) {
          return ensureFreePool(parsed);
        }
      }
    } catch (err) {
      console.error('Gagal membaca db.json:', err.message);
    }
    return null;
  }

  _writeFile(dataObj = this.data) {
    try {
      const tmp = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(dataObj, null, 2), 'utf8');
      fs.renameSync(tmp, DB_FILE);
    } catch (err) {
      // Di serverless /tmp biasanya bisa ditulis; bila gagal, jangan crash.
      console.warn('[store] tulis file cache gagal (non-fatal):', err.message);
    }
  }

  async _loadAsync() {
    // 1) Coba Redis bila dikonfigurasi
    if (this.redisConfigured) {
      try {
        const raw = await redisGet();
        if (raw) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (parsed && Array.isArray(parsed.providers)) {
            this.data = ensureFreePool(parsed);
            this.dbOk = true;
            this.lastError = null;
            // Sinkronkan cache file lokal (best-effort)
            this._writeFile(this.data);
            return this.data;
          }
        }
        // Redis kosong → seed dari file lokal bila ada, lalu tulis ke Redis
        const fromFile = this._loadFile();
        this.data = fromFile || createDefaultDb();
        this.dbOk = true;
        this.lastError = null;
        await redisSet(JSON.stringify(this.data));
        this._writeFile(this.data);
        return this.data;
      } catch (err) {
        console.warn('[store] Redis tidak terjangkau, fallback ke file:', err.message);
        this.lastError = err.message;
        // Lanjut ke fallback file di bawah
      }
    }

    // 2) Fallback file (perilaku lama)
    const fromFile = this._loadFile();
    if (fromFile) {
      this.data = fromFile;
      this.dbOk = true;
      this.lastError = null;
      return this.data;
    }
    this.data = createDefaultDb();
    this.dbOk = true;
    this.lastError = null;
    this._writeFile(this.data);
    return this.data;
  }

  /** Tunggu seluruh save() yang mengantre selesai (dipakai route mutasi sebelum res.json). */
  flush() {
    return this._saveQueue;
  }

  /**
   * Simpan data (async, tidak melempar agar pemanggil sinkron lama aman).
   * Ditulis berurutan via _saveQueue agar tidak ada race condition.
   * Untuk jalur kritis, server.js bisa `await store.save()`.
   */
  save() {
    const snapshot = JSON.stringify(this.data);
    this._saveQueue = this._saveQueue
      .then(async () => {
        // Selalu tulis cache file (lokal dev + fallback)
        this._writeFile(this.data);
        if (this.redisConfigured) {
          try {
            await redisSet(snapshot);
            this.dbOk = true;
            this.lastError = null;
          } catch (err) {
            this.dbOk = false;
            this.lastError = err.message;
            console.warn('[store] tulis Redis gagal (non-fatal):', err.message);
            try {
              const sentry = require('./sentry');
              sentry.captureException(err, { url: 'store.save/redis' });
            } catch {
              // Abaikan
            }
          }
        }
      })
      .catch(() => {
        // Jangan biarkan rantai queue mati
      });
    return this._saveQueue;
  }

  generateId(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  }

  getProviders() {
    return this.data.providers;
  }

  getProvider(id) {
    return this.data.providers.find((p) => p.id === id) || null;
  }

  getActiveProvider() {
    return (
      this.getProvider(this.data.activeProviderId) || this.data.providers[0]
    );
  }

  setActiveProvider(id) {
    const prov = this.getProvider(id);
    if (!prov) throw new Error('Provider tidak ditemukan.');
    this.data.activeProviderId = id;
    this.save();
    return prov;
  }

  upsertProvider(payload) {
    if (payload.id) {
      const idx = this.data.providers.findIndex((p) => p.id === payload.id);
      if (idx !== -1) {
        const existing = this.data.providers[idx];
        this.data.providers[idx] = {
          ...existing,
          name: payload.name ?? existing.name,
          type: payload.type ?? existing.type,
          currency: payload.currency ?? existing.currency,
          description: payload.description ?? existing.description,
          config: { ...existing.config, ...(payload.config || {}) },
          emojiServiceMap: payload.emojiServiceMap
            ? { ...payload.emojiServiceMap }
            : existing.emojiServiceMap
        };
        this.save();
        return this.data.providers[idx];
      }
    }

    const newProvider = {
      id: this.generateId('prov'),
      name: payload.name || 'Provider API Baru',
      type: payload.type || 'smm_v2',
      currency: payload.currency || 'IDR',
      description: payload.description || 'Provider kustom',
      config: payload.config || {},
      emojiServiceMap: payload.emojiServiceMap || { '*': '' },
      cachedServices: [],
      lastBalance: null
    };
    this.data.providers.push(newProvider);
    this.save();
    return newProvider;
  }

  deleteProvider(id) {
    if (id === 'prov_sandbox' || id === 'prov_free_pool') {
      throw new Error('Provider bawaan utama tidak dapat dihapus.');
    }
    const idx = this.data.providers.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Provider tidak ditemukan.');
    this.data.providers.splice(idx, 1);
    if (this.data.activeProviderId === id) {
      this.data.activeProviderId = this.data.providers[0].id;
    }
    this.save();
  }

  addLog(entry) {
    const logItem = {
      id: this.generateId('log'),
      timestamp: new Date().toISOString(),
      level: entry.level || 'info',
      campaignId: entry.campaignId || null,
      message: entry.message,
      detail: entry.detail || null
    };
    this.data.logs.unshift(logItem);
    if (this.data.logs.length > 250) {
      this.data.logs.length = 250;
    }
    this.save();
    return logItem;
  }

  getCampaigns() {
    return this.data.campaigns;
  }

  getCampaign(id) {
    return this.data.campaigns.find((c) => c.id === id) || null;
  }

  addCampaign(campaign) {
    this.data.campaigns.unshift(campaign);
    if (this.data.campaigns.length > 100) {
      this.data.campaigns.length = 100;
    }
    this.save();
    return campaign;
  }
}

module.exports = new Store();
