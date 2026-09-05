import './style.css';
import Lenis from 'lenis';
import { SimbiotikWebGL } from './webgl.js';
import { TextScramble } from './scramble.js';
import { tracks } from './audio.js';
import gsap from 'gsap';

document.addEventListener('DOMContentLoaded', () => {

  // 1. INICIALIZAR WEBGL CANVAS
  // La URL del modelo se pasa al constructor para que la descarga arranque antes
  // de construir la escena, no después (ver comentario en webgl.js).
  const webgl = new SimbiotikWebGL({ logoUrl: './smbtk1.glb' });

  // 1.5 CURSOR PERSONALIZADO (Punto)
  const cursor = document.createElement('div');
  cursor.className = 'custom-cursor';
  document.body.appendChild(cursor);

  document.addEventListener('mousemove', (e) => {
    gsap.to(cursor, {
      x: e.clientX,
      y: e.clientY,
      duration: 0.08,
      ease: 'power2.out'
    });
  });

  // Efectos de hover sobre elementos interactivos
  const updateHoverEffects = () => {
    const hoverables = document.querySelectorAll('a, button, .track-row, .hotspot, .part-card, .status-btn, [role="button"]');
    hoverables.forEach(el => {
      if (el.dataset.cursorBound) return;
      el.dataset.cursorBound = "true";

      el.addEventListener('mouseenter', () => {
        gsap.to(cursor, {
          scale: 1.8,
          backgroundColor: '#ffffff',
          boxShadow: '0 0 12px #ffffff',
          duration: 0.15
        });
      });
      el.addEventListener('mouseleave', () => {
        gsap.to(cursor, {
          scale: 1,
          backgroundColor: '#38BDF8', // Azul eléctrico
          boxShadow: '0 0 8px #38BDF8',
          duration: 0.15
        });
      });
    });
  };

  updateHoverEffects();

  // Escuchar adiciones en el DOM para aplicar hover de cursor a nuevos elementos dinámicos
  const domObserver = new MutationObserver(() => {
    updateHoverEffects();
  });
  domObserver.observe(document.body, { childList: true, subtree: true });

  // 2. INICIALIZAR SCROLL SUAVE (LENIS)
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 1.0
  });

  let isSnapping = false;
  let isNavigating = false;

  const sidebarLinks = document.querySelector('.hero-sidebar-links');
  const updateSidebarState = () => {
    if (!sidebarLinks) return;

    if (window.innerWidth <= 768) {
      // En móviles, limpiar estilos en línea y dejar que CSS controle el flujo relativo
      sidebarLinks.style.right = '';
      sidebarLinks.style.top = '';
      sidebarLinks.style.transform = '';
      return;
    }

    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight;
    const listHeight = sidebarLinks.offsetHeight || 300;

    // La transición se completa al desplazarse 1.0 * viewportHeight (al salir del Hero)
    const p = Math.min(1.0, Math.max(0.0, scrollY / viewportHeight));

    // Suavizado cubic-ease-out para una transición más orgánica e interactiva
    const easedP = 1 - Math.pow(1 - p, 3);

    // Interpolación de coordenadas y transformaciones
    const startTop = 0.4 * viewportHeight;
    const endTop = viewportHeight - (listHeight * 0.75) - 40; // Se reduce un 25% (escala 0.75) y se alinea a 40px del borde inferior
    const currentTop = startTop + (endTop - startTop) * easedP;

    const startRight = 80;
    const endRight = 40;
    const currentRight = startRight + (endRight - startRight) * easedP;

    const startScale = 1.0;
    const endScale = 0.75; // Reducción del 25%
    const currentScale = startScale + (endScale - startScale) * easedP;

    const startTranslateY = -50;
    const endTranslateY = 0;
    const currentTranslateY = startTranslateY + (endTranslateY - startTranslateY) * easedP;

    // Aplicar estilos directamente al elemento fixed
    sidebarLinks.style.right = `${currentRight}px`;
    sidebarLinks.style.top = `${currentTop}px`;
    sidebarLinks.style.transform = `translateY(${currentTranslateY}%) scale(${currentScale})`;
  };

  // Initial check on load
  updateSidebarState();

  // Escuchar redimensionamiento de pantalla para recalcular posiciones de scroll
  window.addEventListener('resize', updateSidebarState);

  // Helper dinámico y resiliente para calcular el centro magnético absoluto de cualquier sección
  const getTargetScrollForSection = (section) => {
    if (!section) return 0;

    const currentScrollY = window.scrollY;
    const vh = window.innerHeight;
    const navbarHeight = document.querySelector('.navbar')?.offsetHeight || 60;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);

    let sectionIndex = parseInt(section.getAttribute('data-section-index'), 10);
    if (isNaN(sectionIndex)) {
      const idMap = {
        'inicio': 1,
        'simbiosis-sonido': 2,
        'memoria-intro': 3,
        'memoria-natural': 4,
        'simbolo': 5,
        'dimension-alterna': 6,
        'manifiesto': 7,
        'press-kit': 8,
        'contacto': 9
      };
      sectionIndex = idMap[section.id] || 0;
    }

    let targetY = 0;

    switch (sectionIndex) {
      case 1: // SECCIÓN 1: INICIO (Tope absoluto de pantalla)
        targetY = 0;
        break;

      case 2: // SECCIÓN 2: SIMBIOSIS SONIDO
        {
          const rect = section.getBoundingClientRect();
          const absTop = currentScrollY + rect.top;
          targetY = Math.max(0, absTop + (rect.height > vh ? vh : rect.height / 2 - vh / 2));
        }
        break;

      case 3: // SECCIÓN 3: AGUJERO NEGRO (memoria-intro)
        {
          const rect = section.getBoundingClientRect();
          const absTop = currentScrollY + rect.top;
          targetY = Math.max(0, absTop - 20);
        }
        break;

      case 4: // SECCIÓN 4: MEMORIA NATURAL
        {
          const container = section.querySelector('.container') || section;
          const rect = container.getBoundingClientRect();
          const absTop = currentScrollY + rect.top;
          targetY = Math.max(0, absTop + rect.height / 2 - vh / 2 - 55);
        }
        break;

      case 5: // SECCIÓN 5: EL SÍMBOLO
        {
          // Centro magnético específico para la sección Símbolo (centrado geométrico de su panel interactivo)
          const container = section.querySelector('.container') || section;
          const rect = container.getBoundingClientRect();
          const absTop = currentScrollY + rect.top;
          targetY = Math.max(0, absTop + rect.height / 2 - vh / 2);
        }
        break;

      case 6: // SECCIÓN 6: DIMENSIÓN ALTERNA
        {
          const container = section.querySelector('.container') || section;
          const rect = container.getBoundingClientRect();
          const absTop = currentScrollY + rect.top;
          targetY = Math.max(0, absTop + rect.height / 2 - vh / 2);
        }
        break;

      case 7: // SECCIÓN 7: EL MANIFIESTO
        {
          const techSubtitle = section.querySelector('.tech-subtitle');
          if (techSubtitle) {
            const subRect = techSubtitle.getBoundingClientRect();
            targetY = Math.max(0, currentScrollY + subRect.top - navbarHeight - 20);
          } else {
            const container = section.querySelector('.container') || section;
            const rect = container.getBoundingClientRect();
            targetY = Math.max(0, currentScrollY + rect.top);
          }
        }
        break;

      case 8: // SECCIÓN 8: PRESS KIT
        {
          const container = section.querySelector('.container') || section;
          const rect = container.getBoundingClientRect();
          const absTop = currentScrollY + rect.top;
          targetY = Math.max(0, absTop + rect.height / 2 - vh / 2 - 25);
        }
        break;

      case 9: // SECCIÓN 9: CONTACTO
        {
          const container = section.querySelector('.container') || section;
          const rect = container.getBoundingClientRect();
          const absTop = currentScrollY + rect.top;
          targetY = Math.max(0, absTop + rect.height / 2 - vh / 2);
        }
        break;

      default:
        {
          const rect = section.getBoundingClientRect();
          targetY = Math.max(0, currentScrollY + rect.top + rect.height / 2 - vh / 2);
        }
        break;
    }

    return Math.min(maxScroll, targetY);
  };

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // 3. INICIALIZAR TEXT SCRAMBLE PARA TÍTULOS
  const scrambleElements = document.querySelectorAll('.scramble-text');
  const scramblers = Array.from(scrambleElements).map(el => {
    const sc = new TextScramble(el);
    const originalText = el.getAttribute('data-text') || el.innerText;

    // Scramble inicial
    sc.setText(originalText);

    // Activar scramble al pasar el mouse (hover)
    el.addEventListener('mouseenter', () => {
      sc.setText(originalText);
    });

    return { el, sc, originalText };
  });

  // 3.5 PANTALLA DE CARGA
  // No es decorativa: su trabajo real es precompilar los shaders de todos los
  // fondos y subir su geometría a la GPU mientras el visitante mira el logo.
  // Sin esto, cada fondo compilaba al entrar en cuadro y congelaba el hilo
  // principal en pleno scroll (medido en producción: 1401 ms al entrar la
  // sección 2, y varios tirones de 380-480 ms en las siguientes).
  (() => {
    const overlay = document.getElementById('preloader');
    if (!overlay) return;

    const barra = document.getElementById('pl-barra');
    const pct = document.getElementById('pl-pct');
    const estado = document.getElementById('pl-estado');

    const MIN_MS = 2800;   // permanencia mínima: la entrada no debe sentirse abrupta
    const MAX_MS = 15000;  // salvavidas: nadie se queda atrapado aquí
    const t0 = performance.now();

    const mensajes = [
      [0.00, '[ ESTABLECIENDO ENLACE ]'],
      [0.22, '[ CARGANDO NÚCLEO 3D ]'],
      [0.48, '[ COMPILANDO SHADERS ]'],
      [0.80, '[ SINCRONIZANDO FRECUENCIA ]'],
      [0.97, '[ SEÑAL ESTABLE ]'],
    ];

    let progreso = 0;
    const fijar = (valor) => {
      // El progreso nunca retrocede: retroceder se lee como un fallo
      progreso = Math.max(progreso, Math.min(1, valor));
      const p = Math.round(progreso * 100);
      if (barra) barra.style.width = p + '%';
      if (pct) pct.textContent = p + '%';
      if (estado) {
        for (let i = mensajes.length - 1; i >= 0; i--) {
          if (progreso >= mensajes[i][0]) {
            if (estado.textContent !== mensajes[i][1]) estado.textContent = mensajes[i][1];
            break;
          }
        }
      }
    };

    // Scroll bloqueado mientras se compila: si el visitante baja antes de
    // tiempo, se encuentra justo con los tirones que esto viene a evitar.
    lenis.stop();
    window.scrollTo(0, 0);

    const cerrar = () => {
      if (overlay.dataset.cerrado) return;
      overlay.dataset.cerrado = '1';
      fijar(1);

      setTimeout(() => {
        overlay.classList.add('oculto');
        document.documentElement.classList.remove('cargando');
        window.scrollTo(0, 0);
        lenis.start();

        // El scramble del título se reproduce ahora, ya con el visitante mirando
        const heroScrambler = scramblers.find((s) => s.el.classList.contains('hero-title'));
        if (heroScrambler) heroScrambler.sc.setText(heroScrambler.originalText);

        setTimeout(() => overlay.remove(), 1100);
      }, 260);
    };

    const salvavidas = setTimeout(cerrar, MAX_MS);
    const conLimite = (promesa, ms) => Promise.race([promesa, new Promise((r) => setTimeout(r, ms))]);

    (async () => {
      fijar(0.08);

      // Tipografías primero: evita que el texto salte al retirar la pantalla
      if (document.fonts && document.fonts.ready) {
        await conLimite(document.fonts.ready, 4000);
      }
      fijar(0.22);

      // Modelos 3D descargados y con sus materiales ya construidos
      await conLimite(Promise.all([
        webgl.logoLista || Promise.resolve(),
        webgl.ensureSlenderWomanModel ? webgl.ensureSlenderWomanModel() : Promise.resolve(),
      ]), 9000);
      fijar(0.48);

      // La parte que de verdad elimina los tirones
      if (webgl.prewarm) {
        await conLimite(webgl.prewarm((f) => fijar(0.48 + f * 0.46)), 8000);
      }
      fijar(0.96);

      const restante = MIN_MS - (performance.now() - t0);
      if (restante > 0) await new Promise((r) => setTimeout(r, restante));

      clearTimeout(salvavidas);
      cerrar();
    })().catch((e) => {
      console.warn('Secuencia de carga interrumpida:', e);
      clearTimeout(salvavidas);
      cerrar();
    });
  })();

  // 4. GENERAR LA LISTA DE CANCIONES (ACTOS)
  const act1Container = document.getElementById('act-1-tracks');
  const act2Container = document.getElementById('act-2-tracks');
  const act3Container = document.getElementById('act-3-tracks');

  let currentTrackIndex = 0;

  function renderTracklist() {
    tracks.forEach((track, index) => {
      const row = document.createElement('div');
      row.className = `track-row ${index === currentTrackIndex ? 'active' : ''}`;
      row.setAttribute('data-index', index);

      row.innerHTML = `
        <div class="row-left">
          <span class="track-row-num">${String(track.id).padStart(2, '0')}</span>
          <div class="track-row-details">
            <span class="track-row-title">${track.title}</span>
          </div>
        </div>
        <div class="row-right">
          <span class="track-row-territory">${track.territory}</span>
          <button class="btn-play-mini" aria-label="Select Track">
            <svg class="info-svg" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </button>
        </div>
      `;

      // Añadir fila al contenedor correspondiente según su acto
      if (track.actNumber === 1) {
        act1Container.appendChild(row);
      } else if (track.actNumber === 2) {
        act2Container.appendChild(row);
      } else if (track.actNumber === 3) {
        act3Container.appendChild(row);
      }

      // Evento al hacer clic en la fila
      row.addEventListener('click', () => {
        selectTrack(index);
      });
    });
  }

  renderTracklist();

  // Elementos del panel activo
  const playerActNum = document.getElementById('player-act-num');
  const playerActTitle = document.getElementById('player-act-title');
  const playerTrackTitle = document.getElementById('player-track-title');
  const playerTrackTerritory = document.getElementById('player-track-territory');
  const playerTrackMood = document.getElementById('player-track-mood');
  const playerTrackQuote = document.getElementById('player-track-quote');

  const activeTrackScrambler = new TextScramble(playerTrackTitle);

  function selectTrack(index) {
    // Quitar clase activa previa
    document.querySelectorAll('.track-row').forEach(row => {
      row.classList.remove('active');
    });

    currentTrackIndex = index;
    const track = tracks[currentTrackIndex];

    // Activar fila actual
    const activeRow = document.querySelector(`.track-row[data-index="${index}"]`);
    if (activeRow) activeRow.classList.add('active');

    // Cambiar datos del panel izquierdo
    playerActNum.innerText = track.actNumber === 1 ? 'I' : track.actNumber === 2 ? 'II' : 'III';
    playerActTitle.innerText = track.act;
    playerTrackTerritory.innerText = track.territory;
    playerTrackMood.innerText = track.mood;
    playerTrackQuote.innerText = `"${track.corePhrase}"`;

    // Efecto text scramble sobre el título de la canción seleccionada
    activeTrackScrambler.setText(track.title);

    // Cambiar color del fondo WebGL según la guía del track
    webgl.updateColorTheme(track.guideColor);
  }

  // Cargar primera canción al inicio
  selectTrack(0);

  // Forzar el tema de color a Azul Frecuencia al inicio (para recrear el efecto de la esfera)
  webgl.updateColorTheme('#38bdf8');


  // 5. GENERAR ITEMS DEL MANIFIESTO
  const manifestoItems = [
    { text: "SimbiotiK no pertenece a la vieja escuela, pero respeta la raíz del rock.", keyword: "Raíz" },
    { text: "La canción debe sentirse como una experiencia, no como un ejercicio musical.", keyword: "Experiencia" },
    { text: "La voz humana es el centro del conflicto.", keyword: "Voz" },
    { text: "La guitarra debe ser personaje, no decoración.", keyword: "Guitarra" },
    { text: "El bajo debe tener presencia física.", keyword: "Bajo" },
    { text: "La batería debe marcar el pulso emocional, no solo el tiempo.", keyword: "Batería" },
    { text: "Los sintetizadores deben abrir atmósferas, no volver pop la canción.", keyword: "Síntesis" },
    { text: "Las letras deben ser profundas, pero cantables.", keyword: "Letras" },
    { text: "La oscuridad debe ser elegante.", keyword: "Oscuridad" },
    { text: "SimbiotiK debe construir universo.", keyword: "Universo" }
  ];

  const manifestoContainer = document.getElementById('manifiesto-items-container');
  if (manifestoContainer) {
    manifestoContainer.innerHTML = '';
    const leftCol = document.createElement('div');
    leftCol.className = 'manifiesto-col manifiesto-col-left';

    const rightCol = document.createElement('div');
    rightCol.className = 'manifiesto-col manifiesto-col-right';

    manifestoItems.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'manifiesto-card glass-panel';
      card.innerHTML = `
        <span class="manifiesto-keyword">${item.keyword}</span>
        <p class="manifiesto-text">${item.text}</p>
      `;
      if (index < 5) {
        leftCol.appendChild(card);
      } else {
        rightCol.appendChild(card);
      }
    });

    manifestoContainer.appendChild(leftCol);
    manifestoContainer.appendChild(rightCol);
  }

  // 6. INTERACCIONES DEL SÍMBOLO (HOTSPOTS)
  const partCards = document.querySelectorAll('.part-card');

  partCards.forEach(card => {
    const partName = card.getAttribute('data-part');

    card.addEventListener('mouseenter', () => {
      highlightPart(partName);
    });

    card.addEventListener('mouseleave', () => {
      clearHighlight();
    });
  });

  function highlightPart(partName) {
    // Apagar todos
    partCards.forEach(c => c.classList.remove('hover'));

    // Encender tarjeta correspondiente
    const card = document.getElementById(`part-${partName}`);
    if (card) {
      card.classList.add('hover');
    }

    // En WebGL, podemos cambiar el foco de la cámara levemente o iluminar el área del shader
    // según el hotspot. Ejemplo:
    if (partName === 'core') {
      webgl.updateColorTheme("#38bdf8"); // Electric azul
    } else if (partName === 'circle') {
      webgl.updateColorTheme("#b88945"); // Gold
    } else if (partName === 'top-lines') {
      webgl.updateColorTheme("#6d28d9"); // Violet
    } else if (partName === 'bottom-lines') {
      webgl.updateColorTheme("#7f1d1d"); // Rojo
    }
  }

  function clearHighlight() {
    partCards.forEach(c => c.classList.remove('hover'));
  }

  // 7. SELECTOR DE ESTADOS (ELIMINADO)

  // 8. FORMULARIO DE CONTACTO
  const contactForm = document.getElementById('contact-form');
  const contactSuccess = document.getElementById('contact-success');

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Animación de salida del formulario
      gsap.to(contactForm, {
        opacity: 0,
        y: -20,
        duration: 0.5,
        onComplete: () => {
          contactForm.classList.add('hidden');
          contactSuccess.classList.remove('hidden');

          // Animación de entrada de la confirmación
          gsap.fromTo(contactSuccess,
            { opacity: 0, scale: 0.95 },
            { opacity: 1, scale: 1, duration: 0.5 }
          );

          // Glitch sónico en WebGL al enviar exitosamente la señal
          webgl.updateColorTheme("#ffffff");
          setTimeout(() => {
            webgl.updateColorTheme("#38bdf8");
          }, 400);
        }
      });
    });
  }

  // 9. REVELADO DE SECCIONES AL SCROLL (IntersectionObserver)
  const menuToggle = document.querySelector('.menu-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  const sections = document.querySelectorAll('.section-pane');

  // Tag auxiliar dinámico junto al logo SIMBIOTIK en el header
  const headerTechTag = document.getElementById('header-tech-tag');
  const headerTagScrambler = headerTechTag ? new TextScramble(headerTechTag) : null;

  const sectionTagMap = {
    'inicio': '[ FRECUENCIA ACTIVA ]',
    'simbiosis-sonido': '[ SIMBIOSIS ]',
    'memoria-intro': '[ AGUJERO NEGRO ]',
    'memoria-natural': '[ MEMORIA NATURAL ]',
    'simbolo': '[ NÚCLEO REVELADO ]',
    'dimension-alterna': '[ DIMENSIÓN ALTERNA ]',
    'manifiesto': '[ MANIFIESTO ]',
    'press-kit': '[ PRESS KIT ]',
    'contacto': '[ CONTACTO ]'
  };

  function showHeaderTechTag(text) {
    if (!headerTechTag) return;
    if (headerTagScrambler) {
      headerTagScrambler.setText(text);
    } else {
      headerTechTag.innerText = text;
    }
    headerTechTag.classList.add('visible');

    if (window.headerTechTimeout) clearTimeout(window.headerTechTimeout);
    window.headerTechTimeout = setTimeout(() => {
      headerTechTag.classList.remove('visible');
    }, 2000);
  }

  // Mostrar "[ FRECUENCIA ACTIVA ]" al inicio en el Hero durante 2 segundos
  showHeaderTechTag('[ FRECUENCIA ACTIVA ]');

  // Mapa de secciones a estados y colores
  const sectionStateMap = {
    'inicio': { state: 'idle', color: '#38bdf8' },
    'simbiosis-sonido': { state: 'idle', color: '#38bdf8' },
    'memoria-intro': { state: 'active', color: '#7f1d1d' },
    'memoria-natural': { state: 'active', color: '#0284c7' },
    'simbolo': { state: 'core', color: '#6d28d9' },
    'dimension-alterna': { state: 'memory', color: '#888888' },
    'manifiesto': { state: 'memory', color: '#b88945' },
    'press-kit': { state: 'memory', color: '#b88945' },
    'contacto': { state: 'signal', color: '#71717a' }
  };

  let lastActiveSection = null;

  const observerOptions = {
    root: null,
    rootMargin: '-30% 0px -30% 0px',
    threshold: 0.1
  };

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Añadir clase visible para animar opacidad y posición en CSS
        entry.target.classList.add('visible');

        const sectionId = entry.target.id;

        // No repetir si ya es la misma sección activa
        if (sectionId === lastActiveSection) return;
        lastActiveSection = sectionId;

        // Actualizar clase de sección activa en document.body para controlar z-index CSS
        document.body.className = document.body.className.replace(/\bsection-[\w-]+\b/g, '').trim();
        document.body.classList.add(`section-${sectionId}`);

        // Mover cámara WebGL según la sección activa en el scroll
        webgl.triggerSectionTransition(sectionId);


        // Actualizar menú activo en el menú lateral del hero
        document.querySelectorAll('.hero-sidebar-links a').forEach(l => {
          l.classList.remove('active');
          if (l.getAttribute('href') === `#${sectionId}`) {
            l.classList.add('active');
          }
        });

        // Cambiar color del logo 3D si corresponde
        const sectionMap = sectionStateMap[sectionId];
        if (sectionMap) {
          webgl.updateColorTheme(sectionMap.color);
        }

        // Mostrar tag auxiliar con estilo azul y desvanecimiento tras 2 segundos al navegar a cada sección
        if (sectionTagMap[sectionId]) {
          showHeaderTechTag(sectionTagMap[sectionId]);
        }

        // Mostrar/ocultar SVG overlay y logo 3D en la sección Símbolo
        const svgOverlay = document.getElementById('logo-svg-overlay');
        if (sectionId === 'simbolo') {
          // Mostrar SVG overlay y ocultar logo 3D con un ligero retraso
          setTimeout(() => {
            if (svgOverlay) svgOverlay.classList.add('visible');
            webgl.setLogoVisibility(false);
          }, 600);
        } else {
          // Ocultar SVG overlay y restaurar logo 3D
          if (svgOverlay) svgOverlay.classList.remove('visible');
          webgl.setLogoVisibility(true);
        }
      }
    });
  }, observerOptions);

  sections.forEach(section => {
    sectionObserver.observe(section);
  });

  // 9.5 NAVEGACIÓN POR CLICS (LENIS SCROLL)
  const navLinks = document.querySelectorAll('.mobile-menu a, .header-buttons a, .hero-sidebar-links a');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();

      const targetId = link.getAttribute('href');
      const targetSection = document.querySelector(targetId);
      if (!targetSection) return;

      // Cerrar menú móvil si está abierto
      if (mobileMenu) {
        mobileMenu.classList.remove('active');
      }
      if (menuToggle) {
        menuToggle.classList.remove('open');
      }

      // Hacer scroll suave hacia la sección
      if (targetSection) targetSection.classList.add('visible');

      isNavigating = true;

      const targetY = getTargetScrollForSection(targetSection);
      lenis.scrollTo(targetY, {
        duration: 1.5,
        onComplete: () => {
          setTimeout(() => { isNavigating = false; }, 100);
        }
      });
    });
  });

  // 10. MENÚ MÓVIL
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('active');
      menuToggle.classList.toggle('open');
    });
  }

  // 11. CENTRO MAGNÉTICO (SCROLL SNAPPING AUTOMÁTICO HABILITADO PERMANENTEMENTE)
  let snapTimeout = null;
  let snapSafetyTimer = null;

  const performSnap = () => {
    if (isSnapping || isNavigating) return;

    const scrollY = window.scrollY;

    let nearestSection = null;
    let minDistance = Infinity;
    let targetY = 0;

    sections.forEach(section => {
      const idealTargetY = getTargetScrollForSection(section);
      const distance = Math.abs(scrollY - idealTargetY);

      if (distance < minDistance) {
        minDistance = distance;
        nearestSection = section;
        targetY = idealTargetY;
      }
    });

    if (nearestSection) {
      // Evitar micro-ajustes si ya está casi perfectamente centrado
      if (Math.abs(targetY - scrollY) > 8) {
        isSnapping = true;

        // Forzar visibilidad
        nearestSection.classList.add('visible');

        // Timer de resiliencia para que isSnapping nunca se quede bloqueado
        if (snapSafetyTimer) clearTimeout(snapSafetyTimer);
        snapSafetyTimer = setTimeout(() => {
          isSnapping = false;
        }, 1100);

        lenis.scrollTo(targetY, {
          duration: 0.8,
          easing: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, // easeInOutQuad
          onComplete: () => {
            if (snapSafetyTimer) clearTimeout(snapSafetyTimer);
            setTimeout(() => {
              isSnapping = false;
            }, 50);
          }
        });
      }
    }
  };

  lenis.on('scroll', (e) => {
    updateSidebarState();

    if (snapTimeout) clearTimeout(snapTimeout);

    // Cancelar únicamente si el sistema está ejecutando una animación activa
    if (isSnapping || isNavigating) return;

    // Detectar si se llegó o está muy cerca del final de la página
    const scrollY = window.scrollY;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const isNearEnd = (scrollY >= maxScroll - 20);

    // Activar el encuadre magnético al ralentizarse o al llegar al extremo final de la página
    if (Math.abs(e.velocity) < 0.6 || isNearEnd) {
      snapTimeout = setTimeout(performSnap, 100);
    }
  });
});
