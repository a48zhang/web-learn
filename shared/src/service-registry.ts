import axios from 'axios';

export interface RegisterRequest {
  name: string;
  url: string;
  routes: string[];
  metadata?: {
    version?: string;
    description?: string;
  };
}

export interface ServiceEntry {
  name: string;
  url: string;
  routes: string[];
  lastHeartbeat: string;
  registeredAt: string;
}

const getRegistryUrl = (path: string) => {
  const baseUrl = process.env.REGISTRY_URL || 'http://localhost:3010';
  return `${baseUrl}${path}`;
};

export async function registerService(config: RegisterRequest): Promise<void> {
  await axios.post(getRegistryUrl('/register'), config);
}

export async function fetchServices(): Promise<ServiceEntry[]> {
  const res = await axios.get(getRegistryUrl('/services'));
  return res.data;
}

export async function sendHeartbeat(name: string): Promise<void> {
  await axios.post(getRegistryUrl('/heartbeat'), { name });
}

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function startHeartbeat(name: string, intervalMs = 5000): void {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(async () => {
    try {
      await sendHeartbeat(name);
    } catch {
      // Silently ignore heartbeat errors — next interval will retry
    }
  }, intervalMs);
}

export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}
