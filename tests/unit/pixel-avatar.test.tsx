// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PixelAvatar } from '@/components/avatar/PixelAvatar';

describe('PixelAvatar', () => {
  afterEach(cleanup);

  it('stacks deterministic full-body parts while preserving the accessible image contract', () => {
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
    expect(image.tagName).toBe('svg');
    expect(image).toHaveAttribute('viewBox', '0 0 32 40');
    expect(image).toHaveAttribute('data-avatar-combination', 'warm:short:hoodie:duck:mint');
    expect(image.querySelector('[data-avatar-layer="body"]')).toBeInTheDocument();
    expect(image.querySelector('[data-avatar-layer="hair"][data-avatar-part="short"]')).toBeInTheDocument();
    expect(image.querySelector('[data-avatar-layer="outfit"][data-avatar-part="hoodie"]')).toBeInTheDocument();
    expect(image.querySelector('[data-avatar-layer="accessory"][data-avatar-part="duck"]')).toBeInTheDocument();
    expect(image.querySelector('[data-avatar-layer="accent"][data-avatar-part="mint"]')).toBeInTheDocument();
  });
});
