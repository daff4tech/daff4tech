const express = require('express');
const path = require('path');
const store = require('./src/store');
const {
  parseWhatsAppPostLink,
  parseBulkLinks,
  fetchChannelMetadata,
  verifyChannelPost
} = require('./src/linkParser');
const {
  checkProviderBalance,
  syncProviderServices
} = require('./src/providers');
const runner = require('./src/runner');
const toolsHub = require('./src/toolsHub');
const extraTools = require('./src/extraTools');
const followerPool = require('./src/followerPool');
const { Readable } = require('stream');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));

// Pastikan kompatibel penuh dengan Live Preview iframe & proxy host
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Aset biner (logo/favicon/ikon PWA) yang ditanam sebagai base64 — lihat src/staticAssets.js
const STATIC_ASSETS = require('./src/staticAssets');
Object.entries(STATIC_ASSETS).forEach(([route, asset]) => {
  app.get(route, (req, res) => {
    res.setHeader('Content-Type', asset.mime);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.end(Buffer.from(asset.base64, 'base64'));
  });
});

app.use(
  express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
      if (/\.(html|css|js)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      }
    }
  })
);

// Bootstrap state
app.get('/api/state', (req, res) => {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  res.json({
    ok: true,
    serverless: isServerless,
    activeProviderId: store.data.activeProviderId,
    sandboxBalance: store.data.sandboxBalance,
    providers: store.getProviders(),
    campaigns: store.getCampaigns(),
    logs: store.data.logs.slice(0, 120),
    followerConfig: followerPool.getPublicConfig(),
    followerChannels: followerPool.getChannelCatalog()
  });
});

// Validasi & ambil pratinjau Link Postingan Saluran WhatsApp
app.post('/api/parse-link', async (req, res) => {
  try {
    const { mode = 'single', input = '', fetchPreview = true } = req.body || {};
    if (mode === 'bulk') {
      const bulk = parseBulkLinks(input);
      let firstMeta = null;
      if (fetchPreview && bulk.validLinks.length > 0) {
        firstMeta = await fetchChannelMetadata(bulk.validLinks[0]);
      }
      return res.json({
        ok: true,
        mode: 'bulk',
        validLinks: bulk.validLinks,
        invalidLinks: bulk.invalidLinks,
        preview: firstMeta
      });
    }

    const parsed = parseWhatsAppPostLink(input);
    if (!parsed.valid) {
      return res.json({ ok: true, valid: false, error: parsed.error });
    }

    const [previewRaw, verified] = await Promise.all([
      fetchPreview
        ? fetchChannelMetadata(parsed)
        : Promise.resolve({
            channelName: `Saluran WhatsApp (${parsed.channelCode.slice(0, 10)}…)`,
            postSnippet: `Postingan #${parsed.postId}`,
            avatarUrl: null,
            fetchedLive: false
          }),
      verifyChannelPost(parsed)
    ]);

    const preview = {
      ...previewRaw,
      channelName: verified.channelName || previewRaw.channelName,
      avatarUrl: verified.avatarUrl || previewRaw.avatarUrl,
      followers: verified.followers || null,
      exists: verified.exists,
      verifyReason: verified.reason || null
    };

    return res.json({
      ok: true,
      valid: true,
      parsed,
      preview,
      verified,
      warning:
        verified.exists === false
          ? verified.reason
          : verified.exists === null
            ? verified.reason
            : null
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Simpan atau tambah Provider API
app.post('/api/providers', (req, res) => {
  try {
    const saved = store.upsertProvider(req.body || {});
    runner.log('info', `Konfigurasi provider "${saved.name}" berhasil disimpan.`);
    res.json({ ok: true, provider: saved, activeProviderId: store.data.activeProviderId });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Aktifkan Provider
app.post('/api/providers/:id/activate', (req, res) => {
  try {
    const prov = store.setActiveProvider(req.params.id);
    runner.log('info', `Provider aktif diubah ke "${prov.name}".`);
    res.json({ ok: true, activeProviderId: prov.id, provider: prov });
  } catch (err) {
    res.status(404).json({ ok: false, error: err.message });
  }
});

// Hapus Provider Kustom
app.delete('/api/providers/:id', (req, res) => {
  try {
    store.deleteProvider(req.params.id);
    res.json({
      ok: true,
      providers: store.getProviders(),
      activeProviderId: store.data.activeProviderId
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Tes Koneksi & Cek Saldo API
app.post('/api/providers/:id/check-balance', async (req, res) => {
  try {
    const prov = store.getProvider(req.params.id);
    if (!prov) return res.status(404).json({ ok: false, error: 'Provider tidak ditemukan.' });

    const result = await checkProviderBalance(prov);
    runner.log(
      'success',
      `Tes koneksi "${prov.name}" berhasil${
        result.balance !== null
          ? ` — Saldo: ${result.currency} ${Number(result.balance).toLocaleString('id-ID')}`
          : ''
      }.`
    );
    res.json({ ok: true, result, provider: prov });
  } catch (err) {
    runner.log('error', `Tes koneksi gagal: ${err.message}`);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Sinkronisasi Layanan dari SMM Panel
app.post('/api/providers/:id/sync-services', async (req, res) => {
  try {
    const prov = store.getProvider(req.params.id);
    if (!prov) return res.status(404).json({ ok: false, error: 'Provider tidak ditemukan.' });

    const filterOnlyWhatsApp = req.body?.filterOnlyWhatsApp !== false;
    const syncRes = await syncProviderServices(prov, filterOnlyWhatsApp);
    runner.log(
      'success',
      `Sinkronisasi layanan "${prov.name}" selesai: ${syncRes.services.length} layanan dimuat (${syncRes.autoMappedCount} emoji otomatis dipetakan).`
    );
    res.json({ ok: true, ...syncRes, provider: prov });
  } catch (err) {
    runner.log('error', `Gagal sinkronisasi layanan: ${err.message}`);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Top-up / Reset Saldo Sandbox
app.post('/api/sandbox/topup', (req, res) => {
  const amount = Number(req.body?.amount) || 250000;
  store.data.sandboxBalance = amount;
  const sbx = store.getProvider('prov_sandbox');
  if (sbx) {
    sbx.lastBalance = {
      balance: amount,
      currency: 'IDR',
      checkedAt: new Date().toISOString()
    };
  }
  store.save();
  runner.log('info', `Saldo Mode Simulasi diatur ulang menjadi Rp ${amount.toLocaleString('id-ID')}.`);
  res.json({ ok: true, sandboxBalance: amount, provider: sbx });
});

// Buat & Jalankan Kampanye Pengiriman Reaction
app.post('/api/campaigns', async (req, res) => {
  try {
    const {
      mode = 'single',
      linkInput = '',
      providerId,
      reactions = [],
      pacing = {},
      channelNameHint = ''
    } = req.body || {};

    let validLinks = [];
    if (mode === 'bulk') {
      const parsedBulk = parseBulkLinks(linkInput);
      if (parsedBulk.validLinks.length === 0) {
        return res.status(400).json({
          ok: false,
          error:
            parsedBulk.invalidLinks[0]?.error ||
            'Tidak ada link postingan Saluran WhatsApp yang valid.'
        });
      }
      validLinks = parsedBulk.validLinks;
    } else {
      const parsed = parseWhatsAppPostLink(linkInput);
      if (!parsed.valid) {
        return res.status(400).json({ ok: false, error: parsed.error });
      }
      validLinks = [{ ...parsed, channelName: channelNameHint || undefined }];
    }

    // ---------------------------------------------------------------
    // VERIFIKASI LINK KE WHATSAPP
    // Gateway "API gratis" menerima link apa pun dan tetap membalas
    // "queued" (termasuk channel yang tidak ada) sehingga UI bisa
    // melaporkan sukses palsu. Karena itu link diverifikasi lebih dulu:
    // bila channel/postingan tidak ditemukan, request tidak dikirim.
    // ---------------------------------------------------------------
    const skipVerification =
      req.body?.skipVerification === true || req.body?.skipVerification === 'true';
    let verification = [];
    if (!skipVerification) {
      const toCheck = validLinks.slice(0, 5);
      const results = await Promise.all(toCheck.map((l) => verifyChannelPost(l)));
      const deadIndex = results.findIndex((r) => r.exists === false);
      if (deadIndex >= 0) {
        const dead = toCheck[deadIndex];
        return res.status(400).json({
          ok: false,
          error:
            results[deadIndex].reason ||
            `Link postingan tidak ditemukan di WhatsApp: ${dead.normalizedUrl}`,
          verification: results.map((r, i) => ({
            link: toCheck[i].normalizedUrl,
            exists: r.exists,
            channelName: r.channelName,
            reason: r.reason
          }))
        });
      }
      toCheck.forEach((link, i) => {
        if (results[i].channelName) link.channelName = results[i].channelName;
      });
      verification = results.map((r, i) => ({
        link: toCheck[i].normalizedUrl,
        exists: r.exists,
        channelName: r.channelName,
        followers: r.followers,
        avatarUrl: r.avatarUrl
      }));
    }

    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const chosenProvId = providerId || store.data.activeProviderId;
    const chosenProv = store.getProvider(chosenProvId);
    const shouldAwait =
      isServerless || (validLinks.length === 1 && chosenProv?.type === 'free_pool');

    const campaign = await runner.createAndStartCampaign({
      providerId: chosenProvId,
      links: validLinks,
      reactions,
      pacing: {
        ...pacing,
        intervalMs: Number(pacing?.intervalMs ?? pacing?.delayMs ?? 1200)
      },
      awaitCompletion: shouldAwait
    });

    if (verification.length > 0) {
      campaign.verification = verification;
      const named = verification.find((v) => v.channelName);
      if (named?.channelName) campaign.channelName = named.channelName;
      store.save();
    }

    res.json({
      ok: true,
      campaign,
      verification,
      logs: shouldAwait ? store.data.logs.slice(0, 40) : undefined
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Batalkan Kampanye Berjalan
app.post('/api/campaigns/:id/cancel', (req, res) => {
  try {
    const campaign = runner.cancelCampaign(req.params.id);
    res.json({ ok: true, campaign });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Cek / Sinkronisasi Status Order dari SMM Panel
app.post('/api/campaigns/:id/refresh-status', async (req, res) => {
  try {
    const campaign = await runner.refreshCampaignStatuses(req.params.id);
    res.json({ ok: true, campaign });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Bersihkan Riwayat Kampanye yang Sudah Selesai
app.delete('/api/campaigns', (req, res) => {
  store.data.campaigns = store.data.campaigns.filter((c) => c.status === 'running');
  store.save();
  res.json({ ok: true, campaigns: store.data.campaigns });
});

// Bersihkan Log
app.delete('/api/logs', (req, res) => {
  store.data.logs = [];
  store.save();
  res.json({ ok: true });
});

// Server-Sent Events (Real-Time Stream)
app.get('/api/events', (req, res) => {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', isServerless ? 'close' : 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(`event: connected\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);

  if (isServerless) {
    return res.end();
  }

  const onSse = ({ event, payload }) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  runner.on('sse', onSse);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    runner.off('sse', onSse);
  });
});

// =========================================================================
// D4TECH MULTI-TOOLS FREE ENDPOINTS
// =========================================================================

// 1. Sosmed & TikTok Downloader Tanpa Watermark
app.post('/api/tools/downloader', async (req, res) => {
  try {
    const result = await toolsHub.downloadMedia(req.body?.url);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Proxy unduh langsung (attachment) agar file langsung tersimpan ke perangkat
app.get('/api/tools/proxy-download', async (req, res) => {
  try {
    const rawUrl = String(req.query.url || '').trim();
    const filename = String(req.query.filename || 'd4tech-media.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
    const parsed = new URL(rawUrl);
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return res.status(400).send('Protokol tidak diizinkan.');
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      host === '0.0.0.0'
    ) {
      return res.status(403).send('Host tidak diizinkan.');
    }

    const isInline = String(req.query.inline || '') === '1';
    const upstreamHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'
    };
    if (host.endsWith('apiapi2.lat')) {
      upstreamHeaders.Referer = 'https://ogmp3.com/';
    }
    if (req.headers.range) {
      upstreamHeaders.Range = req.headers.range;
    }

    const upstream = await fetch(parsed.toString(), { headers: upstreamHeaders });
    if (!upstream.ok || !upstream.body) {
      return res.redirect(parsed.toString());
    }
    res.status(upstream.status);
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') || 'application/octet-stream'
    );
    const cl = upstream.headers.get('content-length');
    if (cl) res.setHeader('Content-Length', cl);
    const cr = upstream.headers.get('content-range');
    if (cr) res.setHeader('Content-Range', cr);
    res.setHeader(
      'Content-Disposition',
      isInline ? `inline; filename="${filename}"` : `attachment; filename="${filename}"`
    );
    Readable.fromWeb(upstream.body).pipe(res);
  } catch {
    res.status(400).send('Gagal mengunduh berkas.');
  }
});

// 2. TikTok Profile Stalker
app.post('/api/tools/stalk-tiktok', async (req, res) => {
  try {
    const result = await toolsHub.stalkTikTokProfile(req.body?.username);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 3. WhatsApp Channel Info & Stalker
app.post('/api/tools/stalk-wa', async (req, res) => {
  try {
    const result = await toolsHub.stalkWhatsAppChannel(req.body?.url);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 4. AI Background Remover
app.post('/api/tools/removebg', async (req, res) => {
  try {
    const result = await toolsHub.removeImageBackground({
      imageBase64: req.body?.imageBase64,
      imageUrl: req.body?.imageUrl
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 5. YouTube Search (Cari Lagu / Video)
app.post('/api/tools/yt-search', async (req, res) => {
  try {
    const items = await toolsHub.searchYouTubeVideos(req.body?.query);
    res.json({ ok: true, items });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 6. YouTube to MP3 Multi-Bitrate (64, 96, 128, 192, 256, 320 kbps)
app.post('/api/tools/ytmp3', async (req, res) => {
  try {
    const result = await toolsHub.convertYouTubeMp3({
      url: req.body?.url,
      quality: req.body?.quality
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 7. AI Roaster & Skor Aura Akun TikTok
app.post('/api/tools/roast-tiktok', async (req, res) => {
  try {
    const result = await extraTools.roastTikTokAccount({
      username: req.body?.username,
      mode: req.body?.mode
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 8. AI Foto HD Enhancer (Remini)
app.post('/api/tools/remini', async (req, res) => {
  try {
    const result = await extraTools.enhancePhotoHd({
      imageBase64: req.body?.imageBase64,
      imageUrl: req.body?.imageUrl
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 9. AI Image Generator (Text to Image HD)
app.post('/api/tools/ai-image', async (req, res) => {
  try {
    const result = await extraTools.generateAiImage({
      prompt: req.body?.prompt,
      ratio: req.body?.ratio,
      style: req.body?.style
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 10. Voice Over Narator Konten (Dracin BGM + Gemini AI + Multi-Bahasa TTS MP3)
app.post('/api/tools/tts', async (req, res) => {
  try {
    const result = await extraTools.synthesizeTtsMp3({
      text: req.body?.text,
      lang: req.body?.lang,
      engine: req.body?.engine,
      speed: req.body?.speed,
      music: req.body?.music
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 11. Pencari Lirik Lagu untuk Kartu Lirik Estetik
app.post('/api/tools/lyrics', async (req, res) => {
  try {
    const items = await extraTools.searchSongLyrics({
      query: req.body?.query
    });
    res.json({ ok: true, items });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 12. Detektif Username OSINT Scanner (16+ Platform)
app.post('/api/tools/osint', async (req, res) => {
  try {
    const result = await extraTools.scanUsernameOsint({
      username: req.body?.username
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 13. Pembongkar Link Mencurigakan & Pelacak Server IP
app.post('/api/tools/scan-link', async (req, res) => {
  try {
    const result = await extraTools.unshortenAndScanUrl({
      url: req.body?.url
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 14. Pemendek Link Gratis (Shortlink)
app.post('/api/tools/shortlink', async (req, res) => {
  try {
    const result = await extraTools.createShortUrl({
      url: req.body?.url,
      provider: req.body?.provider
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 15. QR Matrix Base64 (ECC High 30% agar aman dipasang Logo Tengah)
app.post('/api/tools/qr-base', async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ ok: false, error: 'Masukkan teks atau URL untuk QR Code.' });
    const qrRes = await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=760x760&ecc=H&margin=2&data=${encodeURIComponent(text)}`
    );
    if (!qrRes.ok) throw new Error('Gagal membuat matriks QR Code.');
    const arr = await qrRes.arrayBuffer();
    res.json({
      ok: true,
      qrDataUrl: `data:image/png;base64,${Buffer.from(arr).toString('base64')}`
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 16. Emoji Mix Kitchen Sticker Combiner (Official Google CDN)
app.post('/api/tools/emojimix', async (req, res) => {
  try {
    const result = await extraTools.combineEmojiKitchen({
      emoji1: req.body?.emoji1,
      emoji2: req.body?.emoji2
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 17. Pendeteksi Judul Lagu FYP / Shazam Audio Recognizer
app.post('/api/tools/shazam', async (req, res) => {
  try {
    const result = await extraTools.recognizeMusicShazam({
      audioBase64: req.body?.audioBase64 || req.body?.mediaBase64,
      audioUrl: req.body?.audioUrl
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 18. AI Perangkum Video YouTube, Transkrip & Thumbnail 4K
app.post('/api/tools/yt-summary', async (req, res) => {
  try {
    const result = await extraTools.summarizeAndTranscribeYoutube({
      url: req.body?.url
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ===========================================================================
// MODUL BARU: PENAMBAH FOLLOWERS SALURAN WHATSAPP (jalur gratis nyata)
// ===========================================================================

// Daftar jalur gratis + status konfigurasi (tanpa membocorkan API key)
app.get('/api/followers/channels', (req, res) => {
  try {
    res.json({ ok: true, channels: followerPool.getChannelCatalog() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Simpan konfigurasi WAHA mandiri / API key panel SMM
app.post('/api/followers/config', (req, res) => {
  try {
    const channels = followerPool.updateConfig(req.body || {});
    res.json({ ok: true, channels });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Health-check semua jalur (paralel, tanpa memotong kuota)
app.get('/api/followers/health', async (req, res) => {
  try {
    const health = await followerPool.checkChannelsHealth({
      force: req.query.force === '1'
    });
    res.json({ ok: true, ...health });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Diagnostik katalog layanan panel — dipakai bila panel online tetapi tidak ada
// layanan yang dikenali, agar nama layanan aslinya terlihat.
app.get('/api/followers/services', async (req, res) => {
  try {
    const channelId = String(req.query.channel || 'followdeh');
    const result = await followerPool.listPanelServices(channelId);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Validasi tautan saluran + baca nama & jumlah pengikut publik
app.post('/api/followers/inspect', async (req, res) => {
  try {
    const parsed = followerPool.parseChannelLink(req.body?.link);
    const probe = await followerPool.probePublicChannel(parsed.channelCode, {
      timeoutMs: 10000,
      force: req.body?.force === true
    });
    res.json({ ok: true, parsed, channel: probe });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Penautan nomor WhatsApp ke instance WAHA mandiri (QR / status sesi)
app.get('/api/followers/waha/status', async (req, res) => {
  try {
    res.json({ ok: true, ...(await followerPool.getWahaStatus()) });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/followers/waha/connect', async (req, res) => {
  try {
    res.json({ ok: true, ...(await followerPool.ensureWahaSession()) });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Riwayat order penambahan followers
app.get('/api/followers/orders', (req, res) => {
  res.json({ ok: true, orders: followerPool.getOrders() });
});

app.delete('/api/followers/orders', (req, res) => {
  followerPool.clearOrders();
  res.json({ ok: true, orders: [] });
});

// Jalankan penambahan followers (auto-failover lintas jalur gratis)
app.post('/api/followers/order', async (req, res) => {
  try {
    const result = await followerPool.placeFollowerOrder({
      channelLink: req.body?.link,
      quantity: req.body?.quantity,
      channelId: req.body?.channelId || 'auto',
      note: req.body?.note
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Cek ulang bukti kenaikan pengikut + status panel
app.post('/api/followers/orders/:id/refresh', async (req, res) => {
  try {
    const order = await followerPool.refreshOrder(req.params.id);
    res.json({ ok: true, order });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Pastikan seluruh endpoint /api/* selalu mengembalikan JSON (bukan HTML)
app.all('/api/*', (req, res) => {
  res.status(404).json({
    ok: false,
    error: `Endpoint API tidak ditemukan: ${req.method} ${req.originalUrl || req.url}`
  });
});

// Global error handler agar kegagalan body-parser / runtime pada /api/* tetap berformat JSON
app.use((err, req, res, next) => {
  if (req.path && req.path.startsWith('/api')) {
    const isTooLarge =
      err.type === 'entity.too.large' || err.status === 413 || /too large/i.test(err.message || '');
    const status = isTooLarge ? 413 : err.status || 500;
    return res.status(status).json({
      ok: false,
      error: isTooLarge
        ? 'Ukuran data yang dikirim melebihi batas server (4 MB). Untuk audio/video, potong klip 10–15 detik (aplikasi melakukannya otomatis saat memilih berkas).'
        : err.message || 'Terjadi kesalahan internal pada server.'
    });
  }
  next(err);
});

// Halaman showcase statis (dokumentasi interaktif) — lihat folder docs/
app.use(
  '/showcase',
  express.static(path.join(__dirname, 'docs'), {
    setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
  })
);

// Fallback SPA ke index.html (hanya non-API)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`D4Tech Hub berjalan di http://${HOST}:${PORT}`);
  });
}

module.exports = app;
