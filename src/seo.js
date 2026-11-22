'use strict';

/**
 * Metadata SEO per tool (21 perangkat).
 * Sumber: kartu direktori di public/index.html (data-open-tool + bento-title/desc).
 * Dipakai server.js untuk injeksi <title>/meta dinamis per ?tool=<slug>,
 * sitemap.xml, dan JSON-LD WebApplication.
 */

const SITE_NAME = 'D4Tech Hub';
const SITE_TAGLINE = 'Direktori 21 Perangkat Kreator, AI & Siber Gratis';

const TOOLS = {
  send: {
    title: 'Reaction Saluran WhatsApp',
    desc: 'Kirim kombinasi multi-emoji ke tautan postingan Saluran WhatsApp secara otomatis melalui jaringan pool publik.',
    keywords: 'wa whatsapp reaction saluran channel emoji booster'
  },
  ytmp3: {
    title: 'YouTube ke MP3 Multi-Kualitas',
    desc: 'Ekstrak audio dari tautan YouTube atau pencarian judul lagu dengan pilihan bitrate hingga 320 kbps Hi-Fi.',
    keywords: 'youtube mp3 musik lagu bitrate 320kbps 128kbps download audio'
  },
  tts: {
    title: 'Studio Narator Dracin & AI TTS',
    desc: 'Sintesis suara narator alur cerita film lengkap dengan musik latar dramatis, suara natural Gemini, dan 7 bahasa.',
    keywords: 'tts dracin alur cerita drama china bgm gemini voice over narator suara tiktok bahasa indonesia mp3'
  },
  downloader: {
    title: 'Downloader TikTok & Sosmed HD',
    desc: 'Unduh video TikTok resolusi asli tanpa tanda air, koleksi slide foto, trek MP3, serta Reels sosial media.',
    keywords: 'tiktok downloader video tanpa watermark slide foto ig reels mp4'
  },
  remini: {
    title: 'Penjernih Foto HD (Remini)',
    desc: 'Restorasi detail wajah dan ketajaman foto beresolusi rendah dilengkapi penggeser perbandingan langsung.',
    keywords: 'remini jernihkan foto hd blur burik upscale tajam'
  },
  removebg: {
    title: 'Hapus Background & Pasfoto',
    desc: 'Pisahkan objek utama dari latar belakang secara presisi lalu terapkan latar transparan, merah, atau biru pasfoto.',
    keywords: 'hapus background foto ai pasfoto merah biru transparan png'
  },
  audiostudio: {
    title: 'Studio Audio 8D, Slowed & Reverb',
    desc: 'Olahan efek spasial 8D, Slowed + Reverb, Nightcore, dan penguat sub-bass langsung di peramban dengan ekspor WAV.',
    keywords: '8d audio slowed reverb nightcore bass booster jedag jedug lagu'
  },
  emojimix: {
    title: 'Emoji Mix Kitchen & Brat Maker',
    desc: 'Padukan dua emoji menjadi stiker PNG transparan dari katalog Google Emoji Kitchen atau buat sampul teks Brat.',
    keywords: 'emoji mix kitchen gabung stiker wa brat meme teks viral'
  },
  shazam: {
    title: 'Pendeteksi Judul Lagu FYP',
    desc: 'Identifikasi judul lagu, artis, dan album asli dari potongan video pendek MP4 maupun rekaman audio.',
    keywords: 'shazam cari judul lagu musik fyp tiktok audio recognizer whatsmusic'
  },
  ytsummary: {
    title: 'Ringkas YouTube & Thumbnail 4K',
    desc: 'Rangkum poin utama video YouTube ke Bahasa Indonesia, ekstrak teks transkrip penuh, dan unduh sampul MaxRes.',
    keywords: 'youtube summarize rangkuman ai transkrip subtitle thumbnail 4k hd'
  },
  compressor: {
    title: 'Kompresor Foto Target KB & Format',
    desc: 'Perkecil ukuran berkas foto tepat di bawah batas syarat unggah (<100 KB / <200 KB) dan konversi JPG/WebP/PNG.',
    keywords: 'kompres foto ukuran kb mb 100kb 200kb webp png jpg konverter'
  },
  imgtopdf: {
    title: 'Gabung Foto ke Dokumen PDF',
    desc: 'Satukan beberapa foto dokumen, catatan, atau identitas menjadi satu berkas PDF A4 langsung di peramban.',
    keywords: 'foto ke pdf gabung gambar ktp dokumen tugas a4 scanner'
  },
  aiimage: {
    title: 'AI Image Generator HD',
    desc: 'Hasilkan ilustrasi 3D, fotografi realistis, atau vektor dari deskripsi teks dalam rasio 1:1, 9:16, dan 16:9.',
    keywords: 'ai image generator buat gambar dari teks anime 3d poster'
  },
  roaster: {
    title: 'AI Roaster & Skor Aura TikTok',
    desc: 'Evaluasi statistik akun TikTok publik dengan komentar komedi AI dan ekspor kartu skor resolusi tinggi.',
    keywords: 'ai roaster roasting aura akun tiktok komedi fyp kartu'
  },
  stalker: {
    title: 'Analitik Profil TikTok & Saluran WA',
    desc: 'Tinjau metrik pengikut, total suka, bio, serta unduh avatar asli dari akun TikTok maupun Saluran WhatsApp.',
    keywords: 'stalker cek profil tiktok saluran wa followers avatar hd'
  },
  generator: {
    title: 'Stiker Komentar TikTok & Mockup Chat',
    desc: 'Buat aset balasan komentar TikTok latar transparan untuk editor video, stiker kutipan WA, dan mockup percakapan.',
    keywords: 'stiker komentar tiktok transparan quoted wa fake chat iphone'
  },
  receipt: {
    title: 'Struk Thermal & Kartu Lirik Lagu',
    desc: 'Susun daftar putar menjadi cetakan struk kasir ber-barcode atau cari lirik otomatis ke dalam kartu tipografi.',
    keywords: 'struk kasir estetik receiptify kartu lirik spotify story'
  },
  mlbbwr: {
    title: 'Kalkulator Target Winrate MLBB',
    desc: 'Hitung presisi jumlah kemenangan beruntun tanpa kalah yang dibutuhkan untuk mencapai persentase Winrate target.',
    keywords: 'mlbb mobile legends winrate wr kalkulator winstreak game'
  },
  osint: {
    title: 'Pencari Jejak Username (OSINT)',
    desc: 'Periksa ketersediaan dan jejak akun satu username secara paralel di 16 platform komunitas, kode, dan sosial.',
    keywords: 'osint detektif lacak username sosmed github tiktok reddit roblox'
  },
  pixelvault: {
    title: 'Pixel Vault — Steganografi Citra',
    desc: 'Sisipkan dan kunci pesan teks terenkripsi ke dalam bit piksel berkas PNG secara lokal tanpa mengubah visual foto.',
    keywords: 'steganografi pixel vault pesan rahasia foto enkripsi password'
  },
  cyberutil: {
    title: 'Inspektur Tautan, Shortlink & QR',
    desc: 'Lacak rantai pengalihan tautan mencurigakan beserta lokasi IP server, ringkas URL panjang, dan cetak kode QR.',
    keywords: 'anti phishing bongkar shortlink ip server qr code logo'
  }
};

// Alias deep-link lama (sinkron dengan TOOL_ALIASES di public/app.js)
const ALIASES = {
  '8d': 'audiostudio',
  audio: 'audiostudio',
  wa: 'send',
  reaction: 'send',
  mp3: 'ytmp3',
  dracin: 'tts',
  pdf: 'imgtopdf',
  wr: 'mlbbwr'
};

function resolveSlug(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return null;
  const mapped = ALIASES[key] || key;
  return Object.prototype.hasOwnProperty.call(TOOLS, mapped) ? mapped : null;
}

function getToolSeo(slug) {
  const resolved = resolveSlug(slug);
  if (!resolved) return null;
  const t = TOOLS[resolved];
  return {
    slug: resolved,
    title: `${t.title} — ${SITE_NAME}`,
    description: t.desc,
    keywords: t.keywords
  };
}

function getDefaultSeo() {
  return {
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description:
      'Portal super-app 21 tools kreator, AI & siber gratis: downloader TikTok tanpa watermark, YouTube ke MP3 320 kbps, penjernih foto HD, studio audio 8D, narator dracin AI, dan lainnya. Tanpa registrasi, PWA installable.',
    keywords:
      'd4tech hub, tools gratis, downloader tiktok, youtube mp3, remini, hapus background, 8d audio, tts dracin, osint, ai generator'
  };
}

function listSlugs() {
  return Object.keys(TOOLS);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Suntik meta SEO ke dalam HTML shell.
 * Mengganti <title>...</title> dan menyisipkan blok meta + JSON-LD
 * tepat setelahnya. HTML asli tidak diubah selain itu.
 */
function injectSeo(html, seo, canonicalUrl) {
  const title = escapeHtml(seo.title);
  const desc = escapeHtml(seo.description);
  const keywords = escapeHtml(seo.keywords || '');
  const canonical = canonicalUrl ? escapeHtml(canonicalUrl) : '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: seo.title,
    description: seo.description,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'IDR' },
    inLanguage: 'id-ID',
    url: canonicalUrl || undefined
  };

  const metaBlock = [
    `<meta name="description" content="${desc}" />`,
    keywords ? `<meta name="keywords" content="${keywords}" />` : '',
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    canonical ? `<meta property="og:url" content="${canonical}" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${desc}" />`,
    canonical ? `<link rel="canonical" href="${canonical}" />` : '',
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
  ]
    .filter(Boolean)
    .join('\n  ');

  let out = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>\n  ${metaBlock}`);
  return out;
}

function buildSitemap(baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const urls = [`${base}/`];
  for (const slug of listSlugs()) {
    urls.push(`${base}/?tool=${encodeURIComponent(slug)}`);
  }
  const today = new Date().toISOString().slice(0, 10);
  const entries = urls
    .map(
      (u) =>
        `  <url><loc>${escapeHtml(u)}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${u === `${base}/` ? '1.0' : '0.8'}</priority></url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function buildRobots(baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`;
}

module.exports = {
  SITE_NAME,
  SITE_TAGLINE,
  TOOLS,
  ALIASES,
  resolveSlug,
  getToolSeo,
  getDefaultSeo,
  listSlugs,
  injectSeo,
  buildSitemap,
  buildRobots,
  escapeHtml
};
