// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DeveloperIdentityCard } from '@/components/avatar/DeveloperIdentityCard';

const traits = {
  developerAdjective: '유쾌한', developerNoun: 'BUG HUNTER', developerItem: 'COFFEE',
  developerStatus: 'BUILD PASSING', developerStatuses: 'BUILD PASSING\nTESTS PASSED\nLGTM', developerHash: 'ABCD-1234',
};

describe('developer identity interaction', () => {
  afterEach(cleanup);

  it('uses the native button for pointer, Enter, and Space while announcing only approved values', async () => {
    const user = userEvent.setup();
    render(<DeveloperIdentityCard nickname="키보드유저" traits={traits} />);
    const card = screen.getByRole('button', { name: /개발자 카드/ });
    const live = screen.getByText('BUILD PASSING');
    expect(live).toHaveAttribute('aria-live', 'polite');
    await user.click(card);
    expect(live).toHaveTextContent('TESTS PASSED');
    card.focus();
    await user.keyboard('{Enter}');
    expect(live).toHaveTextContent('LGTM');
    await user.keyboard(' ');
    expect(live).toHaveTextContent('BUILD PASSING');
    fireEvent.click(card);
    expect(['BUILD PASSING', 'TESTS PASSED', 'LGTM']).toContain(live.textContent);
    expect(screen.queryByText('WORKS ON MY MACHINE')).not.toBeInTheDocument();
  });
});
