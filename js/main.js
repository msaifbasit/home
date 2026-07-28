/* ============================================================
   main.js — renders all content from config.js into the page
   and wires up interactions (typing, nav, reveals, tilt…).
   You should rarely need to edit this file: content changes
   belong in config.js.
   ============================================================ */

import CONFIG from "../config.js";

const $ = (sel) => document.querySelector(sel);
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Inline SVG icon library ---------- */
const SOCIAL_ICONS = {
  github:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12v3.15c0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg>',
  linkedin:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.55V9h3.57v11.45Z"/></svg>',
  twitter:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z"/></svg>',
  facebook:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.09 24 18.1 24 12.07Z"/></svg>',
  instagram:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.9 5.9 0 0 0-2.13 1.38A5.9 5.9 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13a5.9 5.9 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm7.85-10.4a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0Z"/></svg>',
  email:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12.71 1.5 5.25V18a1.5 1.5 0 0 0 1.5 1.5h18a1.5 1.5 0 0 0 1.5-1.5V5.25L12 12.71ZM12 10.5 22.36 3.14A1.5 1.5 0 0 0 21 2.25H3a1.5 1.5 0 0 0-1.36.89L12 10.5Z"/></svg>',
  scholar:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.242 13.769 0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5c-2.977 0-5.548 1.748-6.758 4.269ZM12 10a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z"/></svg>',
  medium:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12ZM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42ZM24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12Z"/></svg>',
};

/* Icons for skill groups, publications and certifications */
const SKILL_ICONS = {
  brain:     '<svg viewBox="0 0 24 24"><path d="M9.5 3A2.5 2.5 0 0 0 7 5.5 2.5 2.5 0 0 0 5 8a2.5 2.5 0 0 0 .5 1.5A2.5 2.5 0 0 0 5 13a2.5 2.5 0 0 0 2 2.45V17a2.5 2.5 0 0 0 5 0V5.5A2.5 2.5 0 0 0 9.5 3ZM14.5 3A2.5 2.5 0 0 1 17 5.5 2.5 2.5 0 0 1 19 8a2.5 2.5 0 0 1-.5 1.5A2.5 2.5 0 0 1 19 13a2.5 2.5 0 0 1-2 2.45V17a2.5 2.5 0 0 1-5 0"/></svg>',
  robot:     '<svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 14h.01M15 14h.01M9 17.5h6"/><circle cx="12" cy="3" r="1.4"/></svg>',
  code:      '<svg viewBox="0 0 24 24"><path d="m8 6-6 6 6 6M16 6l6 6-6 6"/></svg>',
  chart:     '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/></svg>',
  layers:    '<svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5M3 17.5l9 5 9-5"/></svg>',
  dashboard: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
  cloud:     '<svg viewBox="0 0 24 24"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 10.4 4 4 0 0 0 6.5 19h11Z"/></svg>',
};
const PUB_ICONS = {
  journal: '<svg viewBox="0 0 24 24"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H19v18H6.5A2.5 2.5 0 0 0 4 22V4.5Z"/><path d="M8 7h7M8 11h7"/></svg>',
  article: '<svg viewBox="0 0 24 24"><path d="M4 4h13v16H6a2 2 0 0 1-2-2V4Z"/><path d="M17 8h3v10a2 2 0 0 1-2 2M8 8h5M8 12h5M8 16h4"/></svg>',
};
const CERT_ICON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-2.5 5 2.5-1.5-7"/></svg>';

const PROJECT_ICONS = {
  chat:  '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5 8.38 8.38 0 0 1 8.5 8.5Z"/></svg>',
  vision:'<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9Z"/><circle cx="12" cy="12" r="3.5"/></svg>',
  leaf:  '<svg viewBox="0 0 24 24"><path d="M6 21c0-9 4-15 14-17-1 10-6 15-14 17Z"/><path d="M6 21c2.5-5.5 6-9.5 11-12"/></svg>',
  eye:   '<svg viewBox="0 0 24 24"><path d="M1 12s4-7.5 11-7.5S23 12 23 12s-4 7.5-11 7.5S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  film:  '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 4v16M17 4v16M2 9h5M2 15h5M17 9h5M17 15h5"/></svg>',
  cube:  '<svg viewBox="0 0 24 24"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>',
  code:  '<svg viewBox="0 0 24 24"><path d="m8 6-6 6 6 6M16 6l6 6-6 6"/></svg>',
};
const EXT_ICON = '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg>';

/* ---------- Helpers ---------- */
function socialLinks(container) {
  const el = $(container);
  el.innerHTML = CONFIG.socials
    .map(
      (s) =>
        `<a href="${s.url}" target="_blank" rel="noopener" aria-label="${s.icon}">${SOCIAL_ICONS[s.icon] || SOCIAL_ICONS.email}</a>`
    )
    .join("");
}

/* ---------- Render everything from CONFIG ---------- */
function render() {
  const { identity, about, skills, projects, publications, certifications, contact } = CONFIG;

  // Theme accents
  document.documentElement.style.setProperty("--accent", CONFIG.theme.accent);
  document.documentElement.style.setProperty("--accent-2", CONFIG.theme.accent2);

  // Identity
  const fullName = [identity.firstName, identity.middleName, identity.lastName]
    .filter(Boolean)
    .join(" ");
  document.title = `${fullName} — ${identity.roles[0]}`;
  $("#hero-name").textContent = fullName;
  $("#hero-tagline").textContent = identity.tagline;
  $("#about-img").src = identity.photo;
  $("#about-img").alt = `Portrait of ${fullName}`;

  // Resume buttons (hidden when no URL is set)
  for (const id of ["#nav-resume", "#hero-resume"]) {
    const btn = $(id);
    if (CONFIG.resumeUrl) btn.href = CONFIG.resumeUrl;
    else btn.style.display = "none";
  }

  // About
  $("#about-heading").textContent = about.heading;
  $("#about-paragraphs").innerHTML = about.paragraphs.map((p) => `<p>${p}</p>`).join("");
  $("#about-stats").innerHTML = about.stats
    .map(
      (s) => `<div class="stat-card reveal">
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>`
    )
    .join("");

  // Skills
  $("#skills-heading").textContent = skills.heading;
  $("#tech-skills").innerHTML = skills.technical
    .map(
      (g) => `<div class="tech-card reveal">
        <div class="tech-head">
          <span class="tech-icon">${SKILL_ICONS[g.icon] || SKILL_ICONS.code}</span>
          <h3>${g.group}</h3>
        </div>
        <div class="chips">${g.items.map((i) => `<span class="chip">${i}</span>`).join("")}</div>
      </div>`
    )
    .join("");
  $("#soft-heading").textContent = skills.softHeading || "Professional Skills";
  $("#soft-skills").innerHTML = skills.soft.map((s) => `<span class="chip">${s}</span>`).join("");

  // Projects — newest first (by `date`, entries without one go last)
  $("#projects-heading").textContent = projects.heading;
  const sortedProjects = [...projects.items].sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || ""))
  );
  $("#projects-grid").innerHTML = sortedProjects
    .map(
      (p) => `<a class="project-card reveal tilt-card" href="${p.link}" target="_blank" rel="noopener">
        <div class="project-top">
          <div class="project-icon">${PROJECT_ICONS[p.icon] || PROJECT_ICONS.code}</div>
          <div class="project-ext">${EXT_ICON}</div>
        </div>
        <h3 class="project-title">${p.title}</h3>
        <p class="project-desc">${p.description}</p>
        <div class="project-tags">${p.tags.map((t) => `<span>${t}</span>`).join("")}</div>
      </a>`
    )
    .join("");

  // Publications — featured entries always pinned to the top
  renderPublications(publications);

  // Certifications — hidden entirely until entries are added
  renderCertifications(certifications);

  // Contact
  $("#contact-heading").textContent = contact.heading;
  $("#contact-blurb").textContent = contact.blurb;
  $("#contact-email").href = `mailto:${contact.email}`;
  $("#contact-location").textContent = `// based in ${identity.location}`;
  initEmailChooser(contact.email);

  // Socials + footer
  socialLinks("#hero-socials");
  socialLinks("#contact-socials");
  $("#footer-text").innerHTML =
    `Designed & built by <a href="${CONFIG.socials[0]?.url || "#"}" target="_blank" rel="noopener">${identity.shortName}</a> · ${new Date().getFullYear()}`;
}

/* ---------- Publications ---------- */
function renderPublications(publications) {
  const section = document.querySelector("#publications");
  if (!publications || !publications.items.length) {
    section.style.display = "none";
    return;
  }
  $("#publications-heading").textContent = publications.heading;
  // featured first, otherwise config order is preserved
  const items = [...publications.items].sort(
    (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
  );
  $("#publications-list").innerHTML = items
    .map(
      (p) => `<article class="pub-card reveal${p.featured ? " featured" : ""}">
        <div class="pub-icon">${PUB_ICONS[p.icon] || PUB_ICONS.article}</div>
        <div class="pub-body">
          <div class="pub-head">
            <h3 class="pub-title">${p.title}</h3>
            <a class="pub-btn" href="${p.link}" target="_blank" rel="noopener">
              ${p.linkLabel || "View"} ${EXT_ICON}
            </a>
          </div>
          ${p.venue ? `<p class="pub-venue">${p.venue}</p>` : ""}
          ${p.meta ? `<p class="pub-meta mono">${p.meta}</p>` : ""}
          <p class="pub-desc">${p.description}</p>
          ${p.tags?.length
            ? `<div class="project-tags">${p.tags.map((t) => `<span>${t}</span>`).join("")}</div>`
            : ""}
        </div>
      </article>`
    )
    .join("");
}

/* ---------- Certifications ---------- */
function renderCertifications(certifications) {
  const section = document.querySelector("#certifications");
  if (!certifications || !certifications.items.length) {
    section.style.display = "none";
    return;
  }
  section.style.display = "";
  $("#certifications-heading").textContent = certifications.heading;
  $("#certifications-grid").innerHTML = certifications.items
    .map((c) => {
      const inner = `
        <div class="cert-icon">${CERT_ICON}</div>
        <div>
          <h3 class="cert-name">${c.name}</h3>
          ${c.issuer ? `<p class="cert-issuer">${c.issuer}</p>` : ""}
          ${c.year ? `<p class="cert-year mono">${c.year}</p>` : ""}
        </div>`;
      return c.link
        ? `<a class="cert-card reveal" href="${c.link}" target="_blank" rel="noopener">${inner}<span class="cert-ext">${EXT_ICON}</span></a>`
        : `<div class="cert-card reveal">${inner}</div>`;
    })
    .join("");
}

/* ---------- Email chooser ----------
   mailto: links silently do nothing when no desktop mail app is
   configured, so "Say Hello" opens a chooser instead: email app,
   Gmail in the browser, or copy the address. */
function initEmailChooser(email) {
  const modal = document.createElement("div");
  modal.className = "email-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Choose how to send an email");
  modal.innerHTML = `
    <div class="email-card">
      <button class="email-close" aria-label="Close">&#10005;</button>
      <h3>Say Hello &#128075;</h3>
      <p class="email-addr">${email}</p>
      <div class="email-opts">
        <a class="email-opt" href="https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}" target="_blank" rel="noopener">
          <span class="opt-ic">&#127760;</span> Open Gmail in browser
        </a>
        <a class="email-opt" href="mailto:${email}">
          <span class="opt-ic">&#128231;</span> Open my email app
        </a>
        <button class="email-opt" data-copy>
          <span class="opt-ic">&#128203;</span> <span data-copy-label>Copy email address</span>
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const open = () => modal.classList.add("open");
  const close = () => modal.classList.remove("open");

  $("#contact-email").addEventListener("click", (e) => {
    e.preventDefault();
    open();
  });
  modal.querySelector(".email-close").addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  modal.querySelectorAll("a.email-opt").forEach((a) => a.addEventListener("click", close));

  const copyBtn = modal.querySelector("[data-copy]");
  const copyLabel = modal.querySelector("[data-copy-label]");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(email);
      copyLabel.textContent = "Copied!";
    } catch {
      // Clipboard API can be unavailable (http, old browsers)
      const tmp = document.createElement("textarea");
      tmp.value = email;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand("copy");
      tmp.remove();
      copyLabel.textContent = "Copied!";
    }
    setTimeout(() => {
      copyLabel.textContent = "Copy email address";
      close();
    }, 900);
  });
}

/* ---------- Typing animation ----------
   Driven by wall-clock time rather than one setTimeout per character:
   if the main thread stalls (e.g. heavy work elsewhere), the text
   instantly catches up to where it should be instead of freezing
   mid-word and resuming in slow motion. */
function initTyping() {
  const el = $("#typed");
  const roles = CONFIG.identity.roles;
  if (prefersReducedMotion) {
    el.textContent = roles[0];
    return;
  }
  const TYPE = 75, DELETE = 40, HOLD = 1800, GAP = 350;
  let roleIdx = 0;
  let phase = "type";
  let phaseStart = performance.now();

  function advance(now) {
    const word = roles[roleIdx % roles.length];
    const elapsed = now - phaseStart;
    if (phase === "type") {
      const chars = Math.min(word.length, Math.floor(elapsed / TYPE));
      el.textContent = word.slice(0, chars);
      if (chars >= word.length) { phase = "hold"; phaseStart += word.length * TYPE; }
    } else if (phase === "hold") {
      if (elapsed >= HOLD) { phase = "delete"; phaseStart += HOLD; }
    } else if (phase === "delete") {
      const remain = Math.max(0, word.length - Math.floor(elapsed / DELETE));
      el.textContent = word.slice(0, remain);
      if (remain === 0) { phase = "gap"; phaseStart += word.length * DELETE; }
    } else {
      if (elapsed >= GAP) { phase = "type"; phaseStart += GAP; roleIdx++; }
    }
  }

  // Long gaps (app switched away, screen off) are treated as paused
  // time and skipped, so typing resumes where it left off instead of
  // fast-forwarding. Short gaps (~boot stalls) still catch up.
  let lastTick = performance.now();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      const now = performance.now();
      phaseStart += now - lastTick;
      lastTick = now;
    }
  });
  (function loop() {
    const now = performance.now();
    if (now - lastTick > 3000) phaseStart += now - lastTick;
    lastTick = now;
    // A few passes per tick let multiple phases catch up after a stall
    for (let i = 0; i < 8; i++) advance(now);
    setTimeout(loop, 35);
  })();
}

/* ---------- Navbar behaviour ---------- */
function initNav() {
  const navbar = $("#navbar");
  const toggle = $("#nav-toggle");
  const links = $("#nav-links");

  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 30);
  }, { passive: true });

  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );

  // Scroll-spy: highlight the nav link of the section in view
  const sections = document.querySelectorAll("main section[id]");
  const navById = {};
  document.querySelectorAll(".nav-link[href^='#']").forEach((a) => {
    navById[a.getAttribute("href").slice(1)] = a;
  });
  const spy = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        document.querySelectorAll(".nav-link.active").forEach((el) => el.classList.remove("active"));
        navById[e.target.id]?.classList.add("active");
      }),
    { rootMargin: "-45% 0px -50% 0px" }
  );
  sections.forEach((s) => spy.observe(s));
}

/* ---------- Reveal-on-scroll + skill bar animation ---------- */
function initReveals() {
  const obs = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("visible");
        obs.unobserve(e.target);
      }),
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
}

/* ---------- 3D tilt on cards (desktop pointers only) ---------- */
function initTilt() {
  if (prefersReducedMotion || !window.matchMedia("(hover: hover)").matches) return;
  document.querySelectorAll(".tilt-card").forEach((card) => {
    card.addEventListener("mousemove", (ev) => {
      const r = card.getBoundingClientRect();
      const rx = ((ev.clientY - r.top) / r.height - 0.5) * -8;
      const ry = ((ev.clientX - r.left) / r.width - 0.5) * 8;
      card.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
    });
    card.addEventListener("mouseleave", () => (card.style.transform = ""));
  });
}

/* ---------- Boot ---------- */
const hidePreloader = () => document.querySelector("#preloader").classList.add("done");
window.addEventListener("load", hidePreloader);
// Safety net: never keep the preloader up longer than 2.5 s
setTimeout(hidePreloader, 2500);

render();
initTyping();
initNav();
initReveals();
initTilt();
if (CONFIG.scene.enabled && !prefersReducedMotion) {
  // The scene is a ~10KB dependency-free WebGL module (js/bg-scene.js),
  // so there is nothing heavy to parse. It still runs inside a Web
  // Worker on an OffscreenCanvas where supported so rendering never
  // touches the main thread; older browsers fall back to a deferred
  // main-thread load. Either way the canvas fades in (css .on class)
  // once running, and the site stays fully usable without WebGL.
  const canvas = document.querySelector("#bg-canvas");
  const sceneParams = () => {
    const isMobile = window.matchMedia("(max-width: 720px)").matches;
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
      isMobile,
      accent: CONFIG.theme.accent,
      accent2: CONFIG.theme.accent2,
      particleCount: CONFIG.scene.particleCount,
      linkDistance: CONFIG.scene.linkDistance,
      // Strong mouse parallax on desktop; the original gentle values on
      // phones, where "pointer" movement is really touch scrolling
      parallax: isMobile
        ? { x: 1.2, y: 0.8, ease: 0.04 }
        : { x: 3.2, y: 2.2, ease: 0.06 },
      // Cursor spotlight is a desktop-only effect (no hover on touch)
      mouseGlow: isMobile ? 0 : CONFIG.scene.mouseGlow ?? 1,
    };
  };

  // Forward page input to the scene wherever it lives
  const wireEvents = (send) => {
    window.addEventListener("pointermove", (e) => {
      send.pointer(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1
      );
    }, { passive: true });
    window.addEventListener("scroll", () => send.scroll(window.scrollY), { passive: true });
    window.addEventListener("resize", () => {
      send.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    });
    document.addEventListener("visibilitychange", () => send.visibility(document.hidden));
  };

  const startInWorker = () => {
    const offscreen = canvas.transferControlToOffscreen();
    const worker = new Worker(new URL("./scene-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      if (e.data.type === "ready") canvas.classList.add("on");
    };
    worker.onerror = (err) => {
      console.warn("3D scene worker failed:", err.message || err);
      canvas.style.display = "none";
      worker.terminate();
    };
    worker.postMessage({ type: "init", canvas: offscreen, params: sceneParams() }, [offscreen]);
    wireEvents({
      pointer: (x, y) => worker.postMessage({ type: "pointer", x, y }),
      scroll: (y) => worker.postMessage({ type: "scroll", y }),
      resize: (width, height, pixelRatio) =>
        worker.postMessage({ type: "resize", width, height, pixelRatio }),
      visibility: (hidden) => worker.postMessage({ type: "visibility", hidden }),
    });
  };

  const startOnMainThread = () =>
    import("./bg-scene.js")
      .then(({ initScene }) => {
        const api = initScene(canvas, sceneParams());
        canvas.classList.add("on");
        wireEvents({
          pointer: api.pointer,
          scroll: api.scroll,
          resize: api.resize,
          visibility: api.setPaused,
        });
      })
      .catch((err) => {
        console.warn("3D scene disabled:", err);
        canvas.style.display = "none";
      });

  const start = () => {
    if (canvas.transferControlToOffscreen && window.Worker) {
      try {
        startInWorker();
      } catch (err) {
        console.warn("3D scene worker unavailable:", err);
        canvas.style.display = "none";
      }
    } else {
      startOnMainThread();
    }
  };
  // The scene is light enough to start immediately after first paint —
  // no need to wait for the load event (a slow font or image would
  // only delay the background for nothing).
  if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 800 });
  else setTimeout(start, 100);
}
