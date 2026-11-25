// Renders public/icons/*.svg to the PNG sizes the manifest and iOS need.
// Run: node scripts/build-icons.cjs public   (uses Playwright's Chromium; not an app dependency)
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const root = process.argv[2];
  const b = await chromium.launch(); const p = await b.newPage();
  const jobs = [['icons/icon.svg','icons/icon-192.png',192],['icons/icon.svg','icons/icon-512.png',512],['icons/icon-maskable.svg','icons/icon-512-maskable.png',512],['icons/icon.svg','icons/apple-touch-icon.png',180]];
  for (const [src, out, size] of jobs) {
    const svg = fs.readFileSync(path.join(root, src), 'utf8');
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: path.join(root, out), clip: { x: 0, y: 0, width: size, height: size } });
  }
  await b.close();
})();
