import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import {
  analyzeLogSource,
  getCurrentUser,
  getLogEntries,
  getLogSources,
  getRuntimeMode,
  signIn,
  updateIncidentStatus,
} from './api';

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
    getLogSources: vi.fn(async () => []),
    analyzeLogSource: vi.fn(),
    getLogEntries: vi.fn(async () => []),
    getWorkspaceMembers: vi.fn(async () => []),
    updateIncidentStatus: vi.fn(
      async (id: string, status: 'investigating' | 'identified' | 'monitoring' | 'resolved') => {
        const incident = demoIncidents.find((item) => item.id === id)!;
        return { ...incident, status };
      },
    ),
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

  it('opens the log explorer and reports an empty state from the API', async () => {
    render(<App />);
    await screen.findByText('Recent incidents');
    fireEvent.click(screen.getByRole('button', { name: 'Log explorer' }));
    expect(await screen.findByRole('dialog', { name: 'Log explorer' })).toBeInTheDocument();
    expect(await screen.findByText(/No log files yet/)).toBeInTheDocument();
    expect(getLogSources).toHaveBeenCalledOnce();
  });

  it('shows a log analysis report with source line citations', async () => {
    vi.mocked(getLogSources).mockResolvedValueOnce([
      {
        id: 'demo-source-1',
        originalName: 'checkout.log',
        sizeBytes: 120,
        lineCount: 2,
        redacted: true,
        format: 'text',
        createdAt: '2026-11-05T10:00:00.000Z',
      },
    ]);
    vi.mocked(getLogEntries).mockResolvedValueOnce([
      {
        lineNumber: 1,
        level: 'error',
        service: 'checkout-api',
        message: 'database connection pool exhausted',
      },
    ]);
    vi.mocked(analyzeLogSource).mockResolvedValueOnce({
      source: {
        id: 'demo-source-1',
        name: 'checkout.log',
        totalLines: 2,
        analyzedLines: 1,
        truncated: false,
      },
      analysisMode: 'local-rules',
      summary: 'Reviewed 1 parsed line; found one error pattern.',
      severity: 'medium',
      confidence: 39,
      rootCauseHypothesis: 'Connection pool pressure is a possibility.',
      errorClusters: [
        { signature: 'database connection pool exhausted', count: 1, lineNumbers: [1] },
      ],
      stackTraceLineNumbers: [],
      anomalies: [],
      evidence: [
        {
          lineNumber: 1,
          level: 'error',
          service: 'checkout-api',
          message: 'database connection pool exhausted',
        },
      ],
      recommendations: ['Check connection saturation.'],
    });
    render(<App />);
    await screen.findByText('Recent incidents');
    fireEvent.click(screen.getByRole('button', { name: 'Log explorer' }));
    fireEvent.click(await screen.findByRole('button', { name: /checkout\.log/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Analyze this log source/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Log investigation results' });
    expect(within(dialog).getByText('Local rules')).toBeInTheDocument();
    expect(within(dialog).getByText('Line 1 · error · checkout-api')).toBeInTheDocument();
    expect(within(dialog).getByText('Check connection saturation.')).toBeInTheDocument();
    expect(analyzeLogSource).toHaveBeenCalledWith('demo-source-1');
  });

  it('saves the alert threshold from settings', async () => {
    render(<App />);
    await screen.findByText('Recent incidents');
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Alert settings' });
    fireEvent.change(within(dialog).getByLabelText('Notify me for incidents at or above'), {
      target: { value: 'critical' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save alert threshold' }));
    expect(await screen.findByText('Alert threshold saved on this browser.')).toBeInTheDocument();
    expect(localStorage.getItem('tracemind-alert-severity')).toBe('critical');
  });

  it('updates an incident status from its investigation', async () => {
    render(<App />);
    await screen.findByText('Recent incidents');
    const table = screen.getByRole('table');
    await within(table).findByText('INC-2847');
    fireEvent.click(screen.getByRole('button', { name: 'More actions for INC-2847' }));
    fireEvent.click(within(table).getByRole('button', { name: 'Open investigation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Incident investigation' });
    fireEvent.change(within(dialog).getByLabelText('Update incident status'), {
      target: { value: 'monitoring' },
    });
    await waitFor(() =>
      expect(updateIncidentStatus).toHaveBeenCalledWith('INC-2847', 'monitoring'),
    );
    expect(await screen.findByText('INC-2847 status updated to Monitoring.')).toBeInTheDocument();
  });

  it('changes the chart range and flips to the next incident page', async () => {
    render(<App />);
    await screen.findByText('Recent incidents');
    fireEvent.click(screen.getByRole('button', { name: /Last 24 hours/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Last 7 days' }));
    expect(screen.getByRole('button', { name: /Last 7 days/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('INC-2844')).toBeInTheDocument();
  });
});
