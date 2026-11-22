/**
 * D4Tech Hub v3.0 — Extra AI, Creator & Cyber Security Tools Backend
 * 100% Free Multi-Gateway Handlers:
 *  - AI TikTok Profile Roaster & Skor Aura
 *  - AI Foto HD Enhancer (Remini)
 *  - AI Image Generator (Text-to-Image HD)
 *  - Voice Over Narator Konten (Multi-Language TTS MP3)
 *  - Pencari Lirik Lagu (LRCLIB) untuk Spotify Lyrics Card
 *  - Detektif Username OSINT Scanner (18 Platform)
 *  - Anti-Phishing Link Unshortener & GeoIP Server Scanner
 *  - URL Shortener Gratis (is.gd & TinyURL)
 */

const dns = require('dns').promises;
const crypto = require('crypto');
const toolsHub = require('./toolsHub');

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function fetchTimed(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isPrivateOrLocalIp(ipOrHost = '') {
  const h = String(ipOrHost).toLowerCase().trim();
  if (
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.startsWith('127.') ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    h.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h) ||
    h.startsWith('fc') ||
    h.startsWith('fd') ||
    h.startsWith('fe80:')
  ) {
    return true;
  }
  return false;
}

/**
 * Helper panggil AI Teks Gratis (4-Engine Failover: Claude -> Copilot -> Gemini -> Pollinations)
 */
async function askFreeAiText(promptText) {
  const fullInstruction = `Kamu adalah kreator konten dan komika netizen Indonesia yang cerdas, gaul, lucu, tapi tetap aman (tanpa SARA). Jawab langsung tanpa pembuka basa-basi.\n\n${promptText}`;

  // Gateway 1, 2, 3: Nexray Claude Haiku 4.5, Microsoft Copilot, & Google Gemini (Tanpa jeda 45 detik!)
  for (const ep of ['claude', 'copilot', 'gemini']) {
    try {
      const r = await fetchTimed(
        `https://api.nexray.eu.cc/ai/${ep}?text=${encodeURIComponent(fullInstruction)}`,
        { headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' } },
        14000
      );
      if (!r.ok) continue;
      const j = await r.json();
      const raw =
        typeof j?.result === 'string'
          ? j.result
          : j?.result?.text || j?.result?.response || j?.message || '';
      const txt = String(raw || '').trim();
      if (txt && txt.length > 20) return txt;
    } catch (_) {}
  }

  // Gateway 4: Pollinations Text POST
  try {
    const r4 = await fetchTimed(
      'https://text.pollinations.ai/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': CHROME_UA },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content:
                'Kamu adalah kreator konten dan komika netizen Indonesia yang cerdas, gaul, lucu, tapi tetap aman. Jawab langsung.'
            },
            { role: 'user', content: promptText }
          ],
          model: 'openai'
        })
      },
      14000
    );
    if (r4.ok) {
      const txt = (await r4.text()).trim();
      if (txt && txt.length > 20 && !txt.startsWith('<!DOCTYPE') && !txt.startsWith('{')) {
        return txt;
      }
    }
  } catch (_) {}

  return null;
}

/**
 * 1. AI ROASTER & SKOR AURA AKUN TIKTOK
 */
async function roastTikTokAccount({ username, mode = 'savage' }) {
  const profile = await toolsHub.stalkTikTokProfile(username);
  const { followers, following, likes, videos } = profile.stats;

  // Hitung Skor Aura terukur namun seru
  const ratioLikes = followers > 0 ? likes / followers : likes;
  let auraPoints =
    Math.round(followers * 1.8 + likes * 0.15 + videos * 45 - following * 0.4) + 500;
  if (profile.verified) auraPoints += 50000;
  if (followers < following && followers < 200) auraPoints = Math.min(auraPoints, 420);

  let auraTier = '✨ Kreator Naik Daun';
  if (auraPoints >= 100000) auraTier = '👑 Dewa FYP (+999K Aura)';
  else if (auraPoints >= 15000) auraTier = '🔥 Seleb Tongkrongan Digital';
  else if (auraPoints >= 2500) auraTier = '⚡ Pejuang Konten Konsisten';
  else if (videos === 0) auraTier = '👻 Pasukan Scroll Tanpa Upload';
  else auraTier = '🌱 Warga TikTok Santuy';

  const styleInstruction =
    mode === 'aura'
      ? 'Berikan pembacaan "Aura Digital" yang dramatis, keren, memuji tapi tetap jenaka ala anak TikTok Gen-Z Indonesia (3-4 kalimat singkat).'
      : mode === 'tongkrongan'
        ? 'Roasting tipis-tipis bergaya teman tongkrongan warkop yang akrab, kocak, receh, dan relate dalam Bahasa Indonesia gaul (3-4 kalimat singkat).'
        : 'Roasting pedas kocak ala netizen +62 tentang perbandingan followers, following, jumlah video, dan bio akun ini dengan gaya punchline stand-up comedy (3-4 kalimat singkat, tanpa kata kasar/SARA).';

  const prompt = `Data Akun TikTok:
- Username: @${profile.username}
- Nama: ${profile.nickname}
- Bio: "${profile.bio}"
- Pengikut: ${followers}, Mengikuti: ${following}, Total Likes: ${likes}, Jumlah Video: ${videos}
Tugas: ${styleInstruction} Jangan pakai tanda bintang markdown (*). Maksimal 65 kata.`;

  let roastText = await askFreeAiText(prompt);

  // Fallback pintar apabila AI eksternal sedang penuh
  if (!roastText) {
    if (mode === 'aura') {
      roastText = `Aura digital @${profile.username} memancarkan sinyal "${auraTier}"! Dengan ${followers.toLocaleString('id-ID')} pengikut dan ${likes.toLocaleString('id-ID')} likes, akun "${profile.nickname}" punya potensi meledak di FYP asal konsisten upload dan nggak cuma rajin nyimpen draft doang!`;
    } else if (videos === 0) {
      roastText = `Akun @${profile.username} ini definisi intel sejati di TikTok: video 0 biji, tapi mantengin FYP tiap malam! Bio-nya udah keren, sayang tombol upload-nya kayaknya masih disegel plastik pabrik nih.`;
    } else if (following > followers * 2) {
      roastText = `Waduh @${profile.username}, yang di-follow ${following.toLocaleString('id-ID')} orang tapi yang follow balik baru ${followers.toLocaleString('id-ID')}—ini akun TikTok apa panitia sensus penduduk? Tapi salut, ${likes.toLocaleString('id-ID')} likes membuktikan kontenmu mulai dilirik algoritma!`;
    } else {
      roastText = `Gaya @${profile.username} (${profile.nickname}) udah berasa seleb dengan ${likes.toLocaleString('id-ID')} likes dari ${videos} video! Tinggal dikencengin lagi jadwal upload-nya biar rasio ${ratioLikes.toFixed(1)}x likes-nya makin bikin tetangga iri.`;
    }
  }

  roastText = roastText.replace(/\*\*/g, '').replace(/^["']|["']$/g, '').trim();

  return {
    profile,
    mode,
    auraScore: `${auraPoints >= 0 ? '+' : ''}${auraPoints.toLocaleString('id-ID')} Aura`,
    auraTier,
    roastText
  };
}

/**
 * 2. AI FOTO HD ENHANCER / REMINI (Multi-GPU: Nexray Remini -> HuggingFace CodeFormer + Real-ESRGAN 2x)
 */
async function enhancePhotoHd({ imageBase64, imageUrl }) {
  let publicUrl = '';
  let rawBuffer = null;
  let rawMime = 'image/png';

  if (imageUrl && /^https?:\/\//i.test(imageUrl.trim())) {
    publicUrl = imageUrl.trim();
  } else if (imageBase64 && imageBase64.startsWith('data:image/')) {
    const m = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!m) throw new Error('Format gambar tidak valid.');
    rawMime = m[1];
    rawBuffer = Buffer.from(m[2], 'base64');
    if (rawBuffer.length > 8 * 1024 * 1024) {
      throw new Error('Ukuran foto terlalu besar (maksimal 8 MB).');
    }
    try {
      publicUrl = await toolsHub.uploadTempImageBuffer(rawBuffer, rawMime);
    } catch (_) {
      publicUrl = '';
    }
  } else {
    throw new Error('Pilih foto yang ingin dijernihkan terlebih dahulu.');
  }

  // Gateway 1: Nexray Remini HD
  if (publicUrl) {
    try {
      const resultDataUrl = await toolsHub.fetchImageUrlToDataUrl(
        `https://api.nexray.eu.cc/tools/remini?url=${encodeURIComponent(publicUrl)}`,
        34000
      );
      return { resultDataUrl };
    } catch (_) {}
  }

  // Gateway 2: Hugging Face Cloud GPU CodeFormer + Real-ESRGAN 2x (Direct Binary Upload)
  try {
    const spaceUrl = 'https://sczhou-codeformer.hf.space';
    const fileData = rawBuffer
      ? await toolsHub.uploadBufferToGradioSpace(spaceUrl, rawBuffer, rawMime)
      : { path: publicUrl, url: publicUrl, meta: { _type: 'gradio.FileData' } };
    const out = await toolsHub.callGradio5Space(
      spaceUrl,
      'inference',
      [fileData, true, true, true, 2, 0.7],
      42000
    );
    const outUrl = out?.[0]?.url;
    if (outUrl) {
      const resultDataUrl = await toolsHub.fetchImageUrlToDataUrl(outUrl, 25000);
      return { resultDataUrl };
    }
  } catch (_) {}

  throw new Error('Seluruh GPU AI Penjernih Foto sedang penuh sementara. Silakan klik proses ulang.');
}

/**
 * 3. AI IMAGE GENERATOR HD (4-Engine Failover: BFL FLUX.1-schnell GPU -> Ideogram HD -> DavidCyril Flux -> Pollinations)
 */
async function generateAiImage({ prompt, ratio = '1:1', style = '' }) {
  const cleanPrompt = String(prompt || '').trim();
  if (!cleanPrompt) throw new Error('Masukkan deskripsi gambar yang ingin dibuat.');

  const dims =
    ratio === '9:16'
      ? { w: 768, h: 1344 }
      : ratio === '16:9'
        ? { w: 1344, h: 768 }
        : { w: 1024, h: 1024 };

  const fullPrompt = style
    ? `${cleanPrompt}, ${style}, ultra detailed, masterpiece, high resolution`
    : `${cleanPrompt}, ultra detailed, high resolution`;
  const seed = crypto.randomInt(1000, 9999999);

  // Gateway 1: Official Black Forest Labs FLUX.1-schnell Cloud GPU (Mendukung Rasio Presisi, Tanpa Watermark & Tanpa Cooldown!)
  try {
    const out = await toolsHub.callGradio5Space(
      'https://black-forest-labs-flux-1-schnell.hf.space',
      'infer',
      [fullPrompt, seed, false, dims.w, dims.h, 4],
      35000
    );
    const outUrl = out?.[0]?.url;
    if (outUrl) {
      const imageDataUrl = await toolsHub.fetchImageUrlToDataUrl(outUrl, 22000);
      return {
        prompt: cleanPrompt,
        ratio,
        width: dims.w,
        height: dims.h,
        seed,
        engine: 'FLUX.1-schnell HD',
        imageDataUrl
      };
    }
  } catch (_) {}

  // Gateway 2: Nexray Ideogram HD (Tanpa Watermark & Kualitas Ilustrasi Sangat Tajam)
  try {
    const ratioHint =
      ratio === '9:16'
        ? ', vertical portrait composition'
        : ratio === '16:9'
          ? ', wide cinematic composition'
          : '';
    const imageDataUrl = await toolsHub.fetchImageUrlToDataUrl(
      `https://api.nexray.eu.cc/ai/ideogram?prompt=${encodeURIComponent(fullPrompt + ratioHint)}`,
      32000
    );
    return {
      prompt: cleanPrompt,
      ratio,
      width: dims.w,
      height: dims.h,
      seed,
      engine: 'Ideogram HD',
      imageDataUrl
    };
  } catch (_) {}

  // Gateway 3: DavidCyril Flux
  try {
    const imageDataUrl = await toolsHub.fetchImageUrlToDataUrl(
      `https://apis.davidcyriltech.my.id/flux?prompt=${encodeURIComponent(fullPrompt)}`,
      25000
    );
    return {
      prompt: cleanPrompt,
      ratio,
      width: dims.w,
      height: dims.h,
      seed,
      engine: 'Flux Turbo',
      imageDataUrl
    };
  } catch (_) {}

  // Gateway 4: Pollinations Sana
  try {
    const imageDataUrl = await toolsHub.fetchImageUrlToDataUrl(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${dims.w}&height=${dims.h}&seed=${seed}&nologo=true`,
      30000
    );
    return {
      prompt: cleanPrompt,
      ratio,
      width: dims.w,
      height: dims.h,
      seed,
      engine: 'Pollinations Sana',
      imageDataUrl
    };
  } catch (_) {}

  throw new Error('Seluruh server GPU AI Image sedang antre penuh. Silakan coba lagi beberapa detik lagi.');
}

/**
 * 4. VOICE OVER NARATOR KONTEN TIKTOK (MULTI-CHUNK GOOGLE TTS MP3)
 */
const ALLOWED_TTS_LANGS = new Set(['id', 'en', 'ja', 'ko', 'ar', 'jv', 'su', 'es', 'de']);

function splitTextForTts(text, maxLen = 175) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const rawSentences = cleaned.split(/(?<=[.!?।,;])\s+/);
  const chunks = [];
  let cur = '';

  for (const part of rawSentences) {
    if ((cur + ' ' + part).trim().length <= maxLen) {
      cur = (cur + ' ' + part).trim();
    } else {
      if (cur) chunks.push(cur);
      if (part.length <= maxLen) {
        cur = part;
      } else {
        const words = part.split(' ');
        cur = '';
        for (const w of words) {
          if ((cur + ' ' + w).trim().length <= maxLen) {
            cur = (cur + ' ' + w).trim();
          } else {
            if (cur) chunks.push(cur);
            cur = w.slice(0, maxLen);
          }
        }
      }
    }
  }
  if (cur) chunks.push(cur);
  return chunks.slice(0, 12); // Maks ~2.000 karakter per render
}

async function synthesizeTtsMp3({
  text,
  lang = 'id',
  engine = 'dracin',
  speed = '1.0',
  music = true
}) {
  const rawText = String(text || '').trim();
  if (!rawText) {
    throw new Error('Masukkan teks naskah narator terlebih dahulu.');
  }

  // Mode 1: Narator Alur Cerita Dracin / Film (+ Musik Latar BGM Otomatis)
  if (engine === 'dracin') {
    try {
      const spd = ['0.8', '0.9', '1.0', '1.1', '1.2'].includes(String(speed)) ? String(speed) : '1.0';
      const withMusic = music !== false && String(music) !== 'false' ? 'true' : 'false';
      const u = `https://api.nexray.eu.cc/ai/dracin-tts?text=${encodeURIComponent(
        rawText.slice(0, 900)
      )}&speed=${spd}&volume=0.3&music=${withMusic}`;
      const r = await fetchTimed(u, { headers: { 'User-Agent': CHROME_UA } }, 28000);
      const j = await r.json();
      const mp3Url = j?.result;
      if (mp3Url && /^https?:\/\//i.test(mp3Url)) {
        const audioRes = await fetchTimed(mp3Url, { headers: { 'User-Agent': CHROME_UA } }, 20000);
        if (audioRes.ok) {
          const ab = await audioRes.arrayBuffer();
          return {
            lang: 'id',
            engine: 'Narator Dracin + BGM',
            charCount: rawText.length,
            audioDataUrl: `data:audio/mpeg;base64,${Buffer.from(ab).toString('base64')}`
          };
        }
      }
    } catch (_) {
      // Lanjut fallback ke Gemini / Google bila server Dracin penuh
    }
  }

  // Mode 2: Suara AI Natural (Gemini TTS)
  if (engine === 'gemini' || engine === 'dracin') {
    try {
      const u = `https://api.nexray.eu.cc/ai/gemini-tts?text=${encodeURIComponent(rawText.slice(0, 900))}`;
      const r = await fetchTimed(u, { headers: { 'User-Agent': CHROME_UA } }, 26000);
      const j = await r.json();
      const mp3Url = j?.result;
      if (mp3Url && /^https?:\/\//i.test(mp3Url)) {
        const audioRes = await fetchTimed(mp3Url, { headers: { 'User-Agent': CHROME_UA } }, 20000);
        if (audioRes.ok) {
          const ab = await audioRes.arrayBuffer();
          return {
            lang: 'id',
            engine: 'Gemini AI Voice',
            charCount: rawText.length,
            audioDataUrl: `data:audio/mpeg;base64,${Buffer.from(ab).toString('base64')}`
          };
        }
      }
    } catch (_) {}
  }

  // Mode 3 / Fallback: Multi-Bahasa Google Narrator
  const safeLang = ALLOWED_TTS_LANGS.has(lang) ? lang : 'id';
  const chunks = splitTextForTts(rawText);
  if (!chunks.length) {
    throw new Error('Masukkan teks naskah narator terlebih dahulu.');
  }

  const buffers = [];
  for (const ch of chunks) {
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(ch)}&tl=${safeLang}&client=tw-ob`;
    const r = await fetchTimed(ttsUrl, { headers: { 'User-Agent': CHROME_UA } }, 12000);
    if (!r.ok) {
      throw new Error('Gagal membuat suara narator. Coba perpendek kalimat.');
    }
    const ab = await r.arrayBuffer();
    buffers.push(Buffer.from(ab));
  }

  const combined = Buffer.concat(buffers);
  return {
    lang: safeLang,
    engine: `Multi-Bahasa (${safeLang.toUpperCase()})`,
    charCount: rawText.length,
    audioDataUrl: `data:audio/mpeg;base64,${combined.toString('base64')}`
  };
}

/**
 * 5. PENCARI LIRIK LAGU (LRCLIB) UNTUK KARTU LIRIK ESTETIK
 */
async function searchSongLyrics({ query }) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Masukkan judul lagu atau potongan lirik.');

  const res = await fetchTimed(
    `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`,
    { headers: { 'User-Agent': 'D4TechHub/3.0 (https://github.com)' } },
    15000
  );
  const list = await res.json();
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Lirik lagu tidak ditemukan. Coba ketik judul + nama penyanyi.');
  }

  return list
    .filter((it) => it.plainLyrics)
    .slice(0, 6)
    .map((it) => ({
      id: it.id,
      title: it.trackName || it.name || 'Lagu',
      artist: it.artistName || 'Artis',
      album: it.albumName || '',
      plainLyrics: it.plainLyrics
    }));
}

/**
 * 6. DETEKTIF USERNAME OSINT SCANNER (18 PLATFORM PARALEL)
 */
async function scanUsernameOsint({ username: rawUser }) {
  const u = String(rawUser || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '');

  if (!u || u.length < 2) {
    throw new Error('Masukkan username valid minimal 2 karakter (tanpa spasi).');
  }

  const checks = [
    {
      platform: 'TikTok',
      category: 'Sosmed',
      icon: '🎵',
      profileUrl: `https://www.tiktok.com/@${u}`,
      probe: async () => {
        const r = await fetchTimed(
          `https://apis.davidcyriltech.my.id/tiktokStalk?q=${encodeURIComponent(u)}`,
          { headers: { 'User-Agent': CHROME_UA } },
          7000
        );
        const j = await r.json();
        return Boolean(j?.data?.user?.uniqueId);
      }
    },
    {
      platform: 'GitHub',
      category: 'Developer',
      icon: '🐙',
      profileUrl: `https://github.com/${u}`,
      probe: async () => {
        const r = await fetchTimed(
          `https://api.github.com/users/${encodeURIComponent(u)}`,
          { headers: { 'User-Agent': CHROME_UA } },
          6000
        );
        return r.status === 200;
      }
    },
    {
      platform: 'YouTube',
      category: 'Video',
      icon: '▶️',
      profileUrl: `https://www.youtube.com/@${u}`,
      probe: async () => {
        const r = await fetchTimed(
          `https://www.youtube.com/@${encodeURIComponent(u)}`,
          { method: 'HEAD', headers: { 'User-Agent': CHROME_UA } },
          6000
        );
        return r.status === 200;
      }
    },
    {
      platform: 'Reddit',
      category: 'Komunitas',
      icon: '👽',
      profileUrl: `https://www.reddit.com/user/${u}`,
      probe: async () => {
        const r = await fetchTimed(
          `https://www.reddit.com/user/${encodeURIComponent(u)}/about.json`,
          { headers: { 'User-Agent': CHROME_UA } },
          6000
        );
        if (r.status !== 200) return false;
        const j = await r.json();
        return Boolean(j?.data?.name && !j?.data?.is_suspended);
      }
    },
    {
      platform: 'Chess.com',
      category: 'Game',
      icon: '♟️',
      profileUrl: `https://www.chess.com/member/${u}`,
      probe: async () => {
        const r = await fetchTimed(
          `https://api.chess.com/pub/player/${encodeURIComponent(u.toLowerCase())}`,
          { headers: { 'User-Agent': CHROME_UA } },
          6000
        );
        return r.status === 200;
      }
    },
    {
      platform: 'GitLab',
      category: 'Developer',
      icon: '🦊',
      profileUrl: `https://gitlab.com/${u}`,
      probe: async () => {
        const r = await fetchTimed(
          `https://gitlab.com/api/v4/users?username=${encodeURIComponent(u)}`,
          { headers: { 'User-Agent': CHROME_UA } },
          6000
        );
        const j = await r.json();
        return Array.isArray(j) && j.length > 0;
      }
    },
    {
      platform: 'DEV Community',
      category: 'Developer',
      icon: '👩‍💻',
      profileUrl: `https://dev.to/${u}`,
      probe: async () => {
        const r = await fetchTimed(
          `https://dev.to/api/users/by_username?url=${encodeURIComponent(u)}`,
          { headers: { 'User-Agent': CHROME_UA } },
          6000
        );
        return r.status === 200;
      }
    },
    {
      platform: 'Medium',
      category: 'Blog',
      icon: '✍️',
      profileUrl: `https://medium.com/@${u}`,
      probe: async () => {
        const r = await fetchTimed(
          `https://medium.com/feed/@${encodeURIComponent(u)}`,
          { headers: { 'User-Agent': CHROME_UA } },
          6000
        );
        return r.status === 200;
      }
    },
    {
      platform: 'SoundCloud',
      category: 'Musik',
      icon: '☁️',
      profileUrl: `https://soundcloud.com/${u}`,
      probe: async () => {
        const r = await fetchTimed(
          `https://soundcloud.com/${encodeURIComponent(u)}`,
          { method: 'HEAD', headers: { 'User-Agent': CHROME_UA } },
          6000
        );
        return r.status === 200;
      }
    },
    {
      platform: 'Linktree',
      category: 'Kreator',
      icon: '🌲',
      profileUrl: `https://linktr.ee/${u}`,
      probe: async () => {
        const r = await fetchTimed(
          `https://linktr.ee/${encodeURIComponent(u)}`,
          { headers: { 'User-Agent': CHROME_UA } },
          6000
        );
        if (r.status !== 200) return false;
        const txt = await r.text();
        return !txt.includes('"statusCode":404');
      }
    },
    {
      platform: 'NPM Registry',
      category: 'Developer',
      icon: '📦',
      profileUrl: `https://www.npmjs.com/~${u}`,
      probe: async () => {
        const r = await fetchTimed(
          `https://registry.npmjs.org/-/user/org.couchdb.user:${encodeURIComponent(u)}`,
          { headers: { 'User-Agent': CHROME_UA } },
          6000
        );
        return r.status === 200;
      }
    },
    {
      platform: 'HackerNews',
      category: 'Teknologi',
      icon: '🟧',
      profileUrl: `https://news.ycombinator.com/user?id=${u}`,
      probe: async () => {
        const r = await fetchTimed(
          `https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(u)}.json`,
          { headers: { 'User-Agent': CHROME_UA } },
          6000
        );
        const j = await r.json();
        return Boolean(j && j.id);
      }
    },
    {
      platform: 'Keybase',
      category: 'Siber',
      icon: '🗝️',
      profileUrl: `https://keybase.io/${u}`,
      probe: async () => {
        const r = await fetchTimed(
          `https://keybase.io/_/api/1.0/user/lookup.json?usernames=${encodeURIComponent(u)}`,
          { headers: { 'User-Agent': CHROME_UA } },
          6000
        );
        const j = await r.json();
        return Boolean(j?.them?.[0]?.id);
      }
    },
    {
      platform: 'Roblox',
      category: 'Game',
      icon: '🎮',
      profileUrl: `https://www.roblox.com/search/users?keyword=${u}`,
      probe: async () => {
        const r = await fetchTimed(
          'https://users.roblox.com/v1/usernames/users',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': CHROME_UA },
            body: JSON.stringify({ usernames: [u], excludeBannedUsers: false })
          },
          6000
        );
        const j = await r.json();
        return Array.isArray(j?.data) && j.data.length > 0;
      }
    },
    {
      platform: 'Scratch MIT',
      category: 'Kreatif',
      icon: '🐱',
      profileUrl: `https://scratch.mit.edu/users/${u}`,
      probe: async () => {
        const r = await fetchTimed(
          `https://api.scratch.mit.edu/users/${encodeURIComponent(u)}`,
          { headers: { 'User-Agent': CHROME_UA } },
          6000
        );
        return r.status === 200;
      }
    },
    {
      platform: 'PyPI Python',
      category: 'Developer',
      icon: '🐍',
      profileUrl: `https://pypi.org/user/${u}/`,
      probe: async () => {
        const r = await fetchTimed(
          `https://pypi.org/user/${encodeURIComponent(u)}/`,
          { method: 'HEAD', headers: { 'User-Agent': CHROME_UA } },
          6000
        );
        return r.status === 200;
      }
    }
  ];

  const settled = await Promise.all(
    checks.map(async (item) => {
      try {
        const found = await item.probe();
        return {
          platform: item.platform,
          category: item.category,
          icon: item.icon,
          profileUrl: item.profileUrl,
          status: found ? 'found' : 'not_found'
        };
      } catch {
        return {
          platform: item.platform,
          category: item.category,
          icon: item.icon,
          profileUrl: item.profileUrl,
          status: 'unknown'
        };
      }
    })
  );

  const foundCount = settled.filter((x) => x.status === 'found').length;
  return {
    username: u,
    totalScanned: settled.length,
    foundCount,
    results: settled.sort((a, b) => (a.status === 'found' ? -1 : b.status === 'found' ? 1 : 0))
  };
}

/**
 * 7. ANTI-PHISHING LINK UNSHORTENER & SERVER IP GEOLOCATION SCANNER
 */
async function unshortenAndScanUrl({ url: rawUrl }) {
  let current = String(rawUrl || '').trim();
  if (!current) throw new Error('Masukkan link URL yang ingin diperiksa.');
  if (!/^https?:\/\//i.test(current)) current = `https://${current}`;

  const hops = [];
  let currentUrlObj;

  for (let i = 0; i < 8; i++) {
    try {
      currentUrlObj = new URL(current);
    } catch {
      throw new Error('Format URL tidak valid.');
    }

    if (!['http:', 'https:'].includes(currentUrlObj.protocol)) {
      throw new Error('Hanya protokol HTTP/HTTPS yang didukung.');
    }
    if (isPrivateOrLocalIp(currentUrlObj.hostname)) {
      throw new Error('Pemindaian host jaringan lokal tidak diizinkan.');
    }

    let res;
    try {
      res = await fetchTimed(
        currentUrlObj.toString(),
        {
          method: 'GET',
          redirect: 'manual',
          headers: { 'User-Agent': CHROME_UA }
        },
        8000
      );
    } catch (err) {
      hops.push({ step: i + 1, url: currentUrlObj.toString(), status: 'ERR' });
      break;
    }

    hops.push({ step: i + 1, url: currentUrlObj.toString(), status: res.status });
    await res.body?.cancel();

    const loc = res.headers.get('location');
    if (loc && res.status >= 300 && res.status < 400) {
      current = new URL(loc, currentUrlObj.toString()).toString();
    } else {
      break;
    }
  }

  const finalUrl = hops[hops.length - 1]?.url || current;
  const finalObj = new URL(finalUrl);
  const domain = finalObj.hostname.toLowerCase();

  // Resolusi IP & GeoIP Server
  let ipAddress = null;
  let geoInfo = null;
  try {
    const looked = await dns.lookup(domain);
    ipAddress = looked.address;
    if (ipAddress && !isPrivateOrLocalIp(ipAddress)) {
      const geoRes = await fetchTimed(`https://ipwho.is/${encodeURIComponent(ipAddress)}`, {}, 6000);
      const gj = await geoRes.json();
      if (gj && gj.success !== false) {
        geoInfo = {
          ip: gj.ip,
          country: gj.country || '-',
          countryFlag: gj.flag?.emoji || '🌍',
          city: gj.city || '-',
          region: gj.region || '-',
          isp: gj.connection?.isp || gj.connection?.org || '-'
        };
      }
    }
  } catch (_) {}

  // Analisis Indikator Risiko Phishing
  const warnings = [];
  if (finalObj.protocol !== 'https:') {
    warnings.push('Koneksi tidak memakai enkripsi HTTPS (rawan penyadapan).');
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
    warnings.push('URL langsung menggunakan alamat IP angka, bukan nama domain resmi.');
  }
  if (domain.includes('xn--')) {
    warnings.push('Terdeteksi domain Punycode (karakter samaran mirip huruf asli).');
  }
  if (/\.(zip|mov|top|xyz|click|gq|tk|ml|cf|work|loan)$/i.test(domain)) {
    warnings.push(`Ekstensi domain (${domain.split('.').pop()}) sering dipakai tautan spam/promo palsu.`);
  }
  if (
    /(dana-kaget|hadiah-gratis|claim-free|verifikasi-akun|blokir-bca|bri-poin|kurir-paket|\.apk$)/i.test(
      finalUrl
    )
  ) {
    warnings.push('Terdapat kata kunci mencurigakan atau file .APK berbahaya pada tautan!');
  }
  if (hops.length >= 4) {
    warnings.push(`Tautan melewati pengalihan berlapis (${hops.length} lompatan).`);
  }

  const riskLevel = warnings.length >= 2 ? 'high' : warnings.length === 1 ? 'medium' : 'safe';

  return {
    inputUrl: rawUrl,
    finalUrl,
    domain,
    isHttps: finalObj.protocol === 'https:',
    redirectCount: Math.max(0, hops.length - 1),
    hops,
    geo: geoInfo || (ipAddress ? { ip: ipAddress, country: '-', countryFlag: '🌐', city: '-', isp: '-' } : null),
    riskLevel,
    warnings
  };
}

/**
 * 8. PEMENDEK LINK GRATIS (SHORTLINK)
 */
async function createShortUrl({ url: rawUrl, provider = 'isgd' }) {
  const clean = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(clean)) {
    throw new Error('Masukkan URL lengkap diawali https:// atau http://');
  }

  if (provider === 'isgd') {
    try {
      const r = await fetchTimed(
        `https://is.gd/create.php?format=json&url=${encodeURIComponent(clean)}`,
        { headers: { 'User-Agent': CHROME_UA } },
        10000
      );
      const j = await r.json();
      if (j?.shorturl) return { originalUrl: clean, shortUrl: j.shorturl, provider: 'is.gd' };
    } catch (_) {}
  }

  const r2 = await fetchTimed(
    `https://tinyurl.com/api-create.php?url=${encodeURIComponent(clean)}`,
    { headers: { 'User-Agent': CHROME_UA } },
    10000
  );
  const txt = (await r2.text()).trim();
  if (/^https?:\/\/tinyurl\.com\//i.test(txt)) {
    return { originalUrl: clean, shortUrl: txt, provider: 'TinyURL' };
  }

  throw new Error('Gagal memperpendek tautan tersebut.');
}

/**
 * 9. GOOGLE EMOJI KITCHEN MIXER (RESMI GSTATIC CDN TANPA LIMIT)
 */
const EMOJI_KITCHEN_DATES = [
  '20240530', '20240206', '20231113', '20230803', '20230418',
  '20230301', '20220815', '20220506', '20220203', '20211115',
  '20210831', '20210521', '20210218', '20201001'
];

function emojiToKitchenCode(em) {
  const seg =
    typeof Intl !== 'undefined' && Intl.Segmenter
      ? new Intl.Segmenter('en', { granularity: 'grapheme' })
      : null;
  const firstGrapheme = seg
    ? Array.from(seg.segment(String(em || '').trim()))[0]?.segment || ''
    : String(em || '').trim();
  const cps = [...firstGrapheme]
    .map((c) => 'u' + c.codePointAt(0).toString(16).toLowerCase())
    .filter((x) => x !== 'ufe0f');
  return cps.join('-');
}

async function combineEmojiKitchen({ emoji1, emoji2 }) {
  const c1 = emojiToKitchenCode(emoji1);
  const c2 = emojiToKitchenCode(emoji2);
  if (!c1 || !c2) {
    throw new Error('Pilih dua emoji yang valid terlebih dahulu.');
  }

  const pairs = [
    [c1, c2],
    [c2, c1],
    [`${c1}-ufe0f`, c2],
    [c1, `${c2}-ufe0f`],
    [`${c2}-ufe0f`, c1],
    [c2, `${c1}-ufe0f`]
  ];

  // Cek gelombang terbaru lebih dulu, lalu gelombang lama agar super cepat (< 400ms)
  for (let i = 0; i < EMOJI_KITCHEN_DATES.length; i += 5) {
    const batchDates = EMOJI_KITCHEN_DATES.slice(i, i + 5);
    const candidateUrls = [];
    for (const d of batchDates) {
      for (const [a, b] of pairs) {
        candidateUrls.push(
          `https://www.gstatic.com/android/keyboard/emojikitchen/${d}/${a}/${a}_${b}.png`
        );
      }
    }

    const found = await Promise.all(
      candidateUrls.map(async (u) => {
        try {
          const r = await fetchTimed(u, { method: 'HEAD' }, 3800);
          return r.status === 200 ? u : null;
        } catch {
          return null;
        }
      })
    );

    const hitUrl = found.find(Boolean);
    if (hitUrl) {
      const imgDataUrl = await toolsHub.fetchImageUrlToDataUrl(hitUrl, 12000);
      return {
        emoji1,
        emoji2,
        sourceUrl: hitUrl,
        imageDataUrl: imgDataUrl
      };
    }
  }

  throw new Error(
    `Kombinasi ${emoji1} + ${emoji2} belum tersedia di katalog Google Emoji Kitchen. Coba padukan dengan emoji ekspresi wajah, hewan, hati, atau api!`
  );
}

/**
 * 10. PENDETEKSI JUDUL LAGU FYP / SHAZAM AUDIO RECOGNIZER
 */
const SHAZAM_MAX_BUFFER_BYTES = 3.2 * 1024 * 1024;

function splitDataUrl(input) {
  const str = String(input || '').trim();
  const m = str.match(/^data:([a-zA-Z0-9/+.-]+)?;base64,([\s\S]+)$/);
  if (m) return { mime: m[1] || 'audio/mpeg', base64: m[2].replace(/\s+/g, '') };
  return { mime: 'audio/mpeg', base64: str.replace(/\s+/g, '') };
}

async function downloadMediaFragment(url, maxBytes = 2 * 1024 * 1024) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': CHROME_UA,
        Accept: 'audio/*,video/*,*/*',
        Range: `bytes=0-${maxBytes - 1}`
      },
      redirect: 'follow',
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arr).subarray(0, maxBytes),
      mime: res.headers.get('content-type') || 'audio/mpeg'
    };
  } finally {
    clearTimeout(timer);
  }
}

async function recognizeMusicShazam({ audioBase64, audioUrl }) {
  const directUrl = String(audioUrl || '').trim();
  const hasDirectUrl = /^https?:\/\//i.test(directUrl);
  const inline = String(audioBase64 || '').trim();

  if (!inline && !hasDirectUrl) {
    throw new Error('Unggah potongan audio/video atau tempel URL file audio terlebih dahulu.');
  }

  let publicMediaUrl = '';

  if (inline) {
    const { mime, base64 } = splitDataUrl(inline);
    let buf;
    try {
      buf = Buffer.from(base64, 'base64');
    } catch (_) {
      throw new Error('Format file audio/video tidak valid (base64 rusak).');
    }
    if (!buf.length) throw new Error('Berkas audio kosong atau tidak terbaca.');
    if (buf.length > SHAZAM_MAX_BUFFER_BYTES) {
      throw new Error(
        `Klip audio terlalu besar (${(buf.length / 1024 / 1024).toFixed(1)} MB). Batas server 3,2 MB — pilih lewat tombol berkas agar klip dipotong otomatis 10–15 detik.`
      );
    }
    publicMediaUrl = await toolsHub.uploadTempImageBuffer(buf, mime);
  } else {
    // Ambil hanya potongan awal berkas (≤2 MB) supaya pengenalan cepat & hemat kuota.
    try {
      const frag = await downloadMediaFragment(directUrl);
      if (frag.buffer.length > 20000) {
        publicMediaUrl = await toolsHub.uploadTempImageBuffer(frag.buffer, frag.mime);
      }
    } catch (_) {
      publicMediaUrl = '';
    }
    if (!publicMediaUrl) publicMediaUrl = directUrl;
  }

  const endpoints = [
    `https://api.nexray.eu.cc/tools/whatsmusic?url=${encodeURIComponent(publicMediaUrl)}`
  ];

  let lastUpstreamMsg = '';
  for (const endpoint of endpoints) {
    let res;
    try {
      res = await fetchTimed(
        endpoint,
        { headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' } },
        40000
      );
    } catch (err) {
      lastUpstreamMsg = err.message;
      continue;
    }

    let json = null;
    try {
      const rawBody = await res.text();
      json = JSON.parse(String(rawBody || '').replace(/^\uFEFF/, '').trim());
    } catch (_) {
      json = null;
    }
    const r = json?.result || json?.data || null;

    if (r && (r.title || r.artist)) {
      const links = Array.isArray(r.url)
        ? r.url
        : Array.isArray(r.links)
          ? r.links
          : r.link
            ? [r.link]
            : [];
      return {
        title: r.title || 'Tanpa Judul',
        artist: r.artist || 'Artis tidak diketahui',
        album: r.album || '-',
        release: r.release || r.releaseDate || '-',
        duration: r.duration || '-',
        score: Number(r.score) || 95,
        links: links.slice(0, 4)
      };
    }
    lastUpstreamMsg = json?.message || json?.error || `HTTP ${res.status}`;
  }

  throw new Error(
    'Lagu belum berhasil dikenali. Pastikan suara musik terdengar jelas minimal 8–15 detik tanpa tertutup suara bicara keras' +
      (lastUpstreamMsg ? ` (respons pengenal: ${String(lastUpstreamMsg).slice(0, 120)})` : '') +
      '.'
  );
}

/**
 * 11. AI PERANGKUM VIDEO YOUTUBE, TRANSKRIP & THUMBNAIL 4K
 */
function parseYoutubeVideoId(rawUrl = '') {
  const s = String(rawUrl || '').trim();
  const m =
    s.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/)([A-Za-z0-9_-]{11})/) ||
    s.match(/^([A-Za-z0-9_-]{11})$/);
  return m ? m[1] : null;
}

async function summarizeAndTranscribeYoutube({ url }) {
  const videoId = parseYoutubeVideoId(url);
  if (!videoId) {
    throw new Error('Masukkan link video YouTube atau YouTube Shorts yang valid.');
  }

  const cleanYtUrl = `https://youtu.be/${videoId}`;

  const [sumV1, sumV2, transRes, oembedRes] = await Promise.allSettled([
    fetchTimed(
      `https://api.nexray.eu.cc/tools/v1/youtube-summarize?url=${encodeURIComponent(cleanYtUrl)}`,
      { headers: { 'User-Agent': CHROME_UA } },
      25000
    ).then((r) => r.json()),
    fetchTimed(
      `https://api.nexray.eu.cc/tools/v2/youtube-summarize?url=${encodeURIComponent(cleanYtUrl)}`,
      { headers: { 'User-Agent': CHROME_UA } },
      22000
    ).then((r) => r.json()),
    fetchTimed(
      `https://api.nexray.eu.cc/tools/yt-transcribe?url=${encodeURIComponent(cleanYtUrl)}`,
      { headers: { 'User-Agent': CHROME_UA } },
      22000
    ).then((r) => r.json()),
    fetchTimed(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${videoId}`
      )}&format=json`,
      { headers: { 'User-Agent': CHROME_UA } },
      8000
    ).then((r) => r.json())
  ]);

  const meta = oembedRes.status === 'fulfilled' ? oembedRes.value : null;
  const v1Text = sumV1.status === 'fulfilled' ? sumV1.value?.result?.content : '';
  const v2Obj = sumV2.status === 'fulfilled' ? sumV2.value?.result : null;
  const v2Text = v2Obj?.summary || v2Obj?.content || '';
  const transcript =
    transRes.status === 'fulfilled'
      ? transRes.value?.data?.transcript || transRes.value?.result?.transcript || ''
      : '';

  let summaryText = String(v1Text || v2Text || '').trim();

  // Bila rangkuman kosong tetapi transkrip ada, rangkum memakai AI Teks kita
  if (!summaryText && transcript) {
    const aiSum = await askFreeAiText(
      `Rangkum isi video berjudul "${meta?.title || videoId}" berikut dalam Bahasa Indonesia menjadi poin-poin rapi & mudah dipahami:\n\n${transcript.slice(
        0,
        3500
      )}`
    );
    if (aiSum) summaryText = aiSum;
  }

  return {
    videoId,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title: meta?.title || v2Obj?.title || `Video YouTube (${videoId})`,
    channel: meta?.author_name || 'YouTube Creator',
    summary:
      summaryText ||
      'Video ini tidak memiliki subtitle suara untuk dirangkum otomatis, namun kamu tetap dapat mengunduh seluruh resolusi Thumbnail 4K/HD di bawah.',
    transcript: transcript || '',
    thumbnails: [
      {
        label: '4K / MaxRes HD (1280×720)',
        url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
      },
      {
        label: 'High Quality (480×360)',
        url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      },
      {
        label: 'Medium Widescreen (320×180)',
        url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
      }
    ]
  };
}

module.exports = {
  roastTikTokAccount,
  enhancePhotoHd,
  generateAiImage,
  synthesizeTtsMp3,
  searchSongLyrics,
  scanUsernameOsint,
  unshortenAndScanUrl,
  createShortUrl,
  combineEmojiKitchen,
  recognizeMusicShazam,
  summarizeAndTranscribeYoutube
};
