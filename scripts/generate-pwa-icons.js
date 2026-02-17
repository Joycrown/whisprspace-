const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const outDir = path.join(process.cwd(), 'public', 'icons');

const baseSvg = (size, markScale = 1) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0A1020"/>
      <stop offset="0.55" stop-color="#172A4A"/>
      <stop offset="1" stop-color="#2B1A3F"/>
    </linearGradient>
    <linearGradient id="card" x1="${size * 0.08}" y1="${size * 0.08}" x2="${size * 0.92}" y2="${size * 0.92}" gradientUnits="userSpaceOnUse">
      <stop stop-color="#6D3BFF"/>
      <stop offset="0.52" stop-color="#9A4DFF"/>
      <stop offset="1" stop-color="#FF7A1A"/>
    </linearGradient>
    <linearGradient id="plane" x1="${size * 0.26}" y1="${size * 0.24}" x2="${size * 0.76}" y2="${size * 0.78}" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#EDE7FF"/>
    </linearGradient>
    <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="${size * 0.03}" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.72 0 0 0 0 0.35 0 0 0 0 1 0 0 0 0.35 0"/>
    </filter>
  </defs>

  <rect width="${size}" height="${size}" fill="url(#bg)"/>

  <circle cx="${size * 0.2}" cy="${size * 0.18}" r="${size * 0.26}" fill="#5F35FF" opacity="0.12"/>
  <circle cx="${size * 0.82}" cy="${size * 0.84}" r="${size * 0.3}" fill="#FF7A1A" opacity="0.12"/>

  <rect x="${size * 0.08}" y="${size * 0.08}" width="${size * 0.84}" height="${size * 0.84}" rx="${size * 0.2}" fill="url(#card)"/>
  <rect x="${size * 0.08}" y="${size * 0.08}" width="${size * 0.84}" height="${size * 0.84}" rx="${size * 0.2}" fill="#120B24" fill-opacity="0.32"/>

  <g transform="translate(${size * 0.5}, ${size * 0.5}) scale(${markScale}) translate(${-size * 0.5}, ${-size * 0.5})">
    <path d="M${size * 0.27} ${size * 0.53}L${size * 0.77} ${size * 0.31}C${size * 0.79} ${size * 0.30} ${size * 0.82} ${size * 0.32} ${size * 0.81} ${size * 0.35}L${size * 0.63} ${size * 0.77}C${size * 0.62} ${size * 0.80} ${size * 0.58} ${size * 0.81} ${size * 0.56} ${size * 0.79}L${size * 0.47} ${size * 0.64}L${size * 0.32} ${size * 0.56}C${size * 0.29} ${size * 0.55} ${size * 0.24} ${size * 0.54} ${size * 0.27} ${size * 0.53}Z" fill="url(#plane)"/>
    <path d="M${size * 0.48} ${size * 0.63}L${size * 0.77} ${size * 0.31}" stroke="#FFFFFF" stroke-width="${size * 0.035}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
    <path d="M${size * 0.32} ${size * 0.56}L${size * 0.47} ${size * 0.64}" stroke="#FFFFFF" stroke-width="${size * 0.03}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
  </g>

  <circle cx="${size * 0.5}" cy="${size * 0.5}" r="${size * 0.29}" fill="#A75DFF" opacity="0.12" filter="url(#softGlow)"/>
</svg>`;

async function writeIcon(filename, size, options = {}) {
  const svg = baseSvg(size, options.markScale ?? 1);
  let pipeline = sharp(Buffer.from(svg));

  if (options.background) {
    pipeline = pipeline.flatten({ background: options.background });
  }

  await pipeline
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(outDir, filename));
}

async function run() {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  await writeIcon('icon-192x192.png', 192, { markScale: 1.03, background: '#0A1020' });
  await writeIcon('icon-512x512.png', 512, { markScale: 1.03, background: '#0A1020' });

  // Maskable versions keep key artwork in safer central zone.
  await writeIcon('icon-192x192-maskable.png', 192, { markScale: 0.92, background: '#0A1020' });
  await writeIcon('icon-512x512-maskable.png', 512, { markScale: 0.92, background: '#0A1020' });

  await writeIcon('apple-touch-icon.png', 180, { markScale: 1.0, background: '#0A1020' });

  console.log('Generated refreshed PWA icon set in public/icons');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
