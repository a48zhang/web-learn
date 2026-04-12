export * from './types';
export * from './auth';
export {
  registerService,
  fetchServices,
  sendHeartbeat,
  startHeartbeat,
  stopHeartbeat,
} from './service-registry';
export type { RegisterRequest, ServiceEntry } from './service-registry';