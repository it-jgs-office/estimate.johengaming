/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { NavView, Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ToastProvider, useToast } from './context/ToastContext';
import { AuthView } from './views/AuthView';
import { DashboardView } from './views/DashboardView';
import { AIEstimatorView } from './views/AIEstimatorView';
import { EstimationHistoryView } from './views/EstimationHistoryView';
import { GamesView } from './views/GamesView';
import { ItemDatabaseView } from './views/ItemDatabaseView';
import { ImportDatabaseView } from './views/ImportDatabaseView';
import { PricingSettingsView } from './views/PricingSettingsView';
import { ActivityLogsView } from './views/ActivityLogsView';
import { GeneralSettingsView } from './views/GeneralSettingsView';
import { repository } from './services/repository';
import { Estimation, RecognizedItem, User } from './types';

function MainAppContent() {
  const { showToast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => repository.isAuthenticated());
  const [currentView, setCurrentView] = useState<NavView>('dashboard');
  const [currentUser, setCurrentUser] = useState<User>(() => repository.getCurrentUser());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Cross-view payloads
  const [estimatorPreload, setEstimatorPreload] = useState<{
    items?: RecognizedItem[];
    gameId?: string;
  }>({});
  const [historyDetailEst, setHistoryDetailEst] = useState<Estimation | null>(null);

  // Enforce Clean Light Mode permanently as requested
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Subscribe to repository updates
  useEffect(() => {
    const unsubscribe = repository.subscribe(() => {
      setCurrentUser(repository.getCurrentUser());
    });
    return unsubscribe;
  }, []);

  const handleLogout = () => {
    repository.logout();
    setIsAuthenticated(false);
    showToast('Telah Keluar', 'Sesi Anda telah diakhiri dengan aman.', 'info');
  };

  const handleDuplicateToEstimator = (items: RecognizedItem[], gameId: string) => {
    setEstimatorPreload({ items, gameId });
    setCurrentView('estimator');
  };

  const handleOpenEstimationDetail = (est: Estimation) => {
    setHistoryDetailEst(est);
    setCurrentView('history');
  };

  const activeGame = repository.getGameById(
    estimatorPreload.gameId || repository.getSettings().defaultGameId || 'GAME-FF'
  );

  // If not logged in, show Auth / Login View
  if (!isAuthenticated) {
    return <AuthView onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col md:flex-row antialiased">
      {/* Sidebar Desktop */}
      <div className="hidden md:block">
        <Sidebar
          currentView={currentView}
          onSelectView={(view) => {
            setCurrentView(view);
            if (view !== 'history') setHistoryDetailEst(null);
          }}
          currentUser={currentUser}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onLogout={handleLogout}
        />
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">
            <Sidebar
              currentView={currentView}
              onSelectView={(view) => {
                setCurrentView(view);
                setIsMobileMenuOpen(false);
                if (view !== 'history') setHistoryDetailEst(null);
              }}
              currentUser={currentUser}
              isCollapsed={false}
              onToggleCollapse={() => {}}
              onLogout={() => {
                setIsMobileMenuOpen(false);
                handleLogout();
              }}
            />
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <TopBar
          currentView={currentView}
          currentUser={currentUser}
          activeGame={activeGame}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onLogout={handleLogout}
          onQuickNewEstimation={() => {
            setEstimatorPreload({});
            setCurrentView('estimator');
          }}
        />

        <main className="flex-1 flex overflow-hidden bg-[#F8FAFC]">
          {currentView === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              onNavigate={(v) => setCurrentView(v)}
              onOpenEstimationDetail={handleOpenEstimationDetail}
            />
          )}

          {currentView === 'estimator' && (
            <AIEstimatorView
              currentUser={currentUser}
              onNavigateToHistory={() => setCurrentView('history')}
              onNavigateToSettings={() => setCurrentView('pricing')}
              preloadedItems={estimatorPreload.items}
              preloadedGameId={estimatorPreload.gameId}
            />
          )}

          {currentView === 'history' && (
            <EstimationHistoryView
              currentUser={currentUser}
              onDuplicateToEstimator={handleDuplicateToEstimator}
              selectedDetailEst={historyDetailEst}
              onCloseDetail={() => setHistoryDetailEst(null)}
            />
          )}

          {currentView === 'games' && <GamesView currentUser={currentUser} />}

          {currentView === 'items' && (
            <ItemDatabaseView
              currentUser={currentUser}
              onNavigateToImport={() => setCurrentView('import')}
            />
          )}

          {currentView === 'import' && (
            <ImportDatabaseView
              currentUser={currentUser}
              onNavigateToItems={() => setCurrentView('items')}
            />
          )}

          {currentView === 'pricing' && <PricingSettingsView currentUser={currentUser} />}

          {currentView === 'logs' && <ActivityLogsView />}

          {currentView === 'settings' && (
            <GeneralSettingsView
              currentUser={currentUser}
              isDarkMode={false}
              onToggleTheme={() => {}}
              onResetComplete={() => {
                setCurrentUser(repository.getCurrentUser());
                setEstimatorPreload({});
                setHistoryDetailEst(null);
                setCurrentView('dashboard');
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainAppContent />
    </ToastProvider>
  );
}
