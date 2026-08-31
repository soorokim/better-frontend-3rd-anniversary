import { z } from 'zod';
import rawManifest from './pixel-layers-v3.json';
import { avatarCatalog, type AvatarTraits } from '../catalog';

const rectSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).strict();

const pointSchema = z.object({ x: z.number().int().min(0), y: z.number().int().min(0) }).strict();
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const fileAssetSchema = z.object({
  path: z.string().regex(/^\/avatar-parts\/v3\/.+\.png$/),
  sha256: sha256Schema,
  provenanceId: z.string().min(1),
}).strict();

const fileLayerRoleSchema = z.enum(['hairBack', 'body', 'outfit', 'hairFront', 'item']);
const partRoleSchema = z.enum(['body', 'hair', 'outfit', 'item']);

const visualVariantSchema = z.object({
  id: z.string().min(1),
  layers: z.partialRecord(fileLayerRoleSchema, fileAssetSchema),
  contentBounds: rectSchema.nullable(),
  provenanceId: z.string().min(1),
}).strict();

const partSchema = z.object({
  id: z.string().min(1),
  role: partRoleSchema,
  layers: z.partialRecord(fileLayerRoleSchema, fileAssetSchema),
  contentBounds: rectSchema.nullable(),
  anchor: z.string().nullable(),
  provenanceId: z.string().min(1),
  variants: z.array(visualVariantSchema).min(1).optional(),
}).strict();

const partMapSchema = z.record(z.string().min(1), partSchema);
const aliasesSchema = z.record(z.string().min(1), z.string().min(1));
const traitsSchema = z.object({
  body: z.enum(avatarCatalog.body),
  hair: z.enum(avatarCatalog.hair),
  outfit: z.enum(avatarCatalog.outfit),
  accessory: z.enum(avatarCatalog.accessory),
  accent: z.enum(avatarCatalog.accent),
}).strict();

export const avatarAssetManifestSchema = z.object({
  schemaVersion: z.literal('avatar-asset-manifest-v1'),
  assetSetVersion: z.string().regex(/^pixel-layers-v[1-9][0-9]*$/),
  phase: z.enum(['pilot', 'approved', 'retired']),
  catalogVersion: z.literal('pixel-parts-v1'),
  canvas: z.object({
    width: z.literal(256), height: z.literal(384), logicalWidth: z.literal(128), logicalHeight: z.literal(192),
    exportScale: z.literal(2), pixelInterpolation: z.literal('nearest'), safeBounds: rectSchema,
    baselineY: z.number().int().min(1).max(383), faceSafeArea: rectSchema, torsoArea: rectSchema,
    anchors: z.record(z.string(), pointSchema).superRefine((anchors, context) => {
      for (const key of ['leftHand', 'rightHand', 'leftGround', 'rightGround']) {
        if (!(key in anchors)) context.addIssue({ code: 'custom', message: `Missing canvas anchor: ${key}` });
      }
    }),
  }).strict(),
  layerOrder: z.tuple([
    z.literal('hairBack'), z.literal('body'), z.literal('outfit'), z.literal('faceFeatures'),
    z.literal('hairFront'), z.literal('item'), z.literal('accent'),
  ]),
  fallback: fileAssetSchema,
  parts: z.object({ body: partMapSchema, hair: partMapSchema, outfit: partMapSchema, item: partMapSchema }).strict(),
  aliases: z.object({ accessory: aliasesSchema, developerItem: aliasesSchema }).strict(),
  pilotCases: z.array(z.object({
    id: z.string().min(1), traits: traitsSchema, developerItem: z.string().min(1),
    expectedItemId: z.string().min(1), riskCoverage: z.array(z.string().min(1)).min(1),
  }).strict()).length(4),
  provenance: z.array(z.object({
    id: z.string().min(1), sourceType: z.enum(['project-generated', 'third-party']), creatorOrTool: z.string().min(1),
    createdAt: z.iso.date(), sourceAsset: z.string().min(1), promptFile: z.string().nullable().optional(),
    modifications: z.string().min(1), licenseSpdx: z.string().min(1), sourceUrl: z.url().nullable().optional(),
    licenseUrl: z.url().nullable().optional(), redistributionAllowed: z.literal(true), noticeFile: z.string().min(1),
  }).strict()).min(1),
  review: z.object({ status: z.enum(['pending', 'approved', 'rejected']), reviewedAt: z.iso.date().nullable(), recordPath: z.string().min(1) }).strict(),
}).strict();

export type AvatarAssetManifest = z.infer<typeof avatarAssetManifestSchema>;
export type AvatarPartRole = z.infer<typeof partRoleSchema>;
export type AvatarLayerRole = 'hairBack' | 'body' | 'outfit' | 'faceFeatures' | 'hairFront' | 'item' | 'accent';
export type CanonicalItemId = 'none' | 'duck' | 'coffee' | 'keyboard' | 'laptop' | 'error-log' | 'test-check' | 'browser-tabs' | 'usb';

export const canonicalItemIds: readonly CanonicalItemId[] = [
  'none', 'duck', 'coffee', 'keyboard', 'laptop', 'error-log', 'test-check', 'browser-tabs', 'usb',
];

export function parseAvatarAssetManifest(input: unknown): AvatarAssetManifest {
  const manifest = avatarAssetManifestSchema.parse(input);
  const provenanceIds = new Set(manifest.provenance.map((entry) => entry.id));
  const assets = [manifest.fallback, ...Object.values(manifest.parts).flatMap((parts) =>
    Object.values(parts).flatMap((part) => [
      part,
      ...Object.values(part.layers),
      ...(part.variants ?? []).flatMap((variant) => [variant, ...Object.values(variant.layers)]),
    ]),
  )];
  for (const asset of assets) {
    if (!provenanceIds.has(asset.provenanceId)) throw new Error(`Unknown provenance: ${asset.provenanceId}`);
  }
  return manifest;
}

export const candidateAvatarManifest = parseAvatarAssetManifest(rawManifest);

export function assertApprovedManifest(manifest: AvatarAssetManifest): void {
  if (manifest.phase !== 'approved' || manifest.review.status !== 'approved') {
    throw new Error(`Avatar asset set ${manifest.assetSetVersion} is not approved for participant rendering.`);
  }
}

export function canonicalItemId(
  accessory: string,
  developerItem?: string,
  manifest: AvatarAssetManifest = candidateAvatarManifest,
): CanonicalItemId {
  const resolved = (developerItem && manifest.aliases.developerItem[developerItem])
    || manifest.aliases.accessory[accessory]
    || 'none';
  return canonicalItemIds.includes(resolved as CanonicalItemId) ? resolved as CanonicalItemId : 'none';
}

export function resolveCandidateComposition(
  traits: AvatarTraits,
  developerItem?: string,
  manifest: AvatarAssetManifest = candidateAvatarManifest,
  visualSeed?: string,
) {
  const itemId = canonicalItemId(traits.accessory, developerItem, manifest);
  const combinationId = [traits.body, traits.hair, traits.outfit, itemId, traits.accent].join(':');
  const seed = visualSeed || combinationId;
  const chooseVariant = (role: 'body' | 'hair' | 'outfit', canonicalId: string) => {
    const part = manifest.parts[role][canonicalId];
    if (!part) return undefined;
    const candidates = [part, ...(part.variants ?? [])];
    let hash = 2166136261;
    for (const character of `${manifest.assetSetVersion}\0${seed}\0${role}`) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return candidates[(hash >>> 0) % candidates.length];
  };
  const body = chooseVariant('body', traits.body);
  const hair = chooseVariant('hair', traits.hair);
  const outfit = chooseVariant('outfit', traits.outfit);
  const selected = {
    hairBack: hair?.layers.hairBack,
    body: body?.layers.body,
    outfit: outfit?.layers.outfit,
    hairFront: hair?.layers.hairFront,
    item: manifest.parts.item[itemId]?.layers.item,
  };
  return {
    assetSetVersion: manifest.assetSetVersion,
    combinationId,
    visualCombinationId: [body?.id, hair?.id, outfit?.id, itemId, traits.accent].join(':'),
    bodyId: traits.body,
    hairId: traits.hair,
    outfitId: traits.outfit,
    bodyVariantId: body?.id,
    hairVariantId: hair?.id,
    outfitVariantId: outfit?.id,
    itemId,
    accentId: traits.accent,
    layers: manifest.layerOrder.flatMap((role) => role in selected && selected[role as keyof typeof selected]
      ? [{ role, ...selected[role as keyof typeof selected]! }]
      : []),
  };
}

export function enumerateCanonicalRenderKeys(): string[] {
  return avatarCatalog.body.flatMap((body) => avatarCatalog.hair.flatMap((hair) =>
    avatarCatalog.outfit.flatMap((outfit) => canonicalItemIds.flatMap((item) =>
      avatarCatalog.accent.map((accent) => [body, hair, outfit, item, accent].join(':')),
    )),
  ));
}
