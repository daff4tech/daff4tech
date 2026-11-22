(() => {
  'use strict';

  const getHelpers = () =>
    window.D4Tech || {
      toast: (m) => alert(m),
      esc: (s) => String(s ?? ''),
      api: async (u, o) => (await fetch(u, o)).json()
    };

  function fmtCompact(n) {
    const num = Number(n || 0);
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return num.toLocaleString('id-ID');
  }

  function makeProxyDownloadUrl(rawUrl, filename) {
    return `/api/tools/proxy-download?url=${encodeURIComponent(rawUrl)}&filename=${encodeURIComponent(filename)}`;
  }

  // =========================================================================
  // TOOL 2: TIKTOK & SOSMED DOWNLOADER TANPA WATERMARK
  // =========================================================================
  function initDownloader() {
    const form = document.getElementById('downloaderForm');
    const input = document.getElementById('dlUrlInput');
    const pasteBtn = document.getElementById('btnPasteDl');
    const submitBtn = document.getElementById('btnRunDownloader');
    const resultBox = document.getElementById('downloaderResult');
    if (!form) return;

    pasteBtn?.addEventListener('click', async () => {
      const { toast } = getHelpers();
      try {
        const txt = await navigator.clipboard.readText();
        if (txt) {
          input.value = txt.trim();
          toast('Link berhasil ditempel dari clipboard.');
        } else {
          toast('Clipboard kosong, silakan tempel manual.', 'error');
        }
      } catch {
        input.focus();
        toast('Tekan lama pada kolom lalu pilih Tempel.', 'error');
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { api, esc, toast } = getHelpers();
      const url = input.value.trim();
      if (!url) return;

      const prevText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Mengekstrak Media...';
      resultBox.classList.remove('hidden');
      resultBox.innerHTML = `<div class="result-card-clean" style="text-align:center; color:var(--text-muted);"><span class="spinner" style="vertical-align:middle;margin-right:6px;"></span> Memproses tautan media sumber...</div>`;

      try {
        const data = await api('/api/tools/downloader', {
          method: 'POST',
          body: JSON.stringify({ url })
        });
        const r = data.result;
        const safeBase = (r.author?.username || 'd4tech').replace(/[^a-zA-Z0-9_-]/g, '');

        let slidesHtml = '';
        if (Array.isArray(r.images) && r.images.length > 0) {
          slidesHtml = `
            <div style="margin-top:1rem; font-weight:600; font-size:0.84rem;">
              Koleksi Slide Foto (${r.images.length} berkas tanpa watermark):
            </div>
            <div class="slides-grid">
              ${r.images
                .map(
                  (imgUrl, idx) => `
                <div class="slide-card">
                  <img src="${esc(imgUrl)}" alt="Slide ${idx + 1}" loading="lazy" />
                  <a href="${esc(makeProxyDownloadUrl(imgUrl, `${safeBase}-slide-${idx + 1}.jpg`))}" class="btn btn-primary btn-sm">
                    Unduh #${idx + 1}
                  </a>
                </div>
              `
                )
                .join('')}
            </div>
          `;
        }

        resultBox.innerHTML = `
          <div class="result-card-clean">
            <div class="media-preview-row">
              ${
                r.cover
                  ? `<img src="${esc(r.cover)}" alt="Cover" class="media-thumb" />`
                  : `<div class="media-thumb" style="display:grid;place-items:center;font-size:0.75rem;font-weight:700;color:var(--text-muted);">MEDIA</div>`
              }
              <div>
                <div style="display:flex; align-items:center; gap:0.45rem; margin-bottom:0.3rem;">
                  <span class="free-badge">${esc(r.platform || 'Media HD')}</span>
                  ${r.author?.nickname ? `<span style="font-size:0.82rem; font-weight:600;">${esc(r.author.nickname)}</span>` : ''}
                </div>
                <div style="font-weight:600; font-size:0.94rem; line-height:1.4; margin-bottom:0.45rem;">
                  ${esc(r.title || 'Media Siap Diunduh')}
                </div>
                ${
                  r.stats
                    ? `<div style="font-size:0.76rem; color:var(--text-muted);">
                        ${fmtCompact(r.stats.views ?? r.stats.plays)} tayangan &nbsp;&bull;&nbsp; ${fmtCompact(r.stats.likes)} suka &nbsp;&bull;&nbsp; ${fmtCompact(r.stats.comments)} komentar
                      </div>`
                    : ''
                }

                <div class="dl-actions-wrap">
                  ${
                    (r.videoHd || r.videoHdUrl)
                      ? `<a href="${esc(makeProxyDownloadUrl(r.videoHd || r.videoHdUrl, `${safeBase}-d4tech-hd.mp4`))}" class="btn btn-primary btn-sm">
                          Unduh Video HD
                        </a>`
                      : ''
                  }
                  ${
                    (r.videoSd || r.videoSdUrl) && (r.videoSd || r.videoSdUrl) !== (r.videoHd || r.videoHdUrl)
                      ? `<a href="${esc(makeProxyDownloadUrl(r.videoSd || r.videoSdUrl, `${safeBase}-d4tech-sd.mp4`))}" class="btn btn-secondary btn-sm">
                          Video Standar
                        </a>`
                      : ''
                  }
                  ${
                    (r.audioMp3 || r.musicUrl)
                      ? `<a href="${esc(makeProxyDownloadUrl(r.audioMp3 || r.musicUrl, `${safeBase}-d4tech-audio.mp3`))}" class="btn btn-secondary btn-sm">
                          Unduh Audio MP3
                        </a>`
                      : ''
                  }
                </div>
              </div>
            </div>
            ${slidesHtml}
          </div>
        `;
        toast('Media siap diunduh.');
      } catch (err) {
        resultBox.innerHTML = `<div class="result-card-clean" style="color:var(--danger); font-weight:600;">${esc(err.message)}</div>`;
        toast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = prevText;
      }
    });
  }

  // =========================================================================
  // TOOL 3: STALKER TIKTOK & CEK INFO SALURAN WHATSAPP
  // =========================================================================
  function initStalker() {
    const ttForm = document.getElementById('stalkTikTokForm');
    const waForm = document.getElementById('stalkWaForm');
    const ttInput = document.getElementById('stalkTikTokInput');
    const waInput = document.getElementById('stalkWaInput');
    const resultBox = document.getElementById('stalkerResult');
    if (!ttForm || !waForm) return;

    document.querySelectorAll('[data-stalk-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.stalkMode;
        document.querySelectorAll('[data-stalk-mode]').forEach((b) =>
          b.classList.toggle('active', b.dataset.stalkMode === mode)
        );
        ttForm.classList.toggle('hidden', mode !== 'tiktok');
        waForm.classList.toggle('hidden', mode !== 'wa');
        resultBox.classList.add('hidden');
      });
    });

    document.getElementById('btnTryD4TechTikTok')?.addEventListener('click', () => {
      ttInput.value = 'df4tch_';
      ttForm.requestSubmit();
    });

    ttForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { api, esc, toast } = getHelpers();
      const username = ttInput.value.trim();
      if (!username) return;

      const btn = document.getElementById('btnRunStalkTikTok');
      const prev = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Memuat Profil...';
      resultBox.classList.remove('hidden');
      resultBox.innerHTML = `<div class="result-card-clean" style="text-align:center; color:var(--text-muted);"><span class="spinner" style="vertical-align:middle;margin-right:6px;"></span> Mengambil data profil TikTok...</div>`;

      try {
        const data = await api('/api/tools/stalk-tiktok', {
          method: 'POST',
          body: JSON.stringify({ username })
        });
        const r = data.result;
        resultBox.innerHTML = `
          <div class="result-card-clean">
            <div class="stalk-header">
              ${
                r.avatar
                  ? `<img src="${esc(r.avatar)}" alt="${esc(r.username)}" class="stalk-avatar" />`
                  : `<div class="stalk-avatar" style="display:grid;place-items:center;font-size:0.85rem;font-weight:700;color:var(--text-muted);">TT</div>`
              }
              <div style="flex:1; min-width:180px;">
                <div style="font-size:1.05rem; font-weight:700;">
                  ${esc(r.nickname)} ${r.verified ? '<span class="free-badge" style="margin-left:4px;">Verified</span>' : ''}
                </div>
                <div style="font-size:0.82rem; color:var(--brand-text); font-weight:600;">
                  @${esc(r.username)} ${r.region ? `&bull; ${esc(r.region)}` : ''}
                </div>
                <div style="font-size:0.81rem; color:var(--text-muted); margin-top:0.25rem;">
                  ${esc(r.bio || 'Tidak ada bio pada profil ini.')}
                </div>
              </div>
            </div>

            <div class="stalk-stats">
              <div class="stalk-stat-box">
                <div class="stalk-stat-val">${fmtCompact(r.stats?.followers)}</div>
                <div class="stalk-stat-lbl">Pengikut</div>
              </div>
              <div class="stalk-stat-box">
                <div class="stalk-stat-val">${fmtCompact(r.stats?.following)}</div>
                <div class="stalk-stat-lbl">Mengikuti</div>
              </div>
              <div class="stalk-stat-box">
                <div class="stalk-stat-val">${fmtCompact(r.stats?.likes)}</div>
                <div class="stalk-stat-lbl">Total Suka</div>
              </div>
              <div class="stalk-stat-box">
                <div class="stalk-stat-val">${fmtCompact(r.stats?.videos)}</div>
                <div class="stalk-stat-lbl">Video</div>
              </div>
            </div>

            <div class="dl-actions-wrap">
              ${
                r.avatar
                  ? `<a href="${esc(makeProxyDownloadUrl(r.avatar, `${r.username}-avatar-hd.jpg`))}" class="btn btn-primary btn-sm">
                      Unduh Avatar HD
                    </a>`
                  : ''
              }
              <a href="${esc(r.profileUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
                Buka Profil TikTok &nearr;
              </a>
            </div>
          </div>
        `;
        toast(`Profil @${r.username} dimuat.`);
      } catch (err) {
        resultBox.innerHTML = `<div class="result-card-clean" style="color:var(--danger); font-weight:600;">${esc(err.message)}</div>`;
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = prev;
      }
    });

    waForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { api, esc, toast } = getHelpers();
      const url = waInput.value.trim();
      if (!url) return;

      const btn = document.getElementById('btnRunStalkWa');
      const prev = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Memeriksa Saluran...';
      resultBox.classList.remove('hidden');
      resultBox.innerHTML = `<div class="result-card-clean" style="text-align:center; color:var(--text-muted);"><span class="spinner" style="vertical-align:middle;margin-right:6px;"></span> Memuat metadata Saluran WhatsApp...</div>`;

      try {
        const data = await api('/api/tools/stalk-wa', {
          method: 'POST',
          body: JSON.stringify({ url })
        });
        const r = data.result;
        resultBox.innerHTML = `
          <div class="result-card-clean">
            <div class="stalk-header">
              ${
                r.avatar
                  ? `<img src="${esc(r.avatar)}" alt="${esc(r.name)}" class="stalk-avatar" />`
                  : `<div class="stalk-avatar" style="display:grid;place-items:center;font-size:0.85rem;font-weight:700;color:var(--text-muted);">WA</div>`
              }
              <div style="flex:1; min-width:180px;">
                <span class="free-badge">Saluran WhatsApp</span>
                <div style="font-size:1.06rem; font-weight:700; margin-top:0.25rem;">
                  ${esc(r.name)}
                </div>
                <div style="font-size:0.82rem; color:var(--brand-text); font-weight:600; margin-top:0.15rem;">
                  ${esc(r.followersText || 'Saluran Publik')}
                </div>
              </div>
            </div>

            <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.75rem 0.9rem; font-size:0.83rem; color:var(--text-main); line-height:1.5;">
              ${esc(r.description || 'Tidak ada deskripsi tambahan pada saluran ini.')}
            </div>

            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.6rem;">
              Kode Saluran: <code>${esc(r.inviteCode || r.channelCode || '-')}</code>
            </div>

            <div class="dl-actions-wrap">
              ${
                r.avatar
                  ? `<a href="${esc(makeProxyDownloadUrl(r.avatar, `wa-channel-${(r.inviteCode || r.channelCode || 'd4tech').slice(0, 8)}.jpg`))}" class="btn btn-primary btn-sm">
                      Unduh Avatar Saluran
                    </a>`
                  : ''
              }
              <a href="${esc(r.channelUrl || r.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
                Buka Saluran WA &nearr;
              </a>
            </div>
          </div>
        `;
        toast('Informasi Saluran WhatsApp ditemukan.');
      } catch (err) {
        resultBox.innerHTML = `<div class="result-card-clean" style="color:var(--danger); font-weight:600;">${esc(err.message)}</div>`;
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = prev;
      }
    });
  }

  // =========================================================================
  // TOOL 4: GENERATOR STIKER KOMENTAR TIKTOK, QUOTED WA & FAKE CHAT
  // =========================================================================
  function initContentGenerator() {
    const canvas = document.getElementById('generatorCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let currentMode = 'tiktok_reply';
    let customAvatarImg = null;
    let fakeMessages = [
      { side: 'left', text: 'Halo min! Semua fitur di D4Tech Hub beneran gratis?', time: '21:12' },
      { side: 'right', text: 'Iya dong! Dari Reaction WA, Downloader HD, Stalker sampai AI Hapus BG semuanya gratis 🔥', time: '21:13' },
      { side: 'left', text: 'Mantap banget, langsung aku follow TikTok @df4tch_ sekarang! 🚀', time: '21:14' }
    ];

    function roundRectPath(c, x, y, w, h, r) {
      const rad = Math.min(r, w / 2, h / 2);
      c.beginPath();
      c.moveTo(x + rad, y);
      c.arcTo(x + w, y, x + w, y + h, rad);
      c.arcTo(x + w, y + h, x, y + h, rad);
      c.arcTo(x, y + h, x, y, rad);
      c.arcTo(x, y, x + w, y, rad);
      c.closePath();
    }

    function wrapCanvasLines(c, text, maxWidth) {
      const paragraphs = String(text || '').split('\n');
      const lines = [];
      for (const para of paragraphs) {
        const words = para.split(/\s+/).filter(Boolean);
        if (!words.length) {
          lines.push('');
          continue;
        }
        let line = words[0];
        for (let i = 1; i < words.length; i++) {
          const test = `${line} ${words[i]}`;
          if (c.measureText(test).width > maxWidth) {
            lines.push(line);
            line = words[i];
          } else {
            line = test;
          }
        }
        lines.push(line);
      }
      return lines;
    }

    function drawAvatarCircle(c, cx, cy, radius, fallbackLetter) {
      c.save();
      c.beginPath();
      c.arc(cx, cy, radius, 0, Math.PI * 2);
      c.closePath();
      c.clip();

      if (customAvatarImg) {
        c.drawImage(customAvatarImg, cx - radius, cy - radius, radius * 2, radius * 2);
      } else {
        const grad = c.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
        grad.addColorStop(0, '#10b981');
        grad.addColorStop(1, '#0284c7');
        c.fillStyle = grad;
        c.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
        c.fillStyle = '#ffffff';
        c.font = `800 ${Math.round(radius * 0.95)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText((fallbackLetter || 'D').toUpperCase(), cx, cy + 2);
      }
      c.restore();
    }

    function renderTikTokReply() {
      const username = document.getElementById('genUsername')?.value.trim() || 'df4tch_';
      const subLabel =
        document.getElementById('genTimeOrSub')?.value.trim() || `Balas komentar ${username}`;
      const message =
        document.getElementById('genMessage')?.value ||
        'Bang tutor cara pakai tools gratis di D4Tech Hub dong!';

      ctx.font = '700 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const msgLines = wrapCanvasLines(ctx, message, 620);
      const lineH = 42;
      const boxW = 820;
      const boxH = Math.max(176, 108 + msgLines.length * lineH);

      canvas.width = 900;
      canvas.height = boxH + 90;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bx = 40;
      const by = 32;

      // Soft shadow for transparent overlay
      ctx.save();
      ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = '#ffffff';
      roundRectPath(ctx, bx, by, boxW, boxH, 32);
      ctx.fill();

      // Iconic TikTok bottom-left sticker tail
      ctx.beginPath();
      ctx.moveTo(bx + 46, by + boxH - 2);
      ctx.lineTo(bx + 46, by + boxH + 26);
      ctx.quadraticCurveTo(bx + 46, by + boxH + 32, bx + 54, by + boxH + 26);
      ctx.lineTo(bx + 84, by + boxH - 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Red TikTok accent pill on top-right
      ctx.fillStyle = '#fe2c55';
      roundRectPath(ctx, bx + boxW - 64, by + 22, 40, 26, 13);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♥', bx + boxW - 44, by + 40);

      // Avatar
      drawAvatarCircle(ctx, bx + 64, by + 68, 36, username[0]);

      // Sub-header ("Balas komentar ...")
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#6b7280';
      ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(subLabel, bx + 120, by + 54);

      // Main bold comment text
      ctx.fillStyle = '#111827';
      ctx.font = '800 31px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      msgLines.forEach((ln, i) => {
        ctx.fillText(ln, bx + 120, by + 98 + i * lineH);
      });
    }

    function renderWaQuote() {
      const username = document.getElementById('genUsername')?.value.trim() || 'D4Tech User';
      const timeStr = document.getElementById('genTimeOrSub')?.value.trim() || '21:08';
      const message = document.getElementById('genMessage')?.value || 'Mantap banget tools gratisnya!';
      const theme = document.getElementById('genBubbleTheme')?.value || 'dark';
      const isDark = theme === 'dark';

      ctx.font = '500 30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const msgLines = wrapCanvasLines(ctx, message, 580);
      const lineH = 40;
      const bubbleW = 680;
      const bubbleH = Math.max(150, 102 + msgLines.length * lineH);

      canvas.width = 900;
      canvas.height = bubbleH + 80;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Avatar on left
      drawAvatarCircle(ctx, 84, 84, 44, username[0]);

      const bx = 152;
      const by = 34;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = isDark ? '#1f2c34' : '#ffffff';
      roundRectPath(ctx, bx, by, bubbleW, bubbleH, 28);
      ctx.fill();

      // Left speech tail
      ctx.beginPath();
      ctx.moveTo(bx + 2, by + 26);
      ctx.lineTo(bx - 18, by + 34);
      ctx.lineTo(bx + 2, by + 50);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Sender name
      ctx.textAlign = 'left';
      ctx.fillStyle = '#10b981';
      ctx.font = '800 25px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(username, bx + 30, by + 44);

      // Message text
      ctx.fillStyle = isDark ? '#f3f4f6' : '#111827';
      ctx.font = '500 30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      msgLines.forEach((ln, i) => {
        ctx.fillText(ln, bx + 30, by + 88 + i * lineH);
      });

      // Timestamp bottom-right
      ctx.textAlign = 'right';
      ctx.fillStyle = isDark ? '#9ca3af' : '#6b7280';
      ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(timeStr, bx + bubbleW - 26, by + bubbleH - 18);
    }

    function renderFakeChat() {
      const contact = document.getElementById('fcContactName')?.value || 'D4Tech Admin ✅';
      const status = document.getElementById('fcStatusText')?.value || 'online';
      const clock = document.getElementById('fcClockTime')?.value || '21:15';

      const W = 760;
      ctx.font = '400 25px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const prepared = fakeMessages.map((m) => {
        const lines = wrapCanvasLines(ctx, m.text, 450);
        const h = Math.max(76, 46 + lines.length * 34);
        return { ...m, lines, h };
      });

      const contentH = prepared.reduce((acc, m) => acc + m.h + 18, 0);
      const H = Math.max(620, 215 + contentH + 70);

      canvas.width = W;
      canvas.height = H;

      // WhatsApp warm wallpaper background
      ctx.fillStyle = '#efeae2';
      ctx.fillRect(0, 0, W, H);

      // Subtle pattern dots
      ctx.fillStyle = 'rgba(17, 24, 39, 0.025)';
      for (let y = 170; y < H; y += 36) {
        for (let x = 20; x < W; x += 36) {
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Top iOS Status Bar + Header
      ctx.fillStyle = '#f7f8fa';
      ctx.fillRect(0, 0, W, 158);
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(0, 157, W, 1.5);

      // Clock & iOS Status Icons
      ctx.fillStyle = '#111827';
      ctx.font = '700 23px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(clock, 38, 42);

      // Signal + Battery on right
      ctx.textAlign = 'right';
      ctx.font = '700 20px sans-serif';
      ctx.fillText('5G  100% 🔋', W - 34, 42);

      // Back arrow + Avatar + Contact Info
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0284c7';
      ctx.font = '700 34px sans-serif';
      ctx.fillText('‹', 28, 120);

      drawAvatarCircle(ctx, 88, 110, 28, contact[0]);

      ctx.fillStyle = '#111827';
      ctx.font = '700 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(contact, 132, 105);

      ctx.fillStyle = '#10b981';
      ctx.font = '600 19px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(status, 132, 131);

      // Draw chat bubbles
      let curY = 190;
      prepared.forEach((m) => {
        let maxLineW = 120;
        ctx.font = '400 25px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        m.lines.forEach((ln) => {
          maxLineW = Math.max(maxLineW, ctx.measureText(ln).width);
        });
        const bw = Math.min(540, Math.max(175, maxLineW + 95));
        const bx = m.side === 'right' ? W - bw - 32 : 32;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.06)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = m.side === 'right' ? '#d9fdd3' : '#ffffff';
        roundRectPath(ctx, bx, curY, bw, m.h, 20);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#111827';
        ctx.textAlign = 'left';
        ctx.font = '400 25px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        m.lines.forEach((ln, idx) => {
          ctx.fillText(ln, bx + 20, curY + 38 + idx * 34);
        });

        ctx.textAlign = 'right';
        ctx.fillStyle = '#6b7280';
        ctx.font = '500 17px sans-serif';
        const suffix = m.side === 'right' ? `${m.time || '21:14'} ✓✓` : m.time || '21:14';
        ctx.fillText(suffix, bx + bw - 16, curY + m.h - 12);

        curY += m.h + 18;
      });
    }

    function redraw() {
      if (currentMode === 'tiktok_reply') renderTikTokReply();
      else if (currentMode === 'wa_quote') renderWaQuote();
      else renderFakeChat();
    }

    function renderFakeChatBuilder() {
      const box = document.getElementById('fcMessagesContainer');
      if (!box) return;
      const { esc } = getHelpers();
      box.innerHTML = fakeMessages
        .map(
          (m, idx) => `
          <div class="chat-builder-row">
            <select class="input input-sm" data-fc-side="${idx}">
              <option value="left" ${m.side === 'left' ? 'selected' : ''}>⬅️ Teman</option>
              <option value="right" ${m.side === 'right' ? 'selected' : ''}>➡️ Saya</option>
            </select>
            <input type="text" class="input input-sm" data-fc-text="${idx}" value="${esc(m.text)}" />
            <button type="button" class="btn btn-secondary btn-sm" data-fc-del="${idx}" title="Hapus">✕</button>
          </div>
        `
        )
        .join('');

      box.querySelectorAll('[data-fc-side]').forEach((sel) => {
        sel.addEventListener('change', (e) => {
          fakeMessages[Number(sel.dataset.fcSide)].side = e.target.value;
          redraw();
        });
      });

      box.querySelectorAll('[data-fc-text]').forEach((inp) => {
        inp.addEventListener('input', (e) => {
          fakeMessages[Number(inp.dataset.fcText)].text = e.target.value;
          redraw();
        });
      });

      box.querySelectorAll('[data-fc-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (fakeMessages.length <= 1) return;
          fakeMessages.splice(Number(btn.dataset.fcDel), 1);
          renderFakeChatBuilder();
          redraw();
        });
      });
    }

    // Mode Switcher
    document.querySelectorAll('[data-gen-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentMode = btn.dataset.genMode;
        document.querySelectorAll('[data-gen-mode]').forEach((b) =>
          b.classList.toggle('active', b.dataset.genMode === currentMode)
        );

        const isFake = currentMode === 'fake_chat';
        document.getElementById('genSingleControls')?.classList.toggle('hidden', isFake);
        document.getElementById('genFakeChatControls')?.classList.toggle('hidden', !isFake);
        document
          .getElementById('waQuoteThemeWrap')
          ?.classList.toggle('hidden', currentMode !== 'wa_quote');

        const timeInp = document.getElementById('genTimeOrSub');
        if (timeInp) {
          if (currentMode === 'tiktok_reply' && /^\d{1,2}:\d{2}$/.test(timeInp.value.trim())) {
            timeInp.value = `Balas komentar ${document.getElementById('genUsername')?.value || 'df4tch_'}`;
          } else if (currentMode === 'wa_quote' && timeInp.value.startsWith('Balas')) {
            timeInp.value = '21:08';
          }
        }
        redraw();
      });
    });

    ['genUsername', 'genTimeOrSub', 'genMessage', 'genBubbleTheme', 'fcContactName', 'fcStatusText', 'fcClockTime'].forEach(
      (id) => {
        document.getElementById(id)?.addEventListener('input', redraw);
        document.getElementById(id)?.addEventListener('change', redraw);
      }
    );

    document.getElementById('genAvatarInput')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          customAvatarImg = img;
          redraw();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('btnAddChatBubble')?.addEventListener('click', () => {
      const nextSide = fakeMessages[fakeMessages.length - 1]?.side === 'left' ? 'right' : 'left';
      fakeMessages.push({ side: nextSide, text: 'Ketik pesan baru...', time: '21:15' });
      renderFakeChatBuilder();
      redraw();
    });

    document.getElementById('btnDownloadCanvas')?.addEventListener('click', () => {
      const { toast } = getHelpers();
      const link = document.createElement('a');
      link.download = `d4tech-${currentMode}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast('Gambar PNG HD berhasil diunduh!');
    });

    renderFakeChatBuilder();
    redraw();
  }

  // =========================================================================
  // TOOL 5: HAPUS BACKGROUND FOTO AI & PASFOTO
  // =========================================================================
  function initRemoveBg() {
    const fileInput = document.getElementById('bgFileInput');
    const dropzone = document.getElementById('bgDropzone');
    const dropTitle = document.getElementById('bgDropTitle');
    const actionRow = document.getElementById('bgActionRow');
    const processBtn = document.getElementById('btnProcessRemoveBg');
    const changeBtn = document.getElementById('btnChooseOtherPhoto');
    const editorStage = document.getElementById('bgEditorStage');
    const resultCanvas = document.getElementById('bgResultCanvas');
    if (!dropzone || !fileInput || !resultCanvas) return;

    const rCtx = resultCanvas.getContext('2d');
    let compressedDataUrl = null;
    let cutoutImage = null;
    let selectedBgColor = 'transparent';

    function compressPhoto(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error('Format gambar tidak didukung.'));
          img.onload = () => {
            const MAX_SIDE = 1280;
            let w = img.width;
            let h = img.height;
            if (w > MAX_SIDE || h > MAX_SIDE) {
              const ratio = Math.min(MAX_SIDE / w, MAX_SIDE / h);
              w = Math.round(w * ratio);
              h = Math.round(h * ratio);
            }
            const tmp = document.createElement('canvas');
            tmp.width = w;
            tmp.height = h;
            const tCtx = tmp.getContext('2d');
            tCtx.drawImage(img, 0, 0, w, h);
            resolve({ dataUrl: tmp.toDataURL('image/jpeg', 0.9), width: w, height: h });
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    function renderCutoutWithBg() {
      if (!cutoutImage) return;
      resultCanvas.width = cutoutImage.width;
      resultCanvas.height = cutoutImage.height;
      rCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);

      if (selectedBgColor && selectedBgColor !== 'transparent') {
        rCtx.fillStyle = selectedBgColor;
        rCtx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);
      }
      rCtx.drawImage(cutoutImage, 0, 0);
    }

    async function handleSelectedFile(file) {
      if (!file) return;
      const { toast } = getHelpers();
      try {
        const res = await compressPhoto(file);
        compressedDataUrl = res.dataUrl;
        dropTitle.textContent = `Berkas dipilih: ${file.name} (${res.width}\u00d7${res.height}px)`;
        actionRow.classList.remove('hidden');
        toast('Foto siap diproses.');
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    dropzone.addEventListener('click', () => fileInput.click());
    changeBtn?.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--brand)';
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = '';
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '';
      const file = e.dataTransfer?.files?.[0];
      if (file) handleSelectedFile(file);
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleSelectedFile(file);
    });

    processBtn?.addEventListener('click', async () => {
      const { api, toast } = getHelpers();
      if (!compressedDataUrl) {
        toast('Pilih foto terlebih dahulu.', 'error');
        return;
      }

      const prev = processBtn.innerHTML;
      processBtn.disabled = true;
      processBtn.innerHTML = '<span class="spinner"></span> Memisahkan Latar Belakang (5–12 dtk)...';

      try {
        const res = await api('/api/tools/removebg', {
          method: 'POST',
          body: JSON.stringify({ imageBase64: compressedDataUrl })
        });

        const img = new Image();
        img.onload = () => {
          cutoutImage = img;
          editorStage.classList.remove('hidden');
          renderCutoutWithBg();
          toast('Background berhasil dihapus! Silakan pilih warna latar atau unduh PNG.');
        };
        img.src = res.resultDataUrl;
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        processBtn.disabled = false;
        processBtn.innerHTML = prev;
      }
    });

    document.querySelectorAll('[data-bg-color]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedBgColor = btn.dataset.bgColor;
        document.querySelectorAll('[data-bg-color]').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        renderCutoutWithBg();
      });
    });

    document.getElementById('bgCustomColorPicker')?.addEventListener('input', (e) => {
      selectedBgColor = e.target.value;
      document.querySelectorAll('[data-bg-color]').forEach((b) => b.classList.remove('active'));
      renderCutoutWithBg();
    });

    document.getElementById('btnDownloadBgResult')?.addEventListener('click', () => {
      const { toast } = getHelpers();
      if (!cutoutImage) return;
      const link = document.createElement('a');
      link.download = `d4tech-foto-${selectedBgColor === 'transparent' ? 'transparan' : 'pasfoto'}.png`;
      link.href = resultCanvas.toDataURL('image/png');
      link.click();
      toast('Foto HD berhasil diunduh!');
    });

    window.D4TechTools = Object.assign(window.D4TechTools || {}, {
      openRemoveBgWithDataUrl: (dataUrl, label = 'Hasil Restorasi HD') => {
        const { toast, switchView } = getHelpers();
        if (!dataUrl) return;
        compressedDataUrl = dataUrl;
        dropTitle.textContent = `Berkas dimuat dari ${label}`;
        actionRow.classList.remove('hidden');
        if (typeof switchView === 'function') switchView('removebg');
        toast('Foto HD dimuat. Memproses pemisahan latar belakang...');
        setTimeout(() => processBtn?.click(), 180);
      }
    });
  }

  // =========================================================================
  // YOUTUBE TO MP3 MULTI-QUALITY (64, 96, 128, 192, 256, 320 KBPS) + SEARCH
  // =========================================================================
  function initYouTubeMp3() {
    const form = document.getElementById('ytMp3Form');
    const input = document.getElementById('ytInput');
    const pasteBtn = document.getElementById('btnPasteYt');
    const searchBtn = document.getElementById('btnSearchYtOnly');
    const submitBtn = document.getElementById('btnRunYtMp3');
    const badge = document.getElementById('ytSelectedQualityBadge');
    const searchBox = document.getElementById('ytSearchResults');
    const resultBox = document.getElementById('ytMp3Result');
    if (!form || !input) return;

    let selectedKbps = '192';

    const looksLikeYtUrl = (val) =>
      /(?:youtube\.com\/|youtu\.be\/)/i.test(val) || /^[A-Za-z0-9_-]{11}$/.test(val.trim());

    document.querySelectorAll('[data-yt-kbps]').forEach((card) => {
      card.addEventListener('click', () => {
        selectedKbps = card.dataset.ytKbps;
        document.querySelectorAll('[data-yt-kbps]').forEach((c) =>
          c.classList.toggle('active', c === card)
        );
        if (badge) badge.textContent = `${selectedKbps} kbps dipilih`;
      });
    });

    pasteBtn?.addEventListener('click', async () => {
      const { toast } = getHelpers();
      try {
        const txt = await navigator.clipboard.readText();
        if (txt) {
          input.value = txt.trim();
          toast('Link YouTube berhasil ditempel.');
        } else {
          toast('Clipboard kosong, silakan tempel manual.', 'error');
        }
      } catch {
        input.focus();
        toast('Tekan lama pada kolom lalu pilih Tempel.', 'error');
      }
    });

    async function runSearch(queryText) {
      const { api, esc, toast } = getHelpers();
      const q = String(queryText || '').trim();
      if (!q) {
        toast('Ketik judul lagu atau nama penyanyi terlebih dahulu.', 'error');
        return;
      }

      searchBox.classList.remove('hidden');
      searchBox.innerHTML = `<div class="preview-box" style="margin-top:0.65rem; color:var(--text-muted);">🔍 Mencari lagu "${esc(q)}" di YouTube...</div>`;

      try {
        const data = await api('/api/tools/yt-search', {
          method: 'POST',
          body: JSON.stringify({ query: q })
        });

        searchBox.innerHTML = `
          <div style="margin-top:0.75rem; font-size:0.8rem; font-weight:700; color:var(--text-muted);">
            Pilih video dari hasil pencarian (akan dikonversi ke <strong>${esc(selectedKbps)} kbps</strong>):
          </div>
          <div class="yt-search-list">
            ${data.items
              .map(
                (it) => `
              <div class="yt-search-item">
                <img src="${esc(it.thumbnail)}" alt="" class="yt-thumb-wide" loading="lazy" />
                <div style="min-width:0;">
                  <div style="font-size:0.86rem; font-weight:800; line-height:1.35; color:var(--text-main);">
                    ${esc(it.title)}
                  </div>
                  <div style="font-size:0.74rem; color:var(--text-muted); margin-top:0.18rem;">
                    ${esc(it.channel)} &bull; ${esc(it.duration)} ${it.views ? `&bull; ${esc(it.views)}` : ''}
                  </div>
                </div>
                <button type="button" class="btn btn-primary btn-sm" data-pick-yt="${esc(it.url)}">
                  Pilih MP3
                </button>
              </div>
            `
              )
              .join('')}
          </div>
        `;

        searchBox.querySelectorAll('[data-pick-yt]').forEach((btn) => {
          btn.addEventListener('click', () => {
            input.value = btn.dataset.pickYt;
            searchBox.classList.add('hidden');
            runConvert(btn.dataset.pickYt);
          });
        });
      } catch (err) {
        searchBox.innerHTML = `<div class="preview-box" style="margin-top:0.65rem; color:var(--danger); font-weight:600;">${esc(err.message)}</div>`;
        toast(err.message, 'error');
      }
    }

    async function runConvert(targetUrl) {
      const { api, esc, toast } = getHelpers();
      const prevLabel = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Mengonversi MP3 (${selectedKbps} kbps)...`;
      resultBox.classList.remove('hidden');
      resultBox.innerHTML = `<div class="result-card-clean" style="text-align:center; color:var(--text-muted);"><span class="spinner" style="vertical-align:middle;margin-right:6px;"></span> Mengekstrak dan mengodekan audio MP3 <strong>${esc(selectedKbps)} kbps</strong>...</div>`;

      try {
        const data = await api('/api/tools/ytmp3', {
          method: 'POST',
          body: JSON.stringify({ url: targetUrl, quality: selectedKbps })
        });
        const r = data.result;
        const cleanFileTitle = String(r.title || 'youtube-audio')
          .replace(/[^a-zA-Z0-9 _-]/g, '')
          .trim()
          .replace(/\s+/g, '_')
          .slice(0, 65) || 'D4Tech_Audio';
        const mp3Filename = `${cleanFileTitle}_${r.qualityValue}kbps_D4TechHub.mp3`;
        const dlHref = makeProxyDownloadUrl(r.downloadUrl, mp3Filename);
        const inlineStreamHref = `${makeProxyDownloadUrl(r.previewUrl || r.downloadUrl, mp3Filename)}&inline=1`;

        resultBox.innerHTML = `
          <div class="result-card-clean">
            <div class="media-preview-row" style="grid-template-columns: 165px 1fr;">
              <img src="${esc(r.thumbnail)}" alt="${esc(r.title)}" class="yt-thumb-wide" />
              <div>
                <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap; margin-bottom:0.35rem;">
                  <span class="free-badge">MP3 &bull; ${esc(r.quality)}</span>
                  ${r.fileSizeText ? `<span class="selected-pill">${esc(r.fileSizeText)}</span>` : ''}
                </div>
                <div style="font-weight:700; font-size:0.96rem; line-height:1.38; color:var(--text-main);">
                  ${esc(r.title)}
                </div>
                <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.2rem;">
                  ${esc(r.channel)}
                </div>

                <div class="dl-actions-wrap">
                  <a href="${esc(dlHref)}" class="btn btn-primary btn-sm">
                    Unduh MP3 (${esc(r.quality)})
                  </a>
                  <button type="button" class="btn btn-secondary btn-sm" id="btnChainYtToAudioStudio">
                    Buka di Studio Audio 8D &rarr;
                  </button>
                  <a href="${esc(r.youtubeUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
                    Buka di YouTube &nearr;
                  </a>
                </div>
              </div>
            </div>

            <div class="audio-player-box">
              <div style="font-size:0.74rem; font-weight:600; color:var(--text-muted); margin-bottom:0.35rem;">
                Pratinjau Audio (${esc(r.quality)}):
              </div>
              <audio controls preload="none" src="${esc(inlineStreamHref)}"></audio>
            </div>
          </div>
        `;
        document.getElementById('btnChainYtToAudioStudio')?.addEventListener('click', () => {
          if (window.D4TechExtra?.loadUrlIntoAudioStudio) {
            window.D4TechExtra.loadUrlIntoAudioStudio(inlineStreamHref, `${r.title} (${r.quality})`);
          } else {
            toast('Studio Audio 8D belum siap.', 'error');
          }
        });
        toast(`MP3 ${r.quality} siap diunduh.`);
      } catch (err) {
        resultBox.innerHTML = `<div class="result-card-clean" style="color:var(--danger); font-weight:600;">${esc(err.message)}</div>`;
        toast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = prevLabel;
      }
    }

    searchBtn?.addEventListener('click', () => {
      runSearch(input.value);
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return;
      if (looksLikeYtUrl(val)) {
        searchBox.classList.add('hidden');
        runConvert(val);
      } else {
        runSearch(val);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initYouTubeMp3();
    initDownloader();
    initStalker();
    initContentGenerator();
    initRemoveBg();
  });
})();
