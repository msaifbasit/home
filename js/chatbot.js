/* ============================================================
   chatbot.js — "Ask about Saif" assistant
   ------------------------------------------------------------
   Two answer engines behind one UI:

   1. Built-in (default). A retrieval engine over the same CONFIG
      that renders the page, so answers can never drift from the
      site. No API key, no backend, no network call — it replies
      in a few milliseconds and works offline.

   2. LLM (optional). Set chat.apiUrl in config.js to your own
      proxy and the widget talks to a real model instead, falling
      back to the built-in engine if the request fails.

   Why a proxy and not a direct API call: this site is static and
   public, so any key shipped in this file would be readable by
   every visitor. worker/chat-worker.js is a ready-to-deploy proxy
   that keeps the key server-side.
   ============================================================ */

/* ---------- text utilities ---------- */
const STOP = new Set(["a","an","the","is","are","was","were","be","been","am","do","does","did",
  "of","in","on","at","to","for","with","and","or","but","if","then","than","so","as","by","from",
  "he","she","they","it","his","her","their","its","you","your","i","me","my","we","us","our",
  "what","which","who","whom","whose","when","where","why","how","can","could","would","should",
  "have","has","had","tell","about","give","show","know","any","some","more","much","many","also",
  "please","hey","hi","hello","there","that","this","these","those","saif","basit","muhammad"]);

/* Recruiters rarely type the same word the config uses. */
const SYNONYMS = {
  ml: ["machine", "learning"], ai: ["artificial", "intelligence"],
  cv: ["computer", "vision"], nlp: ["natural", "language", "processing"],
  dl: ["deep", "learning"], llm: ["large", "language", "model"],
  llms: ["large", "language", "model"], genai: ["generative", "ai"],
  paper: ["publication", "research", "ieee"], papers: ["publication", "research", "ieee"],
  research: ["publication", "ieee"], published: ["publication", "ieee"],
  cert: ["certification"], certs: ["certification"], certificate: ["certification"],
  certified: ["certification"], certifications: ["certification"],
  job: ["experience", "work"], jobs: ["experience", "work"], role: ["experience", "work"],
  career: ["experience", "work"], employment: ["experience", "work"],
  cv_doc: ["resume"], study: ["education", "degree"], studied: ["education", "degree"],
  university: ["education", "degree"], college: ["education", "degree"],
  school: ["education", "degree"], graduate: ["education", "degree"],
  bscs: ["education", "degree", "computer", "science"],
  tech: ["skill", "technology"], stack: ["skill", "technology"],
  tools: ["skill", "technology"], languages: ["skill", "programming"],
  portfolio: ["project"], projects: ["project"], built: ["project", "build"],
  email: ["contact"], reach: ["contact"], hire: ["contact", "available"],
  hiring: ["contact", "available"], recruit: ["contact", "available"],
  aws: ["amazon", "cloud", "certification"], gcp: ["google", "cloud"],
  vision: ["computer", "vision"], torch: ["pytorch"], tf: ["tensorflow"],
  based: ["location"], live: ["location"], lives: ["location"], from: ["location"],
};

const norm = (s) => String(s || "").toLowerCase().replace(/[^\w\s+#.&-]/g, " ").replace(/\s+/g, " ").trim();

function tokenize(s) {
  const raw = norm(s).split(" ").filter(Boolean);
  const out = [];
  for (const w of raw) {
    if (!STOP.has(w) && w.length > 1) out.push(w);
    const syn = SYNONYMS[w];
    if (syn) out.push(...syn);
  }
  return out;
}

/* ---------- knowledge base, built from the same CONFIG the page renders ---------- */
function buildKB(CONFIG) {
  const id = CONFIG.identity;
  const full = [id.firstName, id.middleName, id.lastName].filter(Boolean).join(" ");
  const chat = CONFIG.chat || {};
  const docs = [];
  const add = (kind, title, text, render) => docs.push({ kind, title, text: norm(text), render });

  (CONFIG.about?.paragraphs || []).forEach((p, i) =>
    add("about", "About", p, () => p));

  (CONFIG.skills?.technical || []).forEach((g) =>
    add("skill", g.group, g.group + " " + g.items.join(" "),
      () => `**${g.group}** — ${g.items.join(", ")}.`));

  if (CONFIG.skills?.soft?.length) {
    add("soft", "Professional skills", CONFIG.skills.soft.join(" "),
      () => `On the human side: ${CONFIG.skills.soft.join(", ")}.`);
  }

  (CONFIG.projects?.items || []).forEach((p) =>
    add("project", p.title, [p.title, p.description, (p.tags || []).join(" ")].join(" "),
      () => `**${p.title}** — ${p.description} _Built with ${(p.tags || []).join(", ")}._` +
            (p.link ? ` [See the code](${p.link})` : "")));

  (CONFIG.publications?.items || []).forEach((p) =>
    add("publication", p.title, [p.title, p.venue, p.description, (p.tags || []).join(" ")].join(" "),
      () => `**${p.title}**${p.venue ? ` — ${p.venue}.` : ""} ${p.description}` +
            (p.meta ? ` _${p.meta}_` : "") + (p.link ? ` [${p.linkLabel || "Read it"}](${p.link})` : "")));

  (CONFIG.certifications?.items || []).forEach((c) =>
    add("certification", c.name, [c.name, c.issuer, c.year].join(" "),
      () => `**${c.name}** — ${c.issuer}${c.year ? `, ${c.year}` : ""}.` +
            (c.link ? ` [View credential](${c.link})` : "")));

  (chat.experience || []).forEach((e) =>
    add("experience", e.role, [e.role, e.org, e.period, e.summary].join(" "),
      () => `**${e.role}** at ${e.org}${e.period ? ` (${e.period})` : ""}. ${e.summary || ""}`));

  (chat.education || []).forEach((e) =>
    add("education", e.degree, [e.degree, e.org, e.period].join(" "),
      () => `**${e.degree}** — ${e.org}${e.period ? `, ${e.period}` : ""}.`));

  (chat.facts || []).forEach((f, i) => add("fact", "Fact " + i, f, () => f));

  return { id, full, chat, docs, CONFIG };
}

/* ---------- scoring ---------- */
function retrieve(kb, query, kinds, limit = 3) {
  const q = tokenize(query);
  if (!q.length) return [];
  const scored = kb.docs
    .filter((d) => !kinds || kinds.includes(d.kind))
    .map((d) => {
      let s = 0;
      for (const t of new Set(q)) {
        if (d.text.includes(t)) s += t.length > 4 ? 2 : 1;
        if (norm(d.title).includes(t)) s += 2;
      }
      // long documents shouldn't win on length alone
      return { d, s: s / Math.sqrt(Math.max(d.text.length, 60) / 60) };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.d);
}

/* ---------- scope guard: professional topics only ---------- */
const PERSONAL = /\b(marriage|married|wife|husband|girlfriend|boyfriend|dating|single|relationship|kids|children|family|parents|mother|father|sibling|brother|sister|religion|religious|muslim|christian|pray|politic|vote|salary|pay|wage|income|earn|money|rich|net worth|age|birthday|born|dob|weight|height|health|illness|disease|medical|address|phone|mobile|whatsapp|visa|passport|nationality|race|caste|gender|sexual|drink|smoke|party)\b|\bhow old\b|\bold (is|are)\b/i;

const OFF_TOPIC = /\b(weather|recipe|cook|football|cricket|movie|song|lyrics|joke about|write.{0,12}(essay|poem|story)|homework|assignment|translate|stock|crypto|bitcoin|who is the president|capital of)\b/i;

const DEFLECT_PERSONAL = [
  "That one's filed under 'personal', and I only have clearance for the professional folder. Ask me about his work though — I'm chatty about that.",
  "I'm strictly a work-talk bot. Saif's private life isn't in my training data, and honestly he'd like to keep it that way.",
  "Nice try, but I only do professional questions. Want to hear about his IEEE paper instead? I never get tired of that one.",
];
const DEFLECT_OFFTOPIC = [
  "I'd be a terrible general assistant — I only know one topic, and that topic is Saif's professional work. Try me on skills, projects or publications.",
  "That's outside my job description. I'm here for questions about Saif's work: AI/ML, projects, publications, certifications.",
];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------- the built-in answer engine ---------- */
function makeEngine(kb) {
  const { id, full, chat, CONFIG } = kb;
  const roles = id.roles || [];
  const email = CONFIG.contact?.email;
  const resume = CONFIG.resumeUrl;

  const listOf = (kind) => kb.docs.filter((d) => d.kind === kind);
  const joinDocs = (docs) => docs.map((d) => d.render()).join("\n\n");

  return function answer(raw) {
    const q = norm(raw);
    if (!q) return "Ask me anything about Saif's work — skills, projects, publications, certifications.";

    if (PERSONAL.test(q)) return pick(DEFLECT_PERSONAL);
    if (OFF_TOPIC.test(q)) return pick(DEFLECT_OFFTOPIC);

    if (/^(hi|hey|hello|salam|assalam|yo|good (morning|evening|afternoon))\b/.test(q))
      return `Hello! I'm ${full}'s assistant. Ask me about his skills, projects, publications or certifications.`;

    if (/\b(thanks|thank you|thx|appreciate)\b/.test(q))
      return "Any time. If you'd like to reach him directly, his email is right below in the Contact section.";

    if (/\b(bye|goodbye|see you|later)\b/.test(q))
      return "Good talking to you. Do drop Saif a line if something here matched what you're looking for.";

    if (/\b(who are you|what are you|are you (a )?(bot|ai|human|real))\b/.test(q))
      return `I'm a small assistant that knows ${full}'s professional profile. Not him — he's better company, and he sleeps.`;

    /* Only the genuinely open-ended "who is he" — "tell me about his CV work"
       has a subject and must fall through to the topic branches below. */
    if (/\b(who is (he|saif)|about (him|saif|yourself)|introduce|background|profile|summary|bio)\b/.test(q) ||
        /^(who is|tell me about (him|saif|yourself|you))\s*\??$/.test(q))
      return `${full} is an ${roles[0] || "AI Engineer"} based in ${id.location}. ${CONFIG.about.paragraphs[0]}`;

    if (/\b(location|based|where|city|country|relocat|remote)\b/.test(q))
      return `He's based in ${id.location}. For anything about relocation or remote work, best to ask him directly — ${email}.`;

    if (/\b(contact|email|reach|hire|hiring|available|opportunity|opening|connect|linkedin|github)\b/.test(q)) {
      const socials = (CONFIG.socials || []).map((s) => `[${s.icon}](${s.url})`).join(" · ");
      return `Best route is email: [${email}](mailto:${email}). He's also on ${socials}.`;
    }

    if (/\b(resume|cv)\b/.test(q))
      return resume ? `His full resume is here: [Open the resume](${resume}).`
                    : "The resume isn't linked on the site right now — email is the fastest route.";

    if (/\b(certification|certified|aws|amazon)\b/.test(q)) {
      const certs = listOf("certification");
      if (!certs.length) return "No certifications listed yet.";
      // if the question names one, lead with it instead of dumping the list
      const hit = retrieve(kb, raw, ["certification"], 1);
      if (hit.length && certs.length > 1)
        return `${hit[0].render()}\n\nHe holds ${certs.length} certifications in total — the rest are in the Certifications section above.`;
      return `Certifications:\n\n${joinDocs(certs)}`;
    }

    if (/\b(publication|ieee|research|paper|doi|scholar)\b/.test(q)) {
      const pubs = listOf("publication");
      return pubs.length ? `${joinDocs(pubs)}` : "No publications listed yet.";
    }

    if (/\b(education|degree|study|studied|graduat)\b/.test(q)) {
      const ed = listOf("education");
      if (ed.length) return joinDocs(ed);
      return "He's a Computer Science graduate (BSCS). The finer details are on his resume" +
             (resume ? ` — [open it here](${resume}).` : ".");
    }

    if (/\b(experience|work|worked|employ|company|companies|years)\b/.test(q)) {
      const exp = listOf("experience");
      if (exp.length) return joinDocs(exp);
      /* "what NLP experience does he have?" is a topic question wearing the
         word 'experience'. Answer from the topic whenever one actually
         matches, and keep the employment-history reply for questions that
         are really about employment. */
      const topical = retrieve(kb, raw, ["project", "skill", "publication"], 2);
      if (topical.length) return joinDocs(topical);
      return "His hands-on work is best seen through his projects and his IEEE publication — ask me about either. " +
             `For a full employment history, the resume is the place${resume ? `: [open it](${resume})` : ""}.`;
    }

    if (/\b(project|build|built|portfolio|github|repo)\b/.test(q)) {
      const hits = retrieve(kb, raw, ["project"], 3);
      const list = hits.length ? hits : listOf("project").slice(0, 3);
      return `${joinDocs(list)}\n\nThere are more in the Projects section above.`;
    }

    /* "does he know pytorch?" — answered before the general skills branch,
       which would otherwise swallow it on the word "know" and reply with a
       whole toolkit instead of a straight yes. */
    const techHit = (CONFIG.skills?.technical || [])
      .flatMap((g) => g.items.map((i) => ({ g: g.group, i })))
      .filter((x) => norm(x.i).length > 2 && q.includes(norm(x.i)))
      .sort((a, b) => b.i.length - a.i.length)[0];
    if (techHit)
      return `Yes — **${techHit.i}** is in his toolkit, under ${techHit.g}.`;

    /* plural-tolerant: "skills", "tools", "frameworks" all land here */
    if (/\b(skills?|tech|stack|tools?|frameworks?|languages?|libraries|proficien|expert|strengths?|good at|knows?)\b/.test(q)) {
      if (/\b(soft|professional|interpersonal|people|human)\b/.test(q)) {
        const soft = listOf("soft");
        if (soft.length) return joinDocs(soft);
      }
      const hits = retrieve(kb, raw, ["skill"], 2);
      const list = hits.length ? hits : listOf("skill").slice(0, 3);
      return `${joinDocs(list)}\n\nAsk about any one of these and I'll go deeper.`;
    }

    /* otherwise: retrieve across everything */
    const hits = retrieve(kb, raw, null, 2);
    if (hits.length) return joinDocs(hits);

    return "I don't have that in his profile. I'm good on skills, projects, publications, certifications and how to reach him — try one of those.";
  };
}

/* ---------- optional LLM mode ---------- */
function systemPrompt(kb) {
  const { full, CONFIG } = kb;
  const brief = kb.docs.map((d) => `- [${d.kind}] ${d.render().replace(/\*\*/g, "")}`).join("\n");
  return [
    `You are the assistant on ${full}'s portfolio website. You answer questions about him for recruiters and collaborators.`,
    `Rules:`,
    `1. Answer ONLY from the profile below. If something isn't there, say so plainly and point to his email (${CONFIG.contact?.email}). Never invent employers, dates, degrees or numbers.`,
    `2. Only professional topics. Refuse anything personal (age, salary, family, relationships, religion, politics, health) and anything unrelated to his work, with one short good-natured line, then steer back.`,
    `3. Be brief — two or three sentences unless asked for detail. A little dry humour is welcome; never at his expense.`,
    `4. Speak about him in the third person.`,
    ``,
    `PROFILE`,
    brief,
  ].join("\n");
}

async function askLLM(kb, history, text) {
  const chat = kb.chat;
  const res = await fetch(chat.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: chat.model || undefined,
      messages: [
        { role: "system", content: systemPrompt(kb) },
        ...history.slice(-6),
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error("chat proxy " + res.status);
  const data = await res.json();
  const out = data.reply || data.choices?.[0]?.message?.content;
  if (!out) throw new Error("empty reply");
  return out.trim();
}

/* ---------- tiny safe renderer: **bold**, _italic_, [text](url) ---------- */
function renderRich(target, text) {
  text.split(/\n{2,}/).forEach((para) => {
    const p = document.createElement("p");
    const re = /(\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
    let last = 0, m;
    while ((m = re.exec(para))) {
      if (m.index > last) p.appendChild(document.createTextNode(para.slice(last, m.index)));
      const tok = m[0];
      if (tok.startsWith("**")) {
        const b = document.createElement("strong");
        b.textContent = tok.slice(2, -2);
        p.appendChild(b);
      } else if (tok.startsWith("_")) {
        const i = document.createElement("em");
        i.textContent = tok.slice(1, -1);
        p.appendChild(i);
      } else {
        const cut = tok.indexOf("](");
        const label = tok.slice(1, cut);
        const href = tok.slice(cut + 2, -1);
        const a = document.createElement("a");
        // only http(s) and mailto — never javascript:
        a.href = /^(https?:|mailto:)/i.test(href) ? href : "#";
        if (/^https?:/i.test(href)) { a.target = "_blank"; a.rel = "noopener"; }
        a.textContent = label;
        p.appendChild(a);
      }
      last = m.index + tok.length;
    }
    if (last < para.length) p.appendChild(document.createTextNode(para.slice(last)));
    target.appendChild(p);
  });
}

/* ---------- widget ---------- */
export function initChat(CONFIG) {
  const cfg = CONFIG.chat || {};
  if (cfg.enabled === false) return;

  const kb = buildKB(CONFIG);
  const localAnswer = makeEngine(kb);
  const useLLM = !!cfg.apiUrl;
  const history = [];

  const root = document.createElement("div");
  root.className = "msb-chat";
  root.innerHTML = `
    <button class="chat-fab" type="button" aria-expanded="false" aria-controls="msb-chat-panel"
            aria-label="Ask about ${kb.full}">
      <svg viewBox="0 0 24 24" aria-hidden="true" class="ic-open">
        <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5 8.38 8.38 0 0 1 8.5 8.5Z"/>
      </svg>
      <svg viewBox="0 0 24 24" aria-hidden="true" class="ic-close"><path d="M6 6l12 12M18 6L6 18"/></svg>
      <span class="fab-label">Ask about me</span>
    </button>

    <div class="chat-panel" id="msb-chat-panel" role="dialog" aria-modal="false"
         aria-label="Ask about ${kb.full}" hidden>
      <header class="chat-head">
        <span class="chat-dot" aria-hidden="true"></span>
        <div>
          <strong>Ask about ${kb.id.shortName}</strong>
          <small>${useLLM ? "Answers from his profile" : "Answers straight from his profile"}</small>
        </div>
        <button class="chat-x" type="button" aria-label="Close chat">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </header>
      <div class="chat-log" role="log" aria-live="polite"></div>
      <div class="chat-chips"></div>
      <form class="chat-form">
        <input class="chat-input" type="text" autocomplete="off"
               placeholder="Ask about his skills, projects, papers…" aria-label="Your question" />
        <button class="chat-send" type="submit" aria-label="Send">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21l21-9L2 3l5 9-5 9Z"/></svg>
        </button>
      </form>
    </div>`;
  document.body.appendChild(root);

  const fab = root.querySelector(".chat-fab");
  const panel = root.querySelector(".chat-panel");
  const log = root.querySelector(".chat-log");
  const chips = root.querySelector(".chat-chips");
  const form = root.querySelector(".chat-form");
  const input = root.querySelector(".chat-input");

  function bubble(who, text, rich = true) {
    const b = document.createElement("div");
    b.className = "msg " + who;
    if (rich) renderRich(b, text);
    else b.textContent = text;
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function typing() {
    const t = document.createElement("div");
    t.className = "msg bot typing";
    t.innerHTML = "<span></span><span></span><span></span>";
    log.appendChild(t);
    log.scrollTop = log.scrollHeight;
    return t;
  }

  async function send(text) {
    if (!text.trim()) return;
    bubble("me", text, false);
    history.push({ role: "user", content: text });
    chips.classList.add("hidden");
    const t = typing();

    let reply;
    if (useLLM) {
      try {
        reply = await askLLM(kb, history, text);
      } catch (err) {
        console.warn("chat: falling back to the built-in engine —", err.message);
        reply = localAnswer(text);
      }
    } else {
      // a beat of latency so replies don't snap in faster than they read
      await new Promise((r) => setTimeout(r, 220 + Math.random() * 220));
      reply = localAnswer(text);
    }

    t.remove();
    bubble("bot", reply);
    history.push({ role: "assistant", content: reply });
  }

  (cfg.suggestions || []).forEach((s) => {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "chat-chip";
    c.textContent = s;
    c.addEventListener("click", () => send(s));
    chips.appendChild(c);
  });

  let opened = false;
  const open = () => {
    panel.hidden = false;
    root.classList.add("open");
    fab.setAttribute("aria-expanded", "true");
    if (!opened) {
      opened = true;
      bubble("bot", cfg.greeting ||
        `Hi! Ask me anything about ${kb.id.shortName}'s work — skills, projects, publications or how to reach him.`);
    }
    setTimeout(() => input.focus(), 120);
  };
  const close = () => {
    root.classList.remove("open");
    fab.setAttribute("aria-expanded", "false");
    setTimeout(() => { panel.hidden = true; }, 220);
    fab.focus();
  };

  fab.addEventListener("click", () => (root.classList.contains("open") ? close() : open()));
  root.querySelector(".chat-x").addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.classList.contains("open")) close();
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = "";
    send(v);
  });
}
