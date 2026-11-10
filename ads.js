/* ---------------- Anuncios (AdMob, solo en la app de Android) ----------------
 * Mientras PRUEBA sea true se usan los anuncios de prueba de Google (no generan pagos).
 * Para publicar: poner PRUEBA = false y cambiar los IDs de REAL por los de tu cuenta de AdMob,
 * y el APPLICATION_ID en android/app/src/main/AndroidManifest.xml.
 */
const ADS = (() => {
  const PRUEBA = true;
  const IDS_PRUEBA = {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    inter: 'ca-app-pub-3940256099942544/1033173712',
    premio: 'ca-app-pub-3940256099942544/5224354917',
  };
  const REAL = { banner: '', inter: '', premio: '' };
  const ID = PRUEBA ? IDS_PRUEBA : REAL;

  const MIN_ENTRE_INTER = 4 * 60 * 1000;      // máximo 1 intersticial cada 4 minutos
  const DIAS_SIN_INTER = PRUEBA ? 0 : 7;       // la primera semana, sin intersticiales
  const HORAS_PREMIO = 24;                     // ver un video quita los anuncios por 24 h
  const KEY = 'mi-ahorro-ads';

  const AdMob = esApp && window.Capacitor && typeof Capacitor.registerPlugin === 'function'
    ? Capacitor.registerPlugin('AdMob') : null;

  let D = {};
  try { D = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { D = {}; }
  if (!D.primerUso) D.primerUso = Date.now();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { /* nada */ } };
  save();

  let listo = false, bannerVisible = false, bannerCreado = false, interListo = false, privacidad = false;

  const sinAnuncios = () => (D.sinAdsHasta || 0) > Date.now();
  const setAlto = h => document.documentElement.style.setProperty('--ad-h', (h || 0) + 'px');

  // margen inferior: el alto de la barra de pestañas (sin la barra del sistema, que el plugin ya suma)
  function margenBanner() {
    const tb = document.querySelector('.tabbar');
    if (!tb) return 0;
    const pb = parseFloat(getComputedStyle(tb).paddingBottom) || 0;
    return Math.max(0, Math.round(tb.getBoundingClientRect().height - Math.max(0, pb - 8)));
  }

  // ¿Debe verse el banner ahora? Solo en Inicio y Calculadora, nunca con una ventana abierta
  function quiereBanner() {
    const sheetAbierto = document.getElementById('sheet').classList.contains('open');
    return listo && !sinAnuncios() && !sheetAbierto && (tab === 'inicio' || tab === 'calc');
  }

  async function sync() {
    if (!AdMob) return;
    const quiere = quiereBanner();
    try {
      if (quiere && !bannerVisible) {
        if (!bannerCreado) {
          await AdMob.showBanner({ adId: ID.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: margenBanner(), isTesting: PRUEBA });
          bannerCreado = true;
        } else {
          await AdMob.resumeBanner();
        }
        bannerVisible = true;
      } else if (!quiere && bannerVisible) {
        bannerVisible = false;
        setAlto(0);
        await AdMob.hideBanner();
      }
    } catch (e) { bannerVisible = false; setAlto(0); }
  }

  async function prepararInter() {
    if (!AdMob || interListo) return;
    try { await AdMob.prepareInterstitial({ adId: ID.inter, isTesting: PRUEBA }); interListo = true; }
    catch (e) { interListo = false; }
  }

  // Se llama después de una acción terminada (por ejemplo, guardar un gasto nuevo)
  async function trasAccion() {
    if (!AdMob || !listo || sinAnuncios() || !interListo) return;
    if (Date.now() - D.primerUso < DIAS_SIN_INTER * 864e5) return;
    if (Date.now() - (D.ultimoInter || 0) < MIN_ENTRE_INTER) return;
    // espera a que se cierre la ventana para no interrumpir
    setTimeout(async () => {
      if (document.getElementById('sheet').classList.contains('open')) return;
      try {
        interListo = false;
        D.ultimoInter = Date.now(); save();
        await AdMob.showInterstitial();
      } catch (e) { /* sin anuncio disponible */ }
      prepararInter();
    }, 700);
  }

  // Video recompensado: quita los anuncios por 24 horas
  async function verPremio() {
    if (!AdMob || !listo) return toast('Los anuncios no están disponibles ahora');
    try {
      toast('Cargando anuncio…');
      await AdMob.prepareRewardVideoAd({ adId: ID.premio, isTesting: PRUEBA });
      const r = await AdMob.showRewardVideoAd();
      if (r) {
        D.sinAdsHasta = Date.now() + HORAS_PREMIO * 3600e3; save();
        await sync();
        render(false);
        toast('¡Listo! Sin anuncios por 24 horas 🎉');
      }
    } catch (e) { toast('No hay anuncio disponible, prueba más tarde'); }
  }

  async function iniciar() {
    if (!AdMob) return;
    try {
      AdMob.addListener('bannerAdSizeChanged', s => setAlto(bannerVisible ? (s && s.height) || 0 : 0));
      AdMob.addListener('bannerAdFailedToLoad', () => setAlto(0));
      // Consentimiento (obligatorio en algunos países; en otros no aparece)
      let info = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await AdMob.showConsentForm();
      privacidad = info.privacyOptionsRequirementStatus === 'REQUIRED';
      if (info.canRequestAds === false) return;
      await AdMob.initialize({ initializeForTesting: PRUEBA });
      listo = true;
      prepararInter();
      sync();
      if (privacidad && tab === 'ajustes') render(false);
    } catch (e) { /* sin anuncios */ }
  }

  // Tarjeta para la pestaña Ajustes
  function tarjetaAjustes() {
    if (!AdMob) return '';
    const hasta = sinAnuncios() ? new Date(D.sinAdsHasta) : null;
    const hora = hasta ? hasta.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' }) : '';
    return `<div class="card ads-card">
      <div class="ads-t">📺 Anuncios</div>
      <div class="ads-s">${hasta
        ? `No verás anuncios hasta ${hasta.getDate() === new Date().getDate() ? 'hoy' : 'mañana'} a las ${hora}.`
        : 'Los anuncios mantienen la app gratis. Si quieres descansar de ellos, mira un video corto.'}</div>
      ${hasta ? '' : '<button class="btn soft" data-act="adsPremio" style="margin-top:12px">🎬 Ver un video y quitar los anuncios por 24 h</button>'}
      ${privacidad ? '<button class="btn ghost" data-act="adsPrivacidad" style="margin-top:6px">Privacidad de los anuncios</button>' : ''}
    </div>`;
  }

  const privacidadForm = () => AdMob && AdMob.showPrivacyOptionsForm().catch(() => {});

  return { iniciar, sync, trasAccion, verPremio, tarjetaAjustes, privacidadForm };
})();

ADS.iniciar();
