import './style.css';
import Lenis from 'lenis';
import { SimbiotikWebGL } from './webgl.js';
import { TextScramble } from './scramble.js';
import { tracks } from './audio.js';
import { PurpleRoom } from './purple-room.js';
import gsap from 'gsap';

document.addEventListener('DOMContentLoaded', () => {

  // 1. INICIALIZAR WEBGL CANVAS
  const webgl = new SimbiotikWebGL();

  // Carga del modelo 3D GLTF/GLB en formato Cromo Azul
  webgl.loadLogoModel('/smbtk1.glb');

  // Asa de depuracion: solo con ?debug=1 en la URL, nunca en una visita normal.
  if (new URLSearchParams(location.search).has('debug')) {
    window.__SMBK = webgl;
  }

  // 1.2 FONDO DE LA SECCION 2 (Simbiosis): Purple Wireframe Room
  const roomCanvas = document.getElementById('room-canvas');
  if (roomCanvas) {
    const purpleRoom = new PurpleRoom(roomCanvas);
    purpleRoom.start();
    // El bucle de render de webgl.js le pasa el avance de la cortina.
    webgl.purpleRoom = purpleRoom;
  }

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

    // 1. Hero / Inicio (Tope absoluto de pantalla)
    if (section.id === 'inicio') {
      return 0;
    }

    // 2. Simbiosis Sonido
    if (section.id === 'simbiosis-sonido') {
      const rect = section.getBoundingClientRect();
      const absTop = currentScrollY + rect.top;
      return Math.max(0, absTop + (rect.height > vh ? vh : rect.height / 2 - vh / 2));
    }

    // 3. Agujero Negro (memoria-intro): centro magnético anterior (-20px offset)
    if (section.id === 'memoria-intro') {
      const rect = section.getBoundingClientRect();
      const absTop = currentScrollY + rect.top;
      return Math.max(0, absTop - 20);
    }

    // 4. Memoria Natural: centro magnético subido 40px (-40px offset)
    if (section.id === 'memoria-natural') {
      const container = section.querySelector('.container') || section;
      const rect = container.getBoundingClientRect();
      const absTop = currentScrollY + rect.top;
      return Math.max(0, absTop + rect.height / 2 - vh / 2 - 55);
    }

    // 5. El Manifiesto: centro magnético alineado al encabezado y barra de navegación
    if (section.id === 'manifiesto') {
      const techSubtitle = section.querySelector('.tech-subtitle');
      if (techSubtitle) {
        const subRect = techSubtitle.getBoundingClientRect();
        return Math.max(0, currentScrollY + subRect.top - navbarHeight - 20);
      }
      const container = section.querySelector('.container') || section;
      const rect = container.getBoundingClientRect();
      return Math.max(0, currentScrollY + rect.top);
    }

    // 6. Press Kit: centro magnético dedicado para encuadrar perfectamente el contenido
    if (section.id === 'press-kit') {
      const container = section.querySelector('.container') || section;
      const rect = container.getBoundingClientRect();
      const absTop = currentScrollY + rect.top;
      return Math.max(0, absTop + rect.height / 2 - vh / 2 - 25);
    }

    // 4. Secciones Generales (Agujero Negro, Memoria Natural, El Símbolo, Press Kit, Contacto, etc.)
    // Calculamos el centro visual real del contenido de la sección para encuadrarlo en el centro exacto del viewport
    const contentElement = section.querySelector('.container') || section.querySelector('.symbol-text-panel') || section;
    const contentRect = contentElement.getBoundingClientRect();
    const contentAbsTop = currentScrollY + contentRect.top;

    // Fórmula universal: scroll necesario para que el centro del contenido quede exactamente a vh / 2
    const idealScroll = contentAbsTop + contentRect.height / 2 - vh / 2;

    return Math.max(0, idealScroll);
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
  manifestoItems.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'manifiesto-card glass-panel';
    card.innerHTML = `
      <span class="manifiesto-keyword">${item.keyword}</span>
      <p class="manifiesto-text">${item.text}</p>
    `;
    manifestoContainer.appendChild(card);
  });

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

  // Tag de la cabecera a la derecha del logo SIMBIOTIK
  const headerTechTag = document.querySelector('.header-tech-tag');
  const headerTagScrambler = headerTechTag ? new TextScramble(headerTechTag) : null;

  const sectionTagMap = {
    'inicio': '[ FRECUENCIA ACTIVA ]',
    'simbiosis-sonido': '[ SIMBIOSIS ]',
    'memoria-intro': '[ AGUJERO NEGRO ]',
    'memoria-natural': '[ MEMORIA NATURAL ]',
    'simbolo': '[ NÚCLEO REVELADO ]',
    'manifiesto': '[ MANIFIESTO ]',
    'press-kit': '[ PRESS KIT ]',
    'contacto': '[ CONTACTO ]'
  };

  // Mapa de secciones a estados y colores
  const sectionStateMap = {
    'inicio': { state: 'idle', color: '#38bdf8' },
    'simbiosis-sonido': { state: 'idle', color: '#38bdf8' },
    'memoria-intro': { state: 'active', color: '#7f1d1d' },
    'memoria-natural': { state: 'active', color: '#0284c7' },
    'simbolo': { state: 'core', color: '#6d28d9' },
    'manifiesto': { state: 'memory', color: '#b88945' },
    'press-kit': { state: 'memory', color: '#b88945' },
    'contacto': { state: 'signal', color: '#1e40af' }
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

        // Ocultar retícula técnica (.tech-grid) en las secciones Agujero Negro (memoria-intro), El Manifiesto (manifiesto) y Press Kit (press-kit)
        const techGrid = document.querySelector('.tech-grid');
        if (techGrid) {
          techGrid.style.transition = 'opacity 0.6s ease';
          if (sectionId === 'memoria-intro' || sectionId === 'manifiesto' || sectionId === 'press-kit') {
            techGrid.style.opacity = '0';
          } else {
            techGrid.style.opacity = '1';
          }
        }

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

        // Actualizar el tag tecnológico del header a la derecha del logo SIMBIOTIK con efecto scramble
        if (headerTechTag && sectionTagMap[sectionId]) {
          const newTagText = sectionTagMap[sectionId];
          if (headerTagScrambler) {
            headerTagScrambler.setText(newTagText);
          } else {
            headerTechTag.innerText = newTagText;
          }
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

  // 11. CENTRO MAGNÉTICO (SCROLL SNAPPING AUTOMÁTICO)
  let snapTimeout = null;

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

        lenis.scrollTo(targetY, {
          duration: 0.9,
          easing: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, // easeInOutQuad
          onComplete: () => {
            setTimeout(() => {
              isSnapping = false;
            }, 100);
          }
        });
      }
    }
  };

  lenis.on('scroll', (e) => {
    updateSidebarState();

    if (snapTimeout) clearTimeout(snapTimeout);

    // Cancelar si el sistema ya está realizando un snap o navegación programada
    if (isSnapping || isNavigating) return;

    // Activar inmediatamente el encuadre magnético al ralentizarse o soltar el scroll
    if (Math.abs(e.velocity) < 0.6) {
      snapTimeout = setTimeout(performSnap, 100);
    }
  });
});
