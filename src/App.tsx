import React, { useEffect } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { TopToolbar } from './components/layout/TopToolbar';
import { SplitLayout } from './components/layout/SplitLayout';
import { Sidebar } from './components/sidebar/Sidebar';
import { ViewerContainer } from './components/viewer/ViewerContainer';
import { StatusBar } from './components/layout/StatusBar';
import { ToastContainer } from './components/common/Toast';
import { QuickJumpModal } from './components/navigation/QuickJumpModal';
import { useFileStore } from './store/useFileStore';
import { useFileWatcher } from './hooks/useFileWatcher';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export const App: React.FC = () => {
  const initWorkspace = useFileStore((s) => s.initWorkspace);

  // Initialize workspace directory on mount
  useEffect(() => {
    initWorkspace();
  }, [initWorkspace]);

  // Activate real-time file watcher & event subscription
  useFileWatcher();

  // Activate desktop keyboard shortcuts (F2, Del, Ctrl+C/V/X, Ctrl+F, F5)
  useKeyboardShortcuts();

  return (
    <div className="w-screen h-screen flex flex-col bg-[#0b0c12] text-slate-100 overflow-hidden font-sans">
      {/* Title Bar */}
      <TitleBar />

      {/* Top Navigation & Action Toolbar */}
      <TopToolbar />

      {/* Main 2-Panel Split Layout */}
      <SplitLayout
        sidebar={<Sidebar />}
        content={<ViewerContainer />}
        defaultSidebarWidth={320}
        minWidth={240}
        maxWidth={550}
      />

      {/* Bottom Status Bar */}
      <StatusBar />

      {/* Toast Notification Container */}
      <ToastContainer />

      {/* Quick Jump Command Palette (Ctrl+P / Ctrl+K) */}
      <QuickJumpModal />
    </div>
  );
};

export default App;
