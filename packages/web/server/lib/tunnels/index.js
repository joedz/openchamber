import {
  TUNNEL_MODE_QUICK,
  TUNNEL_PROVIDER_CLOUDFLARE,
  TunnelServiceError,
  normalizeTunnelStartRequest,
  validateTunnelStartRequest,
} from './types.js';
import { getTunnelDependencyInstallInfo } from './install-help.js';

export function createTunnelService({
  registry,
  getController,
  setController,
  getActivePort,
  onQuickTunnelWarning,
}) {
  if (!registry) {
    throw new Error('Tunnel service requires a provider registry');
  }

  const resolveActiveMode = () => {
    const controller = getController();
    if (!controller || typeof controller.mode !== 'string') {
      return null;
    }
    return controller.mode;
  };

  const resolveActiveProvider = () => {
    const controller = getController();
    if (!controller || typeof controller.provider !== 'string') {
      return null;
    }
    return controller.provider;
  };

  const stop = () => {
    const controller = getController();
    if (!controller) {
      return false;
    }

    const providerId = typeof controller.provider === 'string' ? controller.provider : '';
    const provider = providerId ? registry.get(providerId) : null;
    if (provider?.stop) {
      provider.stop(controller);
    } else {
      controller.stop?.();
    }
    setController(null);
    return true;
  };

  const checkAvailability = async (providerId) => {
    const provider = registry.get(providerId);
    if (!provider) {
      throw new TunnelServiceError('provider_unsupported', `Unsupported tunnel provider: ${providerId}`);
    }
    const result = await provider.checkAvailability();
    return result;
  };

  // Mutex to prevent concurrent tunnel starts from orphaning child processes.
  let startLock = Promise.resolve();

  const start = async (_rawRequest, _options = {}) => {
    // INTERNAL-NETWORK: tunnels disabled — no provider is ever spawned, no
    // binary (cloudflared / ngrok) ever executes.
    throw new TunnelServiceError('tunnels_disabled', 'Tunnels are disabled in this deployment');
  };

  const getPublicUrl = () => {
    const controller = getController();
    if (!controller) {
      return null;
    }
    const provider = registry.get(controller.provider);
    if (!provider) {
      return controller.getPublicUrl?.() ?? null;
    }
    return provider.resolvePublicUrl(controller);
  };

  const getProviderMetadata = () => {
    const controller = getController();
    if (!controller) {
      return null;
    }
    const provider = registry.get(controller.provider);
    return provider?.getMetadata?.(controller) ?? null;
  };

  return {
    start,
    stop,
    checkAvailability,
    getPublicUrl,
    getProviderMetadata,
    resolveActiveMode,
    resolveActiveProvider,
  };
}
