import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { leagueDisplayName, leagueWordmarkClass } from '../../leagueBranding';

function percentileColor(percentile) {
  const value = Math.max(0, Math.min(100, Number(percentile) || 0));
  return `hsl(${(value / 100) * 120}, 75%, 42%)`;
}

function ordinal(value) {
  const rounded = Math.min(99, Math.round(Number(value)));
  const mod100 = rounded % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rounded}th`;
  return `${rounded}${({ 1: 'st', 2: 'nd', 3: 'rd' }[rounded % 10] || 'th')}`;
}

function formatValue(metric, mode) {
  const value = metric.isRate || mode === 'totals' ? metric.total : metric.per90;
  if (!Number.isFinite(value)) return '—';
  const precision = metric.suffix === '%'
    ? 1
    : mode === 'totals' && metric.statFormat === 'number'
      ? 0
      : 2;
  return `${value.toFixed(precision)}${metric.suffix === '%' ? '%' : ''}`;
}

function FullStatsDialog({ name, competition, season, groups, mode, onModeChange, onClose }) {
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const columnTitles = [
    ['Shooting', 'Possession'],
    ['Passing', 'Discipline'],
    ['Defending'],
  ];

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const renderMetric = (group, metric) => {
    const rawPercentile = metric.isRate || mode === 'totals'
      ? metric.totalPercentile
      : metric.per90Percentile;
    const percentile = Number.isFinite(rawPercentile) ? Math.min(99, rawPercentile) : null;

    return (
      <div className="full-stat-row" key={`${group.title}-${metric.key}`}>
        <span className="full-stat-label">{metric.label}</span>
        <strong>{formatValue(metric, mode)}</strong>
        <div className="full-stat-percentile">
          {percentile === null ? (
            <span>—</span>
          ) : (
            <>
              <i><b style={{ width: `${(percentile / 99) * 100}%`, backgroundColor: percentileColor(percentile) }} /></i>
              <span>{ordinal(percentile)}</span>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderGroup = (group, groupIndex) => {
    if (!group) return null;
    return (
      <section
        className="full-stat-group"
        key={group.title}
        style={{ '--stat-order': groupIndex }}
      >
        <h3>{group.title}</h3>
        <div className="full-stat-column-headings" aria-hidden="true">
          <span>Metric</span><span>Value</span><span>Percentile</span>
        </div>
        <div className="full-stat-rows">
          {group.metrics.map((metric) => renderMetric(group, metric))}
        </div>
      </section>
    );
  };

  return createPortal(
    <div className="full-stats-overlay" role="presentation" onClick={onClose}>
      <section
        className="full-stats-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="full-stats-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="full-stats-header">
          <div>
            <span className="full-stats-eyebrow">Comprehensive breakdown</span>
            <h2 id="full-stats-title">{name}</h2>
            <div className="full-stats-meta">
              <p>
                <span className={leagueWordmarkClass(competition)}>
                  {leagueDisplayName(competition, { detailed: true })}
                </span>
                {' · '}{season}
              </p>
            </div>
          </div>
          <div className="full-stats-header-actions">
            <div className="full-stats-mode" role="group" aria-label="Full stats display">
              <button type="button" className={mode === 'totals' ? 'active' : ''} onClick={() => onModeChange('totals')}>Totals</button>
              <button type="button" className={mode === 'per90' ? 'active' : ''} onClick={() => onModeChange('per90')}>Per 90</button>
            </div>
            <button ref={closeRef} type="button" className="full-stats-close" onClick={onClose} aria-label="Close full stats">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </header>

        <div className="full-stats-scroll">
          <div className="full-stats-content">
            {[0, 1, 2].map((column) => (
              <div className="full-stats-column" key={column}>
                {groups.map((group, groupIndex) => {
                  const assignedColumn = columnTitles.findIndex((titles) => titles.includes(group.title));
                  if ((assignedColumn === -1 ? groupIndex % 3 : assignedColumn) !== column) return null;
                  return renderGroup(group, groupIndex);
                })}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}

export default FullStatsDialog;
