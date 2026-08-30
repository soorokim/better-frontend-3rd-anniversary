// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResetPinForm } from '@/components/forms/ResetPinForm';

describe('ResetPinForm', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the submitted form reference until a 204 response is handled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<ResetPinForm />);

    await user.type(screen.getByLabelText('초대 코드'), 'test-invite-code-1234');
    await user.type(screen.getByLabelText('닉네임'), '복구참가자');
    await user.type(screen.getByLabelText('초기화 코드'), '12345678');
    await user.type(screen.getByLabelText('새 6자리 PIN'), '654321');
    await user.type(screen.getByLabelText('새 PIN 확인'), '654321');
    await user.click(screen.getByRole('button', { name: '새 PIN 설정' }));

    expect(await screen.findByText('새 PIN이 설정됐어요. 새 PIN으로 다시 로그인해 주세요.')).toBeInTheDocument();
    expect(screen.queryByText('연결을 확인하고 다시 시도해 주세요.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('초대 코드')).toHaveValue('');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
