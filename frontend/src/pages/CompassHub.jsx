/**
 * CompassHub — Full-width Compass AI (Pass 3 cleanup)
 *   Research & Capture panel completely removed.
 *   AIAssistant now occupies the entire viewport.
 */
import React from 'react';
import AIAssistant from './AIAssistant';

export default function CompassHub() {
  return (
    <div
      className="h-full flex overflow-hidden"
      style={{ background: 'var(--app-bg)' }}
      data-testid="compass-hub"
    >
      <div className="flex-1 min-w-0 overflow-hidden" data-testid="compass-ai-pane">
        <AIAssistant />
      </div>
    </div>
  );
}
