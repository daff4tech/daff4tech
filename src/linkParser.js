/**
 * Parser & Validator untuk Link Postingan Saluran WhatsApp
 * Format standar: https://whatsapp.com/channel/<channelCode>/<postId>
 */

const CHANNEL_POST_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]{6,64})\/(\d+)(?:\/)?(?:\?.*)?$/i;

const CHANNEL_ONLY_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]{6,64})(?:\/)?(?:\?.*)?$/i;

function decodeHtmlEntities(str = '') {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
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

function parseWhatsAppPostLink(rawInput) {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Link postingan tidak boleh kosong.'
    };
  }

  const postMatch = trimmed.match(CHANNEL_POST_REGEX);
  if (postMatch) {
    const channelCode = postMatch[1];
    const postId = postMatch[2];
    const normalizedUrl = `https://whatsapp.com/channel/${channelCode}/${postId}`;
    return {
      valid: true,
      channelCode,
      postId,
      normalizedUrl,
      channelUrl: `https://whatsapp.com/channel/${channelCode}`
    };
  }

  const channelOnlyMatch = trimmed.match(CHANNEL_ONLY_REGEX);
  if (channelOnlyMatch) {
    return {
      valid: false,
      channelCode: channelOnlyMatch[1],
      error:
        'Ini adalah link profil Saluran, bukan link Postingan. Buka saluran di WhatsApp, tekan tahan postingan → Bagikan/Salin Tautan sehingga diakhiri angka ID postingan (contoh: https://whatsapp.com/channel/' +
        channelOnlyMatch[1] +
        '/125).'
    };
  }

  return {
    valid: false,
    error:
      'Format link tidak valid. Gunakan format: https://whatsapp.com/channel/<ID_SALURAN>/<ID_POSTINGAN>'
  };
}

function parseBulkLinks(rawText) {
  const lines = String(rawText || '')
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const validLinks = [];
  const invalidLinks = [];
  const seen = new Set();

  for (const line of lines) {
    const res = parseWhatsAppPostLink(line);
    if (res.valid) {
      if (!seen.has(res.normalizedUrl)) {
        seen.add(res.normalizedUrl);
        validLinks.push(res);
      }
    } else {
      invalidLinks.push({ input: line, error: res.error });
    }
  }

  return { validLinks, invalidLinks };
}

async function fetchChannelMetadata(parsedLink) {
  const fallback = {
    channelName: `Saluran WhatsApp (${parsedLink.channelCode.slice(0, 10)}…)`,
    postSnippet: `Postingan #${parsedLink.postId} siap menerima reaction.`,
    avatarUrl: null,
    fetchedLive: false
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(parsedLink.normalizedUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml'
      }
    });
    clearTimeout(timeout);

    if (!res.ok) return fallback;
    const html = await res.text();

    const extractMeta = (prop) => {
      const r1 = new RegExp(
        `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`,
        'i'
      );
      const r2 = new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`,
        'i'
      );
      const m = html.match(r1) || html.match(r2);
      return m ? decodeHtmlEntities(m[1]).trim() : '';
    };

    const ogTitle = extractMeta('og:title');
    const ogDesc = extractMeta('og:description');
    const ogImage = extractMeta('og:image');

    const genericTitles = ['whatsapp', 'whatsapp channel', 'saluran whatsapp', ''];
    const hasCustomTitle =
      ogTitle && !genericTitles.includes(ogTitle.toLowerCase());

    return {
      channelName: hasCustomTitle ? ogTitle : fallback.channelName,
      postSnippet: ogDesc || fallback.postSnippet,
      avatarUrl: ogImage && ogImage.startsWith('https://') ? ogImage : null,
      fetchedLive: Boolean(hasCustomTitle || ogDesc)
    };
  } catch {
    clearTimeout(timeout);
    return fallback;
  }
}


/**
 * Verifikasi bahwa Saluran + postingan benar-benar ada di WhatsApp.
 *
 * Latar belakang: gateway "API gratis" menerima link apa pun dan membalas
 * "queued" — termasuk untuk channel/postingan yang tidak ada. Akibatnya UI
 * melaporkan "reaction berhasil terkirim" padahal tidak ada apa pun yang
 * dikirim. Fungsi ini membaca halaman pratinjau publik WhatsApp dan menolak
 * link mati sebelum request dikirim ke provider.
 */
const CHANNEL_VERIFY_TTL_MS = 10 * 60 * 1000;
const channelVerifyCache = new Map();

function isGenericChannelTitle(title = '') {
  const t = String(title).toLowerCase().trim();
  return !t || t === 'whatsapp' || t === 'whatsapp channel' || t === 'saluran whatsapp';
}

async function verifyChannelPost(parsedLink, { timeoutMs = 9000 } = {}) {
  const fallback = {
    exists: null, // null = tidak dapat diverifikasi (jaringan/WhatsApp menolak)
    channelName: null,
    followers: null,
    postSnippet: null,
    avatarUrl: null,
    reason: 'Verifikasi ke WhatsApp tidak tersedia saat ini.'
  };

  if (!parsedLink?.channelCode) return fallback;

  const cached = channelVerifyCache.get(parsedLink.channelCode);
  if (cached && Date.now() - cached.checkedAt < CHANNEL_VERIFY_TTL_MS) {
    return cached.value;
  }

  const target = `https://www.whatsapp.com/channel/${parsedLink.channelCode}/${
    parsedLink.postId || ''
  }`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(target, {
      redirect: 'follow',
      signal: controller.signal,
      headers: [
        ['User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'],
        ['Accept', 'text/html,application/xhtml+xml'],
        ['Accept-Language', 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7']
      ]
    });

    if (!res.ok) {
      const value = {
        ...fallback,
        exists: false,
        reason: `WhatsApp membalas HTTP ${res.status} untuk link tersebut.`
      };
      channelVerifyCache.set(parsedLink.channelCode, { value, checkedAt: Date.now() });
      return value;
    }

    const html = await res.text();
    const extractMeta = (prop) => {
      const r1 = new RegExp(
        `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`,
        'i'
      );
      const r2 = new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`,
        'i'
      );
      const m = html.match(r1) || html.match(r2);
      return m ? decodeHtmlEntities(m[1]).trim() : '';
    };

    const ogTitle = extractMeta('og:title');
    const ogDesc = extractMeta('og:description');
    const ogImage = extractMeta('og:image');

    const followerMatch = ogDesc.match(/([\d.,]+\s*(?:K|M|jt|rb)?)\s*(?:followers|pengikut)/i);
    const hasFollowerInfo = Boolean(followerMatch) || /followers|pengikut/i.test(ogDesc);
    const looksLikeChannel = !isGenericChannelTitle(ogTitle);
    const exists = looksLikeChannel || hasFollowerInfo;

    const value = {
      exists,
      channelName: looksLikeChannel ? ogTitle : null,
      followers: followerMatch ? followerMatch[1].trim() : null,
      postSnippet: ogDesc || null,
      avatarUrl: /^https:\/\//.test(ogImage) ? ogImage : null,
      reason: exists
        ? null
        : 'Saluran tidak ditemukan di WhatsApp. Periksa kembali link postingan (tahan postingan → Salin tautan).'
    };

    channelVerifyCache.set(parsedLink.channelCode, { value, checkedAt: Date.now() });
    return value;
  } catch (err) {
    return { ...fallback, reason: `Gagal menghubungi WhatsApp: ${err.message}` };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  parseWhatsAppPostLink,
  parseBulkLinks,
  fetchChannelMetadata,
  verifyChannelPost
};
