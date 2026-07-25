import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');

function sync() {
  console.log('Syncing dist output to root for Hostinger static deployment...');

  // 1. Copy assets folder to root assets/
  const distAssets = path.join(distDir, 'assets');
  const rootAssets = path.join(rootDir, 'assets');
  if (fs.existsSync(distAssets)) {
    fs.cpSync(distAssets, rootAssets, { recursive: true });
    console.log('✓ Copied dist/assets to ./assets');
  }

  // 2. Copy dist/index.html to root index.html
  const distHtml = path.join(distDir, 'index.html');
  const rootHtml = path.join(rootDir, 'index.html');
  if (fs.existsSync(distHtml)) {
    fs.copyFileSync(distHtml, rootHtml);
    console.log('✓ Copied dist/index.html to ./index.html');
  }

  console.log('Sync complete! Ready for Hostinger git deployment.');
}

sync();
