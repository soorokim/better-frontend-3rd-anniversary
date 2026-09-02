// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DeveloperIdentityCard } from '@/components/avatar/DeveloperIdentityCard';

const traits = {
  developerAdjective: '유쾌한', developerNoun: 'BUG HUNTER', developerItem: 'COFFEE',
  developerStatus: 'BUILD PASSING', developerStatuses: 'BUILD PASSING\nTESTS PASSED\nLGTM', developerHash: 'ABCD-1234',
};

describe('developer identity interaction', () => {
  afterEach(cleanup);

  it('keeps the card easter egg while opening each guide from its matching question-mark button', () => {
    render(<DeveloperIdentityCard nickname="키보드유저" traits={traits} />);
    const card = screen.getByRole('button', { name: /개발자 카드/ });
    fireEvent.click(card);
    expect(screen.getByText('TESTS PASSED')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '클래스 설명 보기' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('BUG HUNTER');
    fireEvent.click(screen.getByRole('button', { name: '아이템 선정 이유 보기' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('COFFEE');
  });
});
