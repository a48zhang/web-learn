import { Application } from 'express';
import { fetchServices } from '@web-learn/shared';
import { mountProxies, updateProxyGroups } from './proxyManager';

const pollWithRetry = async (maxRetries: number, delayMs: number): Promise<void> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fetchServices();
      console.log(`[gateway] Registry reachable (attempt ${i + 1})`);
      return;
    } catch {
      console.log(`[gateway] Waiting for registry (attempt ${i + 1}/${maxRetries})...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Registry not available after max retries');
};

export const waitForRegistry = async (): Promise<void> => {
  await pollWithRetry(15, 2000);
};

export const initServiceDiscovery = (app: Application): void => {
  (async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const services = await fetchServices();
        if (services.length > 0) {
          console.log(`[gateway] Discovered ${services.length} services from registry`);
          mountProxies(app, services);
          return;
        }
        console.log(`[gateway] No services registered yet (attempt ${attempt + 1}/10)...`);
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        console.error('[gateway] Failed to discover services:', err);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    console.warn('[gateway] No services discovered after retries');
  })().catch(() => {});

  setInterval(async () => {
    try {
      const services = await fetchServices();
      updateProxyGroups(services);
    } catch (err) {
      console.log('[gateway] Registry sync failed, will retry in 10s');
    }
  }, 10000);
};
