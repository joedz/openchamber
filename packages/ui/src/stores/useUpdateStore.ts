import { create } from 'zustand';
import type { UpdateInfo, UpdateProgress } from '@/lib/desktop';
import { getDeviceInfo } from '@/lib/device';
import { useUIStore } from './useUIStore';
import {
  checkForDesktopUpdates,
  downloadDesktopUpdate,
  restartToApplyUpdate,
  isDesktopLocalOriginActive,
  isElectronShell,
  isVSCodeRuntime,
  isWebRuntime,
} from '@/lib/desktop';
import { runtimeFetch } from '@/lib/runtime-fetch';

type UpdateState = {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  info: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
  runtimeType: 'desktop' | 'web' | 'vscode' | null;
  lastChecked: number | null;
  nextCheckInSec: number | null;
};

interface UpdateStore extends UpdateState {
  checkForUpdates: () => Promise<number | null>;
  downloadUpdate: () => Promise<void>;
  restartToUpdate: () => Promise<void>;
  dismiss: () => void;
  reset: () => void;
}

type ClientRuntime = 'desktop' | 'web' | 'vscode';

function detectDeviceClass(): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown';
  try {
    const { deviceType } = getDeviceInfo();
    return deviceType;
  } catch {
    return 'unknown';
  }
}

function detectArch(): 'arm64' | 'x64' | 'unknown' {
  const vscodeArch = typeof window !== 'undefined'
    ? (window as { __VSCODE_CONFIG__?: { arch?: string } }).__VSCODE_CONFIG__?.arch?.toLowerCase?.()
    : undefined;
  if (vscodeArch === 'arm64' || vscodeArch === 'aarch64') return 'arm64';
  if (vscodeArch === 'x64' || vscodeArch === 'amd64' || vscodeArch === 'x86_64') return 'x64';

  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { userAgentData?: { architecture?: string } }).userAgentData : undefined;
  const fromUAData = nav?.architecture?.toLowerCase?.();
  if (fromUAData === 'arm' || fromUAData === 'arm64' || fromUAData === 'aarch64') return 'arm64';
  if (fromUAData === 'x86' || fromUAData === 'x64' || fromUAData === 'amd64') return 'x64';

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
  if (ua.includes('aarch64') || ua.includes('arm64') || ua.includes('armv')) return 'arm64';
  if (ua.includes('x86_64') || ua.includes('x64') || ua.includes('amd64') || ua.includes('win64')) return 'x64';
  return 'unknown';
}

function detectPlatform(): 'macos' | 'windows' | 'linux' | 'web' {
  if (typeof navigator === 'undefined') return 'web';
  const platform = (navigator.platform || '').toLowerCase();
  if (platform.includes('mac')) return 'macos';
  if (platform.includes('win')) return 'windows';
  if (platform.includes('linux')) return 'linux';
  return 'web';
}

function mapRuntimeParams(runtime: ClientRuntime): URLSearchParams {
  // INTERNAL-NETWORK: reportUsage always false — anonymous telemetry disabled.
  const params = new URLSearchParams({ reportUsage: 'false' });
  params.set('deviceClass', detectDeviceClass());
  params.set('arch', detectArch());
  params.set('platform', detectPlatform());
  if (runtime === 'desktop') {
    params.set('appType', 'desktop-electron');
    params.set('instanceMode', isDesktopLocalOriginActive() ? 'local' : 'remote');
    return params;
  }

  if (runtime === 'vscode') {
    params.set('appType', 'vscode');
    params.set('instanceMode', 'local');
    return params;
  }

  params.set('appType', 'web');
  params.set('instanceMode', 'unknown');
  return params;
}

async function checkForWebUpdates(_runtime: ClientRuntime, currentVersion?: string): Promise<UpdateInfo | null> {
  // INTERNAL-NETWORK: external update channel disabled. Skip the fetch
  // entirely and report no update available so the UI never offers one.
  return {
    available: false,
    version: undefined,
    currentVersion: currentVersion ?? 'unknown',
    body: undefined,
    nextSuggestedCheckInSec: undefined,
    packageManager: undefined,
    updateCommand: undefined,
  };
}

function detectRuntimeType(): 'desktop' | 'web' | 'vscode' | null {
  if (isElectronShell()) {
    return 'desktop';
  }
  if (isVSCodeRuntime()) return 'vscode';
  if (isWebRuntime()) return 'web';
  return null;
}

const initialState: UpdateState = {
  checking: false,
  available: false,
  downloading: false,
  downloaded: false,
  info: null,
  progress: null,
  error: null,
  runtimeType: null,
  lastChecked: null,
  nextCheckInSec: null,
};

export const useUpdateStore = create<UpdateStore>()((set, get) => ({
  ...initialState,

  checkForUpdates: async () => {
    // INTERNAL-NETWORK: external update channel disabled. Surface no update.
    set({
      checking: false,
      available: false,
      info: null,
      error: null,
      lastChecked: Date.now(),
      nextCheckInSec: null,
      runtimeType: detectRuntimeType(),
    });
    return null;
  },

  downloadUpdate: async () => {
    const { available, runtimeType } = get();

    // For web runtime, there's no download - user uses in-app update or CLI
    if (runtimeType !== 'desktop' || !available) {
      return;
    }

    set({ downloading: true, error: null, progress: null });

    try {
      const desktopInfo = await checkForDesktopUpdates();
      if (!desktopInfo?.available) {
        throw new Error('Update detected, but desktop package is not ready yet. Retry in a moment.');
      }

      set((state) => ({
        info: state.info
          ? {
            ...state.info,
            ...desktopInfo,
            // Keep the richer sidecar-sourced changelog; desktopInfo.body is
            // often the bare "See release notes at..." fallback from the
            // updater and would otherwise clobber the nice changelog.
            body: state.info.body || desktopInfo.body,
            available: state.info.available,
          }
          : desktopInfo,
      }));

      const ok = await downloadDesktopUpdate((progress) => {
        set({ progress });
      });
      if (!ok) {
        throw new Error('Desktop update only works on Local instance');
      }
      set({ downloading: false, downloaded: true });
    } catch (error) {
      set({
        downloading: false,
        error: error instanceof Error ? error.message : 'Failed to download update',
      });
    }
  },

  restartToUpdate: async () => {
    const { downloaded, runtimeType } = get();

    if (runtimeType !== 'desktop' || !downloaded) {
      return;
    }

    try {
      const ok = await restartToApplyUpdate();
      if (!ok) {
        throw new Error('Desktop restart only works on Local instance');
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to restart',
      });
    }
  },

  dismiss: () => {
    set({ available: false, downloaded: false, info: null });
  },

  reset: () => {
    set(initialState);
  },
}));
