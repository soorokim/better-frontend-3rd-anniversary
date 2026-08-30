// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DeveloperIdentityCard } from '@/components/avatar/DeveloperIdentityCard';

const traits = {
  developerAdjective: '꾸준한', developerNoun: 'TYPE GUARDIAN', developerItem: 'RUBBER DUCK',
  developerStatus: 'BUILD PASSING', developerStatuses: 'BUILD PASSING\nTESTS PASSED\nLGTM', developerHash: '7A3F-C921',
};

describe('DeveloperIdentityCard', () => {
  afterEach(cleanup);
  it('renders only the safe player fields and no internal digest or message count', () => {
    const { container } = render(<DeveloperIdentityCard nickname="테스터" traits={traits} />);
    expect(screen.getByText('꾸준한 TYPE GUARDIAN')).toBeInTheDocument();
    expect(screen.getByText('7A3F-C921')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('conversation_digest');
    expect(container).not.toHaveTextContent('messages');
  });

  it('cycles only stored approved statuses with click, Enter and Space', () => {
    render(<DeveloperIdentityCard nickname="테스터" traits={traits} />);
    const card = screen.getByRole('button');
    fireEvent.click(card);
    expect(screen.getByText('TESTS PASSED')).toBeInTheDocument();
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.click(card);
    expect(screen.getByText('LGTM')).toBeInTheDocument();
    expect(screen.queryByText('WORKS ON MY MACHINE')).not.toBeInTheDocument();
  });

  it('shows an empty class as a dash instead of making one up', () => {
    const sparse = { ...traits, developerAdjective: '', developerNoun: '' };
    render(<DeveloperIdentityCard nickname="조용한참가자" traits={sparse} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
