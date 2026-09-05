import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';


// Vertex Shader para las partículas de fondo (Movimiento únicamente orbital alrededor del logo 3D)
const vertexShader = `
  uniform float uTime;
  uniform float uAudioFreq;
  uniform vec2 uMouse;
  uniform float uNewSectionProgress;
  attribute vec3 aRandoms;
  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    vec3 pos = position;
    
    // Interacción suave de deformación sólo al acercarse el cursor
    float distToMouse = distance(pos.xy, uMouse * 3.5);
    if (distToMouse < 1.8) {
      float force = (1.8 - distToMouse) * 0.25;
      pos.x += force * uMouse.x * 0.15;
      pos.y += force * uMouse.y * 0.15;
    }
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Tamaño de partícula estable según la profundidad de campo
    gl_PointSize = (14.0 / -mvPosition.z);
    
    vColor = color;
    vOpacity = (0.3 + 0.7 * sin(uTime * aRandoms.x + aRandoms.y)) * (1.0 - uNewSectionProgress);
  }
`;

// Vertex Shader para las 5,000 partículas en columna espiral que caen desde la parte superior
const spiralVertexShader = `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uNewSectionProgress;
  attribute float aIndex;
  attribute float aSizeScale;
  attribute float aColorFactor;
  attribute vec3 aRandomOffset; // x = velocidad vertical, y = velocidad angular, z = amplitud de deriva
  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    // Ciclo de vida muy lento y personalizado
    float lifetime = mod(uTime * 0.05 * aRandomOffset.x + aIndex * 0.0002, 1.0);
    
    // Cae lentamente desde la parte superior del hero (Y = 4.5) hacia abajo (Y = -4.5)
    // Se añade una pequeña fluctuación senoidal para simular resistencia al caer (aleatorio/orgánico)
    float y = 4.5 - (lifetime + sin(lifetime * 3.1415) * 0.05) * 9.0;
    
    // Espiral con rotación lenta y velocidad angular única por partícula
    float angle = aIndex * 0.05 + y * 1.8 + uTime * (0.08 * aRandomOffset.y);
    
    // Radio de la espiral ensanchándose suavemente al descender
    float radius = 0.15 + lifetime * 0.45;
    
    // Deriva horizontal lenta y aleatoria (efecto de polvo flotante/copos de nieve)
    float driftX = sin(uTime * (0.35 * aRandomOffset.x) + aIndex) * aRandomOffset.z * 1.8;
    float driftZ = cos(uTime * (0.3 * aRandomOffset.y) + aIndex * 1.3) * aRandomOffset.z * 1.8;
    
    vec3 pos = vec3(
      cos(angle) * radius + driftX,
      y,
      sin(angle) * radius + driftZ
    );
    
    // Interacción elástica con el cursor al pasar sobre ellas
    vec2 mouseCoords = uMouse * 3.5;
    float distToMouse = distance(pos.xy, mouseCoords);
    if (distToMouse < 1.6) {
      float force = (1.6 - distToMouse) * 0.45;
      vec2 pushDir = normalize(pos.xy - mouseCoords + vec2(0.001));
      pos.xy += pushDir * force * 0.7;
      pos.z += sin(uTime * 3.0 + distToMouse * 6.0) * force * 0.5;
    }
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Tamaño de partícula aleatorio y variable (aspecto de la imagen) - se agranda en la nueva sección
    gl_PointSize = (aSizeScale * 25.0 / -mvPosition.z) * (1.0 + uNewSectionProgress * 0.6);
    
    // Mezcla de colores Verde Aqua y Morado Neon
    vec3 colorAqua = vec3(0.0, 0.96, 0.83); // Verde Aqua
    vec3 colorPurple = vec3(0.85, 0.27, 0.93); // Morado Neon
    vColor = mix(colorAqua, colorPurple, aColorFactor);
    
    // Opacidad de burbuja translúcida que se desvanece en los extremos
    vOpacity = sin(lifetime * 3.14159) * (0.15 + aSizeScale * 0.35);
  }
`;

// Fragment Shader (GLSL)
const fragmentShader = `
  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    // Dibuja círculos suaves en lugar de cuadrados ásperos
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;
    
    float alpha = smoothstep(0.5, 0.05, dist) * vOpacity;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

// Fragment Shader para las partículas en espiral (Pellets Brillantes)
const spiralFragmentShader = `
  uniform float uNewSectionProgress;
  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;

    // 1. Apariencia original (círculo difuminado suave)
    float alphaOriginal = smoothstep(0.5, 0.05, dist) * vOpacity;
    vec4 colorOriginal = vec4(vColor, alphaOriginal);

    // 2. Apariencia de Pellet Brillante (esfera 3D con luz difusa y brillo especular)
    vec2 normalCoord = gl_PointCoord - vec2(0.5);
    float r2 = dot(normalCoord, normalCoord);
    float z = sqrt(max(0.25 - r2, 0.0));
    vec3 normal = normalize(vec3(normalCoord, z));
    
    // Dirección de luz desde la esquina superior derecha delantera
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.5));
    float diffuse = max(dot(normal, lightDir), 0.0);
    
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(lightDir + viewDir);
    float specular = pow(max(dot(normal, halfDir), 0.0), 20.0);
    
    // Pellet sumamente brillante con glow blanco y base de color
    vec3 pelletColor = vColor * (diffuse * 0.8 + 0.3) + vec3(specular * 1.6);
    // El pellet es sólido en el centro y se desvanece de golpe en los bordes
    float alphaPellet = smoothstep(0.5, 0.45, dist) * (vOpacity * 1.4);
    vec4 colorPellet = vec4(pelletColor, alphaPellet);

    // Mezclar ambos estados según la transición de sección y desvanecer al entrar
    gl_FragColor = mix(colorOriginal, colorPellet, uNewSectionProgress) * (1.0 - uNewSectionProgress);
  }
`;

// Colores y objetos auxiliares reutilizados dentro del bucle de animación.
// Antes se instanciaba un THREE.Color nuevo por malla y por frame dentro de los
// traverse(), lo que generaba basura constante para el recolector.
const COLOR_GRAY = new THREE.Color("#71717a");
const COLOR_CHROME = new THREE.Color("#ffffff");
const COLOR_SLENDER_BASE = new THREE.Color("#b87fbc");
const COLOR_SLENDER_GLOW = new THREE.Color("#f472b6");
const COLOR_SLENDER_EMISSIVE = new THREE.Color("#e879f9");
const COLOR_BLACK = new THREE.Color("#000000");
const DUMMY_BLOCK = new THREE.Object3D();
const DUMMY_NEON = new THREE.Object3D();

export class SimbiotikWebGL {
  constructor(options = {}) {
    this.canvas = document.getElementById('webgl-canvas');
    if (!this.canvas) return;

    // --- Resolución adaptativa -------------------------------------------
    // La escena está limitada por fill rate (decenas de miles de sprites additive
    // a pantalla completa), así que la cantidad de píxeles a rasterizar es la
    // palanca dominante. Arrancamos en máxima calidad y sólo bajamos un escalón
    // si el equipo no sostiene el presupuesto de frame.
    this.dprTiers = [2, 1.5, 1.25, 1];
    this.dprTierIndex = 0;
    // En pantallas de alta densidad el propio sobremuestreo ya suaviza los bordes,
    // de modo que el MSAA sólo añade coste sin diferencia perceptible.
    const useAntialias = (window.devicePixelRatio || 1) < 1.5;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: useAntialias,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(this.currentPixelRatio());
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.z = 6;

    // Inicializar canvas secundario dedicado para la cuadrícula 3D de terreno (waves-canvas)
    this.wavesCanvas = document.getElementById('waves-canvas');
    if (this.wavesCanvas) {
      this.wavesRenderer = new THREE.WebGLRenderer({
        canvas: this.wavesCanvas,
        antialias: useAntialias,
        alpha: true,
        powerPreference: "high-performance"
      });
      this.wavesRenderer.setPixelRatio(this.currentPixelRatio());
      this.wavesRenderer.setSize(window.innerWidth, window.innerHeight);
      this.wavesHidden = false;

      this.wavesScene = new THREE.Scene();
      this.wavesCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
      this.wavesCamera.position.z = 6;
    }

    this.uniforms = {
      uTime: { value: 0 },
      uAudioFreq: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uNewSectionProgress: { value: 0 }
    };

    this.logoMesh = null;
    this.logoSpinSpeed = 0.005;
    this.colorTheme = new THREE.Color("#38bdf8"); // Azul inicial (Fase Cero)
    this.logoVertices = null;
    this.logoParticles = null;
    this.logoParticleMode = false;
    this.slenderWomanMesh = null;
    this.slenderWomanGroup = null;
    this.isSlenderHovered = false;
    this.activeSection = 'inicio';
    this.currentLogoRotX = 0;

    // La descarga del logo 3D se lanza ANTES de construir la geometría de la
    // escena. Construirla primero costaba ~700 ms de CPU durante los cuales la
    // red estaba ociosa: la petición del modelo no salía hasta el segundo 1.9.
    if (options.logoUrl) {
      this.loadLogoModel(options.logoUrl);
    }

    this.initParticles();
    this.initSpiralParticles();
    this.initPlaceholderLogo();
    this.initTunnel();
    this.initGrass();
    this.initCodeVortex();
    // Este modelo sólo aparece en la sección Dimensión Alterna, la sexta. Cargarlo
    // en el arranque le robaba ancho de banda al logo principal, que sí se ve de
    // inmediato. Se pide cuando el navegador está ocioso, o antes si el usuario
    // llega a esa sección primero.
    this.slenderRequested = false;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2000));
    idle(() => this.ensureSlenderWomanModel(), { timeout: 4000 });
    this.setupSlenderInteractions();
    this.bindEvents();
    this.animate();
  }

  // Fondo de Partículas dispersas en forma de anillo tecnológico (Restaurado al original)
  initParticles() {
    const count = 12000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const randoms = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Distribución cilíndrica para simular una red
      const theta = Math.random() * Math.PI * 2;
      const radius = 2.0 + Math.random() * 4.0;
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8.0;
      positions[i * 3 + 2] = Math.sin(theta) * radius;

      // Color base
      colors[i * 3] = this.colorTheme.r;
      colors[i * 3 + 1] = this.colorTheme.g;
      colors[i * 3 + 2] = this.colorTheme.b;

      // Randoms para animar en shader
      randoms[i * 3] = 0.5 + Math.random() * 2.0;    // Velocidad
      randoms[i * 3 + 1] = Math.random() * Math.PI;  // Fase
      randoms[i * 3 + 2] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aRandoms', new THREE.BufferAttribute(randoms, 3));

    this.particleMaterial = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending
    });

    this.particleSystem = new THREE.Points(geometry, this.particleMaterial);
    this.scene.add(this.particleSystem);
  }

  // Columna de 5,000 partículas que brotan del centro hacia abajo en espiral
  initSpiralParticles() {
    const count = 5000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const indices = new Float32Array(count);
    const sizeScales = new Float32Array(count);
    const colorFactors = new Float32Array(count);
    const randomOffsets = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Las coordenadas iniciales se definen en el origen (0,0,0)
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      indices[i] = i;

      // Tamaño aleatorio variable (algunas pequeñas, medianas y burbujas grandes)
      sizeScales[i] = 0.2 + Math.random() * 2.3;

      // Factor de mezcla de color para combinar Verde Aqua y Morado Neon
      colorFactors[i] = Math.random();

      // Multiplicadores aleatorios para dar variedad orgánica al movimiento lento:
      randomOffsets[i * 3] = 0.7 + Math.random() * 0.6;     // Velocidad vertical
      randomOffsets[i * 3 + 1] = 0.5 + Math.random() * 1.0; // Velocidad de rotación
      randomOffsets[i * 3 + 2] = 0.1 + Math.random() * 0.4; // Deriva horizontal lateral
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aIndex', new THREE.BufferAttribute(indices, 1));
    geometry.setAttribute('aSizeScale', new THREE.BufferAttribute(sizeScales, 1));
    geometry.setAttribute('aColorFactor', new THREE.BufferAttribute(colorFactors, 1));
    geometry.setAttribute('aRandomOffset', new THREE.BufferAttribute(randomOffsets, 3));

    this.spiralTimeUniform = { value: 0 };

    this.spiralMaterial = new THREE.ShaderMaterial({
      vertexShader: spiralVertexShader,
      fragmentShader: spiralFragmentShader,
      uniforms: {
        uTime: this.spiralTimeUniform,
        uMouse: this.uniforms.uMouse,
        uNewSectionProgress: this.uniforms.uNewSectionProgress
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.spiralSystem = new THREE.Points(geometry, this.spiralMaterial);
    this.scene.add(this.spiralSystem);
  }

  // Genera un logotipo placeholder en 3D (Círculos concéntricos y un núcleo de luz)
  // en el centro del Hero, el cual girará hasta que el usuario suba el archivo .glb
  initPlaceholderLogo() {
    this.logoGroup = new THREE.Group();
    this.scene.add(this.logoGroup);

    // 1. Núcleo central luminoso
    const coreGeo = new THREE.SphereGeometry(0.4, 32, 32);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: this.colorTheme,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      metalness: 0.0,
      roughness: 0.0,
      transmission: 0.0
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.logoGroup.add(coreMesh);

    // 2. Anillo exterior giratorio
    const ringGeo = new THREE.RingGeometry(1.2, 1.25, 64);
    const ringMat = new THREE.MeshPhysicalMaterial({
      color: this.colorTheme,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
      metalness: 0.0,
      roughness: 0.0,
      transmission: 0.0
    });
    this.outerRing = new THREE.Mesh(ringGeo, ringMat);
    this.logoGroup.add(this.outerRing);

    // 3. Algunas líneas orbitantes
    const points = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(theta) * 0.8, 0, Math.sin(theta) * 0.8));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({ color: this.colorTheme, transparent: true, opacity: 0.3 });
    this.innerRing = new THREE.Line(lineGeo, lineMat);
    this.innerRing.rotation.x = Math.PI / 4;
    this.logoGroup.add(this.innerRing);
    this.sampleLogoVertices();
  }

  // Genera el túnel 3D de bloques metálicos púrpuras y luces de neón (5000 bloques con InstancedMesh)
  initTunnel() {
    this.tunnelGroup = new THREE.Group();
    this.scene.add(this.tunnelGroup);

    this.tunnelScrollOffset = 0;

    // Material metálico púrpura oscuro brillante para los bloques
    this.blockMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#0c021f"), // Púrpura muy oscuro
      metalness: 0.95,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.0
    });

    // Tiras de neón brillantes (fucsia/morado)
    this.neonMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#e879f9"), // Fucsia
      transparent: true,
      opacity: 0.0
    });

    this.neonPurpleMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#c084fc"), // Morado claro
      transparent: true,
      opacity: 0.0
    });

    const blockGeo = new THREE.BoxGeometry(0.8, 0.15, 1.85);
    const neonGeo = new THREE.BoxGeometry(0.08, 0.05, 1.87);

    // InstancedMesh de 5000 bloques y 5000 neones para rendimiento de 60FPS
    this.blockInstanced = new THREE.InstancedMesh(blockGeo, this.blockMaterial, 5000);
    this.neonInstanced = new THREE.InstancedMesh(neonGeo, this.neonMaterial, 5000);

    this.tunnelGroup.add(this.blockInstanced);
    this.tunnelGroup.add(this.neonInstanced);

    this.instancedData = [];
    const spacing = 3.0;
    const countZ = 100; // 100 capas Z
    const blocksPerLayer = 50; // 50 bloques por capa = 5000 bloques totales

    // Dimensiones gigantes para ocupar toda la pantalla en cualquier relación de aspecto
    const radiusX = 6.8;
    const radiusY = 3.8;

    let index = 0;
    for (let l = 0; l < countZ; l++) {
      const zBase = -l * spacing;

      for (let b = 0; b < blocksPerLayer; b++) {
        let x = 0, y = 0, rotZ = 0;
        let neonOffsetX = 0;

        if (b < 15) {
          // Piso
          const pct = b / 14;
          x = -radiusX + pct * 2.0 * radiusX;
          y = -radiusY;
          rotZ = 0;
          neonOffsetX = Math.random() > 0.5 ? 0.3 : -0.3;
        } else if (b < 30) {
          // Techo
          const pct = (b - 15) / 14;
          x = -radiusX + pct * 2.0 * radiusX;
          y = radiusY;
          rotZ = 0;
          neonOffsetX = Math.random() > 0.5 ? 0.3 : -0.3;
        } else if (b < 40) {
          // Pared Izquierda
          const pct = (b - 30) / 9;
          x = -radiusX;
          y = -radiusY + pct * 2.0 * radiusY;
          rotZ = Math.PI / 2;
          neonOffsetX = Math.random() > 0.5 ? 0.3 : -0.3;
        } else {
          // Pared Derecha
          const pct = (b - 40) / 9;
          x = radiusX;
          y = -radiusY + pct * 2.0 * radiusY;
          rotZ = Math.PI / 2;
          neonOffsetX = Math.random() > 0.5 ? 0.3 : -0.3;
        }

        // Pequeño desplazamiento aleatorio para un aspecto más orgánico y profundo
        x += (Math.random() - 0.5) * 0.15;
        y += (Math.random() - 0.5) * 0.15;

        this.instancedData.push({
          initialX: x,
          initialY: y,
          initialZ: zBase,
          rotZ: rotZ,
          neonOffsetX: neonOffsetX,
          index: index++
        });
      }
    }

    // Esfera blanca luminosa (el centro brillante al fondo)
    const glowGeo = new THREE.SphereGeometry(1.2, 32, 32);
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ffffff"),
      transparent: true,
      opacity: 0.0
    });
    this.glowMesh = new THREE.Mesh(glowGeo, this.glowMaterial);
    this.glowMesh.position.set(0, 0, -250); // Empujada más al fondo del túnel largo
    this.tunnelGroup.add(this.glowMesh);

    // Luces puntuales internas distribuidas a lo largo del túnel gigante
    this.tunnelLights = [];

    const colors = [0xd946ef, 0xa855f7, 0x3b82f6];
    for (let k = 0; k < 6; k++) {
      const zLight = -k * 50 - 10;
      const col = colors[k % colors.length];
      const light = new THREE.PointLight(col, 4.0, 40);
      light.position.set(0, 0, zLight);
      light.initialIntensity = 4.0;
      this.tunnelGroup.add(light);
      this.tunnelLights.push(light);
    }

    const finalWhiteLight = new THREE.PointLight(0xffffff, 10, 80);
    finalWhiteLight.position.set(0, 0, -245);
    finalWhiteLight.initialIntensity = 10.0;
    this.tunnelGroup.add(finalWhiteLight);
    this.tunnelLights.push(finalWhiteLight);
  }

  // Campo de pasto dinámico que aparece en la sección Manifiesto
  initGrass() {
    const count = 15000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const heights = new Float32Array(count);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    const baseX = new Float32Array(count);
    const baseZ = new Float32Array(count);
    const greenShade = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 28;
      const z = (Math.random() - 0.5) * 28 - 3;
      const h = 0.2 + Math.random() * 1.0;
      positions[i * 3] = x;
      positions[i * 3 + 1] = -2.0 + Math.random() * 0.1;
      positions[i * 3 + 2] = z;
      heights[i] = h;
      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 0.03 + Math.random() * 0.04;
      baseX[i] = x;
      baseZ[i] = z;
      greenShade[i] = 0.3 + Math.random() * 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aBaseX', new THREE.BufferAttribute(baseX, 1));
    geometry.setAttribute('aBaseZ', new THREE.BufferAttribute(baseZ, 1));
    geometry.setAttribute('aGreen', new THREE.BufferAttribute(greenShade, 1));

    this.grassMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMouse: this.uniforms.uMouse,
        uWindStrength: { value: 1.0 },
        uColor1: { value: new THREE.Color("#b88945") },
        uColor2: { value: new THREE.Color("#4a7c3f") },
        uOpacity: { value: 0 }
      },
      vertexShader: `
        uniform float uTime;
        uniform vec2 uMouse;
        uniform float uWindStrength;
        attribute float aHeight;
        attribute float aPhase;
        attribute float aSize;
        attribute float aBaseX;
        attribute float aBaseZ;
        attribute float aGreen;
        varying float vHeight;
        varying float vGreen;

        void main() {
          float windX = sin(uTime * 0.7 + aBaseX * 1.8 + aPhase) * 0.35 * uWindStrength;
          float windZ = cos(uTime * 0.5 + aBaseZ * 1.4 + aPhase * 0.7) * 0.25 * uWindStrength;
          float sway = windX * aHeight + cos(uTime * 0.3 + aBaseX * 2.5) * 0.05 * aHeight;

          vec3 pos = vec3(
            position.x + sway,
            position.y + aHeight * 0.5,
            position.z + windZ * aHeight * 0.3
          );

          vec2 mouseCoords = uMouse * 3.5;
          float dist = distance(pos.xz, mouseCoords);
          if (dist < 1.8) {
            float force = (1.8 - dist) * 0.4;
            vec2 dir = normalize(pos.xz - mouseCoords + vec2(0.001));
            pos.x += dir.x * force;
            pos.z += dir.y * force;
            pos.y += force * 0.2;
          }

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = aSize * (140.0 / -mvPosition.z);
          vHeight = aHeight;
          vGreen = aGreen;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform float uOpacity;
        varying float vHeight;
        varying float vGreen;

        void main() {
          float dist = distance(gl_PointCoord, vec2(0.5));
          if (dist > 0.5) discard;

          vec3 gold = uColor1;
          vec3 green = uColor2;
          vec3 bladeColor = mix(green, gold, vGreen);
          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          float alpha = glow * uOpacity * (0.5 + vGreen * 0.5);
          gl_FragColor = vec4(bladeColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.grassSystem = new THREE.Points(geometry, this.grassMaterial);
    this.grassSystem.visible = false;
    this.scene.add(this.grassSystem);
  }

  // Carga del modelo 3D definitivo o extrusión a partir del vector SVG
  loadLogoModel(url) {
    // Idempotente: la carga temprana del constructor no debe duplicarse si
    // alguien vuelve a llamar al método desde fuera.
    if (this.logoModelRequested === url) return;
    this.logoModelRequested = url;

    if (url.endsWith('.svg')) {
      this.loadLogoFromSVG(url);
    } else if (url.endsWith('.gltf') || url.endsWith('.glb')) {
      this.loadLogoFromGLTF(url);
    } else {
      this.loadLogoFromOBJ(url);
    }
  }

  // Carga de archivo GLTF/GLB y autoescalado para mantener las dimensiones del actual logo
  loadLogoFromGLTF(gltfUrl) {
    const loader = new GLTFLoader();

    loader.load(gltfUrl, (gltf) => {
      if (this.logoGroup) {
        this.scene.remove(this.logoGroup);
      }

      this.logoMesh = gltf.scene;

      const box = new THREE.Box3().setFromObject(this.logoMesh);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // La escala objetivo es la misma que la del logo SVG (aprox. 5.5 de dimensión máxima)
      const targetSize = 5.5;
      const scale = targetSize / maxDim;
      this.logoMesh.scale.set(scale, scale, scale);

      const center = box.getCenter(new THREE.Vector3());
      this.logoMesh.position.x = -center.x * scale;
      this.logoMesh.position.y = -center.y * scale;
      this.logoMesh.position.z = -center.z * scale;

      this.logoGroup = new THREE.Group();
      this.logoGroup.add(this.logoMesh);
      this.scene.add(this.logoGroup);

      this.logoMesh.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: this.colorTheme.clone(),
            transparent: true,
            opacity: 0.4,                      // Transparencia del 40% frente al HTML
            metalness: 0.0,                    // 0.0 Metálico (como en la imagen)
            roughness: 0.0,                    // 0.0 Rugosidad (brillo perfecto)
            transmission: 1.0,                 // 1.0 Transmisión (100% vidrio)
            thickness: 2.5,                    // Espesor grueso para refracciones
            ior: 2.65,                         // IOR de 2.65 (como en la imagen para refracción extrema)
            iridescence: 0.3,                  // Aberración cromática irisada muy sutil en los bordes
            iridescenceIOR: 1.3,
            iridescenceThicknessRange: [100, 800],
            clearcoat: 1.0,                    // Capa externa súper brillante
            clearcoatRoughness: 0.0,
            specularIntensity: 1.0,
            specularColor: new THREE.Color("#ffffff"),
            side: THREE.DoubleSide
          });
        }
      });

      this.addReflectiveLights();
      this.sampleLogoVertices();
      console.log("Logotipo 3D GLTF (Cristal Prismático) cargado exitosamente.");
    }, undefined, (error) => {
      console.error("Error cargando el modelo GLTF/GLB:", error);
    });
  }

  // Carga bajo demanda del modelo Slender, una sola vez
  ensureSlenderWomanModel() {
    if (this.slenderRequested) return;
    this.slenderRequested = true;
    this.loadSlenderWomanModel('./Slender_Woman_Lores.glb');
  }

  // Cargar modelo 3D Slender_Woman_Lores para la sección Manifiesto
  loadSlenderWomanModel(url) {
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
      this.slenderWomanMesh = gltf.scene;

      const box = new THREE.Box3().setFromObject(this.slenderWomanMesh);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // Escalar aumentado un 10% (5.2 * 1.35 * 0.8 * 0.75 * 1.1)
      const targetSize = 5.2 * 1.35 * 0.8 * 0.75 * 1.1;
      const scale = targetSize / (maxDim || 1);
      this.slenderWomanMesh.scale.set(scale, scale, scale);

      // Centrar modelo en su origen local
      const center = box.getCenter(new THREE.Vector3());
      this.slenderWomanMesh.position.x = -center.x * scale;
      this.slenderWomanMesh.position.y = -center.y * scale;
      this.slenderWomanMesh.position.z = -center.z * scale;

      this.slenderWomanGroup = new THREE.Group();
      this.slenderWomanGroup.add(this.slenderWomanMesh);

      // Posición en la escena: en el fondo profundo detrás de los contenedores (Z = -3.0)
      this.slenderWomanGroup.position.set(0, -0.5, -3.0);
      this.slenderWomanGroup.visible = false;
      this.scene.add(this.slenderWomanGroup);

      // Aplicar material físico elegante con el color #b87fbc
      this.slenderWomanMesh.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color("#b87fbc"),
            metalness: 0.65,
            roughness: 0.2,
            transmission: 0.25,
            thickness: 1.5,
            clearcoat: 1.0,
            clearcoatRoughness: 0.08,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide
          });
        }
      });
      console.log("Modelo 3D Slender Woman cargado para Manifiesto.");
    }, undefined, (err) => {
      console.warn("Error al cargar Slender_Woman_Lores.glb:", err);
    });
  }

  // Interacción de raycasting (hover ilumina modelo, clic despliega contenedores)
  setupSlenderInteractions() {
    this.slenderRaycaster = new THREE.Raycaster();
    this.slenderMouse = new THREE.Vector2();

    const updateMousePos = (e) => {
      this.slenderMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.slenderMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const handlePointerMove = (e) => {
      if (this.activeSection !== 'dimension-alterna' || !this.slenderWomanMesh) {
        if (this.isSlenderHovered) {
          this.isSlenderHovered = false;
          document.body.style.cursor = 'auto';
        }
        return;
      }
      updateMousePos(e);
      this.slenderRaycaster.setFromCamera(this.slenderMouse, this.camera);
      const intersects = this.slenderRaycaster.intersectObject(this.slenderWomanMesh, true);

      if (intersects.length > 0) {
        if (!this.isSlenderHovered) {
          this.isSlenderHovered = true;
          document.body.style.cursor = 'pointer';
        }
      } else {
        if (this.isSlenderHovered) {
          this.isSlenderHovered = false;
          document.body.style.cursor = 'auto';
        }
      }
    };

    const handleClick = (e) => {
      if (this.activeSection !== 'dimension-alterna' || !this.slenderWomanMesh) return;
      updateMousePos(e);
      this.slenderRaycaster.setFromCamera(this.slenderMouse, this.camera);
      const intersects = this.slenderRaycaster.intersectObject(this.slenderWomanMesh, true);

      if (intersects.length > 0) {
        this.toggleDimensionContainers();
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('click', handleClick);

    const triggerBtn = document.getElementById('slender-hint-trigger');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => {
        this.toggleDimensionContainers();
      });
    }
  }

  toggleDimensionContainers() {
    const artGrid = document.querySelector('.dimension-art-grid');
    if (artGrid) {
      artGrid.classList.toggle('expanded');
    }
  }

  // Vórtice de líneas de código en azul eléctrico en forma de huracán para la base del modelo 3D en El Manifiesto
  initCodeVortex() {
    const particleCount = 17000;
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(particleCount * 3);
    const spiralRadius = new Float32Array(particleCount);
    const spiralAngle = new Float32Array(particleCount);
    const armIndex = new Float32Array(particleCount);
    const sizeScale = new Float32Array(particleCount);
    const speed = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // Ojo central en r = 0.6, radio máximo extendido un +50% (r = 7.2)
      const r = 0.6 + Math.pow(Math.random(), 1.4) * 6.3;
      const angle = Math.random() * Math.PI * 2;
      const arm = Math.floor(Math.random() * 4); // 4 brazos espirales principales

      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      spiralRadius[i] = r;
      spiralAngle[i] = angle;
      armIndex[i] = arm;
      sizeScale[i] = 0.6 + Math.random() * 1.4;
      speed[i] = 0.7 + Math.random() * 0.6;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSpiralRadius', new THREE.BufferAttribute(spiralRadius, 1));
    geometry.setAttribute('aSpiralAngle', new THREE.BufferAttribute(spiralAngle, 1));
    geometry.setAttribute('aArmIndex', new THREE.BufferAttribute(armIndex, 1));
    geometry.setAttribute('aSizeScale', new THREE.BufferAttribute(sizeScale, 1));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));

    // Generar textura atlas para caracteres y líneas de código azul neón
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 512, 512);
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#00d2ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const codeTokens = [
      '0101011', '0x38BDF8', '{ code }', '=>', 'SIMBIOTIK',
      'fn()', '<vortex>', '01101', 'import', 'const=true;',
      '0x7F90', '[MANIFIESTO]', 'sync()', '01001', '&&'
    ];

    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const token = codeTokens[(y * 4 + x) % codeTokens.length];
        const px = x * 128 + 64;
        const py = y * 128 + 64;
        ctx.shadowColor = '#00d2ff';
        ctx.shadowBlur = 12;
        ctx.fillText(token, px, py);
      }
    }

    const codeTexture = new THREE.CanvasTexture(canvas);
    codeTexture.wrapS = THREE.RepeatWrapping;
    codeTexture.wrapT = THREE.RepeatWrapping;

    const vortexVertexShader = `
      uniform float uTime;
      uniform float uVortexOpacity;
      attribute float aSpiralRadius;
      attribute float aSpiralAngle;
      attribute float aArmIndex;
      attribute float aSizeScale;
      attribute float aSpeed;

      varying float vRadiusNorm;
      varying float vOpacity;
      varying vec3 vColor;

      void main() {
        // Rotación helicoidal tipo huracán (más rápida en el centro, suave en los bordes)
        float angularVelocity = (2.8 / (aSpiralRadius + 0.4)) * uTime * 0.35 * aSpeed;
        float currentAngle = aSpiralAngle + angularVelocity;

        // 4 brazos espirales principales (logarítmicos)
        float spiralOffset = log(aSpiralRadius + 1.0) * 2.2 + (aArmIndex * 1.57079);
        float finalAngle = currentAngle + spiralOffset;

        float r = aSpiralRadius + sin(uTime * 1.4 + aSpiralRadius * 3.0) * 0.08;

        // Posición en el plano XZ con ligera fluctuación senoidal en Y
        vec3 pos = vec3(
          cos(finalAngle) * r,
          sin(uTime * 1.8 + aSpiralRadius * 3.5) * 0.12,
          sin(finalAngle) * r
        );

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        gl_PointSize = (aSizeScale * 26.0 / -mvPosition.z) * uVortexOpacity;

        vRadiusNorm = (r - 0.6) / 6.3;

        // Degradado Azul Eléctrico -> Cyan Cibernético brillante
        vec3 colorCyan = vec3(0.0, 0.88, 1.0);   // Cyan neón (#00e1ff)
        vec3 colorBlue = vec3(0.12, 0.42, 0.98); // Azul vibrante (#1f6bff)
        vColor = mix(colorCyan, colorBlue, vRadiusNorm);

        // Ojo central vacío en r < 0.6 y desvanecimiento suave en los bordes externos extendidos (hasta r = 7.2)
        float eyeFade = smoothstep(0.5, 0.85, r);
        float edgeFade = 1.0 - smoothstep(5.4, 7.2, r);
        vOpacity = eyeFade * edgeFade * uVortexOpacity;
      }
    `;

    const vortexFragmentShader = `
      uniform sampler2D uTexture;
      varying float vRadiusNorm;
      varying float vOpacity;
      varying vec3 vColor;

      void main() {
        vec2 coord = gl_PointCoord;
        float dist = distance(coord, vec2(0.5));
        if (dist > 0.5) discard;

        vec4 texColor = texture2D(uTexture, coord);
        float glow = pow(1.0 - dist * 2.0, 1.4);

        vec3 finalColor = vColor * (1.3 + glow);
        gl_FragColor = vec4(finalColor, vOpacity * glow * 0.9);
      }
    `;

    this.codeVortexMaterial = new THREE.ShaderMaterial({
      vertexShader: vortexVertexShader,
      fragmentShader: vortexFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uVortexOpacity: { value: 0 },
        uTexture: { value: codeTexture }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.codeVortexMesh = new THREE.Points(geometry, this.codeVortexMaterial);

    this.codeVortexGroup = new THREE.Group();
    this.codeVortexGroup.add(this.codeVortexMesh);

    // Posicionamiento en el centro de la escena 3D con rotación de 90 grados sobre el eje X
    this.codeVortexGroup.position.set(0, 0, -0.5);
    this.codeVortexGroup.rotation.x = -Math.PI * 0.5; // 90 grados de rotación sobre el eje X
    this.codeVortexGroup.visible = false;

    this.scene.add(this.codeVortexGroup);
  }


  // Carga y extrusión del archivo SVG a 3D con material de Cristal Prismático
  loadLogoFromSVG(svgUrl) {
    const loader = new SVGLoader();

    loader.load(svgUrl, (data) => {
      // Remover el placeholder anterior
      if (this.logoGroup) {
        this.scene.remove(this.logoGroup);
      }

      const paths = data.paths;
      const group = new THREE.Group();

      // Ajustes de extrusión (grosor aumentado a 0.7 para darle presencia 3D sólida)
      const extrudeSettings = {
        depth: 0.7,
        bevelEnabled: true,
        bevelSegments: 5,
        steps: 2,
        bevelSize: 0.015,
        bevelThickness: 0.03
      };

      // Material de Cromo Espejo Brillante
      const chromeMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#e4e4e7"),   // Plata espejo brillante
        metalness: 1.0,                      // 100% Metálico
        roughness: 0.01,                     // Superficie de espejo altamente pulida
        clearcoat: 1.0,                      // Capa externa de brillo
        clearcoatRoughness: 0.01,
        side: THREE.DoubleSide
      });

      for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        const shapes = SVGLoader.createShapes(path);

        for (let j = 0; j < shapes.length; j++) {
          const shape = shapes[j];
          const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          const mesh = new THREE.Mesh(geometry, chromeMaterial.clone());
          group.add(mesh);
        }
      }

      // Los SVGs se cargan invertidos en el eje Y.
      // Retornamos el tamaño a su escala original para mayor presencia visual (doble de tamaño)
      group.scale.set(0.008, -0.008, 0.008);

      // Centrar el pivote del grupo extruido
      const box = new THREE.Box3().setFromObject(group);
      const center = box.getCenter(new THREE.Vector3());
      group.position.x = -center.x;
      group.position.y = -center.y;
      group.position.z = -center.z;

      // Envolverlo en el grupo de rotación principal
      this.logoMesh = group;
      this.logoGroup = new THREE.Group();
      this.logoGroup.add(this.logoMesh);
      this.scene.add(this.logoGroup);

      this.addReflectiveLights();
      this.sampleLogoVertices();
      console.log("Logotipo 3D extruido a partir de SVG (Cristal Prismático) cargado exitosamente.");
    }, undefined, (error) => {
      console.error("Error al cargar y extruir el archivo SVG:", error);
    });
  }

  // Carga de archivo OBJ tradicional con material cristalino
  loadLogoFromOBJ(objUrl) {
    const loader = new OBJLoader();

    loader.load(objUrl, (obj) => {
      if (this.logoGroup) {
        this.scene.remove(this.logoGroup);
      }

      this.logoMesh = obj;

      const box = new THREE.Box3().setFromObject(this.logoMesh);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      // Escala al doble de tamaño para máxima visualización
      const scale = 2.8 / maxDim;
      this.logoMesh.scale.set(scale, scale, scale);

      const center = box.getCenter(new THREE.Vector3());
      this.logoMesh.position.x = -center.x * scale;
      this.logoMesh.position.y = -center.y * scale;
      this.logoMesh.position.z = -center.z * scale;

      this.logoGroup = new THREE.Group();
      this.logoGroup.add(this.logoMesh);
      this.scene.add(this.logoGroup);

      this.logoMesh.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: this.colorTheme.clone(),
            transparent: true,
            opacity: 0.4,                      // Transparencia del 40% frente al HTML
            metalness: 0.0,                    // 0.0 Metálico (como en la imagen)
            roughness: 0.0,                    // 0.0 Rugosidad (brillo perfecto)
            transmission: 1.0,                 // 1.0 Transmisión (100% vidrio)
            thickness: 2.5,                    // Espesor grueso para refracciones
            ior: 2.65,                         // IOR de 2.65 (como en la imagen para refracción extrema)
            iridescence: 0.3,                  // Aberración cromática irisada muy sutil en los bordes
            iridescenceIOR: 1.3,
            iridescenceThicknessRange: [100, 800],
            clearcoat: 1.0,                    // Capa externa súper brillante
            clearcoatRoughness: 0.0,
            specularIntensity: 1.0,
            specularColor: new THREE.Color("#ffffff"),
            side: THREE.DoubleSide
          });
        }
      });

      this.addReflectiveLights();
      this.sampleLogoVertices();
      console.log("Logotipo 3D OBJ (Cristal Prismático) cargado exitosamente.");
    }, undefined, (error) => {
      console.error("Error cargando el modelo OBJ:", error);
    });
  }

  // Agrega iluminación direccional para hacer resaltar el acabado cromado
  addReflectiveLights() {
    if (!this.lightsAdded) {
      const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.0);
      dirLight1.position.set(5, 5, 5);
      this.scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0x0088ff, 1.5);
      dirLight2.position.set(-5, -5, 5);
      this.scene.add(dirLight2);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      this.scene.add(ambientLight);

      this.lightsAdded = true;
    }
  }

  // Mostrar/ocultar el logo 3D con transición (para reemplazarlo por SVG)
  setLogoVisibility(visible) {
    if (!this.logoGroup) return;
    gsap.to(this.logoGroup.scale, {
      x: visible ? 1 : 0,
      y: visible ? 1 : 0,
      z: visible ? 1 : 0,
      duration: 0.6,
      ease: 'power2.inOut'
    });
  }

  // Muestrear vértices del logo 3D para convertirlos en partículas
  sampleLogoVertices(maxCount = 8000) {
    if (!this.logoGroup) return;
    const tempVec = new THREE.Vector3();
    const allPositions = [];

    this.logoGroup.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const pos = child.geometry.attributes.position;
        if (!pos) return;
        const matrix = child.matrixWorld;
        for (let i = 0; i < pos.count; i++) {
          tempVec.set(pos.getX(i), pos.getY(i), pos.getZ(i));
          tempVec.applyMatrix4(matrix);
          allPositions.push(tempVec.clone());
        }
      }
    });

    if (allPositions.length === 0) return;

    if (allPositions.length > maxCount) {
      const step = allPositions.length / maxCount;
      this.logoVertices = [];
      for (let i = 0; i < maxCount; i++) {
        this.logoVertices.push(allPositions[Math.floor(i * step)]);
      }
    } else {
      this.logoVertices = allPositions;
    }
  }

  // Crear sistema de partículas a partir de los vértices muestreados
  createLogoParticles() {
    if (!this.logoVertices || this.logoVertices.length === 0) return;

    if (this.logoParticles) {
      this.scene.remove(this.logoParticles);
      this.logoParticles.geometry.dispose();
      this.logoParticles.material.dispose();
    }

    const count = this.logoVertices.length;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const offsets = new Float32Array(count * 3);
    const randoms = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const v = this.logoVertices[i];
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
      sizes[i] = 0.04 + Math.random() * 0.08;
      offsets[i * 3] = (Math.random() - 0.5) * 0.02;
      offsets[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      offsets[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
      randoms[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: this.colorTheme.clone() },
        uTime: { value: 0 },
        uOpacity: { value: 0 }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uOpacity;
        attribute float aSize;
        attribute vec3 aOffset;
        attribute float aRandom;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          float breathe = sin(uTime * 0.5 + aRandom) * 0.015;
          float drift = sin(uTime * 0.3 + aRandom * 2.0) * 0.008;
          vec3 pos = position + aOffset + vec3(drift, breathe, drift * 0.5);

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = aSize * (120.0 / -mvPosition.z);
          vAlpha = uOpacity;
          vColor = vec3(1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        varying vec3 vColor;

        void main() {
          float dist = distance(gl_PointCoord, vec2(0.5));
          if (dist > 0.5) discard;

          vec2 norm = gl_PointCoord - vec2(0.5);
          float r2 = dot(norm, norm);
          float z = sqrt(max(0.25 - r2, 0.0));
          vec3 normal = normalize(vec3(norm, z));
          vec3 lightDir = normalize(vec3(1.0, 1.0, 1.5));
          float diffuse = max(dot(normal, lightDir), 0.0);
          vec3 viewDir = vec3(0.0, 0.0, 1.0);
          vec3 halfDir = normalize(lightDir + viewDir);
          float specular = pow(max(dot(normal, halfDir), 0.0), 24.0);

          vec3 pearlColor = uColor * (diffuse * 0.7 + 0.3) + vec3(specular * 1.8);
          float alpha = smoothstep(0.5, 0.42, dist) * vAlpha;
          gl_FragColor = vec4(pearlColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.logoParticles = new THREE.Points(geometry, material);
    this.scene.add(this.logoParticles);
  }

  // Transicionar a modo partículas (descomposición del logo)
  transitionToParticles() {
    this.logoParticleMode = true;

    // Logo → partículas
    if (this.logoVertices && this.logoVertices.length > 0) {
      if (!this.logoParticles) this.createLogoParticles();
      if (this.logoParticles && this.logoParticles.material.uniforms) {
        gsap.to(this.logoParticles.material.uniforms.uOpacity, {
          value: 1, duration: 1.2, ease: 'power2.inOut'
        });
      }
    }

    gsap.to(this.logoGroup.scale, {
      x: 0, y: 0, z: 0,
      duration: 1.2,
      ease: 'power2.inOut'
    });

    // Mostrar campo de pasto dinámico
    if (this.grassSystem) {
      this.grassSystem.visible = true;
      if (this.grassMaterial) {
        gsap.to(this.grassMaterial.uniforms.uOpacity, {
          value: 0.7, duration: 1.5, ease: 'power2.inOut'
        });
      }
    }
  }

  // Restaurar modo sólido
  transitionToSolid() {
    if (!this.logoParticleMode) return;
    this.logoParticleMode = false;

    // Ocultar pasto
    if (this.grassSystem && this.grassMaterial) {
      gsap.to(this.grassMaterial.uniforms.uOpacity, {
        value: 0, duration: 0.8, ease: 'power2.inOut',
        onComplete: () => { this.grassSystem.visible = false; }
      });
    }

    if (this.logoParticles && this.logoParticles.material.uniforms) {
      gsap.to(this.logoParticles.material.uniforms.uOpacity, {
        value: 0,
        duration: 0.8,
        ease: 'power2.inOut',
        onComplete: () => {
          if (this.logoParticles) {
            this.scene.remove(this.logoParticles);
            this.logoParticles.geometry.dispose();
            this.logoParticles.material.dispose();
            this.logoParticles = null;
          }
        }
      });
    }

    gsap.to(this.logoGroup.scale, {
      x: 1, y: 1, z: 1,
      duration: 0.8,
      ease: 'power2.inOut'
    });
  }

  // Actualizar la paleta de color base e interpolarla
  updateColorTheme(colorHex) {
    const targetColor = new THREE.Color(colorHex);

    // Interpolar color base usando GSAP
    gsap.to(this.colorTheme, {
      r: targetColor.r,
      g: targetColor.g,
      b: targetColor.b,
      duration: 1.0,
      onUpdate: () => {
        // Actualizar el atributo de color en las partículas
        const colors = this.particleSystem.geometry.attributes.color.array;
        for (let i = 0; i < colors.length / 3; i++) {
          colors[i * 3] = this.colorTheme.r;
          colors[i * 3 + 1] = this.colorTheme.g;
          colors[i * 3 + 2] = this.colorTheme.b;
        }
        this.particleSystem.geometry.attributes.color.needsUpdate = true;

        // Actualizar materiales de los placeholders o del logo
        if (this.logoGroup) {
          this.logoGroup.traverse((child) => {
            if (child.isMesh) {
              if (child.material.color) child.material.color.copy(this.colorTheme);
              if (child.material.emissive) child.material.emissive.copy(this.colorTheme);
            } else if (child.isLine) {
              if (child.material.color) child.material.color.copy(this.colorTheme);
            }
          });
        }
      }
    });
  }

  // Inicialización del Agujero Negro 3D (Singularidad al 20% del diámetro del logotipo 3D)
  initBlackHole() {
    this.blackHoleGroup = new THREE.Group();

    // Diámetro del logotipo 3D = 2.8 unidades -> 20% del diámetro = 0.56 unidades (Radio = 0.28)
    const coreRadius = 0.28;
    const outerRadius = 0.65;

    // 1. Núcleo Oscuro (Horizonte de Sucesos)
    const coreGeo = new THREE.SphereGeometry(coreRadius, 64, 64);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.FrontSide
    });
    this.blackHoleCore = new THREE.Mesh(coreGeo, coreMat);
    this.blackHoleGroup.add(this.blackHoleCore);

    // 2. Anillo de Acreción Carmesí / Singularidad
    const glowGeo = new THREE.RingGeometry(coreRadius, outerRadius, 64);
    const glowMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vRadius;
        void main() {
          vUv = uv;
          vRadius = length(position.xy);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        varying vec2 vUv;
        varying float vRadius;

        void main() {
          float dist = (vRadius - 0.28) / 0.37;
          vec3 innerGlow = vec3(0.95, 0.12, 0.05); // Carmesí brillante
          vec3 outerGlow = vec3(0.40, 0.02, 0.01); // Carmesí profundo

          vec3 color = mix(innerGlow, outerGlow, dist);
          float ringPattern = sin(dist * 20.0 - uTime * 3.0) * 0.15 + 0.85;
          float alpha = uOpacity * smoothstep(0.0, 0.08, dist) * smoothstep(1.0, 0.2, dist) * ringPattern;

          gl_FragColor = vec4(color, alpha * 0.92);
        }
      `
    });

    this.blackHoleGlow = new THREE.Mesh(glowGeo, glowMat);
    this.blackHoleGlow.rotation.x = Math.PI / 2.5; // Inclinación estilizada
    this.blackHoleGroup.add(this.blackHoleGlow);

    // Centrado exactamente con el logo 3D en el fondo
    this.blackHoleGroup.position.set(0, 0, -0.2);
    this.blackHoleGroup.visible = false;
    this.scene.add(this.blackHoleGroup);
  }

  showBlackHole() {
    if (!this.blackHoleGroup) {
      this.initBlackHole();
    }
    if (this.blackHoleGroup) {
      this.blackHoleGroup.visible = true;
      if (this.blackHoleGlow && this.blackHoleGlow.material.uniforms) {
        gsap.to(this.blackHoleGlow.material.uniforms.uOpacity, {
          value: 1, duration: 1.2, ease: 'power2.inOut'
        });
      }
    }
  }

  hideBlackHole() {
    if (!this.blackHoleGroup) return;
    if (this.blackHoleGlow && this.blackHoleGlow.material.uniforms) {
      gsap.to(this.blackHoleGlow.material.uniforms.uOpacity, {
        value: 0, duration: 0.8, ease: 'power2.inOut',
        onComplete: () => { this.blackHoleGroup.visible = false; }
      });
    }
  }

  initWaterWaves() {
    // Malla 3D wireframe de alta densidad (vista dron estilo paisaje digital)
    const geo = new THREE.PlaneGeometry(60, 45, 140, 140);

    const mat = new THREE.ShaderMaterial({
      wireframe: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uMouse: this.uniforms.uMouse,
        uOpacity: { value: 0 }
      },
      vertexShader: `
        uniform float uTime;
        uniform vec2 uMouse;
        uniform float uOpacity;
        varying float vElevation;
        varying float vDepth;
        varying vec2 vUv;

        // Función matemática continua que genera relieve de montañas y valles
        float getElevation(vec2 p, float t) {
          // Desplazamiento continuo en Y simulando el vuelo infinito hacia al frente (bucle sin cortes)
          vec2 pos = vec2(p.x * 0.2, (p.y + t * 2.2) * 0.2);
          
          float h = 0.0;
          h += sin(pos.x * 0.8 + pos.y * 1.0) * 1.5;
          h += cos(pos.x * 0.5 - pos.y * 1.3) * 1.2;
          h += sin((pos.x + pos.y) * 1.8) * 0.6;
          h += cos(pos.x * 2.5 - pos.y * 2.0) * 0.35;
          h += sin(pos.x * 4.5 + pos.y * 4.0) * 0.15;
          return h;
        }

        void main() {
          vUv = uv;
          vec3 pos = position;

          // Calcular elevación del terreno
          float elevation = getElevation(pos.xy, uTime);

          // Interacción con el cursor: deformación y ondas dinámicas cerca del mouse
          vec2 mouseTarget = uMouse * vec2(15.0, 10.0);
          float distToMouse = distance(pos.xy, mouseTarget);
          float mouseRadius = 7.0;
          if (distToMouse < mouseRadius) {
            float mouseFactor = (1.0 - distToMouse / mouseRadius);
            float ripple = sin(distToMouse * 2.2 - uTime * 3.5) * 0.6 * mouseFactor;
            elevation += ripple + mouseFactor * 0.8;
          }

          vElevation = elevation;
          pos.z += elevation;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          vDepth = -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        varying float vElevation;
        varying float vDepth;
        varying vec2 vUv;

        void main() {
          // Líneas wireframe en tonos grises/carbón elegantes sobre fondo blanco
          vec3 valleyColor = vec3(0.12, 0.15, 0.20);
          vec3 peakColor   = vec3(0.35, 0.40, 0.48);

          float hNorm = clamp((vElevation + 2.0) / 4.5, 0.0, 1.0);
          vec3 lineColor = mix(valleyColor, peakColor, hNorm);

          // Integración y difuminado suave de bordes
          float fadeX = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
          float fadeY = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
          float edgeAlpha = fadeX * fadeY;

          // Niebla de profundidad hacia el horizonte
          float fogFactor = smoothstep(35.0, 10.0, vDepth);

          float alpha = uOpacity * edgeAlpha * fogFactor * 0.75;

          gl_FragColor = vec4(lineColor, alpha);
        }
      `
    });

    this.waterWaves = new THREE.Mesh(geo, mat);
    // Posicionamiento de cámara estilo vista de dron inclinado hacia el frente
    this.waterWaves.position.set(0, -1.8, -8.0);
    this.waterWaves.rotation.x = -1.25;
    this.waterWaves.visible = false;
    const targetScene = this.wavesScene || this.scene;
    targetScene.add(this.waterWaves);
  }

  showWaterWaves() {
    if (!this.waterWaves) {
      this.initWaterWaves();
    }
    if (this.waterWaves) {
      this.waterWaves.visible = true;
      if (this.waterWaves.material.uniforms) {
        gsap.to(this.waterWaves.material.uniforms.uOpacity, {
          value: 1, duration: 1.5, ease: 'power2.inOut'
        });
      }
    }
  }

  hideWaterWaves() {
    if (!this.waterWaves) return;
    if (this.waterWaves.material.uniforms) {
      gsap.to(this.waterWaves.material.uniforms.uOpacity, {
        value: 0, duration: 0.8, ease: 'power2.inOut',
        onComplete: () => { this.waterWaves.visible = false; }
      });
    }
  }

  // Manejar el cambio de posición de la cámara según la sección activa (Efecto Cinematic Scroll)
  triggerSectionTransition(sectionId) {
    this.activeSection = sectionId;

    // Si el visitante llega a Dimensión Alterna antes de que el navegador
    // haya estado ocioso, se fuerza la carga del modelo en ese momento.
    if (sectionId === 'dimension-alterna') {
      this.ensureSlenderWomanModel();
    }
    let targetCamZ = 6;
    let targetCamY = 0;
    let targetCamX = 0;
    let targetRotationY = 0;

    // Restaurar modo sólido si estaba en partículas
    if (this.logoParticleMode) {
      this.transitionToSolid();
    }

    // Mostrar agujero negro en la sección Agujero Negro (memoria-intro) y conservarlo en Memoria Natural (memoria-natural)
    if (sectionId === 'memoria-intro' || sectionId === 'memoria-natural') {
      this.showBlackHole();
    } else {
      this.hideBlackHole();
    }

    // Terreno wireframe 3D activo desde Agujero Negro (memoria-intro) y continuando en Memoria Natural (memoria-natural)
    if (sectionId === 'memoria-intro' || sectionId === 'memoria-natural') {
      this.showWaterWaves();
    } else {
      this.hideWaterWaves();
    }

    switch (sectionId) {
      case 'inicio':
        targetCamZ = 6;
        targetCamY = 0;
        targetCamX = 0;
        this.logoSpinSpeed = 0.005;
        break;
      case 'simbiosis-sonido':
        targetCamZ = 6;
        targetCamY = 0;
        targetCamX = 0;
        this.logoSpinSpeed = 0.005;
        break;
      case 'memoria-intro':
        // Logo 3D centrado en el fondo y alejado 2 unidades sobre Z respecto a la base (targetCamZ = 7.0)
        targetCamZ = 7.0;
        targetCamX = 0.0;
        targetCamY = 0.0;
        this.logoSpinSpeed = 0.002;
        break;
      case 'memoria-natural':
        targetCamZ = 7.0;
        targetCamX = 0.0;
        targetCamY = 0.0;
        this.logoSpinSpeed = 0.002;
        break;
      case 'simbolo':
        // Logo 3D 100% de frente desplazado a la derecha en la escena (medio círculo frontal perfecto)
        targetCamZ = 4.5;
        targetCamX = 0.0;
        targetCamY = 0.0;
        this.logoSpinSpeed = 0.0;
        break;
      case 'dimension-alterna':
        // Fondo de partículas orbitando en tonos grises (centro magnético bajado 300px)
        targetCamZ = 6.5;
        targetCamX = 0.0;
        targetCamY = -1.5;
        this.logoSpinSpeed = 0.003;
        break;
      case 'manifiesto':
        // Logo 3D totalmente de frente, reducido un 20% y con 0% opacidad
        targetCamZ = 8.5;
        targetCamX = 0.0;
        targetCamY = 0.0;
        this.logoSpinSpeed = 0.0;
        break;
      case 'press-kit':
        // Logo 3D alejado y ubicado en el lado derecho de la pantalla rotando activamente sobre el eje Y
        targetCamZ = 9.5;
        targetCamX = -3.6;
        targetCamY = 0.0;
        this.logoSpinSpeed = 0.008;
        break;
      case 'contacto':
        // Logo 3D totalmente de frente, centrado y mostrando el círculo completo
        targetCamZ = 8.5;
        targetCamX = 0.0;
        targetCamY = 0.0;
        this.logoSpinSpeed = 0.0;
        break;
    }

    gsap.to(this.camera.position, {
      x: targetCamX,
      y: targetCamY,
      z: targetCamZ,
      duration: 1.8,
      ease: "power2.inOut",
      onUpdate: () => {
        if (this.wavesCamera) {
          this.wavesCamera.position.copy(this.camera.position);
        }
      }
    });
  }

  bindEvents() {
    // Escuchar movimiento del mouse y normalizar coordenadas
    window.addEventListener('mousemove', (e) => {
      this.uniforms.uMouse.value.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.uniforms.uMouse.value.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }, { passive: true });

    // Un resize dispara decenas de eventos durante el arrastre y cada setSize
    // reasigna los buffers de ambos renderers. Coalescemos a un ajuste por frame.
    window.addEventListener('resize', () => {
      if (this.resizePending) return;
      this.resizePending = true;
      requestAnimationFrame(() => {
        this.resizePending = false;
        this.applyResize();
      });
    }, { passive: true });
  }

  // El fondo de galaxias tiene dos animaciones infinitas, una de ellas con un
  // blur de 20px sobre una superficie del doble del viewport en cada eje. Con
  // opacidad 0 seguía animándose y componiéndose en las 8 secciones donde no se
  // ve. Se oculta de verdad, pero sólo después de que termine la transición de
  // 1.5s del CSS, para no cortar el desvanecido.
  updateGalaxyIdleState(opacity) {
    if (!this.galaxyBg) return;

    if (opacity > 0) {
      if (this.galaxyIdleTimer) {
        clearTimeout(this.galaxyIdleTimer);
        this.galaxyIdleTimer = null;
      }
      if (this.galaxyIdle) {
        this.galaxyBg.classList.remove('galaxy-idle');
        this.galaxyIdle = false;
      }
      return;
    }

    if (this.galaxyIdle || this.galaxyIdleTimer) return;

    this.galaxyIdleTimer = setTimeout(() => {
      this.galaxyIdleTimer = null;
      if (this.lastGalaxyOpacity === 0) {
        this.galaxyBg.classList.add('galaxy-idle');
        this.galaxyIdle = true;
      }
    }, 1700);
  }

  // Densidad de píxeles efectiva del escalón de calidad actual
  currentPixelRatio() {
    return Math.min(window.devicePixelRatio || 1, this.dprTiers[this.dprTierIndex]);
  }

  applyResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = this.currentPixelRatio();

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);

    if (this.wavesCamera && this.wavesRenderer) {
      this.wavesCamera.aspect = w / h;
      this.wavesCamera.updateProjectionMatrix();
      this.wavesRenderer.setPixelRatio(dpr);
      this.wavesRenderer.setSize(w, h);
    }
  }

  // Mide el tiempo de frame en ventanas de ~45 muestras y ajusta la resolución.
  // Con histéresis: baja rápido cuando se sufre, sube despacio y deja de intentar
  // subir tras varias degradaciones para no oscilar.
  updateAdaptiveResolution() {
    const now = performance.now();

    if (this.lastFrameStamp === undefined) {
      this.lastFrameStamp = now;
      this.frameSamples = [];
      this.stableWindows = 0;
      this.downgrades = 0;
      return;
    }

    const delta = now - this.lastFrameStamp;
    this.lastFrameStamp = now;

    // Descartar saltos ajenos al render (cambio de pestaña, bloqueo del sistema)
    if (delta > 200) return;

    this.frameSamples.push(delta);
    if (this.frameSamples.length < 45) return;

    this.frameSamples.sort((a, b) => a - b);
    const median = this.frameSamples[this.frameSamples.length >> 1];
    this.frameSamples.length = 0;

    if (median > 20 && this.dprTierIndex < this.dprTiers.length - 1) {
      // Por debajo de ~50 fps: bajar un escalón de resolución
      this.dprTierIndex++;
      this.downgrades++;
      this.stableWindows = 0;
      this.applyResize();

      // Dos degradaciones seguidas significan que bajar resolución no bastó:
      // el equipo tampoco sostiene las capas de composición del CSS. Se apagan
      // los efectos más caros (desenfoque de fondo de los paneles, scanlines
      // con mezcla a pantalla completa) a favor de la fluidez.
      if (this.downgrades >= 2 && !this.lowPerfMode) {
        this.lowPerfMode = true;
        document.body.classList.add('perf-low');
      }
    } else if (median < 13 && this.dprTierIndex > 0 && this.downgrades < 3) {
      // Holgura clara y sostenida: recuperar calidad
      this.stableWindows++;
      if (this.stableWindows >= 4) {
        this.dprTierIndex--;
        this.stableWindows = 0;
        this.applyResize();
      }
    } else {
      this.stableWindows = 0;
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Con la pestaña en segundo plano el navegador estrangula el rAF pero el
    // frame se sigue calculando y componiendo. Salir aquí lo evita por completo.
    if (document.hidden) return;

    this.updateAdaptiveResolution();

    // Incrementar variable de tiempo para ondas y ruido
    this.uniforms.uTime.value += 0.012;

    // Simular pulsación sónica basada en ruido sinusoidal (mantiene el movimiento dinámico sin MP3)
    const simulatedFreq = Math.abs(Math.sin(this.uniforms.uTime.value * 2.5)) * 0.15 + (Math.random() * 0.03);
    this.uniforms.uAudioFreq.value = simulatedFreq;

    // Calcular progreso de la sección Simbiosis Sonido
    // Nodos cacheados: antes se resolvían con getElementById + querySelector
    // en cada frame, 60 veces por segundo, para elementos que nunca cambian.
    if (this.simbiosisSection === undefined) {
      this.simbiosisSection = document.getElementById('simbiosis-sonido');
      this.galaxyBg = document.querySelector('.galaxy-background');
      this.lastGalaxyOpacity = -1;
    }

    const simbiosisSection = this.simbiosisSection;
    let newSectionProgress = 0.0;
    if (simbiosisSection) {
      const rect = simbiosisSection.getBoundingClientRect();
      const viewHeight = window.innerHeight;
      // Distancia entre el centro de la sección y el centro de la pantalla
      const sectionCenter = rect.top + rect.height / 2;
      const viewportCenter = viewHeight / 2;
      const dist = Math.abs(sectionCenter - viewportCenter);
      // Pico en 1.0 al estar centrado, decae a 0.0 si está a más de una pantalla de distancia
      newSectionProgress = Math.max(0.0, 1.0 - (dist / viewHeight));

      this.uniforms.uNewSectionProgress.value = newSectionProgress;

      // Actualizar opacidad del fondo de galaxias animado en el DOM.
      // Escribir sólo cuando el valor cambia de verdad evita invalidar el estilo
      // del elemento en cada frame (antes se reescribía siempre, incluso con el
      // mismo número, forzando trabajo de estilo y composición innecesario).
      if (this.galaxyBg) {
        const galaxyOpacity = Math.round(newSectionProgress * 100) / 100;
        if (galaxyOpacity !== this.lastGalaxyOpacity) {
          this.galaxyBg.style.opacity = galaxyOpacity;
          this.lastGalaxyOpacity = galaxyOpacity;
          this.updateGalaxyIdleState(galaxyOpacity);
        }
      }
    }

    // Animar la columna de partículas (se pausa progresivamente hasta detenerse en la sección Simbiosis)
    if (this.spiralTimeUniform) {
      const spiralSpeed = 0.012 * (1.0 - newSectionProgress);
      this.spiralTimeUniform.value += spiralSpeed;
    }

    // Animar túnel 3D de bloques púrpuras si estamos en la sección de Simbiosis
    if (this.blockInstanced) {
      if (newSectionProgress > 0) {
        // Movimiento ligero y suave hacia el centro brillante (Z negativo) - 25% más rápido (0.005)
        this.tunnelScrollOffset += 0.005 * (1.0 + simulatedFreq * 0.3);

        const spacing = 3.0;
        const totalZ = 300.0; // spacing * countZ = 3.0 * 100 = 300.0
        const maxZ = 0.0;
        const minZ = -300.0;

        // Mostrar túnel
        this.tunnelGroup.visible = true;

        const dummyBlock = DUMMY_BLOCK;
        const dummyNeon = DUMMY_NEON;

        this.instancedData.forEach((data) => {
          let z = data.initialZ - (this.tunnelScrollOffset * spacing);

          // Loop circular para mantener el túnel infinito
          z = z % totalZ;
          if (z > maxZ) z -= totalZ;
          if (z < minZ) z += totalZ;

          // Bloque
          dummyBlock.position.set(data.initialX, data.initialY, z);
          dummyBlock.rotation.set(0, 0, data.rotZ);
          dummyBlock.updateMatrix();
          this.blockInstanced.setMatrixAt(data.index, dummyBlock.matrix);

          // Neon
          let neonX = data.initialX;
          let neonY = data.initialY;
          if (data.rotZ === 0) {
            neonX += data.neonOffsetX;
            neonY += 0.091;
          } else {
            neonX += 0.091;
            neonY += data.neonOffsetX;
          }
          dummyNeon.position.set(neonX, neonY, z);
          dummyNeon.rotation.set(0, 0, data.rotZ);
          dummyNeon.updateMatrix();
          this.neonInstanced.setMatrixAt(data.index, dummyNeon.matrix);
        });

        this.blockInstanced.instanceMatrix.needsUpdate = true;
        this.neonInstanced.instanceMatrix.needsUpdate = true;

        // Opacidad de los materiales instanciados
        this.blockMaterial.opacity = newSectionProgress * 0.9;
        this.neonMaterial.opacity = newSectionProgress * 1.0;

        // Mostrar centro brillante y luces internas
        if (this.glowMesh) {
          this.glowMesh.material.opacity = newSectionProgress * 1.0;
          const scale = 1.0 + simulatedFreq * 0.25;
          this.glowMesh.scale.set(scale, scale, scale);
        }

        if (this.tunnelLights) {
          this.tunnelLights.forEach((light) => {
            light.intensity = (light.initialIntensity || 4.0) * newSectionProgress;
          });
        }
      } else {
        // Ocultar túnel completamente fuera de la sección para ahorrar rendimiento
        this.tunnelGroup.visible = false;

        this.blockMaterial.opacity = 0;
        this.neonMaterial.opacity = 0;

        if (this.glowMesh) {
          this.glowMesh.material.opacity = 0;
        }
        if (this.tunnelLights) {
          this.tunnelLights.forEach((light) => {
            light.intensity = 0;
          });
        }
      }
    }

    // El logo 3D permanece visible continuamente en todas las secciones (incluyendo Memoria Natural)
    if (this.logoGroup) {
      this.logoGroup.visible = true;
    }
    if (this.particleSystem) {
      this.particleSystem.visible = true;
      this.particleSystem.rotation.y += 0.0006;
    }

    // Rotar logotipo interactivo en base al scroll vertical (ajustado para dar exactamente la media vuelta en la sección Simbiosis)
    // Rotar logotipo interactivo en base al scroll vertical desde el primer momento
    if (this.logoGroup) {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const viewHeight = window.innerHeight;

      const simbiosisSec = document.getElementById('simbiosis-sonido');
      let centerScroll = 2.0 * viewHeight;
      if (simbiosisSec) {
        const secRect = simbiosisSec.getBoundingClientRect();
        centerScroll = scrollY + secRect.top + viewHeight;
      }

      // El giro del logo inicia de forma fluida desde el primer píxel de scroll
      const baseRotY = (scrollY / Math.max(1, centerScroll)) * Math.PI;
      const goldFactor = (1.0 - Math.cos(baseRotY)) / 2.0;

      // Lerp suave de rotaciones X, Y y Z para las secciones Memoria Natural y Agujero Negro
      const isMemoria = (this.activeSection === 'memoria-intro' || this.activeSection === 'memoria-natural');
      // Ocultar las partículas que caen de arriba a abajo en Agujero Negro, Memoria Natural, El Símbolo, Dimensión Alterna, El Manifiesto, Press Kit y Contacto
      const isHiddenSpiral = (isMemoria || this.activeSection === 'simbolo' || this.activeSection === 'dimension-alterna' || this.activeSection === 'manifiesto' || this.activeSection === 'press-kit' || this.activeSection === 'contacto');
      if (this.spiralSystem) {
        this.spiralSystem.visible = !isHiddenSpiral;
      }

      // Giro continuo alrededor del eje Z únicamente en la sección Memoria Natural
      if (isMemoria) {
        this.memoriaZSpin = (this.memoriaZSpin || 0) + 0.003;
      } else {
        this.memoriaZSpin = 0;
      }

      // Giro continuo alrededor del eje Y en la sección Press Kit
      const isPressKit = (this.activeSection === 'press-kit');
      if (isPressKit) {
        this.pressKitYSpin = (this.pressKitYSpin || 0) + (this.logoSpinSpeed || 0.008);
      } else {
        this.pressKitYSpin = 0;
      }

      const isSimbolo = (this.activeSection === 'simbolo');
      const isManifiesto = (this.activeSection === 'manifiesto');
      const targetRotX = isMemoria ? ((110 * Math.PI) / 180) : 0;        // 110 grados en X
      const targetRotYOffset = isMemoria ? ((100 * Math.PI) / 180) : ((isSimbolo || isManifiesto) ? ((50 * Math.PI) / 180) : 0); // 50 grados en Y para El Símbolo y Manifiesto
      const targetRotZ = isMemoria ? (-Math.PI / 10) : 0;              // Inclinación diagonal previa (-18 deg)

      // Escalar la profundidad Z al 25% (0.25) únicamente en la sección Memoria Natural
      const targetScaleZ = isMemoria ? 0.25 : 1.0;

      if (this.currentLogoRotX === undefined) this.currentLogoRotX = 0;
      if (this.currentLogoRotYOffset === undefined) this.currentLogoRotYOffset = 0;
      if (this.currentLogoRotZ === undefined) this.currentLogoRotZ = 0;
      if (this.currentLogoScaleZ === undefined) this.currentLogoScaleZ = 1.0;

      this.currentLogoRotX += (targetRotX - this.currentLogoRotX) * 0.05;
      this.currentLogoRotYOffset += (targetRotYOffset - this.currentLogoRotYOffset) * 0.05;
      this.currentLogoRotZ += (targetRotZ - this.currentLogoRotZ) * 0.05;
      this.currentLogoScaleZ += (targetScaleZ - this.currentLogoScaleZ) * 0.05;

      const isContacto = (this.activeSection === 'contacto');
      const isManifiestoSection = (this.activeSection === 'manifiesto');
      const isSimboloSection = (this.activeSection === 'simbolo');
      if (isContacto || isManifiestoSection || isSimboloSection) {
        // En Contacto, Manifiesto y El Símbolo: alinear el logo 3D 100% de frente (sin inclinación X/Z ni giro Y)
        const idealY = baseRotY + this.currentLogoRotYOffset;
        const targetFrontY = Math.round(idealY / (Math.PI * 2)) * Math.PI * 2;
        if (this.contactoRotY === undefined) this.contactoRotY = idealY;
        this.contactoRotY += (targetFrontY - this.contactoRotY) * 0.08;

        const simboloYAngle = isSimboloSection ? ((-28 * Math.PI) / 180) : 0;
        this.logoGroup.rotation.x += (0 - this.logoGroup.rotation.x) * 0.08;
        this.logoGroup.rotation.y = this.contactoRotY + simboloYAngle;
        this.logoGroup.rotation.z += (0 - this.logoGroup.rotation.z) * 0.08;

        // En Manifiesto: reducir tamaño un 20% (escala 0.8), en El Símbolo: aumentar un 20% (escala 1.2)
        const targetScale = isManifiestoSection ? 0.8 : (isSimboloSection ? 1.2 : 1.0);
        this.logoGroup.scale.set(targetScale, targetScale, targetScale);

        // Posicionamiento X del logo en El Símbolo (desplazado 10px hacia la derecha)
        const targetLogoX = isSimboloSection ? 4.3 : 0.0;
        if (this.currentLogoPosX === undefined) this.currentLogoPosX = 0.0;
        this.currentLogoPosX += (targetLogoX - this.currentLogoPosX) * 0.08;
        this.logoGroup.position.x = this.currentLogoPosX;
      } else {
        this.contactoRotY = undefined;
        this.logoGroup.rotation.y = baseRotY + this.currentLogoRotYOffset + this.pressKitYSpin;
        this.logoGroup.rotation.x = this.currentLogoRotX;
        this.logoGroup.rotation.z = this.currentLogoRotZ + this.memoriaZSpin;
        this.logoGroup.scale.set(1.0, 1.0, this.currentLogoScaleZ);

        if (this.currentLogoPosX === undefined) this.currentLogoPosX = 0.0;
        this.currentLogoPosX += (0.0 - this.currentLogoPosX) * 0.08;
        this.logoGroup.position.x = this.currentLogoPosX;
      }

      // Animar el texto de la sección Simbiosis: entra por la izquierda, se centra perfecto y sale rápidamente por la derecha
      const simbiosisTitle = document.querySelector('.simbiosis-title');
      if (simbiosisTitle) {
        // Desfase normalizado respecto al centro magnético exacto (-1 al inicio, 0 al centro, +1 al final)
        const offset = (scrollY - centerScroll) / viewHeight;

        let shiftX = 0;
        let opacity = 0;

        if (offset <= 0) {
          // Entrada desde la izquierda hacia el centro magnético (-60vw a 0vw)
          shiftX = offset * 60;
          opacity = Math.max(0, 1.0 - Math.pow(Math.abs(offset), 1.2));
        } else {
          // Salida acelerada hacia la derecha para desaparecer totalmente antes de Memoria Natural
          shiftX = offset * 130; // Movimiento más rápido a la derecha
          opacity = Math.max(0, 1.0 - offset * 2.5); // Desaparece a 0 opacidad en offset ~0.4
        }

        simbiosisTitle.style.transform = `translateX(${shiftX}vw)`;
        simbiosisTitle.style.opacity = opacity;
      }

      // Calcular el desvanecimiento del Agujero Negro al entrar y estar en Memoria Natural
      const memoriaSec = document.getElementById('memoria-natural');
      let memoriaCenterProgress = 1.0; // 1.0 visible, 0.0 totalmente desvanecido

      if (memoriaSec) {
        const rect = memoriaSec.getBoundingClientRect();
        const vh = window.innerHeight;
        const fadeZone = Math.min(250, vh * 0.3);

        if (rect.top <= vh && rect.top > vh - fadeZone) {
          // Entrada: desvanecimiento suave al ingresar totalmente a la sección Memoria Natural
          const t = (rect.top - (vh - fadeZone)) / fadeZone;
          memoriaCenterProgress = 0.5 - 0.5 * Math.cos(t * Math.PI);
        } else if (rect.top <= vh - fadeZone && rect.bottom >= fadeZone) {
          // Cuerpo principal: PERMANECE 100% OCULTO (opacidad 0)
          memoriaCenterProgress = 0.0;
        } else if (rect.bottom < fadeZone && rect.bottom > 0) {
          // Salida: reaparece progresivamente al tocar el borde inferior de Memoria Natural
          const t = (fadeZone - rect.bottom) / fadeZone;
          memoriaCenterProgress = 0.5 - 0.5 * Math.cos(t * Math.PI);
        } else if (rect.top > vh || rect.bottom <= 0) {
          memoriaCenterProgress = 1.0;
        }
      }

      // Aplicar visibilidad y opacidad al Agujero Negro 3D
      if (this.blackHoleGroup) {
        const isBlackHoleSec = (this.activeSection === 'memoria-intro' || this.activeSection === 'memoria-natural');
        this.blackHoleGroup.visible = isBlackHoleSec && (memoriaCenterProgress > 0.001);

        if (this.blackHoleGlow && this.blackHoleGlow.material.uniforms) {
          this.blackHoleGlow.material.uniforms.uOpacity.value = memoriaCenterProgress;
        }
        if (this.blackHoleHalo && this.blackHoleHalo.material.uniforms) {
          this.blackHoleHalo.material.uniforms.uOpacity.value = memoriaCenterProgress;
        }
      }

      // Calcular el desvanecimiento gradual del Logotipo 3D al acercarse al centro magnético de Memoria Natural
      let logoCenterProgress = 1.0;
      if (memoriaSec) {
        const container = memoriaSec.querySelector('.container') || memoriaSec;
        const rect = container.getBoundingClientRect();
        const vh = window.innerHeight;
        const sectionCenterY = rect.top + rect.height / 2.0;
        const magneticCenterY = vh / 2.0 + 55;
        const distFromCenter = Math.abs(sectionCenterY - magneticCenterY);
        const deadZone = 30.0; // Rango al centro magnético donde desaparece por completo (opacidad 0)
        const fadeRadius = vh * 0.5;

        if (distFromCenter <= deadZone) {
          logoCenterProgress = 0.0;
        } else if (distFromCenter < fadeRadius) {
          const normDist = (distFromCenter - deadZone) / (fadeRadius - deadZone);
          // Curva coseno de desvanecimiento gradual al acercarse y reaparición gradual al bajar el scroll
          logoCenterProgress = 0.5 - 0.5 * Math.cos(normDist * Math.PI);
        }
      }

      // Opacidad combinada final del logotipo 3D (oculto al 0% en Dimensión Alterna y El Manifiesto)
      let sectionFadeProgress = (this.activeSection === 'dimension-alterna' || this.activeSection === 'manifiesto') ? 0.0 : 1.0;
      const combinedLogoProgress = Math.min(logoCenterProgress, sectionFadeProgress);

      // Aplicar visibilidad y opacidad al Logotipo 3D
      if (this.logoGroup) {
        this.logoGroup.visible = this.isLogoVisible && (combinedLogoProgress > 0.001);

        // Actualizar propiedades físicas del material para Contacto o fundir a metal cromo brillante (igual a El Símbolo)
        const isContacto = (this.activeSection === 'contacto');
        const grayColor = COLOR_GRAY;

        this.logoGroup.traverse((child) => {
          if (child.isMesh) {
            const mat = child.material;
            if (mat && mat.type === 'MeshPhysicalMaterial') {
              if (isContacto) {
                // En sección Contacto: color gris elegante y opacidad al 9%
                mat.color.copy(grayColor);
                mat.opacity = 0.09 * combinedLogoProgress;
                mat.transparent = true;
                mat.metalness = 0.1;
                mat.transmission = 0.2;
                mat.roughness = 0.3;
                mat.clearcoat = 0.5;
              } else {
                // Transición a cromo pulido líquido en el reverso y cristal prismático
                mat.metalness = goldFactor; // 0.0 en el frente (vidrio), 1.0 al reverso (metal cromo)
                mat.transmission = 1.0 - goldFactor; // 1.0 en el frente (transparente), 0.0 al reverso (opaco)
                mat.roughness = 0.1 * goldFactor + 0.0 * (1.0 - goldFactor); // 0.1 para reflejos satinados metálicos suaves
                mat.clearcoat = goldFactor * 1.0; // Capa de laca brillante líquida
                mat.clearcoatRoughness = 0.02; // Reflejo secundario nítido
                mat.opacity = (0.4 + goldFactor * 0.6) * combinedLogoProgress; // Desaparece al 0% en centro magnético
                mat.transparent = true;
                mat.thickness = 2.5 * (1.0 - goldFactor);

                // Interpolar color al blanco cromo brillante
                const chromeColor = COLOR_CHROME;
                mat.color.copy(this.colorTheme).lerp(chromeColor, goldFactor);
              }
            } else if (child.material) {
              if (isContacto) {
                if (child.material.color) child.material.color.copy(grayColor);
                child.material.opacity = 0.09 * combinedLogoProgress;
                child.material.transparent = true;
              }
            }
          }
        });
      }

      // Modelo 3D Slender Woman: únicamente activo en la sección Dimensión Alterna (centrado en el fondo)
      const isDimensionAlterna = (this.activeSection === 'dimension-alterna');

      if (this.slenderWomanGroup) {
        if (this.slenderWomanMesh) {
          const slenderBaseColor = COLOR_SLENDER_BASE;
          const slenderGlowColor = COLOR_SLENDER_GLOW; // Magenta/fucsia luminoso al hacer hover
          const targetColor = (isDimensionAlterna && this.isSlenderHovered) ? slenderGlowColor : slenderBaseColor;
          const targetOpacity = (isDimensionAlterna && this.isSlenderHovered) ? 0.95 : (isDimensionAlterna ? 0.3 : 0.0);

          let maxMeshOpacity = 0.0;

          this.slenderWomanMesh.traverse((child) => {
            if (child.isMesh && child.material) {
              // Interpolación lerp suave al 5% para un desvanecimiento fluido de entrada y salida
              child.material.opacity += (targetOpacity - child.material.opacity) * 0.05;
              child.material.transparent = true;
              child.material.color.lerp(targetColor, 0.08);
              if (child.material.emissive) {
                const emissiveTarget = (isDimensionAlterna && this.isSlenderHovered) ? COLOR_SLENDER_EMISSIVE : COLOR_BLACK;
                child.material.emissive.lerp(emissiveTarget, 0.08);
                child.material.emissiveIntensity = (isDimensionAlterna && this.isSlenderHovered) ? 0.8 : 0.0;
              }
              if (child.material.opacity > maxMeshOpacity) {
                maxMeshOpacity = child.material.opacity;
              }
            }
          });

          // Mantener visible la geometría hasta que la opacidad se haya desvanecido totalmente a 0
          this.slenderWomanGroup.visible = (maxMeshOpacity > 0.005);
        } else {
          this.slenderWomanGroup.visible = isDimensionAlterna;
        }

        if (this.slenderWomanGroup.visible) {
          // Centrado vertical respecto a la cámara, desplazado hacia abajo (-1.3) para dar espacio a los textos arriba
          this.slenderWomanGroup.position.y = this.camera.position.y - 1.3;
          this.slenderWomanGroup.position.z = -3.0;
          // Rotación sutil y fluida sobre el eje Y
          this.slenderWomanGroup.rotation.y += 0.003;
        }
      }

      // Vórtice giratorio de líneas de código azul en la base (únicamente en El Manifiesto)
      const isManifiestoSec = (this.activeSection === 'manifiesto');
      if (this.codeVortexGroup && this.codeVortexMaterial) {
        this.codeVortexGroup.visible = isManifiestoSec;
        if (this.codeVortexGroup.visible) {
          this.codeVortexMaterial.uniforms.uTime.value += 0.016;
          this.codeVortexMaterial.uniforms.uVortexOpacity.value = 1.0;
          this.codeVortexGroup.rotation.z += 0.004; // Giro helicoidal constante del vórtice de código
        }
      }
    }

    // Animar partículas del logo (descomposición en perlas)
    if (this.logoParticles && this.logoParticles.material.uniforms) {
      this.logoParticles.material.uniforms.uTime.value += 0.016;
      if (this.logoParticles.material.uniforms.uColor) {
        this.logoParticles.material.uniforms.uColor.value.copy(this.colorTheme);
      }
    }

    // Animar campo de pasto dinámico
    if (this.grassSystem && this.grassSystem.visible && this.grassMaterial) {
      this.grassMaterial.uniforms.uTime.value += 0.016;
    }

    // Animar terreno wireframe (vista dron + reacción sutil al cursor)
    if (this.waterWaves && this.waterWaves.visible && this.waterWaves.material.uniforms) {
      this.waterWaves.material.uniforms.uTime.value += 0.016;

      const targetRotY = this.uniforms.uMouse.value.x * 0.06;
      const targetRotZ = -this.uniforms.uMouse.value.y * 0.04;
      this.waterWaves.rotation.y += (targetRotY - this.waterWaves.rotation.y) * 0.05;
      this.waterWaves.rotation.z += (targetRotZ - this.waterWaves.rotation.z) * 0.05;
    }


    if (this.outerRing) {
      this.outerRing.rotation.z -= 0.004;
    }
    if (this.innerRing) {
      this.innerRing.rotation.y += 0.01;
    }

    this.renderer.render(this.scene, this.camera);

    // El canvas secundario contiene únicamente el terreno de olas, que está
    // invisible en 7 de las 9 secciones. Cuando no hay nada que dibujar se evita
    // el pase de render y además se saca la capa de la composición del navegador
    // (una superficie a pantalla completa menos por frame). Se oculta con
    // visibility para no tocar el z-index ni la transición de opacidad del CSS.
    if (this.wavesRenderer && this.wavesScene && this.wavesCamera) {
      // Se mira la opacidad real del material, no sólo el flag .visible: al
      // salir de Memoria Natural el fundido deja uOpacity en 0 pero el flag
      // podía quedarse en true, y entonces se seguía dibujando y componiendo
      // una capa a pantalla completa completamente transparente.
      const wavesOpacity = this.waterWaves?.material?.uniforms?.uOpacity?.value;
      const wavesActive = !!(
        this.waterWaves &&
        this.waterWaves.visible &&
        (wavesOpacity === undefined || wavesOpacity > 0.001)
      );

      if (wavesActive) {
        if (this.wavesHidden) {
          this.wavesCanvas.style.visibility = '';
          this.wavesHidden = false;
        }
        this.wavesRenderer.render(this.wavesScene, this.wavesCamera);
      } else if (!this.wavesHidden) {
        // Un clear final para no dejar congelado el último frame en el buffer
        this.wavesRenderer.clear();
        this.wavesCanvas.style.visibility = 'hidden';
        this.wavesHidden = true;
      }
    }
  }
}
