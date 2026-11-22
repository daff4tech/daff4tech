const store = require('./store');
const { sendFreePoolReaction, checkFreeGatewaysHealth } = require('./freePool');

const KNOWN_EMOJIS = [
  '❤️', '👍', '🔥', '😂', '😮', '😢', '🙏', '🎉',
  '💯', '😍', '👏', '🚀', '🥰', '😎', '🤩', '💔'
];

const KEYWORD_EMOJI_MAP = [
  { keywords: ['heart eyes', 'love eyes'], emoji: '😍' },
  { keywords: ['red heart', 'heart', 'love', 'merah'], emoji: '❤️' },
  { keywords: ['thumbs up', 'thumb', 'like', 'jempol'], emoji: '👍' },
  { keywords: ['fire', 'api', 'lit', 'hot'], emoji: '🔥' },
  { keywords: ['laugh', 'haha', 'joy', 'tertawa', 'ngakak'], emoji: '😂' },
  { keywords: ['wow', 'surprised', 'shock', 'kaget'], emoji: '😮' },
  { keywords: ['sad', 'cry', 'sedih', 'nangis'], emoji: '😢' },
  { keywords: ['pray', 'folded', 'thanks', 'doa', 'terima kasih'], emoji: '🙏' },
  { keywords: ['party', 'tada', 'celebrate', 'pesta'], emoji: '🎉' },
  { keywords: ['100', 'hundred', 'seratus'], emoji: '💯' },
  { keywords: ['clap', 'applause', 'tepuk'], emoji: '👏' },
  { keywords: ['rocket', 'roket'], emoji: '🚀' },
  { keywords: ['random', 'mix', 'acak', 'campur', 'positive'], emoji: '*' }
];

function guessEmojiFromServiceName(name = '') {
  const str = String(name);
  for (const em of KNOWN_EMOJIS) {
    if (str.includes(em)) return em;
  }
  // Check heart without variation selector
  if (str.includes('❤')) return '❤️';

  const lower = str.toLowerCase();
  for (const rule of KEYWORD_EMOJI_MAP) {
    if (rule.keywords.some((k) => lower.includes(k))) {
      return rule.emoji;
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, text, json };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cek Koneksi & Saldo Provider
 */
async function checkProviderBalance(provider) {
  if (provider.type === 'free_pool') {
    const health = await checkFreeGatewaysHealth();
    provider.lastBalance = {
      balance: 0,
      currency: 'FREE',
      onlineGateways: health.onlineCount,
      totalGateways: health.totalGateways,
      checkedAt: new Date().toISOString()
    };
    store.save();
    if (health.onlineCount === 0) {
      throw new Error('Seluruh gateway publik gratis sedang tidak merespons. Coba lagi nanti.');
    }
    return {
      ok: true,
      balance: null,
      currency: 'FREE',
      raw: {
        status: true,
        plan: '100% GRATIS (Tanpa API Key)',
        onlineGateways: `${health.onlineCount}/${health.totalGateways || health.totalCount || 0} Server Aktif`,
        queueOnly: true,
        note:
          'Gateway gratis hanya mengonfirmasi "masuk antrean" — bukan bukti reaction sudah menempel di postingan.',
        gateways: health.gateways
      }
    };
  }

  if (provider.type === 'sandbox') {
    await sleep(250);
    const bal = store.data.sandboxBalance ?? 250000;
    const result = {
      ok: true,
      balance: bal,
      currency: provider.currency || 'IDR',
      raw: {
        status: true,
        mode: 'sandbox',
        balance: bal,
        currency: provider.currency || 'IDR',
        message: 'Mode Simulasi aktif dan siap digunakan.'
      }
    };
    provider.lastBalance = {
      balance: bal,
      currency: result.currency,
      checkedAt: new Date().toISOString()
    };
    store.save();
    return result;
  }

  if (provider.type === 'smm_v2') {
    const { apiUrl, apiKey, timeoutMs } = provider.config;
    if (!apiUrl || !apiKey) {
      throw new Error('API URL dan API Key wajib diisi untuk SMM Panel v2.');
    }
    const body = new URLSearchParams({ key: apiKey, action: 'balance' });
    const res = await fetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      },
      Number(timeoutMs) || 25000
    );

    if (!res.json) {
      throw new Error(`Respons bukan JSON valid (HTTP ${res.status}): ${res.text.slice(0, 180)}`);
    }
    if (res.json.error) {
      throw new Error(`Error API: ${res.json.error}`);
    }
    const balance = Number(res.json.balance ?? res.json.data?.balance ?? 0);
    const currency = res.json.currency || provider.currency || 'IDR';
    provider.lastBalance = { balance, currency, checkedAt: new Date().toISOString() };
    store.save();
    return { ok: true, balance, currency, raw: res.json };
  }

  if (provider.type === 'smm_id') {
    const cfg = provider.config;
    if (!cfg.baseUrl || !cfg.apiKey) {
      throw new Error('Base URL dan API Key wajib diisi.');
    }
    const url =
      cfg.mode === 'single_endpoint'
        ? cfg.baseUrl
        : `${cfg.baseUrl.replace(/\/$/, '')}${cfg.profilePath || '/profile'}`;

    const params = { api_key: cfg.apiKey };
    if (cfg.apiId) params.api_id = cfg.apiId;
    if (cfg.secretKey) params.secret_key = cfg.secretKey;
    if (cfg.mode === 'single_endpoint') params.action = 'profile';

    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString()
      },
      Number(cfg.timeoutMs) || 25000
    );

    if (!res.json) {
      throw new Error(`Respons bukan JSON valid (HTTP ${res.status}): ${res.text.slice(0, 180)}`);
    }
    if (res.json.status === false) {
      throw new Error(res.json.data?.msg || res.json.msg || res.json.pesan || 'Autentikasi API gagal.');
    }
    const balance = Number(
      res.json.data?.balance ?? res.json.balance ?? res.json.data?.saldo ?? 0
    );
    const currency = provider.currency || 'IDR';
    provider.lastBalance = { balance, currency, checkedAt: new Date().toISOString() };
    store.save();
    return { ok: true, balance, currency, raw: res.json };
  }

  if (provider.type === 'direct_api') {
    const cfg = provider.config;
    if (!cfg.endpointUrl) {
      throw new Error('Endpoint URL wajib diisi.');
    }
    return {
      ok: true,
      balance: null,
      currency: provider.currency || 'IDR',
      raw: {
        status: 'ready',
        endpointUrl: cfg.endpointUrl,
        method: cfg.method || 'POST',
        note: 'Direct Reaction API siap mengirim request langsung ke endpoint.'
      }
    };
  }

  throw new Error(`Tipe provider tidak dikenali: ${provider.type}`);
}

/**
 * Sinkronisasi Daftar Layanan WhatsApp Channel dari SMM Panel
 */
async function syncProviderServices(provider, filterOnlyWhatsApp = true) {
  if (provider.type === 'sandbox') {
    await sleep(300);
    return {
      totalFetched: provider.cachedServices.length,
      services: provider.cachedServices,
      autoMappedCount: Object.keys(provider.emojiServiceMap).length
    };
  }

  let rawList = [];

  if (provider.type === 'smm_v2') {
    const { apiUrl, apiKey, timeoutMs } = provider.config;
    if (!apiUrl || !apiKey) {
      throw new Error('API URL dan API Key wajib diisi terlebih dahulu.');
    }
    const body = new URLSearchParams({ key: apiKey, action: 'services' });
    const res = await fetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      },
      Number(timeoutMs) || 30000
    );
    if (!res.json) {
      throw new Error(`Respons bukan JSON valid (HTTP ${res.status}).`);
    }
    if (res.json.error) {
      throw new Error(`Error API: ${res.json.error}`);
    }
    rawList = Array.isArray(res.json) ? res.json : res.json.data || [];
  } else if (provider.type === 'smm_id') {
    const cfg = provider.config;
    if (!cfg.baseUrl || !cfg.apiKey) {
      throw new Error('Base URL dan API Key wajib diisi terlebih dahulu.');
    }
    const url =
      cfg.mode === 'single_endpoint'
        ? cfg.baseUrl
        : `${cfg.baseUrl.replace(/\/$/, '')}${cfg.servicesPath || '/services'}`;

    const params = { api_key: cfg.apiKey };
    if (cfg.apiId) params.api_id = cfg.apiId;
    if (cfg.secretKey) params.secret_key = cfg.secretKey;
    if (cfg.mode === 'single_endpoint') params.action = 'services';

    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString()
      },
      Number(cfg.timeoutMs) || 30000
    );
    if (!res.json) {
      throw new Error(`Respons bukan JSON valid (HTTP ${res.status}).`);
    }
    if (res.json.status === false) {
      throw new Error(res.json.data?.msg || res.json.msg || 'Gagal mengambil daftar layanan.');
    }
    rawList = Array.isArray(res.json.data)
      ? res.json.data
      : Array.isArray(res.json)
      ? res.json
      : [];
  } else {
    throw new Error('Sinkronisasi layanan hanya untuk tipe SMM Panel.');
  }

  const normalized = rawList.map((item) => {
    const id = String(item.service ?? item.id ?? item.sid ?? '');
    const name = String(item.name ?? item.layanan ?? item.service_name ?? '');
    const category = String(item.category ?? item.kategori ?? '');
    const rate = Number(item.rate ?? item.price ?? item.harga ?? 0);
    const min = Number(item.min ?? item.min_pesan ?? 1);
    const max = Number(item.max ?? item.max_pesan ?? 100000);
    const emoji = guessEmojiFromServiceName(`${name} ${category}`);
    return { id, name, category, rate, min, max, emoji };
  });

  const filtered = filterOnlyWhatsApp
    ? normalized.filter((s) => {
        const text = `${s.name} ${s.category}`.toLowerCase();
        return (
          text.includes('whatsapp') ||
          text.includes('saluran') ||
          text.includes('wa channel') ||
          text.includes('channel reaction')
        );
      })
    : normalized;

  const finalServices = filtered.length > 0 ? filtered : normalized.slice(0, 300);

  // Auto-map empty emoji slots if matched
  let autoMappedCount = 0;
  if (!provider.emojiServiceMap) provider.emojiServiceMap = {};
  for (const svc of finalServices) {
    if (svc.emoji && !provider.emojiServiceMap[svc.emoji]) {
      provider.emojiServiceMap[svc.emoji] = svc.id;
      autoMappedCount++;
    }
  }

  provider.cachedServices = finalServices;
  store.save();

  return {
    totalFetched: rawList.length,
    services: finalServices,
    autoMappedCount
  };
}

/**
 * Interpolasi template untuk Direct Reaction API
 */
function interpolateTemplate(templateStr, vars) {
  return String(templateStr).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : '';
  });
}

/**
 * Mengirim 1 Sub-Order Reaction (untuk 1 link postingan & 1 jenis emoji + quantity)
 */
async function submitReactionOrder(provider, orderParams) {
  const { link, channelCode, postId, emoji, quantity } = orderParams;

  // 0. MULTI-SERVER PUBLIC FREE POOL (100% GRATIS TANPA API KEY)
  if (provider.type === 'free_pool') {
    const reactionsList =
      Array.isArray(orderParams.reactionsBatch) && orderParams.reactionsBatch.length > 0
        ? orderParams.reactionsBatch
        : [{ emoji, quantity }];

    const freeRes = await sendFreePoolReaction({
      link,
      reactions: reactionsList,
      preferredGateway: provider.config?.preferredGateway || 'auto',
      useWeightedEmojis: provider.config?.useWeightedEmojis !== false,
      timeoutMs: Number(provider.config?.timeoutMs) || 35000
    });

    return {
      ok: true,
      externalOrderId: freeRes.externalOrderId,
      serviceId: `FREE:${freeRes.gatewayId.toUpperCase()}`,
      cost: 0,
      botsDispatched: freeRes.botsDispatched || null,
      gatewayName: freeRes.gatewayName,
      clustersInfo: freeRes.clustersInfo,
      deliveryVerified: freeRes.deliveryVerified === true,
      queueInfo: freeRes.queueInfo || null,
      providerStatus: freeRes.deliveryVerified
        ? freeRes.clustersInfo || 'Terkirim'
        : `Antrean diterima${freeRes.queueInfo ? ` (${freeRes.queueInfo})` : ''}`,
      rawResponse: freeRes.rawResponse
    };
  }

  // 1. SANDBOX SIMULATOR
  if (provider.type === 'sandbox') {
    const latency = Number(provider.config?.simulatedLatencyMs) || 550;
    await sleep(latency + Math.floor(Math.random() * 250));

    const serviceId =
      provider.emojiServiceMap?.[emoji] || provider.emojiServiceMap?.['*'] || '9099';
    const svc = provider.cachedServices?.find((s) => String(s.id) === String(serviceId));
    const rate = svc ? Number(svc.rate) : 6500;
    const cost = Math.round((rate / 1000) * quantity);

    if ((store.data.sandboxBalance ?? 0) < cost) {
      throw new Error(
        `Saldo Sandbox tidak mencukupi (Butuh Rp ${cost.toLocaleString('id-ID')}, sisa Rp ${(
          store.data.sandboxBalance || 0
        ).toLocaleString('id-ID')}). Silakan isi ulang saldo simulasi di tab Konfigurasi API.`
      );
    }

    store.data.sandboxBalance -= cost;
    if (provider.lastBalance) {
      provider.lastBalance.balance = store.data.sandboxBalance;
      provider.lastBalance.checkedAt = new Date().toISOString();
    }
    store.save();

    const externalOrderId = `SBX-${Math.floor(100000 + Math.random() * 900000)}`;
    return {
      ok: true,
      externalOrderId,
      serviceId,
      cost,
      providerStatus: 'In Progress',
      rawResponse: {
        status: true,
        order: externalOrderId,
        service: serviceId,
        link,
        emoji,
        quantity,
        charge: cost,
        currency: 'IDR'
      }
    };
  }

  // 2. SMM PANEL V2
  if (provider.type === 'smm_v2') {
    const { apiUrl, apiKey, timeoutMs } = provider.config;
    if (!apiUrl || !apiKey) {
      throw new Error('Konfigurasi API URL atau API Key belum lengkap.');
    }
    const serviceId =
      orderParams.serviceIdOverride ||
      provider.emojiServiceMap?.[emoji] ||
      provider.emojiServiceMap?.['*'];

    if (!serviceId) {
      throw new Error(
        `Service ID untuk emoji ${emoji} belum diatur di Mapping Emoji (dan tidak ada Service ID Default/Random).`
      );
    }

    const body = new URLSearchParams({
      key: apiKey,
      action: 'add',
      service: String(serviceId),
      link,
      quantity: String(quantity)
    });

    const res = await fetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      },
      Number(timeoutMs) || 25000
    );

    if (!res.json) {
      throw new Error(`Respons API tidak valid (HTTP ${res.status}): ${res.text.slice(0, 180)}`);
    }
    if (res.json.error) {
      throw new Error(`Gagal dari SMM Panel: ${res.json.error}`);
    }

    const externalOrderId = String(res.json.order ?? res.json.data?.order ?? '');
    if (!externalOrderId) {
      throw new Error(`Order ID tidak ditemukan dalam respons: ${JSON.stringify(res.json)}`);
    }

    const svc = provider.cachedServices?.find((s) => String(s.id) === String(serviceId));
    const cost = svc ? Number(((svc.rate / 1000) * quantity).toFixed(2)) : 0;

    return {
      ok: true,
      externalOrderId,
      serviceId: String(serviceId),
      cost,
      providerStatus: 'Processing',
      rawResponse: res.json
    };
  }

  // 3. SMM PANEL INDONESIA (api_id + api_key)
  if (provider.type === 'smm_id') {
    const cfg = provider.config;
    if (!cfg.baseUrl || !cfg.apiKey) {
      throw new Error('Base URL atau API Key SMM Panel belum diisi.');
    }
    const serviceId =
      orderParams.serviceIdOverride ||
      provider.emojiServiceMap?.[emoji] ||
      provider.emojiServiceMap?.['*'];

    if (!serviceId) {
      throw new Error(
        `Service ID untuk emoji ${emoji} belum dipetakan pada Konfigurasi API.`
      );
    }

    const url =
      cfg.mode === 'single_endpoint'
        ? cfg.baseUrl
        : `${cfg.baseUrl.replace(/\/$/, '')}${cfg.orderPath || '/order'}`;

    const params = {
      api_key: cfg.apiKey,
      [cfg.fieldService || 'service']: String(serviceId),
      [cfg.fieldTarget || 'target']: link,
      [cfg.fieldQuantity || 'quantity']: String(quantity)
    };
    if (cfg.apiId) params.api_id = cfg.apiId;
    if (cfg.secretKey) params.secret_key = cfg.secretKey;
    if (cfg.mode === 'single_endpoint') params.action = 'order';

    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString()
      },
      Number(cfg.timeoutMs) || 25000
    );

    if (!res.json) {
      throw new Error(`Respons bukan JSON valid (HTTP ${res.status}): ${res.text.slice(0, 180)}`);
    }
    if (res.json.status === false) {
      throw new Error(
        res.json.data?.msg || res.json.data?.pesan || res.json.msg || 'Pesanan ditolak oleh panel.'
      );
    }

    const externalOrderId = String(
      res.json.data?.id ?? res.json.data?.order ?? res.json.id ?? res.json.order ?? ''
    );
    const svc = provider.cachedServices?.find((s) => String(s.id) === String(serviceId));
    const cost = svc ? Number(((svc.rate / 1000) * quantity).toFixed(2)) : 0;

    return {
      ok: true,
      externalOrderId: externalOrderId || `ORD-${Date.now()}`,
      serviceId: String(serviceId),
      cost,
      providerStatus: 'Processing',
      rawResponse: res.json
    };
  }

  // 4. DIRECT REACTION REST API
  if (provider.type === 'direct_api') {
    const cfg = provider.config;
    if (!cfg.endpointUrl) {
      throw new Error('Endpoint URL Direct API belum diisi.');
    }

    const vars = {
      link,
      channelCode,
      postId,
      emoji,
      emojis: orderParams.emojisJoined || emoji,
      quantity,
      apiKey: cfg.apiKey || ''
    };

    const headers = {};
    if (cfg.apiKey && cfg.authHeaderName) {
      headers[cfg.authHeaderName] = `${cfg.authHeaderPrefix ?? ''}${cfg.apiKey}`;
    }

    const method = (cfg.method || 'POST').toUpperCase();
    let targetUrl = interpolateTemplate(cfg.endpointUrl, vars);
    let body = undefined;

    if (method === 'GET') {
      const u = new URL(targetUrl);
      if (!u.searchParams.has('link')) u.searchParams.set('link', link);
      if (!u.searchParams.has('emoji')) u.searchParams.set('emoji', emoji);
      if (!u.searchParams.has('quantity')) u.searchParams.set('quantity', String(quantity));
      if (cfg.apiKey && !cfg.authHeaderName && !u.searchParams.has('apikey')) {
        u.searchParams.set('apikey', cfg.apiKey);
      }
      targetUrl = u.toString();
    } else {
      const rendered = interpolateTemplate(cfg.bodyTemplate || '{}', vars);
      if (cfg.contentType === 'application/x-www-form-urlencoded') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        const parsedObj = JSON.parse(rendered);
        body = new URLSearchParams(parsedObj).toString();
      } else {
        headers['Content-Type'] = 'application/json';
        // Ensure valid JSON numbers when quantity is interpolated
        body = rendered;
      }
    }

    const res = await fetchWithTimeout(
      targetUrl,
      { method, headers, body },
      Number(cfg.timeoutMs) || 25000
    );

    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status}: ${res.json?.message || res.json?.error || res.text.slice(0, 180)}`
      );
    }
    if (res.json && (res.json.status === false || res.json.ok === false || res.json.error)) {
      throw new Error(
        res.json.message || res.json.error || 'Provider mengembalikan status gagal.'
      );
    }

    const externalOrderId = String(
      res.json?.orderId ?? res.json?.id ?? res.json?.data?.id ?? `DIR-${Date.now().toString(36).toUpperCase()}`
    );
    const rate = Number(cfg.ratePer1000) || 0;
    const cost = rate > 0 ? Number(((rate / 1000) * quantity).toFixed(2)) : 0;

    return {
      ok: true,
      externalOrderId,
      serviceId: 'DIRECT',
      cost,
      providerStatus: 'Completed',
      rawResponse: res.json || { rawText: res.text.slice(0, 250) }
    };
  }

  throw new Error(`Tipe provider tidak didukung: ${provider.type}`);
}

/**
 * Cek Status Sub-Order pada Provider
 */
async function checkOrderStatus(provider, subOrder) {
  if (!subOrder.externalOrderId) {
    return { status: subOrder.status, remains: subOrder.remains ?? 0 };
  }

  if (provider.type === 'sandbox') {
    await sleep(180);
    const createdMs = new Date(subOrder.submittedAt || Date.now()).getTime();
    const elapsedSec = (Date.now() - createdMs) / 1000;
    if (elapsedSec > 12) {
      return {
        providerStatus: 'Completed',
        startCount: subOrder.startCount ?? 14,
        remains: 0
      };
    }
    const ratioLeft = Math.max(0, 1 - elapsedSec / 12);
    return {
      providerStatus: 'In Progress',
      startCount: subOrder.startCount ?? 14,
      remains: Math.ceil(subOrder.quantity * ratioLeft)
    };
  }

  if (provider.type === 'smm_v2') {
    const { apiUrl, apiKey, timeoutMs } = provider.config;
    const body = new URLSearchParams({
      key: apiKey,
      action: 'status',
      order: String(subOrder.externalOrderId)
    });
    const res = await fetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      },
      Number(timeoutMs) || 20000
    );
    if (!res.json || res.json.error) {
      throw new Error(res.json?.error || 'Gagal mengecek status order.');
    }
    return {
      providerStatus: res.json.status || 'Processing',
      startCount: Number(res.json.start_count ?? 0),
      remains: Number(res.json.remains ?? 0),
      raw: res.json
    };
  }

  if (provider.type === 'smm_id') {
    const cfg = provider.config;
    const url =
      cfg.mode === 'single_endpoint'
        ? cfg.baseUrl
        : `${cfg.baseUrl.replace(/\/$/, '')}${cfg.statusPath || '/status'}`;
    const params = {
      api_key: cfg.apiKey,
      id: String(subOrder.externalOrderId)
    };
    if (cfg.apiId) params.api_id = cfg.apiId;
    if (cfg.secretKey) params.secret_key = cfg.secretKey;
    if (cfg.mode === 'single_endpoint') params.action = 'status';

    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString()
      },
      Number(cfg.timeoutMs) || 20000
    );
    if (!res.json || res.json.status === false) {
      throw new Error(res.json?.data?.msg || 'Gagal mengecek status pesanan.');
    }
    const d = res.json.data || res.json;
    return {
      providerStatus: d.status || 'Processing',
      startCount: Number(d.start_count ?? 0),
      remains: Number(d.remains ?? 0),
      raw: res.json
    };
  }

  return {
    providerStatus: subOrder.providerStatus || 'Completed',
    remains: 0
  };
}

module.exports = {
  checkProviderBalance,
  syncProviderServices,
  submitReactionOrder,
  checkOrderStatus,
  guessEmojiFromServiceName
};
