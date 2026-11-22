'use strict';

/**
 * Sentry (opsional) — hanya aktif bila SENTRY_DSN diisi.
 * Tanpa DSN, semua fungsi jadi no-op sehingga app tetap jalan normal
 * di lokal / Vercel tanpa konfigurasi tambahan.
 *
 * Env:
 *   SENTRY_DSN          — DSN project Sentry (backend)
 *   SENTRY_ENVIRONMENT  — nama environment (default: production/development)
 *   SENTRY_TRACES_SAMPLE_RATE — 0..1 (default 0, hanya errors)
 */

let Sentry = null;
let enabled = false;

function initSentry() {
  const dsn = String(process.env.SENTRY_DSN || '').trim();
  if (!dsn) {
    return false;
  }
  try {
    // eslint-disable-next-line global-require
    Sentry = require('@sentry/node');
    const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0);
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || (process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'),
      tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
      // Jangan kirim PII / body request secara default
      sendDefaultPii: false
    });
    enabled = true;
    console.log('[sentry] aktif (backend error tracking)');
    return true;
  } catch (err) {
    console.warn('[sentry] gagal init, lanjut tanpa Sentry:', err.message);
    Sentry = null;
    enabled = false;
    return false;
  }
}

function captureException(err, extra = {}) {
  if (!enabled || !Sentry) return;
  try {
    Sentry.withScope((scope) => {
      if (extra.url) scope.setExtra('url', extra.url);
      if (extra.method) scope.setExtra('method', extra.method);
      if (extra.status) scope.setExtra('status', extra.status);
      Sentry.captureException(err);
    });
  } catch {
    // Abaikan — jangan pernah merusak request karena telemetri
  }
}

function captureMessage(message, level = 'error') {
  if (!enabled || !Sentry) return;
  try {
    Sentry.captureMessage(message, level);
  } catch {
    // Abaikan
  }
}

function isEnabled() {
  return enabled;
}

module.exports = { initSentry, captureException, captureMessage, isEnabled };
