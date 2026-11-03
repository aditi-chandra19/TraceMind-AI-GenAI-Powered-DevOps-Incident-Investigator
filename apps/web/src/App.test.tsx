import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { getCurrentUser, getRuntimeMode, signIn } from './api';

vi.mock('./api', async () => {
  const { demoIncidents } = await import('./data/demo');
  return {
    getCurrentUser: vi.fn(async () => ({
      user: {
        id: 'demo-admin',
        name: 'TraceMind Demo Admin',
        email: 'admin@tracemind.local',
        role: 'admin' as const,
      },
      mode: 'demo' as const,
    })),
    getRuntimeMode: vi.fn(async () => 'demo' as const),
    getIncidents: vi.fn(async () => ({ data: demoIncidents, mode: 'demo' as const })),
    signIn: vi.fn(async () => ({
      user: {
        id: 'demo-admin',
        name: 'TraceMind Demo Admin',
        email: 'admin@tracemind.local',
        role: 'admin' as const,
      },
      mode: 'demo' as const,
    })),
    signUp: vi.fn(),
    signOut: vi.fn(),
    uploadLog: vi.fn(),
  };
});

describe('TraceMind dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it('shows seeded incidents and the demo-mode label', async () => {
    render(<App />);
    expect(await screen.findByText('DEMO DATA')).toBeInTheDocument();
    expect(screen.getByText('Recent incidents')).toBeInTheDocument();
    expect(await within(screen.getByRole('table')).findByText('INC-2847')).toBeInTheDocument();
  });

  it('shows the sign-in screen and enters the dashboard after login', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Recent incidents')).toBeInTheDocument();
    expect(signIn).toHaveBeenCalledWith('admin@tracemind.local', 'TraceMindDemo!2026');
  });

  it('does not show demo credentials for a MongoDB workspace', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    vi.mocked(getRuntimeMode).mockResolvedValueOnce('mongodb');
    render(<App />);
    await screen.findByRole('heading', { name: 'Welcome back' });
    expect(screen.queryByText('Ready-to-use demo account')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByText('TraceMind AI · MongoDB workspace')).toBeInTheDocument();
  });

  it('filters incident rows by search text', async () => {
    render(<App />);
    const search = await screen.findByRole('textbox', { name: 'Search incidents' });
    fireEvent.change(search, { target: { value: 'payment' } });
    const table = screen.getByRole('table');
    await waitFor(() => expect(within(table).getByText('INC-2846')).toBeInTheDocument());
    expect(within(table).queryByText('INC-2847')).not.toBeInTheDocument();
  });

  it('filters incidents by severity', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Filter/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by severity' }), {
      target: { value: 'critical' },
    });
    const table = screen.getByRole('table');
    await waitFor(() => expect(within(table).getByText('INC-2847')).toBeInTheDocument());
    expect(within(table).queryByText('INC-2846')).not.toBeInTheDocument();
  });
});
