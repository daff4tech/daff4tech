/**
 * Multi-Gateway Free Public & VIP Pool Adapter untuk WhatsApp Channel Reactions
 * Menggabungkan 4 jaringan server aktif dengan rotasi kunci & failover otomatis:
 *   1. Berry VIP Multi-Key Pool (api.reactionwa.online/api/v2/react — 5 Kunci VIP Permanent)
 *   2. NexaDev VIP Relay (nathan-react-wa.vercel.app/api/rch — Kuota VIP Harian)
 *   3. Leovan 7-Cluster Violetics Pool (www.leovan.my.id/api/react)
 *   4. XIYU Cloud RCH v2 (api-cloud.my.id/tools/rchv2)
 */

const FIRST_NAMES = [
  'Rizky', 'Dimas', 'Fajar', 'Bagas', 'Putra', 'Reza', 'Aldi', 'Ilham', 'Gilang', 'Kevin',
  'Nabila', 'Alya', 'Tiara', 'Siti', 'Putri', 'Anisa', 'Nadya', 'Citra', 'Dewi', 'Zahra'
];
const LAST_NAMES = [
  'Pratama', 'Saputra', 'Nugroho', 'Ramadhan', 'Hidayat', 'Wijaya', 'Santoso', 'Kusuma',
  'Maharani', 'Permata', 'Lestari', 'Pangestu', 'Setiawan', 'Firmansyah', 'Wardhani'
];

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Pool Kunci VIP Berry ReactionWA (Rotasi Round-Robin + Cooldown per Kunci)
const BERRY_VIP_CREDENTIALS = {
  'VIP-SYNOZG8C': { email: 'abovezephyrax@gmail.com', uid: 'syNOzg8C4dfMq8CwnE0inNDNdwn1' },
  'VIP-D68JICP0': { email: 'pribadiarep@gmail.com', uid: 'n6eaa7vLSWdexXeCzDnThjqxHps1' },
  'VIP-G3FA579P': { email: 'berrymodapk@gmail.com', uid: 'G3FA579Px5MLiC4zISunSqergX43' },
  'VIP-H9PQGDBA': { email: 'kenznan123@gmail.com', uid: 'h9PQgdbApBWe1E3p3ZXffnpWOdm1' }
};

const berryKeyPool = [
  {
    name: 'VIP-SYNOZG8C',
    apiKey:
      'BERRY-RCH-XLedTFORQjE0o05upBSBjMhFLyJzA+ZgINzUpnhbQal+Vl0TdTCWhEyR1i7aCFD97C9dPvs7ZAOTkljWouUmpDplbLNpaloI7ybxoXm95mT4To14487VOag=',
    domain: 'https://mytestdomain.com',
    exhaustedAt: 0
  },
  {
    name: 'VIP-G3FA579P',
    apiKey:
      'BERRY-RCH-s488dmV/Im9CYK9RksIKzHB+PKpqxaGBeDje9boybZoMiEoWLc1EmGG2TA9yTgBOCa9RT56a35exUMwqJG06QTO39LJvF7IWZCVq3FKzME50TUNgJH4=',
    domain: 'https://berrymodapk.com',
    exhaustedAt: 0
  },
  {
    name: 'VIP-VIP-D68J',
    apiKey:
      'BERRY-RCH-UF0CX6Lc+ncL7W/kQldo2v+uKbXtjyqhRg6z/u/GJaoL41jILpCerrfSFQBGLSZnNqHvFrIJ5bnOnDTd2K102CgMulKWZfxGbeo/Fmf9Pi4w2mySyBf5dLAnaw==',
    domain: 'https://reactv2.zfile.web.id',
    exhaustedAt: 0
  },
  {
    name: 'VIP-D68JICP0',
    apiKey:
      'BERRY-RCH-Eu3fhllDTNViiwl8dFcVKfMnJUzSt/UFLTftJ/sZJgPy/nCC3Y7JO+83gJLLhicfp+SEEhfruPHhIE3vJrr0oU5mhEfpa2GcBcC4A/GV9VaInumRoLsmSLjBskNQyVE=',
    domain: 'https://api.rech.v2.zfile.web.id',
    exhaustedAt: 0
  },
  {
    name: 'VIP-H9PQGDBA',
    apiKey:
      '5XJr5CoEvcwn6Akmx4TvQPV+ybnaa7VAn8OUYdociEXLS2l06kPypNMFhz5eMExSxrq+/mHz8sOu/5k44dEB016L/QJ3QZpPuYbDiSdpxlVTOR6a14P295M8lQrmMrj0YLJmmne1sQ+1YGhCKSg=',
    domain: 'https://anzzmodsofficial.edgeone.dev',
    exhaustedAt: 0
  }
];

let berryCursor = 0;
let lastBerryCallTs = 0;

let leovanSession = {
  cookie: '',
  updatedAt: 0
};

const SESSION_TTL_MS = 12 * 60 * 1000;
const BERRY_RESET_WINDOW_MS = 6 * 60 * 60 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomSenderName() {
  const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${fn} ${ln}`;
}

async function fetchTimed(url, options = {}, timeoutMs = 30000) {
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

function extractCookies(headers) {
  if (typeof headers.getSetCookie === 'function') {
    const arr = headers.getSetCookie();
    if (arr && arr.length > 0) {
      return arr.map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
    }
  }
  const raw = headers.get('set-cookie') || '';
  if (!raw) return '';
  return raw
    .split(/,(?=\s*[a-zA-Z0-9_-]+=)/)
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

async function ensureLeovanSession(force = false) {
  if (!force && leovanSession.updatedAt && Date.now() - leovanSession.updatedAt < SESSION_TTL_MS) {
    return leovanSession.cookie;
  }
  try {
    const res = await fetchTimed(
      'https://www.leovan.my.id/',
      {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
          'User-Agent': CHROME_UA
        }
      },
      10000
    );
    const c = extractCookies(res.headers);
    leovanSession = { cookie: c, updatedAt: Date.now() };
    return c;
  } catch {
    return '';
  }
}

function buildEmojiPayload(reactions = []) {
  const sorted = [...reactions]
    .filter((r) => r.emoji && Number(r.quantity) > 0)
    .sort((a, b) => Number(b.quantity) - Number(a.quantity));

  const uniqueEmojis = [];
  for (const r of sorted) {
    if (!uniqueEmojis.includes(r.emoji)) {
      uniqueEmojis.push(r.emoji);
    }
  }

  const totalTarget = sorted.reduce((acc, r) => acc + Number(r.quantity || 0), 0);
  const weightedSlots = [];
  if (sorted.length === 1) {
    weightedSlots.push(sorted[0].emoji);
  } else if (sorted.length > 1 && totalTarget > 0) {
    const maxSlots = Math.min(5, Math.max(uniqueEmojis.length, 3));
    for (const r of sorted) {
      const share = Math.max(1, Math.round((Number(r.quantity) / totalTarget) * maxSlots));
      for (let i = 0; i < share && weightedSlots.length < 5; i++) {
        weightedSlots.push(r.emoji);
      }
    }
  }

  return {
    sorted,
    uniqueEmojis: uniqueEmojis.length > 0 ? uniqueEmojis : ['🔥'],
    weightedEmojis: weightedSlots.length > 0 ? weightedSlots : uniqueEmojis,
    totalTarget: Math.max(1, totalTarget)
  };
}

async function tryRefreshBerryKey(keyItem) {
  const cred = BERRY_VIP_CREDENTIALS[keyItem.name];
  if (!cred) return false;
  try {
    const res = await fetchTimed(
      'https://api.reactionwa.online/api/v2/generate_key',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': CHROME_UA },
        body: JSON.stringify({
          vipKey: keyItem.name,
          email: cred.email,
          domain: keyItem.domain,
          uid: cred.uid
        })
      },
      12000
    );
    if (res.json?.success && res.json?.apiKey) {
      keyItem.apiKey = res.json.apiKey;
      return true;
    }
  } catch (_) {}
  return false;
}

/**
 * Gateway 1: Berry VIP Multi-Key Rotation Pool (api.reactionwa.online/api/v2/react)
 */
async function callBerryVipGateway(link, emojiInfo, timeoutMs = 30000) {
  // Jaga jeda anti-flood minimal 3,8 detik antar request di IP yang sama
  const elapsed = Date.now() - lastBerryCallTs;
  if (elapsed < 3800) {
    await sleep(3800 - elapsed);
  }

  const reactionStr = emojiInfo.uniqueEmojis.slice(0, 5).join(',');
  const now = Date.now();
  const candidates = [];

  for (let offset = 0; offset < berryKeyPool.length; offset++) {
    const k = berryKeyPool[(berryCursor + offset) % berryKeyPool.length];
    if (!k.exhaustedAt || now - k.exhaustedAt > BERRY_RESET_WINDOW_MS) {
      candidates.push(k);
    }
  }
  if (candidates.length === 0) candidates.push(...berryKeyPool);

  let lastError = 'Pool VIP sedang penuh';

  for (let idx = 0; idx < Math.min(candidates.length, 3); idx++) {
    const keyObj = candidates[idx];
    berryCursor = (berryCursor + 1) % berryKeyPool.length;

    const origin = keyObj.domain;
    const referer = origin.endsWith('/') ? origin : `${origin}/`;

    lastBerryCallTs = Date.now();
    const res = await fetchTimed(
      'https://api.reactionwa.online/api/v2/react',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: origin,
          Referer: referer,
          'x-api-key': keyObj.apiKey,
          'User-Agent': CHROME_UA
        },
        body: JSON.stringify({ url: link, reaction: reactionStr })
      },
      timeoutMs
    );

    const msg = String(res.json?.message || res.json?.error || `HTTP ${res.status}`);

    if (res.ok && (res.json?.success === true || res.json?.status === 'success')) {
      const taskId = res.json?.data?.task?.key_id || `VIP-${Date.now().toString(36).toUpperCase()}`;
      const used = res.json?.usage_today ?? null;
      const limit = res.json?.limit ?? null;
      const points = res.json?.data?.vip?.pointRemaining;
      return {
        gatewayId: 'berry_vip',
        gatewayName: 'ReactionWA VIP Pool',
        externalOrderId: taskId,
        // Gateway ini hanya mengonfirmasi "masuk antrean", bukan jumlah bot
        // yang benar-benar menekan emoji. Jangan mengarang angka 25 bot.
        botsDispatched: null,
        deliveryVerified: false,
        queueInfo:
          used && limit
            ? `kuota ${used}/${limit}${points !== undefined ? ` • sisa ${points} poin` : ''}`
            : 'antrean diterima',
        clustersInfo: `Antrean VIP diterima${used && limit ? ` (kuota ${used}/${limit})` : ''}`,
        rawResponse: res.json
      };
    }

    lastError = msg;

    // Jika limit harian key ini habis, tandai exhausted dan coba key VIP berikutnya
    if (/limit harian|habis|quota/i.test(msg)) {
      keyObj.exhaustedAt = Date.now();
      continue;
    }

    // Jika key tidak valid / kadaluarsa, coba regenerasi otomatis sekali
    if (res.status === 401 || res.status === 403 || /invalid|key/i.test(msg)) {
      const refreshed = await tryRefreshBerryKey(keyObj);
      if (refreshed) {
        idx--;
        continue;
      }
    }

    // Jika rate-limit beberapa detik (429 Server Sedang Sibuk), tunggu 4.2 detik lalu coba ulang
    if (res.status === 429 || /tunggu beberapa detik|sibuk/i.test(msg)) {
      await sleep(4200);
      lastBerryCallTs = Date.now();
      continue;
    }
  }

  throw new Error(lastError);
}

/**
 * Gateway 2: NexaDev VIP Relay (nathan-react-wa.vercel.app/api/rch)
 */
async function callNexaDevRelayGateway(link, emojiInfo, timeoutMs = 35000) {
  const reactionStr = emojiInfo.uniqueEmojis.slice(0, 5).join(',');
  const u = new URL('https://nathan-react-wa.vercel.app/api/rch');
  u.searchParams.set('url', link);
  u.searchParams.set('reaction', reactionStr);

  const res = await fetchTimed(
    u.toString(),
    {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://nathan-react-wa.vercel.app/',
        'User-Agent': CHROME_UA
      }
    },
    timeoutMs
  );

  if (!res.json) {
    throw new Error(`NexaDev HTTP ${res.status}`);
  }

  const ok =
    res.ok &&
    (res.json.result?.success === true ||
      res.json.status === true ||
      res.json.success === true);

  if (!ok) {
    throw new Error(
      res.json.result?.message || res.json.message || res.json.error || `NexaDev HTTP ${res.status}`
    );
  }

  const rem = res.json.limit_remaining;
  const deducted = Number(res.json.limit_deducted);
  return {
    gatewayId: 'nexadev_vip',
    gatewayName: 'NexaDev VIP Relay',
    externalOrderId: `FREE-NXD-${Date.now().toString(36).toUpperCase()}`,
    botsDispatched: null,
    deliveryVerified: false,
    queueInfo: Number.isFinite(deducted)
      ? `kuota antrean -${deducted}${rem !== undefined ? ` • sisa ${rem}` : ''}`
      : 'antrean diterima',
    clustersInfo:
      rem !== undefined ? `Antrean relay diterima (sisa kuota pool: ${rem})` : 'Antrean relay diterima',
    rawResponse: res.json
  };
}

/**
 * Gateway 3: Leovan Multi-Pool (7 Bot Clusters / Violetics Network)
 */
async function callLeovanGateway(link, emojiInfo, useWeighted = true, timeoutMs = 32000) {
  const emojisArr = useWeighted ? emojiInfo.weightedEmojis : emojiInfo.uniqueEmojis;
  const emojisComma = emojisArr.slice(0, 5).join(', ');
  const senderName = randomSenderName();

  for (let attempt = 0; attempt < 2; attempt++) {
    const sessionCookie = await ensureLeovanSession(attempt > 0);
    const nameCookie = `name=${encodeURIComponent(senderName)}; user_name=${encodeURIComponent(senderName)}`;
    const cookieHeader = sessionCookie ? `${sessionCookie}; ${nameCookie}` : nameCookie;

    const res = await fetchTimed(
      'https://www.leovan.my.id/api/react',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
          'Content-Type': 'application/json',
          Origin: 'https://www.leovan.my.id',
          Referer: 'https://www.leovan.my.id/',
          'User-Agent': CHROME_UA,
          'X-User-Name': senderName,
          Cookie: cookieHeader
        },
        body: JSON.stringify({
          name: senderName,
          url: link,
          link,
          emoji: emojisComma,
          emojis: emojisComma
        })
      },
      timeoutMs
    );

    if ((res.status === 401 || res.status === 403 || res.status === 419) && attempt === 0) {
      continue;
    }

    if (!res.json) {
      throw new Error(`Leovan HTTP ${res.status}`);
    }

    if (!res.ok || res.json.status === false || res.json.ok === false) {
      throw new Error(res.json.message || res.json.msg || res.json.error || 'Kuota Leovan penuh');
    }

    let botsCount = 0;
    const provList = res.json.data?.providers || [];
    for (const p of provList) {
      if (p.ok) {
        const b =
          Number(p.result?.data?.total_bots) ||
          Number(p.result?.data?.total) ||
          Number(p.result?.total) ||
          Number(p.result?.successful) ||
          1;
        botsCount += b;
      }
    }

    const succeededClusters = Number(
      res.json.data?.succeeded ?? provList.filter((p) => p.ok).length
    );
    const requestedClusters = Number(res.json.data?.requested ?? provList.length);

    if (provList.length > 0 && succeededClusters === 0) {
      throw new Error('Sub-cluster Leovan sedang sibuk');
    }

    return {
      gatewayId: 'leovan',
      gatewayName: 'Leovan Multi-Pool (Violetics)',
      externalOrderId: `FREE-LVN-${Date.now().toString(36).toUpperCase()}`,
      botsDispatched: null,
      deliveryVerified: false,
      queueInfo:
        requestedClusters > 0
          ? `${succeededClusters}/${requestedClusters} sub-server aktif`
          : 'antrean diterima',
      clustersInfo:
        requestedClusters > 0
          ? `Antrean diterima (${succeededClusters}/${requestedClusters} sub-server aktif)`
          : 'Antrean diterima',
      rawResponse: res.json
    };
  }

  throw new Error('Sesi Leovan penuh.');
}

/**
 * Gateway 4: XIYU Cloud RCH v2 (api-cloud.my.id/tools/rchv2)
 */
async function callXiyuGateway(link, emojiInfo, timeoutMs = 22000) {
  const u = new URL('https://api-cloud.my.id/tools/rchv2');
  u.searchParams.set('link', link);
  u.searchParams.set('emoji', emojiInfo.uniqueEmojis.slice(0, 10).join(''));

  const res = await fetchTimed(
    u.toString(),
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'XIYU-REACH-CHANNEL-WA/1.0'
      }
    },
    timeoutMs
  );

  if (!res.json || !res.ok || res.json.status === false) {
    throw new Error(res.json?.error || res.json?.message || `XIYU HTTP ${res.status}`);
  }

  const botsCount = Number(res.json.result?.sukses ?? res.json.result?.total);
  return {
    gatewayId: 'xiyu_cloud',
    gatewayName: 'XIYU Cloud RCH v2',
    externalOrderId: `FREE-XYU-${Date.now().toString(36).toUpperCase()}`,
    botsDispatched: null,
    deliveryVerified: false,
    queueInfo: Number.isFinite(botsCount) ? `${botsCount} laporan sub-server` : 'antrean diterima',
    clustersInfo: res.json.quota
      ? `Antrean diterima (sisa kuota ${res.json.quota.remaining}/${res.json.quota.limit})`
      : 'Antrean diterima',
    rawResponse: res.json
  };
}

/**
 * Eksekusi pengiriman reaction gratis dengan Failover Otomatis lintas 4 Gateway
 */
async function sendFreePoolReaction({
  link,
  reactions,
  preferredGateway = 'auto',
  useWeightedEmojis = true,
  timeoutMs = 35000,
  maxGateways = 3
}) {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const perGwTimeout = isServerless ? Math.min(timeoutMs, 14000) : Math.min(timeoutMs, 24000);
  const emojiInfo = buildEmojiPayload(reactions);

  const gatewaysMap = {
    berry_vip: () => callBerryVipGateway(link, emojiInfo, perGwTimeout),
    nexadev_vip: () => callNexaDevRelayGateway(link, emojiInfo, perGwTimeout),
    leovan: () => callLeovanGateway(link, emojiInfo, useWeightedEmojis, perGwTimeout),
    xiyu_cloud: () => callXiyuGateway(link, emojiInfo, perGwTimeout)
  };

  const defaultOrder = ['berry_vip', 'nexadev_vip', 'leovan', 'xiyu_cloud'];
  const order =
    preferredGateway && preferredGateway !== 'auto' && gatewaysMap[preferredGateway]
      ? [preferredGateway, ...defaultOrder.filter((k) => k !== preferredGateway)]
      : defaultOrder;

  // FAN-OUT: kirim ke beberapa jaringan bot sekaligus (paralel) supaya peluang
  // reaction benar-benar muncul lebih besar. Sebelumnya kode berhenti pada
  // gateway pertama yang membalas "queued" — padahal balasan itu belum tentu
  // berarti reaction dipasang.
  const fanoutLimit = Math.min(
    order.length,
    Math.max(1, Math.min(4, Math.floor(Number(maxGateways) || 3)))
  );
  const targets = order.slice(0, fanoutLimit);

  const settled = await Promise.allSettled(targets.map((key) => gatewaysMap[key]()));

  const successes = [];
  const errors = [];
  settled.forEach((res, idx) => {
    if (res.status === 'fulfilled') successes.push(res.value);
    else errors.push(`${targets[idx]}: ${res.reason?.message || 'gagal'}`);
  });

  if (successes.length === 0) {
    throw new Error(
      `Semua gateway reaction gratis gagal merespons: ${errors.join(' | ')}. ` +
        'Coba lagi beberapa saat, atau pakai SMM Panel / Direct API dengan API key sendiri di tab Konfigurasi Server.'
    );
  }

  // Gabungkan info antrean dari semua gateway yang menerima
  const queueInfo = successes
    .map((s) => `${s.gatewayName}${s.queueInfo ? ` (${s.queueInfo})` : ''}`)
    .join(' • ');

  return {
    ok: true,
    gatewayId: successes.length > 1 ? 'multi_pool' : successes[0].gatewayId,
    gatewayName:
      successes.length > 1
        ? `${successes.length} gateway gratis (${successes.map((s) => s.gatewayName).join(', ')})`
        : successes[0].gatewayName,
    externalOrderId: successes
      .map((s) => s.externalOrderId)
      .filter(Boolean)
      .join(','),
    botsDispatched: null,
    deliveryVerified: false,
    queueInfo,
    clustersInfo: `Antrean diterima oleh ${successes.length}/${targets.length} gateway gratis`,
    gateways: successes.map((s) => ({
      id: s.gatewayId,
      name: s.gatewayName,
      orderId: s.externalOrderId,
      info: s.queueInfo || null
    })),
    failedGateways: errors,
    rawResponse: { gateways: successes.map((s) => s.rawResponse), errors }
  };
}

/**
 * Cek kesehatan server API gratis tanpa memotong kuota reaction
 */
async function checkFreeGatewaysHealth() {
  const probe = async (fn) => {
    try {
      return await fn();
    } catch (e) {
      return { online: false, note: `Tidak merespons: ${e.message}` };
    }
  };

  const checks = await Promise.all([
    // 1. ReactionWA VIP pool — endpoint status ringan (tanpa memotong kuota)
    probe(async () => {
      const r = await fetchTimed(
        'https://api.reactionwa.online/api/v2/status',
        { headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' } },
        9000
      );
      const alive = r.status > 0 && r.status < 500;
      return {
        id: 'berry_vip',
        name: 'ReactionWA VIP Pool',
        online: alive,
        note: alive
          ? 'Online • 5 kunci VIP terpasang (antrean)'
          : `HTTP ${r.status || 'timeout'}`,
        queueOnly: true
      };
    }),
    // 2. NexaDev relay
    probe(async () => {
      const r = await fetchTimed(
        'https://nathan-react-wa.vercel.app/',
        { headers: { 'User-Agent': CHROME_UA } },
        9000
      );
      return {
        id: 'nexadev_vip',
        name: 'NexaDev VIP Relay',
        online: r.status === 200,
        note: r.status === 200 ? 'Online • relay antrean' : `HTTP ${r.status}`,
        queueOnly: true
      };
    }),
    // 3. Leovan multi-pool (punya limit harian 5 request)
    probe(async () => {
      const r = await fetchTimed(
        'https://www.leovan.my.id/',
        { headers: { 'User-Agent': CHROME_UA } },
        9000
      );
      const hasEndpoint = r.text.includes('/api/react');
      return {
        id: 'leovan',
        name: 'Leovan Multi-Pool',
        online: r.status === 200 && hasEndpoint,
        note:
          r.status === 200 && hasEndpoint
            ? 'Online • limit harian 5 request'
            : `HTTP ${r.status}`,
        queueOnly: true
      };
    }),
    // 4. XIYU cloud
    probe(async () => {
      const r = await fetchTimed(
        'https://api-cloud.my.id/tools/rchv2',
        { headers: { 'User-Agent': 'XIYU-REACH-CHANNEL-WA/1.0' } },
        9000
      );
      const maintenance = r.json?.maintenance === true || /maintenance/i.test(r.text || '');
      return {
        id: 'xiyu_cloud',
        name: 'XIYU Cloud RCH v2',
        online: !maintenance && r.status === 200,
        note: maintenance ? 'Maintenance (nonaktif)' : r.status === 200 ? 'Online' : `HTTP ${r.status}`,
        queueOnly: true
      };
    })
  ]);

  const onlineCount = checks.filter((c) => c.online).length;
  return {
    onlineCount,
    totalCount: checks.length,
    // alias agar tidak muncul "3/undefined" di UI
    totalGateways: checks.length,
    gateways: checks
  };
}

module.exports = {
  sendFreePoolReaction,
  checkFreeGatewaysHealth,
  buildEmojiPayload
};
