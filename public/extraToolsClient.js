(() => {
  'use strict';

  const H = () =>
    window.D4Tech || {
      toast: (m) => alert(m),
      esc: (s) => String(s ?? ''),
      api: async (u, o) => (await fetch(u, o)).json()
    };

  function roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function wrapLines(ctx, text, maxW) {
    const paras = String(text || '').split('\n');
    const out = [];
    for (const p of paras) {
      const words = p.split(/\s+/).filter(Boolean);
      if (!words.length) {
        out.push('');
        continue;
      }
      let cur = words[0];
      for (let i = 1; i < words.length; i++) {
        const test = `${cur} ${words[i]}`;
        if (ctx.measureText(test).width > maxW) {
          out.push(cur);
          cur = words[i];
        } else {
          cur = test;
        }
      }
      out.push(cur);
    }
    return out;
  }

  function loadImageSafe(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // =========================================================================
  // 1. AI ROASTER & CEK SKOR AURA TIKTOK (+ KARTU CANVAS PNG)
  // =========================================================================
  function initRoaster() {
    const form = document.getElementById('roasterForm');
    const userInp = document.getElementById('roastUserInput');
    const submitBtn = document.getElementById('btnRunRoaster');
    const resBox = document.getElementById('roasterResultBox');
    const canvas = document.getElementById('roastCardCanvas');
    if (!form || !canvas) return;

    let mode = 'savage';
    document.querySelectorAll('[data-roast-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.roastMode;
        document.querySelectorAll('[data-roast-mode]').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
      });
    });

    document.getElementById('btnTryRoastSelf')?.addEventListener('click', () => {
      userInp.value = 'df4tch_';
      form.requestSubmit();
    });

    async function drawRoastCard(data) {
      const ctx = canvas.getContext('2d');
      const p = data.profile;
      const proxyAvatar = p.avatar
        ? `/api/tools/proxy-download?inline=1&url=${encodeURIComponent(p.avatar)}&filename=av.jpg`
        : null;
      const avatarImg = await loadImageSafe(proxyAvatar);

      ctx.font = '600 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const lines = wrapLines(ctx, `"${data.roastText}"`, 760);
      const H_CANVAS = Math.max(540, 340 + lines.length * 38);
      canvas.width = 900;
      canvas.height = H_CANVAS;

      // Gradient Card Background
      const grad = ctx.createLinearGradient(0, 0, 900, H_CANVAS);
      if (data.mode === 'aura') {
        grad.addColorStop(0, '#062c24');
        grad.addColorStop(1, '#0f172a');
      } else if (data.mode === 'savage') {
        grad.addColorStop(0, '#2b0912');
        grad.addColorStop(1, '#0f172a');
      } else {
        grad.addColorStop(0, '#172554');
        grad.addColorStop(1, '#0f172a');
      }
      roundRect(ctx, 0, 0, 900, H_CANVAS, 34);
      ctx.fillStyle = grad;
      ctx.fill();

      // Subtle glow border
      ctx.lineWidth = 4;
      ctx.strokeStyle =
        data.mode === 'aura' ? '#10b981' : data.mode === 'savage' ? '#f43f5e' : '#38bdf8';
      ctx.stroke();

      // Avatar circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(102, 106, 52, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      if (avatarImg) {
        ctx.drawImage(avatarImg, 50, 54, 104, 104);
      } else {
        ctx.fillStyle = '#10b981';
        ctx.fillRect(50, 54, 104, 104);
      }
      ctx.restore();

      // User Info
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.nickname || p.username, 176, 92);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(
        `@${p.username}  •  ${Number(p.stats.followers).toLocaleString('id-ID')} Pengikut  •  ${Number(p.stats.likes).toLocaleString('id-ID')} Likes`,
        176,
        128
      );

      // Aura Score Pill
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      roundRect(ctx, 50, 182, 800, 62, 18);
      ctx.fill();

      ctx.fillStyle = '#34d399';
      ctx.font = '800 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(`${data.auraTier}  —  ${data.auraScore}`, 76, 221);

      // Roast Quote Box
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      lines.forEach((ln, idx) => {
        ctx.fillText(ln, 58, 298 + idx * 38);
      });

      // Footer Brand
      ctx.fillStyle = '#64748b';
      ctx.font = '700 19px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('D4Tech Hub • TikTok @df4tch_', 848, H_CANVAS - 28);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { api, toast } = H();
      const username = userInp.value.trim();
      if (!username) return;

      const prev = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Menganalisis Profil...';

      try {
        const res = await api('/api/tools/roast-tiktok', {
          method: 'POST',
          body: JSON.stringify({ username, mode })
        });
        resBox.classList.remove('hidden');
        await drawRoastCard(res.result);
        toast('Kartu evaluasi berhasil dibuat.');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = prev;
      }
    });

    document.getElementById('btnDownloadRoastCard')?.addEventListener('click', () => {
      const { toast } = H();
      const a = document.createElement('a');
      a.download = `d4tech-roast-${Date.now()}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
      toast('Kartu PNG diunduh.');
    });
  }

  // =========================================================================
  // 2. AI PENJERNIH FOTO HD (REMINI) + BEFORE/AFTER SLIDER
  // =========================================================================
  function initRemini() {
    const fileInp = document.getElementById('reminiFileInput');
    const drop = document.getElementById('reminiDropzone');
    const dropTitle = document.getElementById('reminiDropTitle');
    const actRow = document.getElementById('reminiActionRow');
    const runBtn = document.getElementById('btnRunRemini');
    const changeBtn = document.getElementById('btnReminiChange');
    const stage = document.getElementById('reminiResultStage');
    const beforeImg = document.getElementById('reminiBeforeImg');
    const afterImg = document.getElementById('reminiAfterImg');
    const afterLayer = document.getElementById('reminiAfterLayer');
    const slider = document.getElementById('reminiCompareSlider');
    const dlBtn = document.getElementById('btnDownloadRemini');
    if (!drop || !fileInp) return;

    let currentBase64 = null;
    let lastHdDataUrl = null;

    function prepareImg(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Gagal membaca foto.'));
        reader.onload = () => {
          const im = new Image();
          im.onload = () => {
            const MAX = 1024;
            let w = im.width;
            let h = im.height;
            if (w > MAX || h > MAX) {
              const r = Math.min(MAX / w, MAX / h);
              w = Math.round(w * r);
              h = Math.round(h * r);
            }
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            c.getContext('2d').drawImage(im, 0, 0, w, h);
            resolve(c.toDataURL('image/jpeg', 0.9));
          };
          im.onerror = () => reject(new Error('Format foto tidak didukung.'));
          im.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    drop.addEventListener('click', () => fileInp.click());
    changeBtn?.addEventListener('click', () => fileInp.click());

    fileInp.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const { toast } = H();
      try {
        currentBase64 = await prepareImg(f);
        dropTitle.textContent = `Berkas dipilih: ${f.name}`;
        actRow.classList.remove('hidden');
        toast('Foto siap diproses.');
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    slider?.addEventListener('input', () => {
      const v = Number(slider.value);
      if (afterLayer) afterLayer.style.clipPath = `inset(0 0 0 ${v}%)`;
    });

    runBtn?.addEventListener('click', async () => {
      const { api, toast } = H();
      if (!currentBase64) return;
      const prev = runBtn.innerHTML;
      runBtn.disabled = true;
      runBtn.innerHTML = '<span class="spinner"></span> Memproses Restorasi HD (6–15 dtk)...';

      try {
        const res = await api('/api/tools/remini', {
          method: 'POST',
          body: JSON.stringify({ imageBase64: currentBase64 })
        });
        beforeImg.src = currentBase64;
        afterImg.src = res.resultDataUrl;
        lastHdDataUrl = res.resultDataUrl;
        dlBtn.href = res.resultDataUrl;
        slider.value = 50;
        afterLayer.style.clipPath = 'inset(0 0 0 50%)';
        stage.classList.remove('hidden');
        toast('Restorasi HD selesai. Geser slider untuk membandingkan.');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = prev;
      }
    });

    document.getElementById('btnChainReminiToBg')?.addEventListener('click', () => {
      const { toast } = H();
      if (!lastHdDataUrl) {
        toast('Proses restorasi foto terlebih dahulu sebelum lanjut hapus background.', 'error');
        return;
      }
      if (window.D4TechTools?.openRemoveBgWithDataUrl) {
        window.D4TechTools.openRemoveBgWithDataUrl(lastHdDataUrl, 'Hasil Restorasi HD');
      }
    });
  }

  // =========================================================================
  // 3. AI IMAGE GENERATOR (TEXT TO IMAGE HD)
  // =========================================================================
  function initAiImage() {
    const form = document.getElementById('aiImageForm');
    const promptInp = document.getElementById('aiPromptInput');
    const styleSel = document.getElementById('aiStyleSelect');
    const ratioSel = document.getElementById('aiRatioSelect');
    const btn = document.getElementById('btnRunAiImage');
    const resBox = document.getElementById('aiImageResult');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { api, esc, toast } = H();
      const prompt = promptInp.value.trim();
      if (!prompt) return;

      const prev = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Merender Citra HD...';
      resBox.classList.remove('hidden');
      resBox.innerHTML = `<div class="result-card-clean" style="text-align:center; color:var(--text-muted);"><span class="spinner" style="vertical-align:middle;margin-right:6px;"></span> Menyintesis gambar resolusi tinggi...</div>`;

      try {
        const data = await api('/api/tools/ai-image', {
          method: 'POST',
          body: JSON.stringify({
            prompt,
            style: styleSel.value,
            ratio: ratioSel.value
          })
        });
        const r = data.result;
        resBox.innerHTML = `
          <div class="result-card-clean" style="text-align:center;">
            <img src="${esc(r.imageDataUrl)}" alt="AI Image" style="max-width:100%; max-height:540px; border-radius:var(--radius-md); border:1px solid var(--border);" />
            <div style="margin-top:0.75rem; display:flex; justify-content:center; gap:0.55rem; flex-wrap:wrap;">
              <a href="${esc(r.imageDataUrl)}" download="d4tech-ai-art-${r.seed}.jpg" class="btn btn-primary btn-sm">
                Unduh Gambar (${r.width}\u00d7${r.height})
              </a>
              <button type="button" class="btn btn-secondary btn-sm" id="btnRegenAiArt">Buat Variasi Lain</button>
            </div>
          </div>
        `;
        document.getElementById('btnRegenAiArt')?.addEventListener('click', () => form.requestSubmit());
        toast('Gambar selesai dibuat.');
      } catch (err) {
        resBox.innerHTML = `<div class="result-card-clean" style="color:var(--danger); font-weight:600;">${esc(err.message)}</div>`;
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = prev;
      }
    });
  }

  // =========================================================================
  // 4. STUDIO AUDIO 8D, SLOWED + REVERB, NIGHTCORE & BASS BOOSTER
  // =========================================================================
  function initAudioStudio() {
    const fileInp = document.getElementById('audioStudioFile');
    const drop = document.getElementById('audioStudioDropzone');
    const titleEl = document.getElementById('audioStudioTitle');
    const controls = document.getElementById('audioStudioControls');
    const playBtn = document.getElementById('btnAudioPlayPause');
    const changeBtn = document.getElementById('btnAudioChangeFile');
    const exportBtn = document.getElementById('btnExportAudioWav');
    const presetLabel = document.getElementById('audioPresetLabel');
    const vizCanvas = document.getElementById('audioVizCanvas');
    if (!drop || !fileInp || !vizCanvas) return;

    let audioCtx = null;
    let decodedBuffer = null;
    let activeNodes = null;
    let isPlaying = false;
    let currentFx = '8d';
    let animId = null;
    let rawFileName = 'lagu';

    function makeReverbImpulse(ctx, seconds = 2.2, decay = 2.4) {
      const rate = ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const impulse = ctx.createBuffer(2, len, rate);
      for (let c = 0; c < 2; c++) {
        const ch = impulse.getChannelData(c);
        for (let i = 0; i < len; i++) {
          ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
      }
      return impulse;
    }

    function buildAudioGraph(ctx, buffer, fxMode, withAnalyser = false) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;

      const dryGain = ctx.createGain();
      const masterOut = ctx.createGain();
      masterOut.gain.value = 0.92;

      let lfo = null;

      if (fxMode === '8d') {
        src.playbackRate.value = 1.0;
        const panner = ctx.createStereoPanner();
        lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.16; // 1 putaran tiap ~6.2 detik
        lfoGain.gain.value = 0.92;
        lfo.connect(lfoGain);
        lfoGain.connect(panner.pan);

        const conv = ctx.createConvolver();
        conv.buffer = makeReverbImpulse(ctx, 1.3, 3.0);
        const wet = ctx.createGain();
        wet.gain.value = 0.22;

        src.connect(panner);
        panner.connect(dryGain);
        dryGain.gain.value = 0.88;
        dryGain.connect(masterOut);

        panner.connect(conv);
        conv.connect(wet);
        wet.connect(masterOut);
      } else if (fxMode === 'slowed') {
        src.playbackRate.value = 0.84;
        const conv = ctx.createConvolver();
        conv.buffer = makeReverbImpulse(ctx, 2.6, 2.2);
        const wet = ctx.createGain();
        wet.gain.value = 0.38;
        dryGain.gain.value = 0.78;

        src.connect(dryGain);
        dryGain.connect(masterOut);
        src.connect(conv);
        conv.connect(wet);
        wet.connect(masterOut);
      } else if (fxMode === 'nightcore') {
        src.playbackRate.value = 1.22;
        const hiBoost = ctx.createBiquadFilter();
        hiBoost.type = 'highshelf';
        hiBoost.frequency.value = 3500;
        hiBoost.gain.value = 3.5;
        src.connect(hiBoost);
        hiBoost.connect(masterOut);
      } else {
        // Bass Booster
        src.playbackRate.value = 1.0;
        const bass = ctx.createBiquadFilter();
        bass.type = 'lowshelf';
        bass.frequency.value = 90;
        bass.gain.value = 10.5;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 6;
        src.connect(bass);
        bass.connect(comp);
        comp.connect(masterOut);
      }

      let analyser = null;
      if (withAnalyser) {
        analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        masterOut.connect(analyser);
        analyser.connect(ctx.destination);
      } else {
        masterOut.connect(ctx.destination);
      }

      return { src, lfo, analyser };
    }

    function stopPlayback() {
      if (activeNodes) {
        try {
          activeNodes.src.stop();
          activeNodes.lfo?.stop();
        } catch (_) {}
        activeNodes = null;
      }
      if (animId) cancelAnimationFrame(animId);
      isPlaying = false;
      if (playBtn) playBtn.innerHTML = 'Putar Pratinjau';
    }

    function drawVisualizer(analyser) {
      const vCtx = vizCanvas.getContext('2d');
      const bins = new Uint8Array(analyser.frequencyBinCount);

      const frame = () => {
        if (!isPlaying) return;
        animId = requestAnimationFrame(frame);
        analyser.getByteFrequencyData(bins);

        vCtx.fillStyle = '#0d1117';
        vCtx.fillRect(0, 0, vizCanvas.width, vizCanvas.height);

        const barCount = 48;
        const gap = 3;
        const barW = (vizCanvas.width - gap * (barCount - 1)) / barCount;

        for (let i = 0; i < barCount; i++) {
          const val = bins[i] || 5;
          const h = Math.max(4, (val / 255) * (vizCanvas.height - 14));
          const x = i * (barW + gap);
          const y = vizCanvas.height - h;
          vCtx.fillStyle = '#12b76a';
          roundRect(vCtx, x, y, barW, h, 2);
          vCtx.fill();
        }
      };
      frame();
    }

    function startPlayback() {
      if (!decodedBuffer) return;
      stopPlayback();
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const graph = buildAudioGraph(audioCtx, decodedBuffer, currentFx, true);
      activeNodes = graph;
      graph.lfo?.start(0);
      graph.src.start(0);
      isPlaying = true;
      playBtn.innerHTML = 'Hentikan';
      drawVisualizer(graph.analyser);

      graph.src.onended = () => {
        stopPlayback();
      };
    }

    function audioBufferToWavBlob(buffer) {
      const numCh = buffer.numberOfChannels;
      const sampleRate = buffer.sampleRate;
      const samples = buffer.length;
      const bytesPerSample = 2;
      const blockAlign = numCh * bytesPerSample;
      const dataSize = samples * blockAlign;
      const ab = new ArrayBuffer(44 + dataSize);
      const view = new DataView(ab);

      const writeStr = (off, str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
      };

      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numCh, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, dataSize, true);

      const channels = [];
      for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));

      let offset = 44;
      for (let i = 0; i < samples; i++) {
        for (let c = 0; c < numCh; c++) {
          const s = Math.max(-1, Math.min(1, channels[c][i]));
          view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
          offset += 2;
        }
      }
      return new Blob([ab], { type: 'audio/wav' });
    }

    drop.addEventListener('click', () => fileInp.click());
    changeBtn?.addEventListener('click', () => fileInp.click());

    fileInp.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const { toast } = H();
      stopPlayback();
      titleEl.textContent = `Mendekode berkas audio: ${f.name}...`;

      try {
        rawFileName = f.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const arr = await f.arrayBuffer();
        decodedBuffer = await audioCtx.decodeAudioData(arr);
        titleEl.textContent = `Berkas dimuat: ${f.name} (${Math.round(decodedBuffer.duration)} dtk)`;
        controls.classList.remove('hidden');
        toast('Audio siap diputar.');
      } catch {
        titleEl.textContent = 'Gagal membaca berkas audio. Gunakan MP3 / WAV / M4A standar.';
        toast('Format audio tidak dapat didekode.', 'error');
      }
    });

    document.querySelectorAll('[data-audio-fx]').forEach((card) => {
      card.addEventListener('click', () => {
        currentFx = card.dataset.audioFx;
        document.querySelectorAll('[data-audio-fx]').forEach((c) =>
          c.classList.toggle('active', c === card)
        );
        const names = {
          '8d': '8D Spatial Aktif',
          slowed: 'Slowed + Reverb Aktif',
          nightcore: 'Nightcore Aktif',
          bass: 'Sub-Bass Boost Aktif'
        };
        if (presetLabel) presetLabel.textContent = names[currentFx] || currentFx;
        if (isPlaying) startPlayback();
      });
    });

    playBtn?.addEventListener('click', () => {
      if (isPlaying) stopPlayback();
      else startPlayback();
    });

    exportBtn?.addEventListener('click', async () => {
      const { toast } = H();
      if (!decodedBuffer) return;
      const prev = exportBtn.innerHTML;
      exportBtn.disabled = true;
      exportBtn.innerHTML = '<span class="spinner"></span> Merender WAV...';

      try {
        const rateRatio =
          currentFx === 'slowed' ? 0.84 : currentFx === 'nightcore' ? 1.22 : 1.0;
        const outDuration = decodedBuffer.duration / rateRatio + 1.8;
        const outRate = 44100;
        const offline = new OfflineAudioContext(2, Math.ceil(outDuration * outRate), outRate);
        const graph = buildAudioGraph(offline, decodedBuffer, currentFx, false);
        graph.lfo?.start(0);
        graph.src.start(0);

        const rendered = await offline.startRendering();
        const wavBlob = audioBufferToWavBlob(rendered);
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${rawFileName}_${currentFx}_D4TechHub.wav`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 15000);
        toast(`Berkas WAV (${currentFx.toUpperCase()}) diunduh.`);
      } catch {
        toast('Gagal merender audio.', 'error');
      } finally {
        exportBtn.disabled = false;
        exportBtn.innerHTML = prev;
      }
    });

    window.D4TechExtra = Object.assign(window.D4TechExtra || {}, {
      loadUrlIntoAudioStudio: async (audioUrl, label = 'Audio D4Tech') => {
        const { toast, switchView } = H();
        if (typeof switchView === 'function') switchView('audiostudio');
        stopPlayback();
        titleEl.textContent = `Memuat audio ke Studio DSP: ${label}...`;
        try {
          rawFileName = String(label || 'd4tech_audio')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 50) || 'd4tech_audio';
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const resp = await fetch(audioUrl);
          if (!resp.ok) throw new Error('Gagal mengunduh stream audio.');
          const arr = await resp.arrayBuffer();
          decodedBuffer = await audioCtx.decodeAudioData(arr);
          titleEl.textContent = `Berkas dimuat: ${label} (${Math.round(decodedBuffer.duration)} dtk)`;
          controls.classList.remove('hidden');
          toast('Audio dimuat ke Studio 8D.');
        } catch (err) {
          titleEl.textContent = 'Gagal memuat stream otomatis. Silakan unduh MP3 lalu muat manual.';
          toast(err.message || 'Gagal memuat audio ke Studio 8D.', 'error');
        }
      }
    });
  }

  // =========================================================================
  // 5. STUDIO NARATOR DRACIN + BGM, GEMINI AI & MULTI-BAHASA TTS MP3
  // =========================================================================
  function initTts() {
    const form = document.getElementById('ttsForm');
    const txtInp = document.getElementById('ttsTextInput');
    const langSel = document.getElementById('ttsLangSelect');
    const speedSel = document.getElementById('ttsSpeedSelect');
    const musicSel = document.getElementById('ttsMusicSelect');
    const dracinControls = document.getElementById('ttsDracinControls');
    const langWrap = document.getElementById('ttsLangWrap');
    const btn = document.getElementById('btnRunTts');
    const resBox = document.getElementById('ttsResultBox');
    if (!form) return;

    let engine = 'dracin';

    document.querySelectorAll('[data-tts-engine]').forEach((tab) => {
      tab.addEventListener('click', () => {
        engine = tab.dataset.ttsEngine;
        document.querySelectorAll('[data-tts-engine]').forEach((t) =>
          t.classList.toggle('active', t === tab)
        );
        dracinControls?.classList.toggle('hidden', engine !== 'dracin');
        langWrap?.classList.toggle('hidden', engine !== 'google');
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { api, esc, toast } = H();
      const text = txtInp.value.trim();
      if (!text) return;

      const prev = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML =
        engine === 'dracin'
          ? '<span class="spinner"></span> Merender Narator Dracin + BGM (4–12 dtk)...'
          : '<span class="spinner"></span> Merender Audio Narator MP3...';

      try {
        const data = await api('/api/tools/tts', {
          method: 'POST',
          body: JSON.stringify({
            text,
            engine,
            lang: langSel?.value || 'id',
            speed: Number(speedSel?.value || 1.0),
            music: musicSel ? musicSel.value === 'true' : true
          })
        });
        const r = data.result;
        const safeEngineSlug = String(r.engine || 'tts').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        resBox.classList.remove('hidden');
        resBox.innerHTML = `
          <div class="result-card-clean mt-md">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem; margin-bottom:0.5rem;">
              <span style="font-weight:700; font-size:0.86rem;">Audio Narator Siap (${r.charCount} karakter)</span>
              <span class="free-badge">${esc(r.engine || 'Narator HD')}</span>
            </div>
            <audio controls src="${esc(r.audioDataUrl)}" style="width:100%; height:40px;"></audio>
            <div class="dl-actions-wrap">
              <a href="${esc(r.audioDataUrl)}" download="d4tech-narator-${esc(safeEngineSlug)}.mp3" class="btn btn-primary btn-sm">
                Unduh MP3 Narator
              </a>
              <button type="button" class="btn btn-secondary btn-sm" id="btnSendTtsTo8d">
                Buka di Studio Audio 8D &rarr;
              </button>
            </div>
          </div>
        `;
        document.getElementById('btnSendTtsTo8d')?.addEventListener('click', () => {
          window.D4TechExtra?.loadUrlIntoAudioStudio?.(r.audioDataUrl, 'Narator_Dracin_D4Tech');
        });
        toast(`${r.engine || 'Audio narator'} siap diunduh.`);
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = prev;
      }
    });
  }

  // =========================================================================
  // 6. GENERATOR STRUK ESTETIK (RECEIPTIFY) & KARTU LIRIK LAGU
  // =========================================================================
  function initReceiptAndLyrics() {
    const canvas = document.getElementById('rcpCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let mode = 'receipt';

    function drawReceipt() {
      const store = document.getElementById('rcpStoreName')?.value || 'D4TECH PLAYLIST MART';
      const customer = document.getElementById('rcpCustomer')?.value || '@df4tch_';
      const rawItems = document.getElementById('rcpItemsText')?.value || '';
      const paper = document.getElementById('rcpPaperTheme')?.value || 'classic';

      const items = rawItems
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line, i) => {
          const [left, right] = line.split('|').map((s) => s.trim());
          return { qty: String(i + 1).padStart(2, '0'), name: left || 'ITEM', val: right || '03:00' };
        });

      const W = 680;
      const H_CANVAS = Math.max(820, 470 + items.length * 46);
      canvas.width = W;
      canvas.height = H_CANVAS;
      ctx.clearRect(0, 0, W, H_CANVAS);

      const bgMap = { classic: '#fafaf9', kraft: '#efe3ce', pink: '#fdf2f8' };
      const mx = 44;
      const my = 32;
      const pw = W - mx * 2;
      const ph = H_CANVAS - my * 2;

      ctx.save();
      ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;

      // Zig-zag thermal paper path
      ctx.beginPath();
      const zig = 14;
      ctx.moveTo(mx, my + 10);
      for (let x = mx; x < mx + pw; x += zig) {
        ctx.lineTo(x + zig / 2, my);
        ctx.lineTo(Math.min(x + zig, mx + pw), my + 10);
      }
      ctx.lineTo(mx + pw, my + ph - 10);
      for (let x = mx + pw; x > mx; x -= zig) {
        ctx.lineTo(x - zig / 2, my + ph);
        ctx.lineTo(Math.max(x - zig, mx), my + ph - 10);
      }
      ctx.closePath();
      ctx.fillStyle = bgMap[paper] || '#fafaf9';
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#18181b';
      ctx.textAlign = 'center';
      ctx.font = '900 32px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx.fillText(store.toUpperCase(), W / 2, my + 74);

      ctx.font = '600 17px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx.fillStyle = '#52525b';
      ctx.fillText(`ORDER #D4-${new Date().getFullYear()} • PELANGGAN: ${customer}`, W / 2, my + 108);
      ctx.fillText(new Date().toLocaleDateString('id-ID', { dateStyle: 'full' }), W / 2, my + 134);

      const dashLine = (y) => {
        ctx.fillStyle = '#71717a';
        ctx.font = '700 18px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('--------------------------------------------', W / 2, y);
      };

      dashLine(my + 166);

      ctx.font = '700 18px ui-monospace, monospace';
      ctx.fillStyle = '#18181b';
      ctx.textAlign = 'left';
      ctx.fillText('NO  ITEM / JUDUL', mx + 36, my + 198);
      ctx.textAlign = 'right';
      ctx.fillText('DURASI', mx + pw - 36, my + 198);

      dashLine(my + 224);

      let y = my + 262;
      let totalSec = 0;
      items.forEach((it) => {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#18181b';
        ctx.font = '700 19px ui-monospace, monospace';
        ctx.fillText(`${it.qty}  ${it.name.slice(0, 29)}`, mx + 36, y);
        ctx.textAlign = 'right';
        ctx.fillText(it.val, mx + pw - 36, y);

        const m = it.val.match(/^(\d+):(\d{2})$/);
        if (m) totalSec += Number(m[1]) * 60 + Number(m[2]);
        y += 44;
      });

      dashLine(y + 6);

      const totMin = Math.floor(totalSec / 60);
      const totRem = String(totalSec % 60).padStart(2, '0');
      ctx.textAlign = 'left';
      ctx.fillStyle = '#18181b';
      ctx.font = '800 20px ui-monospace, monospace';
      ctx.fillText(`TOTAL ITEM: ${items.length}`, mx + 36, y + 42);
      ctx.textAlign = 'right';
      ctx.fillText(totalSec > 0 ? `${totMin}:${totRem}` : 'LUNAS', mx + pw - 36, y + 42);

      dashLine(y + 72);

      // 1D Barcode
      const barY = y + 96;
      let bx = mx + 95;
      ctx.fillStyle = '#18181b';
      for (let i = 0; i < 62; i++) {
        const w = (i * 7 + store.length) % 3 === 0 ? 5 : 2;
        ctx.fillRect(bx, barY, w, 58);
        bx += w + ((i % 2) + 2);
      }

      ctx.textAlign = 'center';
      ctx.font = '700 16px ui-monospace, monospace';
      ctx.fillStyle = '#52525b';
      ctx.fillText('TERIMA KASIH • D4TECH HUB (@df4tch_)', W / 2, barY + 86);
    }

    function drawLyricsCard() {
      const song = document.getElementById('lyrSongTitle')?.value || 'Judul Lagu';
      const artist = document.getElementById('lyrArtistName')?.value || 'Nama Penyanyi';
      const quote = document.getElementById('lyrQuoteText')?.value || '';
      const theme = document.getElementById('lyrCardTheme')?.value || 'emerald';

      const palettes = {
        emerald: ['#064e3b', '#022c22', '#34d399'],
        crimson: ['#7f1d1d', '#3b0712', '#fda4af'],
        ocean: ['#0c4a6e', '#082f49', '#7dd3fc'],
        obsidian: ['#18181b', '#09090b', '#e4e4e7']
      };
      const [c1, c2, accent] = palettes[theme] || palettes.emerald;

      ctx.font = '800 38px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const lines = wrapLines(ctx, quote, 620);
      const W = 760;
      const H_CANVAS = Math.max(620, 290 + lines.length * 54);
      canvas.width = W;
      canvas.height = H_CANVAS;

      const grad = ctx.createLinearGradient(0, 0, W, H_CANVAS);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      roundRect(ctx, 0, 0, W, H_CANVAS, 38);
      ctx.fillStyle = grad;
      ctx.fill();

      // Header Song + Artist
      ctx.fillStyle = accent;
      roundRect(ctx, 56, 56, 54, 54, 14);
      ctx.fill();
      ctx.fillStyle = c2;
      ctx.font = '900 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♫', 83, 93);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(song.slice(0, 38), 128, 80);

      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(artist, 128, 108);

      // Lyrics Body
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 37px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      lines.forEach((ln, idx) => {
        ctx.fillText(ln, 58, 198 + idx * 54);
      });

      // Footer Brand
      ctx.fillStyle = accent;
      ctx.font = '800 19px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText('♪ D4Tech Hub Lyrics  •  @df4tch_', 58, H_CANVAS - 46);
    }

    function redraw() {
      if (mode === 'receipt') drawReceipt();
      else drawLyricsCard();
    }

    document.querySelectorAll('[data-rcp-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.rcpMode;
        document.querySelectorAll('[data-rcp-mode]').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        document.getElementById('rcpReceiptControls')?.classList.toggle('hidden', mode !== 'receipt');
        document.getElementById('rcpLyricsControls')?.classList.toggle('hidden', mode !== 'lyrics');
        redraw();
      });
    });

    [
      'rcpStoreName',
      'rcpCustomer',
      'rcpItemsText',
      'rcpPaperTheme',
      'lyrSongTitle',
      'lyrArtistName',
      'lyrQuoteText',
      'lyrCardTheme'
    ].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', redraw);
      document.getElementById(id)?.addEventListener('change', redraw);
    });

    document.getElementById('btnSearchLyrics')?.addEventListener('click', async () => {
      const { api, esc, toast } = H();
      const q = document.getElementById('lyrSearchInput')?.value.trim() || '';
      const listBox = document.getElementById('lyrSearchList');
      if (!q || !listBox) return;

      listBox.classList.remove('hidden');
      listBox.innerHTML = `<div class="preview-box">🔍 Mencari lirik lagu...</div>`;

      try {
        const res = await api('/api/tools/lyrics', {
          method: 'POST',
          body: JSON.stringify({ query: q })
        });
        listBox.innerHTML = res.items
          .map(
            (it, idx) => `
          <div class="hop-row" style="justify-content:space-between; margin-bottom:0.35rem;">
            <span><strong>${esc(it.title)}</strong> — ${esc(it.artist)}</span>
            <button type="button" class="btn btn-primary btn-sm" data-pick-lyr="${idx}">Pakai Lirik</button>
          </div>
        `
          )
          .join('');

        listBox.querySelectorAll('[data-pick-lyr]').forEach((b) => {
          b.addEventListener('click', () => {
            const picked = res.items[Number(b.dataset.pickLyr)];
            document.getElementById('lyrSongTitle').value = picked.title;
            document.getElementById('lyrArtistName').value = picked.artist;
            const snippet = picked.plainLyrics
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 4)
              .join('\n');
            document.getElementById('lyrQuoteText').value = snippet;
            listBox.classList.add('hidden');
            redraw();
            toast('Lirik dimuat ke kartu! Kamu bebas mengedit baris favoritmu.');
          });
        });
      } catch (err) {
        listBox.innerHTML = `<div class="preview-box" style="color:var(--danger);">${esc(err.message)}</div>`;
      }
    });

    document.getElementById('btnDownloadRcpCanvas')?.addEventListener('click', () => {
      const { toast } = H();
      const a = document.createElement('a');
      a.download = `d4tech-${mode}-${Date.now()}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
      toast('Gambar HD berhasil diunduh!');
    });

    redraw();
  }

  // =========================================================================
  // 7. DETEKTIF USERNAME OSINT SCANNER (16 PLATFORM)
  // =========================================================================
  function initOsint() {
    const form = document.getElementById('osintForm');
    const inp = document.getElementById('osintUsernameInput');
    const btn = document.getElementById('btnRunOsint');
    const resBox = document.getElementById('osintResultBox');
    if (!form) return;

    document.getElementById('btnTryOsintD4')?.addEventListener('click', () => {
      inp.value = 'df4tch_';
      form.requestSubmit();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { api, esc, toast } = H();
      const username = inp.value.trim();
      if (!username) return;

      const prev = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Memindai 16 Platform...';
      resBox.classList.remove('hidden');
      resBox.innerHTML = `<div class="result-card-clean" style="text-align:center;"><span class="spinner" style="vertical-align:middle;margin-right:6px;"></span> Memeriksa ketersediaan username <strong>@${esc(username)}</strong>...</div>`;

      try {
        const data = await api('/api/tools/osint', {
          method: 'POST',
          body: JSON.stringify({ username })
        });
        const r = data.result;
        resBox.innerHTML = `
          <div class="result-card-clean">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
              <div style="font-weight:700; font-size:0.92rem;">
                Hasil Pemindaian: <span class="text-brand">@${esc(r.username)}</span>
              </div>
              <span class="free-badge">${r.foundCount} / ${r.totalScanned} Platform Terdeteksi</span>
            </div>
            <div class="osint-grid">
              ${r.results
                .map((it) => {
                  const isFound = it.status === 'found';
                  return `
                    <a href="${esc(it.profileUrl)}" target="_blank" rel="noopener noreferrer" class="osint-card ${isFound ? 'found' : 'miss'}">
                      <div>
                        <div style="font-weight:700; font-size:0.83rem;">${esc(it.platform)}</div>
                        <div style="font-size:0.7rem; color:var(--text-muted);">${esc(it.category)}</div>
                      </div>
                      <span style="font-size:0.73rem; font-weight:700;">
                        ${isFound ? 'Ditemukan &nearr;' : '&mdash;'}
                      </span>
                    </a>
                  `;
                })
                .join('')}
            </div>
          </div>
        `;
        toast(`Pemindaian selesai (${r.foundCount} platform terdeteksi).`);
      } catch (err) {
        resBox.innerHTML = `<div class="result-card-clean" style="color:var(--danger);">${esc(err.message)}</div>`;
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = prev;
      }
    });
  }

  // =========================================================================
  // 8. PIXEL VAULT — STEGANOGRAFI PESAN RAHASIA DI FOTO (LSB + SHA-256 XOR)
  // =========================================================================
  function initPixelVault() {
    const encBox = document.getElementById('pvEncodeBox');
    const decBox = document.getElementById('pvDecodeBox');
    const canvas = document.getElementById('pvHiddenCanvas');
    if (!encBox || !canvas) return;

    document.querySelectorAll('[data-pv-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = btn.dataset.pvMode;
        document.querySelectorAll('[data-pv-mode]').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        encBox.classList.toggle('hidden', m !== 'encode');
        decBox.classList.toggle('hidden', m !== 'decode');
      });
    });

    async function xorWithPassword(bytes, password) {
      if (!password) return bytes;
      const enc = new TextEncoder();
      const keySeed = await crypto.subtle.digest('SHA-256', enc.encode(password));
      const keyArr = new Uint8Array(keySeed);
      const out = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        out[i] = bytes[i] ^ keyArr[i % keyArr.length];
      }
      return out;
    }

    document.getElementById('btnPvEncode')?.addEventListener('click', async () => {
      const { toast } = H();
      const file = document.getElementById('pvSourceImg')?.files?.[0];
      const secret = document.getElementById('pvSecretText')?.value || '';
      const pass = document.getElementById('pvPassEncode')?.value || '';

      if (!file) return toast('Pilih foto pembawa terlebih dahulu.', 'error');
      if (!secret.trim()) return toast('Tulis pesan rahasia terlebih dahulu.', 'error');

      const url = URL.createObjectURL(file);
      const img = await loadImageSafe(url);
      URL.revokeObjectURL(url);
      if (!img) return toast('Gagal memuat gambar.', 'error');

      const MAX = 1400;
      let w = img.width;
      let h = img.height;
      if (w > MAX || h > MAX) {
        const r = Math.min(MAX / w, MAX / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const imgData = ctx.getImageData(0, 0, w, h);
      const pixels = imgData.data;

      const rawTextBytes = new TextEncoder().encode(secret);
      const cipherBytes = await xorWithPassword(rawTextBytes, pass);

      // Header: "D4PV" (4 bytes) + flag password (1 byte) + length (4 bytes) + payload
      const packet = new Uint8Array(9 + cipherBytes.length);
      packet[0] = 68; // D
      packet[1] = 52; // 4
      packet[2] = 80; // P
      packet[3] = 86; // V
      packet[4] = pass ? 1 : 0;
      const dv = new DataView(packet.buffer);
      dv.setUint32(5, cipherBytes.length, false);
      packet.set(cipherBytes, 9);

      const totalBits = packet.length * 8;
      const maxBits = Math.floor((pixels.length / 4) * 3);
      if (totalBits > maxBits) {
        return toast('Pesan terlalu panjang untuk ukuran foto ini. Gunakan foto lebih besar.', 'error');
      }

      let bitIdx = 0;
      for (let p = 0; p < pixels.length && bitIdx < totalBits; p++) {
        if ((p + 1) % 4 === 0) continue; // Skip alpha channel
        const bytePos = bitIdx >> 3;
        const bitOffset = 7 - (bitIdx & 7);
        const bit = (packet[bytePos] >> bitOffset) & 1;
        pixels[p] = (pixels[p] & 0xfe) | bit;
        bitIdx++;
      }

      ctx.putImageData(imgData, 0, 0);
      const a = document.createElement('a');
      a.download = `d4tech-pixelvault-${Date.now()}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
      toast('Pesan rahasia berhasil disembunyikan ke dalam foto PNG!');
    });

    document.getElementById('btnPvDecode')?.addEventListener('click', async () => {
      const { esc, toast } = H();
      const file = document.getElementById('pvStegoImg')?.files?.[0];
      const pass = document.getElementById('pvPassDecode')?.value || '';
      const outBox = document.getElementById('pvDecodedOutput');

      if (!file) return toast('Pilih foto PNG Pixel Vault terlebih dahulu.', 'error');

      const url = URL.createObjectURL(file);
      const img = await loadImageSafe(url);
      URL.revokeObjectURL(url);
      if (!img) return toast('Gagal membaca gambar.', 'error');

      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, img.width, img.height).data;

      let channelCursor = 0;
      const readByte = () => {
        let val = 0;
        for (let b = 0; b < 8; b++) {
          while ((channelCursor + 1) % 4 === 0) channelCursor++;
          if (channelCursor >= pixels.length) return 0;
          val = (val << 1) | (pixels[channelCursor] & 1);
          channelCursor++;
        }
        return val;
      };

      const header = [readByte(), readByte(), readByte(), readByte()];
      if (header[0] !== 68 || header[1] !== 52 || header[2] !== 80 || header[3] !== 86) {
        outBox.classList.remove('hidden');
        outBox.innerHTML = `<div class="risk-banner high">Tidak ditemukan muatan Pixel Vault pada berkas ini. Pastikan berkas berformat PNG asli dan tidak terkompresi ulang.</div>`;
        return;
      }

      const hasPass = readByte() === 1;
      if (hasPass && !pass) {
        return toast('Muatan ini dikunci kata sandi. Masukkan kata sandi terlebih dahulu.', 'error');
      }

      const lenBuf = new Uint8Array([readByte(), readByte(), readByte(), readByte()]);
      const msgLen = new DataView(lenBuf.buffer).getUint32(0, false);
      if (msgLen <= 0 || msgLen > 500000) {
        return toast('Data muatan rusak atau tidak valid.', 'error');
      }

      const payload = new Uint8Array(msgLen);
      for (let i = 0; i < msgLen; i++) payload[i] = readByte();

      const plainBytes = await xorWithPassword(payload, hasPass ? pass : '');
      const decodedText = new TextDecoder('utf-8', { fatal: false }).decode(plainBytes);

      outBox.classList.remove('hidden');
      outBox.innerHTML = `
        <div class="result-card-clean">
          <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--brand-text); margin-bottom:0.35rem;">
            Pesan Rahasia Terbaca
          </div>
          <div style="white-space:pre-wrap; font-size:0.88rem; font-weight:500; background:var(--bg-card); padding:0.85rem; border-radius:var(--radius-sm); border:1px solid var(--border);">${esc(decodedText)}</div>
        </div>
      `;
      toast('Pesan rahasia berhasil diekstrak.');
    });
  }

  // =========================================================================
  // 9. SCANNER LINK ANTI-PHISHING, SHORTLINK & QR CODE CUSTOM LOGO
  // =========================================================================
  function initCyberUtil() {
    const scanForm = document.getElementById('cyberScanForm');
    const shortForm = document.getElementById('cyberShortForm');
    const qrBox = document.getElementById('cyberQrBox');
    if (!scanForm) return;

    document.querySelectorAll('[data-cyber-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = btn.dataset.cyberMode;
        document.querySelectorAll('[data-cyber-mode]').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        scanForm.classList.toggle('hidden', m !== 'scanner');
        shortForm.classList.toggle('hidden', m !== 'short');
        qrBox.classList.toggle('hidden', m !== 'qr');
        if (m === 'qr') renderQrCode();
      });
    });

    // A. Anti-Phishing Link Scanner
    scanForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { api, esc, toast } = H();
      const url = document.getElementById('cyberScanInput')?.value.trim() || '';
      const btn = document.getElementById('btnRunCyberScan');
      const resBox = document.getElementById('cyberScanResult');
      if (!url) return;

      const prev = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Menelusuri Pengalihan &amp; IP...';

      try {
        const data = await api('/api/tools/scan-link', {
          method: 'POST',
          body: JSON.stringify({ url })
        });
        const r = data.result;
        const riskTitle =
          r.riskLevel === 'safe'
            ? 'Aman — Protokol HTTPS aktif dan tidak ditemukan indikator mencurigakan'
            : r.riskLevel === 'medium'
              ? 'Perhatian — Verifikasi domain tujuan sebelum memasukkan kredensial'
              : 'Risiko Tinggi — Terdeteksi pola pengalihan atau domain mencurigakan';

        resBox.classList.remove('hidden');
        resBox.innerHTML = `
          <div class="result-card-clean">
            <div class="risk-banner ${esc(r.riskLevel)}">${riskTitle}</div>
            ${
              r.warnings.length
                ? `<ul style="margin:0 0 0.85rem 1.2rem; font-size:0.8rem; color:var(--danger); font-weight:600;">
                    ${r.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}
                  </ul>`
                : ''
            }
            <div style="font-size:0.82rem; margin-bottom:0.55rem;">
              <strong>URL Tujuan Akhir:</strong><br/>
              <code style="word-break:break-all; color:var(--brand-text);">${esc(r.finalUrl)}</code>
            </div>
            ${
              r.geo
                ? `<div class="stalk-stats">
                    <div class="stalk-stat-box">
                      <div class="stalk-stat-val" style="font-size:0.88rem;">${esc(r.geo.ip)}</div>
                      <div class="stalk-stat-lbl">Alamat IP</div>
                    </div>
                    <div class="stalk-stat-box">
                      <div class="stalk-stat-val" style="font-size:0.88rem;">${esc(r.geo.country)}</div>
                      <div class="stalk-stat-lbl">Negara</div>
                    </div>
                    <div class="stalk-stat-box">
                      <div class="stalk-stat-val" style="font-size:0.88rem;">${esc(r.geo.city)}</div>
                      <div class="stalk-stat-lbl">Kota</div>
                    </div>
                    <div class="stalk-stat-box">
                      <div class="stalk-stat-val" style="font-size:0.8rem;">${esc(r.geo.isp)}</div>
                      <div class="stalk-stat-lbl">Jaringan / ISP</div>
                    </div>
                  </div>`
                : ''
            }
            <div style="font-size:0.76rem; font-weight:600; color:var(--text-muted); margin-top:0.5rem;">
              Rantai Pengalihan (${r.hops.length} tahap):
            </div>
            <div class="hop-list">
              ${r.hops
                .map(
                  (h) => `
                <div class="hop-row">
                  <span class="free-badge">#${h.step} (${esc(h.status)})</span>
                  <span>${esc(h.url)}</span>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        `;
        toast('Analisis tautan selesai.');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = prev;
      }
    });

    // B. Shortlink Generator
    shortForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { api, esc, toast } = H();
      const url = document.getElementById('cyberLongUrl')?.value.trim() || '';
      const provider = document.getElementById('cyberShortProv')?.value || 'isgd';
      const btn = document.getElementById('btnRunShortlink');
      const resBox = document.getElementById('cyberShortResult');
      if (!url) return;

      const prev = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Memproses Shortlink...';

      try {
        const data = await api('/api/tools/shortlink', {
          method: 'POST',
          body: JSON.stringify({ url, provider })
        });
        const r = data.result;
        resBox.classList.remove('hidden');
        resBox.innerHTML = `
          <div class="result-card-clean" style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; flex-wrap:wrap;">
            <div>
              <div style="font-size:0.74rem; color:var(--text-muted);">Tautan Pendek (${esc(r.provider)}):</div>
              <a href="${esc(r.shortUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:1rem; font-weight:700; color:var(--brand-text);">${esc(r.shortUrl)}</a>
            </div>
            <button type="button" class="btn btn-primary btn-sm" id="btnCopyShortUrl">Salin Tautan</button>
          </div>
        `;
        document.getElementById('btnCopyShortUrl')?.addEventListener('click', () => {
          navigator.clipboard?.writeText(r.shortUrl);
          toast('Tautan pendek disalin.');
        });
        toast('Tautan pendek dibuat.');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = prev;
      }
    });

    // C. QR Code Custom Logo
    let customQrLogo = null;
    const qrCanvas = document.getElementById('qrCanvas');
    const logoChoice = document.getElementById('qrLogoChoice');
    const customLogoInp = document.getElementById('qrCustomLogoInput');

    logoChoice?.addEventListener('change', () => {
      customLogoInp?.classList.toggle('hidden', logoChoice.value !== 'custom');
      renderQrCode();
    });

    customLogoInp?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = async () => {
        customQrLogo = await loadImageSafe(r.result);
        renderQrCode();
      };
      r.readAsDataURL(f);
    });

    function hexToRgb(hex) {
      const clean = String(hex || '#000000').replace('#', '');
      const n = parseInt(clean, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    async function renderQrCode() {
      if (!qrCanvas) return;
      const { api, toast } = H();
      const text = document.getElementById('qrTextData')?.value.trim() || 'https://www.tiktok.com/@df4tch_';
      const fg = hexToRgb(document.getElementById('qrFgColor')?.value || '#0f172a');
      const bg = hexToRgb(document.getElementById('qrBgColor')?.value || '#ffffff');
      const choice = logoChoice?.value || 'd4tech';

      try {
        const res = await api('/api/tools/qr-base', {
          method: 'POST',
          body: JSON.stringify({ text })
        });
        const baseImg = await loadImageSafe(res.qrDataUrl);
        if (!baseImg) return;

        const SIZE = 640;
        qrCanvas.width = SIZE;
        qrCanvas.height = SIZE;
        const ctx = qrCanvas.getContext('2d');
        ctx.drawImage(baseImg, 0, 0, SIZE, SIZE);

        // Recolor pixels cleanly
        const imData = ctx.getImageData(0, 0, SIZE, SIZE);
        const px = imData.data;
        for (let i = 0; i < px.length; i += 4) {
          const isDark = px[i] < 128;
          px[i] = isDark ? fg[0] : bg[0];
          px[i + 1] = isDark ? fg[1] : bg[1];
          px[i + 2] = isDark ? fg[2] : bg[2];
          px[i + 3] = 255;
        }
        ctx.putImageData(imData, 0, 0);

        // Stamp Center Logo if chosen
        let logoImg = null;
        if (choice === 'd4tech') logoImg = await loadImageSafe('/logo-d4tech.png');
        else if (choice === 'custom') logoImg = customQrLogo;

        if (logoImg) {
          const boxSize = 136;
          const bx = (SIZE - boxSize) / 2;
          const by = (SIZE - boxSize) / 2;
          ctx.fillStyle = `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`;
          roundRect(ctx, bx - 8, by - 8, boxSize + 16, boxSize + 16, 24);
          ctx.fill();

          const ratio = Math.min(boxSize / logoImg.width, boxSize / logoImg.height);
          const lw = logoImg.width * ratio;
          const lh = logoImg.height * ratio;
          ctx.drawImage(logoImg, (SIZE - lw) / 2, (SIZE - lh) / 2, lw, lh);
        }
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    document.getElementById('btnGenerateQr')?.addEventListener('click', renderQrCode);
    document.getElementById('qrFgColor')?.addEventListener('input', renderQrCode);
    document.getElementById('qrBgColor')?.addEventListener('input', renderQrCode);

    document.getElementById('btnDownloadQr')?.addEventListener('click', () => {
      const { toast } = H();
      if (!qrCanvas) return;
      const a = document.createElement('a');
      a.download = `d4tech-qrcode-${Date.now()}.png`;
      a.href = qrCanvas.toDataURL('image/png');
      a.click();
      toast('QR Code PNG HD berhasil diunduh!');
    });
  }

  // =========================================================================
  // 10. EMOJI MIX KITCHEN & BRAT VIRAL COVER GENERATOR
  // =========================================================================
  function initEmojiMixAndBrat() {
    const kitchenBox = document.getElementById('emixKitchenBox');
    const bratBox = document.getElementById('emixBratBox');
    const inp1 = document.getElementById('emixInput1');
    const inp2 = document.getElementById('emixInput2');
    const quickGrid = document.getElementById('emixQuickGrid');
    const randomBtn = document.getElementById('btnEmixRandom');
    const runBtn = document.getElementById('btnRunEmojiMix');
    const resBox = document.getElementById('emixResultBox');
    if (!kitchenBox || !inp1 || !inp2) return;

    const POPULAR_EMOJIS = [
      '😭', '🔥', '😂', '❤️', '🥺', '💀', '😎', '🤡',
      '👻', '🐱', '🐶', '🐸', '🦊', '🐼', '🦄', '🐙',
      '🌸', '⭐', '⚡', '🌈', '🍓', '🍔', '☕', '👑'
    ];

    let activeSlot = 1;
    const setSlot = (slot) => {
      activeSlot = slot;
      inp1.classList.toggle('selected-slot', slot === 1);
      inp2.classList.toggle('selected-slot', slot === 2);
    };

    inp1.addEventListener('focus', () => setSlot(1));
    inp1.addEventListener('click', () => setSlot(1));
    inp2.addEventListener('focus', () => setSlot(2));
    inp2.addEventListener('click', () => setSlot(2));

    if (quickGrid) {
      quickGrid.innerHTML = POPULAR_EMOJIS.map(
        (em) => `<button type="button" class="emix-pick-btn" data-pick-em="${em}">${em}</button>`
      ).join('');
      quickGrid.querySelectorAll('[data-pick-em]').forEach((b) => {
        b.addEventListener('click', () => {
          if (activeSlot === 1) {
            inp1.value = b.dataset.pickEm;
            setSlot(2);
          } else {
            inp2.value = b.dataset.pickEm;
            setSlot(1);
          }
        });
      });
    }

    randomBtn?.addEventListener('click', () => {
      const a = POPULAR_EMOJIS[Math.floor(Math.random() * POPULAR_EMOJIS.length)];
      let b = POPULAR_EMOJIS[Math.floor(Math.random() * POPULAR_EMOJIS.length)];
      if (b === a) b = '🔥';
      inp1.value = a;
      inp2.value = b;
      runBtn?.click();
    });

    runBtn?.addEventListener('click', async () => {
      const { api, esc, toast } = H();
      const emoji1 = inp1.value.trim();
      const emoji2 = inp2.value.trim();
      if (!emoji1 || !emoji2) return toast('Pilih 2 emoji terlebih dahulu.', 'error');

      const prev = runBtn.innerHTML;
      runBtn.disabled = true;
      runBtn.innerHTML = '<span class="spinner"></span> Menggabungkan Stiker...';

      try {
        const data = await api('/api/tools/emojimix', {
          method: 'POST',
          body: JSON.stringify({ emoji1, emoji2 })
        });
        const r = data.result;
        const stickerSrc = r.imageDataUrl || r.stickerDataUrl;
        resBox.classList.remove('hidden');
        resBox.innerHTML = `
          <div class="result-card-clean" style="text-align:center;">
            <div style="font-size:0.82rem; font-weight:600; color:var(--text-muted); margin-bottom:0.65rem;">
              Kombinasi ${esc(r.emoji1)} + ${esc(r.emoji2)} (PNG Transparan)
            </div>
            <div class="checkerboard-stage" style="padding:1.5rem;">
              <img src="${esc(stickerSrc)}" alt="Emoji Mix" style="width:184px; height:184px; object-fit:contain;" />
            </div>
            <div style="margin-top:0.85rem; display:flex; justify-content:center; gap:0.55rem; flex-wrap:wrap;">
              <a href="${esc(stickerSrc)}" download="d4tech-emojimix-${Date.now()}.png" class="btn btn-primary btn-sm">
                Unduh PNG Transparan
              </a>
            </div>
          </div>
        `;
        toast('Stiker Emoji Mix dibuat.');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = prev;
      }
    });

    // Brat Cover Generator
    const bratCanvas = document.getElementById('bratCanvas');
    const bratText = document.getElementById('bratTextInput');
    const bratTheme = document.getElementById('bratThemeSelect');
    const bratBlur = document.getElementById('bratBlurRange');

    function renderBratCover() {
      if (!bratCanvas) return;
      const SIZE = 1000;
      bratCanvas.width = SIZE;
      bratCanvas.height = SIZE;
      const ctx = bratCanvas.getContext('2d');
      const [bgHex, fgHex] = String(bratTheme?.value || '#8ACF00|#000000').split('|');
      const blurPx = Number(bratBlur?.value ?? 1.5);
      const raw = (bratText?.value || 'd4tech hub').trim().toLowerCase();

      ctx.filter = 'none';
      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, SIZE, SIZE);

      ctx.save();
      if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
      ctx.fillStyle = fgHex;
      const fontSize = raw.length > 55 ? 84 : raw.length > 25 ? 108 : 136;
      ctx.font = `500 ${fontSize}px "Arial Narrow", Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      const lines = wrapLines(ctx, raw, SIZE - 150);
      const lineH = Math.round(fontSize * 1.12);
      const totalH = lines.length * lineH;
      const startY = Math.max(80, Math.round((SIZE - totalH) / 2));
      lines.forEach((ln, idx) => {
        ctx.fillText(ln, 78, startY + idx * lineH);
      });
      ctx.restore();
    }

    document.querySelectorAll('[data-emix-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        const m = tab.dataset.emixTab;
        document.querySelectorAll('[data-emix-tab]').forEach((t) =>
          t.classList.toggle('active', t === tab)
        );
        kitchenBox.classList.toggle('hidden', m !== 'kitchen');
        bratBox?.classList.toggle('hidden', m !== 'brat');
        if (m === 'brat') renderBratCover();
      });
    });

    bratText?.addEventListener('input', renderBratCover);
    bratTheme?.addEventListener('change', renderBratCover);
    bratBlur?.addEventListener('input', renderBratCover);

    document.getElementById('btnDownloadBrat')?.addEventListener('click', () => {
      const { toast } = H();
      if (!bratCanvas) return;
      renderBratCover();
      const a = document.createElement('a');
      a.download = `d4tech-brat-${Date.now()}.png`;
      a.href = bratCanvas.toDataURL('image/png');
      a.click();
      toast('Sampul Brat PNG berhasil diunduh!');
    });
  }

  // =========================================================================
  // 11. PENDETEKSI JUDUL LAGU FYP (AI SHAZAM AUDIO / VIDEO)
  //
  // CATATAN PENTING (fix v4.2.1):
  // Vercel membatasi body request function hanya 4,5 MB. Sebelumnya klien
  // mengirim berkas mentah hingg 10,5 MB sebagai base64 (±14 MB) sehingga
  // request ditolak platform dengan "413 FUNCTION_PAYLOAD_TOO_LARGE" berupa
  // teks polos — di UI muncul sebagai "Respons server tidak berformat JSON".
  // Sekarang klip didekode di peramban, dipotong 12 detik pada bagian paling
  // padat, lalu dikodekan ulang menjadi WAV mono 16 kHz (±300–400 KB).
  // =========================================================================
  function _shazamPickLoudestWindow(audioBuffer, maxSeconds) {
    const ch = audioBuffer.getChannelData(0);
    const sr = audioBuffer.sampleRate;
    const win = Math.max(1, Math.floor(maxSeconds * sr));
    if (ch.length <= win) return 0;

    const step = Math.max(1, Math.floor(sr * 0.5));
    let bestStart = 0;
    let bestScore = -1;
    for (let start = 0; start + win <= ch.length; start += step) {
      let sum = 0;
      for (let i = start; i < start + win; i += 64) {
        const v = ch[i];
        sum += v * v;
      }
      if (sum > bestScore) {
        bestScore = sum;
        bestStart = start;
      }
    }
    return bestStart / sr;
  }

  function _shazamEncodeWavMono(float32, sampleRate) {
    const samples = float32.length;
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, samples * 2, true);

    let offset = 44;
    for (let i = 0; i < samples; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
    return buffer;
  }

  function _shazamBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  async function _shazamRenderClip(audioBuffer, startSec, seconds, sampleRate) {
    const targetLength = Math.max(1, Math.floor(seconds * sampleRate));
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (OfflineCtx) {
      const off = new OfflineCtx(1, targetLength, sampleRate);
      const src = off.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(off.destination);
      src.start(0, startSec, seconds);
      const rendered = await off.startRendering();
      return _shazamEncodeWavMono(rendered.getChannelData(0), sampleRate);
    }
    // Fallback manual: downmix + nearest-neighbour resample
    const chCount = audioBuffer.numberOfChannels;
    const from = Math.floor(startSec * audioBuffer.sampleRate);
    const to = Math.min(
      audioBuffer.length,
      from + Math.floor(seconds * audioBuffer.sampleRate)
    );
    const ratio = audioBuffer.sampleRate / sampleRate;
    const out = new Float32Array(targetLength);
    for (let i = 0; i < targetLength; i++) {
      const idx = Math.min(to - 1, from + Math.floor(i * ratio));
      let sum = 0;
      for (let c = 0; c < chCount; c++) sum += audioBuffer.getChannelData(c)[idx] || 0;
      out[i] = sum / chCount;
    }
    return _shazamEncodeWavMono(out, sampleRate);
  }

  /**
   * Ubah berkas audio/video (ukuran berapa pun) menjadi klip WAV kecil
   * (±300–450 KB) yang aman dikirim ke serverless function Vercel.
   */
  async function buildShazamClip(file) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('Peramban ini tidak mendukung Web Audio API.');

    const raw = await file.arrayBuffer();
    const ctx = new AC();
    let decoded = null;
    try {
      decoded = await new Promise((resolve, reject) => {
        const ret = ctx.decodeAudioData(raw.slice(0), resolve, reject);
        if (ret && typeof ret.then === 'function') ret.then(resolve).catch(reject);
      });
    } finally {
      try {
        ctx.close();
      } catch (_) {}
    }
    if (!decoded || !decoded.length) throw new Error('Trek audio tidak dapat dibaca.');

    // Coba beberapa konfigurasi sampai payload aman (< 2,8 MB base64 ≈ 2,1 MB biner)
    const plans = [
      { seconds: 12, sampleRate: 16000 },
      { seconds: 12, sampleRate: 12000 },
      { seconds: 10, sampleRate: 8000 }
    ];

    let lastResult = null;
    for (const plan of plans) {
      const seconds = Math.min(plan.seconds, decoded.duration);
      const startSec =
        decoded.duration > seconds
          ? _shazamPickLoudestWindow(decoded, seconds)
          : 0;
      const wav = await _shazamRenderClip(decoded, startSec, seconds, plan.sampleRate);
      const base64 = _shazamBufferToBase64(wav);
      lastResult = {
        dataUrl: `data:audio/wav;base64,${base64}`,
        bytes: wav.byteLength,
        seconds: Number(seconds.toFixed(1)),
        sampleRate: plan.sampleRate,
        startSec: Number(startSec.toFixed(1))
      };
      if (base64.length <= 2.8 * 1024 * 1024) return lastResult;
    }
    return lastResult;
  }

  function initShazam() {
    const fileInp = document.getElementById('shazamFileInput');
    const drop = document.getElementById('shazamDropzone');
    const dropTitle = document.getElementById('shazamDropTitle');
    const urlInp = document.getElementById('shazamUrlInput');
    const runBtn = document.getElementById('btnRunShazam');
    const resBox = document.getElementById('shazamResultBox');
    if (!drop || !fileInp || !runBtn) return;

    let mediaDataUrl = null;

    drop.addEventListener('click', () => fileInp.click());
    fileInp.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const { toast } = H();
      if (f.size > 120 * 1024 * 1024) {
        return toast('Berkas terlalu besar (maksimal 120 MB).', 'error');
      }

      dropTitle.textContent = `Memotong & mengompres audio: ${f.name}…`;
      try {
        const clip = await buildShazamClip(f);
        mediaDataUrl = clip.dataUrl;
        dropTitle.textContent = `Klip siap: ${f.name} → potongan ${clip.seconds} dtk mono ${Math.round(
          clip.sampleRate / 1000
        )} kHz (${Math.round(clip.bytes / 1024)} KB)`;
        toast('Klip audio diperkecil otomatis agar server dapat memprosesnya.');
      } catch (err) {
        // Fallback: kirim berkas asli hanya bila cukup kecil untuk batas Vercel (4,5 MB)
        if (f.size <= 2.4 * 1024 * 1024) {
          const reader = new FileReader();
          reader.onload = () => {
            mediaDataUrl = reader.result;
            dropTitle.textContent = `Berkas dipilih: ${f.name} (${(f.size / 1024 / 1024).toFixed(
              2
            )} MB)`;
            toast('Berkas kecil siap diidentifikasi.');
          };
          reader.readAsDataURL(f);
          return;
        }
        mediaDataUrl = null;
        dropTitle.textContent = 'Klik atau seret potongan audio/video (MP3, WAV, M4A, MP4)';
        toast(
          `${err.message} Format ini tidak bisa dipotong di peramban — pilih berkas MP3/M4A/MP4 atau potong klip 10–15 detik.`,
          'error'
        );
      }
    });

    runBtn.addEventListener('click', async () => {
      const { api, esc, toast, switchView } = H();
      const directUrl = urlInp?.value.trim() || '';
      if (!mediaDataUrl && !directUrl) {
        return toast('Pilih berkas audio/video atau masukkan tautan MP3 terlebih dahulu.', 'error');
      }

      const prev = runBtn.innerHTML;
      runBtn.disabled = true;
      runBtn.innerHTML = '<span class="spinner"></span> Mengidentifikasi Sidik Audio...';

      try {
        const data = await api('/api/tools/shazam', {
          method: 'POST',
          body: JSON.stringify({
            audioBase64: directUrl ? undefined : mediaDataUrl,
            audioUrl: directUrl || undefined
          })
        });
        const r = data.result;
        const searchQuery = `${r.title} ${r.artist}`.trim();
        resBox.classList.remove('hidden');
        resBox.innerHTML = `
          <div class="result-card-clean">
            <span class="free-badge">Teridentifikasi &bull; Skor Kecocokan ${esc(r.score)}%</span>
            <div style="font-size:1.14rem; font-weight:700; color:var(--text-main); margin-top:0.55rem;">
              ${esc(r.title)}
            </div>
            <div style="font-size:0.88rem; font-weight:600; color:var(--brand-text); margin-top:0.15rem;">
              ${esc(r.artist)}
            </div>
            <div class="stalk-stats mt-sm">
              <div class="stalk-stat-box">
                <div class="stalk-stat-val" style="font-size:0.85rem;">${esc(r.album)}</div>
                <div class="stalk-stat-lbl">Album</div>
              </div>
              <div class="stalk-stat-box">
                <div class="stalk-stat-val" style="font-size:0.85rem;">${esc(r.release || r.releaseDate || '-')}</div>
                <div class="stalk-stat-lbl">Tanggal Rilis</div>
              </div>
              <div class="stalk-stat-box">
                <div class="stalk-stat-val" style="font-size:0.85rem;">${esc(r.duration)}</div>
                <div class="stalk-stat-lbl">Durasi</div>
              </div>
            </div>
            <div class="dl-actions-wrap">
              <button type="button" class="btn btn-primary btn-sm" id="btnShazamToYtMp3">
                Cari &amp; Unduh MP3 Lagu Ini &rarr;
              </button>
              <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
                Buka di YouTube &nearr;
              </a>
            </div>
          </div>
        `;
        document.getElementById('btnShazamToYtMp3')?.addEventListener('click', () => {
          const ytInp = document.getElementById('ytInput');
          if (ytInp) ytInp.value = searchQuery;
          if (typeof switchView === 'function') switchView('ytmp3');
          document.getElementById('btnSearchYtOnly')?.click();
        });
        toast(`Lagu teridentifikasi: ${r.title} - ${r.artist}`);
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = prev;
      }
    });
  }

  // =========================================================================
  // 12. AI PERANGKUM YOUTUBE, TRANSKRIP & THUMBNAIL 4K
  // =========================================================================
  function initYtSummary() {
    const form = document.getElementById('ytSummaryForm');
    const urlInp = document.getElementById('ytSumUrlInput');
    const btn = document.getElementById('btnRunYtSummary');
    const resBox = document.getElementById('ytSummaryResult');
    if (!form || !urlInp) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { api, esc, toast } = H();
      const url = urlInp.value.trim();
      if (!url) return;

      const prev = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Merangkum Video &amp; Transkrip...';
      resBox.classList.remove('hidden');
      resBox.innerHTML = `<div class="result-card-clean" style="text-align:center; color:var(--text-muted);"><span class="spinner" style="vertical-align:middle;margin-right:6px;"></span> Mengekstrak transkrip, merangkum poin inti, dan memuat sampul resolusi tinggi...</div>`;

      try {
        const data = await api('/api/tools/yt-summary', {
          method: 'POST',
          body: JSON.stringify({ url })
        });
        const r = data.result;
        const proxyDl = (u, fn) =>
          `/api/tools/proxy-download?url=${encodeURIComponent(u)}&filename=${encodeURIComponent(fn)}`;
        const thumbItems = Array.isArray(r.thumbnails)
          ? r.thumbnails
          : [
              { label: 'MaxRes / 4K', url: `https://i.ytimg.com/vi/${r.videoId}/maxresdefault.jpg` },
              { label: 'HQ (480p)', url: `https://i.ytimg.com/vi/${r.videoId}/hqdefault.jpg` },
              { label: 'Medium', url: `https://i.ytimg.com/vi/${r.videoId}/mqdefault.jpg` }
            ];

        resBox.innerHTML = `
          <div class="result-card-clean">
            <div style="font-weight:700; font-size:0.96rem; color:var(--text-main); margin-bottom:0.2rem;">
              ${esc(r.title || 'Video YouTube')}
            </div>
            <div style="font-size:0.76rem; color:var(--text-muted); margin-bottom:0.75rem;">
              ${esc(r.channel || 'YouTube')}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
              <span class="free-badge">Ringkasan AI (Bahasa Indonesia)</span>
              <button type="button" class="btn btn-secondary btn-sm" id="btnCopyYtSummary">Salin Ringkasan</button>
            </div>
            <div class="summary-prose mt-sm">${esc(r.summary)}</div>

            ${
              r.transcript
                ? `
              <details class="mt-md">
                <summary style="cursor:pointer; font-weight:600; font-size:0.82rem; color:var(--brand-text);">
                  Lihat Teks Transkrip Penuh (${r.transcript.length.toLocaleString('id-ID')} karakter)
                </summary>
                <div class="mt-sm">
                  <button type="button" class="btn btn-secondary btn-sm" id="btnCopyYtTranscript">Salin Transkrip</button>
                  <div class="summary-prose mt-sm" style="max-height:240px; font-size:0.8rem;">${esc(r.transcript)}</div>
                </div>
              </details>
            `
                : ''
            }

            <div class="mt-md" style="font-weight:600; font-size:0.84rem;">
              Sampul Thumbnail Video:
            </div>
            <div class="thumb-grid">
              ${thumbItems
                .map(
                  (th, idx) => `
                <div class="thumb-card">
                  <img src="${esc(th.url)}" alt="${esc(th.label)}" loading="lazy" />
                  <a href="${esc(proxyDl(th.url, `yt-thumb-${idx + 1}-${r.videoId}.jpg`))}" class="btn ${idx === 0 ? 'btn-primary' : 'btn-secondary'} btn-sm">Unduh ${esc(th.label)}</a>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        `;

        document.getElementById('btnCopyYtSummary')?.addEventListener('click', () => {
          navigator.clipboard?.writeText(r.summary);
          toast('Ringkasan disalin.');
        });
        document.getElementById('btnCopyYtTranscript')?.addEventListener('click', () => {
          navigator.clipboard?.writeText(r.transcript);
          toast('Transkrip penuh disalin.');
        });
        toast('Ringkasan video selesai.');
      } catch (err) {
        resBox.innerHTML = `<div class="result-card-clean" style="color:var(--danger); font-weight:600;">${esc(err.message)}</div>`;
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = prev;
      }
    });
  }

  // =========================================================================
  // 13. KOMPRESOR FOTO TARGET KB & KONVERTER FORMAT (100% LOKAL)
  // =========================================================================
  function initCompressor() {
    const fileInp = document.getElementById('compFileInput');
    const drop = document.getElementById('compDropzone');
    const dropTitle = document.getElementById('compDropTitle');
    const targetSel = document.getElementById('compTargetKb');
    const fmtSel = document.getElementById('compFormatSelect');
    const maxDimSel = document.getElementById('compMaxDim');
    const runBtn = document.getElementById('btnRunCompressor');
    const resBox = document.getElementById('compResultBox');
    if (!drop || !fileInp || !runBtn) return;

    let sourceFile = null;
    let sourceImg = null;

    drop.addEventListener('click', () => fileInp.click());
    fileInp.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const { toast } = H();
      const url = URL.createObjectURL(f);
      const img = await loadImageSafe(url);
      URL.revokeObjectURL(url);
      if (!img) return toast('Gagal membaca berkas gambar.', 'error');
      sourceFile = f;
      sourceImg = img;
      dropTitle.textContent = `Berkas dipilih: ${f.name} (${(f.size / 1024).toFixed(1)} KB \u2022 ${img.width}\u00d7${img.height}px)`;
      toast('Foto siap dikompres.');
    });

    function canvasToBlobAsync(canvas, mime, q) {
      return new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, q));
    }

    runBtn.addEventListener('click', async () => {
      const { esc, toast } = H();
      if (!sourceImg || !sourceFile) {
        return toast('Pilih foto yang ingin dikompres terlebih dahulu.', 'error');
      }

      const targetBytes = Number(targetSel?.value || 200) * 1024;
      const mime = fmtSel?.value || 'image/jpeg';
      const maxDim = Number(maxDimSel?.value || 1600);

      let w = sourceImg.width;
      let h = sourceImg.height;
      if (maxDim > 0 && (w > maxDim || h > maxDim)) {
        const r = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }

      const canvas = document.createElement('canvas');
      const drawAtSize = (cw, ch) => {
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (mime === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, cw, ch);
        }
        ctx.drawImage(sourceImg, 0, 0, cw, ch);
      };

      drawAtSize(w, h);
      let bestBlob = null;

      if (mime === 'image/png') {
        // PNG bersifat lossless; perkecil dimensi bertahap jika melebihi target
        let scale = 1.0;
        for (let attempt = 0; attempt < 6; attempt++) {
          drawAtSize(Math.max(120, Math.round(w * scale)), Math.max(120, Math.round(h * scale)));
          bestBlob = await canvasToBlobAsync(canvas, mime);
          if (bestBlob && bestBlob.size <= targetBytes) break;
          scale *= 0.78;
        }
      } else {
        // Pencarian biner kualitas (quality 0.12 .. 0.94) + fallback skala resolusi
        let curW = w;
        let curH = h;
        for (let pass = 0; pass < 4; pass++) {
          drawAtSize(curW, curH);
          let lo = 0.12;
          let hi = 0.94;
          let candidate = null;
          for (let step = 0; step < 7; step++) {
            const mid = (lo + hi) / 2;
            const blob = await canvasToBlobAsync(canvas, mime, mid);
            if (blob && blob.size <= targetBytes) {
              candidate = blob;
              lo = mid;
            } else {
              hi = mid;
            }
          }
          if (candidate) {
            bestBlob = candidate;
            break;
          }
          bestBlob = await canvasToBlobAsync(canvas, mime, 0.12);
          if (bestBlob && bestBlob.size <= targetBytes) break;
          curW = Math.max(160, Math.round(curW * 0.76));
          curH = Math.max(160, Math.round(curH * 0.76));
        }
      }

      if (!bestBlob) return toast('Gagal mengompres gambar.', 'error');

      const origKb = (sourceFile.size / 1024).toFixed(1);
      const outKb = (bestBlob.size / 1024).toFixed(1);
      const savedPct = Math.max(0, Math.round((1 - bestBlob.size / sourceFile.size) * 100));
      const ext = mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
      const baseName = sourceFile.name.replace(/\.[^.]+$/, '');
      const dlUrl = URL.createObjectURL(bestBlob);

      resBox.classList.remove('hidden');
      resBox.innerHTML = `
        <div class="result-card-clean" style="text-align:center;">
          <div style="display:flex; justify-content:center; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.65rem;">
            <span class="selected-pill">Awal: ${esc(origKb)} KB</span>
            <span class="free-badge">Hasil: ${esc(outKb)} KB (Hemat ${savedPct}%)</span>
            <span class="selected-pill">${canvas.width}\u00d7${canvas.height}px &bull; .${ext.toUpperCase()}</span>
          </div>
          <img src="${esc(dlUrl)}" alt="Hasil Kompres" style="max-width:100%; max-height:320px; border-radius:var(--radius-sm); border:1px solid var(--border);" />
          <div style="margin-top:0.75rem;">
            <a href="${esc(dlUrl)}" download="${esc(baseName)}-kompres-${Math.round(bestBlob.size / 1024)}KB.${ext}" class="btn btn-primary btn-sm">
              Unduh Berkas (${esc(outKb)} KB)
            </a>
          </div>
        </div>
      `;
      toast(`Dikompres menjadi ${outKb} KB.`);
    });
  }

  // =========================================================================
  // 14. GABUNG MULTI-FOTO KE PDF DOKUMEN (100% LOKAL BINARY PDF 1.4 BUILDER)
  // =========================================================================
  function initImgToPdf() {
    const fileInp = document.getElementById('pdfFilesInput');
    const drop = document.getElementById('pdfDropzone');
    const grid = document.getElementById('pdfPagesGrid');
    const genBtn = document.getElementById('btnGeneratePdf');
    const clearBtn = document.getElementById('btnClearPdfPages');
    const modeSel = document.getElementById('pdfPageMode');
    const nameInp = document.getElementById('pdfFileName');
    if (!drop || !fileInp || !genBtn) return;

    let pages = [];

    function renderPagesGrid() {
      const { esc } = H();
      if (!grid) return;
      grid.classList.toggle('hidden', pages.length === 0);
      grid.innerHTML = pages
        .map(
          (p, i) => `
        <div class="pdf-img-item">
          <img src="${esc(p.previewUrl)}" alt="Hal ${i + 1}" />
          <span class="pdf-page-badge">Hal ${i + 1}</span>
          <button type="button" class="pdf-remove-btn" data-rm-pdf="${i}" title="Hapus halaman">&times;</button>
        </div>
      `
        )
        .join('');

      grid.querySelectorAll('[data-rm-pdf]').forEach((b) => {
        b.addEventListener('click', () => {
          const idx = Number(b.dataset.rmPdf);
          pages.splice(idx, 1);
          renderPagesGrid();
        });
      });
    }

    drop.addEventListener('click', () => fileInp.click());
    fileInp.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const { toast } = H();

      for (const f of files) {
        const objUrl = URL.createObjectURL(f);
        const img = await loadImageSafe(objUrl);
        if (!img) {
          URL.revokeObjectURL(objUrl);
          continue;
        }
        const MAX = 1650;
        let w = img.width;
        let h = img.height;
        if (w > MAX || h > MAX) {
          const r = Math.min(MAX / w, MAX / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const jpegBlob = await new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', 0.88));
        const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
        pages.push({ previewUrl: objUrl, width: w, height: h, jpegBytes });
      }

      fileInp.value = '';
      renderPagesGrid();
      toast(`${files.length} halaman foto ditambahkan ke daftar PDF!`);
    });

    clearBtn?.addEventListener('click', () => {
      pages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      pages = [];
      renderPagesGrid();
    });

    function buildPdfFromJpegs(pageItems, pageMode = 'a4') {
      const enc = new TextEncoder();
      const chunks = [];
      let byteLength = 0;

      const pushStr = (s) => {
        const b = enc.encode(s);
        chunks.push(b);
        byteLength += b.length;
      };
      const pushBytes = (b) => {
        chunks.push(b);
        byteLength += b.length;
      };

      const offsets = [0]; // index 0 reserved for free object
      pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

      // Object 1: Catalog, Object 2: Pages
      const totalPages = pageItems.length;
      const firstPageObjId = 3;
      // Each page uses 3 objects: Page (3 + i*3), Content (4 + i*3), Image XObject (5 + i*3)
      const pageKids = [];
      for (let i = 0; i < totalPages; i++) {
        pageKids.push(`${firstPageObjId + i * 3} 0 R`);
      }

      offsets[1] = byteLength;
      pushStr(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

      offsets[2] = byteLength;
      pushStr(`2 0 obj\n<< /Type /Pages /Count ${totalPages} /Kids [ ${pageKids.join(' ')} ] >>\nendobj\n`);

      for (let i = 0; i < totalPages; i++) {
        const p = pageItems[i];
        const pageObjId = firstPageObjId + i * 3;
        const contentObjId = pageObjId + 1;
        const imgObjId = pageObjId + 2;

        let pageW;
        let pageH;
        let drawW;
        let drawH;
        let drawX;
        let drawY;

        if (pageMode === 'a4') {
          const isLandscape = p.width > p.height * 1.15;
          pageW = isLandscape ? 841.89 : 595.28;
          pageH = isLandscape ? 595.28 : 841.89;
          const margin = 24;
          const availW = pageW - margin * 2;
          const availH = pageH - margin * 2;
          const scale = Math.min(availW / p.width, availH / p.height);
          drawW = +(p.width * scale).toFixed(2);
          drawH = +(p.height * scale).toFixed(2);
          drawX = +((pageW - drawW) / 2).toFixed(2);
          drawY = +((pageH - drawH) / 2).toFixed(2);
        } else {
          pageW = p.width;
          pageH = p.height;
          drawW = p.width;
          drawH = p.height;
          drawX = 0;
          drawY = 0;
        }

        const contentStream = `q\n${drawW} 0 0 ${drawH} ${drawX} ${drawY} cm\n/Im${i} Do\nQ\n`;
        const contentBytes = enc.encode(contentStream);

        offsets[pageObjId] = byteLength;
        pushStr(
          `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im${i} ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`
        );

        offsets[contentObjId] = byteLength;
        pushStr(`${contentObjId} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
        pushBytes(contentBytes);
        pushStr(`\nendstream\nendobj\n`);

        offsets[imgObjId] = byteLength;
        pushStr(
          `${imgObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpegBytes.length} >>\nstream\n`
        );
        pushBytes(p.jpegBytes);
        pushStr(`\nendstream\nendobj\n`);
      }

      const objCount = offsets.length;
      const xrefOffset = byteLength;
      pushStr(`xref\n0 ${objCount}\n0000000000 65535 f \n`);
      for (let id = 1; id < objCount; id++) {
        pushStr(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
      }
      pushStr(`trailer\n<< /Size ${objCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

      return new Blob(chunks, { type: 'application/pdf' });
    }

    genBtn.addEventListener('click', () => {
      const { toast } = H();
      if (!pages.length) {
        return toast('Tambahkan minimal 1 foto halaman terlebih dahulu.', 'error');
      }
      const pdfBlob = buildPdfFromJpegs(pages, modeSel?.value || 'a4');
      const safeName =
        (nameInp?.value || 'Dokumen-D4TechHub').trim().replace(/[^a-zA-Z0-9_-]/g, '_') ||
        'Dokumen-D4TechHub';
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      toast(`Dokumen PDF (${pages.length} halaman) berhasil diunduh.`);
    });
  }

  // =========================================================================
  // 15. KALKULATOR TARGET WINRATE (WR) MOBILE LEGENDS
  // =========================================================================
  function initMlbbWr() {
    const form = document.getElementById('mlbbWrForm');
    const totalInp = document.getElementById('wrTotalMatch');
    const curInp = document.getElementById('wrCurrentPct');
    const targetInp = document.getElementById('wrTargetPct');
    const resBox = document.getElementById('mlbbWrResult');
    if (!form || !resBox) return;

    function calculateWr(showToast = false) {
      const { esc, toast } = H();
      const tMatch = Number(totalInp.value);
      const curWr = Number(curInp.value);
      const targetWr = Number(targetInp.value);

      if (!Number.isFinite(tMatch) || tMatch < 1) {
        return toast('Total match harus minimal 1.', 'error');
      }
      if (targetWr >= 100 || targetWr <= 0 || curWr < 0 || curWr >= 100) {
        return toast('Masukkan angka Winrate yang valid (0% - 99.99%).', 'error');
      }

      const currentWins = Math.round(tMatch * (curWr / 100));
      const currentLosses = Math.max(0, tMatch - currentWins);

      if (targetWr <= curWr) {
        const maxLoseAllowed = Math.max(0, Math.floor((100 * currentWins) / targetWr - tMatch));
        resBox.innerHTML = `
          <div class="wr-hero-box">
            <div style="font-size:0.84rem; font-weight:700; color:var(--text-muted);">Winrate Kamu Sudah Mencapai / Melampaui Target!</div>
            <div class="wr-big-num">${maxLoseAllowed} Match</div>
            <div style="font-size:0.86rem; font-weight:600; margin-top:0.35rem;">
              Batas maksimal kekalahan beruntun sebelum WR turun di bawah <strong>${esc(targetWr)}%</strong>.
            </div>
          </div>
        `;
        return;
      }

      const exactWins = (tMatch * (targetWr - curWr)) / (100 - targetWr);
      const neededStreak = Math.max(1, Math.ceil(exactWins));
      const finalMatch = tMatch + neededStreak;

      resBox.innerHTML = `
        <div class="wr-hero-box">
          <div style="font-size:0.84rem; font-weight:800; color:var(--text-muted);">
            TARGET WIN STREAK TANPA KALAH MENUJU ${esc(targetWr)}%:
          </div>
          <div class="wr-big-num">+${neededStreak.toLocaleString('id-ID')} Win</div>
          <div style="font-size:0.88rem; font-weight:600; color:var(--text-main); margin-top:0.35rem;">
            Kamu butuh <strong>${neededStreak.toLocaleString('id-ID')} kemenangan beruntun</strong> tanpa kalah agar WR naik dari <strong>${esc(curWr)}%</strong> ke <strong>${esc(targetWr)}%</strong>!
          </div>
          <div class="stalk-stats mt-md">
            <div class="stalk-stat-box">
              <div class="stalk-stat-val">${currentWins.toLocaleString('id-ID')}</div>
              <div class="stalk-stat-lbl">Estimasi Menang Saat Ini</div>
            </div>
            <div class="stalk-stat-box">
              <div class="stalk-stat-val">${currentLosses.toLocaleString('id-ID')}</div>
              <div class="stalk-stat-lbl">Estimasi Kalah Saat Ini</div>
            </div>
            <div class="stalk-stat-box">
              <div class="stalk-stat-val">${finalMatch.toLocaleString('id-ID')}</div>
              <div class="stalk-stat-lbl">Total Match Nanti</div>
            </div>
          </div>
        </div>
      `;
      if (showToast) toast(`Butuh +${neededStreak} kemenangan beruntun menuju WR ${targetWr}%!`);
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      calculateWr(true);
    });
    calculateWr(false);
  }

  // Init langsung bila script di-load lazy SETELAH DOMContentLoaded
  // (app.js memuat file ini on-demand saat tool pertama dibuka).
  function bootExtraTools() {
    if (window.__d4techExtraToolsLoaded) return; // jangan double-init
    initRoaster();
    initRemini();
    initAiImage();
    initAudioStudio();
    initTts();
    initReceiptAndLyrics();
    initOsint();
    initPixelVault();
    initCyberUtil();
    initEmojiMixAndBrat();
    initShazam();
    initYtSummary();
    initCompressor();
    initImgToPdf();
    initMlbbWr();
    window.__d4techExtraToolsLoaded = true;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootExtraTools);
  } else {
    bootExtraTools();
  }
})();
