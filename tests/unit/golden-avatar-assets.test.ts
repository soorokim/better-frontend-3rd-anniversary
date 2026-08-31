import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const filenames = [
  'hair-back.png',
  'body-face-warm.png',
  'outfit-navy-mint.png',
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
});
