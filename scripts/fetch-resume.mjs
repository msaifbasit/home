#!/usr/bin/env node
/* ============================================================
   fetch-resume.mjs — turns the live resume into resume.pdf

   Runs inside the GitHub Pages deploy (daily + on every push).
   The resume stays where it is (a Word file in Google Drive,
   config.js → resumeUrl, shared as "anyone with the link"), and
   the site always serves a fresh PDF of it at /resume.pdf.

   1. Download the .docx from Drive (always: it is also how we
      tell whether the resume changed since the last run).
   2. PDF, best first:
        a. Google's own export, so the PDF looks exactly like the
           document does in Google Docs;
        b. LibreOffice, converting the .docx (installed on demand,
           with fonts metric-compatible with Calibri / Cambria /
           Arial / Times so the layout holds).
   3. Write resume.pdf and assets/resume.json ({ updatedAt, ... }).
      updatedAt only moves when the document itself changed.

   If everything fails, the copy on the live site (SITE_URL) is
   kept, so a bad day never takes the PDF down.
   ============================================================ */

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PDF_OUT = resolve(ROOT, "resume.pdf");
const META_OUT = resolve(ROOT, "assets/resume.json");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const log = (...a) => console.log("[resume]", ...a);

const isPdf = (b) => b.length > 1000 && b.subarray(0, 5).toString() === "%PDF-";
const isDocx = (b) => b.length > 1000 && b[0] === 0x50 && b[1] === 0x4b; // "PK" zip header
const sha = (b) => createHash("sha256").update(b).digest("hex").slice(0, 16);

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(30000) });
  return { status: res.status, type: res.headers.get("content-type") || "", buf: Buffer.from(await res.arrayBuffer()) };
}

/* ---------- settings ---------- */
async function settings() {
  const cfg = await readFile(resolve(ROOT, "config.js"), "utf8").catch(() => "");
  const url = process.env.RESUME_URL || (cfg.match(/resumeUrl:\s*\n?\s*"([^"]+)"/) || [])[1] || "";
  const id = (url.match(/\/d\/([\w-]{20,})/) || url.match(/[?&]id=([\w-]{20,})/) || [])[1] || "";
  return { url, id, siteUrl: (process.env.SITE_URL || "").replace(/\/$/, "") };
}

/* ---------- 1. the .docx ---------- */
async function downloadDocx(id) {
  for (const u of [
    `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${id}`,
    `https://docs.google.com/document/d/${id}/export?format=docx`,
  ]) {
    try {
      const r = await get(u);
      if (r.status === 200 && isDocx(r.buf)) { log(`docx: ${r.buf.length} bytes`); return r.buf; }
      log(`docx try ${new URL(u).host}: HTTP ${r.status}, ${r.type.split(";")[0]} (not a docx)`);
    } catch (e) { log(`docx try failed: ${e.message}`); }
  }
  return null;
}

/* ---------- 2a. Google's own PDF ---------- */
async function googlePdf(id) {
  try {
    const r = await get(`https://docs.google.com/document/d/${id}/export?format=pdf`);
    if (r.status === 200 && isPdf(r.buf)) return r.buf;
    log(`google export: HTTP ${r.status}, ${r.type.split(";")[0]} (no pdf)`);
  } catch (e) { log(`google export failed: ${e.message}`); }
  return null;
}

/* ---------- 2b. LibreOffice ---------- */
function haveSoffice() {
  try { execFileSync("soffice", ["--version"], { stdio: "ignore" }); return true; } catch { return false; }
}
function installSoffice() {
  if (!process.env.CI) return false;
  log("installing LibreOffice + fonts…");
  try {
    execFileSync("sudo", ["apt-get", "update", "-qq"], { stdio: "inherit" });
    execFileSync("sudo", ["apt-get", "install", "-y", "-qq", "--no-install-recommends",
      "libreoffice-writer", "fonts-crosextra-carlito", "fonts-crosextra-caladea",
      "fonts-liberation", "fonts-dejavu-core"], { stdio: "inherit" });
    return haveSoffice();
  } catch (e) { log("install failed:", e.message); return false; }
}
async function libreofficePdf(docx) {
  if (!haveSoffice() && !installSoffice()) { log("LibreOffice not available"); return null; }
  const dir = join(tmpdir(), `resume-${process.pid}`);
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(join(dir, "resume.docx"), docx);
    execFileSync("soffice", ["--headless", "--norestore", "--convert-to", "pdf", "--outdir", dir, join(dir, "resume.docx")],
      { stdio: "ignore", timeout: 120000 });
    const pdf = await readFile(join(dir, "resume.pdf"));
    return isPdf(pdf) ? pdf : null;
  } catch (e) { log("LibreOffice conversion failed:", e.message); return null; }
  finally { await rm(dir, { recursive: true, force: true }); }
}

/* ---------- previous run, from the live site ---------- */
async function previous(siteUrl) {
  if (!siteUrl) return {};
  const out = {};
  try { const r = await get(`${siteUrl}/assets/resume.json`); if (r.status === 200) out.meta = JSON.parse(r.buf.toString()); } catch {}
  try { const r = await get(`${siteUrl}/resume.pdf`); if (r.status === 200 && isPdf(r.buf)) out.pdf = r.buf; } catch {}
  return out;
}

/* ---------- main ---------- */
const s = await settings();
if (!s.id) { log("no Google Drive file id in resumeUrl; skipping"); process.exit(0); }
log("file id:", s.id);

const prev = await previous(s.siteUrl);
const docx = await downloadDocx(s.id);
let engine = "google";
let pdf = await googlePdf(s.id);
if (!pdf && docx) { engine = "libreoffice"; pdf = await libreofficePdf(docx); }

if (pdf) {
  // Fingerprint the document, not the PDF: PDFs embed a fresh timestamp
  // every export, but the .docx bytes only change when the resume does.
  const hash = docx ? sha(docx) : sha(pdf);
  const changed = !prev.meta || prev.meta.hash !== hash;
  const now = new Date().toISOString();
  const meta = {
    updatedAt: changed ? now : prev.meta.updatedAt,
    checkedAt: now,
    hash,
    engine,
    bytes: pdf.length,
  };
  await writeFile(PDF_OUT, pdf);
  await mkdir(dirname(META_OUT), { recursive: true });
  await writeFile(META_OUT, JSON.stringify(meta, null, 2) + "\n");
  log(`resume.pdf written: ${pdf.length} bytes via ${engine}; ${changed ? "resume CHANGED since last run" : "resume unchanged"} (updatedAt ${meta.updatedAt.slice(0, 10)})`);
  try {
    log("pages:", (execFileSync("pdfinfo", [PDF_OUT]).toString().match(/Pages:\s*(\d+)/) || [])[1] || "?");
    log("fonts:\n" + execFileSync("pdffonts", [PDF_OUT]).toString().trim());
  } catch {}
} else if (prev.pdf) {
  await writeFile(PDF_OUT, prev.pdf);
  if (prev.meta) { await mkdir(dirname(META_OUT), { recursive: true }); await writeFile(META_OUT, JSON.stringify(prev.meta, null, 2) + "\n"); }
  log("could not build a new PDF; kept the one on the live site");
} else {
  log("could not build a PDF and there is no previous one; the site falls back to the live doc");
}
