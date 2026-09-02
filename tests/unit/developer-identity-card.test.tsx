// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DeveloperIdentityCard } from '@/components/avatar/DeveloperIdentityCard';

const traits = {
  developerAdjective: '꾸준한', developerNoun: 'TYPE GUARDIAN', developerItem: 'RUBBER DUCK',
  developerItemReason: '궁금한 것을 함께 풀어 가는 질문이 돋보여서 골랐어요.', developerStatus: 'BUILD PASSING', developerStatuses: 'BUILD PASSING\nTESTS PASSED\nLGTM', developerHash: '7A3F-C921',
};

describe('DeveloperIdentityCard', () => {
  afterEach(cleanup);
  it('renders only the safe player fields and no internal digest or message count', () => {
    const { container } = render(<DeveloperIdentityCard nickname="테스터" traits={traits} />);
    expect(screen.getAllByText('꾸준한 TYPE GUARDIAN')).not.toHaveLength(0);
    expect(screen.getByText('7A3F-C921')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('conversation_digest');
    expect(container).not.toHaveTextContent('messages');
  });

  it('cycles only stored approved statuses with click, Enter and Space', () => {
    render(<DeveloperIdentityCard nickname="테스터" traits={traits} />);
    const card = screen.getByRole('button', { name: /개발자 카드/ });
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
    expect(screen.getAllByText('—')).not.toHaveLength(0);
  });

  it('opens the item reason only from its small dedicated button', () => {
    render(<DeveloperIdentityCard nickname="테스터" traits={traits} />);
    expect(screen.queryByText(/궁금한 것을 함께/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '아이템 선정 이유' }));
    expect(screen.getByText(/궁금한 것을 함께/)).toBeInTheDocument();
    expect(screen.getByText('BUILD PASSING')).toBeInTheDocument();
  });
});
