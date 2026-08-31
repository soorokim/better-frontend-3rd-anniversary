// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PixelAvatar } from '@/components/avatar/PixelAvatar';

describe('PixelAvatar', () => {
  afterEach(cleanup);

  it('shows one full-body atlas cell while preserving the accessible image contract', () => {
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
    expect(image).toHaveAttribute('src', '/avatar-parts/full-body-developers-v1.png?sprite=2');
    expect(image).toHaveStyle({ width: '400px', height: '400px', left: '-200px', top: '0px' });
  });
});
