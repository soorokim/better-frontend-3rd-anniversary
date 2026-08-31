import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  candidateAvatarManifest,
  canonicalItemIds,
  enumerateCanonicalRenderKeys,
  parseAvatarAssetManifest,
  type AvatarAssetManifest,
  type AvatarLayerRole,
} from '../lib/avatar/assets/manifest';
import { avatarCatalog } from '../lib/avatar/catalog';

type Bounds = { x: number; y: number; width: number; height: number };
type AlphaImage = { alpha: Uint8Array; width: number; height: number };
type ValidationResult = { files: number; combinations: number; errors: string[] };

const projectRoot = path.resolve(import.meta.dirname, '..');
const validationMaskPaths = {
  face: path.join(projectRoot, 'public/avatar-parts/v3/validation/face-mask.png'),
  torso: path.join(projectRoot, 'public/avatar-parts/v3/validation/torso-mask.png'),
};

function diskPath(publicPath: string): string {
  const relative = publicPath.replace(/^\//, '');
  const resolved = path.resolve(projectRoot, 'public', relative);
  const publicRoot = path.resolve(projectRoot, 'public');
  if (!resolved.startsWith(`${publicRoot}${path.sep}`)) throw new Error(`Asset escapes public/: ${publicPath}`);
  return resolved;
}

async function loadAlpha(filePath: string): Promise<AlphaImage> {
  const image = sharp(filePath, { failOn: 'error' });
  const metadata = await image.metadata();
  if (metadata.width !== 256 || metadata.height !== 384 || metadata.space !== 'srgb' || metadata.channels !== 4) {
    throw new Error(`${filePath}: expected 256x384 RGBA/sRGB, received ${metadata.width}x${metadata.height}, ${metadata.channels} channels/${metadata.space}`);
  }
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  for (let pixel = 0; pixel < alpha.length; pixel += 1) alpha[pixel] = data[pixel * 4 + 3];
  return { alpha, width: info.width, height: info.height };
}

function visibleBounds(image: AlphaImage): Bounds | null {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < image.alpha.length; index += 1) {
    if (image.alpha[index] === 0) continue;
    const x = index % image.width;
    const y = Math.floor(index / image.width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function contains(outer: Bounds, inner: Bounds): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function overlapPixels(a: AlphaImage, b: AlphaImage): number {
  let overlap = 0;
  for (let index = 0; index < a.alpha.length; index += 1) {
    if (a.alpha[index] > 0 && b.alpha[index] > 0) overlap += 1;
  }
  return overlap;
}

function visiblePixels(image: AlphaImage): number {
  return image.alpha.reduce((count, alpha) => count + Number(alpha > 0), 0);
}

function sameBounds(left: Bounds | null, right: Bounds | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateManifestStructure(manifest: AvatarAssetManifest): string[] {
  const errors: string[] = [];
  const renderKeys = enumerateCanonicalRenderKeys();
  if (renderKeys.length !== 2160 || new Set(renderKeys).size !== 2160) {
    errors.push(`Expected 2,160 unique canonical render keys, received ${renderKeys.length}/${new Set(renderKeys).size}.`);
  }
  for (const id of avatarCatalog.accessory) {
    if (!manifest.aliases.accessory[id]) errors.push(`Missing accessory alias: ${id}`);
  }
  for (const value of Object.values(manifest.aliases.accessory).concat(Object.values(manifest.aliases.developerItem))) {
    if (!canonicalItemIds.includes(value as (typeof canonicalItemIds)[number])) errors.push(`Unknown canonical item alias target: ${value}`);
  }
  const pilotIds = new Set(manifest.pilotCases.map((entry) => entry.id));
  if (manifest.pilotCases.length !== 4 || pilotIds.size !== 4) errors.push('Pilot manifest must contain exactly four unique cases.');

  if (manifest.phase === 'approved') {
    for (const [role, required] of Object.entries({
      body: avatarCatalog.body,
      hair: avatarCatalog.hair,
      outfit: avatarCatalog.outfit,
      item: canonicalItemIds,
    })) {
      const present = Object.keys(manifest.parts[role as keyof typeof manifest.parts]);
      for (const id of required) if (!present.includes(id)) errors.push(`Approved manifest missing ${role}:${id}`);
    }
    if (manifest.review.status !== 'approved') errors.push('Approved manifest requires an approved review record.');
  }
  return errors;
}

export async function validateAvatarAssets(manifestInput: unknown = candidateAvatarManifest): Promise<ValidationResult> {
  const manifest = parseAvatarAssetManifest(manifestInput);
  const errors = validateManifestStructure(manifest);
  const faceMask = await loadAlpha(validationMaskPaths.face).catch((error) => {
    errors.push(`Face mask: ${String(error)}`);
    return null;
  });
  const torsoMask = await loadAlpha(validationMaskPaths.torso).catch((error) => {
    errors.push(`Torso mask: ${String(error)}`);
    return null;
  });
  const torsoPixels = torsoMask ? visiblePixels(torsoMask) : 0;
  const assets = new Map<string, { expectedSha: string; roles: AvatarLayerRole[] }>();

  assets.set(manifest.fallback.path, { expectedSha: manifest.fallback.sha256, roles: [] });
  for (const partMap of Object.values(manifest.parts)) {
    for (const part of Object.values(partMap)) {
      for (const selection of [part, ...(part.variants ?? [])]) {
        const layerImages: AlphaImage[] = [];
        for (const [role, asset] of Object.entries(selection.layers)) {
          const existing = assets.get(asset.path);
          assets.set(asset.path, { expectedSha: asset.sha256, roles: [...(existing?.roles ?? []), role as AvatarLayerRole] });
          try {
            const image = await loadAlpha(diskPath(asset.path));
            layerImages.push(image);
            if (image.alpha.some((alpha) => alpha !== 0 && alpha !== 255)) errors.push(`${asset.path}: alpha must contain only 0 or 255.`);
            const bounds = visibleBounds(image);
            if (!bounds) {
              if (role !== 'hairBack') errors.push(`${asset.path}: no visible pixels.`);
            } else if (!contains(manifest.canvas.safeBounds, bounds)) {
              errors.push(`${asset.path}: content escapes safe bounds.`);
            }
            if ((role === 'hairFront' || role === 'item') && faceMask && overlapPixels(image, faceMask) > 0) {
              errors.push(`${role}:${selection.id} intersects the face mask.`);
            }
            if (role === 'item' && torsoMask && torsoPixels > 0 && overlapPixels(image, torsoMask) / torsoPixels > 0.3) {
              errors.push(`item:${selection.id} covers more than 30% of the torso mask.`);
            }
          } catch (error) {
            errors.push(`${role}:${selection.id}: ${String(error)}`);
          }
        }
        const union = layerImages.length ? {
          alpha: Uint8Array.from(layerImages[0].alpha, (_, index) => layerImages.some((image) => image.alpha[index] > 0) ? 255 : 0),
          width: 256,
          height: 384,
        } : null;
        const actualBounds = union ? visibleBounds(union) : null;
        if (!sameBounds(actualBounds, selection.contentBounds)) {
          errors.push(`${part.role}:${selection.id} contentBounds mismatch: manifest=${JSON.stringify(selection.contentBounds)} actual=${JSON.stringify(actualBounds)}`);
        }
      }
    }
  }

  for (const [publicPath, asset] of assets) {
    try {
      const bytes = await readFile(diskPath(publicPath));
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (digest !== asset.expectedSha) errors.push(`${publicPath}: SHA-256 mismatch.`);
      await loadAlpha(diskPath(publicPath));
    } catch (error) {
      errors.push(`${publicPath}: ${String(error)}`);
    }
  }

  return { files: assets.size, combinations: enumerateCanonicalRenderKeys().length, errors };
}

async function main() {
  const result = await validateAvatarAssets();
  if (result.errors.length) {
    console.error(result.errors.map((error) => `- ${error}`).join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`Validated ${result.files} files and ${result.combinations} canonical avatar combinations.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) void main();
