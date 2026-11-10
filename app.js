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

// La quincena en curso es la del último día de cobro (el 15 o fin de mes) que ya llegó
const periodoActual = () => cobroHasta(hoyD());

/* ---------------- Estado ---------------- */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const freqDe = g => g.freq || (g.fijo ? 'quincenal' : 'una');

// prev: la quincena anterior (para copiar gastos fijos y ajustes); cobro: Date del día de cobro que la inicia
function nuevaQuincena(prev, cobro) {
  cobro = cobro || periodoActual();
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
    inicio: ymd(cobro),
    cobro: ymd(cobro),
    // "ingreso" es el dinero que tienes ahora; al empezar, lo que te quedó (sin el ahorro apartado)
    ingreso: prev ? Math.max(0, Math.round((calc(prev).saldo - calc(prev).ahorro) * 100) / 100) : 0,
    nuevoCobro: !!prev,
    extras: [],
    ahorroModo: prev ? prev.ahorroModo : 'monto',
    ahorroValor: prev ? prev.ahorroValor : 0,
    gastos,
    enEspera,
  };
}

function estadoInicial() {
  return {
    v: 4, moneda: 'USD', meta: { nombre: '', monto: 0 }, actual: nuevaQuincena(null), historial: [], movs: [],
    perfil: { nombre: '', preguntado: false },
    notif: { bcv: true, diario: true, hora: '20:00', cobro: true },
  };
}

// Completa datos de versiones anteriores
function migrar(s) {
  const base = estadoInicial();
  s = { ...base, ...s };
  s.perfil = { ...base.perfil, ...(s.perfil || {}) };
  s.notif = { ...base.notif, ...(s.notif || {}) };
  const q = s.actual;
  if (!q.cobro) q.cobro = ymd(cobroPara(parse(q.inicio || today())));
  if (!Array.isArray(q.extras)) q.extras = [];
  if (!Array.isArray(q.enEspera)) q.enEspera = [];
  for (const g of [...q.gastos, ...q.enEspera]) {
    if (!g.freq) g.freq = freqDe(g);
    if (!CAT[g.cat]) g.cat = 'otro';
  }
  if ((s.v || 1) < 4) {
    // Antes "ingreso" era el total de la quincena; ahora es el dinero que tienes.
    // Los gastos ya pagados salen de ese dinero (así lo libre queda igual).
    q.ingreso = (q.ingreso || 0) - q.gastos.filter(g => g.pagado).reduce((a, g) => a + (g.monto || 0), 0);
    // Si se había terminado la quincena antes de tiempo, se vuelve a la del calendario
    const per = periodoActual();
    if (parse(q.cobro) > per) q.cobro = ymd(per);
  }
  s.v = 4;
  return s;
}

// Si ya llegó un día de cobro nuevo, la quincena cambia sola: la anterior se guarda en el historial
function revisarCobro() {
  const per = periodoActual();
  let cambio = false;
  while (parse(S.actual.cobro) < per) {
    const q = S.actual, c = calc(q);
    const sig = cobroDespues(parse(q.cobro));
    S.historial.push({
      id: q.id, inicio: q.inicio, fin: ymd(sig), cobro: q.cobro,
      ingreso: c.ingreso, extra: c.extra, gastos: c.gastos, ahorroPlan: c.ahorro, ahorroReal: c.ahorro,
      detalle: q.gastos.map(g => ({ nombre: g.nombre, monto: g.monto, cat: g.cat, pagado: g.pagado })),
    });
    S.actual = nuevaQuincena(q, sig);
    cambio = true;
  }
  if (cambio) guardar();
  return cambio;
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
revisarCobro();
const TABS = ['inicio', 'calc', 'ajustes'];
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

// saldo  = el dinero que tienes ahora (lo que pagas ya salió de aquí)
// ingreso = saldo + lo ya pagado (el total con el que contabas en la quincena)
// libre  = saldo − ahorro − lo que falta por pagar
function calc(q) {
  const base = q.ingreso || 0;
  const extra = (q.extras || []).reduce((a, x) => a + (x.monto || 0), 0);
  const saldo = base + extra;
  const gastos = q.gastos.reduce((a, g) => a + (g.monto || 0), 0);
  const pagado = q.gastos.filter(g => g.pagado).reduce((a, g) => a + (g.monto || 0), 0);
  const pendiente = gastos - pagado;
  const ingreso = saldo + pagado;
  const ahorro = q.ahorroModo === 'pct' ? Math.round(ingreso * (q.ahorroValor || 0)) / 100 : (q.ahorroValor || 0);
  const libre = saldo - ahorro - pendiente;
  return { base, extra, saldo, ingreso, ahorro, gastos, pagado, pendiente, libre };
}

// Días que faltan para el próximo cobro (15 o fin de mes), contando hoy y el día de cobro
function diasParaCobrar() {
  const hoy = hoyD();
  const hasta = cobroDespues(hoy);
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

/* ---------------- Tasas: BCV y USDT ---------------- */
// BCV: en la app de Android se lee directo de bcv.org.ve (fuente oficial).
//      Si falla, o en la versión web, se usa DolarApi Venezuela como respaldo.
// USDT: promedio de los primeros 10 anuncios de Binance P2P (solo en la app de Android).

const esApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const BCV_KEY = 'mi-ahorro-bcv';
const USDT_KEY = 'mi-ahorro-usdt';
const BCV_OFICIAL = 'https://www.bcv.org.ve/';
const BCV_RESPALDO = 'https://ve.dolarapi.com/v1/cotizaciones';
const P2P_URL = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
const leerLS = k => { try { return JSON.parse(localStorage.getItem(k)) || null; } catch (e) { return null; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* nada */ } };

let BCV = leerLS(BCV_KEY);
let USDT = leerLS(USDT_KEY);
let bcvCargando = false, bcvError = false, usdtError = false;

const bs = n => new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const numVE = s => parseFloat(String(s).trim().replace(/\./g, '').replace(',', '.'));

async function bcvDesdeOficial() {
  const res = await fetch(BCV_OFICIAL, { cache: 'no-store' });
  if (!res.ok) throw new Error(res.status);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const val = id => { const s = doc.querySelector(`#${id} strong`); return s ? numVE(s.textContent) : 0; };
  const usd = val('dolar'), eur = val('euro');
  const f = doc.querySelector('[property="dc:date"]');
  if (!(usd > 0 && eur > 0)) throw new Error('sin datos');
  return { usd, eur, fecha: f ? String(f.getAttribute('content')).slice(0, 10) : '', fuente: 'bcv' };
}

async function bcvDesdeRespaldo() {
  const res = await fetch(BCV_RESPALDO, { cache: 'no-store' });
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  const of = m => data.find(x => x.moneda === m && x.fuente === 'oficial');
  const usd = of('USD'), eur = of('EUR');
  if (!usd || !eur) throw new Error('sin datos');
  return { usd: usd.promedio, eur: eur.promedio, fecha: String(usd.fechaActualizacion || '').slice(0, 10), fuente: 'dolarapi' };
}

async function usdtDesdeBinance() {
  const pedir = async tradeType => {
    const res = await fetch(P2P_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset: 'USDT', fiat: 'VES', tradeType, page: 1, rows: 10, payTypes: [], publisherType: null }),
    });
    const j = await res.json();
    const p = (j.data || []).map(x => +x.adv.price).filter(x => x > 0);
    if (!p.length) throw new Error('sin anuncios');
    return p.reduce((a, b) => a + b, 0) / p.length;
  };
  const [compra, venta] = await Promise.all([pedir('BUY'), pedir('SELL')]);
  return { compra, venta, promedio: (compra + venta) / 2, obtenido: Date.now() };
}

async function actualizarBCV(forzar) {
  if (bcvCargando) return;
  if (!forzar && BCV && Date.now() - BCV.obtenido < 30 * 60 * 1000) return; // máximo cada 30 minutos
  bcvCargando = true;

  let nuevo = null;
  if (esApp) { try { nuevo = await bcvDesdeOficial(); } catch (e) { /* probar respaldo */ } }
  if (!nuevo) { try { nuevo = await bcvDesdeRespaldo(); } catch (e) { /* sin conexión */ } }

  if (nuevo) {
    const cambio = !BCV || BCV.usd !== nuevo.usd || BCV.eur !== nuevo.eur || BCV.fecha !== nuevo.fecha;
    BCV = { ...nuevo, obtenido: Date.now(), detectado: cambio ? Date.now() : (BCV.detectado || BCV.obtenido) };
    bcvError = false;
    guardarLS(BCV_KEY, BCV);
  } else {
    bcvError = true;
  }

  if (esApp) {
    try { USDT = await usdtDesdeBinance(); usdtError = false; guardarLS(USDT_KEY, USDT); }
    catch (e) { usdtError = true; }
  }

  bcvCargando = false;
  if ((tab === 'inicio' || tab === 'calc') && !$('#sheet').classList.contains('open')) render();
}

function fechaBCV(larga) {
  if (!BCV || !BCV.fecha) return '';
  const f = parse(BCV.fecha);
  return larga ? `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}` : `${DIAS[f.getDay()].slice(0, 3)} ${diaMes(f)}`;
}
// "hoy, 1:12 p. m." / "ayer, 4:05 p. m." / "lunes 9 nov, 4:05 p. m."
function cuandoFue(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  const hora = d.toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit' });
  const dias = dayDiff(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12), hoyD());
  const dia = dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `${DIAS[d.getDay()]} ${diaMes(d)}`;
  return `${dia}, ${hora}`;
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
const DIVISAS = {
  USD: { s: '$', n: 'Dólares', b: '🇺🇸 Dólar' },
  EUR: { s: '€', n: 'Euros', b: '🇪🇺 Euro' },
  USDT: { s: '₮', n: 'USDT', b: '🪙 USDT' },
};
const tasaDe = d => (d === 'USDT' ? (USDT ? USDT.promedio : 0) : BCV ? (d === 'USD' ? BCV.usd : BCV.eur) : 0);
const simb = d => DIVISAS[d].s;
const fmtIn = n => (n ? String(Math.round(n * 100) / 100) : '');

const IG_BCV = 'https://www.instagram.com/bcv.org.ve/';

function vistaCalc() {
  if (CALC.div === 'USDT' && !USDT) CALC.div = 'USD';

  const bcvHtml = BCV
    ? `<div class="rates">
        <div class="card"><div class="rk"><span class="dot" style="background:#22c55e"></span>Dólar BCV</div><div class="rv">Bs. ${bs(BCV.usd)}</div><div class="rf">por 1 USD</div></div>
        <div class="card"><div class="rk"><span class="dot" style="background:#3b82f6"></span>Euro BCV</div><div class="rv">Bs. ${bs(BCV.eur)}</div><div class="rf">por 1 EUR</div></div>
      </div>`
    : `<div class="card"><div class="empty"><div class="e">📡</div>${bcvError ? 'No hay conexión para buscar la tasa.<br>Conéctate a internet e intenta de nuevo.' : 'Buscando la tasa del BCV…'}</div></div>`;

  const usdtHtml = USDT
    ? `<div class="card usdt">
        <div class="card-h"><h2>🪙 USDT (P2P)</h2><span class="m">${cuandoFue(USDT.obtenido)}${usdtError ? ' · ⚠️' : ''}</span></div>
        <div class="u3">
          <div><span>Para comprar</span><b>Bs. ${bs(USDT.compra)}</b></div>
          <div><span>Para vender</span><b>Bs. ${bs(USDT.venta)}</b></div>
          <div><span>Promedio</span><b class="pos">Bs. ${bs(USDT.promedio)}</b></div>
        </div>
        ${BCV ? `<div class="uf">El USDT está ${bs(((USDT.promedio / BCV.usd) - 1) * 100)}% por encima del dólar BCV</div>` : ''}
      </div>`
    : esApp
      ? `<div class="card usdt"><div class="uf" style="margin:0">🪙 USDT: ${usdtError ? 'no se pudo obtener el precio. Intenta actualizar.' : 'buscando precio…'}</div></div>`
      : `<div class="card usdt"><div class="uf" style="margin:0">🪙 El precio del USDT está disponible en la app de Android.</div></div>`;

  // Información de la tasa: va al final, debajo de "Actualizar tasas"
  const infoHtml = BCV
    ? `<div class="card upd">
        <div class="ur"><span>📅 Fecha valor del BCV</span><b>${fechaBCV(true)}</b></div>
        <div class="ur"><span>🕒 Última actualización del precio</span><b>${cuandoFue(BCV.detectado || BCV.obtenido)}</b></div>
        <div class="ur"><span>🔄 Última revisión</span><b>${cuandoFue(BCV.obtenido)}${bcvError ? ' · ⚠️ sin conexión' : ''}</b></div>
        <a class="ig" href="${IG_BCV}" target="_blank" rel="noopener">
          <span>¿Quieres confirmarlo? Consulta el Instagram del BCV aquí</span><b>@bcv.org.ve ›</b>
        </a>
      </div>`
    : `<a class="card ig solo" href="${IG_BCV}" target="_blank" rel="noopener">
        <span>Consulta la tasa en el Instagram del BCV</span><b>@bcv.org.ve ›</b></a>`;

  const d = DIVISAS[CALC.div];
  return `
    <header class="top"><div><h1>Calculadora</h1><div class="sub">Bolívares ↔ dólares, euros y USDT</div></div></header>
    ${bcvHtml}
    ${usdtHtml}
    <div class="card conv">
      <div class="seg" id="cDiv" style="margin-bottom:14px">
        ${Object.entries(DIVISAS).map(([k, x]) => `<button data-d="${k}" ${k === 'USDT' && !USDT ? 'disabled style="opacity:.4"' : ''}>${x.b}</button>`).join('')}
      </div>
      <div class="cf"><div class="cl"><span>${d.n}</span><span>${CALC.div === 'USDT' ? 'promedio P2P' : 'tasa BCV'}</span></div>
        <div class="ci"><span>${d.s}</span><input id="cExt" inputmode="decimal" autocomplete="off" placeholder="0" value="${CALC.ext}"></div></div>
      <div class="swap" aria-hidden="true">⇅</div>
      <div class="cf"><div class="cl"><span>Bolívares</span><span>VES</span></div>
        <div class="ci"><span>Bs.</span><input id="cVes" inputmode="decimal" autocomplete="off" placeholder="0" value="${CALC.ves}"></div></div>
      <div class="chips" style="margin-top:14px">${[1, 5, 10, 20, 50, 100].map(m => `<button class="chip" data-q="${m}">${d.s}${m}</button>`).join('')}<button class="chip" id="cClr">Borrar</button></div>
    </div>
    <button class="btn soft mt" data-act="bcvRefrescar">🔄 Actualizar tasas</button>
    ${infoHtml}
  `;
}

function montarCalc() {
  const v = $('#view');
  const ext = $('#cExt', v), ves = $('#cVes', v);
  if (!ext) return;
  v.querySelectorAll('#cDiv button').forEach(b => b.classList.toggle('on', b.dataset.d === CALC.div));
  const t = () => tasaDe(CALC.div);
  const desdeExt = () => { CALC.ext = ext.value; CALC.ultimo = 'ext'; CALC.ves = t() ? fmtIn(num(ext.value) * t()) : ''; ves.value = CALC.ves; };
  const desdeVes = () => { CALC.ves = ves.value; CALC.ultimo = 'ves'; CALC.ext = t() ? fmtIn(num(ves.value) / t()) : ''; ext.value = CALC.ext; };
  ext.oninput = desdeExt;
  ves.oninput = desdeVes;
  v.querySelectorAll('#cDiv button').forEach(b => b.onclick = () => {
    if (b.disabled) return;
    CALC.div = b.dataset.d;
    // recalcula a partir del último campo que escribiste
    if (CALC.ultimo === 'ves') { CALC.ext = t() ? fmtIn(num(CALC.ves) / t()) : ''; }
    else { CALC.ves = t() ? fmtIn(num(CALC.ext) * t()) : ''; }
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

// Etiqueta "↑ 12% vs ..." — en gastos subir es malo (rojo); en ahorro subir es bueno (verde)
function chipVs(actual, antes, etiqueta, subirEsBueno = false) {
  if (!antes || antes <= 0 || actual == null) return '';
  const pct = Math.round(((actual - antes) / antes) * 100);
  if (!isFinite(pct)) return '';
  const sube = pct > 0;
  const clase = pct === 0 ? '' : (sube === subirEsBueno ? 'good' : 'bad');
  const flecha = pct === 0 ? '＝' : sube ? '↑' : '↓';
  return `<span class="vs ${clase}">${flecha} ${Math.abs(pct)}%</span><span class="vs-l">${etiqueta}</span>`;
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
  const ant = meses[4];
  return `<div class="card">
    <div class="card-h"><h2>Gasto por mes</h2><span class="r">${money(tot[kAct])}</span></div>
    <div class="m" style="color:var(--muted);font-size:12.5px;margin-top:-8px">Total de ${nombreMes}, sumando sus dos quincenas</div>
    ${ant.v ? `<div class="vs-row">${chipVs(tot[kAct], ant.v, `vs ${MESES[(m + 10) % 12]} · ${nombreMes} va en curso`)}</div>` : ''}
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
  const { hasta, dias } = diasParaCobrar();
  const cuando = `${DIAS[hasta.getDay()]} ${diaMes(hasta)}`;
  if (!c.saldo && !c.pendiente) return '';

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
  const { hasta } = diasParaCobrar();

  const avisoCobro = q.nuevoCobro
    ? `<div class="card cobro-new">
        <div class="cn-t">🎉 ¡Empezó tu ${etiquetaCobro(q.cobro).toLowerCase()}!</div>
        <div class="cn-s">Agrega lo que cobraste para recalcular cuánto puedes gastar al día.</div>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn" data-act="cobre">＋ Agregar lo que cobré</button>
          <button class="btn soft" data-act="cobroOk" style="flex:0 0 auto;width:auto;padding:15px 18px">Listo</button>
        </div>
      </div>`
    : '';

  const gastosHtml = q.gastos.length
    ? `<div class="list">${q.gastos.map(g => filaGasto(g, false)).join('')}</div>`
    : `<div class="list"><div class="empty"><div class="e">🧾</div>Toca el botón <b>+</b> para agregar lo que tienes que pagar esta quincena: comida, albañil, renta…</div></div>`;

  const esperaHtml = q.enEspera.length
    ? `<div class="sec-h"><h2 style="font-size:15px">Mensuales de la otra quincena</h2><span class="meta">no cuentan ahora</span></div>
       <div class="list">${q.enEspera.map(g => filaGasto(g, true)).join('')}</div>`
    : '';

  const prev = S.historial[S.historial.length - 1];
  const vsQ = prev && c.gastos ? chipVs(c.gastos, prev.gastos, 'en gastos vs la quincena pasada') : '';

  return `
    <header class="top">
      <button class="hello" data-act="nombre">
        <h1>Hola${S.perfil.nombre ? `, ${esc(S.perfil.nombre)}` : ''} 👋</h1>
        <div class="sub">Así va tu quincena · cobras el ${DIAS[hasta.getDay()]} ${diaMes(hasta)}</div>
      </button>
      <button class="bell" data-act="notif" aria-label="Notificaciones">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
        ${S.notif.bcv || S.notif.diario || S.notif.cobro ? '<span class="bell-dot"></span>' : ''}
      </button>
    </header>

    ${avisoCobro}
    ${tarjetaBCV()}

    <section class="hero">
      <div class="label">Tu dinero ahora · ${etiquetaCobro(q.cobro).toLowerCase()}</div>
      <div class="big" data-count="${c.saldo}">${money(c.saldo)}</div>
      ${c.extra ? `<div class="hero-note">Incluye ${money(c.extra)} de capital agregado</div>` : ''}
      ${vsQ ? `<div class="vs-row">${vsQ}</div>` : ''}
      <div class="hero-btns">
        <button class="pill" data-act="editIngreso">✏️ ${c.saldo || c.pagado ? 'Actualizar' : 'Poner cuánto tengo'}</button>
        <button class="pill green" data-act="capital">＋ Agregar capital</button>
      </div>
      <div class="hero-split">
        <button data-act="editAhorro" style="text-align:left"><div class="k"><span class="dot" style="background:#3b82f6"></span>Ahorro</div><div class="v">${money(c.ahorro)}</div></button>
        <div><div class="k"><span class="dot" style="background:#f87171"></span>Por pagar</div><div class="v">${money(c.pendiente)}</div></div>
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

    <button class="fab" data-act="nuevoGasto" aria-label="Agregar gasto">+</button>
  `;
}

function sparkline(vals) {
  const W = 300, H = 56, min = Math.min(...vals), max = Math.max(...vals), r = max - min || 1;
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * W, H - 6 - ((v - min) / r) * (H - 12)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="spg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#34d399" stop-opacity=".35"/><stop offset="1" stop-color="#34d399" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L${W},${H} L0,${H} Z" fill="url(#spg)"/>
    <path class="spark-line" d="${d}" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="#34d399"/>
  </svg>`;
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

  // Línea de cómo ha crecido el ahorro (acumulado)
  const pasos = [
    ...S.historial.map(h => ({ f: h.fin, v: h.ahorroReal || 0 })),
    ...S.movs.map(m => ({ f: m.fecha, v: m.monto || 0 })),
  ].sort((a, b) => (a.f > b.f ? 1 : a.f < b.f ? -1 : 0));
  let acum = 0;
  const serie = [0, ...pasos.map(p => (acum += p.v))].slice(-12);
  const ult = S.historial[S.historial.length - 1], penult = S.historial[S.historial.length - 2];
  const vsAh = ult && penult ? chipVs(ult.ahorroReal, penult.ahorroReal, 'ahorraste vs la quincena anterior', true) : '';

  return `
    <header class="top"><div><h1>Mis ahorros</h1><div class="sub">Todo lo que has juntado</div></div></header>

    <section class="hero">
      <div class="label">Llevo ahorrado</div>
      <div class="big" data-count="${total}">${money(total)}</div>
      ${vsAh ? `<div class="vs-row">${vsAh}</div>` : ''}
      ${serie.length > 2 ? sparkline(serie) : ''}
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
      <button class="row" data-act="nombre"><span class="ico">👋</span><span class="main"><div class="t">Tu nombre</div><div class="s">${S.perfil.nombre ? esc(S.perfil.nombre) : 'Para saludarte en el inicio'}</div></span><span>›</span></button>
      <button class="row" data-act="notif"><span class="ico">🔔</span><span class="main"><div class="t">Notificaciones</div><div class="s">${[S.notif.bcv && 'tasa BCV', S.notif.diario && `recordatorio ${S.notif.hora}`, S.notif.cobro && 'día de cobro'].filter(Boolean).join(' · ') || 'Apagadas'}</div></span><span>›</span></button>
      <button class="row" data-act="moneda"><span class="ico">💱</span><span class="main"><div class="t">Moneda</div><div class="s">${mon ? mon[1] : S.moneda} (${S.moneda})</div></span><span>›</span></button>
      <button class="row" data-act="exportar"><span class="ico">📤</span><span class="main"><div class="t">Guardar respaldo</div><div class="s">Descarga un archivo con todos tus datos</div></span><span>›</span></button>
      <button class="row" data-act="importar"><span class="ico">📥</span><span class="main"><div class="t">Cargar respaldo</div><div class="s">Recupera tus datos desde un archivo</div></span><span>›</span></button>
      <button class="row" data-act="borrarTodo"><span class="ico">🗑️</span><span class="main"><div class="t" style="color:var(--danger)">Borrar todo</div><div class="s">Empezar de cero</div></span><span>›</span></button>
    </div>
    ${typeof ADS !== 'undefined' ? ADS.tarjetaAjustes() : ''}
    <div class="card" style="font-size:14px;color:var(--muted);line-height:1.55">
      💡 <b style="color:var(--text)">Cómo funciona:</b> pon cuánto dinero tienes ahora, cuánto quieres ahorrar y lo que tienes que pagar.
      La app te dice cuánto te queda libre y <b>cuánto puedes gastar al día</b> hasta tu próximo cobro (el 15 y el último día de cada mes, contando hoy).<br><br>
      Si te entra dinero extra, usa <b>“Agregar capital”</b>. Los gastos <b>quincenales</b> se copian a cada quincena y los <b>mensuales</b> solo a la quincena con la que los pagas.
      Cuando marcas un gasto como pagado, se descuenta solo de tu dinero. Actualiza tu dinero cuando quieras.
      Al llegar el día de cobro, la quincena nueva empieza sola y la anterior queda guardada con su ahorro.
    </div>
    <input type="file" id="fileImport" accept="application/json,.json" hidden>
    <a class="card ig solo" href="${IG_BCV}" target="_blank" rel="noopener">
      <span>💱 Consulta la tasa en el Instagram del BCV</span><b>@bcv.org.ve ›</b></a>
    <div class="foot">Mi Ahorro · v2.3</div>
  `;
}

/* ---------------- Animaciones ---------------- */
const sinMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Cuenta el número desde 0 hasta su valor (solo al entrar a la pestaña)
function contar(el) {
  const fin = +el.dataset.count;
  if (!fin || sinMovimiento) return;
  const t0 = performance.now(), dur = 650;
  const paso = t => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = money(Math.round(fin * e));
    if (p < 1) requestAnimationFrame(paso); else el.textContent = money(fin);
  };
  requestAnimationFrame(paso);
}

let tabAnterior = null;
function render(animar) {
  const v = $('#view');
  if (animar === undefined) animar = tab !== tabAnterior;
  tabAnterior = tab;
  v.innerHTML = tab === 'inicio' ? vistaInicio() : tab === 'calc' ? vistaCalc() : tab === 'ahorros' ? vistaAhorros() : vistaAjustes();
  if (tab === 'calc') montarCalc();
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (typeof ADS !== 'undefined') ADS.sync();
  v.classList.remove('enter');
  if (animar && !sinMovimiento) {
    [...v.children].forEach((el, i) => el.style.setProperty('--i', Math.min(i, 9)));
    void v.offsetWidth; // reinicia la animación
    v.classList.add('enter');
    v.querySelectorAll('[data-count]').forEach(contar);
  }
}

/* ---------------- Hoja inferior (bottom sheet) ---------------- */

function openSheet(html, mount) {
  $('#sheetBody').innerHTML = html;
  $('#scrim').classList.add('open');
  $('#sheet').classList.add('open');
  $('#sheet').scrollTop = 0;
  if (mount) mount($('#sheetBody'));
  history.pushState({ sheet: true }, '');
  if (typeof ADS !== 'undefined') ADS.sync();
}
function closeSheet(fromPop) {
  if (!$('#sheet').classList.contains('open')) return;
  $('#scrim').classList.remove('open');
  $('#sheet').classList.remove('open');
  document.activeElement && document.activeElement.blur();
  if (typeof ADS !== 'undefined') ADS.sync();
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
    <h3>¿Cuánto dinero tienes ahora?</h3>
    <p class="hint">Lo que tienes en este momento (efectivo, banco, todo junto). Actualízalo cuando quieras: la app recalcula cuánto puedes gastar al día.</p>
    ${moneyField('fIngreso', Math.round(c.saldo * 100) / 100, 'Tu dinero ahora')}
    <button class="btn mt" id="ok">Guardar</button>`,
    b => {
      const inp = $('#fIngreso', b);
      focusLater(inp);
      const save = () => {
        // el número que escribes es el dinero real: incluye el capital que habías agregado
        S.actual.ingreso = num(inp.value);
        S.actual.extras = [];
        S.actual.nuevoCobro = false;
        guardar(); closeSheet(); render(); toast('Dinero actualizado');
      };
      $('#ok', b).onclick = save;
      inp.onkeydown = e => { if (e.key === 'Enter') save(); };
    });
}

/* ---- Agregar capital ---- */
function sheetCapital(esCobro) {
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
    <h3>${esCobro ? '¿Cuánto cobraste?' : 'Agregar capital'}</h3>
    <p class="hint">${esCobro ? 'Se suma a lo que te quedó de la quincena pasada.' : 'Dinero extra que te entró en esta quincena. Se suma a lo que tienes para gastar y ahorrar.'}</p>
    ${moneyField('fCap', '', 'Cantidad')}
    ${chipsSuma('capChips', CAPITAL_RAPIDO)}
    <div class="field"><label for="fCapN">Nota (opcional)</label>
      <input class="input" id="fCapN" maxlength="40" placeholder="Ej. Trabajo extra, venta…" value="${esCobro ? 'Cobro de quincena' : ''}"></div>
    <button class="btn mt" id="ok">Agregar a la quincena</button>
    <div id="extrasBox">${listaExtras()}</div>`,
    b => {
      const inp = $('#fCap', b);
      conectarChipsSuma(b, 'capChips', inp);
      $('#ok', b).onclick = () => {
        const v = num(inp.value);
        if (v <= 0) { toast('Pon una cantidad'); return; }
        q.extras.push({ id: uid(), monto: v, nota: $('#fCapN', b).value.trim(), fecha: today() });
        q.nuevoCobro = false;
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
        const libre = base.saldo - ah - base.pendiente;
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
        // si ya estaba pagado y cambió el monto, la diferencia sale (o vuelve) a tu dinero
        if (obj.pagado) q.ingreso = (q.ingreso || 0) - (monto - (obj.monto || 0));
        Object.assign(obj, datos);
        const espera = freq === 'mensual' && mitad !== tipoActual;
        const enGastos = q.gastos.includes(obj);
        const enEspera = q.enEspera.includes(obj);
        if (espera && !enEspera) {
          q.gastos = q.gastos.filter(x => x !== obj);
          if (obj.pagado) q.ingreso += obj.monto; // deja de contar como pagado en esta quincena
          obj.pagado = false; q.enEspera.push(obj);
        }
        if (!espera && !enGastos) { q.enEspera = q.enEspera.filter(x => x !== obj); q.gastos.push(obj); }
        guardar(); closeSheet(); render();
        toast(espera ? `Guardado para ${nombreMitad(mitad)}` : g ? 'Gasto actualizado' : 'Gasto agregado');
        if (!g && typeof ADS !== 'undefined') ADS.trasAccion();
      };
      if (g) $('#del', b).onclick = () => {
        if (g.pagado && q.gastos.includes(g)) q.ingreso = (q.ingreso || 0) + (g.monto || 0); // se deshace el pago
        q.gastos = q.gastos.filter(x => x.id !== g.id);
        q.enEspera = q.enEspera.filter(x => x.id !== g.id);
        guardar(); closeSheet(); render(); toast('Gasto eliminado');
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

/* ---- Nombre ---- */
function sheetNombre() {
  S.perfil.preguntado = true;
  guardar();
  openSheet(`
    <h3>¿Cómo te llamas? 👋</h3>
    <p class="hint">Para saludarte cuando abras la app.</p>
    <div class="field"><input class="input" id="fNombre" maxlength="24" placeholder="Tu nombre" value="${esc(S.perfil.nombre)}" autocomplete="given-name"></div>
    <button class="btn mt" id="ok">Guardar</button>
    <button class="btn ghost" id="skip" style="margin-top:6px">Ahora no</button>`,
    b => {
      const inp = $('#fNombre', b);
      focusLater(inp);
      const save = () => { S.perfil.nombre = inp.value.trim(); guardar(); closeSheet(); render(); };
      $('#ok', b).onclick = save;
      inp.onkeydown = e => { if (e.key === 'Enter') save(); };
      $('#skip', b).onclick = () => closeSheet();
    });
}

/* ---- Notificaciones ---- */
const plugin = n => (esApp && window.Capacitor && typeof Capacitor.registerPlugin === 'function' ? Capacitor.registerPlugin(n) : null);
const LN = plugin('LocalNotifications');
const PREF = plugin('Preferences');

async function permisoNotif(pedir) {
  if (!LN) return false;
  try {
    let p = await LN.checkPermissions();
    if (p.display !== 'granted' && pedir) p = await LN.requestPermissions();
    return p.display === 'granted';
  } catch (e) { return false; }
}

// Programa (o borra) los recordatorios según los ajustes. Se llama al abrir la app y al guardar.
async function syncNotificaciones() {
  if (!LN) return;
  try {
    if (PREF) await PREF.set({ key: 'notif_bcv', value: S.notif.bcv ? '1' : '0' }); // lo lee el aviso nativo de la tasa
    await LN.createChannel({ id: 'recordatorios', name: 'Recordatorios', description: 'Recordatorio diario y día de cobro', importance: 4 });
    const pend = await LN.getPending();
    if (pend.notifications && pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });

    const lista = [];
    if (S.notif.diario) {
      const [h, m] = String(S.notif.hora || '20:00').split(':').map(Number);
      lista.push({
        id: 1, channelId: 'recordatorios',
        title: 'El día casi termina ✍️',
        body: 'Actualiza tus números: anota lo que gastaste hoy en Mi Ahorro.',
        schedule: { on: { hour: h, minute: m }, allowWhileIdle: true },
      });
    }
    if (S.notif.cobro) {
      // los próximos 6 días de cobro, a las 9:00 a. m.
      let d = hoyD();
      for (let i = 0; i < 6; i++) {
        d = cobroDesde(d);
        const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0);
        if (at > new Date()) {
          lista.push({
            id: 100 + i, channelId: 'recordatorios',
            title: '¡Hoy cobras! 💰',
            body: 'Termina tu quincena en Mi Ahorro y aparta tu ahorro primero.',
            schedule: { at, allowWhileIdle: true },
          });
        }
        d = addDays(d, 1);
      }
    }
    if (lista.length) await LN.schedule({ notifications: lista });
  } catch (e) { console.warn('notificaciones', e); }
}

function sheetNotif() {
  const n = { ...S.notif };
  const fila = (k, ico, t, s) => `<div class="switch"><div><div class="st">${ico} ${t}</div><div class="ss">${s}</div></div>
    <button class="tg ${n[k] ? 'on' : ''}" data-k="${k}" aria-label="${t}"></button></div>`;
  openSheet(`
    <h3>Notificaciones</h3>
    <p class="hint">${esApp ? 'Elige qué avisos quieres recibir.' : '⚠️ Las notificaciones solo funcionan en la app de Android.'}</p>
    <div class="summary">
      ${fila('bcv', '💱', 'Tasa BCV actualizada', '“Hemos actualizado la tasa BCV” cuando el BCV publique una nueva')}
      ${fila('diario', '✍️', 'Recordatorio del día', '“El día casi termina, actualiza tus números”')}
      <div class="switch" id="horaBox"><div class="st" style="color:var(--muted)">⏰ Hora del recordatorio</div>
        <input type="time" class="input time" id="fHora" value="${n.hora}"></div>
      ${fila('cobro', '💰', 'Día de cobro', 'El 15 y fin de mes, a las 9:00 a. m.')}
    </div>
    <button class="btn mt" id="ok">Guardar</button>
    ${esApp ? '<button class="btn soft" id="test" style="margin-top:10px">Probar una notificación</button>' : ''}`,
    b => {
      const horaBox = $('#horaBox', b);
      const pintar = () => { horaBox.style.display = n.diario ? '' : 'none'; };
      b.querySelectorAll('.tg').forEach(t => t.onclick = () => { n[t.dataset.k] = !n[t.dataset.k]; t.classList.toggle('on', n[t.dataset.k]); pintar(); });
      pintar();
      $('#ok', b).onclick = async () => {
        n.hora = $('#fHora', b).value || '20:00';
        S.notif = n; guardar(); closeSheet(); render();
        if (esApp && (n.bcv || n.diario || n.cobro) && !(await permisoNotif(true))) {
          toast('Activa las notificaciones de Mi Ahorro en los ajustes del teléfono');
        } else toast('Notificaciones guardadas 🔔');
        syncNotificaciones();
      };
      const t = $('#test', b);
      if (t) t.onclick = async () => {
        if (!(await permisoNotif(true))) return toast('Activa las notificaciones en los ajustes del teléfono');
        await LN.createChannel({ id: 'recordatorios', name: 'Recordatorios', importance: 4 });
        await LN.schedule({ notifications: [{ id: 999, channelId: 'recordatorios', title: 'Así se verán tus avisos 🔔', body: 'El día casi termina, actualiza tus números ✍️', schedule: { at: new Date(Date.now() + 3000) } }] });
        toast('Llegará en 3 segundos…');
      };
    });
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
    case 'nombre': return sheetNombre();
    case 'notif': return sheetNotif();
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
      if (g) {
        g.pagado = !g.pagado;
        // lo que pagas sale de tu dinero (y vuelve si lo desmarcas)
        S.actual.ingreso = Math.round(((S.actual.ingreso || 0) + (g.pagado ? -1 : 1) * (g.monto || 0)) * 100) / 100;
        guardar(); render(false);
        const ch = $(`.check[data-id="${id}"]`);
        if (ch && g.pagado) ch.classList.add('pop');
      }
      return;
    }
    case 'cobre': return sheetCapital(true);
    case 'adsPremio': return ADS.verPremio();
    case 'adsPrivacidad': return ADS.privacidadForm();
    case 'cobroOk': S.actual.nuevoCobro = false; guardar(); return render();
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
  const cambio = revisarCobro();
  if (cambio || !$('#sheet').classList.contains('open')) { if (cambio) closeSheet(); render(); }
  actualizarBCV(false);
});

render(true);
actualizarBCV(false);
syncNotificaciones();
// La primera vez: preguntar el nombre
if (!S.perfil.preguntado) setTimeout(sheetNombre, 700);

if ('serviceWorker' in navigator && location.protocol !== 'file:' && !esApp) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
