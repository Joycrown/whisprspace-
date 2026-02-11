const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../public/assets/WS icon.png');
const outputDir = path.join(__dirname, '../public/icons');

const sizes = [192, 512];

async function generateIcons() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    await sharp(inputPath)
      .resize(size, size)
      .toFile(outputPath);
    console.log(`Generated ${size}x${size} icon at ${outputPath}`);
  }
}

generateIcons().catch(console.error);
