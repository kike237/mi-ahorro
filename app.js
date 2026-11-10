'use strict';

/* =========================================================
   Mi Ahorro — planea tu quincena
   Datos guardados en el teléfono (localStorage).
   ========================================================= */

const STORE_KEY = 'mi-ahorro-v1';

const CATS = [
  ['comida', '🍽️', 'Comida'],
  ['casa', '🏠', 'Casa / Renta'],
  ['obra', '👷', 'Albañil / Obra'],
  ['telefono', '📱', 'Teléfono / Internet'],
  ['deudas', '💳', 'Deudas'],
  ['gustos', '🎉', 'Gustos'],
  ['otro', '📦', 'Otro'],
];
const MONTOS_RAPIDOS = [10, 20, 50, 100, 200];
const CAT = Object.fromEntries(CATS.map(([id, e, n]) => [id, { e, n }]));

const MONEDAS = [
  ['MXN', 'Peso mexicano'], ['USD', 'Dólar'], ['COP', 'Peso colombiano'], ['ARS', 'Peso argentino'],
  ['CLP', 'Peso chileno'], ['PEN', 'Sol peruano'], ['GTQ', 'Quetzal'], ['DOP', 'Peso dominicano'], ['EUR', 'Euro'],
];

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/* ---------------- Estado ---------------- */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);

function nuevaQuincena(prev) {
  return {
    id: uid(),
    inicio: today(),
    ingreso: prev ? prev.ingreso : 0,
    ahorroModo: prev ? prev.ahorroModo : 'monto',
    ahorroValor: prev ? prev.ahorroValor : 0,
    gastos: prev
      ? prev.gastos.filter(g => g.fijo).map(g => ({ ...g, id: uid(), pagado: false }))
      : [],
  };
}

function estadoInicial() {
  return { v: 1, moneda: 'MXN', meta: { nombre: '', monto: 0 }, actual: nuevaQuincena(null), historial: [], movs: [] };
}

function cargar() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.actual) return { ...estadoInicial(), ...s };
    }
  } catch (e) { /* sin almacenamiento disponible */ }
  return estadoInicial();
}

let S = cargar();
let tab = ['quincena', 'ahorros', 'ajustes'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'quincena';

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

function etiquetaQuincena(fechaISO) {
  const d = new Date(fechaISO + 'T12:00:00');
  const q = d.getDate() <= 15 ? '1ª' : '2ª';
  return `${q} quincena de ${MESES[d.getMonth()]}`;
}
function fechaCorta(fechaISO) {
  const d = new Date(fechaISO + 'T12:00:00');
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

function calc(q) {
  const ingreso = q.ingreso || 0;
  const ahorro = q.ahorroModo === 'pct' ? Math.round(ingreso * (q.ahorroValor || 0)) / 100 : (q.ahorroValor || 0);
  const gastos = q.gastos.reduce((a, g) => a + (g.monto || 0), 0);
  const pagado = q.gastos.filter(g => g.pagado).reduce((a, g) => a + (g.monto || 0), 0);
  const libre = ingreso - ahorro - gastos;
  return { ingreso, ahorro, gastos, pagado, pendiente: gastos - pagado, libre };
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
  toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------------- Vistas ---------------- */

function donut(c) {
  const segs = [
    [c.ahorro, '#ffffff'],
    [c.gastos, '#fcd34d'],
    [Math.max(c.libre, 0), 'rgba(255,255,255,.35)'],
  ];
  const total = Math.max(c.ingreso, c.ahorro + c.gastos);
  const R = 42, C = 2 * Math.PI * R;
  let off = 0, arcs = '';
  if (total > 0) {
    for (const [v, col] of segs) {
      if (v <= 0) continue;
      const len = (v / total) * C;
      arcs += `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${col}" stroke-width="14"
        stroke-dasharray="${Math.max(len - 1.5, 0.5)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)" stroke-linecap="butt"/>`;
      off += len;
    }
  }
  const pct = c.ingreso > 0 ? Math.round((c.ahorro / c.ingreso) * 100) : 0;
  return `<svg class="donut" viewBox="0 0 120 120" aria-hidden="true">
    <circle r="${R}" cx="60" cy="60" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="14"/>
    ${arcs}
    <text x="60" y="56" text-anchor="middle" class="center-t">ahorras</text>
    <text x="60" y="74" text-anchor="middle" class="center-v">${pct}%</text>
  </svg>`;
}

function vistaQuincena() {
  const q = S.actual;
  const c = calc(q);
  const sinIngreso = !c.ingreso;

  const gastosHtml = q.gastos.length
    ? `<div class="list">${q.gastos.map(g => {
        const cat = CAT[g.cat] || CAT.otro;
        return `<div class="row ${g.pagado ? 'paid' : ''}">
          <button class="ico" data-act="editGasto" data-id="${g.id}">${cat.e}</button>
          <button class="main" data-act="editGasto" data-id="${g.id}" style="text-align:left">
            <div class="t">${esc(g.nombre)}${g.fijo ? '<span class="tag">fijo</span>' : ''}</div>
            <div class="s">${cat.n}${g.pagado ? ' · pagado' : ''}</div>
          </button>
          <span class="amt">${money(g.monto)}</span>
          <button class="check ${g.pagado ? 'on' : ''}" data-act="togglePago" data-id="${g.id}" aria-label="Marcar pagado">✓</button>
        </div>`;
      }).join('')}</div>`
    : `<div class="list"><div class="empty"><div class="e">🧾</div>Agrega lo que tienes que pagar esta quincena:<br>comida, albañil, luz, renta…</div></div>`;

  return `
    <header class="top">
      <div><h1>Mi Ahorro</h1><div class="sub">${etiquetaQuincena(q.inicio)}</div></div>
    </header>

    <section class="hero">
      <div class="label">Dinero de la quincena</div>
      <div class="big">${money(c.ingreso)}</div>
      <button class="edit" data-act="editIngreso">✏️ ${sinIngreso ? 'Poner cuánto tengo' : 'Cambiar'}</button>
      <div class="hero-row">
        ${donut(c)}
        <div class="legend">
          <div class="li"><span class="dot" style="background:#fff"></span><span class="name">Ahorro</span><span class="val">${money(c.ahorro)}</span></div>
          <div class="li"><span class="dot" style="background:#fcd34d"></span><span class="name">Gastos</span><span class="val">${money(c.gastos)}</span></div>
          <div class="li"><span class="dot" style="background:rgba(255,255,255,.4)"></span><span class="name">Libre</span><span class="val">${money(c.libre)}</span></div>
        </div>
      </div>
    </section>

    ${c.libre < 0 ? `<div class="alert">⚠️ <div>Te faltan <b>${money(-c.libre)}</b>. Baja algún gasto o el ahorro de esta quincena.</div></div>` : ''}

    <div class="stat-grid">
      <button class="card stat tap" data-act="editAhorro">
        <div class="k">🐷 Voy a ahorrar</div>
        <div class="v pos">${money(c.ahorro)}</div>
        <div class="h">${q.ahorroModo === 'pct' ? `${q.ahorroValor}% del dinero` : 'Toca para cambiar'}</div>
      </button>
      <div class="card stat">
        <div class="k">💵 Me queda libre</div>
        <div class="v ${c.libre < 0 ? 'neg' : ''}">${money(c.libre)}</div>
        <div class="h">${c.pendiente > 0 ? `Por pagar: ${money(c.pendiente)}` : (q.gastos.length ? 'Todo pagado ✅' : 'Sin gastos aún')}</div>
      </div>
    </div>

    <div class="sec-h">
      <h2>Gastos de la quincena</h2>
      <span class="meta">${q.gastos.filter(g => g.pagado).length}/${q.gastos.length} pagados</span>
    </div>
    ${gastosHtml}

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
            <span class="main"><div class="t">${etiquetaQuincena(h.inicio)}</div>
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
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:8px;opacity:.9">
              <span>🎯 ${esc(meta.nombre) || 'Mi meta'}: ${money(meta.monto)}</span><span>${pct}%</span>
            </div>
            <div style="font-size:13px;margin-top:4px;opacity:.85">${total >= meta.monto ? '¡Lo lograste! 🎉' : `Te faltan ${money(meta.monto - total)}`}</div>
            <button class="edit" style="margin-top:12px;position:relative" data-act="editMeta">✏️ Cambiar meta</button>
          </div>`
        : `<button class="edit" style="margin-top:8px;position:relative" data-act="editMeta">🎯 Ponerme una meta</button>`}
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
    <div class="card" style="font-size:14px;color:var(--muted);line-height:1.5">
      💡 <b style="color:var(--text)">Cómo funciona:</b> pon cuánto dinero tienes en la quincena, cuánto quieres ahorrar y lo que tienes que pagar.
      La app te dice cuánto te queda libre. Al terminar la quincena, tócale a <i>“Terminar quincena”</i> y tu ahorro se suma a tu alcancía.
      Los gastos marcados como <b>fijos</b> se copian solos a la siguiente quincena.
    </div>
    <input type="file" id="fileImport" accept="application/json,.json" hidden>
    <div class="foot">Mi Ahorro · v1.0</div>
  `;
}

function render() {
  const v = $('#view');
  v.innerHTML = tab === 'quincena' ? vistaQuincena() : tab === 'ahorros' ? vistaAhorros() : vistaAjustes();
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
}

/* ---------------- Hoja inferior (bottom sheet) ---------------- */

let sheetOnClose = null;
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

function moneyField(id, value, label, extra = '') {
  return `<div class="field"><label for="${id}">${label}</label>
    <div class="money"><span class="cur">${esc(curSymbol())}</span>
    <input class="input" id="${id}" inputmode="decimal" autocomplete="off" placeholder="0" value="${value ? value : ''}" ${extra}></div></div>`;
}
function focusLater(el) { setTimeout(() => { el.focus(); el.select && el.select(); }, 280); }

/* ---- Ingreso ---- */
function sheetIngreso() {
  openSheet(`
    <h3>¿Cuánto dinero tienes esta quincena?</h3>
    <p class="hint">Tu sueldo o el total con el que cuentas.</p>
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

/* ---- Ahorro ---- */
function sheetAhorro() {
  const q = S.actual;
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
      const drawBox = (val) => {
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
      const upd = () => {
        const v = num($('#fAh', b).value);
        const ah = modo === 'pct' ? (q.ingreso * v) / 100 : v;
        const libre = q.ingreso - ah - calc(q).gastos;
        $('#prev', b).innerHTML = q.ingreso
          ? `Ahorras <b>${money(ah)}</b> · te quedan libres <b class="${libre < 0 ? 'neg' : ''}">${money(libre)}</b> después de gastos.`
          : 'Primero pon cuánto dinero tienes en la quincena.';
        box.querySelectorAll('.chip').forEach(ch => ch.classList.toggle('on', +ch.dataset.p === v));
      };
      b.querySelectorAll('.seg button').forEach(x => x.onclick = () => {
        if (modo === x.dataset.m) return;
        const v = num($('#fAh', b).value);
        // convertir el valor al cambiar de modo
        let nv = 0;
        if (q.ingreso) nv = x.dataset.m === 'pct' ? Math.round((v / q.ingreso) * 100) : Math.round(q.ingreso * v) / 100;
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
  const g = id ? q.gastos.find(x => x.id === id) : null;
  let cat = g && CAT[g.cat] ? g.cat : g ? 'otro' : 'comida';
  let fijo = g ? !!g.fijo : false;
  openSheet(`
    <h3>${g ? 'Editar gasto' : 'Nuevo gasto'}</h3>
    <div class="field"><label for="fNom">¿Qué es?</label>
      <input class="input" id="fNom" maxlength="40" placeholder="Ej. Comida, pagar al albañil…" value="${g ? esc(g.nombre) : ''}"></div>
    ${moneyField('fMon', g ? g.monto : '', '¿Cuánto?')}
    <div class="chips" id="montos" style="margin-top:10px">
      ${MONTOS_RAPIDOS.map(m => `<button class="chip" data-m="${m}">+${money(m)}</button>`).join('')}
      <button class="chip" data-m="0">Borrar</button>
    </div>
    <div class="field"><label>Categoría</label>
      <div class="chips" id="cats">${CATS.map(([cid, e, n]) => `<button class="chip" data-c="${cid}">${e} ${n}</button>`).join('')}</div></div>
    <div class="switch"><div><div class="st">Se repite cada quincena</div><div class="ss">Se copia sola a la siguiente quincena</div></div>
      <button class="tg" id="tgFijo" aria-label="Gasto fijo"></button></div>
    <button class="btn" id="ok">${g ? 'Guardar cambios' : 'Agregar gasto'}</button>
    ${g ? '<button class="btn danger" id="del" style="margin-top:10px">Eliminar gasto</button>' : ''}`,
    b => {
      const drawCats = () => b.querySelectorAll('#cats .chip').forEach(c => c.classList.toggle('on', c.dataset.c === cat));
      const nom = $('#fNom', b);
      b.querySelectorAll('#cats .chip').forEach(c => c.onclick = () => {
        cat = c.dataset.c; drawCats();
        if (!nom.value.trim()) nom.value = CAT[cat].n.split(' /')[0].split(',')[0];
      });
      drawCats();
      const mon = $('#fMon', b);
      b.querySelectorAll('#montos .chip').forEach(c => c.onclick = () => {
        const m = +c.dataset.m;
        mon.value = m ? num(mon.value) + m : '';
      });
      const tg = $('#tgFijo', b);
      tg.classList.toggle('on', fijo);
      tg.onclick = () => { fijo = !fijo; tg.classList.toggle('on', fijo); };
      if (!g) focusLater(nom);
      $('#ok', b).onclick = () => {
        const nombre = nom.value.trim() || CAT[cat].n;
        const monto = num($('#fMon', b).value);
        if (!monto) { toast('Pon cuánto cuesta'); $('#fMon', b).focus(); return; }
        if (g) Object.assign(g, { nombre, monto, cat, fijo });
        else q.gastos.push({ id: uid(), nombre, monto, cat, fijo, pagado: false });
        guardar(); closeSheet(); render();
        toast(g ? 'Gasto actualizado' : 'Gasto agregado');
      };
      if (g) $('#del', b).onclick = () => {
        q.gastos = q.gastos.filter(x => x.id !== g.id);
        guardar(); closeSheet(); render(); toast('Gasto eliminado');
      };
    });
}

/* ---- Cerrar quincena ---- */
function sheetCerrar() {
  const q = S.actual;
  const c = calc(q);
  const fijos = q.gastos.filter(g => g.fijo).length;
  openSheet(`
    <h3>Terminar quincena</h3>
    <p class="hint">${etiquetaQuincena(q.inicio)}</p>
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
    <p class="hint" style="margin-top:14px">Empezará una quincena nueva con el mismo dinero y ahorro${fijos ? ` y tus ${fijos} gasto${fijos > 1 ? 's' : ''} fijo${fijos > 1 ? 's' : ''}` : ''}. Lo puedes cambiar después.</p>
    <button class="btn" id="ok">Guardar y empezar nueva</button>
    <button class="btn ghost" id="cancel" style="margin-top:6px">Cancelar</button>`,
    b => {
      b.querySelectorAll('.chip').forEach(ch => ch.onclick = () => { $('#fReal', b).value = ch.dataset.v; });
      $('#cancel', b).onclick = () => closeSheet();
      $('#ok', b).onclick = () => {
        const real = num($('#fReal', b).value);
        S.historial.push({
          id: q.id, inicio: q.inicio, fin: today(),
          ingreso: c.ingreso, gastos: c.gastos, ahorroPlan: c.ahorro, ahorroReal: real,
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
    <h3>${etiquetaQuincena(h.inicio)}</h3>
    <p class="hint">${fechaCorta(h.inicio)} – ${fechaCorta(h.fin)}</p>
    <div class="summary">
      <div class="sr"><span>Dinero</span><b>${money(h.ingreso)}</b></div>
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

/* ---- Movimiento manual ---- */
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
        S = { ...estadoInicial(), ...s };
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

$('#view').addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const { act, id } = el.dataset;
  switch (act) {
    case 'editIngreso': return sheetIngreso();
    case 'editAhorro': return sheetAhorro();
    case 'nuevoGasto': return sheetGasto(null);
    case 'editGasto': return sheetGasto(id);
    case 'togglePago': {
      const g = S.actual.gastos.find(x => x.id === id);
      if (g) { g.pagado = !g.pagado; guardar(); render(); }
      return;
    }
    case 'cerrar':
      if (!S.actual.ingreso && !S.actual.gastos.length) return toast('Primero llena tu quincena');
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
        S = estadoInicial(); guardar(); tab = 'quincena'; render(); toast('Datos borrados');
      }
      return;
  }
});

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
