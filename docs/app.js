/* ==========================================================================
   D4TECH HUB — SHOWCASE  /  interaksi
   Vanilla JS, tanpa dependensi. Semua demo berjalan lokal di peramban.
   ========================================================================== */
(() => {
  'use strict';

  /* ---------------------------------------------------------------- config */
  // Isi dengan URL deployment bila showcase ini dipublikasikan di GitHub Pages,
  // contoh: window.D4TECH_APP_URL = 'https://d4tech-hub.vercel.app';
  let APP_BASE = (() => {
    if (typeof window.D4TECH_APP_URL === 'string' && window.D4TECH_APP_URL.trim()) {
      return window.D4TECH_APP_URL.trim().replace(/\/+$/, '');
    }
    // Di-serve langsung oleh aplikasi Express pada rute /showcase
    if (/(^|\/)showcase(\/|$)/.test(location.pathname)) return '';
    return null; // belum diketahui → dipastikan lewat probe /api/state
  })();

  function syncAppLinks() {
    if (APP_BASE === null) return;
    const appLink = document.querySelector('[data-app-link]');
    if (appLink) appLink.setAttribute('href', `${APP_BASE}/`);
  }

  /* ------------------------------------------------------------------ data */
  const ICONS = {
    send: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    ytmp3: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    downloader: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    tts: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>',
    remini: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    removebg: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
    audiostudio: '<path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/>',
    emojimix: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
    shazam: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v2"/><path d="M12 19v2"/>',
    ytsummary: '<rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10 9 15 12 10 15 10 9"/>',
    compressor: '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>',
    imgtopdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>',
    aiimage: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
    roaster: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    stalker: '<circle cx="9" cy="7" r="3.2"/><path d="M3 21v-1.6A5.4 5.4 0 0 1 8.4 14h1.2"/><path d="M15 17v4"/><path d="M19 12v9"/><path d="M23 15v6"/>',
    generator: '<path d="M8 10h8"/><path d="M8 14h5"/><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>',
    receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/>',
    mlbbwr: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/>',
    osint: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>',
    pixelvault: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    cyberutil: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><path d="M14 3h7v7"/><path d="M3 14h7v7"/>'
  };

  const TOOLS = [
    { slug: 'send', cat: 'sosmed', title: 'Reaction Saluran WhatsApp', tag: 'Multi-Gateway', desc: 'Kirim kombinasi multi-emoji ke tautan postingan Saluran WhatsApp secara otomatis melalui jaringan pool publik.' },
    { slug: 'ytmp3', cat: 'sosmed', title: 'YouTube ke MP3 Multi-Kualitas', tag: '64–320 kbps', desc: 'Ekstrak audio dari tautan YouTube atau pencarian judul lagu dengan pilihan bitrate hingga 320 kbps Hi-Fi.' },
    { slug: 'tts', cat: 'kreator', title: 'Studio Narator Dracin & AI TTS', tag: 'Dracin + BGM', desc: 'Sintesis suara narator alur cerita film lengkap dengan musik latar dramatis, suara natural Gemini, dan 7 bahasa.' },
    { slug: 'downloader', cat: 'sosmed', title: 'Downloader TikTok & Sosmed HD', tag: 'Tanpa WM', desc: 'Unduh video TikTok resolusi asli tanpa tanda air, koleksi slide foto, trek MP3, serta Reels sosial media.' },
    { slug: 'remini', cat: 'ai', title: 'Penjernih Foto HD (Remini)', tag: 'Cloud GPU', desc: 'Restorasi detail wajah dan ketajaman foto beresolusi rendah dilengkapi penggeser perbandingan langsung.' },
    { slug: 'removebg', cat: 'ai', title: 'Hapus Background & Pasfoto', tag: 'Cutout + Pasfoto', desc: 'Pisahkan objek utama dari latar belakang secara presisi lalu terapkan latar transparan, merah, atau biru pasfoto.' },
    { slug: 'audiostudio', cat: 'kreator', title: 'Studio Audio 8D, Slowed & Reverb', tag: 'WebAudio DSP', desc: 'Olahan efek spasial 8D, Slowed + Reverb, Nightcore, dan penguat sub-bass langsung di peramban dengan ekspor WAV.' },
    { slug: 'emojimix', cat: 'kreator', title: 'Emoji Mix Kitchen & Brat Maker', tag: 'PNG Sticker', desc: 'Padukan dua emoji menjadi stiker PNG transparan dari katalog Google Emoji Kitchen atau buat sampul teks Brat.' },
    { slug: 'shazam', cat: 'sosmed', title: 'Pendeteksi Judul Lagu FYP', tag: 'Audio Fingerprint', desc: 'Identifikasi judul lagu, artis, dan album asli dari potongan video pendek MP4 maupun rekaman audio.' },
    { slug: 'ytsummary', cat: 'ai', title: 'Ringkas YouTube & Thumbnail 4K', tag: 'AI + 4K', desc: 'Rangkum poin utama video YouTube ke Bahasa Indonesia, ekstrak teks transkrip penuh, dan unduh sampul MaxRes.' },
    { slug: 'compressor', cat: 'siber', title: 'Kompresor Foto Target KB & Format', tag: '100% Lokal', desc: 'Perkecil ukuran berkas foto tepat di bawah batas syarat unggah (<100 KB / <200 KB) dan konversi JPG/WebP/PNG.' },
    { slug: 'imgtopdf', cat: 'siber', title: 'Gabung Foto ke Dokumen PDF', tag: 'PDF 1.4 Lokal', desc: 'Satukan beberapa foto dokumen, catatan, atau identitas menjadi satu berkas PDF A4 langsung di peramban.' },
    { slug: 'aiimage', cat: 'ai', title: 'AI Image Generator HD', tag: 'Text-to-Image', desc: 'Hasilkan ilustrasi 3D, fotografi realistis, atau vektor dari deskripsi teks dalam rasio 1:1, 9:16, dan 16:9.' },
    { slug: 'roaster', cat: 'ai', title: 'AI Roaster & Skor Aura TikTok', tag: 'Profil + Kartu', desc: 'Evaluasi statistik akun TikTok publik dengan komentar komedi AI dan ekspor kartu skor resolusi tinggi.' },
    { slug: 'stalker', cat: 'sosmed', title: 'Analitik Profil TikTok & Saluran WA', tag: 'Analitik', desc: 'Tinjau metrik pengikut, total suka, bio, serta unduh avatar asli dari akun TikTok maupun Saluran WhatsApp.' },
    { slug: 'generator', cat: 'kreator', title: 'Stiker Komentar TikTok & Mockup Chat', tag: 'Overlay PNG', desc: 'Buat aset balasan komentar TikTok latar transparan untuk editor video, stiker kutipan WA, dan mockup percakapan.' },
    { slug: 'receipt', cat: 'kreator', title: 'Struk Thermal & Kartu Lirik Lagu', tag: 'Visual Grafis', desc: 'Susun daftar putar menjadi cetakan struk kasir ber-barcode atau cari lirik otomatis ke dalam kartu tipografi.' },
    { slug: 'mlbbwr', cat: 'siber', title: 'Kalkulator Target Winrate MLBB', tag: 'Kalkulasi', desc: 'Hitung presisi jumlah kemenangan beruntun tanpa kalah yang dibutuhkan untuk mencapai persentase Winrate target.' },
    { slug: 'osint', cat: 'siber', title: 'Pencari Jejak Username (OSINT)', tag: 'OSINT 16 Situs', desc: 'Periksa ketersediaan dan jejak akun satu username secara paralel di 16 platform komunitas, kode, dan sosial.' },
    { slug: 'pixelvault', cat: 'siber', title: 'Pixel Vault — Steganografi Citra', tag: 'LSB Stego', desc: 'Sisipkan dan kunci pesan teks terenkripsi ke dalam bit piksel berkas PNG secara lokal tanpa mengubah visual foto.' },
    { slug: 'cyberutil', cat: 'siber', title: 'Inspektur Tautan, Shortlink & QR', tag: 'Jaringan & QR', desc: 'Lacak rantai pengalihan tautan mencurigakan beserta lokasi IP server, ringkas URL panjang, dan cetak kode QR.' }
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------------- toast */
  const toastStack = $('#toastStack');
  function toast(message) {
    if (!toastStack) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    toastStack.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 2400);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    }
  }

  /* --------------------------------------------------------------- marquee */
  const marqueeTrack = $('#marqueeTrack');
  if (marqueeTrack) {
    const words = ['YouTube MP3', 'TikTok No-WM', '8D Audio', 'Remini HD', 'Remove Background', 'AI Image', 'Narator Dracin', 'Emoji Kitchen', 'Brat Cover', 'Receiptify', 'Foto ke PDF', 'Stego LSB', 'OSINT 16', 'QR Berlogo', 'Winrate MLBB', 'Anti-Phishing', 'Shazam FYP', 'Kartu Aura'];
    const sequence = [...words, ...words];
    marqueeTrack.innerHTML = sequence.map((w) => `<span class="marquee-item">${w}</span>`).join('');
  }

  /* ------------------------------------------------------------ tool grid */
  const grid = $('#toolGrid');
  const emptyState = $('#emptyState');
  const visibleCount = $('#visibleCount');
  const searchInput = $('#toolSearch');
  const chips = $$('#catChips .chip-btn');

  let activeCat = 'all';
  let query = '';

  const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function matches(tool) {
    if (activeCat !== 'all' && tool.cat !== activeCat) return false;
    if (!query) return true;
    const haystack = normalize(`${tool.title} ${tool.desc} ${tool.tag} ${tool.slug}`);
    return normalize(query).split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
  }

  function renderTools() {
    if (!grid) return;
    const visible = TOOLS.filter(matches);
    grid.innerHTML = visible
      .map((tool, i) => {
        const index = TOOLS.indexOf(tool) + 1;
        return `
        <button type="button" class="tool-card" data-slug="${tool.slug}" data-cat="${tool.cat}" style="animation-delay:${Math.min(i * 22, 260)}ms">
          <span class="tool-top">
            <span class="tool-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[tool.slug] || ICONS.cyberutil}</svg></span>
            <span class="tool-badge">${tool.tag}</span>
            <span class="tool-num">${String(index).padStart(2, '0')}</span>
          </span>
          <span class="tool-title">${tool.title}</span>
          <span class="tool-desc">${tool.desc}</span>
          <span class="tool-foot">/?tool=${tool.slug}<span class="arrow">→</span></span>
        </button>`;
      })
      .join('');

    if (emptyState) emptyState.hidden = visible.length > 0;
    if (visibleCount) visibleCount.textContent = String(visible.length);
    bindCardHover();
  }

  function bindCardHover() {
    $$('.tool-card').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        card.style.setProperty('--my', `${event.clientY - rect.top}px`);
      });
      card.addEventListener('click', () => openTool(card.dataset.slug));
    });
  }

  function openTool(slug) {
    const path = `/?tool=${slug}`;
    if (APP_BASE !== null) {
      window.open(`${APP_BASE}${path}`, '_blank', 'noopener');
      return;
    }
    copyText(path).then((ok) => {
      toast(ok ? `Deep-link ${path} disalin` : 'Jalankan aplikasi: npm start');
    });
  }

  renderTools();

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      activeCat = chip.dataset.cat;
      chips.forEach((c) => c.classList.toggle('active', c === chip));
      renderTools();
    });
  });

  let searchTimer;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const value = searchInput.value;
    searchTimer = setTimeout(() => {
      query = value.trim();
      renderTools();
    }, 90);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput?.focus();
    }
    if (event.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.value = '';
      query = '';
      renderTools();
      searchInput.blur();
    }
  });

  $('#diceBtn')?.addEventListener('click', () => {
    const cards = $$('.tool-card');
    if (!cards.length) return;
    const pick = cards[Math.floor(Math.random() * cards.length)];
    cards.forEach((c) => c.classList.remove('is-picked'));
    pick.classList.add('is-picked');
    pick.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    toast(`Modul acak: ${$('.tool-title', pick).textContent}`);
    setTimeout(() => pick.classList.remove('is-picked'), 2600);
  });

  /* -------------------------------------------------------------- app link */
  syncAppLinks();

  // Bila showcase & aplikasi berada di origin yang sama (mis. /showcase),
  // probe ringan berikut memastikan tautan modul bisa dibuka langsung.
  if (APP_BASE === null && location.protocol.startsWith('http')) {
    fetch('/api/state', { headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.ok) {
          APP_BASE = '';
          syncAppLinks();
        }
      })
      .catch(() => {});
  }

  /* ------------------------------------------------------------- copy code */
  $$('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const ok = await copyText(button.dataset.copy);
      toast(ok ? 'Disalin ke clipboard' : 'Gagal menyalin');
      if (button.classList.contains('code-copy')) {
        const original = button.textContent;
        button.textContent = ok ? 'tersalin' : 'gagal';
        button.classList.add('is-done');
        setTimeout(() => {
          button.textContent = original;
          button.classList.remove('is-done');
        }, 1600);
      }
    });
  });

  /* ------------------------------------------------------------------- nav */
  const nav = $('#siteNav');
  const onScroll = () => nav?.classList.toggle('is-stuck', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const burger = $('#navBurger');
  const mobileMenu = $('#mobileMenu');
  burger?.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!open));
    mobileMenu.hidden = open;
  });
  $$('#mobileMenu a').forEach((link) =>
    link.addEventListener('click', () => {
      burger?.setAttribute('aria-expanded', 'false');
      if (mobileMenu) mobileMenu.hidden = true;
    })
  );

  const navLinks = $$('.nav-links a');
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if (sections.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((link) =>
            link.classList.toggle('is-current', link.getAttribute('href') === `#${entry.target.id}`)
          );
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach((section) => spy.observe(section));
  }

  /* ---------------------------------------------------------------- reveal */
  const revealItems = $$('.reveal');
  if (revealItems.length) {
    if (reducedMotion) {
      revealItems.forEach((el) => el.classList.add('in'));
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
      );
      revealItems.forEach((el) => io.observe(el));
    }
  }

  // hero entrance stagger
  requestAnimationFrame(() => {
    $$('.hero .reveal').forEach((el, i) => {
      if (reducedMotion) return;
      el.style.transitionDelay = `${i * 70}ms`;
    });
  });

  /* ------------------------------------------------------------- playground */
  // tabs
  const playTabs = $$('.play-tab');
  playTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      playTabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', String(on));
      });
      $$('.play-panel').forEach((panel) => {
        const on = panel.id === `panel-${tab.dataset.panel}`;
        panel.classList.toggle('active', on);
        panel.hidden = !on;
      });
    });
  });

  /* -------------------------------------------------------- brat generator */
  const bratCanvas = $('#bratCanvas');
  const bratText = $('#bratText');
  const bratSize = $('#bratSize');
  const bratBlur = $('#bratBlur');
  let bratColor = '#111111';

  function drawBrat() {
    if (!bratCanvas || !bratText) return;
    const size = Number(bratSize?.value || 1000);
    bratCanvas.width = size;
    bratCanvas.height = size;

    const ctx = bratCanvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const raw = (bratText.value || 'd4tech hub').toLowerCase().replace(/\s+/g, ' ').trim();
    const words = raw.split(' ');
    const maxWidth = size * 0.82;
    const maxHeight = size * 0.72;

    let fontSize = size * 0.2;
    let rounds = 0;
    let lines = [];

    while (rounds < 120) {
      ctx.font = `700 ${fontSize}px "Arial Narrow", Arial, Helvetica, sans-serif`;
      lines = [];
      let current = '';
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (ctx.measureText(candidate).width > maxWidth && current) {
          lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      if (current) lines.push(current);
      const blockHeight = lines.length * fontSize * 1.02;
      const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
      if ((blockHeight <= maxHeight && widest <= maxWidth) || fontSize <= size * 0.035) break;
      fontSize *= 0.955;
      rounds += 1;
    }

    const lineHeight = fontSize * 1.02;
    const startY = size / 2 - ((lines.length - 1) * lineHeight) / 2;
    const blur = Number(bratBlur?.value || 0);
    const filter = blur > 0 ? `blur(${(blur / 1000) * size * 1.35}px)` : 'none';

    if ('filter' in ctx) ctx.filter = filter;
    ctx.fillStyle = bratColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${fontSize}px "Arial Narrow", Arial, Helvetica, sans-serif`;
    lines.forEach((line, i) => {
      ctx.fillText(line, size / 2, startY + i * lineHeight);
      if (blur > 0 && !('filter' in ctx)) {
        ctx.fillText(line, size / 2 + blur * 0.2, startY + i * lineHeight);
      }
    });
    if ('filter' in ctx) ctx.filter = 'none';
  }

  bratText?.addEventListener('input', drawBrat);
  bratSize?.addEventListener('change', drawBrat);
  bratBlur?.addEventListener('input', drawBrat);

  $$('#bratSwatches .swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      bratColor = swatch.dataset.color;
      $$('#bratSwatches .swatch').forEach((s) => s.classList.toggle('active', s === swatch));
      drawBrat();
    });
  });

  $('#bratDownload')?.addEventListener('click', () => {
    if (!bratCanvas) return;
    bratCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `brat-${(bratText?.value || 'd4tech').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Sampul brat diunduh');
    }, 'image/png');
  });

  if (bratCanvas) drawBrat();

  /* ------------------------------------------------------------ kompresor */
  const compressInput = $('#compressInput');
  const compressDrop = $('#compressDrop');
  const compressTarget = $('#compressTarget');
  const compressFormat = $('#compressFormat');
  const compressPreview = $('#compressPreview');
  const compressDownload = $('#compressDownload');
  const compressStats = $('#compressStats');
  const compressFrame = $('#compressFrame');

  let sourceImage = null;
  let compressedBlob = null;

  const formatBytes = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  function loadImage(file) {
    if (!file || !file.type.startsWith('image/')) {
      toast('Pilih berkas gambar (JPG, PNG, atau WebP)');
      return;
    }
    const img = new Image();
    img.onload = () => {
      sourceImage = img;
      const label = $('#compressDropLabel');
      if (label) label.textContent = `${file.name} · ${formatBytes(file.size)}`;
      compressStats.hidden = false;
      const before = $('#statBefore');
      if (before) before.textContent = formatBytes(file.size);
      runCompress(file.size);
    };
    img.onerror = () => toast('Gagal membaca gambar tersebut');
    img.src = URL.createObjectURL(file);
  }

  async function runCompress(originalSize) {
    if (!sourceImage) return;
    const mime = compressFormat?.value || 'image/jpeg';
    const targetKB = Number(compressTarget?.value || 200);
    const targetBytes = targetKB * 1024;

    const maxSide = 2600;
    let width = sourceImage.naturalWidth;
    let height = sourceImage.naturalHeight;
    if (Math.max(width, height) > maxSide) {
      const scale = maxSide / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(sourceImage, 0, 0, width, height);

    const toBlob = (quality) =>
      new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), mime, quality));

    let low = 0.08;
    let high = 0.96;
    let best = null;
    for (let i = 0; i < 9; i += 1) {
      const quality = (low + high) / 2;
      const blob = await toBlob(quality);
      if (!blob) break;
      if (blob.size <= targetBytes) {
        best = blob;
        low = quality;
      } else {
        high = quality;
      }
    }
    if (!best) best = await toBlob(0.08);
    if (!best) return;

    compressedBlob = best;
    const url = typeof compressedBlob === 'string' ? compressedBlob : URL.createObjectURL(best);

    if (compressPreview) {
      compressPreview.src = url;
      compressPreview.hidden = false;
      compressFrame?.querySelector('.stage-empty')?.remove();
    }
    compressDownload.disabled = false;

    const after = $('#statAfter');
    const saved = $('#statSaved');
    if (after) after.textContent = formatBytes(best.size);
    if (saved && originalSize) {
      const percent = Math.max(0, Math.round((1 - best.size / originalSize) * 100));
      saved.textContent = `${percent}% lebih kecil`;
    }
  }

  compressInput?.addEventListener('change', (event) => loadImage(event.target.files?.[0]));
  compressTarget?.addEventListener('change', () => {
    const label = compressInput?.files?.[0];
    if (label) runCompress(label.size);
  });
  compressFormat?.addEventListener('change', () => {
    const label = compressInput?.files?.[0];
    if (label) runCompress(label.size);
  });

  ['dragenter', 'dragover'].forEach((type) =>
    compressDrop?.addEventListener(type, (event) => {
      event.preventDefault();
      compressDrop.classList.add('is-over');
    })
  );
  ['dragleave', 'drop'].forEach((type) =>
    compressDrop?.addEventListener(type, (event) => {
      event.preventDefault();
      compressDrop.classList.remove('is-over');
    })
  );
  compressDrop?.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) loadImage(file);
  });

  compressDownload?.addEventListener('click', () => {
    if (!compressedBlob) return;
    const url = URL.createObjectURL(compressedBlob);
    const link = document.createElement('a');
    link.href = url;
    const ext = (compressFormat?.value || 'image/jpeg') === 'image/webp' ? 'webp' : 'jpg';
    link.download = `d4tech-kompres.${ext}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Foto terkompresi diunduh');
  });

  /* -------------------------------------------------------------- counters */
  const counters = $$('[data-count]');
  if (counters.length && !reducedMotion) {
    const counterIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = Number(el.dataset.count || 0);
        const start = performance.now();
        const duration = 900;
        const step = (now) => {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = String(Math.round(target * eased));
          if (progress < 1) requestAnimationFrame(step);
          else el.textContent = String(target);
        };
        requestAnimationFrame(step);
        counterIO.unobserve(el);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => counterIO.observe(el));
  }

  /* ------------------------------------------------------- spotlight tunggal */
  $$('.bento-item').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      card.style.setProperty('--my', `${event.clientY - rect.top}px`);
    });
  });
})();
