            const el = {
                audio: document.getElementById("audio"),
                file: document.getElementById("file"),
                pick: document.getElementById("pick"),
                fileName: document.getElementById("fileName"),
                fileMeta: document.getElementById("fileMeta"),
                play: document.getElementById("play"),
                playIcon: document.getElementById("playIcon"),
                seek: document.getElementById("seek"),
                time: document.getElementById("time"),
                volume: document.getElementById("volume"),
                volLabel: document.getElementById("volLabel"),
                msg: document.getElementById("msg"),
                eq: document.getElementById("eq"),
                reset: document.getElementById("reset"),
                flat: document.getElementById("flat"),
                ctxState: document.getElementById("ctxState"),
                preset: document.getElementById("preset"),
                loop: document.getElementById("loop"),
                bass: document.getElementById("bass"),
                reverb: document.getElementById("reverb"),
                vizMode: document.getElementById("vizMode"),
                oscToggle: document.getElementById("oscToggle"),
                mic: document.getElementById("mic"),
                fs: document.getElementById("fs"),
                canvas: document.getElementById("canvas"),
                osc: document.getElementById("osc"),
                vizLabel: document.getElementById("vizLabel"),
                playlist: document.getElementById("playlist"),
                playlistMeta: document.getElementById("playlistMeta"),
                playlistList: document.getElementById("playlistList"),
            };

            const STORAGE = {
                volume: "meq.volume",
                loop: "meq.loop",
                bass: "meq.bass",
                reverb: "meq.reverb",
                vizMode: "meq.vizMode",
                osc: "meq.osc",
                mic: "meq.mic",
                preset: "meq.preset",
                custom: "meq.customGains",
            };

            const BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
            const BAND_TYPES = {
                31: "lowshelf",
                16000: "highshelf",
            };

            const PRESETS = [
                { name: "Flat", gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
                { name: "Rock", gains: [4, 3, 2, 1, -1, -1, 1, 2, 3, 4] },
                { name: "Pop", gains: [-1, 0, 2, 3, 2, 0, -1, -1, 0, 1] },
                { name: "Electronic", gains: [5, 4, 2, 0, -1, 0, 2, 3, 4, 5] },
                { name: "Jazz", gains: [2, 1, 0, 1, 2, 2, 1, 0, 1, 2] },
                { name: "Classical", gains: [0, 0, 1, 2, 3, 2, 1, 0, -1, -2] },
                { name: "Hip-Hop", gains: [6, 5, 3, 1, -1, -1, 1, 2, 3, 3] },
                { name: "Bass Boost", gains: [7, 6, 4, 2, 0, -1, -1, 0, 1, 2] },
                { name: "Vocal Boost", gains: [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2] },
                { name: "Treble Boost", gains: [-2, -2, -1, 0, 1, 2, 4, 6, 7, 7] },
                { name: "Custom", gains: null },
            ];

            const PRESET_SHORTCUT_ORDER = PRESETS.filter((p) => p.name !== "Custom").map((p) => p.name);

            const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

            function fillRoundRect(ctx, x, y, w, h, r) {
                const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
                if (typeof ctx.roundRect === "function") {
                    ctx.beginPath();
                    ctx.roundRect(x, y, w, h, radius);
                    ctx.fill();
                    return;
                }

                // Fallback for older canvas implementations
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + w - radius, y);
                ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
                ctx.lineTo(x + w, y + h - radius);
                ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
                ctx.lineTo(x + radius, y + h);
                ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                ctx.closePath();
                ctx.fill();
            }

            function readLS(key, fallback) {
                try {
                    const raw = localStorage.getItem(key);
                    if (raw === null) return fallback;
                    return JSON.parse(raw);
                } catch {
                    return fallback;
                }
            }

            function writeLS(key, value) {
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                } catch {
                    // ignore
                }
            }

            function setMessage(text, kind = "") {
                el.msg.textContent = text;
                el.msg.className = "message" + (kind ? " " + kind : "");
            }

            function fmtTime(seconds) {
                if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
                const s = Math.floor(seconds);
                const m = Math.floor(s / 60);
                const r = s % 60;
                return `${m}:${String(r).padStart(2, "0")}`;
            }

            function formatBytes(bytes) {
                if (!Number.isFinite(bytes) || bytes < 0) return "";
                const units = ["B", "KB", "MB", "GB"];
                let v = bytes;
                let i = 0;
                while (v >= 1024 && i < units.length - 1) {
                    v /= 1024;
                    i++;
                }
                const digits = i === 0 ? 0 : i === 1 ? 1 : 2;
                return `${v.toFixed(digits)} ${units[i]}`;
            }

            function setToggle(button, on) {
                if (!button) return;
                button.classList.toggle("on", !!on);
            }

            function setPlayIcon(isPlaying) {
                el.play.classList.toggle("is-on", isPlaying);
                el.play.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
                el.playIcon.innerHTML = isPlaying
                    ? '<path d="M7 5h3v14H7zM14 5h3v14h-3z"></path>'
                    : '<path d="M8 5v14l11-7z"></path>';
            }

            // --- Audio graph
            /** @type {AudioContext | null} */
            let audioCtx = null;
            /** @type {MediaElementAudioSourceNode | null} */
            let mediaSourceNode = null;
            /** @type {MediaStreamAudioSourceNode | null} */
            let micSourceNode = null;
            /** @type {MediaStream | null} */
            let micStream = null;
            /** @type {AudioNode | null} */
            let activeSourceNode = null;
            /** @type {BiquadFilterNode[] | null} */
            let eqNodes = null;
            /** @type {Map<number, BiquadFilterNode>} */
            let filters = new Map();
            /** @type {BiquadFilterNode | null} */
            let bassNode = null;
            /** @type {ConvolverNode | null} */
            let convolver = null;
            /** @type {GainNode | null} */
            let dryGain = null;
            /** @type {GainNode | null} */
            let wetGain = null;
            /** @type {GainNode | null} */
            let preamp = null;
            /** @type {AnalyserNode | null} */
            let analyser = null;

            let loadedUrl = null;
            let isSeeking = false;
            let rafUI = 0;
            let rafViz = 0;

            /** @type {File[]} */
            let playlistFiles = [];
            /** @type {Map<number, number>} */
            let playlistDurations = new Map();
            let currentTrackIndex = -1;

            let micEnabled = false;

            function safeDisconnect(node) {
                try {
                    node.disconnect();
                } catch {
                    // ignore
                }
            }

            function setActiveSource(node) {
                if (!eqNodes || !node) return;
                if (mediaSourceNode && mediaSourceNode !== node) safeDisconnect(mediaSourceNode);
                if (micSourceNode && micSourceNode !== node) safeDisconnect(micSourceNode);
                safeDisconnect(node);
                node.connect(eqNodes[0]);
                activeSourceNode = node;
            }

            const VIZ = {
                mode: "bars", // bars | radial
                bars: 72,
                radialSegments: 96,
            };

            let peaks = new Float32Array(VIZ.bars);
            /** @type {{x:number,y:number,vx:number,vy:number,life:number}[]} */
            let particles = [];

            function updateCtxBadge() {
                const state = audioCtx ? audioCtx.state : "idle";
                const label = state === "running" ? "running" : state;
                el.ctxState.innerHTML = `Audio: <strong>${label}</strong>`;
            }

            function makeImpulseResponse(ctx, seconds = 1.6, decay = 2.4) {
                const rate = ctx.sampleRate;
                const length = Math.max(1, Math.floor(rate * seconds));
                const buffer = ctx.createBuffer(2, length, rate);
                for (let c = 0; c < buffer.numberOfChannels; c++) {
                    const data = buffer.getChannelData(c);
                    for (let i = 0; i < length; i++) {
                        const t = i / length;
                        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
                    }
                }
                return buffer;
            }

            function ensureAudioGraph() {
                if (audioCtx) return;
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                mediaSourceNode = audioCtx.createMediaElementSource(el.audio);

                const q = 1.414;
                filters = new Map();
                eqNodes = BANDS.map((hz) => {
                    const f = audioCtx.createBiquadFilter();
                    f.frequency.value = hz;
                    f.gain.value = 0;
                    f.type = BAND_TYPES[hz] || "peaking";
                    if (f.type === "peaking") f.Q.value = q;
                    filters.set(hz, f);
                    return f;
                });

                bassNode = audioCtx.createBiquadFilter();
                bassNode.type = "lowshelf";
                bassNode.frequency.value = 90;
                bassNode.gain.value = 0;

                convolver = audioCtx.createConvolver();
                convolver.buffer = makeImpulseResponse(audioCtx);
                dryGain = audioCtx.createGain();
                wetGain = audioCtx.createGain();
                dryGain.gain.value = 1;
                wetGain.gain.value = 0;

                preamp = audioCtx.createGain();
                preamp.gain.value = clamp(Number(el.volume.value) / 100, 0, 2);

                analyser = audioCtx.createAnalyser();
                analyser.fftSize = 2048;
                analyser.smoothingTimeConstant = 0.84;

                // Chain: source -> EQ -> bass -> (dry + convolver/wet) -> preamp -> analyser -> destination
                setActiveSource(mediaSourceNode);
                for (let i = 0; i < eqNodes.length - 1; i++) eqNodes[i].connect(eqNodes[i + 1]);
                eqNodes[eqNodes.length - 1].connect(bassNode);

                bassNode.connect(dryGain);
                bassNode.connect(convolver);
                convolver.connect(wetGain);

                dryGain.connect(preamp);
                wetGain.connect(preamp);

                preamp.connect(analyser);
                analyser.connect(audioCtx.destination);

                applyUIToGraph();
                // The user may have a preset already applied to the UI before the
                // audio graph exists. Sync the current slider values into the
                // newly-created filter nodes.
                setGainsToUI(getGainsFromUI());
                updateCtxBadge();
            }

            async function resumeAudio() {
                ensureAudioGraph();
                if (!audioCtx) return;
                if (audioCtx.state === "suspended") {
                    await audioCtx.resume();
                }
                updateCtxBadge();
            }

            function applyUIToGraph() {
                if (preamp) preamp.gain.value = clamp(Number(el.volume.value) / 100, 0, 2);
                el.volLabel.textContent = `${Number(el.volume.value)}%`;

                el.audio.loop = !!readLS(STORAGE.loop, false);
                setToggle(el.loop, el.audio.loop);

                const bassOn = !!readLS(STORAGE.bass, false);
                setToggle(el.bass, bassOn);
                if (bassNode) bassNode.gain.value = bassOn ? 6 : 0;

                const reverbOn = !!readLS(STORAGE.reverb, false);
                setToggle(el.reverb, reverbOn);
                if (wetGain) wetGain.gain.value = reverbOn ? 0.32 : 0;

                const oscOn = !!readLS(STORAGE.osc, false);
                setToggle(el.oscToggle, oscOn);
                el.osc.classList.toggle("on", oscOn);

                VIZ.mode = readLS(STORAGE.vizMode, "bars") === "radial" ? "radial" : "bars";
                setToggle(el.vizMode, VIZ.mode === "radial");
                el.vizMode.textContent = VIZ.mode === "radial" ? "Visualizer: Radial" : "Visualizer: Bars";
                el.vizLabel.textContent = VIZ.mode === "radial" ? "Radial Spectrum" : "Live Spectrum";

                setToggle(el.mic, micEnabled);
            }

            // --- EQ UI + presets
            let saveCustomTimer = 0;

            function getGainsFromUI() {
                return BANDS.map((hz) => {
                    const input = el.eq.querySelector(`input.eq-range[data-hz="${hz}"]`);
                    return input ? Number(input.value) : 0;
                });
            }

            function setGainsToUI(gains) {
                for (let i = 0; i < BANDS.length; i++) {
                    const hz = BANDS[i];
                    const input = el.eq.querySelector(`input.eq-range[data-hz="${hz}"]`);
                    const band = input ? input.closest(".band") : null;
                    const db = band ? band.querySelector(".db") : null;
                    if (input) input.value = String(clamp(Number(gains[i] ?? 0), -12, 12));
                    if (db && input) db.textContent = `${Number(input.value)} dB`;
                    const f = filters.get(hz);
                    if (f && input) f.gain.value = Number(input.value);
                }
            }

            function buildEqUI() {
                const frag = document.createDocumentFragment();
                for (const hz of BANDS) {
                    const band = document.createElement("div");
                    band.className = "band";
                    band.dataset.hz = String(hz);

                    const db = document.createElement("div");
                    db.className = "db";
                    db.textContent = "0 dB";

                    const slider = document.createElement("input");
                    slider.className = "eq-range";
                    slider.type = "range";
                    slider.min = "-12";
                    slider.max = "12";
                    slider.step = "1";
                    slider.value = "0";
                    slider.dataset.hz = String(hz);
                    slider.setAttribute("aria-label", `${hz} Hz band`);

                    const sliderWrap = document.createElement("div");
                    sliderWrap.className = "slider-wrap";
                    sliderWrap.appendChild(slider);

                    const hzLabel = document.createElement("div");
                    hzLabel.className = "hz";
                    hzLabel.textContent = hz >= 1000 ? `${hz / 1000}k` : String(hz);

                    slider.addEventListener("input", () => {
                        const gain = Number(slider.value);
                        db.textContent = `${gain} dB`;
                        const f = filters.get(hz);
                        if (f) f.gain.value = gain;

                        // Any manual touch becomes Custom
                        if (el.preset.value !== "Custom") {
                            el.preset.value = "Custom";
                            writeLS(STORAGE.preset, "Custom");
                        }

                        if (saveCustomTimer) window.clearTimeout(saveCustomTimer);
                        saveCustomTimer = window.setTimeout(() => {
                            writeLS(STORAGE.custom, getGainsFromUI());
                        }, 220);
                    });

                    band.appendChild(db);
                    band.appendChild(sliderWrap);
                    band.appendChild(hzLabel);
                    frag.appendChild(band);
                }
                el.eq.innerHTML = "";
                el.eq.appendChild(frag);
            }

            function fillPresetSelect() {
                el.preset.innerHTML = "";
                for (const p of PRESETS) {
                    const opt = document.createElement("option");
                    opt.value = p.name;
                    opt.textContent = p.name;
                    el.preset.appendChild(opt);
                }
            }

            function applyPresetByName(name, { silent = false } = {}) {
                const preset = PRESETS.find((p) => p.name === name) || PRESETS[0];
                if (preset.name === "Custom") {
                    const saved = readLS(STORAGE.custom, PRESETS[0].gains);
                    if (Array.isArray(saved) && saved.length === BANDS.length) {
                        setGainsToUI(saved);
                    } else {
                        setGainsToUI(PRESETS[0].gains);
                    }
                } else {
                    setGainsToUI(preset.gains);
                }
                el.preset.value = preset.name;
                writeLS(STORAGE.preset, preset.name);
                if (!silent) setMessage(`Preset: ${preset.name}`, "ok");
            }

            function setEqFlat() {
                setGainsToUI(PRESETS[0].gains);
                if (el.preset.value !== "Flat") el.preset.value = "Flat";
                writeLS(STORAGE.preset, "Flat");
                setMessage("EQ set to flat.", "ok");
            }

            function resetAll() {
                setEqFlat();
                el.volume.value = "100";
                writeLS(STORAGE.volume, 100);
                if (preamp) preamp.gain.value = 1;
                applyUIToGraph();
                setMessage("Reset complete.", "ok");
            }

            // --- Visualizer
            function setupCanvas(canvas) {
                const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
                if (!ctx) return null;
                const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
                const resize = () => {
                    const rect = canvas.getBoundingClientRect();
                    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
                    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
                };
                resize();
                window.addEventListener("resize", resize, { passive: true });
                return { ctx, dpr, resize };
            }

            function spawnPeakParticles(x, y, intensity) {
                const count = Math.min(9, Math.max(0, Math.floor(intensity * 8)));
                for (let i = 0; i < count; i++) {
                    particles.push({
                        x: x + (Math.random() - 0.5) * 12,
                        y: y + (Math.random() - 0.5) * 10,
                        vx: (Math.random() - 0.5) * 1.0,
                        vy: -0.9 - Math.random() * 1.6,
                        life: 24 + Math.random() * 22,
                    });
                }
                if (particles.length > 520) particles = particles.slice(particles.length - 520);
            }

            function stopVisualizer() {
                if (rafViz) cancelAnimationFrame(rafViz);
                rafViz = 0;
            }

            function startVisualizer() {
                if (!analyser) return;

                stopVisualizer();
                const cMain = setupCanvas(el.canvas);
                const cOsc = setupCanvas(el.osc);
                if (!cMain) return;
                const ctx = cMain.ctx;
                const ctxOsc = cOsc ? cOsc.ctx : null;

                const freq = new Uint8Array(analyser.frequencyBinCount);
                const time = new Uint8Array(analyser.fftSize);
                peaks = new Float32Array(VIZ.bars);
                particles = [];

                const drawBars = (w, h) => {
                    const barGap = Math.max(2, Math.floor(w * 0.003));
                    const barW = Math.max(5, Math.floor((w - barGap * (VIZ.bars + 1)) / VIZ.bars));
                    const baseY = Math.floor(h * 0.93);
                    const maxH = Math.floor(h * 0.82);

                    const minBin = 2;
                    const maxBin = freq.length - 1;

                    ctx.save();
                    ctx.shadowColor = `rgba(255, 235, 59, ${0.15 + 0.18 * (Number(getComputedStyle(document.documentElement).getPropertyValue("--pulse")) || 0)})`;
                    ctx.shadowBlur = 20;

                    // subtle baseline
                    ctx.fillStyle = "rgba(255, 235, 59, 0.06)";
                    fillRoundRect(ctx, Math.floor(w * 0.04), baseY + 8, Math.floor(w * 0.92), 2, 2);

                    for (let i = 0; i < VIZ.bars; i++) {
                        const t0 = i / VIZ.bars;
                        const t1 = (i + 1) / VIZ.bars;
                        const start = Math.floor(minBin * Math.pow(maxBin / minBin, t0));
                        const end = Math.max(start + 1, Math.floor(minBin * Math.pow(maxBin / minBin, t1)));
                        let sum = 0;
                        for (let j = start; j < end; j++) sum += freq[j];
                        const avg = sum / (end - start);
                        const norm = avg / 255;

                        const targetH = Math.max(4, norm * maxH);
                        const fall = 0.014 + (1 - norm) * 0.032;
                        peaks[i] = Math.max(targetH, peaks[i] - maxH * fall);

                        const x = barGap + i * (barW + barGap);
                        const y = baseY - peaks[i];

                        const g = ctx.createLinearGradient(0, y, 0, baseY);
                        g.addColorStop(0, "rgba(255, 235, 59, 0.98)");
                        g.addColorStop(0.6, "rgba(255, 215, 0, 0.54)");
                        g.addColorStop(1, "rgba(0, 0, 0, 0.86)");

                        const capH = Math.max(6, Math.min(18, peaks[i] * 0.16));
                        ctx.fillStyle = "rgba(255, 235, 59, 0.22)";
                        fillRoundRect(ctx, x - 1, y - 2, barW + 2, capH, Math.max(4, Math.floor(barW * 0.45)));

                        ctx.fillStyle = g;
                        fillRoundRect(ctx, x, y, barW, peaks[i], Math.max(5, Math.floor(barW * 0.45)));

                        if (norm > 0.58) spawnPeakParticles(x + barW * 0.5, y + 6, norm);
                    }
                    ctx.restore();
                };

                const drawRadial = (w, h) => {
                    const cx = w * 0.5;
                    const cy = h * 0.52;
                    const pulse = Number(getComputedStyle(document.documentElement).getPropertyValue("--pulse")) || 0;
                    const baseR = Math.min(w, h) * (0.18 + 0.02 * pulse);
                    const maxR = Math.min(w, h) * 0.38;

                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(performance.now() * 0.00035);
                    ctx.globalCompositeOperation = "lighter";

                    for (let i = 0; i < VIZ.radialSegments; i++) {
                        const t = i / VIZ.radialSegments;
                        const idx = Math.floor((freq.length - 1) * Math.pow(t, 1.8));
                        const v = freq[idx] / 255;
                        const a = t * Math.PI * 2;
                        const r1 = baseR;
                        const r2 = baseR + v * (maxR - baseR);

                        ctx.strokeStyle = `rgba(255, 235, 59, ${0.2 + 0.6 * v})`;
                        ctx.lineWidth = 2 + v * 3;
                        ctx.beginPath();
                        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
                        ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
                        ctx.stroke();
                    }
                    ctx.restore();
                };

                const drawParticles = () => {
                    ctx.save();
                    ctx.globalCompositeOperation = "lighter";
                    for (let i = particles.length - 1; i >= 0; i--) {
                        const p = particles[i];
                        p.x += p.vx;
                        p.y += p.vy;
                        p.vy += 0.02;
                        p.life -= 1;
                        const a = clamp(p.life / 44, 0, 1);
                        const r = 2.0 + (1 - a) * 2.2;
                        ctx.fillStyle = `rgba(255, 235, 59, ${0.18 * a})`;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = `rgba(255, 235, 59, ${0.52 * a})`;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                        ctx.fill();
                        if (p.life <= 0 || p.y > el.canvas.height + 80) particles.splice(i, 1);
                    }
                    ctx.restore();
                };

                const drawOsc = () => {
                    if (!ctxOsc) return;
                    if (!el.osc.classList.contains("on")) {
                        ctxOsc.clearRect(0, 0, el.osc.width, el.osc.height);
                        return;
                    }
                    const w = el.osc.width;
                    const h = el.osc.height;
                    ctxOsc.clearRect(0, 0, w, h);
                    ctxOsc.strokeStyle = "rgba(255, 235, 59, 0.8)";
                    ctxOsc.lineWidth = 2;
                    ctxOsc.beginPath();
                    const mid = h * 0.5;
                    for (let i = 0; i < time.length; i++) {
                        const t = i / (time.length - 1);
                        const v = (time[i] - 128) / 128;
                        const x = t * w;
                        const y = mid + v * (h * 0.36);
                        if (i === 0) ctxOsc.moveTo(x, y);
                        else ctxOsc.lineTo(x, y);
                    }
                    ctxOsc.stroke();
                };

                const draw = () => {
                    rafViz = requestAnimationFrame(draw);
                    analyser.getByteFrequencyData(freq);
                    analyser.getByteTimeDomainData(time);

                    const w = el.canvas.width;
                    const h = el.canvas.height;
                    ctx.clearRect(0, 0, w, h);

                    const bg = ctx.createLinearGradient(0, 0, 0, h);
                    bg.addColorStop(0, "rgba(255, 235, 59, 0.06)");
                    bg.addColorStop(0.25, "rgba(0, 0, 0, 0)");
                    bg.addColorStop(1, "rgba(0, 0, 0, 0.62)");
                    ctx.fillStyle = bg;
                    ctx.fillRect(0, 0, w, h);

                    // drive UI glow based on low-frequency energy
                    let bass = 0;
                    for (let i = 0; i < 18; i++) bass += freq[i] || 0;
                    bass = bass / (18 * 255);
                    document.documentElement.style.setProperty("--pulse", String(clamp(bass, 0, 1)));

                    if (VIZ.mode === "radial") drawRadial(w, h);
                    else drawBars(w, h);
                    drawParticles();
                    drawOsc();
                };

                draw();
            }

            function startUILoop() {
                if (rafUI) cancelAnimationFrame(rafUI);
                const tick = () => {
                    rafUI = requestAnimationFrame(tick);
                    if (!el.audio.duration || !Number.isFinite(el.audio.duration)) {
                        el.time.textContent = `${fmtTime(el.audio.currentTime)} / 0:00`;
                        return;
                    }
                    el.time.textContent = `${fmtTime(el.audio.currentTime)} / ${fmtTime(el.audio.duration)}`;
                    if (!isSeeking && !el.seek.disabled) {
                        const t = el.audio.currentTime / el.audio.duration;
                        el.seek.value = String(clamp(Math.round(t * 1000), 0, 1000));
                    }
                };
                tick();
            }

            function stopUILoop() {
                if (rafUI) cancelAnimationFrame(rafUI);
                rafUI = 0;
            }

            function updatePlayEnabled() {
                const ok = Boolean(el.audio.src) && !micEnabled;
                el.play.disabled = !ok;
                el.seek.disabled = !ok;
            }

            function showPlaylist(show) {
                if (!el.playlist) return;
                el.playlist.hidden = !show;
            }

            function trackSubLabel(index) {
                const f = playlistFiles[index];
                if (!f) return "";
                const size = formatBytes(f.size);
                const d = playlistDurations.get(index);
                const dur = Number.isFinite(d) ? fmtTime(d) : "";
                if (size && dur) return `${size} • ${dur}`;
                return size || dur || "";
            }

            function renderPlaylist() {
                if (!el.playlistList || !el.playlistMeta) return;
                el.playlistList.innerHTML = "";
                el.playlistMeta.textContent = `${playlistFiles.length} ${playlistFiles.length === 1 ? "track" : "tracks"}`;

                const frag = document.createDocumentFragment();
                for (let i = 0; i < playlistFiles.length; i++) {
                    const row = document.createElement("div");
                    row.className = "track" + (i === currentTrackIndex ? " on" : "");
                    row.dataset.index = String(i);

                    const name = document.createElement("div");
                    name.className = "track-name";
                    name.textContent = playlistFiles[i].name;

                    const sub = document.createElement("div");
                    sub.className = "track-sub";
                    sub.textContent = trackSubLabel(i);

                    row.appendChild(name);
                    row.appendChild(sub);
                    frag.appendChild(row);
                }
                el.playlistList.appendChild(frag);
                showPlaylist(playlistFiles.length > 1);
            }

            function cleanupUrl() {
                if (loadedUrl) {
                    URL.revokeObjectURL(loadedUrl);
                    loadedUrl = null;
                }
            }

            function loadTrack(index, { autoplay = false } = {}) {
                if (micEnabled) {
                    setMessage("Disable Mic to play files.", "err");
                    return;
                }
                const file = playlistFiles[index];
                if (!file) return;

                currentTrackIndex = index;
                cleanupUrl();
                loadedUrl = URL.createObjectURL(file);
                el.audio.src = loadedUrl;
                el.audio.load();

                el.fileName.textContent = file.name;
                el.fileMeta.textContent = formatBytes(file.size);
                setPlayIcon(false);
                updatePlayEnabled();
                renderPlaylist();

                if (autoplay) {
                    // reuse the existing play/pause path (handles resume + visualizer)
                    togglePlayPause();
                }
            }

            function setPlaylistFromFiles(files) {
                const list = files.filter((f) => f && typeof f.type === "string" && f.type.startsWith("audio/"));
                if (!list.length) {
                    setMessage("No supported audio files detected.", "err");
                    return;
                }
                playlistFiles = list;
                playlistDurations = new Map();
                currentTrackIndex = 0;
                renderPlaylist();
                loadTrack(0);
                setMessage(list.length > 1 ? "Playlist loaded. Hit Play." : "File loaded. Hit Play.", "ok");
            }

            async function togglePlayPause() {
                if (!el.audio.src) {
                    setMessage("Pick a file first.", "err");
                    return;
                }

                try {
                    await resumeAudio();
                } catch {
                    setMessage("Audio engine blocked. Click Play again.", "err");
                    return;
                }

                try {
                    if (el.audio.paused) {
                        await el.audio.play();
                        setPlayIcon(true);
                        setMessage("Playing.");
                        startUILoop();
                        startVisualizer();
                    } else {
                        el.audio.pause();
                        setPlayIcon(false);
                        setMessage("Paused.");
                        stopVisualizer();
                        stopUILoop();
                    }
                } catch {
                    setMessage("Unable to play this file (format/codec not supported).", "err");
                }
            }

            function toggleFullscreen() {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen?.();
                } else {
                    document.exitFullscreen?.();
                }
            }

            async function enableMic() {
                if (!navigator.mediaDevices?.getUserMedia) {
                    setMessage("Microphone not supported in this browser.", "err");
                    return;
                }

                try {
                    await resumeAudio();
                } catch {
                    setMessage("Audio engine blocked. Click Mic again.", "err");
                    return;
                }

                try {
                    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    if (!audioCtx) return;
                    micSourceNode = audioCtx.createMediaStreamSource(micStream);
                    setActiveSource(micSourceNode);
                    micEnabled = true;
                    writeLS(STORAGE.mic, true);
                    setToggle(el.mic, true);

                    // Stop file playback UI
                    el.audio.pause();
                    setPlayIcon(false);
                    stopUILoop();
                    updatePlayEnabled();

                    startVisualizer();
                    setMessage("Mic input enabled.", "ok");
                } catch {
                    micEnabled = false;
                    writeLS(STORAGE.mic, false);
                    setToggle(el.mic, false);
                    setMessage("Microphone permission denied.", "err");
                }
            }

            function disableMic() {
                micEnabled = false;
                writeLS(STORAGE.mic, false);
                setToggle(el.mic, false);

                if (micStream) {
                    try {
                        micStream.getTracks().forEach((t) => t.stop());
                    } catch {
                        // ignore
                    }
                    micStream = null;
                }
                if (micSourceNode) {
                    safeDisconnect(micSourceNode);
                    micSourceNode = null;
                }
                if (mediaSourceNode) setActiveSource(mediaSourceNode);
                updatePlayEnabled();
                setMessage("Mic input disabled.", "ok");
            }

            function toggleMic() {
                if (micEnabled) disableMic();
                else enableMic();
            }

            // --- Wire up
            buildEqUI();
            fillPresetSelect();
            updateCtxBadge();
            setMessage("Choose an audio file to begin.");

            // Restore persisted state
            const savedVol = readLS(STORAGE.volume, 100);
            el.volume.value = String(clamp(Number(savedVol) || 100, 0, 200));
            el.volLabel.textContent = `${Number(el.volume.value)}%`;
            const savedPreset = readLS(STORAGE.preset, "Flat");
            el.preset.value = String(savedPreset);
            applyPresetByName(el.preset.value, { silent: true });
            applyUIToGraph();

            el.pick.addEventListener("click", () => el.file.click());

            el.file.addEventListener("change", () => {
                const files = Array.from(el.file.files || []);
                if (!files.length) {
                    setMessage("No file selected.", "err");
                    return;
                }
                setPlaylistFromFiles(files);
            });

            el.play.addEventListener("click", togglePlayPause);

            el.audio.addEventListener("ended", () => {
                setPlayIcon(false);
                stopVisualizer();
                stopUILoop();

                if (micEnabled) return;
                if (el.audio.loop) {
                    setMessage("Looping.");
                    return;
                }
                const next = currentTrackIndex + 1;
                if (playlistFiles.length > 1 && next < playlistFiles.length) {
                    setMessage("Next track…", "ok");
                    loadTrack(next, { autoplay: true });
                    return;
                }
                setMessage("Track ended.");
            });

            el.audio.addEventListener("loadedmetadata", () => {
                el.time.textContent = `${fmtTime(0)} / ${fmtTime(el.audio.duration)}`;
                const meta = el.fileMeta.textContent ? `${el.fileMeta.textContent} • ` : "";
                el.fileMeta.textContent = `${meta}${fmtTime(el.audio.duration)}`;
                if (currentTrackIndex >= 0 && Number.isFinite(el.audio.duration)) {
                    playlistDurations.set(currentTrackIndex, el.audio.duration);
                    renderPlaylist();
                }
                updatePlayEnabled();
            });

            el.volume.addEventListener("input", () => {
                const v = clamp(Number(el.volume.value) || 0, 0, 200);
                el.volume.value = String(v);
                writeLS(STORAGE.volume, v);
                if (preamp) preamp.gain.value = v / 100;
                el.volLabel.textContent = `${v}%`;
            });

            el.seek.addEventListener("pointerdown", () => (isSeeking = true));
            el.seek.addEventListener("pointerup", () => (isSeeking = false));
            el.seek.addEventListener("input", () => {
                if (!el.audio.duration || !Number.isFinite(el.audio.duration)) return;
                const t = clamp(Number(el.seek.value) / 1000, 0, 1);
                el.audio.currentTime = t * el.audio.duration;
            });

            el.preset.addEventListener("change", () => {
                applyPresetByName(el.preset.value);
            });

            el.loop.addEventListener("click", () => {
                const next = !el.audio.loop;
                el.audio.loop = next;
                writeLS(STORAGE.loop, next);
                setToggle(el.loop, next);
                setMessage(next ? "Loop enabled." : "Loop disabled.", "ok");
            });

            el.bass.addEventListener("click", () => {
                const current = !!readLS(STORAGE.bass, false);
                const next = !current;
                writeLS(STORAGE.bass, next);
                setToggle(el.bass, next);
                if (bassNode) bassNode.gain.value = next ? 6 : 0;
                setMessage(next ? "Bass boost on." : "Bass boost off.", "ok");
            });

            el.reverb.addEventListener("click", () => {
                const current = !!readLS(STORAGE.reverb, false);
                const next = !current;
                writeLS(STORAGE.reverb, next);
                setToggle(el.reverb, next);
                if (wetGain) wetGain.gain.value = next ? 0.32 : 0;
                setMessage(next ? "Reverb on." : "Reverb off.", "ok");
            });

            el.vizMode.addEventListener("click", () => {
                const next = VIZ.mode === "bars" ? "radial" : "bars";
                VIZ.mode = next;
                writeLS(STORAGE.vizMode, next);
                applyUIToGraph();
            });

            el.oscToggle.addEventListener("click", () => {
                const current = !!readLS(STORAGE.osc, false);
                const next = !current;
                writeLS(STORAGE.osc, next);
                applyUIToGraph();
            });

            if (el.mic) {
                el.mic.addEventListener("click", () => {
                    toggleMic();
                });
            }

            el.fs.addEventListener("click", () => {
                toggleFullscreen();
            });

            el.reset.addEventListener("click", resetAll);
            el.flat.addEventListener("click", setEqFlat);

            document.addEventListener(
                "visibilitychange",
                () => {
                    if (document.hidden) {
                        stopVisualizer();
                    } else if (!el.audio.paused) {
                        startVisualizer();
                    }
                },
                { passive: true }
            );

            document.addEventListener("keydown", (e) => {
                if (e.defaultPrevented) return;

                const tag = (e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "").toLowerCase();
                const typing = tag === "input" || tag === "textarea" || tag === "select";
                if (typing) return;

                if (e.code === "Space") {
                    e.preventDefault();
                    togglePlayPause();
                    return;
                }
                if (e.key === "f" || e.key === "F") {
                    e.preventDefault();
                    toggleFullscreen();
                    return;
                }
                if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    if (Number.isFinite(el.audio.duration)) el.audio.currentTime = clamp(el.audio.currentTime - 5, 0, el.audio.duration);
                    return;
                }
                if (e.key === "ArrowRight") {
                    e.preventDefault();
                    if (Number.isFinite(el.audio.duration)) el.audio.currentTime = clamp(el.audio.currentTime + 5, 0, el.audio.duration);
                    return;
                }
                if (e.key === "ArrowUp") {
                    e.preventDefault();
                    const next = clamp(Number(el.volume.value) + 5, 0, 200);
                    el.volume.value = String(next);
                    el.volume.dispatchEvent(new Event("input"));
                    return;
                }
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    const next = clamp(Number(el.volume.value) - 5, 0, 200);
                    el.volume.value = String(next);
                    el.volume.dispatchEvent(new Event("input"));
                    return;
                }
                if (/^[0-9]$/.test(e.key)) {
                    const digit = Number(e.key);
                    const index = digit === 0 ? 10 : digit; // 1..10
                    const name = PRESET_SHORTCUT_ORDER[index - 1];
                    if (name) {
                        e.preventDefault();
                        applyPresetByName(name);
                    }
                }
            });

            // Playlist clicks
            if (el.playlistList) {
                el.playlistList.addEventListener("click", (e) => {
                    const row = e.target && e.target.closest ? e.target.closest(".track") : null;
                    if (!row) return;
                    const idx = Number(row.dataset.index);
                    if (!Number.isFinite(idx)) return;
                    const shouldAutoPlay = !el.audio.paused;
                    loadTrack(idx, { autoplay: shouldAutoPlay });
                });
            }

            // Drag & drop audio files
            let dragDepth = 0;
            const isAudioDrag = (dt) => {
                try {
                    if (!dt) return false;
                    if (dt.items && dt.items.length) {
                        for (const it of dt.items) {
                            if (it.kind === "file" && typeof it.type === "string" && it.type.startsWith("audio/")) return true;
                        }
                    }
                    return true;
                } catch {
                    return true;
                }
            };

            document.addEventListener(
                "dragenter",
                (e) => {
                    if (!isAudioDrag(e.dataTransfer)) return;
                    dragDepth++;
                    e.preventDefault();
                    document.body.classList.add("drop-active");
                },
                { passive: false }
            );
            document.addEventListener(
                "dragover",
                (e) => {
                    if (!isAudioDrag(e.dataTransfer)) return;
                    e.preventDefault();
                },
                { passive: false }
            );
            document.addEventListener(
                "dragleave",
                () => {
                    dragDepth = Math.max(0, dragDepth - 1);
                    if (dragDepth === 0) document.body.classList.remove("drop-active");
                },
                { passive: true }
            );
            document.addEventListener(
                "drop",
                (e) => {
                    dragDepth = 0;
                    document.body.classList.remove("drop-active");
                    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
                    if (!files.length) return;
                    e.preventDefault();
                    setPlaylistFromFiles(files);
                },
                { passive: false }
            );

            // Initialize UI
            updatePlayEnabled();
            setPlayIcon(false);
