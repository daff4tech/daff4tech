/**
 * D4Tech Project — Multi-Tools Free API Hub
 * Menyediakan layanan backend 100% gratis dengan multi-gateway failover:
 *  1. Sosmed & TikTok Downloader Tanpa Watermark (Video HD, Slide Foto, MP3)
 *  2. TikTok Profile Stalker & Engagement Analyzer
 *  3. WhatsApp Channel Info & Stalker
 *  4. AI Background Remover (via Uguu/Tmpfiles + Nexray AI RemoveBG)
 */

const crypto = require('crypto');

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function fetchTimed(url, options = {}, timeoutMs = 28000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
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

/**
 * 1. SOSMED & TIKTOK DOWNLOADER (NO WATERMARK + SLIDE FOTO + MP3)
 */
async function downloadMedia(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Masukkan link URL yang valid (diawali https://).');
  }

  const isTikTok = /tiktok\.com/i.test(url);

  // Gateway A: TikWM (Sangat lengkap untuk TikTok Video HD, Slide Foto, & MP3)
  if (isTikTok) {
    try {
      const r = await fetchTimed(
        'https://www.tikwm.com/api/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': CHROME_UA
          },
          body: new URLSearchParams({ url, hd: '1' }).toString()
        },
        20000
      );
      const j = await r.json();
      if (j && j.code === 0 && j.data) {
        const d = j.data;
        const fixUrl = (u) =>
          !u ? null : u.startsWith('http') ? u : `https://www.tikwm.com${u}`;

        const images = Array.isArray(d.images)
          ? d.images.map(fixUrl).filter(Boolean)
          : [];

        return {
          platform: 'TikTok',
          type: images.length > 0 ? 'slides' : 'video',
          title: d.title || 'Konten TikTok',
          author: {
            nickname: d.author?.nickname || d.author?.unique_id || 'Kreator TikTok',
            username: d.author?.unique_id || '',
            avatar: fixUrl(d.author?.avatar)
          },
          cover: fixUrl(d.cover || d.origin_cover),
          videoHd: images.length === 0 ? fixUrl(d.hdplay || d.play) : null,
          videoSd: images.length === 0 ? fixUrl(d.play) : null,
          audioMp3: fixUrl(d.music || d.music_info?.play),
          images,
          stats: {
            views: d.play_count ?? 0,
            likes: d.digg_count ?? 0,
            comments: d.comment_count ?? 0,
            shares: d.share_count ?? 0
          }
        };
      }
    } catch (_) {
      // Lanjut ke Gateway B
    }
  }

  // Gateway B: Nexray All-In-One Downloader (TikTok, IG, FB, Pinterest, X, dll.)
  try {
    const r = await fetchTimed(
      `https://api.nexray.eu.cc/downloader/aio?url=${encodeURIComponent(url)}`,
      { headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' } },
      25000
    );
    const j = await r.json();
    if (j && j.status && j.result) {
      const res = j.result;
      const medias = Array.isArray(res.medias) ? res.medias : [];
      const videos = medias.filter((m) => m.type === 'video' || /\.mp4/i.test(m.url || ''));
      const audios = medias.filter((m) => m.type === 'audio' || /\.mp3|\.m4a/i.test(m.url || ''));
      const photos = medias
        .filter((m) => m.type === 'image' || m.type === 'photo')
        .map((m) => m.url)
        .filter(Boolean);

      const hdVid =
        videos.find((v) => /hd|no.?watermark/i.test(v.quality || '')) || videos[0];
      const sdVid = videos[1] || videos[0];

      return {
        platform: (res.source || 'Sosmed').toUpperCase(),
        type: photos.length > 0 && !hdVid ? 'slides' : 'video',
        title: res.title || 'Unduhan Media Sosial',
        author: {
          nickname: res.author || res.unique_id || 'Kreator',
          username: res.unique_id || '',
          avatar: null
        },
        cover: res.thumbnail || photos[0] || null,
        videoHd: hdVid?.url || res.video || res.url_download || null,
        videoSd: sdVid?.url || null,
        audioMp3: audios[0]?.url || res.music || null,
        images: photos,
        stats: null
      };
    }
  } catch (_) {
    // Lanjut ke Gateway C
  }

  // Gateway C: DavidCyril TikTok Fallback
  if (isTikTok) {
    const r = await fetchTimed(
      `https://apis.davidcyriltech.my.id/download/tiktok?url=${encodeURIComponent(url)}`,
      { headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' } },
      22000
    );
    const j = await r.json();
    if (j && j.success && j.result) {
      return {
        platform: 'TikTok',
        type: 'video',
        title: j.result.title || 'Video TikTok',
        author: {
          nickname: j.result.author?.nickname || 'Kreator TikTok',
          username: j.result.author?.username || '',
          avatar: j.result.author?.avatar || null
        },
        cover: j.result.cover || null,
        videoHd: j.result.video || j.result.hd || null,
        videoSd: j.result.video || null,
        audioMp3: j.result.audio || j.result.music || null,
        images: [],
        stats: null
      };
    }
  }

  throw new Error(
    'Gagal mengambil media dari tautan tersebut. Pastikan postingan bersifat publik dan link benar.'
  );
}

/**
 * 2. TIKTOK PROFILE STALKER
 */
async function stalkTikTokProfile(rawUsername) {
  const cleanUser = String(rawUsername || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i, '')
    .split(/[/?#]/)[0]
    .trim();

  if (!cleanUser) {
    throw new Error('Masukkan username TikTok terlebih dahulu (contoh: df4tch_).');
  }

  // Gateway 1: DavidCyril tiktokStalk (lengkap dengan stats angka presisi)
  try {
    const r = await fetchTimed(
      `https://apis.davidcyriltech.my.id/tiktokStalk?q=${encodeURIComponent(cleanUser)}`,
      { headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' } },
      18000
    );
    const j = await r.json();
    if (j && (j.status === true || j.success === true) && j.data?.user) {
      const u = j.data.user;
      const st = j.data.stats || {};
      const followers = Number(st.followerCount ?? 0);
      const hearts = Number(st.heartCount ?? st.heart ?? 0);
      const videos = Number(st.videoCount ?? 0);
      const avgLikesPerVid = videos > 0 ? Math.round(hearts / videos) : 0;

      return {
        username: u.uniqueId || cleanUser,
        nickname: u.nickname || cleanUser,
        avatar: u.avatarLarger || u.avatarMedium || u.avatarThumb || null,
        bio: u.signature || 'Tidak ada bio.',
        verified: Boolean(u.verified),
        region: u.region || 'ID',
        profileUrl: `https://www.tiktok.com/@${u.uniqueId || cleanUser}`,
        stats: {
          followers,
          following: Number(st.followingCount ?? 0),
          likes: hearts,
          videos,
          avgLikesPerVid
        }
      };
    }
  } catch (_) {}

  // Gateway 2: Nexray Stalker TikTok
  const r2 = await fetchTimed(
    `https://api.nexray.eu.cc/stalker/tiktok?username=${encodeURIComponent(cleanUser)}`,
    { headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' } },
    18000
  );
  const j2 = await r2.json();
  if (j2 && j2.status && j2.result) {
    const res = j2.result;
    return {
      username: res.username || cleanUser,
      nickname: res.name || res.nickname || cleanUser,
      avatar: res.avatar || res.profile_pic || null,
      bio: res.bio || res.description || 'Tidak ada bio.',
      verified: Boolean(res.verified),
      region: res.region || 'ID',
      profileUrl: `https://www.tiktok.com/@${res.username || cleanUser}`,
      stats: {
        followers: Number(res.followers ?? res.followerCount ?? 0),
        following: Number(res.following ?? res.followingCount ?? 0),
        likes: Number(res.likes ?? res.heartCount ?? 0),
        videos: Number(res.videos ?? res.videoCount ?? 0),
        avgLikesPerVid: 0
      }
    };
  }

  throw new Error(`Profil TikTok @${cleanUser} tidak ditemukan atau sedang privat.`);
}

/**
 * 3. WHATSAPP CHANNEL INFO & STALKER
 */
async function stalkWhatsAppChannel(rawInput) {
  const trimmed = String(rawInput || '').trim();
  const match = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]{6,64})/i
  );
  const inviteCode = match ? match[1] : /^[A-Za-z0-9_-]{12,64}$/.test(trimmed) ? trimmed : null;

  if (!inviteCode) {
    throw new Error(
      'Masukkan link Saluran WhatsApp yang valid (contoh: https://whatsapp.com/channel/0029Vb...).'
    );
  }

  const channelUrl = `https://whatsapp.com/channel/${inviteCode}`;

  // Ambil langsung dari halaman publik WhatsApp Channel (paling akurat untuk jumlah followers)
  try {
    const res = await fetchTimed(
      channelUrl,
      {
        headers: {
          'User-Agent': CHROME_UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8'
        }
      },
      12000
    );
    const html = await res.text();

    const getMeta = (prop) => {
      const m =
        html.match(
          new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i')
        ) ||
        html.match(
          new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${prop}["']`, 'i')
        );
      return m ? decodeEntities(m[1]).trim() : '';
    };

    const title = getMeta('og:title');
    const rawDesc = getMeta('og:description');
    const image = getMeta('og:image');

    if (title && title.toLowerCase() !== 'whatsapp') {
      // Biasanya rawDesc diawali: "Saluran • 1,9 rb pengikut • Deskripsi..." atau "Channel • 1.9K followers • ..."
      let followersText = 'Publik';
      let cleanDesc = rawDesc;
      const parts = rawDesc.split('•').map((s) => s.trim());
      if (parts.length >= 2 && /follower|pengikut/i.test(parts[1])) {
        followersText = parts[1];
        cleanDesc = parts.slice(2).join(' • ').trim();
      }

      const jidMatch = html.match(/(\d{10,25}@newsletter)/);

      return {
        inviteCode,
        channelUrl,
        newsletterJid: jidMatch ? jidMatch[1] : null,
        name: title,
        followersText,
        description: cleanDesc || 'Tidak ada deskripsi saluran.',
        avatar: image || null
      };
    }
  } catch (_) {}

  // Fallback ke DavidCyril /stalk/wa
  const r2 = await fetchTimed(
    `https://apis.davidcyriltech.my.id/stalk/wa?url=${encodeURIComponent(channelUrl)}`,
    { headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' } },
    15000
  );
  const j2 = await r2.json();
  if (j2 && j2.success) {
    return {
      inviteCode,
      channelUrl,
      newsletterJid: null,
      name: String(j2.title || '').replace(/\s*-\s*WhatsApp channel$/i, '') || 'Saluran WhatsApp',
      followersText: j2.followers || 'Publik',
      description: j2.description || '',
      avatar: j2.image || null
    };
  }

  throw new Error('Tidak dapat mengambil informasi saluran WhatsApp tersebut.');
}

/**
 * Helper upload gambar sementara ke Uguu.se -> Tmpfiles.org agar bisa diakses API AI
 */
async function uploadTempImageBuffer(buffer, mimeType = 'image/png') {
  let ext = 'png';
  const m = String(mimeType || '').toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) ext = 'jpg';
  else if (m.includes('webp')) ext = 'webp';
  else if (m.includes('mpeg') || m.includes('mp3')) ext = 'mp3';
  else if (m.includes('mp4')) ext = 'mp4';
  else if (m.includes('m4a') || m.includes('aac')) ext = 'm4a';
  else if (m.includes('wav')) ext = 'wav';
  else if (m.includes('ogg')) ext = 'ogg';
  else if (m.includes('webm')) ext = 'webm';

  // 1. uguu.se (Direct raw image URL tanpa proteksi Cloudflare Bot)
  try {
    const fd = new FormData();
    fd.append('files[]', new Blob([buffer], { type: mimeType }), `d4tech.${ext}`);
    const r = await fetchTimed('https://uguu.se/upload', { method: 'POST', body: fd }, 18000);
    const j = await r.json();
    const u = j?.files?.[0]?.url;
    if (u && u.startsWith('http')) return u;
  } catch (_) {}

  // 2. tmpfiles.org direct download
  try {
    const fd2 = new FormData();
    fd2.append('file', new Blob([buffer], { type: mimeType }), `d4tech.${ext}`);
    const r2 = await fetchTimed(
      'https://tmpfiles.org/api/v1/upload',
      { method: 'POST', body: fd2 },
      18000
    );
    const j2 = await r2.json();
    const rawTmpUrl = j2?.data?.url;
    if (rawTmpUrl && rawTmpUrl.includes('tmpfiles.org/')) {
      return rawTmpUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    }
  } catch (_) {}

  throw new Error('Gagal mengunggah gambar sementara untuk pemrosesan AI.');
}

/**
 * Upload buffer langsung ke server Gradio 5 Space (/gradio_api/upload) tanpa perlu host pihak ke-3
 */
async function uploadBufferToGradioSpace(baseUrl, buffer, mimeType = 'image/png') {
  const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
  const fd = new FormData();
  fd.append('files', new Blob([buffer], { type: mimeType }), `input.${ext}`);
  const r = await fetchTimed(`${baseUrl}/gradio_api/upload`, { method: 'POST', body: fd }, 18000);
  const paths = await r.json();
  const serverPath = Array.isArray(paths) ? paths[0] : null;
  if (!serverPath) throw new Error('Gagal mengunggah ke GPU Space.');
  return {
    path: serverPath,
    orig_name: `input.${ext}`,
    mime_type: mimeType,
    meta: { _type: 'gradio.FileData' }
  };
}

/**
 * Helper panggil Hugging Face Gradio 5 Cloud GPU Space (Queue + SSE Complete)
 */
async function callGradio5Space(baseUrl, epName, dataArr, timeoutMs = 40000) {
  const cleanEp = String(epName || '').replace(/^\//, '');
  const r1 = await fetchTimed(
    `${baseUrl}/gradio_api/call/${cleanEp}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': CHROME_UA },
      body: JSON.stringify({ data: dataArr })
    },
    14000
  );
  const j1 = await r1.json();
  if (!j1?.event_id) {
    throw new Error('Antrean GPU penuh sementara.');
  }

  const r2 = await fetchTimed(
    `${baseUrl}/gradio_api/call/${cleanEp}/${j1.event_id}`,
    { headers: { 'User-Agent': CHROME_UA } },
    timeoutMs
  );
  const sse = await r2.text();
  const lines = sse.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('event: complete') && lines[i + 1]?.startsWith('data: ')) {
      return JSON.parse(lines[i + 1].slice(6));
    }
    if (lines[i].startsWith('event: error')) {
      throw new Error('GPU menolak permintaan.');
    }
  }
  throw new Error('Waktu tunggu GPU habis.');
}

async function fetchImageUrlToDataUrl(url, timeoutMs = 30000) {
  const res = await fetchTimed(url, { headers: { 'User-Agent': CHROME_UA } }, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = String(res.headers.get('content-type') || '').toLowerCase();
  const arrBuf = await res.arrayBuffer();
  const buf = Buffer.from(arrBuf);
  if (buf.length < 256) throw new Error('Data gambar kosong.');

  if (ct.includes('image/') || (buf[0] === 0x89 && buf[1] === 0x50) || (buf[0] === 0xff && buf[1] === 0xd8)) {
    const mime = ct.includes('image/')
      ? ct.split(';')[0]
      : buf[0] === 0x89
        ? 'image/png'
        : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  }

  const json = JSON.parse(buf.toString('utf8'));
  const nestedUrl = json?.url || json?.result || json?.data?.url;
  if (nestedUrl && /^https?:\/\//i.test(nestedUrl)) {
    return fetchImageUrlToDataUrl(nestedUrl, 22000);
  }
  throw new Error('Respons bukan gambar.');
}

/**
 * 4. AI REMOVE BACKGROUND (Multi-Gateway: Nexray -> HuggingFace BiRefNet GPU -> DavidCyril)
 */
async function removeImageBackground({ imageBase64, imageUrl }) {
  let publicImageUrl = '';
  let rawBuffer = null;
  let rawMime = 'image/png';

  if (imageUrl && /^https?:\/\//i.test(imageUrl.trim())) {
    publicImageUrl = imageUrl.trim();
  } else if (imageBase64 && imageBase64.startsWith('data:image/')) {
    const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) throw new Error('Format gambar tidak valid.');
    rawMime = match[1];
    rawBuffer = Buffer.from(match[2], 'base64');
    if (rawBuffer.length > 8 * 1024 * 1024) {
      throw new Error('Ukuran gambar terlalu besar (maksimal 8 MB).');
    }
    try {
      publicImageUrl = await uploadTempImageBuffer(rawBuffer, rawMime);
    } catch (_) {
      publicImageUrl = '';
    }
  } else {
    throw new Error('Pilih foto terlebih dahulu.');
  }

  // Gateway 1: Nexray RemoveBG
  if (publicImageUrl) {
    try {
      const dataUrl = await fetchImageUrlToDataUrl(
        `https://api.nexray.eu.cc/tools/removebg?url=${encodeURIComponent(publicImageUrl)}`,
        32000
      );
      return { resultDataUrl: dataUrl };
    } catch (_) {}
  }

  // Gateway 2: Hugging Face Cloud GPU BiRefNet (Direct Binary Upload atau URL)
  try {
    const spaceUrl = 'https://not-lain-background-removal.hf.space';
    const fileData = rawBuffer
      ? await uploadBufferToGradioSpace(spaceUrl, rawBuffer, rawMime)
      : { path: publicImageUrl, url: publicImageUrl, meta: { _type: 'gradio.FileData' } };
    const out = await callGradio5Space(spaceUrl, 'image', [fileData], 38000);
    const outFile = Array.isArray(out?.[0]) ? out[0][0] : out?.[0];
    const outUrl = outFile?.url;
    if (outUrl) {
      const dataUrl = await fetchImageUrlToDataUrl(outUrl, 22000);
      return { resultDataUrl: dataUrl };
    }
  } catch (_) {}

  // Gateway 3: DavidCyril RemoveBG
  if (publicImageUrl) {
    try {
      const dataUrl = await fetchImageUrlToDataUrl(
        `https://apis.davidcyriltech.my.id/removebg?url=${encodeURIComponent(publicImageUrl)}`,
        28000
      );
      return { resultDataUrl: dataUrl };
    } catch (_) {}
  }

  throw new Error('Seluruh server AI RemoveBG sedang antre penuh. Silakan klik proses ulang.');
}

/**
 * 5. YOUTUBE SEARCH & YOUTUBE TO MP3 MULTI-QUALITY (64, 96, 128, 192, 256, 320 kbps)
 */
const ALLOWED_MP3_QUALITIES = ['64', '96', '128', '192', '256', '320'];

let cachedYtServers = null;
let cachedYtServersAt = 0;

async function getYtConverterServers() {
  const DEFAULT_SERVERS = {
    api: 'https://api.apiapi2.lat',
    api3: 'https://api3.apiapi2.lat',
    api5: 'https://api5.apiapi2.lat'
  };
  if (cachedYtServers && Date.now() - cachedYtServersAt < 30 * 60 * 1000) {
    return cachedYtServers;
  }
  try {
    const res = await fetchTimed(
      'https://ogmp3.com/v2/',
      { headers: { 'User-Agent': CHROME_UA } },
      8000
    );
    const html = await res.text();
    const m = html.match(/id="converter-config"[^>]*>([\s\S]*?)<\/script>/i);
    if (m) {
      const parsed = JSON.parse(m[1]);
      if (parsed?.servers?.api && parsed?.servers?.api3) {
        cachedYtServers = parsed.servers;
        cachedYtServersAt = Date.now();
        return cachedYtServers;
      }
    }
  } catch (_) {}
  return DEFAULT_SERVERS;
}

function extractYouTubeVideoId(rawInput = '') {
  const val = String(rawInput || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(val)) return val;

  try {
    const u = new URL(/^https?:\/\//i.test(val) ? val : `https://${val}`);
    const host = u.hostname.toLowerCase();
    const parts = u.pathname.split('/').filter(Boolean);

    if (host === 'youtu.be' && parts[0]) {
      const id = parts[0].slice(0, 11);
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
    }

    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = u.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      if (['shorts', 'embed', 'live', 'v'].includes(parts[0]) && parts[1]) {
        const id = parts[1].slice(0, 11);
        if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
      }
    }
  } catch (_) {}

  const fallback = val.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
  return fallback ? fallback[1] : null;
}

async function searchYouTubeVideos(rawQuery) {
  const q = String(rawQuery || '').trim();
  if (!q) throw new Error('Masukkan judul lagu atau kata kunci pencarian YouTube.');

  const res = await fetchTimed(
    `https://api.nexray.eu.cc/search/youtube?q=${encodeURIComponent(q)}`,
    { headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' } },
    18000
  );
  const json = await res.json();
  if (!json?.status || !Array.isArray(json.result) || json.result.length === 0) {
    throw new Error('Tidak ditemukan hasil video YouTube untuk kata kunci tersebut.');
  }

  return json.result.slice(0, 8).map((item) => ({
    videoId: item.id || extractYouTubeVideoId(item.url),
    title: item.title || 'Video YouTube',
    channel: item.channel || 'YouTube',
    duration: item.duration || '-',
    views: item.views || '',
    thumbnail: item.image_url || item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    url: item.url || `https://www.youtube.com/watch?v=${item.id}`
  }));
}

async function convertYouTubeMp3({ url: rawUrl, quality: rawQuality = '192' }) {
  const videoId = extractYouTubeVideoId(rawUrl);
  if (!videoId) {
    throw new Error(
      'Link YouTube tidak valid. Tempel link youtube.com/watch?v=..., youtu.be/..., Shorts, atau cari judul lagu terlebih dahulu.'
    );
  }

  const quality = ALLOWED_MP3_QUALITIES.includes(String(rawQuality))
    ? String(rawQuality)
    : '192';
  const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Ambil metadata oEmbed secara paralel untuk nama channel & judul bersih
  const oembedPromise = fetchTimed(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`,
    { headers: { 'User-Agent': CHROME_UA } },
    6000
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  const servers = await getYtConverterServers();
  const origin = quality === '128' ? servers.api : servers.api3;

  const randHash = () => crypto.randomBytes(16).toString('hex');
  const encPath = (u) =>
    Array.from(u, (ch) => ch.charCodeAt(0))
      .reverse()
      .join(',');
  const encBody = (u) =>
    Array.from(u, (ch) => String.fromCharCode(ch.charCodeAt(0) ^ 1)).join('');
  const pkPart = (pk) => (pk === null || pk === undefined || pk === '' ? '' : `${pk}/`);
  const makeJobUrl = (action, id, pk) =>
    `${origin}/${randHash()}/${action}/${id}/${randHash()}/${pkPart(pk)}`;

  const convHeaders = {
    'Content-Type': 'application/json',
    Origin: 'https://ogmp3.com',
    Referer: 'https://ogmp3.com/',
    'User-Agent': CHROME_UA
  };

  let initRes = await fetchTimed(
    `${origin}/${randHash()}/init/${encPath(normalizedUrl)}/${randHash()}/`,
    {
      method: 'POST',
      headers: convHeaders,
      body: JSON.stringify({
        data: encBody(normalizedUrl),
        format: '0',
        referer: '',
        mp3Quality: quality,
        mp4Quality: '720',
        userTimeZone: '-420'
      })
    },
    22000
  );

  if (!initRes.ok) {
    throw new Error('Server konversi YouTube MP3 sedang sibuk. Silakan coba sesaat lagi.');
  }

  let data = await initRes.json();
  if (data.le) throw new Error('Durasi video terlalu panjang untuk dikonversi ke MP3.');
  if (data.i === 'invalid' || data.e || data.s === 'E') {
    throw new Error('Video tidak dapat dikonversi (mungkin dibatasi usia/wilayah atau privat).');
  }

  const jobId = String(data.i || '');
  let pk = data.pk ?? '';
  const deadline = Date.now() + 75000;

  while (data.s === 'P') {
    if (Date.now() > deadline) {
      throw new Error('Waktu konversi habis untuk video ini. Coba kualitas lain atau ulangi.');
    }
    await new Promise((r) => setTimeout(r, 1700));
    const stRes = await fetchTimed(
      makeJobUrl('status', jobId, pk),
      {
        method: 'POST',
        headers: convHeaders,
        body: JSON.stringify({ data: jobId })
      },
      15000
    );
    data = await stRes.json();
    if (data.e || data.s === 'E') {
      throw new Error('Gagal mengonversi audio dari video ini.');
    }
    if (data.pk !== null && data.pk !== undefined) {
      pk = data.pk;
    }
  }

  const finalId = String(data.i || jobId);
  const directMp3Url = makeJobUrl('download', finalId, pk);
  const previewMp3Url = makeJobUrl('download', finalId, pk);

  // Cek Content-Length ringan via HEAD/Range atau estimasi
  let fileSizeBytes = null;
  try {
    const probe = await fetchTimed(
      makeJobUrl('download', finalId, pk),
      {
        method: 'GET',
        headers: { 'User-Agent': CHROME_UA, Referer: 'https://ogmp3.com/' }
      },
      8000
    );
    const cl = Number(probe.headers.get('content-length') || 0);
    if (cl > 0) fileSizeBytes = cl;
    await probe.body?.cancel();
  } catch (_) {}

  const oembed = await oembedPromise;
  const title = data.t || oembed?.title || `YouTube Audio (${videoId})`;
  const channel = oembed?.author_name || 'YouTube';
  const thumbnail =
    oembed?.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return {
    videoId,
    youtubeUrl: normalizedUrl,
    title,
    channel,
    thumbnail,
    quality: `${quality} kbps`,
    qualityValue: quality,
    fileSizeBytes,
    fileSizeText: fileSizeBytes ? `${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB` : null,
    downloadUrl: directMp3Url,
    previewUrl: previewMp3Url
  };
}

module.exports = {
  downloadMedia,
  stalkTikTokProfile,
  stalkWhatsAppChannel,
  removeImageBackground,
  searchYouTubeVideos,
  convertYouTubeMp3,
  uploadTempImageBuffer,
  uploadBufferToGradioSpace,
  callGradio5Space,
  fetchImageUrlToDataUrl
};
