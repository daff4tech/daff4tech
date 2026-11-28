/**
 * D4Tech Hub — Penambah Followers Saluran WhatsApp
 * ---------------------------------------------------------------------------
 * Modul ini TIDAK memakai bot followers palsu. Semua jalur di bawah bekerja
 * dengan akun WhatsApp sungguhan yang benar-benar menekan tombol "Ikuti" pada
 * Saluran publik, sehingga angka pengikut yang naik adalah pengikut nyata.
 *
 * Jalur gratis yang tersedia (hasil riset, bukan asumsi):
 *  1. WAHA Community (open source, 100% gratis) — `POST /api/{session}/channels/{invite}/follow`
 *     Dipakai sebagai relay follow sungguhan. Bisa memakai node publik WAHA
 *     atau instance mandiri di VPS sendiri (tanpa limit, tanpa biaya).
 *  2. Followdeh API v1 — SMM panel berbayar untuk WhatsApp (kredit gratisnya
 *     hanya untuk platform lain, TIDAK mencakup WhatsApp — diverifikasi di
 *     followdeh.com/en/free: daftar platform gratis tidak memuat WhatsApp).
 *     maks 30/bulan) yang bisa dipakai untuk paket "WhatsApp Channel Members".
 *     Endpoint: https://www.followdeh.com/api/v1 (key, action=services|add|status|balance)
 *  3. SMM.ist API v2 — panel dengan free trial WhatsApp Channel Members.
 *     Endpoint: https://smm.ist/api/v2 (key, action=services|add|status)
 *  4. Panel kustom (API v2 / api_id) — untuk panel lain yang Anda punya.
 *  5. Quantaps free form — 1–25 followers/request, manual lewat form resmi.
 *
 * Catatan jujur yang selalu dikembalikan ke UI:
 *  - WAHA & SMM di atas memakai akun relay legal (bukan akun palsu buatan app).
 *  - Angka pengikut publik di WhatsApp bisa tertunda beberapa menit.
 *  - Server relay publik bisa penuh/maintenance; failover otomatis dicoba.
 */

const store = require('./store');

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/* ------------------------------------------------------------------ parse */

const CHANNEL_LINK_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(?:whatsapp\.com|wa\.me)\/channel\/([A-Za-z0-9_-]{6,64})(?:[/?#].*)?$/i;
const CHANNEL_CODE_REGEX = /^[A-Za-z0-9_-]{12,64}$/;
const GROUP_LINK_REGEX = /chat\.whatsapp\.com\//i;

/**
 * Terima link saluran (dengan/tanpa http, dengan/tanpa postingan) atau kode
 * invite mentah. Menolak link grup / chat pribadi dengan pesan yang jelas.
 */
// Tautan target untuk Instagram / TikTok. WhatsApp tetap lewat
// parseChannelLink karena punya aturan tautan & kode invite sendiri.
function parseSocialLink(rawInput, platform) {
  const pf = platformById(platform);
  if (!pf) throw new Error(`Platform "${platform}" tidak dikenali.`);
  const raw = String(rawInput || '').trim();
  if (!raw) throw new Error(`Tempel tautan ${pf.label} atau username-nya (contoh: ${pf.example}).`);

  const hostRe = new RegExp(
    `^(?:https?:\\/\\/)?(?:www\\.)?(${platform}\\.com)\\/@?([A-Za-z0-9._]{1,40})`,
    'i'
  );
  const m = raw.match(hostRe);
  if (m) {
    const handle = m[2];
    return {
      platform,
      handle,
      targetUrl: platform === 'tiktok' ? `https://tiktok.com/@${handle}` : `https://instagram.com/${handle}`
    };
  }

  const bare = raw.replace(/^@/, '');
  if (/^[A-Za-z0-9._]{2,40}$/.test(bare)) {
    return {
      platform,
      handle: bare,
      targetUrl: platform === 'tiktok' ? `https://tiktok.com/@${bare}` : `https://instagram.com/${bare}`
    };
  }

  throw new Error(
    `Tautan itu tidak terbaca sebagai ${pf.label}. Pakai ${pf.example} atau username polos seperti @namapengguna.`
  );
}

function parseTargetLink(rawInput, platform = 'whatsapp') {
  if (platform === 'whatsapp') {
    const wa = parseChannelLink(rawInput);
    return { platform: 'whatsapp', handle: wa.channelCode, targetUrl: wa.channelUrl, ...wa };
  }
  return parseSocialLink(rawInput, platform);
}

function parseChannelLink(rawInput) {
  const raw = String(rawInput || '').trim();
  if (!raw) {
    throw new Error('Tempel tautan Saluran WhatsApp atau kode invite-nya terlebih dahulu.');
  }

  if (GROUP_LINK_REGEX.test(raw)) {
    throw new Error(
      'Itu tautan grup WhatsApp (chat.whatsapp.com), bukan Saluran. Buka Saluran → Bagikan → Salin tautan sehingga berformat whatsapp.com/channel/…'
    );
  }

  const match = raw.match(CHANNEL_LINK_REGEX);
  if (match) {
    const channelCode = match[1];
    return {
      channelCode,
      channelUrl: `https://whatsapp.com/channel/${channelCode}`,
      newsletterJidHint: null
    };
  }

  if (CHANNEL_CODE_REGEX.test(raw)) {
    return {
      channelCode: raw,
      channelUrl: `https://whatsapp.com/channel/${raw}`,
      newsletterJidHint: null
    };
  }

  throw new Error(
    'Format tautan tidak dikenali. Contoh yang benar: https://whatsapp.com/channel/0029VaXXXXXXXXXXXX atau kode invite 0029VaXXXXXXXXXXXX.'
  );
}

function clampQuantity(value, fallback = 20) {
  const num = Math.floor(Number(value));
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(10000, Math.max(1, num));
}

/* --------------------------------------------------------------- utilities */

async function fetchTimed(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text.replace(/^\uFEFF/, '').trim());
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, headers: res.headers, text, json };
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(str = '') {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return _;
      }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return _;
      }
    });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** "1,9 rb pengikut" → 1900 ; "234M followers" → 234000000 ; "Publik" → null */
function parseFollowerText(text) {
  const raw = String(text || '');
  const match = raw.match(/([\d.,]+)\s*(rb|jt|k|m)?/i);
  if (!match) return null;

  let numeric = match[1];
  const unit = (match[2] || '').toLowerCase();

  if (unit === 'rb' || unit === 'k') {
    numeric = numeric.replace(/\./g, '').replace(',', '.');
  } else if (unit === 'jt' || unit === 'm') {
    numeric = numeric.replace(/\./g, '').replace(',', '.');
  } else {
    // Tanpa unit: bisa format id-ID (1.234) atau en-US (1,234)
    if (/^\d{1,3}(\.\d{3})+$/.test(numeric)) numeric = numeric.replace(/\./g, '');
    else numeric = numeric.replace(/,/g, '');
  }

  const value = Number(numeric);
  if (!Number.isFinite(value)) return null;

  if (unit === 'rb' || unit === 'k') return Math.round(value * 1000);
  if (unit === 'jt') return Math.round(value * 1000000);
  if (unit === 'm') return Math.round(value * 1000000);
  return Math.round(value);
}

/* --------------------------------------------------------- konfigurasi     */

const DEFAULT_CONFIG = {
  waha: { baseUrl: '', session: 'default', apiKey: '', pairingPhone: '' },
  smm: {
    followdeh: { apiKey: '' },
    smmIst: { apiKey: '' },
    custom: { apiUrl: '', apiKey: '', apiId: '', secretKey: '' }
  }
};

// Kata kunci pencocokan layanan panel SMM. Banyak panel (mis. Followdeh)
// mencantumkan katalog berbahasa Persia. Ejaan "واتساپ" di alam liar ternyata
// beragam — "واتس آپ", "واتس اپ", "واتساپ", "واتس‌اپ" — jadi yang dicocokkan
// adalah akarnya ("واتس"), bukan satu ejaan utuh.
const SVC_WHATSAPP = /whatsapp|واتس|wa\b/i;
const SVC_MEMBER = /follower|member|pengikut|subscriber|ممبر|عضو|فالوور|دنبال/i;

// Katalog panel berbahasa Persia & Inggris. Tiap platform punya penyaring
// namanya sendiri supaya order Instagram tidak nyasar ke layanan WhatsApp.
const PLATFORMS = {
  whatsapp: {
    id: 'whatsapp',
    label: 'Saluran WhatsApp',
    short: 'WhatsApp',
    serviceFilter: SVC_WHATSAPP,
    serviceKind: SVC_MEMBER,
    bonus: /channel|کانال/i,
    bonusPoints: 3,
    penalty:
      /reaction|react|poll|view|ویو|grup|group|chat|گروه|اکشن|نظرسنجی|پیام|دایرکت/i,
    example: 'https://whatsapp.com/channel/0029Va4K…'
  },
  instagram: {
    id: 'instagram',
    label: 'Profil Instagram',
    short: 'Instagram',
    serviceFilter: /instagram|اینستاگرام|اینستا|ایگ|\big\b/i,
    serviceKind: SVC_MEMBER,
    bonus: /profile|پروفایل|پیج|page|user|کاربر/i,
    bonusPoints: 1,
    penalty:
      /view|ویو|like|لایک|comment|کامنت|story|استوری|reels|ریلز|live|لایو|save|سیو|impression|ایمپرشن|reach|ریچ|share|اشتراک|vote|نظرسنجی/i,
    example: 'https://instagram.com/namapengguna'
  },
  tiktok: {
    id: 'tiktok',
    label: 'Profil TikTok',
    short: 'TikTok',
    serviceFilter: /tik\s?tok|تیک\s?تاک|تیک‌تاک/i,
    serviceKind: SVC_MEMBER,
    bonus: /profile|پروفایل|user|کاربر|account|اکانت/i,
    bonusPoints: 1,
    penalty:
      /view|ویو|like|لایک|share|اشتراک|comment|کامنت|live|لایو|download|دانلود|vote|نظرسنجی/i,
    example: 'https://tiktok.com/@namapengguna'
  }
};

function platformById(id) {
  return PLATFORMS[id] || null;
}

const FREE_CHANNELS = [
  {
    id: 'waha_self',
    type: 'waha',
    name: 'WAHA Mandiri — 100% Gratis',
    tagline: 'Open source (Apache-2.0) · tanpa limit · tanpa biaya',
    free: true,
    keyless: true,
    requiresConfig: true,
    envBaseUrl: 'WAHA_BASE_URL',
    envSession: 'WAHA_SESSION',
    envApiKey: 'WAHA_API_KEY',
    bestFor:
      'Jalankan satu container Docker, tautkan nomor WhatsApp sekali lewat QR (bisa langsung dari halaman ini), lalu setiap follow dieksekusi oleh akun Anda sendiri. Tidak ada server pihak ketiga, tidak ada biaya.',
    setupCommand:
      'docker run -it --rm -p 3000:3000 -e WHATSAPP_DEFAULT_ENGINE=GOWS --name waha devlikeapro/waha',
    docsUrl: 'https://waha.devlike.pro/docs/overview/quick-start/'
  },
  {
    id: 'followdeh',
    type: 'smm_v2',
    apiUrl: 'https://www.followdeh.com/api/v1',
    statusAction: 'status',
    name: 'Followdeh — Panel Berbayar',
    tagline: 'API resmi · butuh saldo (kredit gratis tidak mencakup WhatsApp)',
    free: true,
    keyless: false,
    requiresConfig: true,
    signupUrl: 'https://www.followdeh.com/auth/signup',
    docsUrl: 'https://www.followdeh.com/en/api/docs',
    bestFor:
      'Layanan ممبر کانال واتس اپ (min 10–100) lewat API resmi. PENTING: kredit gratis Followdeh hanya untuk platform lain — WhatsApp harus pakai saldo. Butuh API key dari dashboard.',
    serviceFilter: SVC_WHATSAPP,
    serviceKind: SVC_MEMBER
  },
  {
    id: 'smm_ist',
    type: 'smm_v2',
    apiUrl: 'https://smm.ist/api/v2',
    statusAction: 'status',
    name: 'SMM.ist — Free Trial',
    tagline: 'API v2 · trial gratis WhatsApp members',
    free: true,
    keyless: false,
    requiresConfig: true,
    signupUrl: 'https://smm.ist/signup',
    docsUrl: 'https://smm.ist/api',
    bestFor: 'Free trial channel members sebelum memakai paket berbayar. Butuh API key dari akun gratis.',
    serviceFilter: SVC_WHATSAPP,
    serviceKind: SVC_MEMBER
  },
  {
    id: 'smm_custom',
    type: 'smm_v2',
    apiUrl: '',
    statusAction: 'status',
    name: 'Panel SMM Kustom (API v2)',
    tagline: 'Panel langganan Anda · format API standar',
    free: false,
    keyless: false,
    requiresConfig: true,
    bestFor:
      'Jika Anda punya panel SMM sendiri (PerfectPanel / api_id), app ini otomatis mencari layanan WhatsApp Channel Followers.',
    serviceFilter: SVC_WHATSAPP,
    serviceKind: SVC_MEMBER
  },
  {
    id: 'quantaps',
    type: 'manual',
    name: 'Quantaps — Form Gratis',
    tagline: '1–25 followers/permintaan · tanpa API key',
    free: true,
    keyless: true,
    requiresConfig: false,
    formUrl: 'https://quantaps.com/en/free-whatsapp-channel-followers/',
    quantityRange: [1, 25],
    bestFor:
      'Form gratis resmi Quantaps. App menyiapkan tautan & jumlahnya, tetapi pengiriman form tetap manual di situs mereka.',
    docsUrl: 'https://quantaps.com/en/free-whatsapp-channel-followers/'
  }
];

function ensureFollowerData() {
  if (!Array.isArray(store.data.followerOrders)) {
    store.data.followerOrders = [];
    store.save();
  }
  const cfg = store.data.followerConfig || {};
  store.data.followerConfig = {
    waha: { ...DEFAULT_CONFIG.waha, ...(cfg.waha || {}) },
    smm: {
      followdeh: { ...DEFAULT_CONFIG.smm.followdeh, ...(cfg.smm?.followdeh || {}) },
      smmIst: { ...DEFAULT_CONFIG.smm.smmIst, ...(cfg.smm?.smmIst || {}) },
      custom: { ...DEFAULT_CONFIG.smm.custom, ...(cfg.smm?.custom || {}) }
    }
  };
  return store.data.followerConfig;
}

function maskKey(key) {
  const raw = String(key || '');
  if (!raw) return '';
  if (raw.length <= 6) return '••••';
  return `${raw.slice(0, 3)}••••${raw.slice(-3)}`;
}

function runtimeConfig() {
  const cfg = ensureFollowerData();
  const env = process.env;

  const wahaSelf = {
    baseUrl: cfg.waha.baseUrl || env.WAHA_BASE_URL || '',
    session: cfg.waha.session || env.WAHA_SESSION || 'default',
    apiKey: cfg.waha.apiKey || env.WAHA_API_KEY || ''
  };

  return {
    stored: cfg,
    wahaSelf,
    followdehKey: cfg.smm.followdeh.apiKey || env.FOLLOWDEH_API_KEY || '',
    smmIstKey: cfg.smm.smmIst.apiKey || env.SMM_IST_API_KEY || '',
    customSmm: {
      apiUrl: cfg.smm.custom.apiUrl || env.SMM_API_URL || '',
      apiKey: cfg.smm.custom.apiKey || env.SMM_API_KEY || '',
      apiId: cfg.smm.custom.apiId || env.SMM_API_ID || '',
      secretKey: cfg.smm.custom.secretKey || env.SMM_SECRET_KEY || ''
    }
  };
}

function updateConfig(payload = {}) {
  const cfg = ensureFollowerData();
  if (payload.waha) {
    cfg.waha.baseUrl = String(payload.waha.baseUrl || '').trim().replace(/\/+$/, '');
    cfg.waha.session = String(payload.waha.session || 'default').trim() || 'default';
    if (typeof payload.waha.pairingPhone === 'string') {
      cfg.waha.pairingPhone = payload.waha.pairingPhone.replace(/[^0-9]/g, '');
    }
    if (typeof payload.waha.apiKey === 'string') {
      cfg.waha.apiKey = payload.waha.apiKey.trim();
    }
  }
  if (payload.smm) {
    if (payload.smm.followdeh && typeof payload.smm.followdeh.apiKey === 'string') {
      cfg.smm.followdeh.apiKey = payload.smm.followdeh.apiKey.trim();
    }
    if (payload.smm.smmIst && typeof payload.smm.smmIst.apiKey === 'string') {
      cfg.smm.smmIst.apiKey = payload.smm.smmIst.apiKey.trim();
    }
    if (payload.smm.custom) {
      cfg.smm.custom.apiUrl = String(payload.smm.custom.apiUrl || '').trim().replace(/\/+$/, '');
      if (typeof payload.smm.custom.apiKey === 'string') {
        cfg.smm.custom.apiKey = payload.smm.custom.apiKey.trim();
      }
      if (typeof payload.smm.custom.apiId === 'string') {
        cfg.smm.custom.apiId = payload.smm.custom.apiId.trim();
      }
      if (typeof payload.smm.custom.secretKey === 'string') {
        cfg.smm.custom.secretKey = payload.smm.custom.secretKey.trim();
      }
    }
  }
  store.save();
  return getChannelCatalog();
}

function getChannelCatalog() {
  const rt = runtimeConfig();

  return FREE_CHANNELS.map((ch) => {
    let ready = true;
    let readyNote = 'Siap dipakai';
    let hasKey = true;
    let baseUrl = '';
    let session = '';

    if (ch.id === 'waha_self') {
      baseUrl = rt.wahaSelf.baseUrl;
      session = rt.wahaSelf.session;
      ready = Boolean(baseUrl);
      readyNote = ready ? 'Instance mandiri terpasang' : 'Belum diatur — isi URL WAHA Anda';
    } else if (ch.id === 'followdeh') {
      hasKey = Boolean(rt.followdehKey);
      ready = hasKey;
      readyNote = hasKey ? 'API key tersimpan' : 'Butuh API key gratis dari Followdeh';
    } else if (ch.id === 'smm_ist') {
      hasKey = Boolean(rt.smmIstKey);
      ready = hasKey;
      readyNote = hasKey ? 'API key tersimpan' : 'Butuh API key akun gratis SMM.ist';
    } else if (ch.id === 'smm_custom') {
      hasKey = Boolean(rt.customSmm.apiKey);
      ready = Boolean(rt.customSmm.apiUrl && rt.customSmm.apiKey);
      readyNote = ready ? 'Panel kustom terpasang' : 'Isi URL API + API key panel Anda';
    } else if (ch.id === 'quantaps') {
      readyNote = 'Form gratis dibuka manual';
    }

    return {
      id: ch.id,
      type: ch.type,
      name: ch.name,
      tagline: ch.tagline,
      free: ch.free,
      keyless: ch.keyless,
      requiresConfig: ch.requiresConfig,
      ready,
      readyNote,
      hasKey,
      keyPreview: ch.id === 'followdeh' ? maskKey(rt.followdehKey) : ch.id === 'smm_ist' ? maskKey(rt.smmIstKey) : ch.id === 'smm_custom' ? maskKey(rt.customSmm.apiKey) : '',
      baseUrl: baseUrl || ch.apiUrl || '',
      session,
      bestFor: ch.bestFor,
      setupCommand: ch.setupCommand || '',
      docsUrl: ch.docsUrl || '',
      signupUrl: ch.signupUrl || '',
      formUrl: ch.formUrl || '',
      quantityRange: ch.quantityRange || null
    };
  });
}

/* --------------------------------------------------- pembacaan publik WA   */

const publicProbeCache = new Map();
const PUBLIC_PROBE_TTL = 90 * 1000;

/**
 * Membaca halaman publik saluran WhatsApp (og:title / og:description) untuk
 * mendapatkan nama + jumlah pengikut nyata. Ini juga menjadi bukti sebelum
 * dan sesudah follow, sehingga UI tidak pernah mengarang angka.
 */
async function probePublicChannel(channelCode, { timeoutMs = 9000, force = false } = {}) {
  const cached = publicProbeCache.get(channelCode);
  if (!force && cached && Date.now() - cached.checkedAt < PUBLIC_PROBE_TTL) {
    return { ...cached.value, cached: true };
  }

  const url = `https://whatsapp.com/channel/${channelCode}`;
  const value = {
    reachable: false,
    exists: null,
    name: null,
    followersText: null,
    followersNumber: null,
    description: null,
    avatar: null,
    checkedAt: Date.now(),
    reason: null
  };

  try {
    const res = await fetchTimed(
      url,
      {
        headers: {
          'User-Agent': CHROME_UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8'
        }
      },
      timeoutMs
    );

    if (!res.ok) {
      value.reachable = true;
      value.exists = false;
      value.reason = `WhatsApp membalas HTTP ${res.status} untuk tautan saluran tersebut.`;
      publicProbeCache.set(channelCode, { value, checkedAt: Date.now() });
      return value;
    }

    value.reachable = true;
    const html = res.text;

    const meta = (prop) => {
      const r1 = new RegExp(
        `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`,
        'i'
      );
      const r2 = new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`,
        'i'
      );
      const m = html.match(r1) || html.match(r2);
      return m ? decodeEntities(m[1]).trim() : '';
    };

    const title = meta('og:title');
    const desc = meta('og:description');
    const image = meta('og:image');
    const generic = !title || /^(whatsapp|whatsapp channel|saluran whatsapp)$/i.test(title);

    value.name = generic ? null : title;
    value.description = desc || null;
    value.avatar = /^https:\/\//.test(image) ? image : null;
    value.exists = Boolean(!generic || /follower|pengikut/i.test(desc));

    const followerMatch = desc.match(
      /([\d.,]+\s*(?:rb|jt|k|m)?)\s*(?:followers|pengikut|subscribers|anggota)/i
    );
    if (followerMatch) {
      value.followersText = followerMatch[1].trim();
      value.followersNumber = parseFollowerText(value.followersText);
    } else if (/follower|pengikut/i.test(desc)) {
      const raw = desc.split('•').find((p) => /follower|pengikut/i.test(p));
      value.followersText = raw ? raw.trim() : null;
      value.followersNumber = parseFollowerText(value.followersText);
    }

    if (!value.exists) {
      value.reason =
        'Halaman publik tidak menampilkan nama saluran. Pastikan tautan benar & saluran bersifat publik.';
    }
  } catch (err) {
    value.reason = `Tidak dapat menghubungi WhatsApp dari server ini: ${err.message}`;
  }

  publicProbeCache.set(channelCode, { value, checkedAt: Date.now() });
  return value;
}

/* ------------------------------------------------------------ WAHA relay  */

function wahaBase(rt, key) {
  const item = rt[key] || {};
  return {
    baseUrl: String(item.baseUrl || '').replace(/\/+$/, ''),
    session: String(item.session || 'default').trim() || 'default',
    apiKey: String(item.apiKey || '').trim()
  };
}

function wahaHeaders(apiKey) {
  const headers = { Accept: 'application/json' };
  if (apiKey) headers['X-Api-Key'] = apiKey;
  return headers;
}

async function wahaSessionInfo(target, timeoutMs = 9000) {
  if (!target.baseUrl) {
    return { online: false, status: 'unconfigured', note: 'URL WAHA belum diatur.' };
  }
  try {
    const res = await fetchTimed(
      `${target.baseUrl}/api/sessions`,
      { headers: wahaHeaders(target.apiKey) },
      timeoutMs
    );
    if (!res.ok || !Array.isArray(res.json)) {
      return {
        online: false,
        status: `http_${res.status}`,
        note: res.status === 401 ? 'API key WAHA ditolak.' : `Server membalas HTTP ${res.status}.`
      };
    }
    const found = res.json.find((s) => s.name === target.session);
    if (!found) {
      return {
        online: true,
        status: 'missing',
        note: `Sesi "${target.session}" belum dibuat/ditautkan di WAHA.`,
        sessions: res.json.map((s) => s.name)
      };
    }
    const working = String(found.status || '').toUpperCase() === 'WORKING';
    return {
      online: true,
      status: working ? 'working' : String(found.status || 'unknown').toLowerCase(),
      note: working
        ? `Sesi "${target.session}" tersambung ke WhatsApp.`
        : `Sesi "${target.session}" ada tetapi statusnya ${found.status}. Pindai QR di dashboard WAHA.`,
      me: found.me || null
    };
  } catch (err) {
    return { online: false, status: 'offline', note: `Tidak merespons: ${err.message}` };
  }
}

async function followViaWaha(target, parsed) {
  const info = await wahaSessionInfo(target, 8000);
  if (!info.online) {
    throw new Error(`${target.baseUrl || 'WAHA'} tidak dapat dihubungi. ${info.note}`);
  }

  const endpoint = `${target.baseUrl}/api/${encodeURIComponent(target.session)}/channels/${encodeURIComponent(
    parsed.channelCode
  )}/follow`;

  let res;
  try {
    res = await fetchTimed(
      endpoint,
      { method: 'POST', headers: wahaHeaders(target.apiKey) },
      20000
    );
  } catch (err) {
    throw new Error(`Permintaan follow ke WAHA gagal: ${err.message}`);
  }

  if (!res.ok) {
    const message =
      res.json?.message ||
      res.json?.error ||
      (res.text || '').slice(0, 160) ||
      `HTTP ${res.status}`;
    if (res.status === 422 || /session|not.*working|not.*connected/i.test(message)) {
      throw new Error(
        `WAHA menolak: ${message}. Tautkan nomor WhatsApp di dashboard WAHA (scan QR) lalu coba lagi.`
      );
    }
    throw new Error(`WAHA membalas HTTP ${res.status}: ${message}`);
  }

  let channel = res.json || null;

  // Metadata channel (nama + jumlah subscriber) — dipakai sebagai konfirmasi
  try {
    const meta = await fetchTimed(
      `${target.baseUrl}/api/${encodeURIComponent(target.session)}/channels/${encodeURIComponent(
        parsed.channelCode
      )}`,
      { headers: wahaHeaders(target.apiKey) },
      10000
    );
    if (meta.ok && meta.json) channel = { ...(channel || {}), ...meta.json };
  } catch {
    /* metadata opsional */
  }

  const role = String(channel?.role || '').toUpperCase();
  return {
    mode: 'waha',
    externalOrderId: channel?.id ? `WAHA:${channel.id}` : `WAHA-${Date.now().toString(36).toUpperCase()}`,
    channelName: channel?.name || null,
    newsletterJid: channel?.id || null,
    serverSubscribers: channel?.subscribersCount ?? null,
    accepted: true,
    role: role || null,
    note:
      role === 'SUBSCRIBER' || role === 'ADMIN' || role === 'OWNER'
        ? `Akun relay sekarang tercatat sebagai ${role} di saluran ini.`
        : 'Permintaan follow diterima WAHA. Cek jumlah pengikut publik beberapa menit lagi.'
  };
}

/* ------------------------------------------------------------- SMM panel  */

function normalizeServiceList(payload) {
  const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  return list
    .map((item) => ({
      id: String(item.service ?? item.id ?? item.sid ?? ''),
      name: String(item.name ?? item.layanan ?? item.service_name ?? ''),
      category: String(item.category ?? item.kategori ?? ''),
      rate: Number(item.rate ?? item.harga ?? 0),
      min: Number(item.min ?? 0),
      max: Number(item.max ?? 0),
      type: String(item.type ?? '')
    }))
    .filter((s) => s.id && s.name);
}

function scoreService(service, channel, platform = 'whatsapp') {
  const pf = platformById(platform) || PLATFORMS.whatsapp;
  const haystack = `${service.name} ${service.category}`.toLowerCase();
  // Penyaring platform menang atas penyaring kanal: satu panel SMM melayani
  // banyak platform, jadi yang menentukan adalah target yang diminta pengguna.
  const filter = pf.serviceFilter || channel.serviceFilter;
  const kind = pf.serviceKind || channel.serviceKind;
  if (filter && !filter.test(haystack)) return -1;
  if (kind && !kind.test(haystack)) return -1;
  // Prioritaskan layanan followers murni, hindari reaksi/poll/view/DM.
  let score = 0;
  if (pf.bonus && pf.bonus.test(haystack)) score += pf.bonusPoints;
  if (/follower|pengikut|subscriber|member|ممبر|عضو|فالوور/.test(haystack)) score += 2;
  if (pf.penalty && pf.penalty.test(haystack)) score -= 3;
  if (service.type && /default|package/i.test(service.type)) score += 1;
  return score;
}

async function smmPost(apiUrl, params, timeoutMs = 22000) {
  const body = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') body.set(k, String(v));
  });
  return fetchTimed(
    apiUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': CHROME_UA,
        Accept: 'application/json'
      },
      body: body.toString()
    },
    timeoutMs
  );
}

async function smmFetchServices(apiUrl, apiKey, extra = {}, timeoutMs = 20000) {
  const res = await smmPost(
    apiUrl,
    { key: apiKey, action: 'services', ...extra },
    timeoutMs
  );
  if (!res.json) {
    throw new Error(`Respons panel bukan JSON (HTTP ${res.status}): ${(res.text || '').slice(0, 140)}`);
  }
  if (res.json.error) throw new Error(`Panel menolak: ${res.json.error}`);
  const services = normalizeServiceList(res.json);
  if (services.length === 0) throw new Error('Panel tidak mengembalikan daftar layanan.');
  return services;
}

async function smmPickService(channel, apiKey, extra = {}, platform = 'whatsapp') {
  const pf = platformById(platform) || PLATFORMS.whatsapp;
  const services = await smmFetchServices(channel.apiUrl, apiKey, extra);
  const scored = services
    .map((s) => ({ ...s, score: scoreService(s, channel, platform) }))
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score || a.rate - b.rate);

  if (scored.length === 0) {
    const sample = services.slice(0, 6).map((s) => s.name).join(' | ');
    throw new Error(
      `Panel ini tidak menemukan layanan ${pf.label} di katalognya. Contoh layanan yang ada: ${sample}`
    );
  }
  return { best: scored[0], all: scored };
}

async function followViaSmm(channel, apiKey, parsed, quantity, extra = {}, platform = 'whatsapp') {
  if (!channel.apiUrl) throw new Error('URL API panel belum diatur.');
  if (!apiKey) throw new Error('API key panel belum diisi di Konfigurasi.');

  // 1. Cek saldo (tidak memotong saldo) — sekaligus memastikan key valid
  let balance = null;
  try {
    const balRes = await smmPost(channel.apiUrl, { key: apiKey, action: 'balance', ...extra }, 14000);
    if (balRes.json) {
      if (balRes.json.error && /key|api|invalid/i.test(String(balRes.json.error))) {
        throw new Error(`API key ditolak panel: ${balRes.json.error}`);
      }
      if (balRes.json.balance !== undefined) {
        balance = { amount: balRes.json.balance, currency: balRes.json.currency || '' };
      }
    }
  } catch (err) {
    if (/API key|key ditolak/i.test(err.message)) throw err;
    /* panel mungkin tidak punya action balance — lanjut */
  }

  // 2. Cari layanan platform yang diminta, yang paling relevan & termurah
  const { best, all } = await smmPickService(channel, apiKey, extra, platform);
  const min = best.min || 1;
  const max = best.max || 100000;
  const qty = Math.min(max, Math.max(min, Math.floor(quantity)));

  // 3. Kirim order
  const addRes = await smmPost(
    channel.apiUrl,
    {
      key: apiKey,
      action: 'add',
      service: best.id,
      link: parsed.targetUrl || parsed.channelUrl,
      quantity: qty,
      ...extra
    },
    26000
  );

  const json = addRes.json;
  if (!json) {
    throw new Error(
      `Panel membalas bukan JSON (HTTP ${addRes.status}): ${(addRes.text || '').slice(0, 160)}`
    );
  }
  if (json.error) {
    const msg = String(json.error);
    // Saldo kurang: sebutkan angkanya, jangan hanya meneruskan pesan panel.
    if (/not enough funds|insufficient|balance|saldo/i.test(msg)) {
      const cost =
        best.rate && best.rate > 0 ? (best.rate * qty) / 1000 : null;
      const saldo = balance ? `${balance.amount} ${balance.currency}`.trim() : 'tidak terbaca';
      throw new Error(
        `Saldo panel tidak cukup untuk order ini.\n` +
          `Saldo saat ini: ${saldo}\n` +
          `Perkiraan biaya: ${cost !== null ? `${Math.ceil(cost)} ${balance?.currency || ''}`.trim() : 'tidak dapat dihitung'} ` +
          `(${qty} × layanan "${best.name}", tarif ${best.rate} per 1.000)\n\n` +
          `Isi saldo di dashboard panel, atau pakai jalur lain yang tidak memerlukan saldo ` +
          `(WAHA mandiri — gratis tanpa limit).`
      );
    }
    throw new Error(`Panel menolak order: ${msg}`);
  }

  const orderId = json.order ?? json.order_id ?? json.id ?? json.data?.order ?? null;
  if (!orderId) {
    throw new Error(`Panel tidak mengembalikan ID order: ${JSON.stringify(json).slice(0, 180)}`);
  }

  const adjusted = qty !== Math.floor(quantity);
  return {
    mode: 'smm',
    externalOrderId: String(orderId),
    serviceId: best.id,
    serviceName: best.name,
    serviceRate: best.rate,
    quantityUsed: qty,
    min,
    max,
    accepted: true,
    balance,
    alternatives: all.slice(1, 4).map((s) => `${s.name} (min ${s.min || '-'})`),
    note: adjusted
      ? `Jumlah disesuaikan ke ${qty} mengikuti batas min/max layanan (${min}–${max}).`
      : `Order diterima panel dengan layanan "${best.name}".`
  };
}

async function smmOrderStatus(channel, apiKey, orderId, extra = {}) {
  const res = await smmPost(
    channel.apiUrl,
    { key: apiKey, action: channel.statusAction || 'status', order: orderId, ...extra },
    16000
  );
  if (!res.json) throw new Error(`Status tidak terbaca (HTTP ${res.status}).`);
  if (res.json.error) throw new Error(String(res.json.error));
  // Panel bergaya PerfectPanel (smm.ist & mayoritas panel SMM) membalas
  // action=status dengan ARRAY berisi satu objek, bukan objek tunggal.
  const row = Array.isArray(res.json) ? res.json[0] : res.json;
  if (!row || typeof row !== 'object') {
    throw new Error('Balasan status panel tidak dikenali.');
  }
  return row;
}

/* -------------------------------------------------------------- order flow */

function publicChannelById(id) {
  return FREE_CHANNELS.find((c) => c.id === id) || null;
}

function getApiKeyForChannel(channelId, rt) {
  if (channelId === 'followdeh') return rt.followdehKey;
  if (channelId === 'smm_ist') return rt.smmIstKey;
  if (channelId === 'smm_custom') return rt.customSmm.apiKey;
  return '';
}

function smmExtraFor(channelId, rt) {
  if (channelId === 'smm_custom') {
    return {
      api_id: rt.customSmm.apiId || undefined,
      secret_key: rt.customSmm.secretKey || undefined
    };
  }
  return {};
}

function recordOrder(order) {
  ensureFollowerData();
  store.data.followerOrders.unshift(order);
  if (store.data.followerOrders.length > 100) {
    store.data.followerOrders.length = 100;
  }
  store.save();
  return order;
}

function getOrders() {
  ensureFollowerData();
  return store.data.followerOrders;
}

function clearOrders() {
  ensureFollowerData();
  store.data.followerOrders = [];
  store.save();
}

/**
 * Memilih jalur otomatis (failover): urutan = panel SMM yang sudah berkey
 * (paling andal) → WAHA mandiri → WAHA publik → error informatif.
 */
function autoPriority(rt, platform = 'whatsapp') {
  // Urutan: WAHA mandiri (paling murah & tanpa limit) → panel SMM.
  // WAHA hanya bisa WhatsApp, jadi dilewati untuk platform lain.
  const list = [];
  if (platform === 'whatsapp' && rt.wahaSelf.baseUrl) list.push('waha_self');
  if (rt.followdehKey) list.push('followdeh');
  if (rt.smmIstKey) list.push('smm_ist');
  if (rt.customSmm.apiUrl && rt.customSmm.apiKey) list.push('smm_custom');
  return list;
}

/**
 * Daftar jalur yang BELUM dikonfigurasi, dalam bahasa manusia. Dipakai supaya
 * pesan galat menjelaskan apa yang harus diisi — bukan menyalahkan server.
 */
function describeMissingPaths(rt) {
  const items = [];
  if (!rt.wahaSelf.baseUrl) {
    items.push(
      'WAHA mandiri (100% gratis, tanpa limit): jalankan container Docker WAHA, lalu isi Base URL-nya di panel Konfigurasi.'
    );
  }
  if (!rt.followdehKey) {
    items.push(
      'Followdeh (butuh SALDO — kredit gratisnya tidak mencakup WhatsApp): daftar di https://www.followdeh.com/auth/signup, isi saldo, lalu tempel API key-nya.'
    );
  }
  if (!rt.smmIstKey) {
    items.push(
      'SMM.ist (saldo trial gratis): daftar gratis di https://smm.ist/signup lalu tempel API key-nya.'
    );
  }
  if (!(rt.customSmm.apiUrl && rt.customSmm.apiKey)) {
    items.push('Panel SMM milik Anda: isi URL API + API key panel di Konfigurasi.');
  }
  return items;
}

async function placeFollowerOrder({
  channelLink,
  targetLink,
  platform = 'whatsapp',
  quantity = 20,
  channelId = 'auto',
  note = ''
}) {
  const pf = platformById(platform);
  if (!pf) {
    throw new Error(
      `Platform "${platform}" tidak dikenali. Pilih salah satu: ${Object.keys(PLATFORMS).join(', ')}.`
    );
  }
  const parsed = parseTargetLink(targetLink || channelLink, platform);
  const qty = clampQuantity(quantity);
  const rt = runtimeConfig();

  const attempts = [];
  const candidates =
    channelId && channelId !== 'auto' ? [channelId] : autoPriority(rt, platform);

  // Mode otomatis tanpa satu pun jalur terkonfigurasi: jangan berpura-pura
  // sudah mencoba. Beri tahu pengguna apa yang harus diisi. Divalidasi SEBELUM
  // probe jaringan supaya pengguna tidak menunggu 9 detik sia-sia.
  if (!channelId || channelId === 'auto') {
    if (!candidates.length) {
      const missing = describeMissingPaths(rt);
      throw new Error(
        'Belum ada jalur yang siap dipakai, jadi tidak ada permintaan yang dikirim. ' +
          'Isi salah satu dari ini di panel Konfigurasi:\n' +
          missing.map((m, i) => `${i + 1}. ${m}`).join('\n') +
          '\n\nAlternatif tanpa API key: buka form gratis Quantaps (1–25 followers per permintaan) lewat tombol "Buka →" di daftar jalur.'
      );
    }
  } else if (!publicChannelById(channelId)) {
    throw new Error(
      `Jalur "${channelId}" tidak dikenali. Pilih "Mode Otomatis" atau salah satu jalur yang terdaftar.`
    );
  }

  // Baca jumlah awal hanya untuk Saluran WhatsApp; Instagram/TikTok tidak
  // punya halaman og yang bisa dibaca tanpa login, jadi lewati saja.
  const before =
    platform === 'whatsapp'
      ? await probePublicChannel(parsed.channelCode, { timeoutMs: 9000 })
      : null;

  let success = null;
  let lastError = null;

  for (const id of candidates) {
    const def = publicChannelById(id);
    if (!def) continue;

    if (def.type === 'manual') {
      attempts.push({ channelId: id, ok: false, error: 'Jalur manual tidak dieksekusi otomatis.' });
      continue;
    }

    try {
      if (def.type === 'waha') {
        const target = wahaBase(rt, 'wahaSelf');
        if (!target.baseUrl) {
          throw new Error('URL WAHA belum diatur.');
        }
        const res = await followViaWaha(target, parsed);
        success = {
          channelId: id,
          channelName: def.name,
          ...res
        };
        attempts.push({ channelId: id, ok: true });
        break;
      }

      if (def.type === 'smm_v2') {
        const apiUrl = def.id === 'smm_custom' ? rt.customSmm.apiUrl : def.apiUrl;
        const channel = { ...def, apiUrl };
        const apiKey = getApiKeyForChannel(id, rt);
        if (!apiKey) {
          throw new Error('API key panel belum diisi.');
        }
        const res = await followViaSmm(channel, apiKey, parsed, qty, smmExtraFor(id, rt), platform);
        success = {
          channelId: id,
          channelName: def.name,
          ...res
        };
        attempts.push({ channelId: id, ok: true });
        break;
      }
    } catch (err) {
      lastError = err;
      attempts.push({ channelId: id, ok: false, error: err.message });
    }
  }

  if (!success) {
    // Jelaskan kegagalan tiap jalur apa adanya, tanpa menyalahkan server bila
    // penyebabnya sebenarnya konfigurasi yang belum lengkap.
    const detail = attempts
      .map((a) => {
        const name = publicChannelById(a.channelId)?.name || a.channelId;
        return `• ${name}: ${a.error || 'tidak tersedia'}`;
      })
      .join('\n');

    const missing = describeMissingPaths(rt);
    const suffix = missing.length
      ? `\n\nJalur lain yang bisa dipakai setelah diatur:\n${missing
          .map((m, i) => `${i + 1}. ${m}`)
          .join('\n')}`
      : '';

    throw new Error(
      `${attempts.length} jalur dicoba, semuanya gagal:\n${detail}${suffix}`
    );
  }

  // Jeda singkat lalu baca ulang halaman publik sebagai bukti
  await sleep(1200);
  let after = await probePublicChannel(parsed.channelCode, { timeoutMs: 9000, force: true });

  const delta =
    before.followersNumber !== null && after.followersNumber !== null
      ? after.followersNumber - before.followersNumber
      : null;

  const notes = [success.note].filter(Boolean);
  if (delta === 0) {
    notes.push(
      'Angka pengikut publik belum berubah. WhatsApp memperbarui hitungan secara bertahap (bisa beberapa menit) — tekan "Cek ulang" beberapa saat lagi.'
    );
  } else if (delta === null) {
    notes.push(
      'Hitungan pengikut publik tidak dapat dibaca dari server ini, jadi kenaikan belum bisa dibuktikan otomatis. Buka saluran di WhatsApp untuk memastikan.'
    );
  }
  if (success.balance) {
    notes.push(
      `Saldo panel tersisa ${success.balance.amount} ${success.balance.currency || ''}`.trim()
    );
  }
  if (success.alternatives?.length) {
    notes.push(`Layanan alternatif di panel: ${success.alternatives.join(' • ')}`);
  }

  const order = recordOrder({
    id: store.generateId('fol'),
    createdAt: new Date().toISOString(),
    target: parsed.channelUrl,
    channelCode: parsed.channelCode,
    channelId: success.channelId,
    channelName: success.channelName,
    realChannelName: before.name || success.channelName || null,
    quantity: success.quantityUsed || qty,
    mode: success.mode,
    externalOrderId: success.externalOrderId,
    serviceId: success.serviceId || null,
    serviceName: success.serviceName || null,
    status: success.mode === 'smm' ? 'processing' : 'accepted',
    verified: delta !== null && delta > 0,
    proof: {
      before: before.followersNumber,
      after: after.followersNumber,
      beforeText: before.followersText,
      afterText: after.followersText,
      delta
    },
    notes,
    attempts,
    userNote: String(note || '').slice(0, 160) || null,
    lastCheckedAt: new Date().toISOString()
  });

  return {
    ok: true,
    order,
    proof: {
      before: before.followersText,
      after: after.followersText,
      delta,
      channel: {
        name: before.name,
        avatar: before.avatar,
        exists: before.exists
      }
    },
    warnings: [
      'Pengikut berasal dari akun relay sungguhan yang mengikuti saluran Anda — bukan angka palsu yang ditempel di UI.',
      'Jangan spam. Follow massal dari satu nomor dalam jumlah besar berisiko dibatasi WhatsApp; pakai jumlah wajar dan jeda.'
    ],
    attempts
  };
}

/** Cek ulang bukti jumlah pengikut untuk satu order + status panel bila ada. */
async function refreshOrder(orderId) {
  ensureFollowerData();
  const order = store.data.followerOrders.find((o) => o.id === orderId);
  if (!order) throw new Error('Riwayat order tidak ditemukan.');

  const after = await probePublicChannel(order.channelCode, { timeoutMs: 9000, force: true });
  const base = order.proof?.before ?? null;
  const next = after.followersNumber;
  const delta = base !== null && next !== null ? next - base : null;

  order.proof = {
    ...order.proof,
    after: next,
    afterText: after.followersText,
    delta
  };
  order.lastCheckedAt = new Date().toISOString();

  if (delta !== null && delta > 0) {
    order.verified = true;
    if (order.status === 'processing') order.status = 'active';
  }

  // Untuk panel SMM, ambil status order resmi bila key masih tersedia.
  if (order.mode === 'smm') {
    const rt = runtimeConfig();
    const def = publicChannelById(order.channelId);
    if (def && def.type === 'smm_v2') {
      const apiUrl = def.id === 'smm_custom' ? rt.customSmm.apiUrl : def.apiUrl;
      const apiKey = getApiKeyForChannel(order.channelId, rt);
      if (apiUrl && apiKey) {
        try {
          const status = await smmOrderStatus(
            { ...def, apiUrl },
            apiKey,
            order.externalOrderId,
            smmExtraFor(order.channelId, rt)
          );
          order.panelStatus = {
            status: status.status || null,
            startCount: status.start_count ?? null,
            remains: status.remains ?? null,
            charge: status.charge ?? null,
            currency: status.currency ?? null,
            checkedAt: new Date().toISOString()
          };
        } catch (err) {
          order.panelStatus = { error: err.message, checkedAt: new Date().toISOString() };
        }
      }
    }
  }

  store.save();
  return order;
}

/* ---------------------------------------------------------------- health  */

let healthCache = { at: 0, data: null };
const HEALTH_TTL = 45 * 1000;

async function checkChannelsHealth({ force = false } = {}) {
  if (!force && healthCache.data && Date.now() - healthCache.at < HEALTH_TTL) {
    return { ...healthCache.data, cached: true };
  }

  const rt = runtimeConfig();

  const probeWaha = async (target, label) => {
    if (!target.baseUrl) {
      return {
        online: false,
        status: 'unconfigured',
        note: 'Belum diatur — isi URL instance WAHA Anda.'
      };
    }
    const info = await wahaSessionInfo(target, 7000);
    return {
      online: info.online && info.status === 'working',
      status: info.status,
      note: info.note,
      session: target.session,
      baseUrl: target.baseUrl,
      label
    };
  };

  const probeSmm = async (channelId, apiUrl, apiKey) => {
    if (!apiUrl) {
      return { online: false, status: 'unconfigured', note: 'URL API belum diatur.' };
    }
    if (!apiKey) {
      return { online: false, status: 'needs_key', note: 'Butuh API key (gratis) di Konfigurasi.' };
    }
    try {
      const services = await smmFetchServices(apiUrl, apiKey, {}, 14000);
      const scored = services
        .map((s) => ({ s, score: scoreService(s, { ...publicChannelById(channelId), apiUrl }) }))
        .filter((x) => x.score >= 0)
        // Urutan harus sama dengan smmPickService (skor lalu harga), supaya
        // label "termurah" di sini sama dengan layanan yang benar-benar dipilih
        // saat order dijalankan.
        .sort((a, b) => b.score - a.score || a.s.rate - b.s.rate);

      const best = scored[0]?.s;
      return {
        online: true,
        status: 'online',
        note: best
          ? `${scored.length} layanan WA followers • termurah: ${best.name} (min ${best.min || '-'})`
          : 'API online, tetapi layanan WhatsApp Channel Followers tidak ditemukan.'
      };
    } catch (err) {
      return { online: false, status: 'error', note: err.message };
    }
  };

  const [wahaSelf, followdeh, smmIst, custom] = await Promise.all([
    probeWaha(wahaBase(rt, 'wahaSelf')),
    probeSmm('followdeh', 'https://www.followdeh.com/api/v1', rt.followdehKey),
    probeSmm('smm_ist', 'https://smm.ist/api/v2', rt.smmIstKey),
    probeSmm('smm_custom', rt.customSmm.apiUrl, rt.customSmm.apiKey)
  ]);

  const byId = {
    waha_self: wahaSelf,
    followdeh,
    smm_ist: smmIst,
    smm_custom: custom,
    quantaps: {
      online: true,
      status: 'manual',
      note: 'Form gratis dibuka manual di situs Quantaps (1–25 followers).'
    }
  };

  const onlineCount = Object.values(byId).filter((c) => c.online).length;
  const data = {
    checkedAt: new Date().toISOString(),
    onlineCount,
    totalChannels: Object.keys(byId).length,
    channels: byId
  };
  healthCache = { at: Date.now(), data };
  return data;
}

function getPublicConfig() {
  const rt = runtimeConfig();
  return {
    waha: {
      baseUrl: rt.stored.waha.baseUrl || '',
      session: rt.stored.waha.session || 'default',
      pairingPhone: rt.stored.waha.pairingPhone || '',
      hasApiKey: Boolean(rt.stored.waha.apiKey)
    },
    followdehKey: '',
    followdehKeyPreview: maskKey(rt.followdehKey),
    smmIstKeyPreview: maskKey(rt.smmIstKey),
    customSmm: {
      apiUrl: rt.customSmm.apiUrl || '',
      apiId: rt.customSmm.apiId || '',
      hasApiKey: Boolean(rt.customSmm.apiKey),
      keyPreview: maskKey(rt.customSmm.apiKey)
    }
  };
}


/* --------------------------------------------------- penautan nomor (QR)  */

/**
 * Membuat sesi WAHA (bila belum ada), menyalakannya, lalu mengambil QR /
 * pairing code agar pengguna bisa menautkan nomor WhatsApp sendiri langsung
 * dari halaman ini. Ini yang membuat jalur gratis WAHA benar-benar bisa
 * dipakai tanpa membuka dashboard WAHA manual.
 */
async function ensureWahaSession({ autoConnect = true } = {}) {
  const rt = runtimeConfig();
  const target = wahaBase(rt, 'wahaSelf');
  if (!target.baseUrl) {
    throw new Error(
      'URL WAHA belum diatur. Jalankan container WAHA lebih dulu, lalu isi Base URL-nya di Konfigurasi.'
    );
  }

  const headers = { ...wahaHeaders(target.apiKey), 'Content-Type': 'application/json' };

  // 0. Bila WAHA menerima pairing code, cukup tautkan nomor lewat kode 8 digit
  //    (tanpa QR). Ini jauh lebih ramah di ponsel.
  const pairingPhone = String(
    runtimeConfig().stored.waha.pairingPhone || process.env.WAHA_PAIRING_PHONE || ''
  ).replace(/[^0-9]/g, '');

  if (pairingPhone && autoConnect) {
    try {
      const res = await fetchTimed(
        `${target.baseUrl}/api/${encodeURIComponent(target.session)}/auth/request-code`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ phoneNumber: pairingPhone })
        },
        25000
      );
      if (res.ok && res.json?.code) {
        return {
          session: target.session,
          baseUrl: target.baseUrl,
          status: 'pairing_required',
          pairingCode: String(res.json.code),
          pairingPhone,
          note:
            'Masukkan kode 8 digit ini di WhatsApp → Perangkat Tertaut → Tautkan dengan nomor telepon.',
          steps: [
            'Buka WhatsApp di ponsel → Pengaturan → Perangkat Tertaut.',
            'Pilih "Tautkan perangkat" → "Tautkan dengan nomor telepon".',
            'Masukkan kode 8 digit yang tampil di halaman ini.'
          ]
        };
      }
    } catch {
      /* lanjut ke QR */
    }
  }

  // 1. Pastikan sesi ada
  let created = false;
  try {
    const list = await fetchTimed(`${target.baseUrl}/api/sessions`, { headers: wahaHeaders(target.apiKey) }, 10000);
    const exists = Array.isArray(list.json) && list.json.some((x) => x.name === target.session);
    if (!exists) {
      const res = await fetchTimed(
        `${target.baseUrl}/api/sessions`,
        { method: 'POST', headers, body: JSON.stringify({ name: target.session, start: true }) },
        20000
      );
      created = res.ok;
      if (!res.ok) {
        throw new Error(
          `Gagal membuat sesi WAHA (HTTP ${res.status}): ${(res.text || '').slice(0, 160)}`
        );
      }
    }
  } catch (err) {
    if (/Gagal membuat sesi/.test(err.message)) throw err;
    throw new Error(`WAHA tidak dapat dihubungi di ${target.baseUrl}: ${err.message}`);
  }

  // 2. Nyalakan sesi (idempoten)
  await fetchTimed(
    `${target.baseUrl}/api/sessions/${encodeURIComponent(target.session)}/start`,
    { method: 'POST', headers },
    20000
  ).catch(() => null);

  // 3. Ambil status & QR
  const info = await wahaSessionInfo(target, 10000);
  let qr = null;
  if (info.status !== 'working') {
    try {
      // Ambil biner PNG apa adanya (response.text() akan merusak byte gambar).
      const res = await fetch(
        `${target.baseUrl}/api/${encodeURIComponent(target.session)}/auth/qr?format=image`,
        {
          headers: { ...wahaHeaders(target.apiKey), Accept: 'image/png' },
          signal: AbortSignal.timeout(15000)
        }
      );
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const isPng = buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
        if (isPng) {
          qr = `data:image/png;base64,${buffer.toString('base64')}`;
        }
      }
    } catch {
      qr = null;
    }
  }

  return {
    session: target.session,
    baseUrl: target.baseUrl,
    created,
    status: info.status,
    note: info.note,
    qr,
    me: info.me || null,
    steps: [
      'Jalankan container WAHA di VPS/PC Anda (satu perintah, lihat panduan).',
      'Isi Base URL WAHA di Konfigurasi, lalu simpan.',
      'Tekan "Tautkan Nomor" → pindai QR di WhatsApp → Perangkat Tertaut.',
      'Setelah status WORKING, jalankan penambahan followers dari halaman ini.'
    ]
  };
}

/** Cek status sesi WAHA tanpa membuat sesi baru. */
async function getWahaStatus() {
  const rt = runtimeConfig();
  const target = wahaBase(rt, 'wahaSelf');
  if (!target.baseUrl) {
    return { configured: false, status: 'unconfigured', note: 'URL WAHA belum diatur.' };
  }
  const info = await wahaSessionInfo(target, 9000);
  return { configured: true, baseUrl: target.baseUrl, session: target.session, ...info };
}

/* ------------------------------------------------------------- diagnostik  */

/**
 * Menampilkan katalog layanan sebuah panel apa adanya, lengkap dengan skor
 * pencocok otomatis. Dipakai ketika panel online tetapi tidak ada layanan yang
 * dikenali — supaya nama layanan asli terlihat dan pencocokan bisa disesuaikan,
 * bukan ditebak.
 */
async function listPanelServices(channelId, options = {}) {
  const rt = runtimeConfig();
  const def = publicChannelById(channelId);
  if (!def) throw new Error(`Jalur "${channelId}" tidak dikenali.`);
  if (def.type !== 'smm_v2') {
    throw new Error(`Jalur "${channelId}" bukan panel SMM, tidak punya katalog layanan.`);
  }

  const apiUrl = def.id === 'smm_custom' ? rt.customSmm.apiUrl : def.apiUrl;
  const apiKey = getApiKeyForChannel(channelId, rt);
  if (!apiUrl) throw new Error('URL API panel belum diatur.');
  if (!apiKey) throw new Error('API key panel belum diisi.');

  // Baca saldo lebih dulu agar pengguna tahu apakah order memang mampu dibayar.
  let balance = null;
  try {
    const balRes = await smmPost(apiUrl, { key: apiKey, action: 'balance', ...smmExtraFor(channelId, rt) }, 14000);
    if (balRes.json && balRes.json.balance !== undefined) {
      balance = { amount: balRes.json.balance, currency: balRes.json.currency || '' };
    }
  } catch {
    /* panel mungkin tidak punya action balance */
  }

  const services = await smmFetchServices(apiUrl, apiKey, smmExtraFor(channelId, rt), 20000);
  const platform = platformById(options.platform) ? options.platform : 'whatsapp';
  const withScore = services
    .map((s) => ({ ...s, score: scoreService(s, { ...def, apiUrl }, platform) }))
    .sort((a, b) => b.score - a.score || a.rate - b.rate);

  const brief = (s) => ({
    service: s.id,
    name: s.name,
    category: s.category,
    rate: s.rate,
    min: s.min,
    max: s.max,
    score: s.score
  });

  // Layanan apa pun yang menyinggung WhatsApp, terlepas dari cocok atau tidak.
  const waRelated = withScore.filter((s) =>
    /whatsapp|واتساپ|واتس|\bwa\b/i.test(`${s.name} ${s.category}`)
  );

  // Penyaring diagnostik: kata kunci bebas (q) dan/atau hanya yang gratis.
  // "Gratis" = tarif 0 atau namanya menandai diri sebagai sampel gratis.
  const q = String(options.q || '').trim().toLowerCase();
  const qRe = q ? q.split(/\s+/).map((w) => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')) : [];
  const FREE_RE = /رایگان|\bfree\b|\btrial\b|نمونه|🆓|هدیه|هدایا/i;
  const freeOnly = options.free === true || options.free === '1' || options.free === 'true';

  const filtered = withScore.filter((s) => {
    const text = `${s.name} ${s.category}`;
    if (qRe.length && !qRe.every((re) => re.test(text))) return false;
    if (freeOnly && !(Number(s.rate) === 0 || FREE_RE.test(text))) return false;
    return true;
  });

  const scoped = qRe.length > 0 || freeOnly;
  return {
    channelId,
    channelName: def.name,
    apiUrl,
    balance,
    platform,
    query: q || undefined,
    freeOnly: freeOnly || undefined,
    freeServicesInCatalog: withScore.filter(
      (s) => Number(s.rate) === 0 || FREE_RE.test(`${s.name} ${s.category}`)
    ).length,
    rateZeroServices: withScore.filter((s) => Number(s.rate) === 0).length,
    totalServices: services.length,
    matchedServices: withScore.filter((s) => s.score >= 0).length,
    matchedCount: filtered.length,
    matches: filtered.slice(0, 60).map(brief),
    // Field lama hanya untuk kueri tanpa penyaring, agar respons tetap ramping.
    ...(scoped ? {} : { whatsappRelated: waRelated.map(brief), top: withScore.slice(0, 30).map(brief) })
  };
}

module.exports = {
  ensureWahaSession,
  getWahaStatus,

  getPublicConfig,
  parseChannelLink,
  parseTargetLink,
  listPlatforms: () =>
    Object.values(PLATFORMS).map((p) => ({
      id: p.id,
      label: p.label,
      short: p.short,
      example: p.example
    })),
  platformById,
  parseFollowerText,
  probePublicChannel,
  placeFollowerOrder,
  refreshOrder,
  getOrders,
  clearOrders,
  getChannelCatalog,
  updateConfig,
  checkChannelsHealth,
  listPanelServices,
  runtimeConfig,
  maskKey
};
