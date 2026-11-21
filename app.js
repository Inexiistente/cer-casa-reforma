/* CeR Casa e Reforma — catálogo editorial + calculadora + command palette */
const WHATSAPP = "5531982926011";

const HOURS = [
  { d: "domingo",       o: "08:00", c: "12:00" },
  { d: "segunda-feira", o: "08:00", c: "18:00" },
  { d: "terça-feira",   o: "08:00", c: "18:00" },
  { d: "quarta-feira",  o: "08:00", c: "18:00" },
  { d: "quinta-feira",  o: "08:00", c: "18:00" },
  { d: "sexta-feira",   o: "08:00", c: "18:00" },
  { d: "sábado",        o: "08:00", c: "14:00" },
];

const PAGE = 48;
const $ = (s) => document.querySelector(s);

let PRODUCTS = [];
let state = { q: "", cat: "Todos", avail: "all", sort: "az", view: "grid", shown: PAGE };
let calcMode = "piso";
const quote = new Map(); // code -> { product, qty }

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const waLink = (text) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

function openNow() {
  const now = new Date();
  const h = HOURS[now.getDay()];
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMin = (t) => { const [a, b] = t.split(":").map(Number); return a * 60 + b; };
  return { open: mins >= toMin(h.o) && mins < toMin(h.c), today: h };
}

function setupHours() {
  const { open, today } = openNow();
  const dot = $("#statusDot"), txt = $("#statusText");
  dot.classList.add(open ? "on" : "off");
  txt.textContent = open
    ? `ABERTA AGORA · FECHA ÀS ${today.c}`
    : `FECHADA AGORA · ABRE ÀS ${today.o}`;
  $("#todayHours").textContent = `HOJE ${today.o} – ${today.c}`;

  const todayIdx = new Date().getDay();
  $("#hoursTable").innerHTML = HOURS.map((h, i) =>
    `<tr class="${i === todayIdx ? "today" : ""}" style="--day-i:${i}"><td>${h.d}</td><td>${h.o} – ${h.c}</td></tr>`).join("");
  const note = $("#hoursNote");
  note.textContent = open ? "Aberta agora" : "Fechada no momento";
  note.classList.toggle("closed", !open);
}

/* Decrypted / Scramble text effect (React Bits) */
function scrambleText(el) {
  if (!el || el.dataset.scrambled || reducedMotion()) return;
  el.dataset.scrambled = "1";
  const final = el.textContent;
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ/·";
  let frame = 0;
  const totalFrames = 14;
  function step() {
    frame++;
    const reveal = Math.floor((frame / totalFrames) * final.length);
    let out = "";
    for (let i = 0; i < final.length; i++) {
      if (i < reveal || final[i] === " " || final[i] === "·" || final[i] === "/") out += final[i];
      else out += chars[Math.floor(Math.random() * chars.length)];
    }
    el.textContent = out;
    if (frame < totalFrames) requestAnimationFrame(step);
    else el.textContent = final;
  }
  requestAnimationFrame(step);
}

/* Scroll progress + Sticky header + Scroll-Spy + Back-to-Top Ring + Reveal sections */
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function initScrollEffects() {
  const bar = $("#scrollProgress");
  const header = document.querySelector(".top");
  const backTop = $("#backToTop");
  const backRing = $("#backTopRing");
  const ringLen = 119.38;
  const nav = $("#mainNav");
  const navInd = $("#navIndicator");
  const navLinks = [...document.querySelectorAll("#mainNav a")];
  const spyIds = ["departamentos", "calculadora", "catalogo", "loja", "contato"];
  const spyEls = spyIds.map((id) => document.getElementById(id)).filter(Boolean);

  function updateNavSpy() {
    if (!nav || !navInd || window.innerWidth <= 980) return;
    const scrollPos = window.scrollY + 180;
    let activeId = "";
    for (const sec of spyEls) {
      if (sec.offsetTop <= scrollPos) activeId = sec.id;
    }
    let activeLink = null;
    navLinks.forEach((a) => {
      const match = activeId && a.getAttribute("href") === `#${activeId}`;
      a.classList.toggle("is-active", match);
      if (match) activeLink = a;
    });
    if (activeLink) {
      const nRect = nav.getBoundingClientRect();
      const lRect = activeLink.getBoundingClientRect();
      navInd.style.width = `${lRect.width}px`;
      navInd.style.transform = `translateX(${lRect.left - nRect.left}px)`;
      navInd.style.opacity = "1";
    } else {
      navInd.style.opacity = "0";
    }
  }

  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(1, y / max) : 0;
    bar.style.width = `${pct * 100}%`;
    if (header) header.classList.toggle("is-scrolled", y > 24);
    if (backTop && backRing) {
      backTop.classList.toggle("is-visible", y > 380);
      backRing.style.strokeDashoffset = `${(ringLen * (1 - pct)).toFixed(2)}`;
    }
    updateNavSpy();
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", updateNavSpy);
  if (backTop) backTop.onclick = () => window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  onScroll();

  const sections = document.querySelectorAll(".reveal-section");
  const revealEl = (el) => {
    if (!el || el.classList.contains("is-visible")) return;
    el.classList.add("is-visible");
    el.querySelectorAll("[data-scramble]").forEach(scrambleText);
  };

  if (!("IntersectionObserver" in window)) {
    sections.forEach(revealEl);
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        revealEl(e.target);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0, rootMargin: "0px 0px -40px 0px" });
  sections.forEach((s) => io.observe(s));

  // Garantia extra em telas baixas / mobile: revela qualquer secao que ja entrou na tela
  const checkVisible = () => {
    const vh = window.innerHeight || 800;
    sections.forEach((s) => {
      if (!s.classList.contains("is-visible") && s.getBoundingClientRect().top < vh + 40) {
        revealEl(s);
        io.unobserve(s);
      }
    });
  };
  window.addEventListener("scroll", checkVisible, { passive: true });
  requestAnimationFrame(checkVisible);
}

/* Velocity-reactive Marquee (Jitter physics) */
function initVelocityMarquee() {
  const tape = document.querySelector(".tape");
  const track = document.querySelector(".tape__track");
  if (!tape || !track || reducedMotion()) return;
  let offset = 0;
  let boost = 0;
  let lastY = window.scrollY;
  let paused = false;

  tape.addEventListener("mouseenter", () => { paused = true; });
  tape.addEventListener("mouseleave", () => { paused = false; });
  window.addEventListener("scroll", () => {
    const dy = Math.abs(window.scrollY - lastY);
    lastY = window.scrollY;
    boost = Math.min(6, boost + dy * 0.045);
  }, { passive: true });

  function loop() {
    if (!paused) {
      const half = track.scrollWidth / 2;
      if (half > 0) {
        offset -= 0.65 + boost;
        if (Math.abs(offset) >= half) offset += half;
        track.style.transform = `translate3d(${offset.toFixed(1)}px, 0, 0)`;
      }
    }
    boost *= 0.92;
    if (boost < 0.01) boost = 0;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

/* Magnetic buttons (React Bits / Jitter tactile feel) */
function initMagneticButtons() {
  if (reducedMotion() || window.matchMedia("(pointer: coarse)").matches) return;
  document.querySelectorAll(".magnetic").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * 10;
      const y = ((e.clientY - r.top) / r.height - 0.5) * 8;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    });
    el.addEventListener("mouseleave", () => {
      el.style.transform = "";
    });
  });
}

/* Subtle 3D Tilt + Dynamic Glare on Specimen Card */
function initTiltCards() {
  if (reducedMotion() || window.matchMedia("(pointer: coarse)").matches) return;
  document.querySelectorAll(".tilt-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width;
      const ny = (e.clientY - r.top) / r.height;
      const rotX = (-(ny - 0.5) * 6).toFixed(2);
      const rotY = ((nx - 0.5) * 7).toFixed(2);
      card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-2px)`;
      card.style.setProperty("--gx", `${(nx * 100).toFixed(1)}%`);
      card.style.setProperty("--gy", `${(ny * 100).toFixed(1)}%`);
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

/* Animated Count-Up (Jitter easing) */
function animateCount(el, target, duration = 900) {
  if (!el) return;
  if (reducedMotion()) {
    el.textContent = target.toLocaleString("pt-BR");
    return;
  }
  const start = performance.now();
  const from = 0;
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (target - from) * eased).toLocaleString("pt-BR");
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* Sliding Tab Indicator (Transitions.dev) */
function moveTabIndicator(container, activeBtn) {
  if (!container || !activeBtn) return;
  const ind = container.querySelector(".tab-indicator");
  if (!ind) return;
  const cRect = container.getBoundingClientRect();
  const bRect = activeBtn.getBoundingClientRect();
  const offset = bRect.left - cRect.left - 3;
  ind.style.width = `${bRect.width}px`;
  ind.style.transform = `translateX(${offset}px)`;
}

/* Retrigger CSS animation cleanly */
function retriggerAnim(el, cls) {
  if (!el || reducedMotion()) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/* Floating +N kinetic burst + Fly-to-Comanda Bézier arc */
function spawnQtyBurst(btn, delta) {
  if (!btn || reducedMotion()) return;
  const r = btn.getBoundingClientRect();
  const burst = document.createElement("span");
  burst.className = "qty-burst";
  burst.textContent = `+${delta}`;
  burst.style.left = `${r.left + r.width / 2}px`;
  burst.style.top = `${r.top}px`;
  document.body.appendChild(burst);
  burst.addEventListener("animationend", () => burst.remove(), { once: true });

  // Fly-to-Comanda glowing arc particle
  const targetEl = window.innerWidth > 960 ? $("#comandaPanel") : $("#openDrawer");
  if (!targetEl) return;
  const tr = targetEl.getBoundingClientRect();
  const sx = r.left + r.width / 2;
  const sy = r.top + r.height / 2;
  const ex = tr.left + Math.min(60, tr.width / 2);
  const ey = tr.top + 28;
  const cx = (sx + ex) / 2;
  const cy = Math.min(sy, ey) - 70;

  const dot = document.createElement("span");
  dot.className = "fly-dot";
  document.body.appendChild(dot);
  const start = performance.now();
  const dur = 480;
  function anim(now) {
    const t = Math.min(1, (now - start) / dur);
    const e = 1 - Math.pow(1 - t, 3);
    const inv = 1 - e;
    const x = inv * inv * sx + 2 * inv * e * cx + e * e * ex;
    const y = inv * inv * sy + 2 * inv * e * cy + e * e * ey;
    dot.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(1 - t * 0.45).toFixed(2)})`;
    dot.style.opacity = `${t > 0.8 ? (1 - t) * 5 : 1}`;
    if (t < 1) requestAnimationFrame(anim);
    else dot.remove();
  }
  requestAnimationFrame(anim);
}

/* Vertical sliding indicator for Sector Sidebar */
function moveSectorIndicator() {
  const list = $("#chips");
  if (!list || window.innerWidth <= 960) return;
  const ind = list.querySelector(".sector-indicator");
  const active = list.querySelector('.sector-btn[aria-selected="true"]');
  if (!ind || !active) return;
  ind.style.height = `${Math.max(18, active.offsetHeight - 14)}px`;
  ind.style.transform = `translateY(${active.offsetTop + 7}px)`;
  ind.style.opacity = "1";
}

/* Sinônimos e abreviações reais do ERP para busca inteligente */
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
  return normalizedQuery.split(/\s+/).every((w) => {
    const alts = SEARCH_ALIASES[w];
    return alts ? alts.some((a) => hay.includes(a)) : hay.includes(w);
  });
}

/* Search Highlight helper */
function highlightText(str, rawQuery) {
  if (!rawQuery) return str;
  const rawTerms = rawQuery.trim().split(/\s+/).filter((w) => w.length >= 2);
  if (!rawTerms.length) return str;
  const expanded = new Set();
  for (const t of rawTerms) {
    expanded.add(t);
    const alts = SEARCH_ALIASES[norm(t)];
    if (alts) alts.forEach((a) => expanded.add(a.trim()));
  }
  const esc = [...expanded].filter((w) => w.length >= 2).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!esc.length) return str;
  const re = new RegExp(`(${esc.join("|")})`, "gi");
  return str.replace(re, `<mark class="hl">$1</mark>`);
}

/* Spotlight cursor tracking (React Bits) */
function initSpotlights() {
  document.addEventListener("mousemove", (e) => {
    const el = e.target.closest(".spotlight");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
}

/* Blueprint grid reativo com lerp + crosshairs no hero */
function initBlueprint() {
  const canvas = $("#blueprintCanvas");
  if (!canvas || reducedMotion()) return;
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0;
  let tx = -999, ty = -999, cx = -999, cy = -999;
  let active = false, rafId = 0;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    w = canvas.width = rect.width;
    h = canvas.height = rect.height;
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const step = 48;
    ctx.strokeStyle = "rgba(232, 163, 23, 0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    if (cx > -200) {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 240);
      grad.addColorStop(0, "rgba(232, 163, 23, 0.14)");
      grad.addColorStop(1, "rgba(232, 163, 23, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Highlight nearby blueprint intersections with subtle '+' marks
      const startX = Math.max(0, Math.floor((cx - 180) / step) * step);
      const endX = Math.min(w, cx + 180);
      const startY = Math.max(0, Math.floor((cy - 180) / step) * step);
      const endY = Math.min(h, cy + 180);
      for (let x = startX; x <= endX; x += step) {
        for (let y = startY; y <= endY; y += step) {
          const dist = Math.hypot(x - cx, y - cy);
          if (dist < 180) {
            const alpha = (1 - dist / 180) * 0.45;
            ctx.strokeStyle = `rgba(232, 163, 23, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(x - 3.5, y); ctx.lineTo(x + 3.5, y);
            ctx.moveTo(x, y - 3.5); ctx.lineTo(x, y + 3.5);
            ctx.stroke();
          }
        }
      }
    }
  }

  function tick() {
    cx += (tx - cx) * 0.14;
    cy += (ty - cy) * 0.14;
    draw();
    if (active || Math.hypot(tx - cx, ty - cy) > 0.5) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = 0;
    }
  }

  canvas.parentElement.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    tx = e.clientX - r.left;
    ty = e.clientY - r.top;
    if (cx < -200) { cx = tx; cy = ty; }
    active = true;
    if (!rafId) rafId = requestAnimationFrame(tick);
  });
  canvas.parentElement.addEventListener("mouseleave", () => {
    active = false;
  });
  window.addEventListener("resize", resize);
  resize();
}

/* Calculadora de Obra */
function updateCalc() {
  const area = Math.max(1, Number($("#calcArea").value) || 1);
  const extra = $("#calcExtra").value;
  const res = $("#calcResult");

  if (calcMode === "piso") {
    const areaComPerda = Math.ceil(area * 1.1);
    const sacosArg = Math.ceil(area / 4); // ~4m² por saco 20kg
    const tipoLabel = extra.toUpperCase();
    res.innerHTML = `
      <div class="calc-stat">
        <span class="mono">PISO / REVESTIMENTO (+10%)</span>
        <strong>${areaComPerda} m²</strong>
        <span>Já considerando margem de corte</span>
        <button data-search="piso">Ver pisos no catálogo →</button>
      </div>
      <div class="calc-stat">
        <span class="mono">ARGAMASSA ${tipoLabel} (20KG)</span>
        <strong>${sacosArg} ${sacosArg === 1 ? "saco" : "sacos"}</strong>
        <span>Rendimento médio de 4 m²/saco</span>
        <button data-search="argamassa ${extra}">Ver argamassa ${tipoLabel} →</button>
      </div>`;
  } else {
    const demaos = Number(extra) || 2;
    const litros = Math.ceil((area * demaos) / 10); // ~10m²/L por demão
    let latas18 = Math.floor(litros / 18);
    let galoes = Math.ceil((litros % 18) / 3.6);
    if (galoes > 3) {
      latas18 += 1;
      galoes = 0;
    }
    if (latas18 === 0 && galoes === 0) galoes = 1;
    const fmtLata = (n) => `${n} ${n === 1 ? "lata" : "latas"} 18L`;
    const fmtGalao = (n) => `${n} ${n === 1 ? "galão" : "galões"} 3,6L`;
    const resumo = latas18 > 0
      ? `${fmtLata(latas18)}${galoes > 0 ? ` + ${fmtGalao(galoes)}` : ""}`
      : fmtGalao(galoes);
    res.innerHTML = `
      <div class="calc-stat">
        <span class="mono">VOLUME ESTIMADO</span>
        <strong>${litros} litros</strong>
        <span>Para ${demaos} demãos em ${area} m²</span>
        <button data-search="tinta">Ver tintas no catálogo →</button>
      </div>
      <div class="calc-stat">
        <span class="mono">SUGESTÃO DE EMBALAGEM</span>
        <strong style="font-size:1.05rem">${resumo}</strong>
        <span>Inclui rolo/trincha se precisar</span>
        <button data-search="rolo">Ver rolos e pincéis →</button>
      </div>`;
  }
}

document.querySelectorAll(".calc-tab").forEach((tab) => {
  tab.onclick = () => {
    calcMode = tab.dataset.calc;
    document.querySelectorAll(".calc-tab").forEach((t) => {
      const active = t === tab;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", active);
    });
    moveTabIndicator($("#calcTabs"), tab);
    retriggerAnim($("#calcExtraWrap"), "is-swapping");
    const sel = $("#calcExtra");
    if (calcMode === "piso") {
      sel.innerHTML = `
        <option value="ac1">Área interna (AC1)</option>
        <option value="ac2">Área externa / úmida (AC2)</option>
        <option value="ac3">Porcelanato / sobreposição (AC3)</option>`;
    } else {
      sel.innerHTML = `
        <option value="2">2 demãos (repintura)</option>
        <option value="3">3 demãos (parede nova / cor forte)</option>`;
    }
    updateCalc();
  };
});
$("#calcArea").addEventListener("input", () => {
  const r = $("#calcAreaRange");
  if (r) r.value = Math.min(200, Math.max(1, Number($("#calcArea").value) || 1));
  updateCalc();
});
const calcRangeEl = $("#calcAreaRange");
if (calcRangeEl) {
  calcRangeEl.addEventListener("input", (e) => {
    $("#calcArea").value = e.target.value;
    updateCalc();
  });
}
$("#calcExtra").addEventListener("change", updateCalc);
$("#calcResult").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-search]");
  if (!btn) return;
  applySearch(btn.dataset.search);
  $("#catalogo").scrollIntoView();
});

function applySearch(term) {
  $("#search").value = term;
  $("#searchClear").hidden = term === "";
  state.q = norm(term);
  state.cat = "Todos";
  state.shown = PAGE;
  document.querySelectorAll(".sector-btn").forEach((x) => x.setAttribute("aria-selected", x.dataset.cat === "Todos"));
  moveSectorIndicator();
  render(true);
}

function matches(p) {
  if (state.cat !== "Todos" && p.g !== state.cat) return false;
  if (state.avail === "in" && !p.s) return false;
  if (state.avail === "out" && p.s) return false;
  if (state.q) {
    const hay = norm(`${p.n} ${p.c} ${p.g}`);
    if (!matchesTokens(hay, state.q)) return false;
  }
  return true;
}

function getFiltered() {
  const list = PRODUCTS.filter(matches);
  list.sort((a, b) => {
    if (a.s !== b.s) return a.s ? -1 : 1; // Pronta entrega sempre primeiro
    if (state.sort === "price-asc") return a.p - b.p;
    if (state.sort === "price-desc") return b.p - a.p;
    return a.n.localeCompare(b.n, "pt-BR");
  });
  return list;
}

function render(animateList = false) {
  const list = getFiltered();
  const slice = list.slice(0, state.shown);
  const grid = $("#grid");

  const hasFilter = state.q || state.cat !== "Todos" || state.avail !== "all";
  $("#clearAllBtn").hidden = !hasFilter;

  const rawQuery = $("#search").value.trim();

  if (!list.length) {
    const askMissing = waLink(`Olá! Procurei por "${rawQuery || state.cat}" no site da CeR e não encontrei. Vocês têm no balcão?`);
    grid.innerHTML = `
      <div class="empty">
        <div>
          <strong style="color:var(--ink);display:block;margin-bottom:0.25rem;">Nenhum item encontrado para “${rawQuery || state.cat}”</strong>
          <span>Tente um termo mais curto ou pergunte direto no nosso balcão:</span>
        </div>
        <div class="empty__suggestions">
          <button data-suggest="argamassa">Argamassa</button>
          <button data-suggest="tinta">Tinta</button>
          <button data-suggest="cimento">Cimento</button>
          <button data-suggest="registro">Registro</button>
          <button data-suggest="broca">Broca</button>
        </div>
        <div class="empty__actions">
          <a class="btn btn--gold" href="${askMissing}" target="_blank" rel="noopener">Consultar no WhatsApp →</a>
          <button class="link-reset" id="resetFilters">Limpar filtros</button>
        </div>
      </div>`;
    const b = $("#resetFilters");
    if (b) b.onclick = reset;
    grid.querySelectorAll("button[data-suggest]").forEach((sb) => {
      sb.onclick = () => applySearch(sb.dataset.suggest);
    });
  } else {
    grid.innerHTML = slice.map((p, idx) => {
      const entry = quote.get(p.c);
      const qtyIn = entry ? entry.qty : 0;
      const askUrl = waLink(`Olá! Vi no site o item "${p.n}" (cód. ${p.c}) e gostaria de confirmar o estoque.`);
      const animCls = animateList && idx < 12 ? "animate-in" : "";
      const animStyle = animateList && idx < 12 ? `style="--row-i:${idx}"` : "";
      const nameHtml = rawQuery ? highlightText(p.n, rawQuery) : p.n;
      const codeHtml = rawQuery ? highlightText(p.c || "—", rawQuery) : (p.c || "—");
      return `
      <article class="item-row spotlight ${animCls} ${p.s ? "" : "is-out"} ${qtyIn > 0 ? "in-comanda" : ""}" data-code="${p.c}" ${animStyle}>
        <div class="item-row__info">
          <div class="item-row__meta">
            <span class="item-row__code">#${codeHtml} · ${p.g}</span>
            <span class="avail-tag ${p.s ? "avail-tag--in" : "avail-tag--out"}">${p.s ? "Pronta entrega" : "Sob consulta"}</span>
            ${qtyIn > 0 ? `<span class="item-row__badge">${qtyIn}x na comanda</span>` : ""}
          </div>
          <h3 class="item-row__name">${nameHtml}</h3>
          <span class="price">${brl.format(p.p)}<small>/ ${p.u}</small></span>
        </div>
        <div class="item-row__actions">
          ${!p.s ? `<a class="ask-wa" href="${askUrl}" target="_blank" rel="noopener" title="Consultar estoque no WhatsApp" aria-label="Consultar no WhatsApp">💬</a>` : ""}
          <button class="qbtn qbtn--primary" data-code="${p.c}" data-delta="1" title="Adicionar 1 unidade">+1</button>
          <button class="qbtn" data-code="${p.c}" data-delta="5" title="Adicionar 5 unidades">+5</button>
          <button class="qbtn" data-code="${p.c}" data-delta="10" title="Adicionar 10 unidades">+10</button>
        </div>
      </article>`;
    }).join("");
  }

  $("#resultCount").textContent = `${list.length.toLocaleString("pt-BR")} ${list.length === 1 ? "ITEM ENCONTRADO" : "ITENS ENCONTRADOS"}`;
  const shownCount = Math.min(state.shown, list.length);
  const remaining = Math.max(0, list.length - shownCount);
  const more = $("#loadMore");
  more.hidden = remaining === 0;
  if (remaining > 0) {
    more.textContent = `Carregar mais · mostrando ${shownCount.toLocaleString("pt-BR")} de ${list.length.toLocaleString("pt-BR")}`;
  }
}

function buildChips() {
  const counts = new Map();
  for (const p of PRODUCTS) counts.set(p.g, (counts.get(p.g) || 0) + 1);
  const sortedCats = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a));
  $("#deptCountFact").textContent = sortedCats.length;

  const cats = ["Todos", ...sortedCats];
  const chips = $("#chips");
  chips.innerHTML = `<span class="sector-indicator" aria-hidden="true"></span>` + cats.map((c) => {
    const cnt = c === "Todos" ? PRODUCTS.length : counts.get(c);
    return `<button class="sector-btn" role="tab" aria-selected="${c === state.cat}" data-cat="${c}">
      <span class="sector-btn__name">${c}</span>
      <span class="sector-btn__count">${cnt.toLocaleString("pt-BR")}</span>
    </button>`;
  }).join("");

  chips.onclick = (e) => {
    const b = e.target.closest(".sector-btn");
    if (!b) return;
    state.cat = b.dataset.cat;
    state.shown = PAGE;
    chips.querySelectorAll(".sector-btn").forEach((x) => x.setAttribute("aria-selected", x === b));
    moveSectorIndicator();
    render(true);
  };
  requestAnimationFrame(moveSectorIndicator);

  // Footer top 5 sectors
  const footSec = $("#footSectors");
  if (footSec) {
    footSec.innerHTML = sortedCats.slice(0, 5).map((c) => `<button data-cat="${c}">${c}</button>`).join("");
    footSec.onclick = (e) => {
      const b = e.target.closest("button[data-cat]");
      if (!b) return;
      state.cat = b.dataset.cat;
      state.shown = PAGE;
      document.querySelectorAll(".sector-btn").forEach((x) => x.setAttribute("aria-selected", x.dataset.cat === state.cat));
      moveSectorIndicator();
      $("#catalogo").scrollIntoView();
      render(true);
    };
  }

  const top = sortedCats.slice(0, 12);
  $("#deptTrack").innerHTML = top.map((c, idx) => `
    <button class="dept-cell spotlight" data-cat="${c}" style="--stagger-i:${idx}">
      <span class="dept-cell__idx">${String(idx + 1).padStart(2, "0")}</span>
      <span class="dept-cell__name">${c}</span>
      <span class="dept-cell__count">${counts.get(c).toLocaleString("pt-BR")} itens</span>
    </button>`).join("");

  $("#deptTrack").onclick = (e) => {
    const b = e.target.closest(".dept-cell");
    if (!b) return;
    state.cat = b.dataset.cat;
    state.shown = PAGE;
    document.querySelectorAll(".sector-btn").forEach((x) => x.setAttribute("aria-selected", x.dataset.cat === state.cat));
    moveSectorIndicator();
    $("#catalogo").scrollIntoView();
    render(true);
  };
}

function reset() {
  state = { ...state, q: "", cat: "Todos", avail: "all", shown: PAGE };
  $("#search").value = "";
  $("#searchClear").hidden = true;
  document.querySelectorAll(".avail-btn").forEach((x) => {
    const active = x.dataset.avail === "all";
    x.classList.toggle("active", active);
    x.setAttribute("aria-pressed", active);
    if (active) moveTabIndicator($("#availTabs"), x);
  });
  document.querySelectorAll(".sector-btn").forEach((x) => x.setAttribute("aria-selected", x.dataset.cat === "Todos"));
  moveSectorIndicator();
  render(true);
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2000);
}

function sendQuoteWhatsApp(btn) {
  if (!quote.size) return;
  let total = 0;
  const lines = [...quote.values()].map(({ product, qty }) => {
    total += product.p * qty;
    return `• ${qty}x ${product.n} (cód. ${product.c}) — ${brl.format(product.p)}/${product.u}`;
  });
  const text = `Olá! Vim pelo site da CeR Casa e Reforma e quero orçamento de:\n\n${lines.join("\n")}\n\nEstimativa: ${brl.format(total)}\nPode confirmar disponibilidade?`;
  const url = waLink(text);
  if (btn && !reducedMotion()) {
    const prev = btn.textContent;
    btn.classList.add("is-sending");
    btn.textContent = "✓ Pedido pronto! Abrindo WhatsApp…";
    setTimeout(() => {
      window.open(url, "_blank", "noopener");
      setTimeout(() => {
        btn.classList.remove("is-sending");
        btn.textContent = prev;
      }, 650);
    }, 340);
  } else {
    window.open(url, "_blank", "noopener");
  }
}

function updateQuoteUI(pulse = false) {
  let totalItems = 0;
  let totalValue = 0;
  for (const { product, qty } of quote.values()) {
    totalItems += qty;
    totalValue += product.p * qty;
  }

  const badge = $("#headerBadge");
  badge.hidden = totalItems === 0;
  badge.textContent = totalItems;
  if (pulse && totalItems > 0) retriggerAnim(badge, "is-popping");

  const dock = $("#quoteDock");
  dock.classList.toggle("is-visible", totalItems > 0);
  dock.setAttribute("aria-hidden", totalItems === 0 ? "true" : "false");
  $("#quoteCount").textContent = `${totalItems} ${totalItems === 1 ? "item" : "itens"} na lista`;
  $("#quoteTotal").textContent = brl.format(totalValue);
  $("#drawerTotal").textContent = brl.format(totalValue);

  const body = $("#drawerBody");
  if (quote.size === 0) {
    body.innerHTML = `<p class="mono" style="padding:2rem 0;text-align:center;">Sua lista está vazia. Adicione itens do catálogo.</p>`;
  } else {
    body.innerHTML = [...quote.values()].map(({ product, qty }) => `
      <div class="drawer-item" data-code="${product.c}">
        <div>
          <div class="drawer-item__name">${product.n}</div>
          <div class="drawer-item__meta">CÓD. ${product.c} · ${brl.format(product.p)} / ${product.u}</div>
        </div>
        <div class="qty-ctrl">
          <button data-act="dec" aria-label="Diminuir">−</button>
          <span>${qty}</span>
          <button data-act="inc" aria-label="Aumentar">+</button>
        </div>
      </div>`).join("");
  }

  // Comanda fixa (Opção 08)
  const comandaPanel = $("#comandaPanel");
  const comandaList = $("#comandaList");
  const comandaTotal = $("#comandaTotal");
  const comandaClear = $("#comandaClear");
  const comandaSend = $("#comandaSend");
  if (comandaList) {
    comandaPanel.classList.toggle("has-items", quote.size > 0);
    comandaTotal.textContent = brl.format(totalValue);
    comandaClear.hidden = quote.size === 0;
    comandaSend.disabled = quote.size === 0;
    if (pulse && totalItems > 0) {
      retriggerAnim(comandaTotal, "is-popping");
      retriggerAnim(comandaPanel, "is-pulsing");
    }

    if (quote.size === 0) {
      comandaList.innerHTML = `
        <div class="comanda__empty">
          <strong>Comanda vazia</strong>
          Clique em <b>+1</b>, <b>+5</b> ou <b>+10</b> nos itens ao lado para montar seu pedido de retirada.
        </div>`;
    } else {
      comandaList.innerHTML = [...quote.values()].map(({ product, qty }) => `
        <div class="comanda-item" data-code="${product.c}">
          <span class="comanda-item__qty">${qty}x</span>
          <div class="comanda-item__body">
            <div class="comanda-item__name">${product.n}</div>
            <div class="comanda-item__ctrls">
              <button data-act="dec" aria-label="Diminuir">−</button>
              <button data-act="inc" aria-label="Aumentar">+</button>
              <button data-act="rem" aria-label="Remover">×</button>
            </div>
          </div>
          <span class="comanda-item__sub">${brl.format(product.p * qty)}</span>
        </div>`).join("");
    }
  }
}

function openDrawer() {
  $("#drawerBackdrop").classList.add("is-open");
  $("#drawerBackdrop").setAttribute("aria-hidden", "false");
  $("#drawer").classList.add("open");
  $("#drawer").setAttribute("aria-hidden", "false");
}
function closeDrawer() {
  $("#drawerBackdrop").classList.remove("is-open");
  $("#drawerBackdrop").setAttribute("aria-hidden", "true");
  $("#drawer").classList.remove("open");
  $("#drawer").setAttribute("aria-hidden", "true");
}

/* Command Palette (Ctrl+K / ⌘K) */
function openCmd() {
  const b = $("#cmdBackdrop");
  b.classList.add("is-open");
  b.setAttribute("aria-hidden", "false");
  $("#cmdInput").value = "";
  renderCmd("");
  setTimeout(() => $("#cmdInput").focus(), 40);
}
function closeCmd() {
  const b = $("#cmdBackdrop");
  b.classList.remove("is-open");
  b.setAttribute("aria-hidden", "true");
}
let cmdActiveIdx = 0;

function renderCmd(q) {
  const raw = q.trim();
  const nq = norm(raw);
  const list = nq
    ? PRODUCTS.filter((p) => {
        const hay = norm(`${p.n} ${p.c} ${p.g}`);
        return matchesTokens(hay, nq);
      }).slice(0, 12)
    : PRODUCTS.slice(0, 8);

  cmdActiveIdx = 0;
  const box = $("#cmdResults");
  if (!list.length) {
    box.innerHTML = `<p class="mono" style="padding:1.5rem;text-align:center;">Nenhum item encontrado.</p>`;
    return;
  }
  box.innerHTML = list.map((p, i) => `
    <div class="cmd-row ${i === 0 ? "is-active" : ""}" data-code="${p.c}">
      <div>
        <div class="cmd-row__name">${raw ? highlightText(p.n, raw) : p.n}</div>
        <div class="cmd-row__meta">${p.g} · CÓD. ${raw ? highlightText(p.c, raw) : p.c} · ${p.s ? "EM ESTOQUE" : "SOB CONSULTA"}</div>
      </div>
      <span class="cmd-row__price">${brl.format(p.p)}</span>
    </div>`).join("");
}

function selectCmdRow(row) {
  if (!row) return;
  const p = PRODUCTS.find((x) => x.c === row.dataset.code);
  if (!p) return;
  const cur = quote.get(p.c);
  quote.set(p.c, { product: p, qty: cur ? cur.qty + 1 : 1 });
  updateQuoteUI(true);
  render(false);
  toast(`+1 ${p.n.slice(0, 28)}…`);
  closeCmd();
}

$("#openCmd").onclick = openCmd;
$("#cmdBackdrop").addEventListener("click", (e) => { if (e.target === $("#cmdBackdrop")) closeCmd(); });
$("#cmdInput").addEventListener("input", (e) => renderCmd(e.target.value));
$("#cmdInput").addEventListener("keydown", (e) => {
  const rows = [...document.querySelectorAll("#cmdResults .cmd-row")];
  if (!rows.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    rows[cmdActiveIdx]?.classList.remove("is-active");
    cmdActiveIdx = (cmdActiveIdx + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
    rows[cmdActiveIdx]?.classList.add("is-active");
    rows[cmdActiveIdx]?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") {
    e.preventDefault();
    selectCmdRow(rows[cmdActiveIdx]);
  }
});
$("#cmdResults").addEventListener("click", (e) => {
  selectCmdRow(e.target.closest(".cmd-row"));
});

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    $("#cmdBackdrop").classList.contains("is-open") ? closeCmd() : openCmd();
  } else if (e.key === "Escape") {
    closeCmd();
    closeDrawer();
  }
});

$("#grid").addEventListener("click", (e) => {
  const b = e.target.closest(".qbtn");
  if (!b || !b.dataset.code) return;
  const code = b.dataset.code;
  const delta = Number(b.dataset.delta) || 1;
  const p = PRODUCTS.find((x) => x.c === code);
  if (!p) return;
  const cur = quote.get(code);
  quote.set(code, { product: p, qty: (cur ? cur.qty : 0) + delta });
  spawnQtyBurst(b, delta);
  toast(`+${delta} ${p.n.slice(0, 28)}${p.n.length > 28 ? "…" : ""}`);
  updateQuoteUI(true);
  render(false);
  // Momentary check morph on the newly rendered matching button
  const refreshedBtn = document.querySelector(`#grid .qbtn[data-code="${CSS.escape(code)}"][data-delta="${delta}"]`);
  if (refreshedBtn && !reducedMotion()) {
    const orig = refreshedBtn.textContent;
    refreshedBtn.classList.add("is-checked");
    refreshedBtn.textContent = "✓";
    setTimeout(() => {
      refreshedBtn.classList.remove("is-checked");
      refreshedBtn.textContent = orig;
    }, 450);
  }
});

/* Quick Kits 1-Clique */
const KIT_RECIPES = {
  piso: [
    { code: "0145", q: "argamassa ac 2 x 20 kg", qty: 2 },
    { code: "3470", q: "espacador nivelador 2,0m cortag slim", qty: 1 },
    { code: "3464", q: "cunha c/100 unidades cortag slim", qty: 1 },
    { code: "1434", q: "rejunte branco 1 kg urso polar", qty: 1 },
    { code: "0839", q: "espatula para rejunte", qty: 1 },
  ],
  pintura: [
    { code: "2395", q: "tinta acrilica bemalar bca 3,6", qty: 1 },
    { code: "1768", q: "trincha 2", qty: 1 },
    { code: "0971", q: "fita crepe 24mmx50m", qty: 1 },
    { code: "0156", q: "bandeja pintura pvc", qty: 1 },
    { code: "2222", q: "rolo la antirespingo 23cm", qty: 1 },
    { code: "2077", q: "lixa d. agua ''120'' norton", qty: 2 },
  ],
  hidraulica: [
    { code: "0061", q: "veda rosca 18mmx10m plastubos", qty: 1 },
    { code: "0005", q: "adesivo plastico plastubos bisn. 75g", qty: 1 },
    { code: "1532", q: "lamina serra starret amarela", qty: 1 },
    { code: "2075", q: "lixa d. agua ''80'' norton", qty: 1 },
  ],
};
const quickKitsEl = $("#quickKits");
if (quickKitsEl) {
  quickKitsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".kit-pill");
    if (!btn) return;
    const recipe = KIT_RECIPES[btn.dataset.kit];
    if (!recipe) return;
    let added = 0;
    for (const step of recipe) {
      let match = null;
      if (step.code) {
        const cleanCode = step.code.replace(/^0+/, "");
        match = PRODUCTS.find((p) => p.c === step.code)
          || PRODUCTS.find((p) => p.c.replace(/^0+/, "") === cleanCode);
      }
      if (!match && step.q) {
        const nq = norm(step.q);
        match = PRODUCTS.find((p) => p.s && norm(p.n).includes(nq)) || PRODUCTS.find((p) => norm(p.n).includes(nq));
      }
      if (match) {
        const cur = quote.get(match.c);
        quote.set(match.c, { product: match, qty: (cur ? cur.qty : 0) + step.qty });
        added++;
      }
    }
    if (added > 0) {
      spawnQtyBurst(btn, added);
      updateQuoteUI(true);
      render(false);
      toast(`Kit adicionado (${added} itens na comanda)`);
    }
  });
}

function handleQuoteAct(code, act, itemEl) {
  const entry = quote.get(code);
  if (!entry) return;
  const willRemove = act === "rem" || (act === "dec" && entry.qty <= 1);
  if (willRemove && itemEl && itemEl.classList.contains("comanda-item") && !reducedMotion()) {
    itemEl.classList.add("is-removing");
    setTimeout(() => {
      quote.delete(code);
      updateQuoteUI(false);
      render(false);
    }, 210);
    return;
  }
  if (act === "inc") entry.qty += 1;
  else if (act === "rem") quote.delete(code);
  else {
    entry.qty -= 1;
    if (entry.qty <= 0) quote.delete(code);
  }
  updateQuoteUI(true);
  render(false);
}

$("#drawerBody").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const itemEl = btn.closest(".drawer-item");
  if (itemEl) handleQuoteAct(itemEl.dataset.code, btn.dataset.act, itemEl);
});

$("#comandaList").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const itemEl = btn.closest(".comanda-item");
  if (itemEl) handleQuoteAct(itemEl.dataset.code, btn.dataset.act, itemEl);
});

$("#openDrawer").onclick = openDrawer;
$("#openDrawerDock").onclick = openDrawer;
$("#closeDrawer").onclick = closeDrawer;
$("#drawerBackdrop").onclick = closeDrawer;

$("#quoteSend").onclick = (e) => sendQuoteWhatsApp(e.currentTarget);
$("#comandaSend").onclick = (e) => sendQuoteWhatsApp(e.currentTarget);

function clearAllQuote() {
  quote.clear();
  updateQuoteUI();
  render();
  closeDrawer();
  toast("Comanda limpa");
}
$("#quoteClear").onclick = clearAllQuote;
$("#comandaClear").onclick = clearAllQuote;

$("#quickTags").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-q]");
  if (!b) return;
  applySearch(b.dataset.q);
});

let searchTimer;
$("#search").addEventListener("input", (e) => {
  const v = e.target.value.trim();
  $("#searchClear").hidden = v === "";
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.q = norm(v); state.shown = PAGE; render(true); }, 120);
});
$("#searchClear").onclick = () => { $("#search").value = ""; $("#searchClear").hidden = true; state.q = ""; state.shown = PAGE; render(true); $("#search").focus(); };
$("#availTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".avail-btn");
  if (!btn) return;
  state.avail = btn.dataset.avail;
  state.shown = PAGE;
  document.querySelectorAll(".avail-btn").forEach((x) => {
    const active = x === btn;
    x.classList.toggle("active", active);
    x.setAttribute("aria-pressed", active);
  });
  moveTabIndicator($("#availTabs"), btn);
  render(true);
});
$("#sortSelect").onchange = (e) => { state.sort = e.target.value; state.shown = PAGE; render(true); };
$("#clearAllBtn").onclick = reset;
$("#loadMore").onclick = () => { state.shown += PAGE; render(false); };

$("#burger").onclick = () => {
  const nav = $("#mainNav");
  const open = nav.classList.toggle("open");
  $("#burger").classList.toggle("is-open", open);
  $("#burger").setAttribute("aria-expanded", open);
};
document.querySelectorAll("#mainNav a").forEach((a) => {
  a.addEventListener("click", () => {
    const nav = $("#mainNav");
    if (nav.classList.contains("open")) {
      nav.classList.remove("open");
      $("#burger").classList.remove("is-open");
      $("#burger").setAttribute("aria-expanded", "false");
    }
  });
});

const copyAddrBtn = $("#copyAddressBtn");
if (copyAddrBtn) {
  copyAddrBtn.onclick = () => {
    const addr = "Rua Bezerra de Menezes, 72 - Nazaré, Belo Horizonte - MG, CEP 31990-420";
    if (navigator.clipboard) navigator.clipboard.writeText(addr).catch(() => {});
    const prev = copyAddrBtn.textContent;
    copyAddrBtn.textContent = "✓ Endereço copiado!";
    toast("Endereço copiado para a área de transferência");
    setTimeout(() => { copyAddrBtn.textContent = prev; }, 1600);
  };
}

$("#waLink").href = waLink("Olá! Vim pelo site da CeR Casa e Reforma.");
$("#year").textContent = new Date().getFullYear();

setupHours();
initScrollEffects();
initVelocityMarquee();
initSpotlights();
initMagneticButtons();
initTiltCards();
initBlueprint();
updateCalc();
updateQuoteUI();

// Position sliding tab indicators once layout is painted
function syncIndicators() {
  moveTabIndicator($("#calcTabs"), $("#calcTabs .calc-tab.active"));
  moveTabIndicator($("#availTabs"), $("#availTabs .avail-btn.active"));
  moveSectorIndicator();
}
requestAnimationFrame(syncIndicators);
window.addEventListener("resize", syncIndicators);

function initCatalog(data, animateCounters = true) {
  PRODUCTS = data;
  const formatted = data.length.toLocaleString("pt-BR");
  if (animateCounters) animateCount($("#countFact"), data.length, 950);
  else $("#countFact").textContent = formatted;
  $("#countInline").textContent = formatted;

  // Atualiza precos/estoque na comanda aberta caso tenham mudado no ERP
  if (quote.size > 0) {
    const byCode = new Map(PRODUCTS.map((p) => [p.c, p]));
    for (const [code, entry] of quote.entries()) {
      const fresh = byCode.get(code);
      if (fresh) entry.product = fresh;
    }
    updateQuoteUI(false);
  }

  buildChips();
  if (animateCounters) {
    animateCount($("#deptCountFact"), Number($("#deptCountFact").textContent) || 16, 750);
  }
  render(animateCounters);
}

/* Sincronizacao automatica em tempo real com o ERP CentauroCloud */
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
        txt.textContent = `TABELA ERP · ${meta.atualizado_em}`;
        const btn = $("#erpRefreshBtn");
        if (btn) btn.hidden = true;

        if (meta.atualizado_em !== lastStaticMetaStamp) {
          const prevStamp = lastStaticMetaStamp;
          lastStaticMetaStamp = meta.atualizado_em;
          try {
            const pRes = await fetch(`produtos.json?v=${encodeURIComponent(meta.atualizado_em)}`, { cache: "no-store" });
            if (pRes.ok) {
              const fresh = await pRes.json();
              if (Array.isArray(fresh) && fresh.length > 0) {
                initCatalog(fresh, false);
              }
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
      initCatalog(payload.produtos, false);
      if (pill && txt) {
        pill.classList.remove("is-syncing");
        pill.classList.add("is-synced");
        const hora = payload.atualizado_em ? payload.atualizado_em.split(" ")[1]?.slice(0, 5) : "agora";
        txt.textContent = payload.origem === "fallback_local"
          ? "CATÁLOGO LOCAL (ERP OFFLINE)"
          : `ERP ATUALIZADO · ${hora}`;
      }
      if (force) toast(`Catálogo atualizado do ERP (${payload.total.toLocaleString("pt-BR")} itens)`);
    }
  } catch {
    await loadStaticMeta(pill, txt);
  }
}

const erpRefreshBtn = $("#erpRefreshBtn");
if (erpRefreshBtn) erpRefreshBtn.onclick = () => syncFromERP(true);

if (Array.isArray(window.CER_PRODUCTS)) {
  initCatalog(window.CER_PRODUCTS, true);
  syncFromERP(false);
} else {
  fetch("produtos.json")
    .then((r) => r.json())
    .then((data) => {
      initCatalog(data, true);
      syncFromERP(false);
    })
    .catch(() => {
      $("#grid").innerHTML = `<div class="empty">Não foi possível carregar o catálogo.</div>`;
    });
}
