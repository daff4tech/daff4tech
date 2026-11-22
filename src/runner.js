const EventEmitter = require('events');
const store = require('./store');
const { submitReactionOrder, checkOrderStatus } = require('./providers');

class CampaignRunner extends EventEmitter {
  constructor() {
    super();
    this.cancelledIds = new Set();
  }

  broadcast(event, payload) {
    this.emit('sse', { event, payload, timestamp: new Date().toISOString() });
  }

  log(level, message, campaignId = null, detail = null) {
    const entry = store.addLog({ level, message, campaignId, detail });
    this.broadcast('log', entry);
    return entry;
  }

  /**
   * Membuat Campaign baru dan langsung menjalankan antrean di background (atau inline pada Serverless)
   */
  async createAndStartCampaign(params) {
    const {
      providerId,
      links, // array of parsed link objects: [{ normalizedUrl, channelCode, postId, channelName }]
      reactions, // array of { emoji, quantity, serviceIdOverride? }
      pacing = {}, // { mode: 'instant' | 'drip', batchCount: 2, intervalMs: 1500, maxRetries: 1 }
      awaitCompletion = false
    } = params;

    const provider = store.getProvider(providerId) || store.getActiveProvider();
    if (!provider) {
      throw new Error('Provider API tidak ditemukan.');
    }

    const cleanReactions = (reactions || [])
      .map((r) => ({
        emoji: String(r.emoji || '').trim(),
        quantity: Math.max(0, Math.floor(Number(r.quantity) || 0)),
        serviceIdOverride: r.serviceIdOverride ? String(r.serviceIdOverride).trim() : ''
      }))
      .filter((r) => r.emoji && r.quantity > 0);

    if (cleanReactions.length === 0) {
      throw new Error('Pilih minimal 1 jenis emoji reaction dengan jumlah lebih dari 0.');
    }

    const deliveryMode = pacing.mode === 'drip' ? 'drip' : 'instant';
    const dripWaves =
      deliveryMode === 'drip'
        ? Math.min(10, Math.max(2, Math.floor(Number(pacing.batchCount) || 2)))
        : 1;
    const rawInterval = Number(pacing.intervalMs ?? pacing.delayMs);
    const delayMs = Math.min(
      60000,
      Math.max(150, Math.floor(Number.isFinite(rawInterval) ? rawInterval : 1000))
    );
    const rawRetries = Number(pacing.maxRetries);
    const defaultRetries = provider.type === 'free_pool' ? 0 : 1;
    const maxRetries = Math.min(
      3,
      Math.max(0, Math.floor(Number.isFinite(rawRetries) ? rawRetries : defaultRetries))
    );

    const subOrders = [];
    const isPerUnitDirect =
      provider.type === 'direct_api' && provider.config?.dispatchStyle === 'per_unit';
    const isFreeCombinedPool =
      provider.type === 'free_pool' && provider.config?.dispatchMode !== 'per_emoji';

    for (const linkObj of links) {
      if (isFreeCombinedPool) {
        const combinedSum = cleanReactions.reduce((acc, r) => acc + r.quantity, 0);
        subOrders.push({
          id: store.generateId('sub'),
          link: linkObj.normalizedUrl,
          channelCode: linkObj.channelCode,
          postId: linkObj.postId,
          emoji: cleanReactions.map((r) => r.emoji).join(' '),
          quantity: combinedSum,
          reactionsBatch: cleanReactions,
          wave: 1,
          totalWaves: 1,
          serviceIdOverride: '',
          status: 'queued',
          providerStatus: 'Queued',
          externalOrderId: null,
          cost: 0,
          attempts: 0,
          error: null,
          submittedAt: null
        });
        continue;
      }

      for (const item of cleanReactions) {
        if (isPerUnitDirect) {
          // Pecah menjadi beberapa eksekusi unit (dibatasi maks 50 request per emoji agar aman)
          const cappedQty = Math.min(item.quantity, 50);
          for (let u = 1; u <= cappedQty; u++) {
            subOrders.push({
              id: store.generateId('sub'),
              link: linkObj.normalizedUrl,
              channelCode: linkObj.channelCode,
              postId: linkObj.postId,
              emoji: item.emoji,
              quantity: 1,
              wave: u,
              totalWaves: cappedQty,
              serviceIdOverride: item.serviceIdOverride,
              status: 'queued', // queued | sending | submitted | failed | cancelled
              providerStatus: 'Queued',
              externalOrderId: null,
              cost: 0,
              attempts: 0,
              error: null,
              submittedAt: null
            });
          }
        } else if (deliveryMode === 'drip' && item.quantity >= dripWaves) {
          const baseQty = Math.floor(item.quantity / dripWaves);
          let remainder = item.quantity % dripWaves;
          for (let w = 1; w <= dripWaves; w++) {
            const waveQty = baseQty + (remainder > 0 ? 1 : 0);
            if (remainder > 0) remainder--;
            subOrders.push({
              id: store.generateId('sub'),
              link: linkObj.normalizedUrl,
              channelCode: linkObj.channelCode,
              postId: linkObj.postId,
              emoji: item.emoji,
              quantity: waveQty,
              wave: w,
              totalWaves: dripWaves,
              serviceIdOverride: item.serviceIdOverride,
              status: 'queued',
              providerStatus: 'Queued',
              externalOrderId: null,
              cost: 0,
              attempts: 0,
              error: null,
              submittedAt: null
            });
          }
        } else {
          subOrders.push({
            id: store.generateId('sub'),
            link: linkObj.normalizedUrl,
            channelCode: linkObj.channelCode,
            postId: linkObj.postId,
            emoji: item.emoji,
            quantity: item.quantity,
            wave: 1,
            totalWaves: 1,
            serviceIdOverride: item.serviceIdOverride,
            status: 'queued',
            providerStatus: 'Queued',
            externalOrderId: null,
            cost: 0,
            attempts: 0,
            error: null,
            submittedAt: null
          });
        }
      }
    }

    const totalReactionsTarget = subOrders.reduce((acc, s) => acc + s.quantity, 0);

    const campaign = {
      id: store.generateId('cmp'),
      createdAt: new Date().toISOString(),
      completedAt: null,
      providerId: provider.id,
      providerName: provider.name,
      providerType: provider.type,
      currency: provider.currency || 'IDR',
      linksCount: links.length,
      primaryLink: links[0].normalizedUrl,
      channelName: links[0].channelName || `Saluran ${links[0].channelCode.slice(0, 8)}`,
      reactionsSummary: cleanReactions,
      pacing: { mode: deliveryMode, batchCount: dripWaves, intervalMs: delayMs, maxRetries },
      status: 'running', // running | completed | partial | failed | cancelled
      totalTasks: subOrders.length,
      completedTasks: 0,
      failedTasks: 0,
      totalReactionsTarget,
      totalReactionsSubmitted: 0,
      totalCost: 0,
      subOrders
    };

    store.addCampaign(campaign);
    this.broadcast('campaign_created', campaign);
    this.log(
      'info',
      `Kampanye ${campaign.id} dimulai: ${totalReactionsTarget} reaction (${cleanReactions
        .map((r) => `${r.emoji}×${r.quantity}`)
        .join(', ')}) melalui ${provider.name}.`,
      campaign.id
    );

    if (awaitCompletion) {
      await this._executeCampaign(campaign.id);
      return store.getCampaign(campaign.id) || campaign;
    }

    // Jalankan asynchronous tanpa memblokir HTTP response (untuk server persisten)
    setImmediate(() => {
      this._executeCampaign(campaign.id).catch((err) => {
        console.error('Campaign execution error:', err);
      });
    });

    return campaign;
  }

  cancelCampaign(campaignId) {
    const campaign = store.getCampaign(campaignId);
    if (!campaign) throw new Error('Kampanye tidak ditemukan.');
    if (campaign.status !== 'running') {
      return campaign;
    }
    this.cancelledIds.add(campaignId);
    for (const sub of campaign.subOrders) {
      if (sub.status === 'queued') {
        sub.status = 'cancelled';
        sub.providerStatus = 'Cancelled';
      }
    }
    campaign.status = 'cancelled';
    campaign.completedAt = new Date().toISOString();
    store.save();
    this.log('warn', `Kampanye ${campaignId} dibatalkan oleh pengguna.`, campaignId);
    this.broadcast('campaign_updated', campaign);
    return campaign;
  }

  async _executeCampaign(campaignId) {
    const campaign = store.getCampaign(campaignId);
    if (!campaign) return;

    const provider = store.getProvider(campaign.providerId) || store.getActiveProvider();
    const { intervalMs, maxRetries } = campaign.pacing;

    // Urutkan agar bila mode drip-feed (multi-wave), wave 1 semua emoji terkirim dulu, lalu wave 2, dst.
    const orderedSubs = [...campaign.subOrders].sort((a, b) => a.wave - b.wave);

    for (let i = 0; i < orderedSubs.length; i++) {
      if (this.cancelledIds.has(campaignId) || campaign.status === 'cancelled') {
        break;
      }

      const sub = orderedSubs[i];
      if (sub.status !== 'queued') continue;

      sub.status = 'sending';
      sub.providerStatus = 'Sending...';
      this.broadcast('campaign_updated', campaign);

      let success = false;
      let lastErr = null;

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        sub.attempts = attempt;
        try {
          const res = await submitReactionOrder(provider, {
            link: sub.link,
            channelCode: sub.channelCode,
            postId: sub.postId,
            emoji: sub.emoji,
            quantity: sub.quantity,
            reactionsBatch: sub.reactionsBatch || null,
            serviceIdOverride: sub.serviceIdOverride
          });

          sub.status = 'submitted';
          sub.deliveryVerified = res.deliveryVerified === true;
          sub.providerStatus = res.providerStatus || res.clustersInfo || 'Processing';
          sub.externalOrderId = res.externalOrderId;
          sub.serviceId = res.serviceId;
          sub.cost = res.cost || 0;
          sub.botsDispatched = res.botsDispatched || null;
          sub.queueInfo = res.queueInfo || null;
          sub.submittedAt = new Date().toISOString();
          sub.error = null;

          campaign.completedTasks += 1;
          campaign.totalReactionsSubmitted += res.deliveryVerified
            ? res.botsDispatched || sub.quantity
            : 0;
          campaign.totalReactionsQueued =
            (campaign.totalReactionsQueued || 0) + (res.deliveryVerified ? 0 : sub.quantity);
          campaign.totalCost = Number((campaign.totalCost + sub.cost).toFixed(2));

          const waveInfo =
            sub.totalWaves > 1 ? ` [Gelombang ${sub.wave}/${sub.totalWaves}]` : '';
          if (res.deliveryVerified === false) {
            this.log(
              'warn',
              `Antrean [${sub.emoji}${sub.quantity > 1 ? ` ×${sub.quantity}` : ''}] untuk Post #${
                sub.postId
              } diterima ${res.gatewayName}${
                res.queueInfo ? ` (${res.queueInfo})` : ''
              }. Gateway gratis hanya membalas "queued" — bukan konfirmasi reaction sudah menempel. Buka postingan untuk memastikan, atau pakai SMM Panel/Direct API dengan API key untuk status pasti.`,
              campaign.id,
              res.rawResponse
            );
          } else if (res.botsDispatched) {
            this.log(
              'success',
              `Terkirim via ${res.gatewayName}: ${res.botsDispatched} akun memproses [${sub.emoji}] ke Post #${sub.postId} (${res.clustersInfo})`,
              campaign.id,
              res.rawResponse
            );
          } else {
            this.log(
              'success',
              `Berhasil kirim ${sub.emoji} × ${sub.quantity}${waveInfo} → Order #${sub.externalOrderId} (Post #${sub.postId})`,
              campaign.id,
              res.rawResponse
            );
          }
          success = true;
          break;
        } catch (err) {
          lastErr = err;
          if (attempt <= maxRetries) {
            this.log(
              'warn',
              `Percobaan ${attempt} gagal untuk ${sub.emoji} × ${sub.quantity}: ${err.message}. Mencoba ulang...`,
              campaign.id
            );
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }

      if (!success) {
        sub.status = 'failed';
        sub.providerStatus = 'Failed';
        sub.error = lastErr ? lastErr.message : 'Gagal mengirim request';
        campaign.failedTasks += 1;
        this.log(
          'error',
          `Gagal kirim ${sub.emoji} × ${sub.quantity} ke Post #${sub.postId}: ${sub.error}`,
          campaign.id
        );
      }

      store.save();
      this.broadcast('campaign_updated', campaign);
      if (provider.lastBalance) {
        this.broadcast('balance_updated', {
          providerId: provider.id,
          lastBalance: provider.lastBalance
        });
      }

      // Jeda antar request bila masih ada item berikutnya
      if (i < orderedSubs.length - 1 && !this.cancelledIds.has(campaignId)) {
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }

    if (campaign.status !== 'cancelled') {
      if (campaign.completedTasks > 0 && campaign.failedTasks === 0) {
        campaign.status = 'completed';
      } else if (campaign.completedTasks > 0 && campaign.failedTasks > 0) {
        campaign.status = 'partial';
      } else {
        campaign.status = 'failed';
      }
      campaign.completedAt = new Date().toISOString();
      store.save();

      const queuedInfo = campaign.totalReactionsQueued
        ? `, ${campaign.totalReactionsQueued} masuk antrean (belum terverifikasi)`
        : '';
      this.log(
        campaign.status === 'failed' ? 'error' : 'info',
        `Kampanye ${campaign.id} selesai (${campaign.totalReactionsSubmitted}/${campaign.totalReactionsTarget} reaction terkonfirmasi terkirim${queuedInfo}).`,
        campaign.id
      );
      this.broadcast('campaign_updated', campaign);
    }

    this.cancelledIds.delete(campaignId);
  }

  /**
   * Sinkronisasi status seluruh sub-order yang sudah terkirim ke SMM Panel
   */
  async refreshCampaignStatuses(campaignId) {
    const campaign = store.getCampaign(campaignId);
    if (!campaign) throw new Error('Kampanye tidak ditemukan.');

    const provider = store.getProvider(campaign.providerId);
    if (!provider) throw new Error('Provider asal kampanye sudah dihapus.');

    let updatedCount = 0;
    for (const sub of campaign.subOrders) {
      if (sub.status === 'submitted' && sub.externalOrderId) {
        try {
          const st = await checkOrderStatus(provider, sub);
          sub.providerStatus = st.providerStatus;
          sub.remains = st.remains;
          sub.startCount = st.startCount;
          updatedCount++;
        } catch (err) {
          sub.lastCheckError = err.message;
        }
      }
    }

    store.save();
    this.broadcast('campaign_updated', campaign);
    this.log(
      'info',
      `Status ${updatedCount} sub-order pada kampanye ${campaign.id} berhasil diperbarui dari API.`,
      campaign.id
    );
    return campaign;
  }
}

module.exports = new CampaignRunner();
