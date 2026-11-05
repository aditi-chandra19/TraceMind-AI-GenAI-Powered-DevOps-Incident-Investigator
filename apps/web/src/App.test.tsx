import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import {
  analyzeLogSource,
  getCurrentUser,
  getLogEntries,
  getLogSources,
  getRuntimeMode,
  getInvestigationFeedback,
  getSimilarIncidents,
  signIn,
  sendInvestigationMessage,
  submitInvestigationFeedback,
  updateIncidentStatus,
} from './api';

const mockPdfSave = vi.hoisted(() => vi.fn());
vi.mock('jspdf', () => ({
  jsPDF: class {
    internal = { pageSize: { getWidth: () => 595, getHeight: () => 842 } };
    setFont = vi.fn();
    setFontSize = vi.fn();
    setTextColor = vi.fn();
    splitTextToSize = (value: string) => [value];
    text = vi.fn();
    addPage = vi.fn();
    save = mockPdfSave;
  },
}));

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
    sendInvestigationMessage: vi.fn(async () => ({
      incidentId: 'INC-2847',
      mode: 'local-rules' as const,
      retrievalMode: 'keyword' as const,
      answer: 'The uploaded evidence should be compared with the release timeline.',
      hypothesis: 'Unverified: connection pool pressure.',
      citations: [
        {
          id: 'doc:db-pool-checks',
          title: 'Database connection pool exhaustion',
          source: 'runbook://database-pool-exhaustion.md',
          lineStart: 1,
          lineEnd: 7,
          excerpt: 'Compare active connections and checkout wait time.',
        },
      ],
      nextChecks: ['Compare the event with the recent deployment.'],
      safety: 'Suggestions are read-only. Human approval is required before any remediation.',
    })),
    submitInvestigationFeedback: vi.fn(async () => ({
      accepted: true as const,
      rating: 'helpful' as const,
    })),
    getSimilarIncidents: vi.fn(async () => [
      {
        incident: { ...demoIncidents[2]!, id: 'INC-2845' },
        similarityScore: 42,
        reasons: ['shared terms: timeout'],
      },
    ]),
    getInvestigationFeedback: vi.fn(async () => [
      {
        incidentId: 'INC-2847',
        actorEmail: 'analyst@example.test',
        rating: 'helpful' as const,
        comment: 'Citations helped.',
        createdAt: '2026-11-05T12:00:00.000Z',
      },
    ]),
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

  it('sends a contextual investigation question and displays cited guidance', async () => {
    render(<App />);
    await screen.findByText('Recent incidents');
    const table = screen.getByRole('table');
    await within(table).findByText('INC-2847');
    fireEvent.click(screen.getByRole('button', { name: 'More actions for INC-2847' }));
    fireEvent.click(within(table).getByRole('button', { name: 'Open investigation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Incident investigation' });
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: 'Ask an investigation question' }),
      {
        target: { value: 'What should I check next?' },
      },
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send investigation question' }));
    expect(
      await within(dialog).findByText(
        'The uploaded evidence should be compared with the release timeline.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/database-pool-exhaustion\.md:1–7/)).toBeInTheDocument();
    expect(sendInvestigationMessage).toHaveBeenCalledWith(
      'INC-2847',
      'What should I check next?',
      [],
    );
  });

  it('finds a similar incident and opens it from the results', async () => {
    render(<App />);
    await screen.findByText('Recent incidents');
    const table = screen.getByRole('table');
    await within(table).findByText('INC-2847');
    fireEvent.click(screen.getByRole('button', { name: 'More actions for INC-2847' }));
    fireEvent.click(within(table).getByRole('button', { name: 'Open investigation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Incident investigation' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Find similar' }));
    expect(
      await within(dialog).findByText(/INC-2845 · Elevated 5xx on user profile endpoint/),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /INC-2845 · Elevated 5xx/ }));
    expect(
      await within(dialog).findByRole('heading', { name: 'Elevated 5xx on user profile endpoint' }),
    ).toBeInTheDocument();
    expect(getSimilarIncidents).toHaveBeenCalledWith('INC-2847');
  });

  it('records investigation feedback and provides PDF and Markdown report actions', async () => {
    render(<App />);
    await screen.findByText('Recent incidents');
    const table = screen.getByRole('table');
    await within(table).findByText('INC-2847');
    fireEvent.click(screen.getByRole('button', { name: 'More actions for INC-2847' }));
    fireEvent.click(within(table).getByRole('button', { name: 'Open investigation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Incident investigation' });
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: 'Ask an investigation question' }),
      { target: { value: 'What should I check next?' } },
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send investigation question' }));
    await within(dialog).findByText(
      'The uploaded evidence should be compared with the release timeline.',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Helpful' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Optional feedback comment' }), {
      target: { value: 'Citations helped.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send feedback' }));
    expect(
      await within(dialog).findByText('Thanks — your feedback was recorded.'),
    ).toBeInTheDocument();
    expect(submitInvestigationFeedback).toHaveBeenCalledWith({
      incidentId: 'INC-2847',
      rating: 'helpful',
      comment: 'Citations helped.',
    });

    mockPdfSave.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Reports' }));
    expect(await screen.findByRole('dialog', { name: 'Incident reports' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(mockPdfSave).toHaveBeenCalledWith(expect.stringMatching(/\.pdf$/)));
    expect(getInvestigationFeedback).toHaveBeenCalled();
  });
});
