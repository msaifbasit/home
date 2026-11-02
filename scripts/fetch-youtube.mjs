#!/usr/bin/env node
/* ============================================================
   fetch-youtube.mjs — finds the channel's most-viewed upload
   and writes assets/youtube.json for the About > creator card.

   Runs inside the GitHub Pages deploy (daily + on every push), so
   the site always shows the current top video without anyone
   editing anything. No dependencies, Node 18+.

   Two sources, best first:
   1. YouTube Data API v3, if a YT_API_KEY repo secret exists.
      Scans every upload, so the pick is exact. The key lives in
      GitHub Secrets and never reaches the browser.
   2. Keyless. YouTube's public RSS feeds for the channel's
      uploads plus its auto-generated "popular shorts" and
      "popular videos" playlists, merged with the videos listed
      on the channel's own Shorts and Videos pages (each with its
      view count). The feeds are flaky at times, which is why the
      pages are read too; whichever answers is enough.

   If both fail, it keeps the last good file: first the one in the
   checkout, then the copy on the live site (SITE_URL). A failed
   fetch therefore never blanks the card.
   ============================================================ */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "assets/youtube.json");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const log = (...a) => console.log("[youtube]", ...a);

/* ---------- settings: env first, then config.js ---------- */
async function settings() {
  const cfg = await readFile(resolve(ROOT, "config.js"), "utf8").catch(() => "");
  // the creator.youtube block; falls back to the youtube social link
  const block = cfg.includes("youtube: {") ? cfg.slice(cfg.indexOf("youtube: {")) : "";
  const pick = (src, re) => (src.match(re) || [])[1] || "";
  return {
    handle: (process.env.YT_HANDLE ||
             pick(block, /handle:\s*"([^"]+)"/) ||
             pick(cfg, /youtube\.com\/@([\w.-]+)/)).replace(/^@/, ""),
    channelId: process.env.YT_CHANNEL_ID || pick(block, /channelId:\s*"(UC[\w-]{22})"/),
    apiKey: process.env.YT_API_KEY || "",
    siteUrl: (process.env.SITE_URL || "").replace(/\/$/, ""),
  };
}

async function get(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Cookie: "CONSENT=YES+1" },
    signal: AbortSignal.timeout(15000),
    ...opts,
  });
  return res;
}

/* ---------- channel id from @handle ---------- */
async function resolveChannelId(handle) {
  const res = await get(`https://www.youtube.com/@${encodeURIComponent(handle)}`);
  if (!res.ok) throw new Error(`handle page ${res.status}`);
  const html = await res.text();
  const id =
    (html.match(/"externalId":"(UC[\w-]{22})"/) || [])[1] ||
    (html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) || [])[1] ||
    (html.match(/"channelId":"(UC[\w-]{22})"/) || [])[1];
  if (!id) throw new Error("channel id not found on handle page");
  return id;
}

/* ---------- is it a Short? /shorts/ID answers 200, a normal video redirects ---------- */
async function isShort(id) {
  try {
    const res = await get(`https://www.youtube.com/shorts/${id}`, { method: "HEAD", redirect: "manual" });
    if (res.status === 200) return true;
    if (res.status >= 300 && res.status < 400) return false;
  } catch {}
  return null; // unknown
}

/* ---------- source 1: Data API ---------- */
async function viaApi({ apiKey, channelId, handle }) {
  const api = (path, params) =>
    get(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...params, key: apiKey })}`)
      .then(async (r) => { if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`); return r.json(); });

  const ch = await api("channels", {
    part: "id,contentDetails,statistics",
    ...(channelId ? { id: channelId } : { forHandle: "@" + handle }),
  });
  const channel = ch.items?.[0];
  if (!channel) throw new Error("channel not found");
  const uploads = channel.contentDetails.relatedPlaylists.uploads;

  const ids = [];
  let pageToken = "";
  do {
    const page = await api("playlistItems", { part: "contentDetails", playlistId: uploads, maxResults: 50, ...(pageToken && { pageToken }) });
    page.items.forEach((i) => ids.push(i.contentDetails.videoId));
    pageToken = page.nextPageToken || "";
  } while (pageToken && ids.length < 2000);

  let best = null;
  for (let i = 0; i < ids.length; i += 50) {
    const vids = await api("videos", { part: "snippet,statistics,contentDetails", id: ids.slice(i, i + 50).join(",") });
    for (const v of vids.items) {
      const views = Number(v.statistics.viewCount || 0);
      if (!best || views > best.views) best = { id: v.id, title: v.snippet.title, views, publishedAt: v.snippet.publishedAt, duration: v.contentDetails.duration };
    }
  }
  if (!best) throw new Error("channel has no public uploads");

  const subs = channel.statistics.hiddenSubscriberCount ? null : Number(channel.statistics.subscriberCount || 0);
  return { ...best, channelId: channel.id, subscribers: subs, source: "api" };
}

/* ---------- source 2: keyless RSS ---------- */
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function feed(param, tag) {
  try {
    const res = await get(`https://www.youtube.com/feeds/videos.xml?${param}`);
    if (!res.ok) return [];
    const xml = await res.text();
    return xml.split("<entry>").slice(1).map((e) => ({
      id: (e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1],
      title: decode((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ""),
      views: Number((e.match(/<media:statistics views="(\d+)"/) || [])[1] || 0),
      publishedAt: (e.match(/<published>([^<]+)<\/published>/) || [])[1] || "",
      tag,
    })).filter((v) => v.id);
  } catch { return []; }
}

/* ---------- source 3: the channel's own Shorts / Videos tabs ----------
   The page embeds its data as ytInitialData JSON. Walking the whole tree
   for the few renderer shapes YouTube uses keeps this tolerant of layout
   changes: whichever shape is present gets picked up. */
const parseViews = (txt) => {
  const m = String(txt || "").replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return 0;
  return Math.round(parseFloat(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[(m[2] || "").toUpperCase()] || 1));
};
const VIEWS_RE = /^[\d.,]+\s*[KMB]?\s+views?$/i;

function walk(o, fn) {
  if (!o || typeof o !== "object") return;
  fn(o);
  for (const v of Object.values(o)) walk(v, fn);
}
function findString(o, test) {
  let hit = "";
  walk(o, (n) => { if (!hit) for (const v of Object.values(n)) if (typeof v === "string" && test(v)) { hit = v; break; } });
  return hit;
}

async function viaTabs({ handle }) {
  const out = [];
  for (const [tab, tag] of [["shorts", "short"], ["videos", "video"]]) {
    let res;
    try { res = await get(`https://www.youtube.com/@${encodeURIComponent(handle)}/${tab}`); }
    catch (e) { log(`tab /${tab}: ${e.message}`); continue; }
    const html = res.ok ? await res.text() : "";
    const json = (html.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/) || [])[1];
    let data = null;
    try { data = json && JSON.parse(json); } catch {}
    const before = out.length;
    if (data) walk(data, (n) => {
      if (n.shortsLockupViewModel) {
        const v = n.shortsLockupViewModel;
        const id = v.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ||
                   (String(v.entityId || "").match(/([\w-]{11})$/) || [])[1];
        const title = v.overlayMetadata?.primaryText?.content || v.accessibilityText || "";
        const views = v.overlayMetadata?.secondaryText?.content || findString(v, (s) => VIEWS_RE.test(s));
        if (id) out.push({ id, title, views: parseViews(views), tag: "short" });
      } else if (n.reelItemRenderer) {
        const v = n.reelItemRenderer;
        out.push({ id: v.videoId, title: v.headline?.simpleText || "", views: parseViews(v.viewCountText?.simpleText), tag: "short" });
      } else if (n.videoRenderer) {
        const v = n.videoRenderer;
        out.push({ id: v.videoId, title: v.title?.runs?.[0]?.text || v.title?.simpleText || "",
                   views: parseViews(v.viewCountText?.simpleText || v.viewCountText?.runs?.[0]?.text), tag });
      } else if (n.lockupViewModel) {
        const v = n.lockupViewModel;
        if (v.contentId && /^[\w-]{11}$/.test(v.contentId)) {
          out.push({ id: v.contentId, title: v.metadata?.lockupMetadataViewModel?.title?.content || "",
                     views: parseViews(findString(v, (s) => VIEWS_RE.test(s))), tag });
        }
      }
    });
    log(`tab /${tab}: HTTP ${res.status}, ${data ? "data ok" : "no ytInitialData"}, ${out.length - before} videos`);
  }
  return out.filter((v) => v.id);
}

async function viaFeeds({ channelId, handle }) {
  const lists = [];
  if (channelId) {
    const tail = channelId.slice(2);
    const named = [
      [`channel_id=${channelId}`, "uploads"],
      [`playlist_id=UUPS${tail}`, "short"],   // popular shorts
      [`playlist_id=UULP${tail}`, "video"],   // popular videos
      [`playlist_id=UUSH${tail}`, "short"],   // recent shorts
    ];
    const got = await Promise.all(named.map(([p, t]) => feed(p, t)));
    named.forEach(([p], i) => log(`feed ${p.split("=")[0]}=${p.split("=")[1].slice(0, 4)}…: ${got[i].length} videos`));
    lists.push(...got);
  }
  if (handle) lists.push(await viaTabs({ handle }));

  const byId = new Map();
  for (const v of lists.flat()) {
    const prev = byId.get(v.id);
    byId.set(v.id, {
      ...prev, ...v,
      views: Math.max(v.views || 0, prev?.views || 0),
      title: v.title || prev?.title || "",
      tag: v.tag === "short" || prev?.tag === "short" ? "short" : v.tag,
    });
  }
  const all = [...byId.values()].sort((a, b) => b.views - a.views);
  if (!all.length) throw new Error("no videos found in feeds or channel tabs");
  log(`candidates: ${all.length}; top 3: ${all.slice(0, 3).map((v) => `${v.id}=${v.views}`).join(", ")}`);
  return { ...all[0], channelId, subscribers: null, source: "public" };
}

/* ---------- last good file ---------- */
async function lastGood(siteUrl) {
  try { return JSON.parse(await readFile(OUT, "utf8")); } catch {}
  if (siteUrl) {
    try {
      const r = await get(`${siteUrl}/assets/youtube.json`, { headers: { "User-Agent": UA } });
      if (r.ok) return await r.json();
    } catch {}
  }
  return null;
}

/* ---------- main ---------- */
const s = await settings();
log("handle:", s.handle || "(none)", "| channelId:", s.channelId || "(resolve)", "| api key:", s.apiKey ? "yes" : "no");

let top = null;
try {
  if (s.apiKey) {
    try { top = await viaApi(s); }
    catch (e) { log("Data API failed, trying public sources:", e.message); }
  }
  if (!top) {
    if (!s.channelId && s.handle) {
      try { s.channelId = await resolveChannelId(s.handle); log("channel id:", s.channelId); }
      catch (e) { log("channel id lookup failed:", e.message); }
    }
    top = await viaFeeds(s);
  }
} catch (e) {
  log("lookup failed:", e.message);
}

if (top) {
  let short = await isShort(top.id);
  if (short === null) short = top.tag ? top.tag === "short" : /^PT(\d+S|[0-2]M(\d+S)?|3M0?S?)$/.test(top.duration || "");
  const data = {
    id: top.id,
    title: top.title,
    views: top.views,
    publishedAt: top.publishedAt || null,
    isShort: !!short,
    aspect: short ? "9 / 16" : "16 / 9",
    url: short ? `https://www.youtube.com/shorts/${top.id}` : `https://www.youtube.com/watch?v=${top.id}`,
    channelId: top.channelId,
    handle: s.handle,
    subscribers: top.subscribers,
    source: top.source,
    fetchedAt: new Date().toISOString(),
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(data, null, 2) + "\n");
  log(`top video: ${data.id} (${data.views} views, ${data.isShort ? "short" : "landscape"}) via ${data.source}`);
} else {
  const prev = await lastGood(s.siteUrl);
  if (prev) {
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify(prev, null, 2) + "\n");
    log("kept last good video:", prev.id);
  } else {
    log("no data and no previous file; the site will use its fallback");
  }
}
