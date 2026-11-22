'use strict';

/**
 * Cache kesehatan pool gateway gratis (Reaction WA).
 * checkFreeGatewaysHealth() di src/freePool.js mem-ping 4 endpoint eksternal
 * (masing-masing timeout 9 detik). Tanpa cache, setiap hit /api/health
 * akan memicu 4 request keluar — mahal & lambat di serverless.
 * Modul ini membungkusnya dengan TTL 30 detik + single-flight
 * (request bersamaan berbagi satu promise yang sama).
 */

const { checkFreeGatewaysHealth } = require('./freePool');

const TTL_MS = Number(process.env.POOL_HEALTH_TTL_MS || 30000);
let cached = null; // { checkedAt, result }
let inflight = null; // Promise

async function getPoolHealth({ force = false } = {}) {
  const now = Date.now();
  if (!force && cached && now - cached.checkedAt < TTL_MS) {
    return { ...cached.result, checkedAt: new Date(cached.checkedAt).toISOString(), cached: true };
  }
  if (!force && inflight) {
    return inflight;
  }

  inflight = (async () => {
    const started = Date.now();
    let result;
    try {
      result = await checkFreeGatewaysHealth();
    } catch (err) {
      result = {
        onlineCount: 0,
        totalCount: 4,
        totalGateways: 4,
        gateways: [],
        error: err.message
      };
    }
    const checkedAt = Date.now();
    cached = { checkedAt, result };
    return {
      ...result,
      checkedAt: new Date(checkedAt).toISOString(),
      latencyMs: checkedAt - started,
      cached: false,
      failover: 'combined_pool',
      note:
        result.onlineCount > 0
          ? `${result.onlineCount}/${result.totalCount} gateway online — failover otomatis aktif.`
          : 'Semua gateway sedang tidak merespons. Coba lagi beberapa saat lagi.'
    };
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

function getCachedOnly() {
  if (!cached) return null;
  return { ...cached.result, checkedAt: new Date(cached.checkedAt).toISOString(), cached: true };
}

module.exports = { getPoolHealth, getCachedOnly, TTL_MS };
