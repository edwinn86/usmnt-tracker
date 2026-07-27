// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RosterTabs from '../src/components/roster/RosterTabs';

vi.mock('../src/components/roster/PlayerCardGrid', () => ({
  default: ({ playerIds }) => <div data-testid="player-grid">{playerIds.length} players</div>,
}));

describe('RosterTabs release metadata', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ generatedAt: '2026-07-27T19:44:06.728Z' }),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the snapshot date and opens an accessible About dialog', async () => {
    render(<RosterTabs />);

    expect(await screen.findByText('Updated July 27, 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'About this tracker' }));

    expect(screen.getByRole('dialog', { name: 'USMNT player pool, in one place.' }))
      .toBeInTheDocument();
    expect(screen.getByText('July 27, 2026')).toBeInTheDocument();
    expect(screen.getByText(/not affiliated with or endorsed by FotMob/i)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('falls back cleanly when the manifest is unavailable', async () => {
    fetch.mockRejectedValueOnce(new Error('offline'));
    render(<RosterTabs />);
    expect(await screen.findByText('FotMob data')).toBeInTheDocument();
  });
});
