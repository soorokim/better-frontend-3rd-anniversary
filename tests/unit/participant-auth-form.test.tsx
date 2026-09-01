// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParticipantAuthForm } from '@/components/forms/ParticipantAuthForm';

describe('ParticipantAuthForm', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('starts the nickname field empty after invitation verification', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ verified: true }), { status: 200 })));
    const user = userEvent.setup();
    render(<ParticipantAuthForm mode="register" />);

    await user.type(screen.getByLabelText('초대 코드'), 'test-invite-code-1234');
    await user.click(screen.getByRole('button', { name: '초대 코드 확인' }));

    expect(await screen.findByLabelText('닉네임')).toHaveValue('');
  });

  it('asks returning participants for only a nickname and PIN', () => {
    render(<ParticipantAuthForm mode="login" />);

    expect(screen.queryByLabelText('초대 코드')).not.toBeInTheDocument();
    expect(screen.getByLabelText('닉네임')).toBeInTheDocument();
    expect(screen.getByLabelText('6자리 PIN')).toBeInTheDocument();
  });
});
