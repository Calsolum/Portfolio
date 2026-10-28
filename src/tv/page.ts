/**
 * The page a TV opens at /tv. It is one plain HTML file with its own small
 * script, written as old-fashioned JavaScript (var, XMLHttpRequest, no arrow
 * functions) and laid out without flexbox or grid, so it works in the old
 * browsers an Ouya can run as well as in a new one. The board itself is drawn
 * by the server and swapped in whole.
 *
 * The TV shows a code; a phone links a game to it; the page then polls for the
 * board, quickly while people are playing and slowly when the table is quiet,
 * and stops after a long quiet spell until someone presses a button.
 */

const STYLE = `
html,body{margin:0;padding:0;background:#0a0a0a;color:#f0f0f0;height:100%;overflow:hidden}
body{font-family:"Helvetica Neue",Roboto,Arial,sans-serif;font-size:1rem}
#app{padding:2.2rem 3rem;height:100%;box-sizing:border-box;-webkit-box-sizing:border-box}
.accent{color:#e8ff00}
#status{position:absolute;right:3rem;bottom:1.4rem;font-size:.8rem;color:#888}
#status.bad{color:#ff3c3c}
.pair{text-align:center;padding-top:5rem}
.pair .site{font-size:1.6rem;color:#888;letter-spacing:.1em}
.pair .code{font-size:9rem;font-weight:bold;letter-spacing:.25em;color:#e8ff00;margin:1.5rem 0 1rem;padding-left:.25em}
.pair .how{font-size:1.4rem;line-height:1.6;color:#f0f0f0}
.pair .how b{color:#e8ff00}
.pair .note{font-size:1.1rem;color:#888;margin-top:1.5rem}
.top{font-size:1.2rem;color:#888;margin-bottom:1rem;position:relative}
.top .game{color:#e8ff00;font-weight:bold;letter-spacing:.2em}
.top .room{position:absolute;right:0;top:0;letter-spacing:.15em}
.players{margin:0 -.5rem 1rem;white-space:nowrap;font-size:0}
.player{display:inline-block;vertical-align:top;font-size:1rem;white-space:normal;box-sizing:border-box;-webkit-box-sizing:border-box;padding:0 .5rem}
.player-in{border-top:.35rem solid #888;background:#141414;padding:.6rem .9rem}
.player.active .player-in{background:#1f1f1f;box-shadow:0 0 0 .15rem #e8ff00 inset}
.name{font-size:1.6rem;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.turn-tag{font-size:.8rem;background:#e8ff00;color:#0a0a0a;padding:.1rem .4rem;vertical-align:middle;letter-spacing:.1em}
.factions{font-size:.95rem;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:.2rem 0 .3rem}
.vp{font-size:3rem;font-weight:bold;line-height:1}
.vp .of{font-size:1.3rem;color:#888;font-weight:normal}
.bar{height:.45rem;background:#222;margin-top:.5rem}
.fill{height:100%;background:#e8ff00}
.madness{font-size:.95rem;color:#a78bfa;margin-top:.4rem}
.bases{margin:0 -.5rem;font-size:0}
.base{display:inline-block;vertical-align:top;font-size:1rem;box-sizing:border-box;-webkit-box-sizing:border-box;padding:0 .5rem .9rem}
.base-in{background:#141414;border:.12rem solid #222;padding:.7rem .9rem;min-height:8rem}
.base-in.ready{border-color:#e8ff00}
.base-in.waiting{color:#888}
.base-name{font-size:1.45rem;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.base-meta{font-size:.95rem;color:#888;margin:.15rem 0 .4rem}
.power{font-size:1.2rem;color:#888}
.power .big{font-size:2.3rem;color:#f0f0f0;font-weight:bold}
.ready-tag{font-size:.85rem;background:#e8ff00;color:#0a0a0a;padding:.1rem .4rem;letter-spacing:.1em;vertical-align:middle}
.row{font-size:1.15rem;margin-top:.35rem;white-space:nowrap;overflow:hidden}
.row.empty{color:#888}
.dot{display:inline-block;width:.8rem;height:.8rem;border-radius:50%;margin-right:.5rem}
.who{display:inline-block;width:47%;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom}
.pw{font-weight:bold;display:inline-block;width:2.2rem;text-align:right}
.place{color:#888;font-size:.85rem;margin-left:.4rem}
.two-rows .base-in{min-height:0;padding:.5rem .8rem}
.two-rows .base-name{font-size:1.2rem}
.two-rows .base-meta{font-size:.85rem;margin:0 0 .1rem}
.two-rows .power .big{font-size:1.8rem}
.two-rows .row{font-size:1rem;margin-top:.2rem;display:inline-block;width:50%;vertical-align:top;padding-right:.8rem;box-sizing:border-box;-webkit-box-sizing:border-box}
.two-rows .who{width:58%}
.two-rows .pw{width:1.6rem}
.two-rows .place{display:none}
.two-rows .base{padding-bottom:.6rem}
.log{margin-top:.3rem;font-size:1.05rem;color:#888}
.log-line{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.2rem}
.log-line.newest{color:#f0f0f0;font-size:1.25rem}
.banner{font-size:2.2rem;font-weight:bold;text-align:center;padding:.7rem;margin-bottom:1rem}
.banner.won{background:#e8ff00;color:#0a0a0a}
.banner.tied{border:.15rem solid #e8ff00;color:#e8ff00}
.paused{text-align:center;padding-top:12rem;font-size:2rem;color:#888}
`;

// Old JavaScript on purpose; see the comment at the top.
const SCRIPT = `
(function () {
  var API = "/api/tv/screens";
  var KEY = "tv-screen-code";
  var FAST = 2000, SLOW = 5000, WAIT = 3000;
  var QUIET_MS = 2 * 60 * 1000;
  var SLEEP_MS = 3 * 60 * 60 * 1000;
  var app = document.getElementById("app");
  var status = document.getElementById("status");
  var code = null, room = null, total = 0, timer = null, failures = 0;
  var lastChange = new Date().getTime(), paused = false, view = "";

  function scale() {
    var w = window.innerWidth || document.documentElement.clientWidth;
    var h = window.innerHeight || document.documentElement.clientHeight;
    // Laid out on an 80 by 45 grid of rem, so a 16:9 screen of any size fits.
    document.documentElement.style.fontSize = Math.min(w / 80, h / 45) + "px";
  }
  scale();
  window.onresize = scale;

  function load() { try { return window.localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(value) {
    try { if (value) window.localStorage.setItem(KEY, value); else window.localStorage.removeItem(KEY); } catch (e) {}
  }

  function request(method, url, body, done) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var data = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) {}
      done(xhr.status, data);
    };
    xhr.send(body ? JSON.stringify(body) : null);
  }

  function show(name, html) {
    view = name;
    app.innerHTML = html;
  }

  function setStatus(text, bad) {
    status.innerHTML = text;
    status.className = bad ? "bad" : "";
  }

  function pairing() {
    var host = window.location.host.replace(/^www\\./, "");
    show("pair",
      '<div class="pair"><div class="site">' + host + '/tv</div>' +
      '<div class="code">' + code + '</div>' +
      '<div class="how">On the tablet running the game, open <b>' + host + '/smash-up</b>,<br>tap <b>Show on TV</b> and type this code.</div>' +
      '<div class="note">Keep playing on the tablet. The TV follows along.</div></div>');
  }

  function later(ms) {
    clearTimeout(timer);
    timer = setTimeout(poll, ms);
  }

  function retry() {
    failures += 1;
    setStatus("Reconnecting\\u2026", true);
    later(Math.min(30000, 1000 * Math.pow(2, failures)));
  }

  function sleep() {
    paused = true;
    clearTimeout(timer);
    show("paused", '<div class="paused">Paused to save power.<br>Press any button to wake the display.</div>');
    setStatus("", false);
  }

  function wake() {
    if (!paused) return;
    paused = false;
    lastChange = new Date().getTime();
    room = null; total = 0;
    if (code) poll(); else start();
  }
  document.onkeydown = wake;
  document.onclick = wake;

  function start() {
    request("POST", API, null, function (s, data) {
      if (s === 201 && data && data.code) {
        code = data.code; save(code); failures = 0;
        pairing(); later(WAIT);
      } else {
        retry();
      }
    });
  }

  function poll() {
    if (paused) return;
    if (!code) { start(); return; }
    var url = API + "/" + code + (room ? "?room=" + room + "&total=" + total : "");
    request("GET", url, null, function (s, data) {
      if (paused) return;
      var now = new Date().getTime();
      if (!data || (s >= 500) || s === 429 || s === 0) { retry(); return; }
      failures = 0;
      setStatus("", false);
      if (data.status === "gone") { code = null; save(null); room = null; start(); return; }
      if (data.status === "waiting" || data.status === "ended") {
        room = null; total = 0;
        if (view !== "pair") { pairing(); lastChange = now; }
        if (now - lastChange > SLEEP_MS) { sleep(); return; }
        later(data.status === "ended" ? SLOW : WAIT);
        return;
      }
      if (data.status === "live") {
        room = data.room; total = data.total;
        show("board", data.html);
        lastChange = now;
      }
      if (now - lastChange > SLEEP_MS) { sleep(); return; }
      later(now - lastChange > QUIET_MS ? SLOW : FAST);
    });
  }

  // Keeps the TV from dimming where the browser allows it.
  function keepAwake() {
    try {
      if (navigator.wakeLock && document.visibilityState === "visible") navigator.wakeLock.request("screen")["catch"](function () {});
    } catch (e) {}
  }
  keepAwake();
  document.addEventListener("visibilitychange", keepAwake, false);

  code = load();
  if (code) { app.innerHTML = '<div class="paused">Connecting\\u2026</div>'; poll(); } else start();
})();
`;

export const TV_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Game night TV</title>
<style>${STYLE}</style>
</head>
<body>
<div id="app"><div class="paused">Loading…</div></div>
<div id="status"></div>
<noscript><div class="paused">The TV display needs JavaScript switched on.</div></noscript>
<script>${SCRIPT}</script>
</body>
</html>`;
