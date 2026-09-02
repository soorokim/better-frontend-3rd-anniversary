import sharp from 'sharp';

const width = 1200;
const height = 630;
const background = 'public/og/anniversary-og-background.png';
const output = 'public/og/anniversary-og.png';

const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="copyShade" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#070d27" stop-opacity="0.98"/>
      <stop offset="0.58" stop-color="#070d27" stop-opacity="0.83"/>
      <stop offset="0.83" stop-color="#070d27" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#070d27" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#copyShade)"/>
  <rect x="58" y="76" width="10" height="10" fill="#ffdc52"/>
  <rect x="76" y="94" width="6" height="6" fill="#ff85bd"/>
  <rect x="58" y="537" width="8" height="8" fill="#68dfd3"/>
  <text x="58" y="142" fill="#ffdc52" font-family="Malgun Gothic, sans-serif" font-size="19" font-weight="700" letter-spacing="3">FRONTEND CHAT · 3RD ANNIVERSARY</text>
  <text x="58" y="234" fill="#ffffff" font-family="Malgun Gothic, sans-serif" font-size="53" font-weight="800" letter-spacing="-2">${escapeXml('더 좋은 프론트엔드를')}</text>
  <text x="58" y="305" fill="#ffffff" font-family="Malgun Gothic, sans-serif" font-size="53" font-weight="800" letter-spacing="-2">${escapeXml('같이 고민해요!')}</text>
  <rect x="58" y="352" width="12" height="12" fill="#ff85bd"/>
  <text x="88" y="365" fill="#ffdc52" font-family="Malgun Gothic, sans-serif" font-size="29" font-weight="800">${escapeXml('3주년 기념 행사')}</text>
  <text x="58" y="428" fill="#c9d3ef" font-family="Malgun Gothic, sans-serif" font-size="25" font-weight="600">${escapeXml('모두가 함께 만드는 행사')}</text>
  <line x1="58" y1="470" x2="438" y2="470" stroke="#a994c8" stroke-width="3"/>
</svg>`;

await sharp(background)
  .resize(width, height, { fit: 'cover', position: 'centre' })
  .composite([{ input: Buffer.from(svg) }])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(output);

console.log(`Generated ${output} (${width}x${height})`);
