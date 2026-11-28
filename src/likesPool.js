/**
 * likesPool.js — jalur likes gratis.
 *
 * TAHAP 1 (berkas ini): PROBE, bukan order.
 *
 * Kontrak API profollowers.uk hanya diketahui dari registry pihak ketiga
 * (repo ozysparda/skill-free-instagram-likes) yang menyebut
 * `POST /api/trials/` dan balasan berisi `reference: PF-xxxx`. Itu belum
 * pernah diverifikasi sendiri. Sandbox tidak bisa keluar ke domain itu,
 * tetapi deployment Vercel bisa — jadi berkas ini mengirim beberapa
 * permintaan penjajakan dan mengembalikan respons MENTAH apa adanya,
 * supaya alur order ditulis berdasarkan bukti, bukan tebakan.
 *
 * Pelajaran yang diterapkan: jangan menulis pencocokan/parsing dari nama
 * atau bentuk yang dikarang. Baca dulu, baru implementasikan.
 */

'use strict';

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Kandidat yang registry tandai murni-HTTP / ramah IP datacenter.
const LIKE_PANELS = {
  profollowers: {
    id: 'profollowers',
    name: 'ProFollowers — Trials API',
    apiUrl: 'https://www.profollowers.uk/api/trials/',
    transport: 'http',
    yieldLikes: 50,
    note: 'Registry: 50 likes, per email sekali, balasan "reference: PF-xxxx", aman dari IP datacenter.'
  },
  nicesmmpanel: {
    id: 'nicesmmpanel',
    name: 'NiceSMMPanel — API',
    apiUrl: 'https://nicesmmpanel.com/',
    transport: 'http',
    yieldLikes: 50,
    note: 'Registry: 50 likes via API, TAPI menolak IP datacenter ("VPN / Proxy usage detected").'
  }
};

/** Ambil satu URL dan kembalikan status + tubuh mentah (dipotong). */
async function rawRequest(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': CHROME_UA,
        Accept: 'application/json, text/plain, */*',
        ...(options.headers || {})
      }
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* bukan JSON — biarkan null, tubuh mentah tetap dilaporkan */
    }
    return {
      url,
      method: options.method || 'GET',
      sent: options.body ? String(options.body).slice(0, 300) : null,
      status: res.status,
      contentType: res.headers.get('content-type') || null,
      ms: Date.now() - started,
      isJson: json !== null,
      json,
      bodyPreview: text.slice(0, 700),
      bodyLength: text.length
    };
  } catch (err) {
    return {
      url,
      method: options.method || 'GET',
      sent: options.body ? String(options.body).slice(0, 300) : null,
      status: 0,
      error: err.name === 'AbortError' ? `timeout setelah ${timeoutMs} ms` : err.message,
      ms: Date.now() - started
    };
  } finally {
    clearTimeout(timer);
  }
}

function jsonPost(url, payload, timeoutMs) {
  return rawRequest(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    timeoutMs
  );
}

function formPost(url, payload, timeoutMs) {
  return rawRequest(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(payload).toString()
    },
    timeoutMs
  );
}

/**
 * Jajak satu panel: GET dulu, lalu POST dengan badan bertingkat kekosongannya
 * supaya pesan validasi server membocorkan nama field yang wajib.
 */
async function probePanel(panelId, options = {}) {
  const panel = LIKE_PANELS[panelId];
  if (!panel) {
    throw new Error(
      `Panel "${panelId}" tidak dikenali. Yang tersedia: ${Object.keys(LIKE_PANELS).join(', ')}.`
    );
  }

  const link = String(options.link || '').trim();
  const email = String(options.email || '').trim();
  const steps = [];

  // 1. GET — banyak panel membalas daftar layanan atau pesan "method not allowed".
  steps.push(await rawRequest(panel.apiUrl, {}, 12000));

  // 2. POST JSON kosong — harapan: 4xx berisi nama field yang hilang.
  steps.push(await jsonPost(panel.apiUrl, {}, 12000));

  // 3. POST form kosong — sebagian panel hanya menerima urlencoded.
  steps.push(await formPost(panel.apiUrl, {}, 12000));

  // 4. Baru kirim link/email bila pengguna memang memintanya. Tanpa ini probe
  //    tidak menyentuh kuota layanan mana pun.
  if (link) {
    steps.push(await jsonPost(panel.apiUrl, { link, email: email || undefined }, 15000));
    steps.push(await formPost(panel.apiUrl, { link, email }, 15000));
  }

  return {
    panelId: panel.id,
    panelName: panel.name,
    apiUrl: panel.apiUrl,
    registryNote: panel.note,
    claimedYield: panel.yieldLikes,
    probedAt: new Date().toISOString(),
    linkUsed: link || null,
    steps
  };
}

function listLikePanels() {
  return Object.values(LIKE_PANELS).map((p) => ({
    id: p.id,
    name: p.name,
    apiUrl: p.apiUrl,
    transport: p.transport,
    claimedYield: p.yieldLikes,
    note: p.note
  }));
}

module.exports = {
  LIKE_PANELS,
  listLikePanels,
  probePanel,
  rawRequest
};
