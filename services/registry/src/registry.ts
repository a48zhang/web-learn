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
  metadata?: RegisterRequest['metadata'];
  lastHeartbeat: Date;
  registeredAt: Date;
}

export class ServiceRegistry {
  private services = new Map<string, ServiceEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  private serviceKey(config: { name: string; url: string }): string {
    return `${config.name}@${config.url}`;
  }

  register(config: RegisterRequest): ServiceEntry {
    const now = new Date();
    const key = this.serviceKey(config);
    const entry: ServiceEntry = {
      name: config.name,
      url: config.url,
      routes: config.routes,
      metadata: config.metadata,
      lastHeartbeat: now,
      registeredAt: this.services.has(key)
        ? this.services.get(key)!.registeredAt
        : now,
    };
    this.services.set(key, entry);
    console.log(`[registry] Registered: ${config.name} at ${config.url} (key: ${key})`);
    return entry;
  }

  heartbeat(name: string, url?: string): boolean {
    // If url is provided, match by name+url. Otherwise match by name only (first instance).
    if (url) {
      const key = this.serviceKey({ name, url });
      const entry = this.services.get(key);
      if (!entry) return false;
      entry.lastHeartbeat = new Date();
      return true;
    }
    // Legacy: update all instances with matching name
    let found = false;
    for (const [key, entry] of this.services) {
      if (entry.name === name) {
        entry.lastHeartbeat = new Date();
        found = true;
      }
    }
    return found;
  }

  getAll(): ServiceEntry[] {
    return Array.from(this.services.values());
  }

  startCleanup(intervalMs = 10000, timeoutMs = 30000): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [name, entry] of this.services) {
        if (now - entry.lastHeartbeat.getTime() > timeoutMs) {
          this.services.delete(name);
          console.log(`[registry] Expired: ${name}`);
        }
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
