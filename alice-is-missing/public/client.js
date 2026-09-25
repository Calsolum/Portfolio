// Shared browser helpers: live state over SSE, the synced clock, actions, QR codes.
/* global qrcode */

(() => {
const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* private mode - the page still works, it just won't remember */
    }
  },
};

const Alice = {
  store,
  state: null,
  receivedAt: 0,

  // Connect to the live state stream. onState runs on every push.
  connect(role, onState, extra = {}) {
    const q = new URLSearchParams({ role, ...extra });
    const pin = store.get("alice.pin");
    if (pin) q.set("pin", pin);
    const es = new EventSource(`/api/events?${q}`);
    const status = document.getElementById("conn");
    es.addEventListener("state", (e) => {
      Alice.state = JSON.parse(e.data);
      Alice.receivedAt = performance.now();
      if (status) status.hidden = true;
      onState(Alice.state);
    });
    es.onerror = () => {
      if (status) status.hidden = false;
    };
    return es;
  },

  async act(type, data = {}) {
    const pin = store.get("alice.pin");
    const res = await fetch("/api/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, pin, token: store.get("alice.token"), ...data }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return body;
  },

  // Facilitator action: if the server wants a PIN, ask once and remember it.
  async host(type, data = {}) {
    try {
      return await Alice.act(type, data);
    } catch (err) {
      if (err.status !== 403) throw err;
      const pin = prompt("Facilitator PIN");
      if (!pin) throw err;
      store.set("alice.pin", pin);
      return Alice.act(type, data);
    }
  },

  // Game time elapsed right now, advanced locally from the last push.
  // Uses the time since the push arrived, so device clocks never need to agree.
  elapsedMs() {
    const s = Alice.state;
    if (!s) return 0;
    let ms = s.clock.elapsedMs;
    if (s.phase === "running") ms += (performance.now() - Alice.receivedAt) * s.clock.speed;
    return Math.min(s.clock.durationMs, ms);
  },

  remainingMs() {
    return Alice.state ? Alice.state.clock.durationMs - Alice.elapsedMs() : 0;
  },

  fmt(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  },

  // Next clue interval that hasn't fired yet.
  nextInterval() {
    const s = Alice.state;
    return s ? s.config.intervals.find((m) => !s.fired.includes(m)) : undefined;
  },

  // Fired but not yet marked revealed.
  dueIntervals() {
    const s = Alice.state;
    return s ? s.config.intervals.filter((m) => s.fired.includes(m) && !s.revealed.includes(m)) : [];
  },

  seatLabel(id) {
    const seat = Alice.state?.seats.find((x) => x.id === id);
    if (!seat) return `Seat ${id}`;
    return seat.character || seat.name || `Seat ${id}`;
  },

  // Who reveals the clue at a given interval, for display.
  holderLabel(interval) {
    const id = Alice.state?.clues[interval];
    return id ? Alice.seatLabel(id) : "no one assigned";
  },

  joinUrl(seat) {
    const base = Alice.state?.joinBase || location.origin;
    return seat ? `${base}/join?seat=${seat}` : `${base}/join`;
  },

  phaseLabel(phase) {
    return { setup: "Setting up", running: "In play", paused: "Paused", ended: "Time's up" }[phase] || phase;
  },

  // QR code as an inline SVG string, black on white so every camera reads it.
  qrSvg(text) {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const pad = 4;
    let d = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + pad},${r + pad}h1v1h-1z`;
    }
    const size = n + pad * 2;
    return `<svg class="qr" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code for ${Alice.esc(text)}"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  },

  // Clipboard API needs a secure context, which a plain-HTTP LAN page isn't.
  async copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    }
  },

  esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  },

  // Keep the screen awake during play, where the browser allows it.
  async wakeLock() {
    try {
      if ("wakeLock" in navigator) await navigator.wakeLock.request("screen");
    } catch {
      /* not available over plain HTTP; the page still works */
    }
  },

  toast(msg) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.setAttribute("role", "status");
      document.body.append(el);
    }
    el.textContent = msg;
    el.classList.add("on");
    clearTimeout(Alice.toastTimer);
    Alice.toastTimer = setTimeout(() => el.classList.remove("on"), 2600);
  },
};

window.Alice = Alice;
})();
