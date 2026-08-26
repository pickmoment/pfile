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
import { useViewerStore } from './store/useViewerStore';
import { useFileWatcher } from './hooks/useFileWatcher';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export const App: React.FC = () => {
  const initWorkspace = useFileStore((s) => s.initWorkspace);
  const contentOnly = useViewerStore((s) => s.contentOnly);

  // Initialize workspace directory on mount
  useEffect(() => {
    initWorkspace();
  }, [initWorkspace]);

  // Activate real-time file watcher & event subscription
  useFileWatcher();

  // Activate desktop keyboard shortcuts (F2, Del, Ctrl+C/V/X, Ctrl+F, F5)
  useKeyboardShortcuts();

  return (
    <div className="w-screen h-screen flex flex-col bg-[var(--s1)] text-[var(--tx1)] overflow-hidden font-sans">
      {!contentOnly && <TitleBar />}
      {!contentOnly && <TopToolbar />}

      {contentOnly ? (
        <div className="flex-1 w-full h-full overflow-hidden bg-[var(--s1)]">
          <ViewerContainer />
        </div>
      ) : (
        <SplitLayout
          sidebar={<Sidebar />}
          content={<ViewerContainer />}
          defaultSidebarWidth={320}
          minWidth={240}
          maxWidth={550}
        />
      )}

      {!contentOnly && <StatusBar />}

      <ToastContainer />
      <QuickJumpModal />
    </div>
  );
};

export default App;
