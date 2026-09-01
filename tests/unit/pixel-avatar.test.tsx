// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PixelAvatar } from '@/components/avatar/PixelAvatar';

describe('PixelAvatar', () => {
  afterEach(cleanup);

  it('renders the deterministic DiceBear avatar while preserving the accessible image contract', () => {
    render(<PixelAvatar
      nickname="테스터"
      size={100}
      traits={{
        body: 'warm',
        hair: 'short',
        outfit: 'hoodie',
        accessory: 'coffee',
        accent: 'mint',
        developerItem: 'RUBBER DUCK',
        developerHash: '7A3F-C921',
      }}
    />);

    const image = screen.getByRole('img', { name: /^테스터의 픽셀 캐릭터/ });
    expect(image.tagName).toBe('SPAN');
    expect(image).toHaveAttribute('data-avatar-engine', 'dicebear-open-peeps-bold-pop-v1');
    expect(image).toHaveAttribute('data-avatar-combination', 'warm:short:hoodie:duck:mint');
    const diceBearImage = image.querySelector('[data-avatar-layer="dicebear"]');
    expect(diceBearImage).toHaveAttribute('src', '/avatars/pixel-art?body=warm&hair=short&outfit=hoodie&accessory=coffee&accent=mint&developerHash=7A3F-C921');
    const item = image.querySelector('[data-avatar-layer="item"]');
    expect(item).toHaveAttribute('data-avatar-part', 'duck');
    expect(item?.querySelector('img')).toHaveAttribute('src', '/avatar-items/bold-pop/duck.svg');
  });
});
