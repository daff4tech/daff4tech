/**
 * D4Tech Hub — Klien modul "Penambah Followers Saluran WhatsApp"
 * Vanilla JS, tanpa dependensi. Memakai helper global window.D4Tech.
 */
(() => {
  'use strict';

  const getHelpers = () =>
    window.D4Tech || {
      toast: (m) => alert(m),
      esc: (s) => String(s ?? ''),
      api: async (u, o) => (await fetch(u, o)).json()
    };

  const state = {
    channels: [],
    health: null,
    orders: [],
    quantity: 20,
    lastOrder: null,
    inspected: null,
    initialized: false
  };

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtNum(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString('id-ID');
  }

  function fmtDelta(n) {
    if (n === null || n === undefined) return '—';
    if (n > 0) return `+${fmtNum(n)}`;
    return fmtNum(n);
  }

  function statusClass(health) {
    if (!health) return 'pending';
    if (health.online) return 'online';
    if (health.status === 'needs_key' || health.status === 'unconfigured') return 'pending';
    return 'offline';
  }

  /* --------------------------------------------------------------- render */

  function renderHealth() {
    const box = document.getElementById('followerHealthList');
    if (!box) return;
    const { health } = state;
    if (!health) {
      box.innerHTML = '<div class="follower-health-item"><span class="follower-health-dot pending"></span><div class="follower-health-main"><div class="follower-health-name">Memeriksa jalur gratis…</div><div class="follower-health-note">Menghubungi WAHA, Followdeh, SMM.ist, dan panel kustom.</div></div></div>';
      return;
    }

    const list = state.channels.map((ch) => {
      const h = health.channels?.[ch.id] || null;
      const dot = statusClass(h);
      const statusLabel =
        dot === 'online' ? 'ONLINE' : dot === 'pending' ? 'SIAP DIATUR' : 'OFFLINE';
      return `
        <div class="follower-health-item">
          <span class="follower-health-dot ${dot}"></span>
          <div class="follower-health-main">
            <div class="follower-health-name">
              ${esc(ch.name)}
              <span class="follower-badge ${ch.free ? 'free' : ''}">${ch.free ? 'GRATIS' : 'PANEL'}</span>
              <span class="follower-badge">${statusLabel}</span>
            </div>
            <div class="follower-health-note">${esc(h?.note || ch.readyNote || ch.tagline || '')}</div>
          </div>
          ${ch.formUrl ? `<a class="text-btn" href="${esc(ch.formUrl)}" target="_blank" rel="noopener" style="margin-left:auto;">Buka &rarr;</a>` : ''}
        </div>
      `;
    });

    box.innerHTML = list.join('');
  }

  function renderChannelSelect() {
    const select = document.getElementById('followerChannelSelect');
    if (!select) return;
    const current = select.value || 'auto';
    const opts = [
      '<option value="auto">Mode Otomatis — failover terbaik</option>',
      ...state.channels
        .filter((ch) => ch.id !== 'quantaps')
        .map(
          (ch) => `<option value="${esc(ch.id)}">${esc(ch.name)}${ch.ready ? '' : ' (belum siap)'}</option>`
        )
    ];
    select.innerHTML = opts.join('');
    select.value = current;
    if (!select.value) select.value = 'auto';
  }

  function renderGuide() {
    const cmdEl = document.getElementById('wahaSetupCommand');
    const waha = state.channels.find((c) => c.id === 'waha_self');
    if (cmdEl && waha?.setupCommand) cmdEl.textContent = waha.setupCommand;

    const box = document.getElementById('followerGuideList');
    if (!box) return;
    box.innerHTML = state.channels
      .filter((ch) => ch.free)
      .map((ch) => {
        const why = esc(ch.bestFor || ch.tagline || '');
        return `<li><b>${esc(ch.name)}</b> — ${why}</li>`;
      })
      .join('');
  }

  function renderConfig() {
    const r = state.config || {};
    const v = (id, val) => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = val || '';
    };
    v('wahaBaseUrl', r.waha?.baseUrl);
    v('wahaSession', r.waha?.session || 'default');
    v('wahaPairingPhone', r.waha?.pairingPhone);
    v('customSmmUrl', r.customSmm?.apiUrl);
    v('customSmmApiId', r.customSmm?.apiId);

    // API key tidak pernah dikirim balik ke peramban; tampilkan status ter-mask.
    const mark = (id, preview, hasKey) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (document.activeElement === el) return;
      el.value = '';
      el.placeholder = hasKey
        ? `Tersimpan: ${preview || '••••'} — isi lagi untuk mengganti`
        : el.dataset.defaultPlaceholder || 'Belum diatur';
    };

    mark('followdehKey', r.followdehKeyPreview, Boolean(r.followdehKeyPreview));
    mark('smmIstKey', r.smmIstKeyPreview, Boolean(r.smmIstKeyPreview));
    mark('customSmmKey', r.customSmm?.keyPreview, r.customSmm?.hasApiKey);
    mark('wahaApiKey', '', r.waha?.hasApiKey);
  }

  function renderPreview() {
    const box = document.getElementById('followerChannelPreview');
    if (!box) return;
    const info = state.inspected;
    if (!info) {
      box.classList.add('hidden');
      box.innerHTML = '';
      return;
    }
    const { channel, parsed } = info;
    const avatar = channel.avatar
      ? `<img src="${esc(channel.avatar)}" alt="Avatar saluran" />`
      : `<div class="follower-target-avatar">${esc((channel.name || 'WA').slice(0, 2).toUpperCase())}</div>`;

    const statusLine = channel.reachable
      ? channel.exists === false
        ? `⚠ Tidak terverifikasi: ${esc(channel.reason || 'saluran tidak publik')}`
        : `Pengikut publik saat ini: <b>${esc(channel.followersText || 'belum terbaca')}</b>`
      : `⚠ ${esc(channel.reason || 'Server tidak bisa membaca WhatsApp')}`;

    box.classList.remove('hidden');
    box.innerHTML = `
      <div class="follower-target-card">
        ${avatar}
        <div style="min-width:0;">
          <div class="follower-target-name">${esc(channel.name || 'Saluran WhatsApp')}</div>
          <div class="follower-target-meta">${esc(parsed.channelUrl)}</div>
        </div>
      </div>
      <div class="helper-line" style="margin-top:0.5rem;"><span>${statusLine}</span></div>
    `;
  }

  function renderResult() {
    const box = document.getElementById('followerResult');
    const recheckBtn = document.getElementById('btnRecheckOrder');
    if (!box) return;
    const order = state.lastOrder;
    if (!order) {
      box.innerHTML =
        '<div class="empty-box">Belum ada eksekusi. Isi tautan saluran, pilih jumlah, lalu jalankan.</div>';
      recheckBtn?.classList.add('hidden');
      return;
    }

    const proof = order.proof || {};
    const delta = proof.delta;
    const verified = order.verified === true;
    const badge = verified
      ? '<span class="status-badge badge-completed">TERVERIFIKASI</span>'
      : order.status === 'processing'
      ? '<span class="status-badge badge-running">DIPROSES</span>'
      : '<span class="status-badge badge-partial">DITERIMA</span>';

    box.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; flex-wrap:wrap;">
        <div style="font-weight:650; font-size:0.9rem;">${esc(order.realChannelName || order.channelName || 'Saluran WhatsApp')}</div>
        ${badge}
      </div>
      <div class="follower-target-meta" style="margin-top:0.2rem;">${esc(order.target)}</div>

      <div class="follower-proof-grid">
        <div class="follower-proof-cell">
          <span>Sebelum</span>
          <strong>${esc(proof.beforeText || '—')}</strong>
        </div>
        <div class="follower-proof-cell">
          <span>Setelah</span>
          <strong>${esc(proof.afterText || '—')}</strong>
        </div>
        <div class="follower-proof-cell">
          <span>Naik</span>
          <strong class="${delta > 0 ? 'up' : ''}">${esc(fmtDelta(delta))}</strong>
        </div>
      </div>

      <div class="camp-meta">
        Jalur: ${esc(order.channelName)} • Mode: ${esc(order.mode)}<br />
        ${order.serviceName ? `Layanan panel: ${esc(order.serviceName)}<br />` : ''}
        ${order.externalOrderId ? `ID: ${esc(order.externalOrderId)} • ` : ''}Jumlah diminta: ${esc(fmtNum(order.quantity))}
      </div>

      <ul class="follower-note-list">
        ${(order.notes || []).map((n) => `<li>${esc(n)}</li>`).join('')}
      </ul>
    `;
    recheckBtn?.classList.remove('hidden');
    recheckBtn.dataset.orderId = order.id;
  }

  function renderHistory() {
    const box = document.getElementById('followerHistoryList');
    if (!box) return;
    if (!state.orders.length) {
      box.innerHTML = '<div class="empty-box">Belum ada riwayat.</div>';
      return;
    }

    box.innerHTML = state.orders
      .map((o) => {
        const proof = o.proof || {};
        const delta = proof.delta;
        const badge = o.verified
          ? '<span class="status-badge badge-completed">TERVERIFIKASI</span>'
          : o.status === 'processing'
          ? '<span class="status-badge badge-running">DIPROSES</span>'
          : '<span class="status-badge badge-partial">DITERIMA</span>';

        return `
          <div class="campaign-card" data-fol-order="${esc(o.id)}">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:0.6rem;">
              <div style="min-width:0;">
                <div class="camp-title">${esc(o.realChannelName || o.channelName || 'Saluran WhatsApp')}</div>
                <div class="camp-meta">${esc(o.target)}</div>
              </div>
              ${badge}
            </div>
            <div class="camp-bottom" style="margin-top:0.5rem;">
              <span>${esc(o.channelName)} • ${esc(fmtNum(o.quantity))} followers</span>
              <span>
                ${esc(proof.beforeText || '—')} &rarr; ${esc(proof.afterText || '—')}
                ${delta !== null && delta !== undefined ? `(<b>${esc(fmtDelta(delta))}</b>)` : ''}
              </span>
            </div>
            <div class="btn-row" style="margin-top:0.5rem;">
              <button type="button" class="btn btn-secondary btn-sm" data-fol-refresh="${esc(o.id)}">Cek ulang</button>
              <span class="camp-meta">${esc(new Date(o.createdAt).toLocaleString('id-ID'))}</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  /* ---------------------------------------------------------------- aksi  */

  async function loadChannels() {
    const { api } = getHelpers();
    const data = await api('/api/followers/channels');
    state.channels = data.channels || [];
    renderChannelSelect();
    renderGuide();
    renderHealth();
  }

  async function loadConfig() {
    const { api } = getHelpers();
    try {
      const data = await api('/api/state');
      state.config = data.followerConfig || null;
      if (!state.config) {
        // fallback: baca dari endpoint channels yang memuat preview key
        state.config = {};
      }
      renderConfig();
    } catch {
      /* konfigurasi opsional */
    }
  }

  async function loadOrders() {
    const { api } = getHelpers();
    const data = await api('/api/followers/orders');
    state.orders = data.orders || [];
    renderHistory();
  }

  async function loadHealth(force = false) {
    const { api } = getHelpers();
    try {
      state.health = await api(`/api/followers/health${force ? '?force=1' : ''}`);
      renderHealth();
    } catch (err) {
      state.health = { channels: {} };
      renderHealth();
    }
  }

  async function inspectChannel(showToast = true) {
    const { api, toast } = getHelpers();
    const input = document.getElementById('followerChannelInput');
    const link = input?.value.trim();
    if (!link) {
      toast?.('Tempel tautan Saluran WhatsApp terlebih dahulu.', 'error');
      return null;
    }
    try {
      const data = await api('/api/followers/inspect', {
        method: 'POST',
        body: JSON.stringify({ link })
      });
      state.inspected = { parsed: data.parsed, channel: data.channel };
      renderPreview();
      if (showToast) {
        const f = data.channel?.followersText;
        toast?.(
          data.channel?.name
            ? `Saluran ditemukan: ${data.channel.name}${f ? ` • ${f}` : ''}`
            : 'Tautan valid. Detail saluran tidak terbaca dari server.'
        );
      }
      return data;
    } catch (err) {
      state.inspected = null;
      renderPreview();
      toast?.(err.message, 'error');
      return null;
    }
  }

  function updateQtyLabel() {
    const el = document.getElementById('followerQtyLabel');
    if (el) el.textContent = `${fmtNum(state.quantity)} followers`;
  }

  async function submitOrder(e) {
    e?.preventDefault();
    const { api, toast } = getHelpers();
    const input = document.getElementById('followerChannelInput');
    const link = input?.value.trim();
    if (!link) {
      toast?.('Tempel tautan Saluran WhatsApp terlebih dahulu.', 'error');
      return;
    }

    const channelId = document.getElementById('followerChannelSelect')?.value || 'auto';
    const btn = document.getElementById('btnRunFollowers');
    const box = document.getElementById('followerResult');
    const prev = btn?.innerHTML;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Mengirim follow…';
    }
    if (box) {
      box.innerHTML =
        '<div class="empty-box"><span class="spinner" style="vertical-align:middle;margin-right:6px;"></span>Menyambung ke jalur gratis & mengirim follow…</div>';
    }

    try {
      const data = await api('/api/followers/order', {
        method: 'POST',
        body: JSON.stringify({ link, quantity: state.quantity, channelId })
      });
      state.lastOrder = data.order;
      renderResult();
      renderHistory();
      await loadOrders();
      await loadHealth(true);
      if (data.order?.verified) {
        toast?.(`Follow diverifikasi: pengikut naik ${fmtDelta(data.proof?.delta)}.`);
      } else {
        toast?.('Order diterima. Cek ulang beberapa menit lagi untuk bukti kenaikan.');
      }
    } catch (err) {
      if (box) {
        box.innerHTML = `<div class="empty-box" style="color:var(--danger);">${esc(err.message)}</div>`;
      }
      toast?.(err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = prev || 'Jalankan Penambahan Followers';
      }
    }
  }

  async function refreshOrder(orderId) {
    const { api, toast } = getHelpers();
    if (!orderId) return;
    try {
      const data = await api(`/api/followers/orders/${encodeURIComponent(orderId)}/refresh`, {
        method: 'POST'
      });
      if (state.lastOrder?.id === orderId) {
        state.lastOrder = data.order;
        renderResult();
      }
      await loadOrders();
      toast?.(
        data.order?.verified
          ? `Terverifikasi: naik ${fmtDelta(data.order.proof?.delta)} pengikut.`
          : 'Belum ada kenaikan terbaca. WhatsApp memperbarui hitungan bertahap.'
      );
    } catch (err) {
      toast?.(err.message, 'error');
    }
  }

  async function connectWaha() {
    const { api, toast } = getHelpers();
    const btn = document.getElementById('btnConnectWaha');
    const statusBox = document.getElementById('wahaPairStatus');
    const qrWrap = document.getElementById('wahaQrWrap');
    const qrImg = document.getElementById('wahaQrImage');
    const prev = btn?.innerHTML;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Menyiapkan…';
    }
    if (statusBox) {
      statusBox.classList.remove('hidden');
      statusBox.innerHTML = '<span>Membuat/menyalakan sesi WAHA & mengambil QR…</span>';
    }

    try {
      const data = await api('/api/followers/waha/connect', { method: 'POST' });

      if (data.pairingCode) {
        qrWrap?.classList.remove('hidden');
        if (qrImg) qrImg.removeAttribute('src');
        if (statusBox) {
          statusBox.innerHTML = `
            <div class="follower-pair-code">${esc(data.pairingCode)}</div>
            <span>${esc(data.note)}<br />Nomor: <b>${esc(data.pairingPhone || '-')}</b></span>
            <ol class="follower-pair-steps">${(data.steps || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
          `;
        }
        toast?.('Kode pairing dibuat. Masukkan di WhatsApp → Perangkat Tertaut.');
      } else if (data.status === 'working') {
        qrWrap?.classList.add('hidden');
        if (statusBox) {
          statusBox.innerHTML = `<span style="color:var(--brand-text);font-weight:600;">✓ ${esc(data.note)}</span>`;
        }
        toast?.('Nomor sudah tertaut — WAHA siap mengeksekusi follow.');
      } else if (data.qr) {
        qrWrap?.classList.remove('hidden');
        if (qrImg) qrImg.src = data.qr;
        if (statusBox) {
          statusBox.innerHTML = `<span>${esc(data.note)}<br />Sesi: <b>${esc(data.session)}</b> · scan QR di samping.</span>`;
        }
        toast?.('QR dibuat. Pindai lewat WhatsApp → Perangkat Tertaut.');
      } else {
        qrWrap?.classList.add('hidden');
        if (statusBox) {
          statusBox.innerHTML = `<span>${esc(data.note)}</span>`;
        }
        toast?.('Sesi dibuat, tetapi QR belum tersedia. Muat ulang status beberapa detik lagi.');
      }

      await loadHealth(true);
    } catch (err) {
      qrWrap?.classList.add('hidden');
      if (statusBox) statusBox.innerHTML = `<span style="color:var(--danger);">${esc(err.message)}</span>`;
      toast?.(err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = prev || 'Tautkan Nomor';
      }
    }
  }

  async function saveConfig() {
    const { api, toast } = getHelpers();
    const val = (id) => document.getElementById(id)?.value.trim() || '';

    // Hanya kirim API key bila pengguna benar-benar mengetik nilai baru,
    // supaya menyimpan URL tidak menghapus kunci yang sudah tersimpan.
    const waha = {
      baseUrl: val('wahaBaseUrl'),
      session: val('wahaSession') || 'default',
      pairingPhone: val('wahaPairingPhone')
    };
    if (val('wahaApiKey')) waha.apiKey = val('wahaApiKey');

    const smm = { custom: { apiUrl: val('customSmmUrl'), apiId: val('customSmmApiId') } };
    if (val('followdehKey')) smm.followdeh = { apiKey: val('followdehKey') };
    if (val('smmIstKey')) smm.smmIst = { apiKey: val('smmIstKey') };
    if (val('customSmmKey')) smm.custom.apiKey = val('customSmmKey');

    try {
      await api('/api/followers/config', {
        method: 'POST',
        body: JSON.stringify({ waha, smm })
      });
      await Promise.all([loadChannels(), loadConfig()]);
      await loadHealth(true);
      toast?.('Konfigurasi tersimpan. Status jalur diperbarui.');
    } catch (err) {
      toast?.(err.message, 'error');
    }
  }

  /* ----------------------------------------------------------------- init */

  function bindOnce() {
    if (state.initialized) return;
    state.initialized = true;

    const qtyInput = document.getElementById('followerQuantity');
    qtyInput?.addEventListener('input', () => {
      state.quantity = Math.min(10000, Math.max(1, Math.floor(Number(qtyInput.value) || 1)));
      updateQtyLabel();
    });

    document.querySelectorAll('[data-fol-qty]').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.quantity = Number(chip.dataset.folQty) || 20;
        if (qtyInput) qtyInput.value = state.quantity;
        updateQtyLabel();
      });
    });

    document.getElementById('btnInspectChannel')?.addEventListener('click', () => inspectChannel(true));
    document.getElementById('followerChannelInput')?.addEventListener('change', () => inspectChannel(false));
    document.getElementById('followerForm')?.addEventListener('submit', submitOrder);
    document.getElementById('btnRefreshFollowerHealth')?.addEventListener('click', () => loadHealth(true));
    document.getElementById('btnRecheckOrder')?.addEventListener('click', (e) =>
      refreshOrder(e.currentTarget.dataset.orderId)
    );
    document.getElementById('btnSaveFollowerConfig')?.addEventListener('click', saveConfig);
    document.getElementById('btnConnectWaha')?.addEventListener('click', connectWaha);
    document.getElementById('btnToggleFollowerConfig')?.addEventListener('click', (e) => {
      const box = document.getElementById('followerConfigBox');
      box?.classList.toggle('hidden');
      const isHidden = box?.classList.contains('hidden');
      e.currentTarget.textContent = isHidden ? 'Buka' : 'Tutup';
      if (!isHidden) renderConfig();
    });
    document.getElementById('btnClearFollowerOrders')?.addEventListener('click', async () => {
      const { api, toast } = getHelpers();
      await api('/api/followers/orders', { method: 'DELETE' });
      state.orders = [];
      state.lastOrder = null;
      renderHistory();
      renderResult();
      toast?.('Riwayat dibersihkan.');
    });

    document.getElementById('followerHistoryList')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-fol-refresh]');
      if (btn) refreshOrder(btn.dataset.folRefresh);
    });

    ['followdehKey', 'smmIstKey', 'customSmmKey', 'wahaApiKey'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.dataset.defaultPlaceholder = el.placeholder || 'Belum diatur';
    });

    updateQtyLabel();
  }

  async function init() {
    const form = document.getElementById('followerForm');
    if (!form) return;
    bindOnce();
    renderHealth();

    try {
      await Promise.all([loadChannels(), loadOrders(), loadConfig()]);
      await loadHealth(false);
    } catch (err) {
      const { toast } = getHelpers();
      toast?.(err.message, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  // Muat ulang saat view dibuka lewat deep-link/hash agar data selalu segar
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-tool-target="followers"], [data-open-tool="followers"]');
    if (target) setTimeout(init, 60);
  });

  window.D4TechFollowers = { init, inspectChannel, loadHealth };
})();
