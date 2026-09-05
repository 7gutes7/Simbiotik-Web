import * as THREE from 'three';

export class LightPillar {
  constructor(container, options = {}) {
    this.container = container;
    if (!this.container) return;

    this.options = {
      topColor: options.topColor || '#5227FF',
      bottomColor: options.bottomColor || '#FF9FFC',
      intensity: options.intensity !== undefined ? options.intensity : 1.0,
      rotationSpeed: options.rotationSpeed !== undefined ? options.rotationSpeed : 0.3,
      interactive: options.interactive || false,
      glowAmount: options.glowAmount !== undefined ? options.glowAmount : 0.005,
      pillarWidth: options.pillarWidth !== undefined ? options.pillarWidth : 3.0,
      pillarHeight: options.pillarHeight !== undefined ? options.pillarHeight : 0.4,
      noiseIntensity: options.noiseIntensity !== undefined ? options.noiseIntensity : 0.5,
      pillarRotation: options.pillarRotation !== undefined ? options.pillarRotation : 0,
      quality: options.quality || 'high'
    };

    this.mouse = new THREE.Vector2(0, 0);
    this.time = 0;
    this.rafId = null;

    this.init();
  }

  parseColor(hex) {
    const color = new THREE.Color(hex);
    return new THREE.Vector3(color.r, color.g, color.b);
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    let effectiveQuality = this.options.quality;
    if (isMobile && effectiveQuality !== 'low') effectiveQuality = 'low';

    const qualitySettings = {
      low: { iterations: 24, waveIterations: 1, pixelRatio: 0.5, precision: 'mediump', stepMultiplier: 1.5 },
      medium: { iterations: 40, waveIterations: 2, pixelRatio: 0.65, precision: 'mediump', stepMultiplier: 1.2 },
      high: {
        iterations: 80,
        waveIterations: 4,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        precision: 'highp',
        stepMultiplier: 1.0
      }
    };

    const settings = qualitySettings[effectiveQuality] || qualitySettings.high;

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: effectiveQuality === 'high' ? 'high-performance' : 'low-power',
        precision: settings.precision,
        stencil: false,
        depth: false
      });
    } catch (e) {
      console.warn('LightPillar: WebGL not supported', e);
      return;
    }

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(settings.pixelRatio);
    this.container.appendChild(this.renderer.domElement);

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision ${settings.precision} float;

      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uMouse;
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform float uIntensity;
      uniform bool uInteractive;
      uniform float uGlowAmount;
      uniform float uPillarWidth;
      uniform float uPillarHeight;
      uniform float uNoiseIntensity;
      uniform float uRotCos;
      uniform float uRotSin;
      uniform float uPillarRotCos;
      uniform float uPillarRotSin;
      uniform float uWaveSin;
      uniform float uWaveCos;
      varying vec2 vUv;

      const float STEP_MULT = ${settings.stepMultiplier.toFixed(1)};
      const int MAX_ITER = ${settings.iterations};
      const int WAVE_ITER = ${settings.waveIterations};

      void main() {
        vec2 uv = (vUv * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
        uv = vec2(uPillarRotCos * uv.x - uPillarRotSin * uv.y, uPillarRotSin * uv.x + uPillarRotCos * uv.y);

        vec3 ro = vec3(0.0, 0.0, -10.0);
        vec3 rd = normalize(vec3(uv, 1.0));

        float rotC = uRotCos;
        float rotS = uRotSin;
        if(uInteractive && (uMouse.x != 0.0 || uMouse.y != 0.0)) {
          float a = uMouse.x * 6.283185;
          rotC = cos(a);
          rotS = sin(a);
        }

        vec3 col = vec3(0.0);
        float t = 0.1;
        
        for(int i = 0; i < MAX_ITER; i++) {
          vec3 p = ro + rd * t;
          p.xz = vec2(rotC * p.x - rotS * p.z, rotS * p.x + rotC * p.z);

          vec3 q = p;
          q.y = p.y * uPillarHeight + uTime;
          
          float freq = 1.0;
          float amp = 1.0;
          for(int j = 0; j < WAVE_ITER; j++) {
            q.xz = vec2(uWaveCos * q.x - uWaveSin * q.z, uWaveSin * q.x + uWaveCos * q.z);
            q += cos(q.zxy * freq - uTime * float(j) * 2.0) * amp;
            freq *= 2.0;
            amp *= 0.5;
          }
          
          float d = length(cos(q.xz)) - 0.2;
          float bound = length(p.xz) - uPillarWidth;
          float k = 4.0;
          float h = max(k - abs(d - bound), 0.0);
          d = max(d, bound) + h * h * 0.0625 / k;
          d = abs(d) * 0.15 + 0.01;

          float grad = clamp((15.0 - p.y) / 30.0, 0.0, 1.0);
          col += mix(uBottomColor, uTopColor, grad) / d;

          t += d * STEP_MULT;
          if(t > 50.0) break;
        }

        float widthNorm = uPillarWidth / 3.0;
        col = tanh(col * uGlowAmount / widthNorm);
        
        col -= fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) / 15.0 * uNoiseIntensity;
        
        gl_FragColor = vec4(col * uIntensity, 1.0);
      }
    `;

    const pillarRotRad = (this.options.pillarRotation * Math.PI) / 180;
    const waveSin = Math.sin(0.4);
    const waveCos = Math.cos(0.4);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(width, height) },
        uMouse: { value: this.mouse },
        uTopColor: { value: this.parseColor(this.options.topColor) },
        uBottomColor: { value: this.parseColor(this.options.bottomColor) },
        uIntensity: { value: this.options.intensity },
        uInteractive: { value: this.options.interactive },
        uGlowAmount: { value: this.options.glowAmount },
        uPillarWidth: { value: this.options.pillarWidth },
        uPillarHeight: { value: this.options.pillarHeight },
        uNoiseIntensity: { value: this.options.noiseIntensity },
        uRotCos: { value: 1.0 },
        uRotSin: { value: 0.0 },
        uPillarRotCos: { value: Math.cos(pillarRotRad) },
        uPillarRotSin: { value: Math.sin(pillarRotRad) },
        uWaveSin: { value: waveSin },
        uWaveCos: { value: waveCos }
      },
      transparent: true,
      depthWrite: false,
      depthTest: false
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(mesh);

    this.bindEvents();
    this.animate();
  }

  bindEvents() {
    this.onResize = () => {
      if (!this.renderer || !this.material || !this.container) return;
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      this.renderer.setSize(width, height);
      this.material.uniforms.uResolution.value.set(width, height);
    };
    window.addEventListener('resize', this.onResize, { passive: true });
  }

  animate() {
    this.time += 0.016 * this.options.rotationSpeed;
    if (this.material && this.renderer && this.scene && this.camera) {
      this.material.uniforms.uTime.value = this.time;
      this.material.uniforms.uRotCos.value = Math.cos(this.time * 0.3);
      this.material.uniforms.uRotSin.value = Math.sin(this.time * 0.3);

      // Calcular entrada con desenfoque (blur) y nitidez total en el centro de Manifiesto
      const manifiestoSec = document.getElementById('manifiesto');
      if (manifiestoSec && this.container) {
        const rect = manifiestoSec.getBoundingClientRect();
        const vh = window.innerHeight;
        const fadeZone = Math.min(400, vh * 0.5);
        let progress = 0;

        if (rect.top < vh && rect.top > vh - fadeZone) {
          // Entrada: de 0 (borroso e invisible) a 1 (nítido y visible)
          const t = (vh - rect.top) / fadeZone;
          progress = 0.5 - 0.5 * Math.cos(t * Math.PI);
        } else if (rect.top <= vh - fadeZone && rect.bottom >= fadeZone) {
          // Centro de la sección: 100% NÍTIDO y VISIBLE
          progress = 1.0;
        } else if (rect.bottom < fadeZone && rect.bottom > 0) {
          // Salida: de 1 (nítido) a 0 (borroso e invisible)
          const t = rect.bottom / fadeZone;
          progress = 0.5 - 0.5 * Math.cos(t * Math.PI);
        } else {
          progress = 0.0;
        }

        const opacity = progress;
        const blurPx = (1.0 - progress) * 25.0; // 25px al entrar/salir -> 0px en el centro nítido

        this.container.style.opacity = opacity.toFixed(3);
        this.container.style.filter = `blur(${blurPx.toFixed(1)}px)`;
      }

      this.renderer.render(this.scene, this.camera);
    }
    this.rafId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.onResize) {
      window.removeEventListener('resize', this.onResize);
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      if (this.container && this.container.contains(this.renderer.domElement)) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
  }
}
