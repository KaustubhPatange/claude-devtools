/**
 * TabbedLayout - Main layout with project-centric sidebar and multi-pane tabbed content.
 *
 * Layout structure:
 * - Sidebar (280px): Project dropdown + date-grouped sessions
 * - Main content: PaneContainer with one or more panes, each with TabBar + content
 */

import { getTrafficLightPaddingForZoom } from '@renderer/constants/layout';
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts';
import { useZoomFactor } from '@renderer/hooks/useZoomFactor';
import { useStore } from '@renderer/store';
import { Loader2, Wifi } from 'lucide-react';

import { UpdateBanner } from '../common/UpdateBanner';
import { UpdateDialog } from '../common/UpdateDialog';
import { CommandPalette } from '../search/CommandPalette';

import { PaneContainer } from './PaneContainer';
import { Sidebar } from './Sidebar';

/**
 * SshConnectionIndicator - Shows SSH connection status in the layout.
 * Only visible when in SSH mode or connecting.
 */
const SshConnectionIndicator = (): React.JSX.Element | null => {
  const connectionState = useStore((s) => s.connectionState);
  const connectedHost = useStore((s) => s.connectedHost);

  if (connectionState === 'disconnected') return null;

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1 text-xs"
      style={{
        backgroundColor: 'var(--color-surface-sidebar)',
        borderBottom: '1px solid var(--color-border)',
        color: 'var(--color-text-muted)',
      }}
    >
      {connectionState === 'connecting' && (
        <>
          <Loader2 className="size-3 animate-spin text-yellow-400" />
          <span>Connecting to {connectedHost}...</span>
        </>
      )}
      {connectionState === 'connected' && (
        <>
          <Wifi className="size-3 text-green-400" />
          <span className="text-green-400">SSH: {connectedHost}</span>
        </>
      )}
      {connectionState === 'error' && (
        <>
          <div className="size-2 rounded-full bg-red-400" />
          <span className="text-red-400">SSH Error</span>
        </>
      )}
    </div>
  );
};

export const TabbedLayout = (): React.JSX.Element => {
  // Enable keyboard shortcuts
  useKeyboardShortcuts();
  const zoomFactor = useZoomFactor();
  const trafficLightPadding = getTrafficLightPaddingForZoom(zoomFactor);

  return (
    <div
      className="flex h-screen flex-col bg-claude-dark-bg text-claude-dark-text"
      style={
        { '--macos-traffic-light-padding-left': `${trafficLightPadding}px` } as React.CSSProperties
      }
    >
      <UpdateBanner />
      <SshConnectionIndicator />
      <div className="flex flex-1 overflow-hidden">
        {/* Command Palette (Cmd+K) */}
        <CommandPalette />

        {/* Sidebar - Project dropdown + Sessions (280px) */}
        <Sidebar />

        {/* Multi-pane content area */}
        <PaneContainer />
      </div>
      <UpdateDialog />
    </div>
  );
};
