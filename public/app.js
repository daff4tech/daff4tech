(() => {
  'use strict';

  const DEFAULT_EMOJIS = ['🔥', '❤️', '👍', '😂', '🎉', '😮', '💯', '🚀', '🙏', '😍', '👏', '😢'];

  const PRESETS = {
    viral: ['🔥', '❤️', '🚀', '💯', '⚡'],
    positif: ['❤️', '👍', '🙏', '😍', '👏'],
    hype: ['🎉', '🔥', '😂', '😮', '💯']
  };

  const state = {
    view: 'home',
    selectedEmojis: ['🔥', '❤️', '👍', '🎉', '🚀'],
    customEmojis: [],
    activeProviderId: 'prov_free_pool',
    providers: [],
    campaigns: [],
    logs: [],
    previewChannelName: ''
  };

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toast(msg, type = 'success') {
    const stack = document.getElementById('toastContainer');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = `toast ${type === 'error' ? 'error' : 'success'}`;
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.22s ease';
      setTimeout(() => el.remove(), 240);
    }, 3400);
  }

  async function api(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const rawText = await res.text();
    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      const plain = String(rawText || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      let friendly;
      if (res.status === 413 || /FUNCTION_PAYLOAD_TOO_LARGE|Request Entity Too Large/i.test(plain)) {
        friendly =
          'Berkas yang dikirim melebihi batas server (4,5 MB). Potong klip audio/video menjadi 10–15 detik lalu coba lagi.';
      } else if (res.status === 504 || /FUNCTION_INVOCATION_TIMEOUT|Task timed out/i.test(plain)) {
        friendly = 'Waktu tunggu server habis (504). Coba lagi dengan berkas/tautan yang lebih ringan.';
      } else {
        friendly = `Respons server tidak berformat JSON (HTTP ${res.status})${
          plain ? `: ${plain.slice(0, 160)}` : ''
        }`;
      }
      data = { ok: false, error: friendly };
    }
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `Gagal (${res.status})`);
    }
    return data;
  }

  // =========================================================================
  // NAVIGASI HOME LANDING PAGE + 21 TOOLS + DEEP-LINK URL (?tool=...)
  // =========================================================================
  const TOOL_ALIASES = {
    '8d': 'audiostudio',
    audio: 'audiostudio',
    wa: 'send',
    reaction: 'send',
    mp3: 'ytmp3',
    dracin: 'tts',
    pdf: 'imgtopdf',
    wr: 'mlbbwr'
  };

  function resolveToolSlug(slug) {
    const raw = String(slug || '').trim().toLowerCase();
    if (!raw) return 'home';
    const mapped = TOOL_ALIASES[raw] || raw;
    if (document.getElementById(`view-${mapped}`)) return mapped;
    return 'home';
  }

  function closeMobileSidebar() {
    document.getElementById('workspaceSidebar')?.classList.remove('mobile-open');
    document.getElementById('sidebarBackdrop')?.classList.remove('active');
  }

  function openMobileSidebar() {
    document.getElementById('workspaceSidebar')?.classList.add('mobile-open');
    document.getElementById('sidebarBackdrop')?.classList.add('active');
    setTimeout(() => {
      document.getElementById('sidebarFilterInput')?.focus();
    }, 60);
  }

  function switchView(viewName, opts = {}) {
    const resolved = resolveToolSlug(viewName);
    state.view = resolved;
    const isHome = resolved === 'home';

    closeMobileSidebar();

    document.getElementById('appShell')?.classList.toggle('in-workspace', !isHome);
    document.getElementById('workspaceSidebar')?.classList.toggle('hidden', isHome);
    document.getElementById('mainContainer')?.classList.toggle('is-home', isHome);
    document.getElementById('workspaceTopbar')?.classList.toggle('hidden', isHome);
    document.getElementById('btnNavHome')?.classList.toggle('active', isHome);

    document.querySelectorAll('.view').forEach((sec) => {
      sec.classList.toggle('active', sec.id === `view-${resolved}`);
    });

    const isWaGroup = ['send', 'history', 'settings'].includes(resolved);
    let activeToolLabel = 'Perangkat';
    document.querySelectorAll('[data-tool-target]').forEach((btn) => {
      const target = btn.dataset.toolTarget;
      const isAct = !isHome && (isWaGroup ? target === 'send' : target === resolved);
      btn.classList.toggle('active', isAct);
      if (isAct) {
        activeToolLabel = btn.textContent.trim();
        btn.scrollIntoView?.({ block: 'nearest' });
      }
    });

    const crumbEl = document.getElementById('activeToolBreadcrumb');
    if (crumbEl) crumbEl.textContent = activeToolLabel;

    document.querySelectorAll('[data-subview]').forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.subview === resolved);
    });

    // Update URL query ?tool=<slug> tanpa reload halaman
    if (opts.updateUrl !== false && typeof window.history?.replaceState === 'function') {
      try {
        const url = new URL(window.location.href);
        if (isHome) {
          url.searchParams.delete('tool');
        } else {
          url.searchParams.set('tool', isWaGroup ? 'send' : resolved);
        }
        window.history.replaceState({}, '', url.toString());
      } catch {
        // Abaikan pada lingkungan non-standar
      }
    }

    window.scrollTo({ top: 0, behavior: 'instant' });

    if (resolved === 'history') renderCampaigns();
    if (resolved === 'settings') renderProviders();
  }

  // =========================================================================
  // TEMA LIGHT / DARK (SVG ICON)
  // =========================================================================
  const SVG_SUN =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';
  const SVG_MOON =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

  function initTheme() {
    const saved = localStorage.getItem('d4tech_theme') || 'light';
    applyTheme(saved);
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        applyTheme(cur === 'dark' ? 'light' : 'dark');
      });
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('d4tech_theme', theme);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.innerHTML = theme === 'dark' ? SVG_SUN : SVG_MOON;
  }

  // =========================================================================
  // POP-UP FOLLOW TIKTOK @df4tch_
  // =========================================================================
  function initTikTokModal() {
    const modal = document.getElementById('tiktokFollowModal');
    if (!modal) return;

    const openModal = () => modal.classList.remove('hidden');
    const closeModal = () => {
      modal.classList.add('hidden');
      sessionStorage.setItem('d4tech_tiktok_prompt_seen', '1');
    };

    document.getElementById('btnOpenTikTokModal')?.addEventListener('click', openModal);
    document.getElementById('btnCloseTikTokModal')?.addEventListener('click', closeModal);
    document.getElementById('btnSkipTikTokModal')?.addEventListener('click', closeModal);
    document.getElementById('btnFollowTikTokNow')?.addEventListener('click', () => {
      sessionStorage.setItem('d4tech_tiktok_prompt_seen', '1');
      setTimeout(() => modal.classList.add('hidden'), 300);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    if (!sessionStorage.getItem('d4tech_tiktok_prompt_seen')) {
      setTimeout(openModal, 450);
    }
  }

  // =========================================================================
  // STEP 1: VALIDASI LINK SALURAN WA
  // =========================================================================
  async function validateLinks(silent = false) {
    const raw = document.getElementById('linksTextarea')?.value.trim() || '';
    const panel = document.getElementById('linkPreviewPanel');
    if (!panel) return;

    if (!raw) {
      panel.classList.add('hidden');
      if (!silent) toast('Masukkan minimal 1 link postingan saluran WA.', 'error');
      return;
    }

    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const mode = lines.length > 1 ? 'bulk' : 'single';

    try {
      panel.classList.remove('hidden');
      panel.innerHTML = `<span style="display:inline-flex; align-items:center; gap:0.45rem; color:var(--text-muted);"><span class="spinner"></span> Memverifikasi tautan saluran...</span>`;
      const res = await api('/api/parse-link', {
        method: 'POST',
        body: JSON.stringify({ mode, input: raw, fetchPreview: true })
      });

      if (mode === 'single') {
        if (!res.valid) {
          panel.innerHTML = `<span style="color:var(--danger); font-weight:600;">${esc(res.error)}</span>`;
          return;
        }
        state.previewChannelName = res.preview?.channelName || '';
        panel.innerHTML = `
          <div style="display:flex; align-items:center; gap:0.65rem;">
            ${
              res.preview?.avatarUrl
                ? `<img src="${esc(res.preview.avatarUrl)}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--border);" />`
                : `<div style="width:36px;height:36px;border-radius:50%;background:var(--brand-soft);color:var(--brand-text);font-weight:700;font-size:0.75rem;display:grid;place-items:center;">WA</div>`
            }
            <div>
              <div style="font-weight:600; color:var(--text-main);">${esc(res.preview?.channelName || 'Saluran WhatsApp Terverifikasi')}</div>
              <div style="font-size:0.76rem; color:var(--text-muted);">ID Postingan: <strong>#${esc(res.parsed.postId)}</strong> &bull; Siap dikirim reaction</div>
            </div>
          </div>
        `;
      } else {
        panel.innerHTML = `
          <div style="font-weight:600; color:var(--brand-text);">
            ${res.validLinks.length} tautan postingan valid siap diproses
            ${res.invalidLinks.length ? `<span style="color:var(--danger);">(${res.invalidLinks.length} baris diabaikan)</span>` : ''}
          </div>
        `;
      }
    } catch (err) {
      panel.innerHTML = `<span style="color:var(--danger);">${esc(err.message)}</span>`;
    }
  }

  // =========================================================================
  // STEP 2: EMOJI PICKER
  // =========================================================================
  function renderEmojiGrid() {
    const grid = document.getElementById('emojiSelectorGrid');
    const counter = document.getElementById('emojiCounterLabel');
    if (!grid) return;

    const allEmojis = Array.from(new Set([...DEFAULT_EMOJIS, ...state.customEmojis]));
    grid.innerHTML = allEmojis
      .map((em) => {
        const active = state.selectedEmojis.includes(em);
        return `
          <button type="button" class="emoji-btn ${active ? 'active' : ''}" data-emoji="${esc(em)}">
            <span class="emoji-char">${esc(em)}</span>
          </button>
        `;
      })
      .join('');

    grid.querySelectorAll('.emoji-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const em = btn.dataset.emoji;
        if (state.selectedEmojis.includes(em)) {
          state.selectedEmojis = state.selectedEmojis.filter((x) => x !== em);
        } else {
          state.selectedEmojis.push(em);
        }
        renderEmojiGrid();
      });
    });

    if (counter) {
      counter.textContent = `${state.selectedEmojis.length} emoji dipilih`;
    }
  }

  // =========================================================================
  // STEP 3: PROVIDERS & KIRIM REACTION
  // =========================================================================
  function getSelectedProvider() {
    const sel = document.getElementById('campaignProvider');
    const id = sel?.value || state.activeProviderId;
    return state.providers.find((p) => p.id === id) || state.providers[0] || null;
  }

  function renderProviderSelect() {
    const sel = document.getElementById('campaignProvider');
    if (!sel) return;
    sel.innerHTML = state.providers
      .map(
        (p) =>
          `<option value="${esc(p.id)}" ${p.id === state.activeProviderId ? 'selected' : ''}>${esc(p.name)}</option>`
      )
      .join('');
    updateProviderModeUI();
  }

  function updateProviderModeUI() {
    const prov = getSelectedProvider();
    const isFree = !prov || prov.type === 'free_pool';
    const textEl = document.getElementById('activeEngineText');
    const paidRow = document.getElementById('paidServiceRow');
    const freeDelayRow = document.getElementById('freeDelayRow');

    if (textEl && prov) {
      textEl.textContent = isFree
        ? 'Menggunakan Server Gratis Otomatis (Rp 0)'
        : `Server Aktif: ${prov.name}`;
    }
    paidRow?.classList.toggle('hidden', isFree);
    freeDelayRow?.classList.toggle('hidden', !isFree);

    if (!isFree && prov) {
      const svcSel = document.getElementById('campaignService');
      if (svcSel) {
        const svcs = prov.services || [];
        svcSel.innerHTML = svcs.length
          ? svcs.map((s) => `<option value="${esc(s.service)}">${esc(s.name)} (${esc(s.rate)})</option>`).join('')
          : `<option value="${esc(prov.defaultServiceId || '1')}">Default Service</option>`;
      }
    }
  }

  async function onSubmitCampaign(e) {
    e.preventDefault();
    const rawLinks = document.getElementById('linksTextarea')?.value.trim() || '';
    if (!rawLinks) {
      toast('Tempel link postingan Saluran WhatsApp terlebih dahulu.', 'error');
      return;
    }
    if (state.selectedEmojis.length === 0) {
      toast('Pilih minimal 1 emoji reaction.', 'error');
      return;
    }

    const lines = rawLinks.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const mode = lines.length > 1 ? 'bulk' : 'single';
    const prov = getSelectedProvider();
    const isFree = !prov || prov.type === 'free_pool';
    const qty = isFree ? 1 : Math.max(1, Number(document.getElementById('qtyPerEmoji')?.value) || 50);
    const delaySec = isFree
      ? Math.max(0, Number(document.getElementById('delayMs')?.value) || 2)
      : Math.max(0, Number(document.getElementById('delaySec')?.value) || 1);

    const btn = document.getElementById('btnLaunchCampaign');
    const prevLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Mengirim Reaction...';

    try {
      const res = await api('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          linkInput: rawLinks,
          providerId: prov?.id || state.activeProviderId,
          channelNameHint: state.previewChannelName,
          reactions: state.selectedEmojis.map((emoji) => ({ emoji, quantity: qty })),
          pacing: { delayMs: delaySec * 1000 }
        })
      });

      const idx = state.campaigns.findIndex((c) => c.id === res.campaign.id);
      if (idx >= 0) state.campaigns[idx] = res.campaign;
      else state.campaigns.unshift(res.campaign);

      if (Array.isArray(res.logs)) {
        state.logs = res.logs;
      }

      renderCampaigns();

      if (res.campaign.status === 'completed') {
        const sub = res.campaign.subOrders?.[0];
        const queuedOnly = sub && sub.deliveryVerified === false;
        if (queuedOnly) {
          toast(
            `Antrean reaction diterima server gratis (${sub.providerStatus}). Belum ada konfirmasi reaction benar-benar menempel — buka postingan untuk memastikan.`,
            'error'
          );
        } else {
          toast(
            `Reaction berhasil terkirim (${sub?.providerStatus || 'Pool Server Aktif'})`
          );
        }
      } else if (res.campaign.status === 'failed') {
        const errTxt =
          res.campaign.subOrders?.find((s) => s.error)?.error ||
          'Gagal mengirim reaction.';
        toast(errTxt, 'error');
      } else {
        toast('Pengiriman reaction berjalan. Pantau statusnya di bawah.');
        startRunningPoll();
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = prevLabel;
    }
  }

  // =========================================================================
  // RENDER RIWAYAT & STATUS PENGIRIMAN
  // =========================================================================
  function renderCampaignCard(c) {
    const subs = c.subOrders || c.tasks || [];
    const total = Number(c.totalTasks ?? c.summary?.totalTasks ?? subs.length) || 1;
    const sent = Number(c.completedTasks ?? c.summary?.sentTasks ?? 0);
    const failed = Number(c.failedTasks ?? c.summary?.failedTasks ?? 0);
    const done = sent + failed;
    const pct = Math.min(100, Math.round((done / Math.max(1, total)) * 100));
    const statusMap = {
      running: { cls: 'badge-running', label: 'Diproses' },
      completed: { cls: 'badge-completed', label: 'Selesai' },
      partial: { cls: 'badge-partial', label: 'Sebagian' },
      failed: { cls: 'badge-failed', label: 'Gagal' },
      cancelled: { cls: 'badge-cancelled', label: 'Dibatalkan' }
    };
    const st = statusMap[c.status] || statusMap.running;
    const firstLink = c.primaryLink || c.links?.[0]?.normalizedUrl || '';
    const emojis = (c.reactionsSummary || c.reactions || []).map((r) => r.emoji).join(' ');
    const lastErr = subs.find((t) => t.error)?.error || '';
    const extraCount = (c.linksCount || c.links?.length || 1) - 1;
    const statusNote = subs[0]?.providerStatus || c.providerName || 'Server Gratis';

    return `
      <div class="campaign-card">
        <div class="camp-top">
          <div>
            <div class="camp-title">${esc(c.channelName || c.links?.[0]?.channelName || 'Postingan Saluran WA')} ${extraCount > 0 ? `(+${extraCount} link)` : ''}</div>
            <div class="camp-meta">${esc(firstLink)} &bull; Emoji: ${esc(emojis)}</div>
          </div>
          <span class="status-badge ${st.cls}">${st.label}</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar" style="width:${pct}%"></div>
        </div>
        <div class="camp-bottom">
          <span>Terkirim: <strong>${sent}/${total}</strong> tugas${c.totalReactionsSubmitted ? ` (~${c.totalReactionsSubmitted} bot)` : ''}</span>
          ${lastErr ? `<span style="color:var(--danger);">${esc(lastErr)}</span>` : `<span>${esc(statusNote)}</span>`}
        </div>
      </div>
    `;
  }

  function renderCampaigns() {
    const recentBox = document.getElementById('recentActivityBox');
    const recentList = document.getElementById('recentCampaignList');
    const fullList = document.getElementById('activeCampaignsList');
    const runningBadge = document.getElementById('runningBadge');

    const runningCount = state.campaigns.filter((c) => c.status === 'running').length;
    if (runningBadge) {
      runningBadge.textContent = String(runningCount);
      runningBadge.classList.toggle('hidden', runningCount === 0);
    }

    if (recentBox && recentList) {
      if (state.campaigns.length > 0) {
        recentBox.classList.remove('hidden');
        recentList.innerHTML = state.campaigns.slice(0, 3).map(renderCampaignCard).join('');
      } else {
        recentBox.classList.add('hidden');
      }
    }

    if (fullList) {
      fullList.innerHTML = state.campaigns.length
        ? state.campaigns.map(renderCampaignCard).join('')
        : `<div class="empty-box">Belum ada riwayat pengiriman reaction.</div>`;
    }

    const totalSent = state.campaigns.reduce(
      (acc, c) => acc + Number(c.totalReactionsSubmitted || c.completedTasks || c.summary?.sentTasks || 0),
      0
    );
    const totalTasksDone = state.campaigns.reduce(
      (acc, c) => acc + Number(c.completedTasks ?? c.summary?.sentTasks ?? 0),
      0
    );
    const totalFailed = state.campaigns.reduce(
      (acc, c) => acc + Number(c.failedTasks ?? c.summary?.failedTasks ?? 0),
      0
    );
    const denom = totalTasksDone + totalFailed;
    const rate = denom > 0 ? Math.round((totalTasksDone / denom) * 100) : 100;

    const elSent = document.getElementById('statReactionsSent');
    const elRun = document.getElementById('statRunning');
    const elRate = document.getElementById('statSuccessRate');
    if (elSent) elSent.textContent = totalSent.toLocaleString('id-ID');
    if (elRun) elRun.textContent = String(runningCount);
    if (elRate) elRate.textContent = `${rate}%`;

    renderLogs();
  }

  function renderLogs() {
    const box = document.getElementById('liveLogContainer');
    if (!box) return;
    box.innerHTML = state.logs.length
      ? state.logs
          .slice(0, 60)
          .map((l) => {
            const ts = l.createdAt || l.time || Date.now();
            return `<div class="log-item"><span class="log-time">[${new Date(ts).toLocaleTimeString('id-ID')}]</span> ${esc(l.message)}</div>`;
          })
          .join('')
      : `<div class="log-item">Belum ada catatan aktivitas.</div>`;
  }

  // =========================================================================
  // RENDER PENGATURAN PROVIDER API
  // =========================================================================
  function renderProviders() {
    const wrap = document.getElementById('providersList');
    if (!wrap) return;
    wrap.innerHTML = state.providers
      .map((p) => {
        const isActive = p.id === state.activeProviderId;
        const typeLabel =
          p.type === 'free_pool'
            ? 'Gratis Tanpa API Key'
            : p.type === 'sandbox'
              ? 'Mode Simulasi'
              : p.type === 'smm_v2'
                ? 'SMM Panel API v2'
                : 'Webhook Kustom';
        return `
          <div class="provider-item ${isActive ? 'active' : ''}">
            <div class="prov-info">
              <h4>${esc(p.name)}</h4>
              <p>${typeLabel}</p>
            </div>
            <div class="prov-actions">
              ${
                !isActive
                  ? `<button type="button" class="btn btn-primary btn-sm" data-act-prov="${esc(p.id)}">Gunakan</button>`
                  : `<span class="free-badge">Aktif</span>`
              }
              <button type="button" class="btn btn-secondary btn-sm" data-test-prov="${esc(p.id)}">Tes Server</button>
            </div>
          </div>
        `;
      })
      .join('');

    wrap.querySelectorAll('[data-act-prov]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const res = await api(`/api/providers/${btn.dataset.actProv}/activate`, { method: 'POST' });
          state.activeProviderId = res.activeProviderId;
          renderProviders();
          renderProviderSelect();
          toast('Sumber server berhasil diganti.');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });

    wrap.querySelectorAll('[data-test-prov]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          const res = await api(`/api/providers/${btn.dataset.testProv}/check-balance`, { method: 'POST' });
          toast(res.result?.note || 'Koneksi server aktif dan siap digunakan!');
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  // =========================================================================
  // REAL-TIME SSE STREAM
  // =========================================================================
  let pollTimer = null;
  function startRunningPoll() {
    if (pollTimer) return;
    pollTimer = setInterval(async () => {
      try {
        const data = await api('/api/state');
        state.campaigns = data.campaigns || [];
        state.logs = data.logs || [];
        renderCampaigns();
        if (!state.campaigns.some((c) => c.status === 'running')) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      } catch {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }, 3000);
  }

  function initSse() {
    try {
      const es = new EventSource('/api/events');
      const onCampEvent = (ev) => {
        const camp = JSON.parse(ev.data);
        const idx = state.campaigns.findIndex((c) => c.id === camp.id);
        if (idx >= 0) state.campaigns[idx] = camp;
        else state.campaigns.unshift(camp);
        renderCampaigns();
      };
      es.addEventListener('campaign_created', onCampEvent);
      es.addEventListener('campaign_updated', onCampEvent);
      es.addEventListener('campaign_update', onCampEvent);
      es.addEventListener('log', (ev) => {
        const entry = JSON.parse(ev.data);
        state.logs.unshift(entry);
        renderLogs();
      });
    } catch {
      // Fallback aman bila SSE terputus
    }
  }

  // =========================================================================
  // PWA INSTALLER + PIN FAVORIT + CTRL+K + DEEP-LINK INITIALIZER
  // =========================================================================
  function initPwaSupport() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    let deferredPrompt = null;
    const installBtn = document.getElementById('btnInstallPwa');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      installBtn?.classList.remove('hidden');
    });

    installBtn?.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice.catch(() => null);
        deferredPrompt = null;
        if (choice?.outcome === 'accepted') {
          toast('D4Tech Hub sedang dipasang ke perangkat Anda.');
        }
      } else {
        const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
        if (isIos) {
          toast('Safari iOS: ketuk ikon Bagikan (Share) lalu pilih "Tambahkan ke Layar Utama".');
        } else {
          toast('Buka menu peramban (⋮) lalu pilih "Instal Aplikasi / Tambahkan ke Layar Utama".');
        }
      }
    });
  }

  const SVG_STAR_OUTLINE =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  const SVG_STAR_SOLID =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

  // =========================================================================
  // INISIALISASI EVENT LISTENERS
  // =========================================================================
  async function init() {
    initTheme();
    initPwaSupport();
    initTikTokModal();
    renderEmojiGrid();

    // Simpan urutan asli kartu direktori + suntikkan tombol Sematkan (SVG Star)
    const bentoGrid = document.getElementById('homeBentoGrid');
    const getFavSet = () => {
      try {
        const arr = JSON.parse(localStorage.getItem('d4tech_fav_tools') || '[]');
        return new Set(Array.isArray(arr) ? arr : []);
      } catch {
        return new Set();
      }
    };
    const saveFavSet = (set) => {
      localStorage.setItem('d4tech_fav_tools', JSON.stringify(Array.from(set)));
    };

    let favSet = getFavSet();

    const syncBentoFavoritesAndOrder = () => {
      if (!bentoGrid) return;
      const cards = Array.from(bentoGrid.querySelectorAll('.bento-card'));
      cards.sort((a, b) => {
        const aFav = favSet.has(a.dataset.openTool) ? 1 : 0;
        const bFav = favSet.has(b.dataset.openTool) ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
        return Number(a.dataset.origIndex || 0) - Number(b.dataset.origIndex || 0);
      });
      cards.forEach((card) => {
        const isFav = favSet.has(card.dataset.openTool);
        card.classList.toggle('is-pinned', isFav);
        const starSpan = card.querySelector('.bento-fav-btn');
        if (starSpan) {
          starSpan.classList.toggle('active', isFav);
          starSpan.innerHTML = isFav ? SVG_STAR_SOLID : SVG_STAR_OUTLINE;
          starSpan.title = isFav ? 'Lepas sematan' : 'Sematkan perangkat';
        }
        bentoGrid.appendChild(card);
      });
      const favPill = document.querySelector('#homeCategoryBar [data-cat="fav"]');
      if (favPill) {
        favPill.textContent = favSet.size > 0 ? `Disematkan (${favSet.size})` : 'Disematkan';
      }
    };

    document.querySelectorAll('#homeBentoGrid .bento-card').forEach((card, idx) => {
      card.dataset.origIndex = String(idx);
      const star = document.createElement('span');
      star.className = 'bento-fav-btn';
      star.setAttribute('role', 'button');
      star.setAttribute('aria-label', 'Sematkan perangkat');
      star.innerHTML = SVG_STAR_OUTLINE;
      star.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const slug = card.dataset.openTool;
        if (!slug) return;
        if (favSet.has(slug)) {
          favSet.delete(slug);
          toast('Sematan perangkat dilepas.');
        } else {
          favSet.add(slug);
          toast('Perangkat disematkan ke bagian atas direktori.');
        }
        saveFavSet(favSet);
        syncBentoFavoritesAndOrder();
        filterLandingCards();
      });
      card.appendChild(star);
    });
    syncBentoFavoritesAndOrder();

    // Klik Logo, Direktori, & Mobile Drawer
    document.getElementById('brandHomeLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('home');
    });
    document.getElementById('btnNavHome')?.addEventListener('click', () => switchView('home'));
    document.getElementById('btnBackHome')?.addEventListener('click', () => switchView('home'));
    document.getElementById('btnOpenMobileSidebar')?.addEventListener('click', openMobileSidebar);
    document.getElementById('btnCloseMobileSidebar')?.addEventListener('click', closeMobileSidebar);
    document.getElementById('sidebarBackdrop')?.addEventListener('click', closeMobileSidebar);

    const focusDirectorySearch = () => {
      if (state.view !== 'home') switchView('home');
      const inp = document.getElementById('homeSearchInput');
      if (inp) {
        inp.focus();
        inp.select();
      }
    };
    document.getElementById('btnQuickSearchNav')?.addEventListener('click', focusDirectorySearch);

    // Filter live daftar sidebar
    document.getElementById('sidebarFilterInput')?.addEventListener('input', (e) => {
      const q = (e.target.value || '').trim().toLowerCase();
      document.querySelectorAll('#quickSwitcherBar .sidebar-group').forEach((grp) => {
        let groupMatches = 0;
        grp.querySelectorAll('[data-tool-target]').forEach((btn) => {
          const match = !q || btn.textContent.toLowerCase().includes(q) || (btn.dataset.toolTarget || '').includes(q);
          btn.classList.toggle('hidden', !match);
          if (match) groupMatches++;
        });
        grp.classList.toggle('hidden', groupMatches === 0);
      });
    });

    // Tombol Salin Tautan Langsung ke Tool Aktif
    document.getElementById('btnShareCurrentTool')?.addEventListener('click', async () => {
      const slug = ['send', 'history', 'settings'].includes(state.view) ? 'send' : state.view;
      const shareUrl = `${window.location.origin}/?tool=${encodeURIComponent(slug)}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast(`Tautan disalin: ${shareUrl}`);
      } catch {
        toast(`Tautan perangkat: ${shareUrl}`);
      }
    });

    // Klik Kartu Direktori & Navigasi Sidebar
    document.querySelectorAll('[data-open-tool]').forEach((card) => {
      card.addEventListener('click', () => switchView(card.dataset.openTool));
    });

    document.querySelectorAll('[data-tool-target]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.toolTarget));
    });

    // Filter Kategori & Live Search pada Direktori
    let activeCategory = 'all';
    function filterLandingCards() {
      const q = (document.getElementById('homeSearchInput')?.value || '').trim().toLowerCase();
      const allCards = document.querySelectorAll('#homeBentoGrid .bento-card');
      const totalCount = allCards.length || 21;
      let visibleCount = 0;
      allCards.forEach((card) => {
        const cat = card.dataset.toolCat || '';
        const slug = card.dataset.openTool || '';
        const textBlob = `${card.textContent} ${card.dataset.toolKeywords || ''}`.toLowerCase();
        const catMatch =
          activeCategory === 'all' ||
          (activeCategory === 'fav' ? favSet.has(slug) : cat === activeCategory);
        const searchMatch = !q || textBlob.includes(q);
        const show = catMatch && searchMatch;
        card.classList.toggle('hidden', !show);
        if (show) visibleCount++;
      });

      const countEl = document.getElementById('directoryResultCount');
      if (countEl) {
        countEl.textContent =
          visibleCount === totalCount
            ? `Menampilkan ${totalCount} perangkat aktif`
            : `Menampilkan ${visibleCount} dari ${totalCount} perangkat`;
      }

      const emptyBox = document.getElementById('homeEmptySearch');
      if (emptyBox) {
        if (activeCategory === 'fav' && favSet.size === 0) {
          emptyBox.textContent = 'Belum ada perangkat yang disematkan. Klik ikon bintang di pojok kanan atas kartu untuk menyematkan favorit.';
        } else {
          emptyBox.textContent = 'Tidak ada perangkat yang cocok dengan filter atau kata kunci pencarian tersebut.';
        }
        emptyBox.classList.toggle('hidden', visibleCount > 0);
      }
    }

    document.querySelectorAll('#homeCategoryBar [data-cat]').forEach((pill) => {
      pill.addEventListener('click', () => {
        activeCategory = pill.dataset.cat;
        document.querySelectorAll('#homeCategoryBar [data-cat]').forEach((p) =>
          p.classList.toggle('active', p === pill)
        );
        filterLandingCards();
      });
    });

    document.getElementById('homeSearchInput')?.addEventListener('input', filterLandingCards);

    // Pintasan Keyboard Ctrl + K / Cmd + K & Escape
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        focusDirectorySearch();
      } else if (e.key === 'Escape') {
        closeMobileSidebar();
      }
    });

    // Buka langsung tool bila URL memiliki parameter ?tool=<slug>
    try {
      const initialTool = new URLSearchParams(window.location.search).get('tool');
      if (initialTool) {
        switchView(initialTool, { updateUrl: false });
      }
    } catch {
      // Abaikan
    }

    // Klik Sub-menu WA Reaction
    document.querySelectorAll('[data-subview]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.subview));
    });

    document.getElementById('btnSeeAllHistory')?.addEventListener('click', () => switchView('history'));
    document.getElementById('btnValidateLinks')?.addEventListener('click', () => validateLinks(false));

    // Presets Emoji
    document.querySelectorAll('[data-preset]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const key = chip.dataset.preset;
        state.selectedEmojis = key === 'clear' ? [] : [...(PRESETS[key] || [])];
        renderEmojiGrid();
      });
    });

    // Tambah Emoji Kustom
    const addCustomEmoji = () => {
      const inp = document.getElementById('customEmojiInput');
      const raw = inp?.value.trim() || '';
      if (!raw) return;
      const seg =
        typeof Intl !== 'undefined' && Intl.Segmenter
          ? new Intl.Segmenter('id', { granularity: 'grapheme' })
          : null;
      const tokens = seg
        ? Array.from(seg.segment(raw)).map((s) => s.segment.trim()).filter(Boolean)
        : Array.from(raw).filter((c) => c.trim());

      tokens.forEach((em) => {
        if (!DEFAULT_EMOJIS.includes(em) && !state.customEmojis.includes(em)) {
          state.customEmojis.push(em);
        }
        if (!state.selectedEmojis.includes(em)) {
          state.selectedEmojis.push(em);
        }
      });
      inp.value = '';
      renderEmojiGrid();
    };

    document.getElementById('btnAddCustomEmoji')?.addEventListener('click', addCustomEmoji);
    document.getElementById('customEmojiInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCustomEmoji();
      }
    });

    // Toggle Opsi Lanjutan
    document.getElementById('btnToggleAdvanced')?.addEventListener('click', () => {
      const box = document.getElementById('advancedOptionsBox');
      box?.classList.toggle('hidden');
    });

    document.getElementById('campaignProvider')?.addEventListener('change', updateProviderModeUI);
    document.getElementById('campaignForm')?.addEventListener('submit', onSubmitCampaign);

    // Riwayat & Log
    document.getElementById('btnClearFinished')?.addEventListener('click', async () => {
      const res = await api('/api/campaigns', { method: 'DELETE' });
      state.campaigns = res.campaigns || [];
      renderCampaigns();
      toast('Riwayat yang selesai telah dibersihkan.');
    });

    document.getElementById('btnClearLogs')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await api('/api/logs', { method: 'DELETE' });
      state.logs = [];
      renderLogs();
      toast('Log server dibersihkan.');
    });

    // Form Tambah Provider Baru
    document.getElementById('providerType')?.addEventListener('change', (e) => {
      const val = e.target.value;
      document.getElementById('smmFields')?.classList.toggle('hidden', val !== 'smm_v2');
      document.getElementById('webhookFields')?.classList.toggle('hidden', val !== 'custom_webhook');
    });

    document.getElementById('providerForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('providerType').value;
      const payload = {
        name: document.getElementById('providerName').value.trim(),
        type: type === 'demo' ? 'sandbox' : type,
        apiUrl:
          type === 'smm_v2'
            ? document.getElementById('providerApiUrl').value.trim()
            : document.getElementById('webhookUrl').value.trim(),
        apiKey:
          type === 'smm_v2'
            ? document.getElementById('providerApiKey').value.trim()
            : document.getElementById('webhookAuth').value.trim(),
        defaultServiceId: document.getElementById('providerDefaultService').value.trim()
      };

      try {
        const res = await api('/api/providers', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        state.providers.push(res.provider);
        e.target.reset();
        renderProviders();
        renderProviderSelect();
        toast('Server baru berhasil ditambahkan!');
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // Muat State Awal
    try {
      const data = await api('/api/state');
      state.activeProviderId = data.activeProviderId || 'prov_free_pool';
      state.providers = data.providers || [];
      state.campaigns = data.campaigns || [];
      state.logs = data.logs || [];
      renderProviderSelect();
      renderCampaigns();
      renderProviders();
      if (!data.serverless) {
        initSse();
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  window.D4Tech = { toast, esc, api, switchView };
  document.addEventListener('DOMContentLoaded', init);
})();
