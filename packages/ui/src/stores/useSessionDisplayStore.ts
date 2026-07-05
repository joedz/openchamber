import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SessionDisplayMode = 'default' | 'minimal';

type SessionDisplayStore = {
  displayMode: SessionDisplayMode;
  showRecentSection: boolean;
  showArchivedSessions: boolean;
  setDisplayMode: (mode: SessionDisplayMode) => void;
  setShowRecentSection: (show: boolean) => void;
  setShowArchivedSessions: (show: boolean) => void;
  toggleRecentSection: () => void;
  toggleArchivedSessions: () => void;
};

export const useSessionDisplayStore = create<SessionDisplayStore>()(
  persist(
    (set) => ({
      displayMode: 'minimal',
      showRecentSection: true,
      // INTERNAL-NETWORK: default to VISIBLE so the archived bucket appears
      // in the sidebar immediately after the user archives a session. Without
      // this, the session disappears from the active list and the user has
      // no visual confirmation that the archive succeeded (the toggle in the
      // sidebar header menu is hidden by default).
      showArchivedSessions: true,
      setDisplayMode: (mode) => set({ displayMode: mode }),
      setShowRecentSection: (show) => set({ showRecentSection: show }),
      setShowArchivedSessions: (show) => set({ showArchivedSessions: show }),
      toggleRecentSection: () => set((state) => ({ showRecentSection: !state.showRecentSection })),
      toggleArchivedSessions: () => set((state) => ({ showArchivedSessions: !state.showArchivedSessions })),
    }),
    {
      name: 'session-display-mode',
      version: 2,
      // v0 shipped 'default' as the only/initial mode, so most existing users
      // have it persisted by accident rather than choice. Nudge everyone onto
      // minimal once so the mode can be evaluated before removing it entirely.
      // INTERNAL-NETWORK: v2 also flips showArchivedSessions to true on
      // rehydrate — without this, users who had `false` persisted from the
      // pre-fix build would still see archived sessions hidden after archiving.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<SessionDisplayStore>;
        if (version < 1) {
          return { ...state, displayMode: 'minimal' };
        }
        if (version < 2) {
          return { ...state, showArchivedSessions: true };
        }
        return state;
      },
    },
  ),
);
