/* ============================================================
   creator.js — About > "also on camera" sub-section
   ------------------------------------------------------------
   Copy, topics and buttons come from CONFIG.creator. The video
   is whatever scripts/fetch-youtube.mjs picked as the channel's
   most-viewed upload (assets/youtube.json, refreshed daily by
   the deploy). The frame takes that video's own shape: 9:16 for
   a Short, 16:9 for a regular video.

   The player is a plain YouTube embed driven over postMessage,
   so there is no extra API script to load. It is only created
   once the card is near the viewport, starts muted (browsers
   only allow muted autoplay), pauses when scrolled away, and
   unmutes from the speaker button.
   ============================================================ */

const ICONS = {
  yt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg>',
  muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m23 9-6 6M17 9l6 6"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5L7 4.5Z"/></svg>',
  ext: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>',
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* **bold** and [[highlight]] — config text is ours, but escape anyway */
function rich(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[\[(.+?)\]\]/g, (_, t) =>
      `<mark class="hl">${/30/.test(t) ? stopwatch() : ""}${t}</mark>`);
}

/* A tiny ring that drains over a real 30 seconds, next to "30 seconds" */
function stopwatch() {
  return '<span class="sw" aria-hidden="true"><svg viewBox="0 0 20 20"><circle class="sw-track" cx="10" cy="11" r="7"/><circle class="sw-run" cx="10" cy="11" r="7" pathLength="100"/><path class="sw-crown" d="M8.5 2.5h3M10 2.5V4"/></svg></span>';
}

/* ---------- Subscribe: app on phones, web on desktop ---------- */
function subscribeLinks(handle) {
  const path = `www.youtube.com/@${handle}`;
  const web = `https://${path}?sub_confirmation=1`;
  return {
    web,
    // Chrome / most Android browsers and in-app webviews understand intent:
    // URLs; if the app is missing, the browser falls back to the web page.
    android: `intent://${path}?sub_confirmation=1#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(web)};end`,
  };
}

function wireSubscribe(btn, handle) {
  const links = subscribeLinks(handle);
  btn.href = links.web;   // desktop + iOS: iOS opens youtube.com links straight in the app (universal link)
  btn.addEventListener("click", (e) => {
    if (/Android/i.test(navigator.userAgent)) {
      e.preventDefault();
      window.location.href = links.android;
    }
  });
}

/* ---------- Which video ---------- */
async function loadVideo(yt) {
  try {
    const res = await fetch("assets/youtube.json", { cache: "no-cache" });
    if (res.ok) {
      const d = await res.json();
      if (d && /^[\w-]{11}$/.test(d.id)) return d;
    }
  } catch {}
  // Before the first deploy has written the file
  if (yt.fallbackVideoId) {
    return { id: yt.fallbackVideoId, isShort: true, aspect: "9 / 16", title: "", views: null,
             url: `https://www.youtube.com/shorts/${yt.fallbackVideoId}` };
  }
  if (/^UC[\w-]{22}$/.test(yt.channelId || "")) {
    // YouTube's auto-generated "popular shorts" playlist: its first entry
    // is the most-viewed Short, so this is still the right video.
    return { list: "UUPS" + yt.channelId.slice(2), isShort: true, aspect: "9 / 16", title: "", views: null,
             url: `https://www.youtube.com/@${yt.handle}/shorts` };
  }
  return null;
}

/* ---------- Player ---------- */
function mountPlayer(frame, video) {
  const origin = encodeURIComponent(location.origin);
  const base = "https://www.youtube-nocookie.com/embed/";
  const common = `autoplay=1&mute=1&playsinline=1&controls=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&enablejsapi=1&origin=${origin}`;
  const src = video.list
    ? `${base}videoseries?list=${video.list}&loop=1&${common}`
    : `${base}${video.id}?loop=1&playlist=${video.id}&${common}`;

  const iframe = document.createElement("iframe");
  iframe.className = "yt-iframe";
  iframe.src = src;
  iframe.title = video.title ? `YouTube: ${video.title}` : "Most-viewed video on Saif Made Simple";
  iframe.allow = "autoplay; encrypted-media; picture-in-picture";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.setAttribute("tabindex", "-1");
  frame.prepend(iframe);

  // Commands sent before the embed has loaded would be dropped, so they
  // queue until then (e.g. tapping "unmute" the instant the card appears)
  let loaded = false;
  const queue = [];
  const post = (msg) => iframe.contentWindow?.postMessage(JSON.stringify(msg), "*");
  const send = (func, args = []) => {
    const msg = { event: "command", func, args };
    loaded ? post(msg) : queue.push(msg);
  };

  const bar = frame.querySelector(".yt-progress i");
  const state = { muted: true, playing: true, ready: false };

  iframe.addEventListener("load", () => {
    loaded = true;
    // Ask the player to stream its state back (time, mute, play state)
    post({ event: "listening", id: "msb-yt", channel: "widget" });
    queue.splice(0).forEach(post);
  });

  window.addEventListener("message", (e) => {
    if (e.source !== iframe.contentWindow) return;
    let msg;
    try { msg = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
    const info = msg?.info;
    if (!info) return;
    if (!state.ready && (msg.event === "onReady" || info.playerState !== undefined)) {
      state.ready = true;
      frame.classList.add("is-live");
    }
    if (typeof info.currentTime === "number" && info.duration > 0 && bar) {
      bar.style.transform = `scaleX(${Math.min(1, info.currentTime / info.duration)})`;
    }
    if (info.playerState === 1) frame.classList.add("is-live");
  });

  return {
    state,
    play() { send("playVideo"); state.playing = true; frame.classList.remove("is-paused"); },
    pause() { send("pauseVideo"); state.playing = false; frame.classList.add("is-paused"); },
    setMuted(m) { send(m ? "mute" : "unMute"); if (!m) send("setVolume", [80]); state.muted = m; },
  };
}

/* ---------- Render ---------- */
export function initCreator(CONFIG, { socialIcons = {}, reduceMotion = false } = {}) {
  const c = CONFIG.creator;
  const root = document.getElementById("creator");
  if (!root) return;
  if (!c || c.enabled === false) { root.remove(); return; }

  const yt = c.youtube || {};
  const handle = (yt.handle || "").replace(/^@/, "");
  const socials = Object.fromEntries((CONFIG.socials || []).map((s) => [s.icon, s.url]));
  const platforms = (c.platforms || [])
    .filter((k) => socials[k])
    .map((k) => `<a href="${esc(socials[k])}" target="_blank" rel="noopener" aria-label="${esc(k)}">${socialIcons[k] || ""}</a>`)
    .join("");

  root.innerHTML = `
    <div class="creator-copy">
      <p class="creator-eyebrow mono">${esc(c.eyebrow || "")}</p>
      <h3 class="creator-title">${rich(c.title || "")}</h3>
      ${(c.paragraphs || []).map((p) => `<p>${rich(p)}</p>`).join("")}
      <div class="chips creator-topics">${(c.topics || []).map((t) => `<span class="chip">#${esc(t.replace(/\s+/g, ""))}</span>`).join("")}</div>
      <div class="creator-cta">
        <a class="btn btn-solid btn-sub" id="creator-subscribe" target="_blank" rel="noopener">
          <span class="btn-sub-icon">${ICONS.yt}</span>${esc(c.subscribeLabel || "Subscribe")}
        </a>
        ${platforms ? `<div class="socials creator-platforms">${platforms}</div>` : ""}
      </div>
    </div>
    <figure class="creator-media">
      <div class="yt-frame is-short" id="yt-frame" role="group" aria-label="Most-viewed video">
        <div class="yt-poster" aria-hidden="true"></div>
        <div class="yt-shade" aria-hidden="true"></div>
        <span class="yt-badge mono"><i class="yt-dot"></i>Most viewed</span>
        <button type="button" class="yt-play" aria-label="Play video">${ICONS.play}</button>
        <button type="button" class="yt-mute" aria-pressed="false" aria-label="Unmute video">${ICONS.muted}</button>
        <div class="yt-progress" aria-hidden="true"><i></i></div>
      </div>
      <figcaption class="yt-caption">
        <span class="yt-title"></span>
        <a class="yt-watch mono" target="_blank" rel="noopener" href="https://www.youtube.com/@${esc(handle)}">Watch on YouTube ${ICONS.ext}</a>
      </figcaption>
    </figure>`;

  wireSubscribe(root.querySelector("#creator-subscribe"), handle);

  const frame = root.querySelector("#yt-frame");
  const media = root.querySelector(".creator-media");
  loadVideo({ ...yt, handle }).then((video) => {
    if (!video) { root.classList.add("no-video"); media.remove(); return; }
    setupMedia(root, frame, video, reduceMotion);
  });
}

function setupMedia(root, frame, video, reduceMotion) {
  // Shape follows the video
  frame.style.aspectRatio = video.aspect || (video.isShort ? "9 / 16" : "16 / 9");
  frame.classList.toggle("is-short", !!video.isShort);
  root.classList.toggle("is-landscape", !video.isShort);

  // hqdefault exists for every video; background-size: cover crops its
  // letterbox bars away in both shapes, so it works as the poster for both
  if (video.id) {
    frame.querySelector(".yt-poster").style.backgroundImage =
      `url("https://i.ytimg.com/vi/${video.id}/hqdefault.jpg")`;
  }
  const title = root.querySelector(".yt-title");
  title.textContent = video.title || "";
  root.querySelector(".yt-watch").href = video.url;

  let player = null;
  const muteBtn = frame.querySelector(".yt-mute");
  const playBtn = frame.querySelector(".yt-play");

  // With reduced motion nothing autoplays: the poster waits for a tap
  if (reduceMotion) frame.classList.add("is-paused", "user-paused");
  const start = () => {
    if (player) return;
    player = mountPlayer(frame, video);
    frame.classList.remove("is-paused", "user-paused");
  };

  muteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    start();
    const m = !player.state.muted;
    player.setMuted(m);
    if (!m && !player.state.playing) { player.play(); frame.classList.remove("user-paused"); }
    muteBtn.innerHTML = m ? ICONS.muted : ICONS.sound;
    muteBtn.setAttribute("aria-label", m ? "Unmute video" : "Mute video");
    muteBtn.setAttribute("aria-pressed", String(!m));
    frame.classList.toggle("is-unmuted", !m);
  });

  // Tap the video (or the play button) to play / pause. An explicit pause
  // is remembered so scrolling back into view doesn't override it.
  const toggle = (e) => {
    e?.stopPropagation();
    if (!player) { start(); return; }
    player.state.playing ? player.pause() : player.play();
    frame.classList.toggle("user-paused", !player.state.playing);
  };
  frame.addEventListener("click", toggle);
  playBtn.addEventListener("click", toggle);

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        if (!reduceMotion) {
          if (!player) start();
          else if (!frame.classList.contains("user-paused")) player.play();
        }
      } else if (player && player.state.playing) {
        player.pause();
      }
    }
  }, { threshold: 0.35 });
  io.observe(frame);

  document.addEventListener("visibilitychange", () => {
    if (!player) return;
    if (document.hidden) player.pause();
    else if (!frame.classList.contains("user-paused") && isOnScreen(frame)) player.play();
  });
}

function isOnScreen(el) {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
}
