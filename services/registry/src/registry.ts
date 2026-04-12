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

  register(config: RegisterRequest): ServiceEntry {
    const now = new Date();
    const entry: ServiceEntry = {
      name: config.name,
      url: config.url,
      routes: config.routes,
      metadata: config.metadata,
      lastHeartbeat: now,
      registeredAt: this.services.has(config.name)
        ? this.services.get(config.name)!.registeredAt
        : now,
    };
    this.services.set(config.name, entry);
    console.log(`[registry] Registered: ${config.name} at ${config.url}`);
    return entry;
  }

  heartbeat(name: string): boolean {
    const entry = this.services.get(name);
    if (!entry) return false;
    entry.lastHeartbeat = new Date();
    return true;
  }

  getAll(): ServiceEntry[] {
    return Array.from(this.services.values());
  }

  startCleanup(intervalMs = 10000, timeoutMs = 15000): void {
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
