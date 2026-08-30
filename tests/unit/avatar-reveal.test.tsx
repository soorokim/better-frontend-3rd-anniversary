// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarReveal } from '@/components/avatar/AvatarReveal';

const traits = {
  body: 'warm', hair: 'short', outfit: 'hoodie', accessory: 'coffee', accent: 'mint',
  developerAdjective: '꾸준한', developerNoun: 'TYPE GUARDIAN', developerItem: 'RUBBER DUCK',
  developerStatus: 'BUILD PASSING', developerStatuses: 'BUILD PASSING\nTESTS PASSED', developerHash: '7A3F-C921',
};

function motion(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
}

describe('AvatarReveal', () => {
  beforeEach(() => { vi.useFakeTimers(); motion(false); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('shows immediate local progress, changes candidates, and settles on the exact final profile by five seconds', async () => {
    render(<AvatarReveal nickname="테스터" traits={traits} reveal />);
    expect(screen.getAllByText(/대화의 온도를 측정하는 중/).length).toBeGreaterThanOrEqual(1);
    await act(async () => { vi.advanceTimersByTime(1200); });
    expect(screen.getAllByText(/장비 슬롯|러버덕|픽셀|대화의 온도|개발자 클래스/).length).toBeGreaterThanOrEqual(1);
    await act(async () => { vi.advanceTimersByTime(4000); });
    expect(screen.getByText('꾸준한 TYPE GUARDIAN')).toBeInTheDocument();
    expect(screen.getByText('7A3F-C921')).toBeInTheDocument();
    expect(screen.getByText(/✓ PLAYER READY/)).toBeInTheDocument();
  });

  it('skips rapid changes for reduced motion and exposes the final static state immediately', async () => {
    motion(true);
    render(<AvatarReveal nickname="테스터" traits={traits} reveal />);
    await act(async () => { vi.advanceTimersByTime(0); });
    expect(screen.getByText('꾸준한 TYPE GUARDIAN')).toBeInTheDocument();
    expect(screen.getByText(/✓ PLAYER READY/)).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not start the reveal again on ordinary lobby visits', () => {
    render(<AvatarReveal nickname="테스터" traits={traits} reveal={false} />);
    expect(screen.queryByText('$ initializing player...')).not.toBeInTheDocument();
    expect(screen.getByText('꾸준한 TYPE GUARDIAN')).toBeInTheDocument();
  });
});
