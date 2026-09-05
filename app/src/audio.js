// Lista de transmisiones (Tracks) de SimbiotiK
export const tracks = [
  {
    id: "1",
    title: "Dosis",
    file: "dosis.mp3",
    act: "El impulso",
    actNumber: 1,
    territory: "Instinto",
    mood: "Cuerpo + Deseo",
    corePhrase: "El cuerpo pide antes que la mente entienda.",
    guideColor: "#7f1d1d"
  },
  {
    id: "2",
    title: "Red social",
    file: "red_social.mp3",
    act: "El impulso",
    actNumber: 1,
    territory: "Deseo digital",
    mood: "Señal + Dualidad",
    corePhrase: "Detrás de cada pantalla hay piel buscando piel.",
    guideColor: "#38bdf8"
  },
  {
    id: "3",
    title: "Felina",
    file: "felina.mp3",
    act: "El impulso",
    actNumber: 1,
    territory: "Instinto",
    mood: "Energía primaria",
    corePhrase: "Lo salvaje no se domestica, se acepta.",
    guideColor: "#7f1d1d"
  },
  {
    id: "4",
    title: "Se te va a escapar",
    file: "se_te_va_a_escapar.mp3",
    act: "La señal",
    actNumber: 2,
    territory: "Renacimiento",
    mood: "Urgente, visceral",
    corePhrase: "Lo que no dices a tiempo, el silencio se lo queda.",
    guideColor: "#6d28d9"
  },
  {
    id: "5",
    title: "PragmatiK",
    file: "pragmatik.mp3",
    act: "La señal",
    actNumber: 2,
    territory: "Dualidad",
    mood: "Evolución",
    corePhrase: "La lógica no mata lo emocional; lo revela.",
    guideColor: "#38bdf8"
  },
  {
    id: "6",
    title: "Religion Rebelion",
    file: "religion_rebelion.mp3",
    act: "La señal",
    actNumber: 2,
    territory: "Rediseño interior",
    mood: "Mutación personal",
    corePhrase: "Cada fe tiene su rebelión pendiente.",
    guideColor: "#6d28d9"
  },
  {
    id: "7",
    title: "Tu misterio",
    file: "tu_misterio.mp3",
    act: "La señal",
    actNumber: 2,
    territory: "Oscuridad íntima",
    mood: "Ansiedad contenida",
    corePhrase: "Lo que no entiendes de alguien te transforma.",
    guideColor: "#6d28d9"
  },
  {
    id: "8",
    title: "Fluido temporal",
    file: "fluido_temporal.mp3",
    act: "La memoria natural",
    actNumber: 3,
    territory: "Tiempo alterado",
    mood: "Memoria + Evolución",
    corePhrase: "El tiempo no avanza: muta.",
    guideColor: "#b88945"
  },
  {
    id: "9",
    title: "Murmullos",
    file: "murmullos.mp3",
    act: "La memoria natural",
    actNumber: 3,
    territory: "Oscuridad íntima",
    mood: "Memoria + Sombra",
    corePhrase: "Lo que callas sigue sonando por dentro.",
    guideColor: "#b88945"
  },
  {
    id: "10",
    title: "Otro Infinito",
    file: "otro_infinito.mp3",
    act: "La memoria natural",
    actNumber: 3,
    territory: "Deseo imposible",
    mood: "Cuerpo + Memoria",
    corePhrase: "El infinito no está arriba: está entre dos cuerpos.",
    guideColor: "#b88945"
  },
  {
    id: "11",
    title: "Memoria Natural",
    file: "memoria_natural.mp3",
    act: "La memoria natural",
    actNumber: 3,
    territory: "Memoria",
    mood: "Sistema activo",
    corePhrase: "Lo que permanece no se recuerda: transmite.",
    guideColor: "#b88945"
  }
];

export class SimbiotikAudioAnalyzer {
  constructor(audioElement, webglInstance) {
    this.audio = audioElement;
    this.webgl = webglInstance;
    this.contextInitialized = false;
    
    // Escuchar el evento de play para inicializar el contexto (requerimiento de seguridad del navegador)
    this.audio.addEventListener('play', () => {
      this.initAudioContext();
      this.startAnalysis();
    });
  }
  
  initAudioContext() {
    if (this.contextInitialized) return;
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      this.src = this.audioContext.createMediaElementSource(this.audio);
      this.analyser = this.audioContext.createAnalyser();
      
      this.src.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      
      //fftSize 256 nos da 128 contenedores de frecuencias
      this.analyser.fftSize = 256;
      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(this.bufferLength);
      
      this.contextInitialized = true;
    } catch (e) {
      console.warn("Fallo al inicializar Web Audio Context:", e);
    }
  }
  
  startAnalysis() {
    const analyze = () => {
      if (this.audio.paused || this.audio.ended) {
        if (this.webgl && this.webgl.uniforms && this.webgl.uniforms.uAudioFreq) {
          this.webgl.uniforms.uAudioFreq.value = 0;
        }
        return;
      }
      
      requestAnimationFrame(analyze);
      
      if (this.analyser) {
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Sumar frecuencias bajas (índices 0 a 10 representan el bombo y bajo)
        let bassSum = 0;
        const bassCount = 10;
        for (let i = 0; i < bassCount; i++) {
          bassSum += this.dataArray[i];
        }
        
        const averageBass = bassSum / bassCount;
        const normalizedFreq = averageBass / 255.0; // Rango 0.0 - 1.0
        
        // Alimentar uniform de WebGL
        if (this.webgl && this.webgl.uniforms && this.webgl.uniforms.uAudioFreq) {
          this.webgl.uniforms.uAudioFreq.value = normalizedFreq;
        }
      }
    };
    
    analyze();
  }
}
