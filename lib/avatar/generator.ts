import { createHash } from 'node:crypto';
import {
  AVATAR_CATALOG_VERSION,
  avatarCatalog,
  type AvatarTrait,
  type AvatarTraits,
} from './catalog';

export const AVATAR_GENERATOR_VERSION = 'avatar-generator-v1';

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function choose<T extends string>(sourceVersion: string, source: string, trait: AvatarTrait, values: readonly T[]): T {
  const namespace = [AVATAR_GENERATOR_VERSION, AVATAR_CATALOG_VERSION, sourceVersion, source, trait].join('\0');
  return values[sha256(namespace).readUInt32BE(0) % values.length];
}

export function generateAvatar(sourceVersion: string, source: string) {
  const traits = Object.fromEntries(
    (Object.keys(avatarCatalog) as AvatarTrait[]).map((trait) => [
      trait,
      choose(sourceVersion, source, trait, avatarCatalog[trait]),
    ]),
  ) as AvatarTraits;

  return {
    sourceDigest: sha256(`${sourceVersion}\0${source}`).toString('hex'),
    generatorVersion: AVATAR_GENERATOR_VERSION,
    catalogVersion: AVATAR_CATALOG_VERSION,
    traits,
  };
}
