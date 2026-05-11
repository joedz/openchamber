import { setRuntimeBearerToken } from '@openchamber/ui/lib/runtime-auth';
import { installRuntimeFetchBridge } from '@openchamber/ui/lib/runtime-fetch';
import { configureRuntimeUrlResolver } from '@openchamber/ui/lib/runtime-url';
import { createWebAPIs } from './api';

declare global {
  interface Window {
    __OPENCHAMBER_API_BASE_URL__?: string;
    __OPENCHAMBER_CLIENT_TOKEN__?: string;
  }
}

export const createConfiguredWebAPIs = () => {
  const apiBaseUrl = typeof window.__OPENCHAMBER_API_BASE_URL__ === 'string'
    ? window.__OPENCHAMBER_API_BASE_URL__.trim()
    : '';
  const clientToken = typeof window.__OPENCHAMBER_CLIENT_TOKEN__ === 'string'
    ? window.__OPENCHAMBER_CLIENT_TOKEN__.trim()
    : '';

  const urls = configureRuntimeUrlResolver({
    apiBaseUrl: apiBaseUrl || undefined,
    realtimeBaseUrl: apiBaseUrl || undefined,
  });
  setRuntimeBearerToken(clientToken || null);
  installRuntimeFetchBridge();
  return createWebAPIs({ urls });
};
