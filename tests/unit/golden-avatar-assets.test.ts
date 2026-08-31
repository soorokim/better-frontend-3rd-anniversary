import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const filenames = [
  'hair-back.png',
  'body-face-warm.png',
  'outfit-navy-mint.png',
  'outfit-base-navy-mint.png',
  'outfit-neckline-navy-mint.png',
  'hair-front-indigo.png',
  'assembled-from-layers.png',
];

describe('golden avatar v4 assets', () => {
  it.each(filenames)('%s uses the shared full canvas and hard alpha', async (filename) => {
    const file = await readFile(path.join(process.cwd(), 'public', 'avatar-parts', 'v4-golden', filename));
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    expect(info.width).toBe(256);
    expect(info.height).toBe(384);
    const alphaValues = new Set<number>();
    for (let index = 3; index < data.length; index += 4) alphaValues.add(data[index]);
    expect([...alphaValues].sort((left, right) => left - right)).toEqual([0, 255]);
  });

  it('keeps the neck and shoulder join underneath the upper outfit layer', async () => {
    const assetPath = path.join(process.cwd(), 'public', 'avatar-parts', 'v4-golden');
    const [body, outfit] = await Promise.all([
      readFile(path.join(assetPath, 'body-face-warm.png')),
      readFile(path.join(assetPath, 'outfit-neckline-navy-mint.png')),
    ]);
    const [bodyPixels, outfitPixels] = await Promise.all([
      sharp(body).ensureAlpha().raw().toBuffer(),
      sharp(outfit).ensureAlpha().raw().toBuffer(),
    ]);

    let bodyCount = 0;
    let coveredCount = 0;
    for (let y = 160; y < 184; y += 1) {
      for (let x = 112; x < 144; x += 1) {
        const alphaOffset = (y * 256 + x) * 4 + 3;
        if (bodyPixels[alphaOffset] === 0) continue;
        bodyCount += 1;
        if (outfitPixels[alphaOffset] > 0) coveredCount += 1;
      }
    }

    expect(bodyCount).toBeGreaterThan(0);
    expect(coveredCount / bodyCount).toBeGreaterThanOrEqual(0.9);
  });

  it('recombines the two outfit layers without changing the reviewed outfit', async () => {
    const assetPath = path.join(process.cwd(), 'public', 'avatar-parts', 'v4-golden');
    const [combined, base, neckline] = await Promise.all([
      readFile(path.join(assetPath, 'outfit-navy-mint.png')),
      readFile(path.join(assetPath, 'outfit-base-navy-mint.png')),
      readFile(path.join(assetPath, 'outfit-neckline-navy-mint.png')),
    ]);
    const [combinedPixels, recombinedPixels] = await Promise.all([
      sharp(combined).ensureAlpha().raw().toBuffer(),
      sharp(base).ensureAlpha().composite([{ input: neckline }]).raw().toBuffer(),
    ]);

    expect(recombinedPixels.equals(combinedPixels)).toBe(true);
  });
});
