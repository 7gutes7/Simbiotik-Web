import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');

function sync() {
  console.log('Syncing all compiled dist files to root for Hostinger static deployment...');

  if (!fs.existsSync(distDir)) {
    console.error('dist directory does not exist!');
    process.exit(1);
  }

  const items = fs.readdirSync(distDir);
  for (const item of items) {
    const srcPath = path.join(distDir, item);
    const destPath = path.join(rootDir, item);
    fs.cpSync(srcPath, destPath, { recursive: true, force: true });
    console.log(`✓ Copied dist/${item} -> ./${item}`);
  }

  console.log('Sync complete! All assets and 3D models are ready at root for Hostinger.');
}

sync();
