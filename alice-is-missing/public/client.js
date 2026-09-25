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
      const chat = Alice.chat;
      // Refetch when messages were cleared, or when the game ending unlocks every thread.
      if (chat.role && (Alice.state.chatEpoch !== chat.epoch || (Alice.state.phase === "ended") !== chat.endedAtLoad)) {
        chat.load();
      }
      onState(Alice.state);
    });
    es.addEventListener("message", (e) => Alice.chat.add(JSON.parse(e.data)));
    es.addEventListener("typing", (e) => Alice.chat.onTyping?.(JSON.parse(e.data)));
    // After any reconnect (a phone waking up), catch up on what was missed.
    es.addEventListener("open", () => Alice.chat.role && Alice.chat.load());
    es.onerror = () => {
      if (status) status.hidden = false;
    };
    return es;
  },

  chat: {
    role: null,
    epoch: null,
    endedAtLoad: false,
    messages: [],
    onChange: null,
    onTyping: null,
    loading: null,

    // Pages that show messages call this once; everything else stays chat-free.
    enable(role, onChange, onTyping) {
      Object.assign(Alice.chat, { role, onChange, onTyping });
      return Alice.chat.load();
    },

    load() {
      const chat = Alice.chat;
      if (chat.loading) return chat.loading;
      const q = new URLSearchParams({ role: chat.role });
      for (const [k, key] of [["token", "alice.token"], ["pin", "alice.pin"]]) {
        const v = store.get(key);
        if (v) q.set(k, v);
      }
      chat.loading = fetch(`/api/messages?${q}`)
        .then((r) => r.json())
        .then((body) => {
          chat.epoch = body.epoch;
          chat.messages = body.messages;
          chat.endedAtLoad = Alice.state?.phase === "ended";
          chat.onChange?.(null);
        })
        .catch(() => {})
        .finally(() => {
          chat.loading = null;
        });
      return chat.loading;
    },

    add(msg) {
      const chat = Alice.chat;
      if (chat.messages.some((m) => m.id === msg.id)) return;
      chat.messages.push(msg);
      chat.onChange?.(msg);
    },

    inThread(thread) {
      return Alice.chat.messages.filter((m) => m.thread === thread);
    },

    // Read marks are per device and per message set (the epoch changes when messages are cleared).
    readMarks() {
      try {
        return JSON.parse(store.get(`alice.read.${Alice.chat.epoch}`) || "{}");
      } catch {
        return {};
      }
    },

    markRead(thread) {
      const last = Alice.chat.inThread(thread).at(-1);
      if (!last) return;
      const marks = Alice.chat.readMarks();
      if ((marks[thread] ?? 0) >= last.id) return;
      marks[thread] = last.id;
      store.set(`alice.read.${Alice.chat.epoch}`, JSON.stringify(marks));
    },

    // Unread messages in a thread that someone else sent. `me` is { seat } or { npc }.
    unread(thread, me = {}) {
      const seen = Alice.chat.readMarks()[thread] ?? 0;
      return Alice.chat.inThread(thread).filter((m) => m.id > seen && !Alice.chat.isFrom(m, me)).length;
    },

    isFrom(msg, me) {
      return (me.seat != null && msg.from.seat === me.seat) || (me.npc != null && msg.from.npc === me.npc);
    },

    dmKey(a, b) {
      return `dm:${Math.min(a, b)}-${Math.max(a, b)}`;
    },

    npcName(id) {
      const live = Alice.state?.npcs?.find((n) => n.id === id);
      if (live) return live.name;
      const sent = Alice.chat.messages.find((m) => m.from.npc === id);
      return sent ? sent.from.name : "Unknown number";
    },

    senderName(msg) {
      return msg.from.seat ? Alice.seatLabel(msg.from.seat) : msg.from.name;
    },

    // A thread's title from one seat's point of view (mySeat may be null).
    threadName(thread, mySeat) {
      if (thread === "group") return "Group chat";
      let m = /^dm:(\d+)-(\d+)$/.exec(thread);
      if (m) {
        const [a, b] = [Number(m[1]), Number(m[2])];
        if (mySeat === a) return Alice.seatLabel(b);
        if (mySeat === b) return Alice.seatLabel(a);
        return `${Alice.seatLabel(a)} & ${Alice.seatLabel(b)}`;
      }
      m = /^npc:(\d+):(\d+)$/.exec(thread);
      if (m) {
        const name = Alice.chat.npcName(Number(m[1]));
        return Number(m[2]) === mySeat ? name : `${name} & ${Alice.seatLabel(Number(m[2]))}`;
      }
      return thread;
    },

    // Every thread a seat can open: the group, a DM with each other seat, NPC threads that
    // have started, and (once the game ends) everyone else's. Most recent activity first.
    threadsFor(mySeat) {
      const s = Alice.state;
      const keys = ["group"];
      for (const x of s?.seats ?? []) if (x.id !== mySeat) keys.push(Alice.chat.dmKey(mySeat, x.id));
      for (const m of Alice.chat.messages) if (!keys.includes(m.thread)) keys.push(m.thread);
      const lastId = (k) => Alice.chat.inThread(k).at(-1)?.id ?? 0;
      return keys
        .map((key, order) => ({ key, order, last: lastId(key) }))
        .sort((a, b) => b.last - a.last || a.order - b.order)
        .map((t) => t.key);
    },

    // Where the message fell on the game clock, as the countdown showed it.
    timeLabel(msg) {
      const d = Alice.state?.clock.durationMs ?? 0;
      return Alice.fmt(d - msg.gameMs);
    },
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

  // What this seat should be doing right now, most urgent first.
  // Each item: { tone: "alert" | "accent" | "plain", text, go? } where go names a place to jump to.
  nowActions(seat) {
    const s = Alice.state;
    if (!s || !seat) return [];
    const out = [];
    const self = s.seats.find((x) => x.id === seat);
    if (s.announcement) out.push({ tone: "accent", text: `From the facilitator: ${s.announcement}` });

    if (s.phase === "ended") {
      out.push({ tone: "accent", text: "Time's up. Every conversation is unlocked, so read the transcript together.", go: "transcript" });
      return out;
    }

    const due = Alice.dueIntervals().filter((m) => s.clues[m] === seat);
    for (const m of due) out.push({ tone: "alert", text: `Reveal your ${m}-minute clue now.`, go: "clues" });

    const me = { seat };
    const unread = Alice.chat.threadsFor(seat).filter((t) => Alice.chat.unread(t, me));
    if (unread.length) {
      const n = unread.reduce((sum, t) => sum + Alice.chat.unread(t, me), 0);
      const where = unread.map((t) => Alice.chat.threadName(t, seat)).join(", ");
      out.push({ tone: "accent", text: `${n} unread in ${where}.`, go: unread.length === 1 ? `thread:${unread[0]}` : "messages" });
    }

    if (s.phase === "setup") {
      if (!self?.character) out.push({ tone: "plain", text: "Tell the facilitator which character you're playing." });
      out.push({ tone: "plain", text: "Waiting for the facilitator to start the clock." });
      out.push({ tone: "plain", text: "Keep this page open and turn off your phone's auto-lock for the game." });
      return out;
    }

    if (s.phase === "paused") out.push({ tone: "accent", text: "The game is paused." });

    const myNext = s.config.intervals.find((m) => s.clues[m] === seat && !s.fired.includes(m));
    if (myNext != null) {
      const wait = Alice.remainingMs() - myNext * 60_000;
      out.push({ tone: "plain", text: `Your next clue is at ${myNext}:00, in ${Alice.fmt(wait)}.`, go: "clues" });
    } else if (!due.length && s.config.intervals.some((m) => s.clues[m] === seat)) {
      out.push({ tone: "plain", text: "You've revealed all your clues." });
    }
    if (s.phase === "running") out.push({ tone: "plain", text: "Stay silent. Everything happens by text." });
    return out;
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
