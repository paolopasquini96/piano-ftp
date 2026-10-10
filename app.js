const D = await fetch("piano.json").then(r => r.json());
const KIND = { SweetSpot: ["Sweet spot", "--c-ss"], Soglia: ["Soglia", "--c-th"], VO2max: ["VO2max", "--c-vo"], Fondo: ["Fondo Z2", "--c-fo"],
  Facoltativo: ["Facoltativa", "--c-fa"], Scarico: ["Scarico", "--c-sc"], Test: ["Test FTP", "--c-te"] };
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const KG = 72, FTP0 = 200, LS = "piano-ftp-2026-27";
const $ = id => document.getElementById(id);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const fmtD = iso => { const [, m, d] = iso.split("-").map(Number); return d + " " + MESI[m - 1]; };
const fmtH = min => (min / 60).toFixed(1).replace(".", ",");

// sessions: {key, wk, block, date, day, title, kind, min, IF, tss}
const S = D.rows.map(r => {
  const test = r[6] === "Test";
  return { key: test ? "S" + String(r[0]).padStart(2, "0") + ".T" : r[10].split("/")[1].slice(0, 5), wk: r[0], block: r[1], typ: r[2], date: r[3], day: r[4],
    title: test ? "Ramp Test di Zwift" : r[5], kind: r[6], min: test ? 45 : r[7], IF: r[8], tss: r[9], test };
});
const byWk = {}; S.forEach(s => (byWk[s.wk] = byWk[s.wk] || []).push(s));
const totMin = S.reduce((a, s) => a + s.min, 0);

let state = { done: {}, ftp: {} };
let block = 1, openKey = null;
const today = new Date().toISOString().slice(0, 10);
let curWk = 1;
D.weeks.forEach(w => { if (today >= w.mon) curWk = w.wk; });
block = Math.ceil(curWk / 4);

// ---------- build once
const plot = $("plot"), tabs = $("tabs");
for (let b = 1; b <= 8; b++) {
  const g = el("div", "grp");
  D.weeks.filter(w => w.block === b).forEach(w => {
    const btn = el("button", "wk" + (w.wk === curWk ? " now" : "")); btn.type = "button"; btn.dataset.wk = w.wk;
    const planned = byWk[w.wk].reduce((a, s) => a + s.min, 0);
    btn.style.height = (planned / 60 / 8 * 100) + "%";
    btn.appendChild(el("i"));
    btn.addEventListener("click", () => { block = b; showBlock(); });
    g.appendChild(btn);
  });
  plot.appendChild(g);
  const t = el("button", "tab", "B" + b); t.type = "button"; t.setAttribute("role", "tab"); t.dataset.b = b;
  t.title = D.blocks[b - 1][0];
  t.addEventListener("click", () => { block = b; showBlock(); });
  tabs.appendChild(t);
}

function showBlock() {
  [...tabs.children].forEach(t => t.setAttribute("aria-selected", String(+t.dataset.b === block)));
  $("bTitle").textContent = "Blocco " + D.blocks[block - 1][0];
  $("bGoal").textContent = D.blocks[block - 1][1] + ".";
  const box = $("weeks"); box.textContent = "";
  D.weeks.filter(w => w.block === block).forEach(w => {
    const sec = el("section", "week" + (w.wk === curWk ? " cur" : ""));
    const h = el("header");
    h.appendChild(el("b", null, "Settimana " + w.wk + " · " + w.typ));
    const hs = el("span"); hs.id = "wsum" + w.wk; h.appendChild(hs);
    sec.appendChild(h);
    byWk[w.wk].forEach(s => {
      const row = el("div", "row"); row.dataset.key = s.key;
      const cb = el("input"); cb.type = "checkbox"; cb.id = "cb-" + s.key; cb.setAttribute("aria-label", "Fatta: " + s.title);
      cb.addEventListener("change", () => setDone(s.key, cb.checked));
      row.appendChild(cb);
      const when = el("div", "when"); when.appendChild(el("b", null, s.day)); when.append(" " + fmtD(s.date)); row.appendChild(when);
      const what = el(s.test ? "div" : "button", "what"); what.appendChild(el("div", "t", s.title));
      if (!s.test) { what.type = "button"; what.setAttribute("aria-expanded", String(openKey === s.key));
        what.addEventListener("click", () => { openKey = openKey === s.key ? null : s.key; showBlock(); }); }
      const m = el("div", "m"); const k = el("span", "kind", KIND[s.kind][0]); k.style.setProperty("--k", "var(" + KIND[s.kind][1] + ")"); m.appendChild(k);
      m.appendChild(el("span", null, s.test ? "Workouts > FTP Tests" : "File " + s.key));
      what.appendChild(m); row.appendChild(what);
      const load = el("div", "load");
      if (s.test) {
        const inp = el("input", "ftp"); inp.type = "number"; inp.inputMode = "numeric"; inp.min = 100; inp.max = 500; inp.placeholder = "FTP"; inp.id = "ftp-" + s.wk;
        inp.setAttribute("aria-label", "FTP dopo il test della settimana " + s.wk);
        inp.addEventListener("change", () => setFtp(s.wk, inp.value));
        inp.addEventListener("click", e => e.stopPropagation());
        load.appendChild(inp); load.append("watt");
      } else {
        load.appendChild(el("b", null, s.min + " min")); load.append("IF " + String(s.IF).replace(".", ",") + " · TSS " + s.tss);
      }
      row.appendChild(load); sec.appendChild(row);
      if (openKey === s.key) { const dt = el("div", "detail"); dt.id = "detail"; sec.appendChild(dt); }
    });
    box.appendChild(sec);
  });
  apply();
}

// ---------- workout detail (profile by power zone + steps)
const ZN = [[0.60, "Z1", "Recupero"], [0.76, "Z2", "Fondo"], [0.90, "Z3", "Tempo"], [1.05, "Z4", "Soglia"], [1.19, "Z5", "VO2max"], [99, "Z6", "Anaerobico"]];
const zi = p => ZN.findIndex(z => p < z[0] - 1e-9);
const pc = p => Math.round(p * 100) + "%";
const du = s => s < 60 ? s + " s" : s % 60 === 0 ? (s / 60) + " min" : Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + " min";
const SVGN = "http://www.w3.org/2000/svg";
function curFtp() { let ftp = FTP0, last = 0; Object.keys(state.ftp || {}).forEach(w => { const v = +state.ftp[w]; if (v > 0 && +w >= last) { last = +w; ftp = v; } }); return [ftp, last]; }
function sw(i) { const e = el("span", "sw"); e.style.setProperty("--k", "var(--z" + (i + 1) + ")"); return e; }
function fillDetail() {
  const box = $("detail"); if (!box || !openKey || !D.det[openKey]) return;
  const det = D.det[openKey], ftp = curFtp()[0], W = p => Math.round(p * ftp);
  box.textContent = "";
  box.appendChild(el("p", null, det.d));
  // flat pieces [dur, lo, hi]
  const flat = [];
  det.s.forEach(g => { if (g[0] === "s") flat.push([g[1], g[2], g[2]]); else if (g[0] === "r") flat.push([g[1], g[2], g[3]]);
    else for (let k = 0; k < g[1]; k++) { flat.push([g[2], g[4], g[4]]); flat.push([g[3], g[5], g[5]]); } });
  const tot = flat.reduce((a, f) => a + f[0], 0), max = Math.max(1.3, ...flat.map(f => Math.max(f[1], f[2]))) * 1.04;
  const zt = [0, 0, 0, 0, 0, 0];
  const svg = document.createElementNS(SVGN, "svg"); svg.setAttribute("viewBox", "0 0 1000 200"); svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Profilo di potenza della seduta, dettagli nell'elenco sotto");
  let t = 0;
  const poly = (t0, d, a, b) => {
    const x0 = t0 / tot * 1000, x1 = (t0 + d) / tot * 1000, y = p => 200 - p / max * 200, z = zi((a + b) / 2);
    zt[z] += d;
    const pg = document.createElementNS(SVGN, "polygon");
    pg.setAttribute("points", [x0, 200, x0, y(a), x1, y(b), x1, 200].map(v => v.toFixed(1)).join(" "));
    pg.style.fill = "var(--z" + (z + 1) + ")";
    const ti = document.createElementNS(SVGN, "title");
    ti.textContent = du(d) + " · " + (a === b ? pc(a) + " · " + W(a) + " W" : pc(a) + " → " + pc(b)) + " · " + ZN[z][1] + " " + ZN[z][2];
    pg.appendChild(ti); svg.appendChild(pg);
  };
  flat.forEach(f => {
    if (f[1] === f[2]) poly(t, f[0], f[1], f[1]);
    else { const n = Math.max(1, Math.round(f[0] / 60)); for (let k = 0; k < n; k++) poly(t + f[0] * k / n, f[0] / n, f[1] + (f[2] - f[1]) * k / n, f[1] + (f[2] - f[1]) * (k + 1) / n); }
    t += f[0];
  });
  const prof = el("div", "prof"); prof.appendChild(svg);
  const l = el("div", "ftpl"); l.style.bottom = (1 / max * 100) + "%"; prof.appendChild(l);
  const lt = el("div", "ftpt", "FTP " + ftp + " W"); lt.style.top = (100 - 1 / max * 100) + "%"; prof.appendChild(lt);
  const chart = el("div"); chart.appendChild(prof);
  const tax = el("div", "tax"); tax.appendChild(el("span", null, "0")); tax.appendChild(el("span", null, du(Math.round(tot / 120) * 60))); tax.appendChild(el("span", null, du(tot)));
  chart.appendChild(tax); box.appendChild(chart);
  const zl = el("div", "zones");
  ZN.forEach((z, i) => { if (zt[i] < 30) return; const e = el("span", null, z[1] + " " + z[2] + " · " + Math.round(zt[i] / 60) + " min"); e.style.setProperty("--k", "var(--z" + (i + 1) + ")"); zl.appendChild(e); });
  box.appendChild(zl);
  // steps, with repeated patterns collapsed
  const st = [];
  det.s.forEach(g => { if (g[0] === "i") st.push({ n: g[1], parts: [[g[2], g[4]], [g[3], g[5]]] }); else if (g[0] === "r") st.push({ ramp: g }); else st.push({ n: 1, parts: [[g[1], g[2]]], cad: g[3] }); });
  const same = (a, b) => a && b && !a.ramp && !b.ramp && a.n === 1 && b.n === 1 && a.parts[0][0] === b.parts[0][0] && Math.abs(a.parts[0][1] - b.parts[0][1]) < 1e-9;
  const out = [];
  for (let i = 0; i < st.length;) {
    let done = false;
    for (const per of [2, 3]) {
      let n = 1;
      while (Array.from({ length: per }, (_, k) => same(st[i + k], st[i + n * per + k])).every(Boolean)) n++;
      if (n >= 2 && Array.from({ length: per }, (_, k) => st[i + k] && !st[i + k].ramp && st[i + k].n === 1).every(Boolean)) {
        out.push({ n, parts: st.slice(i, i + per).map(x => x.parts[0]) }); i += n * per; done = true; break;
      }
    }
    if (!done) { out.push(st[i]); i++; }
  }
  const ul = el("ol", "steps");
  out.forEach((o, idx) => {
    const li = el("li"), z = el("span", "z"), d = el("span", "d"), w = el("span", "w");
    if (o.ramp) {
      const g = o.ramp; z.appendChild(sw(zi((g[2] + g[3]) / 2)));
      d.textContent = du(g[1]) + " da " + pc(g[2]) + " a " + pc(g[3]);
      d.appendChild(el("small", null, idx === 0 ? "riscaldamento" : idx === out.length - 1 ? "defaticamento" : "progressione"));
      w.textContent = W(g[2]) + " → " + W(g[3]) + " W";
    } else {
      o.parts.forEach(p => z.appendChild(sw(zi(p[1]))));
      const body = o.parts.map(p => du(p[0]) + " al " + pc(p[1])).join(" + ");
      d.textContent = o.n > 1 ? o.n + " × (" + body + ")" : body;
      if (o.cad) d.appendChild(el("small", null, o.cad + " rpm"));
      w.textContent = o.parts.map(p => W(p[1])).join(" / ") + " W";
    }
    li.appendChild(z); li.appendChild(d); li.appendChild(w); ul.appendChild(li);
  });
  box.appendChild(ul);
}

// ---------- reflect state into the page
function apply() {
  let n = 0, min = 0;
  const wkMin = {};
  S.forEach(s => { if (state.done[s.key]) { n++; min += s.min; wkMin[s.wk] = (wkMin[s.wk] || 0) + s.min; } });
  $("sDone").textContent = n; $("sTot").textContent = S.length; $("sBar").style.width = (n / S.length * 100) + "%";
  $("hDone").textContent = fmtH(min); $("hTot").textContent = Math.round(totMin / 60); $("hBar").style.width = (min / totMin * 100) + "%";
  const [ftp, last] = curFtp();
  $("ftpNow").textContent = ftp; $("wkg").textContent = (ftp / KG).toFixed(2).replace(".", ",");
  const d = ftp - FTP0;
  $("ftpDelta").textContent = last ? (d >= 0 ? "+" : "") + d + " W dalla partenza (test settimana " + last + ")" : "Partenza: 200 W. Primo test l'" + fmtD(S.find(s => s.test).date) + ".";
  [...plot.querySelectorAll(".wk")].forEach(b => {
    const w = +b.dataset.wk, planned = byWk[w].reduce((a, s) => a + s.min, 0), done = wkMin[w] || 0;
    b.firstChild.style.height = (done / planned * 100) + "%";
    b.title = "Settimana " + w + ": " + fmtH(done) + " di " + fmtH(planned) + " ore";
    b.setAttribute("aria-label", b.title);
  });
  D.weeks.filter(w => w.block === block).forEach(w => {
    const planned = byWk[w.wk].reduce((a, s) => a + s.min, 0);
    const e = $("wsum" + w.wk); if (e) e.textContent = "dal " + fmtD(w.mon) + " · " + fmtH(wkMin[w.wk] || 0) + " / " + fmtH(planned) + " h";
  });
  document.querySelectorAll(".row").forEach(r => {
    const on = !!state.done[r.dataset.key]; r.classList.toggle("done", on);
    const cb = r.querySelector("input[type=checkbox]"); if (cb.checked !== on) cb.checked = on;
  });
  fillDetail();
  document.querySelectorAll(".ftp").forEach(i => {
    if (document.activeElement === i) return;
    const v = state.ftp && state.ftp[i.id.slice(4)]; i.value = v > 0 ? v : "";
  });
}

// ---------- persistence: only in this browser (localStorage), plus export/import as a file
function saveLocal() {
  try { localStorage.setItem(LS, JSON.stringify(state)); $("sync").textContent = "Salvato solo su questo dispositivo."; }
  catch (e) { $("sync").textContent = "Non riesco a salvare su questo dispositivo: usa «Esporta» per tenere una copia."; }
}
function setDone(key, on) { state.done[key] = on; apply(); saveLocal(); }
function setFtp(wk, val) {
  const v = Math.round(+val);
  state.ftp[wk] = v >= 100 && v <= 500 ? v : 0;
  apply(); saveLocal();
}

try { const raw = localStorage.getItem(LS); if (raw) { const o = JSON.parse(raw); state = { done: o.done || {}, ftp: o.ftp || {} }; } } catch (e) {}
showBlock();
$("sync").textContent = "Salvato solo su questo dispositivo.";

const msg = t => { $("bkMsg").textContent = t; };
$("btnExp").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ app: "piano-ftp-2026-27", salvato: new Date().toISOString(), ...state }, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "piano-ftp-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  msg("File salvato nei Download del dispositivo.");
});
$("btnImp").addEventListener("click", () => $("fileImp").click());
$("fileImp").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const o = JSON.parse(await f.text());
    if (!o || typeof o.done !== "object" || typeof o.ftp !== "object") throw 0;
    if (!confirm("Importando, le spunte e gli FTP di questo dispositivo saranno sostituiti da quelli del file. Continuare?")) return;
    state = { done: o.done || {}, ftp: o.ftp || {} }; saveLocal(); apply(); msg("Dati importati.");
  } catch (err) { msg("Questo file non sembra una copia di Piano FTP: non è stato cambiato nulla."); }
});

// ---------- offline + automatic updates (the page reloads once when a new version takes over)
if ("serviceWorker" in navigator) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (had) location.reload(); });
}
