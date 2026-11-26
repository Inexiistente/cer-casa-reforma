/* ==========================================================================
   CeR Casa & Reforma — Precision Retail & Design Engineering Engine
   Motion & Interaction Architecture: emilkowalski/skills
   ========================================================================== */

const WHATSAPP = "5531982926011";
const PAGE = 48;
const QUOTE_STORAGE_KEY = "cer_quote_v1";

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const HOURS = [
  { d: "domingo",       o: "08:00", c: "12:00" },
  { d: "segunda-feira", o: "08:00", c: "18:00" },
  { d: "terça-feira",   o: "08:00", c: "18:00" },
  { d: "quarta-feira",  o: "08:00", c: "18:00" },
  { d: "quinta-feira",  o: "08:00", c: "18:00" },
  { d: "sexta-feira",   o: "08:00", c: "18:00" },
  { d: "sábado",        o: "08:00", c: "14:00" },
];

let PRODUCTS = [];
let PRODUCT_BY_CODE = new Map();
const DISPLAY_CACHE = new Map();

let state = { q: "", cat: "Todos", avail: "all", sort: "az", shown: PAGE };
let calcMode = "piso";
let currentCalcRecipe = [];
let calcVizRaf = 0;

const quote = new Map(); // code -> { product, qty }
let savedQuoteRaw = loadSavedQuoteMap(); // code -> qty (hydrated once PRODUCTS arrive)

/* Interruptible Timer Registry (Prevents setTimeout race conditions on rapid clicks) */
const SWAP_TIMERS = new Map();

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const waLink = (text) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function runManagedSwap(key, el, cls, delayMs, mutateFn) {
  const prev = SWAP_TIMERS.get(key);
  if (prev) clearTimeout(prev);

  if (!el || reducedMotion()) {
    if (el && cls) el.classList.remove(cls);
    mutateFn();
    return;
  }

  el.classList.add(cls);
  const id = setTimeout(() => {
    SWAP_TIMERS.delete(key);
    mutateFn();
    el.classList.remove(cls);
  }, delayMs);
  SWAP_TIMERS.set(key, id);
}

function loadSavedQuoteMap() {
  const map = new Map();
  try {
    const raw = localStorage.getItem(QUOTE_STORAGE_KEY);
    if (!raw) return map;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      for (const [code, qty] of Object.entries(parsed)) {
        const n = Math.floor(Number(qty));
        if (code && n > 0 && n < 10000) map.set(String(code), n);
      }
    }
  } catch {}
  return map;
}

function persistQuoteMap() {
  try {
    if (quote.size === 0) {
      localStorage.removeItem(QUOTE_STORAGE_KEY);
      return;
    }
    const plain = {};
    for (const [code, { qty }] of quote.entries()) {
      plain[code] = qty;
    }
    localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(plain));
  } catch {}
}

/* ==========================================================================
   1. SMART ERP SKU PARSER (Turns raw UPPERCASE ERP strings into clean specs)
   ========================================================================== */
const ABBREV_MAP = {
  "P/": "p/",
  "C/": "c/",
  "S/": "s/",
  "SANIT.": "Sanitário",
  "SANIT": "Sanitário",
  "BCO.": "Branco",
  "BCO": "Branco",
  "BCA": "Branca",
  "PTO.": "Preto",
  "PTO": "Preto",
  "ALUM.": "Alumínio",
  "ALUMI": "Alumínio",
  "TORN.": "Torneira",
  "TORN": "Torneira",
  "VALV.": "Válvula",
  "VALV": "Válvula",
  "REG.": "Registro",
  "DISJ.": "Disjuntor",
  "PARAF.": "Parafuso",
  "MANG.": "Mangueira",
  "ACAB.": "Acabamento",
  "ARM.": "Armário",
  "SOLD.": "Soldável",
  "ROSC.": "Roscável",
  "ESG.": "Esgoto",
  "ESG": "Esgoto",
  "EXT.": "Extra",
  "RET.": "Retangular",
  "QUAD.": "Quadrado",
  "CX.": "Caixa",
  "CX": "Caixa",
  "UN.": "un",
  "PCS": "pçs",
  "MTS": "m",
  "MT": "m",
  "KG": "kg",
  "KGS": "kg",
  "GRS": "g",
  "GR": "g",
  "LT": "L",
  "X": "×",
};

const KEEP_UPPER = new Set([
  "PVC", "CPVC", "PPR", "SDS", "LED", "EPI", "PU", "ABS", "MDF",
  "AC", "AC1", "AC2", "AC3", "AC-1", "AC-2", "AC-3", "NBR", "RG", "RJ", "PP", "RSF", "PVA", "BIVOLT",
]);

const BRANDS = [
  "Tramontina", "Deca", "Lorenzetti", "Makita", "Cortag", "Plastubos",
  "Irwin", "Sata", "Starrett", "Starret", "Astra", "Herc", "Metasul",
  "Pado", "Stam", "Tigre", "Krona", "Norton", "Tek Bond", "Three Bond",
  "Fassa Bartolo", "Blukit", "Docol", "Hydra", "Hidra", "Santa Clara",
  "Mebuki", "Mebuk", "Granplast", "Ecoplastic", "Guarany", "Thompson", "MTX",
];

const LOWER_CONNECTORS = new Set(["de", "da", "do", "das", "dos", "para", "p/", "c/", "s/", "em", "com", "e", "ou", "por"]);

const ACCENT_FIXES = [
  [/\bEletrica\b/gi, "Elétrica"],
  [/\bHidraulica\b/gi, "Hidráulica"],
  [/\bFlexivel\b/gi, "Flexível"],
  [/\bValvula\b/gi, "Válvula"],
  [/\bAgua\b/gi, "Água"],
  [/\bAco\b/gi, "Aço"],
  [/\bLampada\b/gi, "Lâmpada"],
  [/\bAbracadeira\b/gi, "Abraçadeira"],
  [/\bReducao\b/gi, "Redução"],
  [/\bVedacao\b/gi, "Vedação"],
  [/\bFixacao\b/gi, "Fixação"],
  [/\bConexao\b/gi, "Conexão"],
  [/\bSeguranca\b/gi, "Segurança"],
  [/\bAcrilica\b/gi, "Acrílica"],
  [/\bplastico\b/gi, "Plástico"],
  [/\bAluminio\b/gi, "Alumínio"],
  [/\bSanitario\b/gi, "Sanitário"],
  [/\bGalao\b/gi, "Galão"],
  [/\bLamina\b/gi, "Lâmina"],
  [/\bEspacador\b/gi, "Espaçador"],
  [/\bVidea\b/gi, "Vídea"],
  [/\bMourao\b/gi, "Mourão"],
  [/\bBifasico\b/gi, "Bifásico"],
  [/\bMonofasico\b/gi, "Monofásico"],
  [/\bTrifasico\b/gi, "Trifásico"],
  [/\bLitio\b/gi, "Lítio"],
  [/\bLavatorio\b/gi, "Lavatório"],
  [/\bCeramica\b/gi, "Cerâmica"],
  [/\bNivel\b/gi, "Nível"],
  [/\bExtensao\b/gi, "Extensão"],
  [/\bPressao\b/gi, "Pressão"],
];

function smartCaseWord(token, index) {
  if (!token) return "";
  const upper = token.toUpperCase();
  if (ABBREV_MAP[upper]) return ABBREV_MAP[upper];
  if (KEEP_UPPER.has(upper)) return upper;

  if (/^\d/.test(token) || /^[A-Z]-\d+/i.test(token)) {
    return token
      .replace(/MM$/i, "mm")
      .replace(/CM$/i, "cm")
      .replace(/MTS?$/i, "m")
      .replace(/KG$/i, "kg")
      .replace(/ML$/i, "ml")
      .replace(/LT?$/i, "L")
      .replace(/X/gi, "×");
  }

  const lower = token.toLowerCase();
  if (index > 0 && LOWER_CONNECTORS.has(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatReadablePhrase(raw) {
  const clean = String(raw || "")
    .replace(/\s+/g, " ")
    .replace(/P\/([A-Z])/g, "P/ $1")
    .replace(/C\/([0-9A-Z])/g, "C/ $1")
    .replace(/C\\\s*/g, "c/ ")
    .trim();

  const words = clean.split(" ").map((w, i) => smartCaseWord(w, i));
  let joined = words.join(" ");
  for (const [rx, rep] of ACCENT_FIXES) {
    joined = joined.replace(rx, rep);
  }
  return joined;
}

function parseProductDisplay(p) {
  if (DISPLAY_CACHE.has(p.c)) return DISPLAY_CACHE.get(p.c);

  let raw = String(p.n || "").trim();
  const specs = [];

  raw = raw.replace(/\(([^)]+)\)/g, (_, inner) => {
    const cleaned = formatReadablePhrase(inner.replace(/N\*\s*/i, "Nº ").trim());
    if (cleaned && cleaned.length <= 28) specs.push(cleaned);
    return "";
  }).replace(/\s+/g, " ").trim();

  raw = raw.replace(/\bAC\s*([123])\b/gi, "AC-$1");

  let readable = formatReadablePhrase(raw);

  for (const brand of BRANDS) {
    const rx = new RegExp(`\\b${brand.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (rx.test(readable)) {
      const stripped = readable.replace(rx, "").replace(/\s+-\s*$/, "").replace(/\s+/g, " ").trim();
      if (stripped.length >= 6) {
        readable = stripped;
        specs.unshift(brand === "Starret" ? "Starrett" : brand);
      }
      break;
    }
  }

  readable = readable.replace(/[-–,/·\s]+$/, "").trim();

  const result = {
    title: readable || p.n,
    specs: specs.slice(0, 3),
  };
  DISPLAY_CACHE.set(p.c, result);
  return result;
}

/* ==========================================================================
   2. BESPOKE CAD ORTHOGRAPHIC SCHEMATICS FOR CORRIDORS
   ========================================================================== */
function getSectorCadSvg(sectorName) {
  const s = norm(sectorName);

  if (s.includes("hidraulica")) {
    return `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M7 28V18a7 7 0 0 1 7-7h18" stroke-opacity="0.85"/>
      <path d="M15 28V20a1 1 0 0 1 1-1h16" stroke-opacity="0.85"/>
      <rect x="5" y="28" width="12" height="4" rx="1"/>
      <rect x="31" y="9" width="4" height="12" rx="1"/>
      <g class="cad-accent">
        <line x1="22" y1="11" x2="22" y2="5"/>
        <line x1="17" y1="5" x2="27" y2="5" stroke-width="1.8"/>
      </g>
    </svg>`;
  }

  if (s.includes("eletrica")) {
    return `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="9" y="6" width="22" height="28" rx="2" stroke-opacity="0.85"/>
      <line x1="14" y1="10" x2="26" y2="10" stroke-opacity="0.45"/>
      <line x1="14" y1="30" x2="26" y2="30" stroke-opacity="0.45"/>
      <circle cx="15" cy="8" r="1" fill="currentColor"/>
      <circle cx="25" cy="8" r="1" fill="currentColor"/>
      <g class="cad-accent">
        <rect x="15" y="16" width="10" height="7" rx="1" fill="currentColor" fill-opacity="0.16"/>
        <path d="M20 14v9"/>
      </g>
    </svg>`;
  }

  if (s.includes("ferramenta")) {
    return `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 27l14-14" stroke-width="1.6"/>
      <rect x="6" y="25" width="8" height="8" rx="1.5" transform="rotate(-45 6 25)" stroke-opacity="0.85"/>
      <g class="cad-accent">
        <path d="M22 10a7 7 0 0 1 9 9l-4-4-3 3 4 4a7 7 0 0 1-9-9"/>
      </g>
      <path d="M6 8h5M8.5 5.5v5" stroke-opacity="0.4" stroke-width="1"/>
    </svg>`;
  }

  if (s.includes("banheiro") || s.includes("cozinha")) {
    return `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 28V13a6 6 0 0 1 12 0v3" stroke-opacity="0.9"/>
      <path d="M7 28h26" stroke-opacity="0.85"/>
      <path d="M10 28l2 6h16l2-6" stroke-opacity="0.55"/>
      <g class="cad-accent">
        <line x1="24" y1="19" x2="24" y2="24" stroke-dasharray="1.5 2"/>
        <path d="M9 24h6"/>
      </g>
    </svg>`;
  }

  if (s.includes("parafuso") || s.includes("fixacao")) {
    return `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="13" y="7" width="14" height="5" rx="1"/>
      <path d="M17 12v18l3 4 3-4V12" stroke-opacity="0.88"/>
      <g class="cad-accent">
        <line x1="16" y1="17" x2="24" y2="19"/>
        <line x1="16" y1="22" x2="24" y2="24"/>
        <line x1="16" y1="27" x2="24" y2="29"/>
      </g>
    </svg>`;
  }

  if (s.includes("porta") || s.includes("janela") || s.includes("ferragen")) {
    return `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="10" y="6" width="20" height="28" rx="1.5" stroke-opacity="0.85"/>
      <line x1="6" y1="34" x2="34" y2="34" stroke-opacity="0.45"/>
      <g class="cad-accent">
        <path d="M14 9l11 3v20l-11-2V9z" fill="currentColor" fill-opacity="0.1"/>
        <circle cx="22" cy="20" r="1.2" fill="currentColor"/>
      </g>
    </svg>`;
  }

  if (s.includes("tinta")) {
    return `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="8" y="8" width="18" height="8" rx="2" fill="currentColor" fill-opacity="0.12"/>
      <path d="M26 12h4v6H19v5" stroke-opacity="0.85"/>
      <g class="cad-accent">
        <rect x="17" y="23" width="4" height="10" rx="1"/>
      </g>
    </svg>`;
  }

  if (s.includes("argamassa") || s.includes("cimento") || s.includes("bloco")) {
    return `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="6" y="10" width="28" height="20" rx="1.5" stroke-opacity="0.85"/>
      <line x1="6" y1="20" x2="34" y2="20" stroke-opacity="0.65"/>
      <line x1="20" y1="10" x2="20" y2="20" stroke-opacity="0.65"/>
      <g class="cad-accent">
        <line x1="13" y1="20" x2="13" y2="30"/>
        <line x1="27" y1="20" x2="27" y2="30"/>
      </g>
    </svg>`;
  }

  return `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="8" y="8" width="24" height="24" rx="2" stroke-opacity="0.8"/>
    <line x1="8" y1="20" x2="32" y2="20" stroke-opacity="0.4"/>
    <line x1="20" y1="8" x2="20" y2="32" stroke-opacity="0.4"/>
    <g class="cad-accent">
      <circle cx="20" cy="20" r="5" fill="currentColor" fill-opacity="0.14"/>
    </g>
  </svg>`;
}

/* ==========================================================================
   3. SEARCH ALIASES & HIGHLIGHTING
   ========================================================================== */
const SEARCH_ALIASES = {
  torneira: ["torneira", "torn.", "torn "],
  torneiras: ["torneira", "torn.", "torn "],
  registro: ["registro", "reg.", "reg "],
  registros: ["registro", "reg.", "reg "],
  caixa: ["caixa", "cx ", "cx."],
  mangueira: ["mangueira", "mang.", "mang "],
  armario: ["armario", "arm."],
  aluminio: ["aluminio", "alum."],
  acabamento: ["acabamento", "acab."],
  parafuso: ["parafuso", "paraf."],
  parafusos: ["parafuso", "paraf."],
  valvula: ["valvula", "valv."],
  disjuntor: ["disjuntor", "disj."],
  chuveiro: ["chuveiro", "ducha"],
  ducha: ["ducha", "chuveiro"],
  esgoto: ["esgoto", "esg."],
  soldavel: ["soldavel", "sold."],
  roscavel: ["roscavel", "rosc."],
};

function matchesTokens(hay, normalizedQuery) {
  return normalizedQuery.split(/\s+/).filter(Boolean).every((w) => {
    const alts = SEARCH_ALIASES[w];
    return alts ? alts.some((a) => hay.includes(a)) : hay.includes(w);
  });
}

function highlightText(str, rawQuery) {
  const safe = escapeHtml(str);
  if (!rawQuery) return safe;
  const rawTerms = rawQuery.trim().split(/\s+/).filter((w) => w.length >= 2);
  if (!rawTerms.length) return safe;

  const expanded = new Set();
  for (const t of rawTerms) {
    expanded.add(t);
    const alts = SEARCH_ALIASES[norm(t)];
    if (alts) alts.forEach((a) => expanded.add(a.trim()));
  }
  const esc = [...expanded]
    .filter((w) => w.length >= 2)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!esc.length) return safe;
  const re = new RegExp(`(${esc.join("|")})`, "gi");
  return safe.replace(re, `<mark class="hl">$1</mark>`);
}

/* ==========================================================================
   4. STORE HOURS, TELEMETRY & SUBTLE SECTION PRESENCE
   ========================================================================== */
function openNow() {
  const now = new Date();
  const h = HOURS[now.getDay()];
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMin = (t) => {
    const [a, b] = t.split(":").map(Number);
    return a * 60 + b;
  };
  return { open: mins >= toMin(h.o) && mins < toMin(h.c), today: h };
}

function setupHours() {
  const { open, today } = openNow();
  const dot = $("#statusDot");
  const txt = $("#statusText");
  if (dot) {
    dot.classList.remove("on", "off");
    dot.classList.add(open ? "on" : "off");
  }
  if (txt) {
    txt.textContent = open
      ? `ABERTA AGORA · ATÉ ${today.c}`
      : `FECHADA AGORA · ABRE ${today.o}`;
  }
  const todayEl = $("#todayHours");
  if (todayEl) todayEl.textContent = `HOJE ${today.o} – ${today.c}`;

  const todayIdx = new Date().getDay();
  const table = $("#hoursTable");
  if (table) {
    table.innerHTML = HOURS.map((h, i) =>
      `<tr class="${i === todayIdx ? "today" : ""}"><td>${h.d}</td><td>${h.o} – ${h.c}</td></tr>`
    ).join("");
  }
  const note = $("#hoursNote");
  if (note) {
    note.textContent = open ? "Aberta agora" : "Fechada no momento";
    note.classList.toggle("is-closed", !open);
  }
}

function initSectionPresence() {
  const sections = $$(".reveal-section");
  if (!sections.length || reducedMotion() || !("IntersectionObserver" in window)) {
    sections.forEach((s) => s.classList.add("is-inview"));
    return;
  }
  document.documentElement.classList.add("js-ready");
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-inview");
        io.unobserve(entry.target);
      }
    }
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.04 });

  sections.forEach((s) => io.observe(s));
}

function initScrollTelemetry() {
  const bar = $("#scrollProgress");
  const header = $("#siteHeader");
  const backTop = $("#backToTop");
  const backRing = $("#backTopRing");
  const heroPlate = $("#heroCinemaPlate");
  const heroImg = $("#heroParallaxImg");
  const ringLen = 119.38;
  let parallaxRaf = 0;

  function updateHeroParallax() {
    parallaxRaf = 0;
    if (!heroPlate || !heroImg || reducedMotion()) return;
    const rect = heroPlate.getBoundingClientRect();
    const vh = window.innerHeight || 900;
    if (rect.bottom < -80 || rect.top > vh + 80) return;
    const progress = (vh - rect.top) / (vh + rect.height); // 0 -> 1
    const clamped = Math.max(0, Math.min(1, progress));
    const offsetY = (clamped - 0.5) * 44;
    const scale = 1.05 - clamped * 0.04;
    heroImg.style.transform = `translate3d(0, ${offsetY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
  }

  const nav = $("#mainNav");
  const navInd = $("#navIndicator");
  const navLinks = $$("#mainNav a");
  const spyEls = ["departamentos", "calculadora", "catalogo", "loja", "contato"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  function updateNavSpy() {
    if (!nav || !navInd || window.innerWidth <= 980) return;
    const scrollPos = window.scrollY + 190;
    let activeId = "";
    for (const sec of spyEls) {
      if (sec.offsetTop <= scrollPos) activeId = sec.id;
    }
    let activeLink = null;
    for (const a of navLinks) {
      const match = Boolean(activeId && a.getAttribute("href") === `#${activeId}`);
      a.classList.toggle("is-active", match);
      if (match) activeLink = a;
    }
    if (activeLink) {
      const x = activeLink.offsetLeft;
      const scale = activeLink.offsetWidth / 100;
      navInd.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0) scaleX(${scale.toFixed(3)})`;
      navInd.style.opacity = "1";
    } else {
      navInd.style.opacity = "0";
    }
  }

  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;

    if (bar) bar.style.transform = `scaleX(${pct.toFixed(4)})`;
    if (header) header.classList.toggle("is-scrolled", y > 20);
    if (backTop && backRing) {
      backTop.classList.toggle("is-visible", y > 420);
      backRing.style.strokeDashoffset = `${(ringLen * (1 - pct)).toFixed(2)}`;
    }
    if (!parallaxRaf && heroImg && !reducedMotion()) {
      parallaxRaf = requestAnimationFrame(updateHeroParallax);
    }
    updateNavSpy();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", updateNavSpy);
  if (backTop) {
    backTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
    });
  }
  onScroll();
}

/* ==========================================================================
   5. CONCENTRIC CLIP-PATH TABS (round 6px matching --t-inner)
   ========================================================================== */
function syncClipTabs(containerEl, activeIndex) {
  if (!containerEl) return;
  const baseBtns = $$(".clip-tabs__base .clip-tabs__btn", containerEl);
  const overlay = $(".clip-tabs__overlay", containerEl);
  if (!overlay || !baseBtns[activeIndex]) return;

  const baseRect = $(".clip-tabs__base", containerEl).getBoundingClientRect();
  const btnRect = baseBtns[activeIndex].getBoundingClientRect();
  if (baseRect.width <= 0) return;

  const leftPx = Math.max(0, btnRect.left - baseRect.left);
  const rightPx = Math.max(0, baseRect.right - btnRect.right);
  overlay.style.clipPath = `inset(0px ${rightPx.toFixed(1)}px 0px ${leftPx.toFixed(1)}px round 6px)`;
}

/* ==========================================================================
   6. SONNER-STYLE 3D STACKED TOAST ENGINE
   ========================================================================== */
function restackToasts() {
  const stack = $("#toastStack");
  if (!stack) return;
  const active = $$(".sonner-toast:not(.is-leaving)", stack).reverse();
  active.forEach((el, idx) => {
    el.style.setProperty("--toast-idx", String(idx));
  });
}

function toast(message) {
  const stack = $("#toastStack");
  if (!stack) return;

  const existing = $$(".sonner-toast:not(.is-leaving)", stack);
  if (existing.length >= 3) dismissToast(existing[0]);

  const el = document.createElement("div");
  el.className = "sonner-toast";
  el.style.setProperty("--toast-idx", "0");
  el.innerHTML = `<span class="sonner-toast__dot" aria-hidden="true"></span><span class="sonner-toast__text">${escapeHtml(message)}</span>`;
  stack.appendChild(el);
  restackToasts();

  let timer = setTimeout(() => dismissToast(el), 2400);
  el.addEventListener("mouseenter", () => clearTimeout(timer));
  el.addEventListener("mouseleave", () => {
    timer = setTimeout(() => dismissToast(el), 1100);
  });
}

function dismissToast(el) {
  if (!el || el.classList.contains("is-leaving")) return;
  el.classList.add("is-leaving");
  restackToasts();
  setTimeout(() => el.remove(), 290);
}

/* ==========================================================================
   7. HERO LIVE COUNTER SPECIMEN (Instant ERP Proof Above the Fold)
   ========================================================================== */
const HERO_BENCH_SEEDS = [
  { code: "0145", fallback: "argamassa ac 2" },
  { code: "0328", fallback: "cabo flexivel 2,5" },
  { code: "1976", fallback: "registro pressao" },
];

function findBestProduct(codeHint, queryFallback) {
  if (codeHint) {
    const clean = codeHint.replace(/^0+/, "");
    const direct = PRODUCT_BY_CODE.get(codeHint)
      || PRODUCTS.find((p) => p.c.replace(/^0+/, "") === clean);
    if (direct) return direct;
  }
  if (queryFallback && PRODUCTS.length) {
    const nq = norm(queryFallback);
    return PRODUCTS.find((p) => p.s && norm(p.n).includes(nq))
      || PRODUCTS.find((p) => norm(p.n).includes(nq))
      || null;
  }
  return null;
}

function renderHeroBench() {
  const box = $("#heroLiveSample");
  if (!box || !PRODUCTS.length) return;

  const picked = [];
  const seen = new Set();
  for (const seed of HERO_BENCH_SEEDS) {
    const p = findBestProduct(seed.code, seed.fallback);
    if (p && !seen.has(p.c)) {
      picked.push(p);
      seen.add(p.c);
    }
  }
  if (picked.length < 3) {
    for (const p of PRODUCTS) {
      if (p.s && !seen.has(p.c)) {
        picked.push(p);
        seen.add(p.c);
        if (picked.length >= 3) break;
      }
    }
  }

  box.innerHTML = picked.map((p) => {
    const parsed = parseProductDisplay(p);
    const qtyIn = quote.get(p.c)?.qty || 0;
    return `
      <div class="bench-item" data-bench-row="${escapeHtml(p.c)}">
        <span class="bench-item__code tabular">#${escapeHtml(p.c)}</span>
        <span class="bench-item__name">${escapeHtml(parsed.title)}</span>
        <span class="bench-item__price tabular">${brl.format(p.p)}/${escapeHtml(p.u)}</span>
        <button class="bench-item__add tabular ${qtyIn > 0 ? "is-in" : ""}" type="button" data-bench-add="${escapeHtml(p.c)}" title="Adicionar +1 na comanda">
          ${qtyIn > 0 ? `${qtyIn}×` : "+1"}
        </button>
      </div>`;
  }).join("");
}

function patchHeroBenchRow(code) {
  const btn = $(`#heroLiveSample [data-bench-add="${CSS.escape(code)}"]`);
  if (!btn) return;
  const qtyIn = quote.get(code)?.qty || 0;
  btn.classList.toggle("is-in", qtyIn > 0);
  btn.textContent = qtyIn > 0 ? `${qtyIn}×` : "+1";
}

/* ==========================================================================
   8. 60FPS PERSISTENT SVG CALCULATOR + ACTIVE RANGE TRACK + LIVE RECIPE
   ========================================================================== */
function syncRangeTrackFill(areaVal) {
  const range = $("#calcAreaRange");
  if (!range) return;
  const min = Number(range.min) || 1;
  const max = Number(range.max) || 200;
  const clamped = Math.min(max, Math.max(min, areaVal));
  const pct = ((clamped - min) / (max - min)) * 100;
  range.style.setProperty("--range-pct", `${pct.toFixed(2)}%`);
}

function scheduleBlueprintViz(area, mode, extraInfo) {
  if (calcVizRaf) cancelAnimationFrame(calcVizRaf);
  calcVizRaf = requestAnimationFrame(() => {
    calcVizRaf = 0;
    renderBlueprintViz(area, mode, extraInfo);
  });
}

function renderBlueprintViz(area, mode, extraInfo) {
  const svgGroup = $("#calcSvgContent");
  const legend = $("#calcVizLegend");
  const vizTitle = $("#vizTitle");
  const vizScale = $("#vizScale");
  if (!svgGroup || !legend) return;

  if (mode === "piso") {
    const totalArea = Math.ceil(area * 1.1);
    const cols = Math.min(9, Math.max(3, Math.round(Math.sqrt(area) * 1.1)));
    const cell = 104 / cols;
    let cellsSvg = "";
    for (let r = 0; r < cols; r++) {
      for (let c = 0; c < cols; c++) {
        const isEdge = r === cols - 1 || c === cols - 1;
        cellsSvg += `<rect x="${(12 + c * cell).toFixed(1)}" y="${(12 + r * cell).toFixed(1)}" width="${Math.max(2, cell - 2).toFixed(1)}" height="${Math.max(2, cell - 2).toFixed(1)}" rx="1" fill="${isEdge ? "rgba(232,163,23,0.13)" : "rgba(232,163,23,0.34)"}" stroke="rgba(232,163,23,${isEdge ? "0.45" : "0.78"})" stroke-width="0.85" ${isEdge ? 'stroke-dasharray="2 1.5"' : ""}/>`;
      }
    }
    if (vizTitle) vizTitle.textContent = `COM RESERVA (+10%) · ${extraInfo.toUpperCase()}`;
    if (vizScale) vizScale.textContent = `${totalArea} m²`;

    svgGroup.innerHTML = cellsSvg;
    legend.innerHTML = `
      <div class="viz-legend__row"><span class="viz-swatch viz-swatch--net"></span><span>Área líquida: <strong class="tabular">${area} m²</strong></span></div>
      <div class="viz-legend__row"><span class="viz-swatch viz-swatch--waste"></span><span>Reserva técnica (+10%): <strong class="tabular">+${totalArea - area} m²</strong></span></div>
      <div class="mono" style="margin-top:0.2rem;">RENDIMENTO TÉCNICO: 4 M² / SACO 20KG</div>`;
  } else {
    const coats = Number(extraInfo) || 2;
    const liters = Math.ceil((area * coats) / 10);
    if (vizTitle) vizTitle.textContent = `VOLUME ACRÍLICO · ${coats} DEMÃOS`;
    if (vizScale) vizScale.textContent = `${liters} litros`;

    const bars = Array.from({ length: coats }, (_, i) => {
      const h = Math.round(92 / coats) - 6;
      const y = 18 + i * (h + 8);
      const opacity = (0.28 + (i + 1) * 0.22).toFixed(2);
      return `<rect x="16" y="${y}" width="96" height="${h}" rx="3" fill="rgba(232,163,23,${opacity})" stroke="rgba(232,163,23,0.82)" stroke-width="1"/>`;
    }).join("");

    svgGroup.innerHTML = bars;
    legend.innerHTML = `
      <div class="viz-legend__row"><span class="viz-swatch viz-swatch--net"></span><span>Superfície: <strong class="tabular">${area} m²</strong> (${coats} demãos)</span></div>
      <div class="viz-legend__row"><span class="viz-swatch viz-swatch--waste"></span><span>Volume acrílico: <strong class="tabular">${liters} litros</strong></span></div>
      <div class="mono" style="margin-top:0.2rem;">RENDIMENTO BASE: 10 M² POR LITRO / DEMÃO</div>`;
  }
}

function updateCalc() {
  const area = Math.max(1, Number($("#calcArea")?.value) || 1);
  const extra = $("#calcExtra")?.value || "ac2";
  const res = $("#calcResult");
  const recipeBox = $("#calcRecipeList");
  const hint = $("#calcPricePreview");
  const addBtn = $("#calcAddKitBtn");
  const bigArea = $("#calcBigArea");
  if (bigArea) bigArea.textContent = String(area);
  if (!res) return;

  syncRangeTrackFill(area);

  $$("#areaPresets button").forEach((b) => {
    b.classList.toggle("is-active", Number(b.dataset.area) === area);
  });

  scheduleBlueprintViz(area, calcMode, extra);
  currentCalcRecipe = [];

  if (calcMode === "piso") {
    const areaComPerda = Math.ceil(area * 1.1);
    const sacosArg = Math.ceil(area / 4);
    const kgRejunte = Math.max(1, Math.ceil(area / 5));
    const codeMap = { ac1: "0144", ac2: "0145", ac3: "0146" };
    const argProd = findBestProduct(codeMap[extra], `argamassa ${extra}`);
    const rejProd = findBestProduct("1434", "rejunte");

    if (argProd) currentCalcRecipe.push({ product: argProd, qty: sacosArg });
    if (rejProd) currentCalcRecipe.push({ product: rejProd, qty: kgRejunte });

    const argLabel = extra.toUpperCase().replace("AC", "AC-");
    res.innerHTML = `
      <div class="calc-card">
        <span class="mono calc-card__eyebrow">ÁREA DE COMPRA (+10%)</span>
        <strong class="calc-card__val">${areaComPerda} m²</strong>
        <span class="calc-card__sub">Cobre ${area} m² líquidos</span>
        <span class="calc-card__match">+ ${kgRejunte} kg de rejunte</span>
        <button class="calc-card__filter" type="button" data-search="piso">CONSULTAR PISOS →</button>
      </div>
      <div class="calc-card">
        <span class="mono calc-card__eyebrow">ARGAMASSA ${argLabel} (20KG)</span>
        <strong class="calc-card__val">${sacosArg} ${sacosArg === 1 ? "saco" : "sacos"}</strong>
        <span class="calc-card__sub">${argProd ? escapeHtml(parseProductDisplay(argProd).title) : `Argamassa ${argLabel}`}</span>
        <span class="calc-card__match">${argProd ? `${brl.format(argProd.p)}/saco` : "Estoque local"}</span>
        <button class="calc-card__filter" type="button" data-search="argamassa ${extra}">VER ARGAMASSAS →</button>
      </div>`;
  } else {
    const demaos = Number(extra) || 2;
    const litros = Math.ceil((area * demaos) / 10);
    let latas18 = Math.floor(litros / 18);
    let galoes = Math.ceil((litros % 18) / 3.6);
    if (galoes > 3) { latas18 += 1; galoes = 0; }
    if (latas18 === 0 && galoes === 0) galoes = 1;

    const lataProd = findBestProduct(null, "tinta acrilica 18");
    const galaoProd = findBestProduct("2395", "tinta acrilica 3,6");
    const roloProd = findBestProduct("2222", "rolo la antirespingo");
    const fitaProd = findBestProduct("0971", "fita crepe");

    if (latas18 > 0 && (lataProd || galaoProd)) {
      if (lataProd) currentCalcRecipe.push({ product: lataProd, qty: latas18 });
      else currentCalcRecipe.push({ product: galaoProd, qty: latas18 * 5 });
    }
    if (galoes > 0 && galaoProd) {
      currentCalcRecipe.push({ product: galaoProd, qty: galoes });
    }
    if (roloProd) currentCalcRecipe.push({ product: roloProd, qty: 1 });
    if (fitaProd) currentCalcRecipe.push({ product: fitaProd, qty: Math.max(1, Math.ceil(area / 35)) });

    const fmtLata = (n) => `${n} ${n === 1 ? "lata" : "latas"} 18L`;
    const fmtGalao = (n) => `${n} ${n === 1 ? "galão" : "galões"} 3,6L`;
    const resumo = latas18 > 0
      ? `${fmtLata(latas18)}${galoes > 0 ? ` + ${fmtGalao(galoes)}` : ""}`
      : fmtGalao(galoes);

    res.innerHTML = `
      <div class="calc-card">
        <span class="mono calc-card__eyebrow">VOLUME ACRÍLICO</span>
        <strong class="calc-card__val">${litros} L</strong>
        <span class="calc-card__sub">${demaos} demãos em ${area} m²</span>
        <span class="calc-card__match">Cobertura uniforme</span>
        <button class="calc-card__filter" type="button" data-search="tinta">VER TINTAS →</button>
      </div>
      <div class="calc-card">
        <span class="mono calc-card__eyebrow">ENVASE OTIMIZADO</span>
        <strong class="calc-card__val" style="font-size:1.16rem">${resumo}</strong>
        <span class="calc-card__sub">+ Rolo antirrespingo e fita</span>
        <span class="calc-card__match">Menor sobra de obra</span>
        <button class="calc-card__filter" type="button" data-search="rolo">VER ACESSÓRIOS →</button>
      </div>`;
  }

  if (recipeBox) {
    if (currentCalcRecipe.length > 0) {
      recipeBox.hidden = false;
      recipeBox.innerHTML = `<div class="mono calc-recipe__head">INSUMOS REAIS SELECIONADOS NO ERP:</div>` +
        currentCalcRecipe.map(({ product, qty }) => `
          <div class="calc-recipe__row">
            <span class="calc-recipe__qty tabular">${qty}×</span>
            <span class="calc-recipe__name">${escapeHtml(parseProductDisplay(product).title)}</span>
            <span class="calc-recipe__sub tabular">${brl.format(product.p * qty)}</span>
          </div>`).join("");
    } else {
      recipeBox.hidden = true;
      recipeBox.innerHTML = "";
    }
  }

  if (currentCalcRecipe.length > 0) {
    const sum = currentCalcRecipe.reduce((acc, it) => acc + it.product.p * it.qty, 0);
    const countUnits = currentCalcRecipe.reduce((acc, it) => acc + it.qty, 0);
    if (addBtn) {
      addBtn.disabled = false;
      addBtn.textContent = `+ Lançar insumos na comanda (${brl.format(sum)})`;
    }
    if (hint) {
      hint.textContent = `${countUnits} UNIDADES REAIS DO ESTOQUE · PRONTA SEPARAÇÃO`;
    }
  } else {
    if (addBtn) addBtn.disabled = true;
    if (hint) hint.textContent = "CONSULTE OS ITENS NO CATÁLOGO ABAIXO";
  }
}

/* ==========================================================================
   9. CATALOG FILTERING, FREQUENCY GATE & SURGICAL DOM PATCHING
   ========================================================================== */
function matchesFilter(p) {
  if (state.cat !== "Todos" && p.g !== state.cat) return false;
  if (state.avail === "in" && !p.s) return false;
  if (state.avail === "out" && p.s) return false;
  if (state.q) {
    const hay = norm(`${p.n} ${p.c} ${p.g}`);
    if (!matchesTokens(hay, state.q)) return false;
  }
  return true;
}

function getFilteredProducts() {
  const list = PRODUCTS.filter(matchesFilter);
  list.sort((a, b) => {
    if (a.s !== b.s) return a.s ? -1 : 1;
    if (state.sort === "price-asc") return a.p - b.p;
    if (state.sort === "price-desc") return b.p - a.p;
    return a.n.localeCompare(b.n, "pt-BR");
  });
  return list;
}

function buildSkuControlsHtml(p, qtyIn) {
  const askUrl = waLink(`Olá! Vi no site o item "${p.n}" (cód. ${p.c}) e gostaria de confirmar disponibilidade no balcão.`);
  const consultBtn = !p.s
    ? `<a class="q-consult" href="${askUrl}" target="_blank" rel="noopener" title="Confirmar estoque no WhatsApp" aria-label="Confirmar no WhatsApp">
         <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
       </a>`
    : "";

  if (qtyIn > 0) {
    return `
      ${consultBtn}
      <div class="step-pill" role="group" aria-label="Quantidade na comanda">
        <button class="step-pill__btn" type="button" data-code="${escapeHtml(p.c)}" data-delta="-1" aria-label="Diminuir 1">−</button>
        <span class="step-pill__qty">${qtyIn}</span>
        <button class="step-pill__btn" type="button" data-code="${escapeHtml(p.c)}" data-delta="1" aria-label="Adicionar 1">+</button>
      </div>
      <button class="q-add" type="button" data-code="${escapeHtml(p.c)}" data-delta="5" title="Somar +5">+5</button>`;
  }

  return `
    ${consultBtn}
    <button class="q-add q-add--primary" type="button" data-code="${escapeHtml(p.c)}" data-delta="1" title="Adicionar 1">+1</button>
    <button class="q-add" type="button" data-code="${escapeHtml(p.c)}" data-delta="5" title="Adicionar 5">+5</button>
    <button class="q-add" type="button" data-code="${escapeHtml(p.c)}" data-delta="10" title="Adicionar 10">+10</button>`;
}

function renderCatalog(withContextSettle = false) {
  const list = getFilteredProducts();
  const slice = list.slice(0, state.shown);
  const grid = $("#grid");
  if (!grid) return;

  if (withContextSettle && !reducedMotion()) {
    grid.classList.remove("is-switching");
    void grid.offsetWidth;
    grid.classList.add("is-switching");
  }

  const hasFilter = Boolean(state.q || state.cat !== "Todos" || state.avail !== "all");
  const clearBtn = $("#clearAllBtn");
  if (clearBtn) clearBtn.hidden = !hasFilter;

  const rawQuery = ($("#search")?.value || "").trim();

  if (!list.length) {
    const askMissing = waLink(`Olá! Procurei por "${rawQuery || state.cat}" no catálogo da CeR e queria saber se vocês têm no balcão.`);
    grid.innerHTML = `
      <div class="empty-state">
        <div>
          <strong style="display:block;font-size:1.02rem;margin-bottom:0.25rem;">Nenhum item encontrado para “${escapeHtml(rawQuery || state.cat)}”</strong>
          <span style="color:var(--ink-secondary);font-size:0.88rem;">Tente uma bitola ou termo mais curto, ou consulte direto no balcão:</span>
        </div>
        <div class="empty-state__chips">
          <button type="button" data-suggest="argamassa">Argamassa</button>
          <button type="button" data-suggest="tubo">Tubos PVC</button>
          <button type="button" data-suggest="tinta">Tintas</button>
          <button type="button" data-suggest="registro">Registros</button>
          <button type="button" data-suggest="cabo flexivel">Cabos Elétricos</button>
        </div>
        <div class="empty-state__actions">
          <a class="btn btn--amber" href="${askMissing}" target="_blank" rel="noopener">Consultar no WhatsApp ↗</a>
          <button class="reset-btn mono" type="button" id="resetEmptyBtn">LIMPAR FILTROS</button>
        </div>
      </div>`;
    $("#resetEmptyBtn")?.addEventListener("click", resetFilters);
    $$("button[data-suggest]", grid).forEach((b) => {
      b.addEventListener("click", () => applySearch(b.dataset.suggest, false));
    });
  } else {
    grid.innerHTML = slice.map((p) => {
      const parsed = parseProductDisplay(p);
      const entry = quote.get(p.c);
      const qtyIn = entry ? entry.qty : 0;
      const titleHtml = highlightText(parsed.title, rawQuery);
      const codeHtml = highlightText(p.c || "—", rawQuery);
      const specsHtml = parsed.specs
        .map((sp) => `<span class="spec-chip">${highlightText(sp, rawQuery)}</span>`)
        .join("");

      return `
      <article class="sku-row ${p.s ? "" : "is-out"} ${qtyIn > 0 ? "in-slip" : ""}" data-code="${escapeHtml(p.c)}">
        <div class="sku-row__left">
          <div class="sku-row__meta">
            <span class="sku-code">#${codeHtml}</span>
            <span class="sku-sector">${escapeHtml(p.g)}</span>
            <span class="sku-stock ${p.s ? "sku-stock--in" : "sku-stock--out"}">${p.s ? "Pronta entrega" : "Sob consulta"}</span>
          </div>
          <div class="sku-title-line">
            <h3 class="sku-name">${titleHtml}</h3>
            ${specsHtml ? `<span class="sku-specs">${specsHtml}</span>` : ""}
          </div>
        </div>
        <div class="sku-row__right">
          <span class="sku-price">${brl.format(p.p)}<small>/${escapeHtml(p.u)}</small></span>
          <div class="sku-controls">
            ${buildSkuControlsHtml(p, qtyIn)}
          </div>
        </div>
      </article>`;
    }).join("");
  }

  const rc = $("#resultCount");
  if (rc) {
    rc.textContent = `${list.length.toLocaleString("pt-BR")} ${list.length === 1 ? "ITEM NO FILTRO" : "ITENS ENCONTRADOS"}`;
  }
  const shownCount = Math.min(state.shown, list.length);
  const remaining = Math.max(0, list.length - shownCount);
  const more = $("#loadMore");
  if (more) {
    more.hidden = remaining === 0;
    if (remaining > 0) {
      more.textContent = `Carregar mais · exibindo ${shownCount.toLocaleString("pt-BR")} de ${list.length.toLocaleString("pt-BR")}`;
    }
  }
}

function patchSkuRow(code) {
  patchHeroBenchRow(code);
  const p = PRODUCT_BY_CODE.get(code);
  if (!p) return;
  const row = $(`#grid .sku-row[data-code="${CSS.escape(code)}"]`);
  if (!row) return;
  const qtyIn = quote.get(code)?.qty || 0;
  row.classList.toggle("in-slip", qtyIn > 0);
  const ctrls = $(".sku-controls", row);
  if (ctrls) ctrls.innerHTML = buildSkuControlsHtml(p, qtyIn);
}

/* ==========================================================================
   10. SURGICAL ORDER SLIP WITH SMOOTH GRID-ROW HEIGHT COLLAPSE & PERSISTENCE
   ========================================================================== */
function buildSlipItemMarkup(product, qty) {
  const parsed = parseProductDisplay(product);
  return `
    <div class="slip-row-inner">
      <div class="slip-item">
        <div class="slip-item__top">
          <span class="slip-item__qty">${qty}×</span>
          <span class="slip-item__name">${escapeHtml(parsed.title)}</span>
          <span class="slip-item__sub">${brl.format(product.p * qty)}</span>
        </div>
        <div class="slip-item__bottom">
          <span class="slip-item__unit">#${escapeHtml(product.c)} · ${brl.format(product.p)}/${escapeHtml(product.u)}</span>
          <div class="slip-item__stepper">
            <button type="button" data-act="dec" aria-label="Diminuir">−</button>
            <button type="button" data-act="inc" aria-label="Aumentar">+</button>
            <button type="button" data-act="rem" aria-label="Remover item">×</button>
          </div>
        </div>
      </div>
    </div>`;
}

function syncSlipContainer(containerEl) {
  if (!containerEl) return;

  if (quote.size === 0) {
    const leaving = $$(".slip-row-wrap.is-leaving", containerEl);
    if (leaving.length === 0) {
      containerEl.innerHTML = `
        <div class="slip-empty">
          <strong>Ordem de retirada vazia</strong>
          Adicione materiais clicando em <b>+1</b>, <b>+5</b> ou usando os cassetes de kits prontos.
        </div>`;
    }
    return;
  }

  const emptyEl = $(".slip-empty", containerEl);
  if (emptyEl) emptyEl.remove();

  $$(".slip-row-wrap", containerEl).forEach((el) => {
    if (!quote.has(el.dataset.code) && !el.classList.contains("is-leaving")) {
      el.remove();
    }
  });

  for (const [code, { product, qty }] of quote.entries()) {
    let wrap = $(`.slip-row-wrap[data-code="${CSS.escape(code)}"]`, containerEl);
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "slip-row-wrap";
      wrap.dataset.code = code;
      wrap.innerHTML = buildSlipItemMarkup(product, qty);
      containerEl.appendChild(wrap);
    } else {
      // Interruptible: if user re-added while collapsing, cancel exit cleanly!
      if (wrap._removeTimer) {
        clearTimeout(wrap._removeTimer);
        wrap._removeTimer = null;
      }
      wrap.classList.remove("is-leaving");
      const qEl = $(".slip-item__qty", wrap);
      const sEl = $(".slip-item__sub", wrap);
      if (qEl) qEl.textContent = `${qty}×`;
      if (sEl) sEl.textContent = brl.format(product.p * qty);
    }
  }
}

let prevTotalValue = 0;

function updateQuoteUI(animateTotal = false) {
  let totalUnits = 0;
  let totalValue = 0;
  for (const { product, qty } of quote.values()) {
    totalUnits += qty;
    totalValue += product.p * qty;
  }

  persistQuoteMap();

  const badge = $("#headerBadge");
  if (badge) {
    badge.hidden = totalUnits === 0;
    badge.textContent = String(totalUnits);
    if (animateTotal && totalUnits > 0 && !reducedMotion()) {
      const prevBadgeTimer = SWAP_TIMERS.get("headerBadge");
      if (prevBadgeTimer) clearTimeout(prevBadgeTimer);
      badge.classList.add("is-updating");
      SWAP_TIMERS.set("headerBadge", setTimeout(() => {
        badge.classList.remove("is-updating");
        SWAP_TIMERS.delete("headerBadge");
      }, 170));
    }
  }

  const pill = $("#comandaCountPill");
  if (pill) pill.textContent = `${quote.size} ${quote.size === 1 ? "item" : "itens"}`;

  const fmtTotal = brl.format(totalValue);
  const comandaTotal = $("#comandaTotal");
  if (comandaTotal) {
    if (animateTotal && Math.abs(totalValue - prevTotalValue) > 0.001) {
      runManagedSwap("comandaTotal", comandaTotal, "is-morphing", 85, () => {
        comandaTotal.textContent = fmtTotal;
      });
    } else {
      comandaTotal.textContent = fmtTotal;
    }
  }
  prevTotalValue = totalValue;

  const drawerTotal = $("#drawerTotal");
  if (drawerTotal) drawerTotal.textContent = fmtTotal;
  const quoteTotal = $("#quoteTotal");
  if (quoteTotal) quoteTotal.textContent = fmtTotal;
  const quoteCount = $("#quoteCount");
  if (quoteCount) quoteCount.textContent = `${totalUnits} ${totalUnits === 1 ? "unidade" : "unidades"} na comanda`;

  const dock = $("#quoteDock");
  if (dock) {
    dock.classList.toggle("is-visible", totalUnits > 0);
    dock.setAttribute("aria-hidden", totalUnits === 0 ? "true" : "false");
  }

  const clearBtn = $("#comandaClear");
  if (clearBtn) clearBtn.hidden = quote.size === 0;
  const sendBtn = $("#comandaSend");
  if (sendBtn) sendBtn.disabled = quote.size === 0;
  const drawerSend = $("#quoteSend");
  if (drawerSend) drawerSend.disabled = quote.size === 0;

  syncSlipContainer($("#comandaList"));
  syncSlipContainer($("#drawerBody"));
}

function mutateQuote(code, delta) {
  const p = PRODUCT_BY_CODE.get(code);
  if (!p) return;
  const cur = quote.get(code)?.qty || 0;
  const next = cur + delta;

  if (next <= 0) {
    const wraps = [
      $(`#comandaList .slip-row-wrap[data-code="${CSS.escape(code)}"]`),
      $(`#drawerBody .slip-row-wrap[data-code="${CSS.escape(code)}"]`),
    ].filter(Boolean);

    quote.delete(code);
    patchSkuRow(code);

    if (wraps.length && !reducedMotion()) {
      wraps.forEach((w) => {
        w.classList.add("is-leaving");
        if (w._removeTimer) clearTimeout(w._removeTimer);
        w._removeTimer = setTimeout(() => {
          w.remove();
          if (quote.size === 0) {
            syncSlipContainer($("#comandaList"));
            syncSlipContainer($("#drawerBody"));
          }
        }, 205);
      });
      updateQuoteUI(true);
    } else {
      updateQuoteUI(true);
    }
    return;
  }

  quote.set(code, { product: p, qty: next });
  patchSkuRow(code);
  updateQuoteUI(true);
}

/* ==========================================================================
   11. BLUEPRINT BENTO CORRIDORS (WITH CAD VECTORS) & SIDEBAR
   ========================================================================== */
function moveSectorIndicator() {
  const list = $("#chips");
  if (!list || window.innerWidth <= 960) return;
  const ind = $(".sector-indicator", list);
  const active = $('.corridor-btn[aria-selected="true"]', list);
  if (!ind || !active) return;
  const y = active.offsetTop + Math.max(4, (active.offsetHeight - 24) / 2);
  ind.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
  ind.style.opacity = "1";
}

function selectCategory(cat, scroll = false) {
  state.cat = cat;
  state.shown = PAGE;
  $$("#chips .corridor-btn").forEach((b) => {
    b.setAttribute("aria-selected", b.dataset.cat === cat ? "true" : "false");
  });
  moveSectorIndicator();
  renderCatalog(true);
  if (scroll) $("#catalogo")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
}

function buildSectorsAndBento() {
  const stats = new Map();
  let totalInStock = 0;

  for (const p of PRODUCTS) {
    if (p.s) totalInStock++;
    let rec = stats.get(p.g);
    if (!rec) {
      rec = { count: 0, inStock: 0, minPrice: Infinity, samples: [], topItems: [] };
      stats.set(p.g, rec);
    }
    rec.count++;
    if (p.s) rec.inStock++;
    if (p.p > 0.5 && p.p < rec.minPrice) rec.minPrice = p.p;
    if (rec.samples.length < 4) {
      const title = parseProductDisplay(p).title.split(" ").slice(0, 2).join(" ");
      if (!rec.samples.includes(title)) rec.samples.push(title);
    }
    if (p.s && rec.topItems.length < 3) {
      rec.topItems.push(p);
    }
  }

  const sortedCats = [...stats.keys()].sort((a, b) => {
    if (a === "Diversos") return 1;
    if (b === "Diversos") return -1;
    return stats.get(b).count - stats.get(a).count;
  });

  const deptFact = $("#deptCountFact");
  if (deptFact) deptFact.textContent = String(sortedCats.length);

  const ratioMeta = $("#stockRatioMeta");
  if (ratioMeta && PRODUCTS.length) {
    const pct = Math.round((totalInStock / PRODUCTS.length) * 100);
    ratioMeta.textContent = `${totalInStock.toLocaleString("pt-BR")} PRONTA ENTREGA (${pct}% DO CATÁLOGO)`;
  }

  const featured = sortedCats.slice(0, 6);
  const rest = sortedCats.slice(6);

  const bentoEl = $("#deptFeatured");
  if (bentoEl) {
    bentoEl.innerHTML = featured.map((cat, i) => {
      const st = stats.get(cat);
      const minFmt = Number.isFinite(st.minPrice) ? brl.format(st.minPrice) : "—";
      return `
        <button class="dir-row" type="button" data-cat="${escapeHtml(cat)}" data-idx="${i}">
          <span class="dir-row__idx tabular">C-${String(i + 1).padStart(2, "0")}</span>
          <span class="dir-row__title">${escapeHtml(cat)}</span>
          <span class="dir-row__samples">${escapeHtml(st.samples.slice(0, 3).join(" · "))}</span>
          <span class="dir-row__meta tabular">
            <strong>${st.count.toLocaleString("pt-BR")} SKUs</strong>
            <span>desde ${minFmt}</span>
          </span>
          <span class="dir-row__arrow" aria-hidden="true">↗</span>
        </button>`;
    }).join("");

    bentoEl.onclick = (e) => {
      const btn = e.target.closest(".dir-row");
      if (btn) selectCategory(btn.dataset.cat, true);
    };

    initDirectorySpecimen(stats, featured);
  }

  const stripEl = $("#deptIndex");
  if (stripEl) {
    stripEl.innerHTML = rest.map((cat, i) => {
      const st = stats.get(cat);
      return `
        <button class="strip-cell" type="button" data-cat="${escapeHtml(cat)}">
          <span class="strip-cell__left">
            <span class="strip-cell__code tabular">C-${String(i + 7).padStart(2, "0")}</span>
            <span class="strip-cell__name">${escapeHtml(cat)}</span>
          </span>
          <span class="strip-cell__count tabular">${st.count.toLocaleString("pt-BR")}</span>
        </button>`;
    }).join("");

    stripEl.onclick = (e) => {
      const btn = e.target.closest(".strip-cell");
      if (btn) selectCategory(btn.dataset.cat, true);
    };
  }

  const allCats = ["Todos", ...sortedCats];
  const chipsEl = $("#chips");
  if (chipsEl) {
    chipsEl.innerHTML = `<span class="sector-indicator" aria-hidden="true"></span>` + allCats.map((c) => {
      const cnt = c === "Todos" ? PRODUCTS.length : stats.get(c).count;
      return `
        <button class="corridor-btn" type="button" role="tab" aria-selected="${c === state.cat}" data-cat="${escapeHtml(c)}">
          <span class="corridor-btn__name">${escapeHtml(c)}</span>
          <span class="corridor-btn__count">${cnt.toLocaleString("pt-BR")}</span>
        </button>`;
    }).join("");

    chipsEl.onclick = (e) => {
      const btn = e.target.closest(".corridor-btn");
      if (btn) selectCategory(btn.dataset.cat, false);
    };
    requestAnimationFrame(moveSectorIndicator);
  }

  const footEl = $("#footSectors");
  if (footEl) {
    footEl.innerHTML = sortedCats.slice(0, 6).map((c) =>
      `<button type="button" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`
    ).join("");
    footEl.onclick = (e) => {
      const btn = e.target.closest("button[data-cat]");
      if (btn) selectCategory(btn.dataset.cat, true);
    };
  }
}

/* Signature Awwwards Interaction: Sliding Row Highlight + Spring-Interpolated CAD Specimen */
let dirSpecimenCleanup = null;

function initDirectorySpecimen(stats, featured) {
  if (dirSpecimenCleanup) {
    dirSpecimenCleanup();
    dirSpecimenCleanup = null;
  }
  const dir = $("#corridorDirectory");
  const highlight = $("#directoryHighlight");
  const specimen = $("#floatingSpecimen");
  const rowsWrap = $("#deptFeatured");
  if (!dir || !highlight || !specimen || !rowsWrap || !finePointer()) return;

  const specCode = $("#specCode");
  const specStock = $("#specStock");
  const specCad = $("#specCad");
  const specItems = $("#specItems");

  let activeRow = null;
  let targetX = 0, targetY = 0;
  let curX = 0, curY = 0;
  let vx = 0, vy = 0;
  let raf = 0;
  let initializedPos = false;

  function springTick() {
    vx = (vx + (targetX - curX) * 0.14) * 0.74;
    vy = (vy + (targetY - curY) * 0.14) * 0.74;
    curX += vx;
    curY += vy;

    specimen.style.transform = `translate3d(${curX.toFixed(1)}px, ${curY.toFixed(1)}px, 0) scale(1)`;

    if (Math.abs(targetX - curX) > 0.25 || Math.abs(targetY - curY) > 0.25 || Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
      raf = requestAnimationFrame(springTick);
    } else {
      raf = 0;
    }
  }

  function updateSpecimenData(row) {
    const cat = row.dataset.cat;
    const idx = Number(row.dataset.idx) || 0;
    const st = stats.get(cat);
    if (!st) return;

    const pct = Math.round((st.inStock / st.count) * 100);
    if (specCode) specCode.textContent = `CORREDOR C-${String(idx + 1).padStart(2, "0")}`;
    if (specStock) specStock.textContent = `${pct}% PRONTA ENTREGA`;
    if (specCad) specCad.innerHTML = getSectorCadSvg(cat);
    if (specItems) {
      specItems.innerHTML = st.topItems.map((p) => `
        <div class="spec-mini-row">
          <span>${escapeHtml(parseProductDisplay(p).title)}</span>
          <strong class="tabular">${brl.format(p.p)}</strong>
        </div>`).join("");
    }
  }

  function onPointerMove(e) {
    const rect = dir.getBoundingClientRect();
    const row = e.target.closest(".dir-row");

    if (row && row !== activeRow) {
      activeRow?.classList.remove("is-hovered");
      activeRow = row;
      activeRow.classList.add("is-hovered");
      highlight.style.transform = `translate3d(0, ${row.offsetTop}px, 0)`;
      highlight.style.height = `${row.offsetHeight}px`;
      dir.classList.add("is-hovering");
      updateSpecimenData(row);
    }

    if (!reducedMotion() && window.innerWidth > 980) {
      const cardW = 286;
      const cardH = 228;
      // Keep specimen anchored gracefully right-of-center without blocking titles
      const rawX = e.clientX - rect.left + 28;
      const clampedX = Math.max(rect.width * 0.42, Math.min(rect.width - cardW - 12, rawX));
      const rawY = e.clientY - rect.top - cardH * 0.5;
      const clampedY = Math.max(-24, Math.min(rect.height - cardH + 24, rawY));

      targetX = clampedX;
      targetY = clampedY;

      if (!initializedPos) {
        curX = targetX;
        curY = targetY;
        initializedPos = true;
        specimen.style.transform = `translate3d(${curX.toFixed(1)}px, ${curY.toFixed(1)}px, 0) scale(1)`;
      }
      specimen.classList.add("is-visible");
      if (!raf) raf = requestAnimationFrame(springTick);
    }
  }

  function onPointerLeave() {
    activeRow?.classList.remove("is-hovered");
    activeRow = null;
    dir.classList.remove("is-hovering");
    specimen.classList.remove("is-visible");
    initializedPos = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  rowsWrap.addEventListener("mousemove", onPointerMove);
  rowsWrap.addEventListener("mouseleave", onPointerLeave);
  dirSpecimenCleanup = () => {
    rowsWrap.removeEventListener("mousemove", onPointerMove);
    rowsWrap.removeEventListener("mouseleave", onPointerLeave);
    if (raf) cancelAnimationFrame(raf);
  };
}

/* Quick Obra Kits */
const KIT_RECIPES = {
  piso: [
    { code: "0145", q: "argamassa ac 2 x 20 kg", qty: 2 },
    { code: "3470", q: "espacador nivelador", qty: 1 },
    { code: "3464", q: "cunha", qty: 1 },
    { code: "1434", q: "rejunte branco 1 kg", qty: 1 },
    { code: "0839", q: "espatula para rejunte", qty: 1 },
  ],
  pintura: [
    { code: "2395", q: "tinta acrilica", qty: 1 },
    { code: "1768", q: "trincha 2", qty: 1 },
    { code: "0971", q: "fita crepe 24mm", qty: 1 },
    { code: "0156", q: "bandeja pintura", qty: 1 },
    { code: "2222", q: "rolo la antirespingo", qty: 1 },
    { code: "2077", q: "lixa", qty: 2 },
  ],
  hidraulica: [
    { code: "0061", q: "veda rosca", qty: 1 },
    { code: "0005", q: "adesivo plastico", qty: 1 },
    { code: "1532", q: "lamina serra", qty: 1 },
    { code: "2075", q: "lixa", qty: 1 },
  ],
};

function resolveKitItems(kitName) {
  const recipe = KIT_RECIPES[kitName];
  if (!recipe) return [];
  const items = [];
  for (const step of recipe) {
    const match = findBestProduct(step.code, step.q);
    if (match) items.push({ product: match, qty: step.qty });
  }
  return items;
}

function hydrateKitPrices() {
  for (const key of Object.keys(KIT_RECIPES)) {
    const el = $(`[data-kit-price="${key}"]`);
    if (!el) continue;
    const items = resolveKitItems(key);
    if (items.length) {
      const sum = items.reduce((acc, it) => acc + it.product.p * it.qty, 0);
      el.textContent = brl.format(sum);
    }
  }
}

/* ==========================================================================
   12. INTERRUPTIBLE POPOVER ([data-open]) & RAYCAST COMMAND PALETTE
   ========================================================================== */
function applySearch(term, scrollToCatalog = false) {
  const clean = String(term || "").trim();
  const sInput = $("#search");
  if (sInput) sInput.value = clean;
  const sClear = $("#searchClear");
  if (sClear) sClear.hidden = clean === "";
  const hInput = $("#heroSearch");
  if (hInput && document.activeElement !== hInput) hInput.value = clean;

  closeHeroPreview();
  state.q = norm(clean);
  state.cat = "Todos";
  state.shown = PAGE;
  $$("#chips .corridor-btn").forEach((b) => {
    b.setAttribute("aria-selected", b.dataset.cat === "Todos" ? "true" : "false");
  });
  moveSectorIndicator();
  renderCatalog(false);
  if (scrollToCatalog) {
    $("#catalogo")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
  }
}

function resetFilters() {
  state = { ...state, q: "", cat: "Todos", avail: "all", shown: PAGE };
  if ($("#search")) $("#search").value = "";
  if ($("#heroSearch")) $("#heroSearch").value = "";
  if ($("#searchClear")) $("#searchClear").hidden = true;

  const availTabs = $("#availTabs");
  if (availTabs) {
    $$(".clip-tabs__base .clip-tabs__btn", availTabs).forEach((b, i) => {
      b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    });
    syncClipTabs(availTabs, 0);
  }
  selectCategory("Todos", false);
}

function closeHeroPreview() {
  const pop = $("#heroPreview");
  const input = $("#heroSearch");
  if (pop) {
    pop.setAttribute("data-open", "false");
    pop.setAttribute("aria-hidden", "true");
  }
  if (input) input.setAttribute("aria-expanded", "false");
}

function renderHeroPreview(raw) {
  const pop = $("#heroPreview");
  const input = $("#heroSearch");
  if (!pop || !input) return;

  const q = raw.trim();
  if (q.length < 2) {
    closeHeroPreview();
    return;
  }

  const nq = norm(q);
  const matches = PRODUCTS.filter((p) => matchesTokens(norm(`${p.n} ${p.c} ${p.g}`), nq)).slice(0, 5);
  if (!matches.length) {
    closeHeroPreview();
    return;
  }

  pop.innerHTML = matches.map((p) => {
    const parsed = parseProductDisplay(p);
    return `
      <div class="pop-row" role="option" data-code="${escapeHtml(p.c)}">
        <div class="pop-row__main">
          <div class="pop-row__title">${highlightText(parsed.title, q)}</div>
          <div class="pop-row__specs">
            <span class="mono" style="font-size:0.64rem;color:var(--amber-text)">#${highlightText(p.c, q)}</span>
            ${parsed.specs.slice(0, 2).map((s) => `<span class="spec-chip">${escapeHtml(s)}</span>`).join("")}
          </div>
        </div>
        <div class="pop-row__right">
          <span class="pop-row__price tabular">${brl.format(p.p)}</span>
          <button class="pop-row__add" type="button" data-pop-add="${escapeHtml(p.c)}" title="Adicionar +1 na comanda">+1</button>
        </div>
      </div>`;
  }).join("");

  pop.setAttribute("data-open", "true");
  pop.setAttribute("aria-hidden", "false");
  input.setAttribute("aria-expanded", "true");
}

/* Raycast-Instant Command Palette (0ms open, immediate synchronous focus) */
let cmdIndex = 0;

function openCmd() {
  const overlay = $("#cmdBackdrop");
  const input = $("#cmdInput");
  if (!overlay || !input) return;
  closeHeroPreview();
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
  input.value = "";
  renderCmdList("");
  input.focus();
}

function closeCmd() {
  const overlay = $("#cmdBackdrop");
  if (!overlay) return;
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
}

function renderCmdList(rawQuery) {
  const q = rawQuery.trim();
  const nq = norm(q);
  const list = nq
    ? PRODUCTS.filter((p) => matchesTokens(norm(`${p.n} ${p.c} ${p.g}`), nq)).slice(0, 12)
    : PRODUCTS.filter((p) => p.s).slice(0, 8);

  cmdIndex = 0;
  const box = $("#cmdResults");
  if (!box) return;

  if (!list.length) {
    box.innerHTML = `<p class="mono" style="padding:1.6rem;text-align:center;">Nenhum material encontrado para “${escapeHtml(q)}”.</p>`;
    return;
  }

  box.innerHTML = list.map((p, i) => {
    const parsed = parseProductDisplay(p);
    return `
      <div class="cmd-item ${i === 0 ? "is-selected" : ""}" role="option" data-code="${escapeHtml(p.c)}">
        <div class="cmd-item__left">
          <div class="cmd-item__title">${highlightText(parsed.title, q)}</div>
          <div class="cmd-item__meta">#${highlightText(p.c, q)} · ${escapeHtml(p.g)} · ${p.s ? "PRONTA ENTREGA" : "SOB CONSULTA"}</div>
        </div>
        <div class="cmd-item__right">
          <span class="cmd-item__price">${brl.format(p.p)}</span>
        </div>
      </div>`;
  }).join("");
}

function pickCmdItem(rowEl) {
  if (!rowEl) return;
  const code = rowEl.dataset.code;
  const p = PRODUCT_BY_CODE.get(code);
  if (!p) return;
  mutateQuote(code, 1);
  toast(`+1 ${parseProductDisplay(p).title}`);
  closeCmd();
}

/* ==========================================================================
   13. SHEET DRAWER + VAUL MOMENTUM SWIPE-TO-DISMISS
   ========================================================================== */
function openDrawer() {
  const backdrop = $("#drawerBackdrop");
  const drawer = $("#drawer");
  if (!backdrop || !drawer) return;
  drawer.style.transform = "";
  backdrop.classList.add("is-open");
  backdrop.setAttribute("aria-hidden", "false");
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  const backdrop = $("#drawerBackdrop");
  const drawer = $("#drawer");
  if (!backdrop || !drawer) return;
  drawer.style.transform = "";
  backdrop.classList.remove("is-open");
  backdrop.setAttribute("aria-hidden", "true");
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
}

function initSheetGestures() {
  const handle = $("#drawerHandle");
  const drawer = $("#drawer");
  if (!handle || !drawer) return;

  let dragging = false;
  let activePointerId = null;
  let startY = 0;
  let startTime = 0;
  let currentDy = 0;

  handle.addEventListener("pointerdown", (e) => {
    if (window.innerWidth > 960 || dragging) return;
    dragging = true;
    activePointerId = e.pointerId;
    startY = e.clientY;
    startTime = performance.now();
    currentDy = 0;
    drawer.classList.add("is-dragging");
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== activePointerId) return;
    const rawDy = e.clientY - startY;
    currentDy = rawDy < 0 ? rawDy * 0.18 : rawDy;
    drawer.style.transform = `translate3d(0, ${currentDy.toFixed(1)}px, 0)`;
  });

  function endDrag(e) {
    if (!dragging || e.pointerId !== activePointerId) return;
    dragging = false;
    activePointerId = null;
    drawer.classList.remove("is-dragging");

    const elapsed = Math.max(1, performance.now() - startTime);
    const velocity = currentDy / elapsed;

    if (currentDy >= 110 || velocity > 0.11) {
      closeDrawer();
    } else {
      drawer.style.transform = "";
    }
  }

  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);
}

/* ==========================================================================
   14. SPRING-INTERPOLATED MAGNETIC CTA (Fine pointer only)
   ========================================================================== */
function initSpringMagnetic() {
  if (reducedMotion() || !finePointer()) return;
  $$(".magnetic-cta").forEach((el) => {
    let targetX = 0, targetY = 0;
    let curX = 0, curY = 0;
    let vx = 0, vy = 0;
    let raf = 0;

    function tick() {
      vx = (vx + (targetX - curX) * 0.16) * 0.72;
      vy = (vy + (targetY - curY) * 0.16) * 0.72;
      curX += vx;
      curY += vy;

      if (Math.abs(curX - targetX) > 0.08 || Math.abs(curY - targetY) > 0.08 || Math.abs(vx) > 0.05) {
        el.style.transform = `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0)`;
        raf = requestAnimationFrame(tick);
      } else {
        curX = targetX;
        curY = targetY;
        el.style.transform = targetX === 0 && targetY === 0 ? "" : `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0)`;
        raf = 0;
      }
    }

    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      targetX = ((e.clientX - r.left) / r.width - 0.5) * 8;
      targetY = ((e.clientY - r.top) / r.height - 0.5) * 6;
      if (!raf) raf = requestAnimationFrame(tick);
    });

    el.addEventListener("mouseleave", () => {
      targetX = 0;
      targetY = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    });
  });
}

/* ==========================================================================
   15. WHATSAPP DISPATCH, TIMER-SAFE THEME MORPH & EVENT WIRING
   ========================================================================== */
function sendQuoteWhatsApp(btn) {
  if (!quote.size) return;
  let total = 0;
  const lines = [...quote.values()].map(({ product, qty }) => {
    total += product.p * qty;
    return `• ${qty}x ${product.n} (cód. ${product.c}) — ${brl.format(product.p)}/${product.u}`;
  });
  const text = `Olá! Montei esta ordem de retirada no site da CeR Casa e Reforma:\n\n${lines.join("\n")}\n\nTotal estimado: ${brl.format(total)}\nPodem confirmar a separação no balcão?`;
  const url = waLink(text);

  if (btn && !reducedMotion()) {
    const prev = btn.dataset.origLabel || btn.textContent;
    btn.dataset.origLabel = prev;
    btn.classList.add("is-sending");
    btn.textContent = "✓ Abrindo WhatsApp…";
    setTimeout(() => {
      window.open(url, "_blank", "noopener");
      setTimeout(() => {
        btn.classList.remove("is-sending");
        btn.textContent = prev;
      }, 600);
    }, 220);
  } else {
    window.open(url, "_blank", "noopener");
  }
}

function initThemeToggle() {
  const btn = $("#themeToggle");
  const wrap = $("#themeIconWrap");
  const label = $("#themeLabel");
  const meta = $("#themeColorMeta");
  if (!btn) return;

  const sunSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-14.93 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
  const moonSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;

  function syncThemeUI(morph = false) {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    btn.setAttribute("aria-pressed", isDark ? "true" : "false");
    btn.setAttribute("aria-label", isDark ? "Alternar para modo claro" : "Alternar para modo escuro");
    if (label) label.textContent = isDark ? "Claro" : "Escuro";
    if (meta) meta.setAttribute("content", isDark ? "#0b0b09" : "#f3efe6");

    if (wrap) {
      if (morph) {
        runManagedSwap("themeIcon", wrap, "is-morphing", 100, () => {
          wrap.innerHTML = isDark ? sunSvg : moonSvg;
        });
      } else {
        wrap.innerHTML = isDark ? sunSvg : moonSvg;
      }
    }
  }

  btn.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      try { localStorage.setItem("cer_theme", "light"); } catch {}
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      try { localStorage.setItem("cer_theme", "dark"); } catch {}
    }
    syncThemeUI(true);
  });

  syncThemeUI(false);
}

function wireInteractions() {
  const heroForm = $("#heroSearchForm");
  const heroInput = $("#heroSearch");
  const heroPreview = $("#heroPreview");

  heroForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    applySearch(heroInput?.value || "", true);
  });

  heroInput?.addEventListener("input", (e) => {
    renderHeroPreview(e.target.value);
  });

  heroInput?.addEventListener("focus", (e) => {
    if (e.target.value.trim().length >= 2) renderHeroPreview(e.target.value);
  });

  heroPreview?.addEventListener("click", (e) => {
    const addBtn = e.target.closest("[data-pop-add]");
    if (addBtn) {
      e.stopPropagation();
      const code = addBtn.dataset.popAdd;
      const p = PRODUCT_BY_CODE.get(code);
      mutateQuote(code, 1);
      if (p) toast(`+1 ${parseProductDisplay(p).title}`);
      return;
    }
    const row = e.target.closest(".pop-row");
    if (row) {
      const p = PRODUCT_BY_CODE.get(row.dataset.code);
      if (p) applySearch(p.c, true);
    }
  });

  $("#heroLiveSample")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-bench-add]");
    if (!btn) return;
    const code = btn.dataset.benchAdd;
    const p = PRODUCT_BY_CODE.get(code);
    mutateQuote(code, 1);
    if (p) toast(`+1 ${parseProductDisplay(p).title}`);
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".hero-console")) closeHeroPreview();
  });

  $("#heroTags")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-q]");
    if (b) applySearch(b.dataset.q, true);
  });

  // Calculator Clip-Path Tabs + Inputs
  const calcTabs = $("#calcTabs");
  calcTabs?.addEventListener("click", (e) => {
    const btn = e.target.closest(".clip-tabs__base .clip-tabs__btn");
    if (!btn) return;
    const btns = $$(".clip-tabs__base .clip-tabs__btn", calcTabs);
    const idx = btns.indexOf(btn);
    calcMode = btn.dataset.calc;
    btns.forEach((b, i) => b.setAttribute("aria-selected", i === idx ? "true" : "false"));
    syncClipTabs(calcTabs, idx);

    const wrap = $("#calcExtraWrap");
    const label = $("#calcExtraLabel");
    const sel = $("#calcExtra");

    const swapSelect = () => {
      if (calcMode === "piso") {
        if (label) label.textContent = "ESPECIFICAÇÃO DA ARGAMASSA";
        if (sel) {
          sel.innerHTML = `
            <option value="ac1">Uso Interno Seco — AC-I</option>
            <option value="ac2" selected>Áreas Úmidas / Externas — AC-II</option>
            <option value="ac3">Porcelanato / Sobreposição — AC-III</option>`;
        }
      } else {
        if (label) label.textContent = "NÚMERO DE DEMÃOS";
        if (sel) {
          sel.innerHTML = `
            <option value="2" selected>2 demãos — Repintura padrão</option>
            <option value="3">3 demãos — Reboco novo / cor intensa</option>`;
        }
      }
      updateCalc();
    };

    runManagedSwap("calcModeField", wrap, "is-morphing", 100, swapSelect);
  });

  $("#calcArea")?.addEventListener("input", (e) => {
    const val = Math.min(5000, Math.max(1, Number(e.target.value) || 1));
    const range = $("#calcAreaRange");
    if (range) range.value = String(Math.min(200, val));
    updateCalc();
  });

  $("#calcAreaRange")?.addEventListener("input", (e) => {
    const areaInput = $("#calcArea");
    if (areaInput) areaInput.value = e.target.value;
    updateCalc();
  });

  $("#areaPresets")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-area]");
    if (!b) return;
    const v = b.dataset.area;
    if ($("#calcArea")) $("#calcArea").value = v;
    if ($("#calcAreaRange")) $("#calcAreaRange").value = v;
    updateCalc();
  });

  $("#calcExtra")?.addEventListener("change", updateCalc);

  $("#calcResult")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-search]");
    if (b) applySearch(b.dataset.search, true);
  });

  $("#calcAddKitBtn")?.addEventListener("click", () => {
    if (!currentCalcRecipe.length) return;
    for (const { product, qty } of currentCalcRecipe) {
      const cur = quote.get(product.c)?.qty || 0;
      quote.set(product.c, { product, qty: cur + qty });
      patchSkuRow(product.c);
    }
    updateQuoteUI(true);
    toast(`Estimativa lançada (${currentCalcRecipe.length} insumos na comanda)`);
  });

  // Catalog Controls
  const availTabs = $("#availTabs");
  availTabs?.addEventListener("click", (e) => {
    const btn = e.target.closest(".clip-tabs__base .clip-tabs__btn");
    if (!btn) return;
    const btns = $$(".clip-tabs__base .clip-tabs__btn", availTabs);
    const idx = btns.indexOf(btn);
    state.avail = btn.dataset.avail;
    state.shown = PAGE;
    btns.forEach((b, i) => b.setAttribute("aria-pressed", i === idx ? "true" : "false"));
    syncClipTabs(availTabs, idx);
    renderCatalog(true);
  });

  $("#sortSelect")?.addEventListener("change", (e) => {
    state.sort = e.target.value;
    state.shown = PAGE;
    renderCatalog(false);
  });

  let searchDebounce;
  $("#search")?.addEventListener("input", (e) => {
    const v = e.target.value.trim();
    const clr = $("#searchClear");
    if (clr) clr.hidden = v === "";
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.q = norm(v);
      state.shown = PAGE;
      renderCatalog(false);
    }, 80);
  });

  $("#searchClear")?.addEventListener("click", () => {
    const s = $("#search");
    if (s) {
      s.value = "";
      s.focus();
    }
    $("#searchClear").hidden = true;
    state.q = "";
    state.shown = PAGE;
    renderCatalog(false);
  });

  $("#quickTags")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-q]");
    if (b) applySearch(b.dataset.q, false);
  });

  $("#quickKits")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".kit-cassette");
    if (!btn) return;
    const items = resolveKitItems(btn.dataset.kit);
    if (!items.length) return;
    for (const { product, qty } of items) {
      const cur = quote.get(product.c)?.qty || 0;
      quote.set(product.c, { product, qty: cur + qty });
      patchSkuRow(product.c);
    }
    updateQuoteUI(true);
    toast(`Kit adicionado (${items.length} itens na comanda)`);
  });

  $("#clearAllBtn")?.addEventListener("click", resetFilters);
  $("#loadMore")?.addEventListener("click", () => {
    state.shown += PAGE;
    renderCatalog(false);
  });

  $("#grid")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-code][data-delta]");
    if (!btn) return;
    const code = btn.dataset.code;
    const delta = Number(btn.dataset.delta) || 1;
    const p = PRODUCT_BY_CODE.get(code);
    mutateQuote(code, delta);
    if (p && delta > 0) {
      toast(`+${delta} ${parseProductDisplay(p).title}`);
    }
  });

  function onSlipAction(e) {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const wrap = btn.closest(".slip-row-wrap");
    if (!wrap) return;
    const code = wrap.dataset.code;
    const act = btn.dataset.act;
    if (act === "inc") mutateQuote(code, 1);
    else if (act === "dec") mutateQuote(code, -1);
    else if (act === "rem") mutateQuote(code, -999999);
  }
  $("#comandaList")?.addEventListener("click", onSlipAction);
  $("#drawerBody")?.addEventListener("click", onSlipAction);

  function clearAllQuote() {
    const codes = [...quote.keys()];
    quote.clear();
    codes.forEach(patchSkuRow);
    updateQuoteUI(true);
    closeDrawer();
    toast("Ordem de retirada esvaziada");
  }
  $("#comandaClear")?.addEventListener("click", clearAllQuote);
  $("#quoteClear")?.addEventListener("click", clearAllQuote);

  $("#comandaSend")?.addEventListener("click", (e) => sendQuoteWhatsApp(e.currentTarget));
  $("#quoteSend")?.addEventListener("click", (e) => sendQuoteWhatsApp(e.currentTarget));

  $("#openDrawer")?.addEventListener("click", openDrawer);
  $("#openDrawerDock")?.addEventListener("click", openDrawer);
  $("#closeDrawer")?.addEventListener("click", closeDrawer);
  $("#drawerBackdrop")?.addEventListener("click", closeDrawer);

  // Command Palette Events
  $("#openCmd")?.addEventListener("click", openCmd);
  $("#cmdBackdrop")?.addEventListener("click", (e) => {
    if (e.target === $("#cmdBackdrop")) closeCmd();
  });
  $("#cmdInput")?.addEventListener("input", (e) => renderCmdList(e.target.value));
  $("#cmdInput")?.addEventListener("keydown", (e) => {
    const rows = $$("#cmdResults .cmd-item");
    if (!rows.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      rows[cmdIndex]?.classList.remove("is-selected");
      cmdIndex = (cmdIndex + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
      rows[cmdIndex]?.classList.add("is-selected");
      rows[cmdIndex]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      pickCmdItem(rows[cmdIndex]);
    }
  });
  $("#cmdResults")?.addEventListener("click", (e) => {
    pickCmdItem(e.target.closest(".cmd-item"));
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      $("#cmdBackdrop")?.classList.contains("is-open") ? closeCmd() : openCmd();
    } else if (e.key === "Escape") {
      closeCmd();
      closeDrawer();
      closeHeroPreview();
    }
  });

  // Mobile Menu
  const burger = $("#burger");
  const nav = $("#mainNav");
  burger?.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    burger.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });
  $$("#mainNav a").forEach((a) => {
    a.addEventListener("click", () => {
      nav?.classList.remove("is-open");
      burger?.classList.remove("is-open");
      burger?.setAttribute("aria-expanded", "false");
    });
  });

  // Interruptible Timer-Safe Copy Address
  const copyBtn = $("#copyAddressBtn");
  const copyLabel = $("#copyAddressLabel");
  copyBtn?.addEventListener("click", () => {
    const addr = "Rua Bezerra de Menezes, 72 - Nazaré, Belo Horizonte - MG, CEP 31990-420";
    if (navigator.clipboard) navigator.clipboard.writeText(addr).catch(() => {});
    toast("Endereço copiado para a área de transferência");
    if (copyLabel) {
      const prevRevert = SWAP_TIMERS.get("copyRevert");
      if (prevRevert) clearTimeout(prevRevert);

      runManagedSwap("copySwap", copyLabel, "is-swapping", 110, () => {
        copyLabel.textContent = "✓ Endereço copiado";
        const revId = setTimeout(() => {
          SWAP_TIMERS.delete("copyRevert");
          runManagedSwap("copySwap", copyLabel, "is-swapping", 110, () => {
            copyLabel.textContent = "Copiar endereço";
          });
        }, 1600);
        SWAP_TIMERS.set("copyRevert", revId);
      });
    }
  });

  function syncAllClipTabs() {
    const calcActive = $$("#calcTabs .clip-tabs__base .clip-tabs__btn").findIndex((b) => b.getAttribute("aria-selected") === "true");
    syncClipTabs($("#calcTabs"), Math.max(0, calcActive));
    const availActive = $$("#availTabs .clip-tabs__base .clip-tabs__btn").findIndex((b) => b.getAttribute("aria-pressed") === "true");
    syncClipTabs($("#availTabs"), Math.max(0, availActive));
    moveSectorIndicator();
  }
  requestAnimationFrame(syncAllClipTabs);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncAllClipTabs).catch(() => {});
  }
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(() => syncAllClipTabs());
    $$(".clip-tabs__base").forEach((el) => ro.observe(el));
  }
  window.addEventListener("resize", syncAllClipTabs);

  const wa = $("#waLink");
  if (wa) wa.href = waLink("Olá! Vim pelo site da CeR Casa e Reforma.");
  const yr = $("#year");
  if (yr) yr.textContent = String(new Date().getFullYear());
}

/* ==========================================================================
   16. CATALOG INITIALIZATION, QUOTE REHYDRATION & ERP LIVE SYNC
   ========================================================================== */
function initCatalog(data) {
  PRODUCTS = Array.isArray(data) ? data : [];
  PRODUCT_BY_CODE = new Map(PRODUCTS.map((p) => [p.c, p]));
  DISPLAY_CACHE.clear();

  const countFact = $("#countFact");
  if (countFact) countFact.textContent = PRODUCTS.length.toLocaleString("pt-BR");

  // Rehydrate saved quote on initial boot using live ERP prices
  if (savedQuoteRaw && savedQuoteRaw.size > 0 && quote.size === 0) {
    for (const [code, qty] of savedQuoteRaw.entries()) {
      const prod = PRODUCT_BY_CODE.get(code);
      if (prod) quote.set(code, { product: prod, qty });
    }
    savedQuoteRaw = null;
  } else if (quote.size > 0) {
    for (const [code, entry] of quote.entries()) {
      const fresh = PRODUCT_BY_CODE.get(code);
      if (fresh) entry.product = fresh;
    }
  }

  renderHeroBench();
  buildSectorsAndBento();
  hydrateKitPrices();
  updateCalc();
  renderCatalog(false);
  updateQuoteUI(false);
}

let lastStaticMetaStamp = null;
let staticMetaTimer = null;

async function loadStaticMeta(pill, txt) {
  try {
    const mRes = await fetch(`produtos-meta.json?t=${Date.now()}`, { cache: "no-store" });
    if (mRes.ok) {
      const meta = await mRes.json();
      if (pill && txt && meta.atualizado_em) {
        pill.hidden = false;
        pill.classList.remove("is-syncing");
        pill.classList.add("is-synced");
        txt.textContent = `ERP · ${meta.atualizado_em}`;
        const btn = $("#erpRefreshBtn");
        if (btn) btn.hidden = true;

        if (meta.atualizado_em !== lastStaticMetaStamp) {
          const prevStamp = lastStaticMetaStamp;
          lastStaticMetaStamp = meta.atualizado_em;
          try {
            const pRes = await fetch(`produtos.json?v=${encodeURIComponent(meta.atualizado_em)}`, { cache: "no-store" });
            if (pRes.ok) {
              const fresh = await pRes.json();
              if (Array.isArray(fresh) && fresh.length > 0) initCatalog(fresh);
            }
          } catch {
            if (!prevStamp) lastStaticMetaStamp = null;
          }
        }
        return;
      }
    }
  } catch {}
  if (!lastStaticMetaStamp && pill) pill.hidden = true;
}

async function syncFromERP(force = false) {
  if (location.protocol === "file:") return;
  const pill = $("#erpSyncPill");
  const txt = $("#erpSyncText");
  const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";

  if (!isLocal) {
    await loadStaticMeta(pill, txt);
    if (!staticMetaTimer) {
      staticMetaTimer = setInterval(() => {
        if (!document.hidden) loadStaticMeta(pill, txt);
      }, 5 * 60 * 1000);
    }
    return;
  }

  if (pill && txt) {
    pill.hidden = false;
    pill.classList.remove("is-synced");
    pill.classList.add("is-syncing");
    txt.textContent = "SINCRONIZANDO ERP…";
  }

  try {
    const url = force ? "/api/produtos/sync" : "/api/produtos?sync=1";
    const res = await fetch(url, { method: force ? "POST" : "GET", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    if (Array.isArray(payload.produtos) && payload.produtos.length > 0) {
      initCatalog(payload.produtos);
      if (pill && txt) {
        pill.classList.remove("is-syncing");
        pill.classList.add("is-synced");
        const hora = payload.atualizado_em ? payload.atualizado_em.split(" ")[1]?.slice(0, 5) : "agora";
        txt.textContent = payload.origem === "fallback_local"
          ? "CATÁLOGO LOCAL"
          : `ERP AO VIVO · ${hora}`;
      }
      if (force) toast(`Estoque sincronizado (${payload.total.toLocaleString("pt-BR")} SKUs)`);
    }
  } catch {
    await loadStaticMeta(pill, txt);
  }
}

/* Boot */
initThemeToggle();
setupHours();
initSectionPresence();
initScrollTelemetry();
initSheetGestures();
initSpringMagnetic();
wireInteractions();
updateQuoteUI(false);

$("#erpRefreshBtn")?.addEventListener("click", () => syncFromERP(true));

if (Array.isArray(window.CER_PRODUCTS)) {
  initCatalog(window.CER_PRODUCTS);
  syncFromERP(false);
} else {
  fetch("produtos.json")
    .then((r) => r.json())
    .then((data) => {
      initCatalog(data);
      syncFromERP(false);
    })
    .catch(() => {
      const g = $("#grid");
      if (g) g.innerHTML = `<div class="empty-state">Não foi possível carregar os itens do catálogo.</div>`;
    });
}
