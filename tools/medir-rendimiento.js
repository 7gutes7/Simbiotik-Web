/**
 * Medición de rendimiento de simbiotikrockband.com
 *
 * Uso: abrir el sitio, abrir la consola del navegador (F12) y pegar este archivo
 * entero. Tarda unos 6 segundos y devuelve un objeto con los números.
 *
 * Qué mira, y por qué:
 *  - fps / p50 / p95      : fluidez real percibida.
 *  - jsMsPorFrame         : cuánto del frame es JavaScript. Si es bajo y el fps
 *                           también, el cuello de botella es GPU/composición,
 *                           no cálculo.
 *  - drawCallsPorFrame    : llamadas de dibujo de WebGL.
 *  - transferencia        : bytes reales que bajaron por red.
 *  - dprEfectivo          : resolución a la que está renderizando el canvas
 *                           tras la degradación adaptativa.
 *  - modoBajoRendimiento  : si se desactivaron los efectos CSS caros.
 */
(async () => {
  const medirFps = (ms) => new Promise((resolve) => {
    const marcas = [];
    let anterior = performance.now();
    const t0 = anterior;
    const tick = (t) => {
      marcas.push(t - anterior);
      anterior = t;
      if (t - t0 < ms) requestAnimationFrame(tick);
      else resolve(marcas.slice(1));
    };
    requestAnimationFrame(tick);
  });

  // --- Coste de JavaScript por frame ---
  const rafOriginal = window.requestAnimationFrame.bind(window);
  let msEnJs = 0;
  window.requestAnimationFrame = (fn) => rafOriginal((t) => {
    const inicio = performance.now();
    try { return fn(t); } finally { msEnJs += performance.now() - inicio; }
  });

  // --- Llamadas de dibujo ---
  const P = window.WebGL2RenderingContext ? WebGL2RenderingContext.prototype : WebGLRenderingContext.prototype;
  const originales = ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']
    .filter((n) => P[n]).map((n) => [n, P[n]]);
  let llamadas = 0;
  originales.forEach(([nombre, fn]) => {
    P[nombre] = function (...args) { llamadas++; return fn.apply(this, args); };
  });

  const marcas = await medirFps(5000);

  originales.forEach(([nombre, fn]) => { P[nombre] = fn; });
  window.requestAnimationFrame = rafOriginal;

  const ordenadas = [...marcas].sort((a, b) => a - b);
  const media = marcas.reduce((a, b) => a + b, 0) / marcas.length;
  const nav = performance.getEntriesByType('navigation')[0];
  const recursos = performance.getEntriesByType('resource');
  const canvas = document.getElementById('webgl-canvas');

  const resultado = {
    fps: +(1000 / media).toFixed(1),
    frameMedioMs: +media.toFixed(1),
    p50Ms: +ordenadas[Math.floor(ordenadas.length * 0.5)].toFixed(1),
    p95Ms: +ordenadas[Math.floor(ordenadas.length * 0.95)].toFixed(1),
    peorFrameMs: +ordenadas[ordenadas.length - 1].toFixed(1),
    jsMsPorFrame: +(msEnJs / marcas.length).toFixed(2),
    drawCallsPorFrame: Math.round(llamadas / marcas.length),
    dprEfectivo: canvas ? +(canvas.width / canvas.clientWidth).toFixed(2) : null,
    dprPantalla: window.devicePixelRatio,
    modoBajoRendimiento: document.body.classList.contains('perf-low'),
    canvasOlasOculto: getComputedStyle(document.getElementById('waves-canvas') || document.body).visibility === 'hidden',
    ttfbMs: nav ? Math.round(nav.responseStart) : null,
    fcpMs: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0),
    loadMs: nav ? Math.round(nav.loadEventEnd) : null,
    transferenciaKB: Math.round(recursos.reduce((s, r) => s + r.transferSize, 0) / 1024),
    peticiones: recursos.length,
    ventana: `${innerWidth}x${innerHeight}`,
  };

  console.table(resultado);
  return resultado;
})();
