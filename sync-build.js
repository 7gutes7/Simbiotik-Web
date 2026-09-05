import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');

// Directorios generados en la raíz que se reemplazan por completo en cada build.
// Si no se borran antes de copiar, se acumulan los bundles de builds anteriores
// (llegamos a tener 9 copias de ~800 KB en assets/).
const GENERATED_DIRS = ['assets'];

// Ruido del Finder de macOS que no debe llegar al servidor
const IGNORAR = new Set(['.DS_Store']);

// Copia recursiva con primitivas básicas (mkdir + readFile + writeFile).
// No se usa fs.cpSync a propósito: recurre a syscalls de copia nativa que
// algunos sistemas de archivos montados rechazan con EACCES.
function copiar(src, dest) {
  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entrada of fs.readdirSync(src)) {
      if (IGNORAR.has(entrada)) continue;
      copiar(path.join(src, entrada), path.join(dest, entrada));
    }
    return;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, fs.readFileSync(src));
}

function sync() {
  console.log('Sincronizando dist/ a la raíz para el despliegue estático en Hostinger...');

  if (!fs.existsSync(distDir)) {
    console.error('¡El directorio dist no existe!');
    process.exit(1);
  }

  for (const dir of GENERATED_DIRS) {
    const target = path.join(rootDir, dir);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`✗ Limpiado ./${dir} (build anterior)`);
    }
  }

  for (const item of fs.readdirSync(distDir)) {
    if (IGNORAR.has(item)) continue;
    copiar(path.join(distDir, item), path.join(rootDir, item));
    console.log(`✓ Copiado dist/${item} -> ./${item}`);
  }

  console.log('Sincronización completa. La raíz está lista para publicar.');
}

sync();
