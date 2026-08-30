export const AVATAR_CATALOG_VERSION = 'pixel-parts-v1';

export const avatarCatalog = {
  body: ['light', 'warm', 'deep'],
  hair: ['short', 'wave', 'bob', 'spike', 'cap'],
  outfit: ['hoodie', 'sweater', 'jacket', 'overalls'],
  accessory: ['none', 'terminal', 'keyboard', 'coffee', 'book'],
  accent: ['yellow', 'pink', 'mint', 'sky'],
} as const;

export type AvatarTrait = keyof typeof avatarCatalog;
export type AvatarTraits = { [K in AvatarTrait]: (typeof avatarCatalog)[K][number] };
