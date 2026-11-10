'use strict';

/* =========================================================
   Mi Ahorro — planea tu quincena
   Datos guardados en el teléfono (localStorage).
   Se cobra el día 15 y el último día de cada mes.
   ========================================================= */

const STORE_KEY = 'mi-ahorro-v1';

const CATS = [
  ['comida', '🍽️', 'Comida', '#22c55e'],
  ['casa', '🏠', 'Casa / Renta', '#f43f5e'],
  ['obra', '👷', 'Albañil / Obra', '#f59e0b'],
  ['herramientas', '🧰', 'Servicios y herramientas de trabajo', '#8b5cf6'],
  ['telefono', '📱', 'Teléfono / Internet', '#3b82f6'],
  ['deudas', '💳', 'Deudas', '#ef4444'],
  ['gustos', '🎉', 'Gustos', '#ec4899'],
  ['otro', '📦', 'Otro', '#64748b'],
];
// Colores de las barras por mes (de izquierda a derecha, como un arcoíris)
const BAR_COLORS = ['#3b82f6', '#06b6d4', '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444', '#ec4899'];
const MONTOS_RAPIDOS = [10, 20, 50, 100, 200];
const CAPITAL_RAPIDO = [50, 100, 200, 500, 1000, 1200];
const CAT = Object.fromEntries(CATS.map(([id, e, n, c]) => [id, { e, n, c }]));

const MONEDAS = [
  ['USD', 'Dólar'], ['VES', 'Bolívar'], ['MXN', 'Peso mexicano'], ['COP', 'Peso colombiano'], ['ARS', 'Peso argentino'],
  ['CLP', 'Peso chileno'], ['PEN', 'Sol peruano'], ['GTQ', 'Quetzal'], ['DOP', 'Peso dominicano'], ['EUR', 'Euro'],
];

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/* ---------------- Fechas y días de cobro ---------------- */

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => new Date(s + 'T12:00:00');
const hoyD = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; };
const today = () => ymd(hoyD());
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const dayDiff = (a, b) => Math.round((b - a) / 86400000);

// Día de cobro igual o posterior a d (15 o último del mes)
function cobroDesde(d) {
  const y = d.getFullYear(), m = d.getMonth();
  return d.getDate() <= 15 ? new Date(y, m, 15, 12) : new Date(y, m + 1, 0, 12);
}
// Día de cobro igual o anterior a d
function cobroHasta(d) {
  const y = d.getFullYear(), m = d.getMonth(), last = new Date(y, m + 1, 0).getDate();
  if (d.getDate() === last) return new Date(y, m, last, 12);
  if (d.getDate() >= 15) return new Date(y, m, 15, 12);
  return new Date(y, m, 0, 12);
}
const cobroDespues = d => cobroDesde(addDays(d, 1));
// ¿De qué cobro es el dinero que tengo en la fecha d? (si faltan ≤3 días se toma el siguiente: cobro adelantado)
function cobroPara(d) {
  const n = cobroDesde(d);
  return dayDiff(d, n) <= 3 ? n : cobroHasta(d);
}
const tipoCobro = d => (d.getDate() === 15 ? '15' : 'fin');

function siguienteCobro(prev) {
  let c = cobroPara(hoyD());
  if (prev && prev.cobro && c <= parse(prev.cobro)) c = cobroDespues(parse(prev.cobro));
  return c;
}

/* ---------------- Estado ---------------- */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const freqDe = g => g.freq || (g.fijo ? 'quincenal' : 'una');

function nuevaQuincena(prev) {
  const cobro = siguienteCobro(prev);
  const tipo = tipoCobro(cobro);
  const gastos = [], enEspera = [];
  if (prev) {
    const recur = [...prev.gastos.filter(g => freqDe(g) !== 'una'), ...(prev.enEspera || [])];
    for (const g of recur) {
      const ng = { ...g, id: uid(), pagado: false, freq: freqDe(g) };
      if (ng.freq === 'mensual' && (ng.mitad || '15') !== tipo) enEspera.push(ng);
      else gastos.push(ng);
    }
  }
  return {
    id: uid(),
    inicio: today(),
    cobro: ymd(cobro),
    ingreso: prev ? prev.ingreso : 0,
    extras: [],
    ahorroModo: prev ? prev.ahorroModo : 'monto',
    ahorroValor: prev ? prev.ahorroValor : 0,
    gastos,
    enEspera,
  };
}

function estadoInicial() {
  return { v: 2, moneda: 'USD', meta: { nombre: '', monto: 0 }, actual: nuevaQuincena(null), historial: [], movs: [] };
}

// Completa datos de versiones anteriores
function migrar(s) {
  s = { ...estadoInicial(), ...s };
  const q = s.actual;
  if (!q.cobro) q.cobro = ymd(cobroPara(parse(q.inicio || today())));
  if (!Array.isArray(q.extras)) q.extras = [];
  if (!Array.isArray(q.enEspera)) q.enEspera = [];
  for (const g of [...q.gastos, ...q.enEspera]) {
    if (!g.freq) g.freq = freqDe(g);
    if (!CAT[g.cat]) g.cat = 'otro';
  }
  s.v = 2;
  return s;
}

function cargar() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.actual) return migrar(s);
    }
  } catch (e) { /* sin almacenamiento disponible */ }
  return estadoInicial();
}

let S = cargar();
const TABS = ['inicio', 'calc', 'ahorros', 'ajustes'];
let tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'inicio';

function guardar() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
  catch (e) { toast('No se pudo guardar en el teléfono'); }
}

/* ---------------- Utilidades ---------------- */

let fmtCache = {};
function money(n, opts = {}) {
  const key = S.moneda + (opts.dec ? 'd' : '');
  if (!fmtCache[key]) {
    fmtCache[key] = new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: S.moneda,
      minimumFractionDigits: opts.dec ? 2 : 0, maximumFractionDigits: 2,
    });
  }
  return fmtCache[key].format(n || 0);
}
function curSymbol() {
  const p = new Intl.NumberFormat('es-MX', { style: 'currency', currency: S.moneda }).formatToParts(0);
  return (p.find(x => x.type === 'currency') || { value: '$' }).value;
}
function num(str) {
  const n = parseFloat(String(str).replace(/[^\d.\-]/g, ''));
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);

function etiquetaCobro(iso) {
  const d = parse(iso);
  return `Quincena del ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
// Para quincenas guardadas antes de que existiera el día de cobro
function etiquetaVieja(iso) {
  const d = parse(iso);
  return `${d.getDate() <= 15 ? '1ª' : '2ª'} quincena de ${MESES[d.getMonth()]}`;
}
const etiquetaHist = h => (h.cobro ? etiquetaCobro(h.cobro) : etiquetaVieja(h.inicio));
function fechaCorta(iso) {
  const d = parse(iso);
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}
const diaMes = d => `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
const nombreMitad = m => (m === 'fin' ? 'la de fin de mes' : 'la del 15');

function calc(q) {
  const base = q.ingreso || 0;
  const extra = (q.extras || []).reduce((a, x) => a + (x.monto || 0), 0);
  const ingreso = base + extra;
  const ahorro = q.ahorroModo === 'pct' ? Math.round(ingreso * (q.ahorroValor || 0)) / 100 : (q.ahorroValor || 0);
  const gastos = q.gastos.reduce((a, g) => a + (g.monto || 0), 0);
  const pagado = q.gastos.filter(g => g.pagado).reduce((a, g) => a + (g.monto || 0), 0);
  const libre = ingreso - ahorro - gastos;
  return { base, extra, ingreso, ahorro, gastos, pagado, pendiente: gastos - pagado, libre };
}

// Días que faltan para cobrar, contando hoy y el día de cobro
function diasParaCobrar(q) {
  const hoy = hoyD();
  const hasta = cobroDespues(parse(q.cobro));
  return { hasta, dias: dayDiff(hoy, hasta) + 1 };
}

function totalAhorrado() {
  return S.historial.reduce((a, h) => a + (h.ahorroReal || 0), 0) + S.movs.reduce((a, m) => a + (m.monto || 0), 0);
}

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------------- Tasa BCV ---------------- */
// Fuente: DolarApi Venezuela (publica la tasa oficial del BCV, la misma de bcv.org.ve)

const BCV_KEY = 'mi-ahorro-bcv';
const BCV_URL = 'https://ve.dolarapi.com/v1/cotizaciones';
let BCV = (() => { try { return JSON.parse(localStorage.getItem(BCV_KEY)) || null; } catch (e) { return null; } })();
let bcvCargando = false, bcvError = false;

const bs = n => new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

async function actualizarBCV(forzar) {
  if (bcvCargando) return;
  if (!forzar && BCV && Date.now() - BCV.obtenido < 60 * 60 * 1000) return; // máximo una vez por hora
  bcvCargando = true;
  try {
    const res = await fetch(BCV_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const of = m => data.find(x => x.moneda === m && x.fuente === 'oficial');
    const usd = of('USD'), eur = of('EUR');
    if (!usd || !eur) throw new Error('sin datos');
    BCV = {
      usd: usd.promedio, eur: eur.promedio,
      fecha: String(usd.fechaActualizacion || '').slice(0, 10), obtenido: Date.now(),
    };
    bcvError = false;
    try { localStorage.setItem(BCV_KEY, JSON.stringify(BCV)); } catch (e) { /* nada */ }
  } catch (e) {
    bcvError = true;
  }
  bcvCargando = false;
  if ((tab === 'inicio' || tab === 'calc') && !$('#sheet').classList.contains('open')) render();
}

function fechaBCV(larga) {
  if (!BCV || !BCV.fecha) return '';
  const f = parse(BCV.fecha);
  return larga ? `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}` : `${DIAS[f.getDay()].slice(0, 3)} ${diaMes(f)}`;
}

function tarjetaBCV() {
  if (!BCV) {
    return `<button class="card bcv" data-tabgo="calc">
      <span style="font-size:22px">💱</span>
      <span class="bcv-t"><b>Tasa BCV</b>${bcvError ? 'Sin conexión' : 'Cargando…'}</span></button>`;
  }
  return `<button class="card bcv" data-tabgo="calc">
    <span style="font-size:22px">💱</span>
    <span class="bcv-t"><b>Tasa BCV</b>${bcvError ? '⚠️ sin conexión' : fechaBCV(false)}</span>
    <span class="bcv-v">
      <div><span>USD</span><b>Bs. ${bs(BCV.usd)}</b></div>
      <div><span>EUR</span><b>Bs. ${bs(BCV.eur)}</b></div>
    </span>
    <span class="chev">›</span></button>`;
}

/* ---- Calculadora ---- */
const CALC = { div: 'USD', ext: '', ves: '', ultimo: 'ext' };
const tasaDe = d => (BCV ? (d === 'USD' ? BCV.usd : BCV.eur) : 0);
const simb = d => (d === 'USD' ? '$' : '€');
const fmtIn = n => (n ? String(Math.round(n * 100) / 100) : '');

function vistaCalc() {
  const rates = BCV
    ? `<div class="rates">
        <div class="card"><div class="rk"><span class="dot" style="background:#22c55e"></span>Dólar BCV</div><div class="rv">Bs. ${bs(BCV.usd)}</div><div class="rf">por 1 USD</div></div>
        <div class="card"><div class="rk"><span class="dot" style="background:#3b82f6"></span>Euro BCV</div><div class="rv">Bs. ${bs(BCV.eur)}</div><div class="rf">por 1 EUR</div></div>
      </div>
      <div class="soon" style="margin-top:8px">Fecha valor: ${fechaBCV(true)}${bcvError ? ' · ⚠️ sin conexión, última tasa guardada' : ''}</div>`
    : `<div class="card"><div class="empty"><div class="e">📡</div>${bcvError ? 'No hay conexión para buscar la tasa.<br>Conéctate a internet e intenta de nuevo.' : 'Buscando la tasa del BCV…'}</div></div>`;

  return `
    <header class="top"><div><h1>Calculadora</h1><div class="sub">Bolívares ↔ dólares y euros, tasa oficial BCV</div></div></header>
    ${rates}
    <div class="card conv">
      <div class="seg" id="cDiv" style="margin-bottom:14px">
        <button data-d="USD">🇺🇸 Dólares</button><button data-d="EUR">🇪🇺 Euros</button>
      </div>
      <div class="cf"><div class="cl"><span>${CALC.div === 'USD' ? 'Dólares' : 'Euros'}</span><span>${CALC.div}</span></div>
        <div class="ci"><span>${simb(CALC.div)}</span><input id="cExt" inputmode="decimal" autocomplete="off" placeholder="0" value="${CALC.ext}"></div></div>
      <div class="swap" aria-hidden="true">⇅</div>
      <div class="cf"><div class="cl"><span>Bolívares</span><span>VES</span></div>
        <div class="ci"><span>Bs.</span><input id="cVes" inputmode="decimal" autocomplete="off" placeholder="0" value="${CALC.ves}"></div></div>
      <div class="chips" style="margin-top:14px">${[1, 5, 10, 20, 50, 100].map(m => `<button class="chip" data-q="${m}">${simb(CALC.div)}${m}</button>`).join('')}<button class="chip" id="cClr">Borrar</button></div>
    </div>
    <button class="btn soft mt" data-act="bcvRefrescar">🔄 Actualizar tasa</button>
    <div class="soon">💡 Pronto: precio del USDT</div>
  `;
}

function montarCalc() {
  const v = $('#view');
  const ext = $('#cExt', v), ves = $('#cVes', v);
  if (!ext) return;
  v.querySelectorAll('#cDiv button').forEach(b => b.classList.toggle('on', b.dataset.d === CALC.div));
  const desdeExt = () => { CALC.ext = ext.value; CALC.ultimo = 'ext'; CALC.ves = BCV ? fmtIn(num(ext.value) * tasaDe(CALC.div)) : ''; ves.value = CALC.ves; };
  const desdeVes = () => { CALC.ves = ves.value; CALC.ultimo = 'ves'; CALC.ext = BCV ? fmtIn(num(ves.value) / tasaDe(CALC.div)) : ''; ext.value = CALC.ext; };
  ext.oninput = desdeExt;
  ves.oninput = desdeVes;
  v.querySelectorAll('#cDiv button').forEach(b => b.onclick = () => {
    CALC.div = b.dataset.d;
    // recalcula a partir del último campo que escribiste
    if (CALC.ultimo === 'ves') { CALC.ext = BCV ? fmtIn(num(CALC.ves) / tasaDe(CALC.div)) : ''; }
    else { CALC.ves = BCV ? fmtIn(num(CALC.ext) * tasaDe(CALC.div)) : ''; }
    render();
  });
  v.querySelectorAll('[data-q]').forEach(c => c.onclick = () => { ext.value = c.dataset.q; desdeExt(); });
  $('#cClr', v).onclick = () => { CALC.ext = CALC.ves = ''; ext.value = ves.value = ''; ext.focus(); };
}

/* ---------------- Vistas ---------------- */

// Mes al que pertenece una quincena: el mes en que se termina de gastar ese dinero
function mesDeQuincena(cobroIso, inicioIso) {
  const d = cobroIso ? cobroDespues(parse(cobroIso)) : parse(inicioIso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function graficaMensual(q, c) {
  const tot = {};
  for (const h of S.historial) {
    const k = mesDeQuincena(h.cobro, h.inicio);
    tot[k] = (tot[k] || 0) + (h.gastos || 0);
  }
  const kAct = mesDeQuincena(q.cobro, q.inicio);
  tot[kAct] = (tot[kAct] || 0) + c.gastos;

  const [y, m] = kAct.split('-').map(Number);
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    meses.push({ k, lbl: MESES[d.getMonth()].slice(0, 3), v: tot[k] || 0 });
  }
  const max = Math.max(...meses.map(x => x.v), 1);
  const bars = meses.map((x, i) => {
    const cur = x.k === kAct;
    const h = Math.max(4, Math.round((x.v / max) * 100));
    return `<div class="b ${cur ? 'cur' : ''}">
      <div class="col ${cur ? 'cur' : ''}" style="height:${h}%;background:${BAR_COLORS[i + 2]}">${x.v && (cur || x.v === max) ? `<span class="tip">${money(x.v)}</span>` : ''}</div>
      <span class="lbl">${x.lbl}</span></div>`;
  }).join('');
  const nombreMes = MESES[m - 1];
  return `<div class="card">
    <div class="card-h"><h2>Gasto por mes</h2><span class="r">${money(tot[kAct])}</span></div>
    <div class="m" style="color:var(--muted);font-size:12.5px;margin-top:-8px">Total de ${nombreMes}, sumando sus dos quincenas</div>
    <div class="bars">${bars}</div>
  </div>`;
}

function porCategoria(q, c) {
  if (!q.gastos.length) return '';
  const g = {};
  for (const x of q.gastos) g[x.cat] = (g[x.cat] || 0) + (x.monto || 0);
  const filas = Object.entries(g).sort((a, b) => b[1] - a[1]).map(([id, v]) => {
    const cat = CAT[id] || CAT.otro;
    const pct = c.gastos ? Math.round((v / c.gastos) * 100) : 0;
    return `<div class="cat-r">
      <span class="cat-i" style="background:${cat.c}26;color:${cat.c}">${cat.e}</span>
      <div class="cat-b">
        <div class="cat-l"><span>${cat.n}</span><b>${money(v)}</b></div>
        <div class="track"><div style="width:${pct}%;background:${cat.c}"></div></div>
      </div></div>`;
  }).join('');
  return `<div class="card">
    <div class="card-h"><h2>En qué se va la quincena</h2><span class="m">${money(c.gastos)}</span></div>
    <div class="cats">${filas}</div></div>`;
}

function anillo(valor, total, color) {
  const R = 40, C = 2 * Math.PI * R;
  const p = total > 0 ? Math.min(1, valor / total) : 0;
  return `<svg class="ring" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--card-3)" stroke-width="9"/>
    <circle cx="50" cy="50" r="${R}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${p * C} ${C}" transform="rotate(-90 50 50)"/>
    <text x="50" y="49" text-anchor="middle" class="rv">${money(valor)}</text>
    <text x="50" y="65" text-anchor="middle" class="rs">${total > 0 ? money(total) : 'sin meta'}</text>
  </svg>`;
}

function metaYResumen(c) {
  const total = totalAhorrado();
  const meta = S.meta;
  const ref = c.ingreso || 1;
  const barra = (k, v, color) => `<div class="sm"><div class="sl"><span>${k}</span><b>${money(v)}</b></div>
    <div class="track"><div style="width:${Math.min(100, Math.round((Math.max(v, 0) / ref) * 100))}%;background:${color}"></div></div></div>`;
  return `<div class="grid2">
    <button class="card ring-card" data-act="editMeta">
      <h2>Meta de ahorro</h2>
      ${anillo(total, meta.monto, '#34d399')}
      <div class="rn">${meta.monto ? esc(meta.nombre) || 'Mi meta' : '🎯 Toca para crear una'}</div>
    </button>
    <div class="card sum-card">
      <h2>Esta quincena</h2>
      ${barra('Dinero', c.ingreso, '#34d399')}
      ${barra('Gastos', c.gastos, '#f87171')}
      ${barra('Ahorro', c.ahorro, '#3b82f6')}
    </div>
  </div>`;
}

function tarjetaDiaria(q, c) {
  const { hasta, dias } = diasParaCobrar(q);
  const cuando = `${DIAS[hasta.getDay()]} ${diaMes(hasta)}`;

  if (dias < 1) {
    return `<div class="card daily late">
      <div class="d-msg">⏰ Tu día de cobro fue el <b>${cuando}</b>. Termina esta quincena para empezar la nueva.</div>
      <button class="btn mt" data-act="cerrar">Terminar quincena</button></div>`;
  }
  if (!c.ingreso) return '';

  const porDia = c.libre > 0 ? Math.floor((c.libre / dias) * 100) / 100 : 0;
  const pd = money(porDia, { dec: porDia % 1 !== 0 });
  const msg = c.libre > 0
    ? (dias === 1
        ? `Hoy cobras. Tienes <b>${money(c.libre)}</b> libres para hoy.`
        : `Tienes un total de <b>${money(c.libre)}</b> libres, lo que hace que puedas gastar <b>${pd} al día</b> hasta que cobres.`)
    : 'No te queda dinero libre para el día a día. Revisa tus gastos o tu ahorro.';

  return `<div class="card daily">
    <div class="d-top">
      <div class="d-main">
        <div class="k">Puedes gastar al día</div>
        <div class="v ${c.libre > 0 ? '' : 'neg'}">${pd}</div>
      </div>
      <div class="d-days"><b>${dias}</b><span>${dias === 1 ? 'día' : 'días'}</span></div>
    </div>
    <div class="d-msg">${msg}</div>
    <div class="d-foot">📅 Cobras el ${cuando} · ${dias === 1 ? 'último día' : 'contando hoy'}</div>
  </div>`;
}

function filaGasto(g, enEspera) {
  const cat = CAT[g.cat] || CAT.otro;
  const f = freqDe(g);
  const tag = f === 'quincenal' ? '<span class="tag">quincenal</span>' : f === 'mensual' ? '<span class="tag mes">mensual</span>' : '';
  const sub = enEspera ? `Se paga con ${nombreMitad(g.mitad)}` : `${cat.n}${g.pagado ? ' · pagado' : ''}`;
  return `<div class="row ${g.pagado ? 'paid' : ''} ${enEspera ? 'waiting' : ''}">
    <button class="ico" data-act="editGasto" data-id="${g.id}" style="background:${cat.c}26">${cat.e}</button>
    <button class="main" data-act="editGasto" data-id="${g.id}" style="text-align:left">
      <div class="t">${esc(g.nombre)}${tag}</div>
      <div class="s">${sub}</div>
    </button>
    <span class="amt">${money(g.monto)}</span>
    ${enEspera ? '' : `<button class="check ${g.pagado ? 'on' : ''}" data-act="togglePago" data-id="${g.id}" aria-label="Marcar pagado">✓</button>`}
  </div>`;
}

function vistaInicio() {
  const q = S.actual;
  const c = calc(q);
  const hasta = cobroDespues(parse(q.cobro));

  const gastosHtml = q.gastos.length
    ? `<div class="list">${q.gastos.map(g => filaGasto(g, false)).join('')}</div>`
    : `<div class="list"><div class="empty"><div class="e">🧾</div>Toca el botón <b>+</b> para agregar lo que tienes que pagar esta quincena: comida, albañil, renta…</div></div>`;

  const esperaHtml = q.enEspera.length
    ? `<div class="sec-h"><h2 style="font-size:15px">Mensuales de la otra quincena</h2><span class="meta">no cuentan ahora</span></div>
       <div class="list">${q.enEspera.map(g => filaGasto(g, true)).join('')}</div>`
    : '';

  return `
    <header class="top">
      <div class="brand"><img src="icons/icon-192.png" alt=""><div><h1>Mi Ahorro</h1><div class="sub">cobras el ${DIAS[hasta.getDay()]} ${diaMes(hasta)}</div></div></div>
    </header>

    ${tarjetaBCV()}

    <section class="hero">
      <div class="label">${etiquetaCobro(q.cobro)}</div>
      <div class="big">${money(c.ingreso)}</div>
      ${c.extra ? `<div class="hero-note">Incluye ${money(c.extra)} de capital agregado</div>` : ''}
      <div class="hero-btns">
        <button class="pill" data-act="editIngreso">✏️ ${c.ingreso ? 'Cambiar' : 'Poner cuánto tengo'}</button>
        <button class="pill green" data-act="capital">＋ Agregar capital</button>
      </div>
      <div class="hero-split">
        <button data-act="editAhorro" style="text-align:left"><div class="k"><span class="dot" style="background:#3b82f6"></span>Ahorro</div><div class="v">${money(c.ahorro)}</div></button>
        <div><div class="k"><span class="dot" style="background:#f87171"></span>Gastos</div><div class="v">${money(c.gastos)}</div></div>
        <div><div class="k"><span class="dot" style="background:#34d399"></span>Libre</div><div class="v ${c.libre < 0 ? 'neg' : ''}">${money(c.libre)}</div></div>
      </div>
    </section>

    ${c.libre < 0 ? `<div class="alert">⚠️ <div>Te faltan <b>${money(-c.libre)}</b>. Baja algún gasto o el ahorro de esta quincena.</div></div>` : ''}

    ${tarjetaDiaria(q, c)}
    ${graficaMensual(q, c)}
    ${porCategoria(q, c)}
    ${metaYResumen(c)}

    <div class="sec-h">
      <h2>Gastos de la quincena</h2>
      <span class="meta">${q.gastos.filter(g => g.pagado).length}/${q.gastos.length} pagados${c.pendiente > 0 ? ` · faltan ${money(c.pendiente)}` : ''}</span>
    </div>
    ${gastosHtml}
    ${esperaHtml}

    <button class="btn soft mt" data-act="cerrar">✅ Terminar quincena y guardar ahorro</button>

    <button class="fab" data-act="nuevoGasto" aria-label="Agregar gasto">+</button>
  `;
}

function vistaAhorros() {
  const total = totalAhorrado();
  const meta = S.meta;
  const pct = meta.monto > 0 ? Math.min(100, Math.round((total / meta.monto) * 100)) : 0;

  const items = [
    ...S.historial.map(h => ({ tipo: 'q', fecha: h.fin, h })),
    ...S.movs.map(m => ({ tipo: 'm', fecha: m.fecha, m })),
  ].sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : 0));

  const lista = items.length
    ? `<div class="list">${items.map(it => {
        if (it.tipo === 'q') {
          const h = it.h;
          return `<button class="row" data-act="verQuincena" data-id="${h.id}">
            <span class="ico">🗓️</span>
            <span class="main"><div class="t">${etiquetaHist(h)}</div>
            <div class="s">Ingreso ${money(h.ingreso)} · gastos ${money(h.gastos)}</div></span>
            <span class="amt pos">+${money(h.ahorroReal)}</span></button>`;
        }
        const m = it.m;
        const dep = m.monto >= 0;
        return `<button class="row" data-act="verMov" data-id="${m.id}">
          <span class="ico">${dep ? '💰' : '💸'}</span>
          <span class="main"><div class="t">${esc(m.nota) || (dep ? 'Depósito' : 'Retiro')}</div>
          <div class="s">${fechaCorta(m.fecha)} · ${dep ? 'depósito' : 'retiro'}</div></span>
          <span class="amt ${dep ? 'pos' : 'neg'}">${dep ? '+' : '−'}${money(Math.abs(m.monto))}</span></button>`;
      }).join('')}</div>`
    : `<div class="list"><div class="empty"><div class="e">🌱</div>Cuando termines tu primera quincena,<br>tu ahorro aparecerá aquí.</div></div>`;

  return `
    <header class="top"><div><h1>Mis ahorros</h1><div class="sub">Todo lo que has juntado</div></div></header>

    <section class="hero">
      <div class="label">Llevo ahorrado</div>
      <div class="big">${money(total)}</div>
      ${meta.monto > 0
        ? `<div style="position:relative;z-index:1">
            <div class="progress"><div style="width:${pct}%"></div></div>
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:8px">
              <span>🎯 ${esc(meta.nombre) || 'Mi meta'}: ${money(meta.monto)}</span><span>${pct}%</span>
            </div>
            <div style="font-size:13px;margin-top:4px;color:var(--muted)">${total >= meta.monto ? '¡Lo lograste! 🎉' : `Te faltan ${money(meta.monto - total)}`}</div>
            <div class="hero-btns" style="margin-top:12px"><button class="pill" data-act="editMeta">✏️ Cambiar meta</button></div>
          </div>`
        : `<div class="hero-btns"><button class="pill green" data-act="editMeta">🎯 Ponerme una meta</button></div>`}
    </section>

    <div class="btn-row">
      <button class="btn" data-act="mov" data-tipo="dep">＋ Meter dinero</button>
      <button class="btn soft" data-act="mov" data-tipo="ret">− Sacar dinero</button>
    </div>

    <div class="sec-h"><h2>Historial</h2><span class="meta">${S.historial.length} quincena${S.historial.length === 1 ? '' : 's'}</span></div>
    ${lista}
  `;
}

function vistaAjustes() {
  const mon = MONEDAS.find(m => m[0] === S.moneda);
  return `
    <header class="top"><div><h1>Ajustes</h1><div class="sub">Tus datos se guardan solo en este teléfono</div></div></header>
    <div class="list settings">
      <button class="row" data-act="moneda"><span class="ico">💱</span><span class="main"><div class="t">Moneda</div><div class="s">${mon ? mon[1] : S.moneda} (${S.moneda})</div></span><span>›</span></button>
      <button class="row" data-act="exportar"><span class="ico">📤</span><span class="main"><div class="t">Guardar respaldo</div><div class="s">Descarga un archivo con todos tus datos</div></span><span>›</span></button>
      <button class="row" data-act="importar"><span class="ico">📥</span><span class="main"><div class="t">Cargar respaldo</div><div class="s">Recupera tus datos desde un archivo</div></span><span>›</span></button>
      <button class="row" data-act="borrarTodo"><span class="ico">🗑️</span><span class="main"><div class="t" style="color:var(--danger)">Borrar todo</div><div class="s">Empezar de cero</div></span><span>›</span></button>
    </div>
    <div class="card" style="font-size:14px;color:var(--muted);line-height:1.55">
      💡 <b style="color:var(--text)">Cómo funciona:</b> pon cuánto dinero tienes en la quincena, cuánto quieres ahorrar y lo que tienes que pagar.
      La app te dice cuánto te queda libre y <b>cuánto puedes gastar al día</b> hasta tu próximo cobro (el 15 y el último día de cada mes, contando hoy).<br><br>
      Si te entra dinero extra, usa <b>“Agregar capital”</b>. Los gastos <b>quincenales</b> se copian a cada quincena y los <b>mensuales</b> solo a la quincena con la que los pagas.
      Al terminar la quincena, tócale a <i>“Terminar quincena”</i> y tu ahorro se suma a tu alcancía.
    </div>
    <input type="file" id="fileImport" accept="application/json,.json" hidden>
    <div class="card" style="font-size:13px;color:var(--muted);line-height:1.5">
      💱 La tasa oficial del BCV se obtiene de <b style="color:var(--text)">DolarApi Venezuela</b> (ve.dolarapi.com), que publica la misma tasa de bcv.org.ve.
    </div>
    <div class="foot">Mi Ahorro · v2.0</div>
  `;
}

function render() {
  const v = $('#view');
  v.innerHTML = tab === 'inicio' ? vistaInicio() : tab === 'calc' ? vistaCalc() : tab === 'ahorros' ? vistaAhorros() : vistaAjustes();
  if (tab === 'calc') montarCalc();
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
}

/* ---------------- Hoja inferior (bottom sheet) ---------------- */

function openSheet(html, mount) {
  $('#sheetBody').innerHTML = html;
  $('#scrim').classList.add('open');
  $('#sheet').classList.add('open');
  $('#sheet').scrollTop = 0;
  if (mount) mount($('#sheetBody'));
  history.pushState({ sheet: true }, '');
}
function closeSheet(fromPop) {
  if (!$('#sheet').classList.contains('open')) return;
  $('#scrim').classList.remove('open');
  $('#sheet').classList.remove('open');
  document.activeElement && document.activeElement.blur();
  if (!fromPop && history.state && history.state.sheet) history.back();
}
window.addEventListener('popstate', () => closeSheet(true));
$('#scrim').addEventListener('click', () => closeSheet());

function moneyField(id, value, label) {
  return `<div class="field"><label for="${id}">${label}</label>
    <div class="money"><span class="cur">${esc(curSymbol())}</span>
    <input class="input" id="${id}" inputmode="decimal" autocomplete="off" placeholder="0" value="${value ? value : ''}"></div></div>`;
}
// Botones que suman al campo de dinero
function chipsSuma(id, montos) {
  return `<div class="chips" id="${id}" style="margin-top:10px">
    ${montos.map(m => `<button class="chip" data-m="${m}">+${money(m)}</button>`).join('')}
    <button class="chip" data-m="0">Borrar</button></div>`;
}
function conectarChipsSuma(b, chipsId, input) {
  b.querySelectorAll(`#${chipsId} .chip`).forEach(c => c.onclick = () => {
    const m = +c.dataset.m;
    input.value = m ? num(input.value) + m : '';
    input.dispatchEvent(new Event('input'));
  });
}
function focusLater(el) { setTimeout(() => { el.focus(); el.select && el.select(); }, 280); }

/* ---- Ingreso ---- */
function sheetIngreso() {
  const c = calc(S.actual);
  openSheet(`
    <h3>¿Cuánto dinero tienes esta quincena?</h3>
    <p class="hint">Tu sueldo o el total con el que cuentas.${c.extra ? ` Aparte llevas ${money(c.extra)} de capital agregado.` : ''}</p>
    ${moneyField('fIngreso', S.actual.ingreso, 'Total')}
    <button class="btn mt" id="ok">Guardar</button>`,
    b => {
      const inp = $('#fIngreso', b);
      focusLater(inp);
      const save = () => { S.actual.ingreso = num(inp.value); guardar(); closeSheet(); render(); };
      $('#ok', b).onclick = save;
      inp.onkeydown = e => { if (e.key === 'Enter') save(); };
    });
}

/* ---- Agregar capital ---- */
function sheetCapital() {
  const q = S.actual;
  const listaExtras = () => q.extras.length
    ? `<div class="sec-h"><h2 style="font-size:15px">Agregado esta quincena</h2></div>
       <div class="list" style="box-shadow:none;background:var(--card-2)">${q.extras.map(x => `<div class="row">
         <span class="ico" style="background:var(--card)">💵</span>
         <span class="main"><div class="t">${esc(x.nota) || 'Capital'}</div><div class="s">${fechaCorta(x.fecha)}</div></span>
         <span class="amt pos">+${money(x.monto)}</span>
         <button class="check" data-del="${x.id}" aria-label="Quitar" style="color:var(--muted)">✕</button></div>`).join('')}</div>`
    : '';
  openSheet(`
    <h3>Agregar capital</h3>
    <p class="hint">Dinero extra que te entró en esta quincena. Se suma a lo que tienes para gastar y ahorrar.</p>
    ${moneyField('fCap', '', 'Cantidad')}
    ${chipsSuma('capChips', CAPITAL_RAPIDO)}
    <div class="field"><label for="fCapN">Nota (opcional)</label>
      <input class="input" id="fCapN" maxlength="40" placeholder="Ej. Trabajo extra, venta…"></div>
    <button class="btn mt" id="ok">Agregar a la quincena</button>
    <div id="extrasBox">${listaExtras()}</div>`,
    b => {
      const inp = $('#fCap', b);
      conectarChipsSuma(b, 'capChips', inp);
      $('#ok', b).onclick = () => {
        const v = num(inp.value);
        if (v <= 0) { toast('Pon una cantidad'); return; }
        q.extras.push({ id: uid(), monto: v, nota: $('#fCapN', b).value.trim(), fecha: today() });
        guardar(); closeSheet(); render();
        toast(`+${money(v)} a tu quincena 💵`);
      };
      $('#extrasBox', b).onclick = e => {
        const d = e.target.closest('[data-del]');
        if (!d) return;
        q.extras = q.extras.filter(x => x.id !== d.dataset.del);
        guardar(); render();
        $('#extrasBox', b).innerHTML = listaExtras();
        toast('Capital quitado');
      };
    });
}

/* ---- Ahorro ---- */
function sheetAhorro() {
  const q = S.actual;
  const base = calc(q);
  let modo = q.ahorroModo;
  openSheet(`
    <h3>¿Cuánto quieres ahorrar?</h3>
    <p class="hint">Primero apártate tu ahorro, luego gasta lo demás.</p>
    <div class="seg"><button data-m="monto">Cantidad fija</button><button data-m="pct">Porcentaje</button></div>
    <div id="ahorroBox"></div>
    <div class="hint" id="prev" style="margin-top:12px"></div>
    <button class="btn mt" id="ok">Guardar</button>`,
    b => {
      const box = $('#ahorroBox', b);
      const upd = () => {
        const v = num($('#fAh', b).value);
        const ah = modo === 'pct' ? (base.ingreso * v) / 100 : v;
        const libre = base.ingreso - ah - base.gastos;
        $('#prev', b).innerHTML = base.ingreso
          ? `Ahorras <b>${money(ah)}</b> · te quedan libres <b class="${libre < 0 ? 'neg' : ''}">${money(libre)}</b> después de gastos.`
          : 'Primero pon cuánto dinero tienes en la quincena.';
        box.querySelectorAll('.chip').forEach(ch => ch.classList.toggle('on', +ch.dataset.p === v));
      };
      const drawBox = val => {
        b.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x.dataset.m === modo));
        if (modo === 'pct') {
          box.innerHTML = `<div class="field"><label for="fAh">Porcentaje de tu dinero</label>
            <div class="money pct"><span class="cur">%</span><input class="input" id="fAh" inputmode="decimal" placeholder="0" value="${val || ''}"></div></div>
            <div class="chips" style="margin-top:10px">${[5, 10, 15, 20, 30].map(p => `<button class="chip" data-p="${p}">${p}%</button>`).join('')}</div>`;
          box.querySelectorAll('.chip').forEach(ch => ch.onclick = () => { $('#fAh', b).value = ch.dataset.p; upd(); });
        } else {
          box.innerHTML = moneyField('fAh', val, 'Cantidad a ahorrar');
        }
        $('#fAh', b).oninput = upd;
        upd();
      };
      b.querySelectorAll('.seg button').forEach(x => x.onclick = () => {
        if (modo === x.dataset.m) return;
        const v = num($('#fAh', b).value);
        let nv = 0;
        if (base.ingreso) nv = x.dataset.m === 'pct' ? Math.round((v / base.ingreso) * 100) : Math.round(base.ingreso * v) / 100;
        modo = x.dataset.m;
        drawBox(nv || '');
      });
      drawBox(q.ahorroValor);
      focusLater($('#fAh', b));
      $('#ok', b).onclick = () => {
        q.ahorroModo = modo;
        q.ahorroValor = num($('#fAh', b).value);
        guardar(); closeSheet(); render();
      };
    });
}

/* ---- Gasto ---- */
function sheetGasto(id) {
  const q = S.actual;
  const tipoActual = tipoCobro(parse(q.cobro));
  const g = id ? (q.gastos.find(x => x.id === id) || q.enEspera.find(x => x.id === id)) : null;
  let cat = g && CAT[g.cat] ? g.cat : g ? 'otro' : 'comida';
  let freq = g ? freqDe(g) : 'una';
  let mitad = g && g.mitad ? g.mitad : tipoActual;
  openSheet(`
    <h3>${g ? 'Editar gasto' : 'Nuevo gasto'}</h3>
    <div class="field"><label for="fNom">¿Qué es?</label>
      <input class="input" id="fNom" maxlength="40" placeholder="Ej. Comida, pagar al albañil, Claude…" value="${g ? esc(g.nombre) : ''}"></div>
    ${moneyField('fMon', g ? g.monto : '', '¿Cuánto?')}
    ${chipsSuma('montos', MONTOS_RAPIDOS)}
    <div class="field"><label>Categoría</label>
      <div class="chips" id="cats">${CATS.map(([cid, e, n]) => `<button class="chip" data-c="${cid}">${e} ${n}</button>`).join('')}</div></div>
    <div class="field"><label>¿Cada cuándo lo pagas?</label>
      <div class="seg" id="freq">
        <button data-f="una">Solo esta vez</button><button data-f="quincenal">Cada quincena</button><button data-f="mensual">Cada mes</button>
      </div></div>
    <div class="field" id="mitadBox"><label>¿Con qué quincena lo pagas?</label>
      <div class="seg" id="mitad"><button data-h="15">La del 15</button><button data-h="fin">La de fin de mes</button></div></div>
    <p class="hint" id="freqHint" style="margin-top:10px"></p>
    <button class="btn" id="ok">${g ? 'Guardar cambios' : 'Agregar gasto'}</button>
    ${g ? '<button class="btn danger" id="del" style="margin-top:10px">Eliminar gasto</button>' : ''}`,
    b => {
      const nom = $('#fNom', b);
      const mon = $('#fMon', b);
      const drawCats = () => b.querySelectorAll('#cats .chip').forEach(c => c.classList.toggle('on', c.dataset.c === cat));
      b.querySelectorAll('#cats .chip').forEach(c => c.onclick = () => { cat = c.dataset.c; drawCats(); });
      drawCats();
      conectarChipsSuma(b, 'montos', mon);

      const drawFreq = () => {
        b.querySelectorAll('#freq button').forEach(x => x.classList.toggle('on', x.dataset.f === freq));
        b.querySelectorAll('#mitad button').forEach(x => x.classList.toggle('on', x.dataset.h === mitad));
        $('#mitadBox', b).style.display = freq === 'mensual' ? '' : 'none';
        $('#freqHint', b).textContent =
          freq === 'una' ? 'Solo cuenta en esta quincena.'
          : freq === 'quincenal' ? 'Se copia sola a cada quincena nueva.'
          : mitad === tipoActual ? 'Cuenta en esta quincena y se repite cada mes en la misma.'
          : `No cuenta en esta quincena: se agregará cuando empiece ${nombreMitad(mitad)}.`;
      };
      b.querySelectorAll('#freq button').forEach(x => x.onclick = () => { freq = x.dataset.f; drawFreq(); });
      b.querySelectorAll('#mitad button').forEach(x => x.onclick = () => { mitad = x.dataset.h; drawFreq(); });
      drawFreq();

      if (!g) focusLater(nom);
      $('#ok', b).onclick = () => {
        const monto = num(mon.value);
        if (!monto) { toast('Pon cuánto cuesta'); mon.focus(); return; }
        const datos = {
          nombre: nom.value.trim() || CAT[cat].n, monto, cat, freq,
          fijo: freq !== 'una', mitad: freq === 'mensual' ? mitad : undefined,
        };
        const obj = g || { id: uid(), pagado: false };
        Object.assign(obj, datos);
        const espera = freq === 'mensual' && mitad !== tipoActual;
        const enGastos = q.gastos.includes(obj);
        const enEspera = q.enEspera.includes(obj);
        if (espera && !enEspera) { q.gastos = q.gastos.filter(x => x !== obj); obj.pagado = false; q.enEspera.push(obj); }
        if (!espera && !enGastos) { q.enEspera = q.enEspera.filter(x => x !== obj); q.gastos.push(obj); }
        guardar(); closeSheet(); render();
        toast(espera ? `Guardado para ${nombreMitad(mitad)}` : g ? 'Gasto actualizado' : 'Gasto agregado');
      };
      if (g) $('#del', b).onclick = () => {
        q.gastos = q.gastos.filter(x => x.id !== g.id);
        q.enEspera = q.enEspera.filter(x => x.id !== g.id);
        guardar(); closeSheet(); render(); toast('Gasto eliminado');
      };
    });
}

/* ---- Cerrar quincena ---- */
function sheetCerrar() {
  const q = S.actual;
  const c = calc(q);
  const sig = siguienteCobro(q);
  const tipoSig = tipoCobro(sig);
  const recur = [...q.gastos.filter(g => freqDe(g) !== 'una'), ...q.enEspera]
    .filter(g => freqDe(g) !== 'mensual' || (g.mitad || '15') === tipoSig).length;
  openSheet(`
    <h3>Terminar quincena</h3>
    <p class="hint">${etiquetaCobro(q.cobro)}</p>
    <div class="summary">
      <div class="sr"><span>Dinero</span><b>${money(c.ingreso)}</b></div>
      <div class="sr"><span>Gastos</span><b>${money(c.gastos)}</b></div>
      <div class="sr"><span>Ahorro planeado</span><b class="pos">${money(c.ahorro)}</b></div>
      <div class="sr"><span>Sobró libre</span><b>${money(c.libre)}</b></div>
    </div>
    ${moneyField('fReal', c.ahorro, '¿Cuánto ahorraste de verdad?')}
    <div class="chips" style="margin-top:10px">
      <button class="chip" data-v="${c.ahorro}">Lo planeado</button>
      ${c.libre > 0 ? `<button class="chip" data-v="${c.ahorro + c.libre}">Planeado + lo que sobró</button>` : ''}
    </div>
    <p class="hint" style="margin-top:14px">Empezará la <b>${etiquetaCobro(ymd(sig)).toLowerCase()}</b> con ${money(c.base)} y el mismo ahorro${recur ? `, más ${recur} gasto${recur > 1 ? 's' : ''} que se repite${recur > 1 ? 'n' : ''}` : ''}. Lo puedes cambiar después.</p>
    <button class="btn" id="ok">Guardar y empezar nueva</button>
    <button class="btn ghost" id="cancel" style="margin-top:6px">Cancelar</button>`,
    b => {
      b.querySelectorAll('.chip').forEach(ch => ch.onclick = () => { $('#fReal', b).value = ch.dataset.v; });
      $('#cancel', b).onclick = () => closeSheet();
      $('#ok', b).onclick = () => {
        const real = num($('#fReal', b).value);
        S.historial.push({
          id: q.id, inicio: q.inicio, fin: today(), cobro: q.cobro,
          ingreso: c.ingreso, extra: c.extra, gastos: c.gastos, ahorroPlan: c.ahorro, ahorroReal: real,
          detalle: q.gastos.map(g => ({ nombre: g.nombre, monto: g.monto, cat: g.cat, pagado: g.pagado })),
        });
        S.actual = nuevaQuincena(q);
        guardar(); closeSheet(); render();
        toast(`¡${money(real)} a tu alcancía! 🐷`);
      };
    });
}

/* ---- Ver quincena pasada ---- */
function sheetVerQuincena(id) {
  const h = S.historial.find(x => x.id === id);
  if (!h) return;
  openSheet(`
    <h3>${etiquetaHist(h)}</h3>
    <p class="hint">${fechaCorta(h.inicio)} – ${fechaCorta(h.fin)}</p>
    <div class="summary">
      <div class="sr"><span>Dinero</span><b>${money(h.ingreso)}</b></div>
      ${h.extra ? `<div class="sr"><span>· capital agregado</span><b>${money(h.extra)}</b></div>` : ''}
      <div class="sr"><span>Gastos</span><b>${money(h.gastos)}</b></div>
      <div class="sr"><span>Ahorro planeado</span><b>${money(h.ahorroPlan)}</b></div>
      <div class="sr"><span>Ahorro real</span><b class="pos">${money(h.ahorroReal)}</b></div>
    </div>
    ${h.detalle && h.detalle.length ? `<div class="sec-h"><h2 style="font-size:16px">Gastos</h2></div>
      <div class="list" style="box-shadow:none;background:var(--card-2)">${h.detalle.map(g => `<div class="row">
        <span class="ico" style="background:var(--card)">${(CAT[g.cat] || CAT.otro).e}</span>
        <span class="main"><div class="t">${esc(g.nombre)}</div></span><span class="amt">${money(g.monto)}</span></div>`).join('')}</div>` : ''}
    <button class="btn danger mt" id="del">Borrar esta quincena</button>`,
    b => {
      $('#del', b).onclick = () => {
        if (!confirm('¿Borrar esta quincena del historial? Su ahorro se restará del total.')) return;
        S.historial = S.historial.filter(x => x.id !== id);
        guardar(); closeSheet(); render(); toast('Quincena borrada');
      };
    });
}

/* ---- Meta ---- */
function sheetMeta() {
  openSheet(`
    <h3>Mi meta de ahorro</h3>
    <p class="hint">¿Para qué estás ahorrando?</p>
    <div class="field"><label for="fMN">Nombre</label>
      <input class="input" id="fMN" maxlength="40" placeholder="Ej. Terminar la casa, fondo de emergencia…" value="${esc(S.meta.nombre)}"></div>
    ${moneyField('fMM', S.meta.monto, '¿Cuánto quieres juntar?')}
    <button class="btn mt" id="ok">Guardar meta</button>
    ${S.meta.monto ? '<button class="btn ghost" id="del" style="margin-top:6px">Quitar meta</button>' : ''}`,
    b => {
      $('#ok', b).onclick = () => {
        S.meta = { nombre: $('#fMN', b).value.trim(), monto: num($('#fMM', b).value) };
        guardar(); closeSheet(); render();
      };
      const d = $('#del', b);
      if (d) d.onclick = () => { S.meta = { nombre: '', monto: 0 }; guardar(); closeSheet(); render(); };
    });
}

/* ---- Movimiento manual de la alcancía ---- */
function sheetMov(tipo) {
  const dep = tipo === 'dep';
  openSheet(`
    <h3>${dep ? 'Meter dinero al ahorro' : 'Sacar dinero del ahorro'}</h3>
    <p class="hint">${dep ? 'Un dinero extra que quieras guardar.' : 'Disponible: ' + money(totalAhorrado())}</p>
    ${moneyField('fMv', '', 'Cantidad')}
    <div class="field"><label for="fNt">Nota (opcional)</label>
      <input class="input" id="fNt" maxlength="40" placeholder="${dep ? 'Ej. Aguinaldo' : 'Ej. Emergencia'}"></div>
    <button class="btn mt" id="ok">${dep ? 'Guardar depósito' : 'Guardar retiro'}</button>`,
    b => {
      focusLater($('#fMv', b));
      $('#ok', b).onclick = () => {
        const v = num($('#fMv', b).value);
        if (!v) { toast('Pon una cantidad'); return; }
        S.movs.push({ id: uid(), fecha: today(), monto: dep ? Math.abs(v) : -Math.abs(v), nota: $('#fNt', b).value.trim() });
        guardar(); closeSheet(); render();
        toast(dep ? 'Depósito guardado 💰' : 'Retiro guardado');
      };
    });
}

function sheetVerMov(id) {
  const m = S.movs.find(x => x.id === id);
  if (!m) return;
  openSheet(`
    <h3>${m.monto >= 0 ? 'Depósito' : 'Retiro'}</h3>
    <p class="hint">${fechaCorta(m.fecha)}${m.nota ? ' · ' + esc(m.nota) : ''}</p>
    <div class="summary"><div class="sr"><span>Cantidad</span><b class="${m.monto >= 0 ? 'pos' : 'neg'}">${money(m.monto)}</b></div></div>
    <button class="btn danger mt" id="del">Borrar movimiento</button>`,
    b => {
      $('#del', b).onclick = () => {
        S.movs = S.movs.filter(x => x.id !== id);
        guardar(); closeSheet(); render(); toast('Movimiento borrado');
      };
    });
}

/* ---- Moneda ---- */
function sheetMoneda() {
  openSheet(`
    <h3>Moneda</h3>
    <div class="list" style="box-shadow:none;background:var(--card-2);margin-top:10px">
      ${MONEDAS.map(([c, n]) => `<button class="row" data-c="${c}"><span class="main"><div class="t">${n}</div><div class="s">${c}</div></span>${c === S.moneda ? '<span class="check on">✓</span>' : ''}</button>`).join('')}
    </div>`,
    b => b.querySelectorAll('[data-c]').forEach(r => r.onclick = () => {
      S.moneda = r.dataset.c; fmtCache = {}; guardar(); closeSheet(); render();
    }));
}

/* ---- Respaldo ---- */
function exportar() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mi-ahorro-respaldo-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Respaldo descargado');
}
function importar() {
  const inp = $('#fileImport');
  inp.value = '';
  inp.onchange = () => {
    const f = inp.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const s = JSON.parse(r.result);
        if (!s || !s.actual || !Array.isArray(s.historial)) throw new Error('formato');
        if (!confirm('Esto reemplazará los datos actuales con los del respaldo. ¿Continuar?')) return;
        S = migrar(s);
        fmtCache = {};
        guardar(); render(); toast('Respaldo cargado ✅');
      } catch (e) { toast('Ese archivo no es un respaldo válido'); }
    };
    r.readAsText(f);
  };
  inp.click();
}

/* ---------------- Eventos ---------------- */

document.querySelector('.tabbar').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  render();
  window.scrollTo(0, 0);
});

$('#view').addEventListener('click', async e => {
  const go = e.target.closest('[data-tabgo]');
  if (go) { tab = go.dataset.tabgo; render(); window.scrollTo(0, 0); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const { act, id } = el.dataset;
  switch (act) {
    case 'editIngreso': return sheetIngreso();
    case 'capital': return sheetCapital();
    case 'bcvRefrescar':
      el.textContent = 'Actualizando…';
      await actualizarBCV(true);
      render();
      return toast(bcvError ? 'Sin conexión, se muestra la última tasa' : 'Tasa actualizada ✅');
    case 'editAhorro': return sheetAhorro();
    case 'nuevoGasto': return sheetGasto(null);
    case 'editGasto': return sheetGasto(id);
    case 'togglePago': {
      const g = S.actual.gastos.find(x => x.id === id);
      if (g) { g.pagado = !g.pagado; guardar(); render(); }
      return;
    }
    case 'cerrar':
      if (!S.actual.ingreso && !S.actual.gastos.length && !S.actual.extras.length) return toast('Primero llena tu quincena');
      return sheetCerrar();
    case 'verQuincena': return sheetVerQuincena(id);
    case 'verMov': return sheetVerMov(id);
    case 'editMeta': return sheetMeta();
    case 'mov': return sheetMov(el.dataset.tipo);
    case 'moneda': return sheetMoneda();
    case 'exportar': return exportar();
    case 'importar': return importar();
    case 'borrarTodo':
      if (confirm('¿Seguro? Se borrarán todas tus quincenas y ahorros. Te recomiendo guardar un respaldo antes.')) {
        S = estadoInicial(); guardar(); tab = 'inicio'; render(); toast('Datos borrados');
      }
      return;
  }
});

// Si la app queda abierta de un día para otro, actualiza los días que faltan
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (!$('#sheet').classList.contains('open')) render();
  actualizarBCV(false);
});

render();
actualizarBCV(false);

// En la app de Android (Capacitor) los archivos ya vienen dentro del APK: no hace falta el service worker
const esApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !esApp) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
