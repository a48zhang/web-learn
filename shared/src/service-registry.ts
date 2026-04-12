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
let registered = false;
let heartbeatConfig: RegisterRequest | null = null;

const doRegister = async (config: RegisterRequest): Promise<boolean> => {
  try {
    await registerService(config);
    registered = true;
    console.log(`[${config.name}] registered with service registry`);
    return true;
  } catch {
    return false;
  }
};

export function startHeartbeat(config: RegisterRequest, intervalMs = 5000): void {
  if (heartbeatInterval) return;
  heartbeatConfig = config;
  registered = false;

  heartbeatInterval = setInterval(async () => {
    if (!registered) {
      if (!await doRegister(config)) return;
    }
    try {
      await sendHeartbeat(config.name);
    } catch (err) {
      // Registry unreachable — mark unregistered so we re-register next time
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        registered = false;
      }
    }
  }, intervalMs);
}

export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  registered = false;
  heartbeatConfig = null;
}
