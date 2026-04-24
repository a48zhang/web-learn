import type { Request } from 'express';
import {
  AI_PROXY_TIMEOUT,
  DEFAULT_PROXY_TIMEOUT,
  createProxyOptions,
  forwardUserContextHeaders,
} from '../src/proxyManager';

describe('proxyManager', () => {
  it('uses a streaming-friendly timeout for AI routes', () => {
    const options = createProxyOptions('http://ai-service:3004', '/api/ai/chat/completions');

    expect(options.proxyTimeout).toBe(AI_PROXY_TIMEOUT);
  });

  it('keeps the default timeout for non-AI routes', () => {
    const options = createProxyOptions('http://topic-service:3003', '/api/topics');

    expect(options.proxyTimeout).toBe(DEFAULT_PROXY_TIMEOUT);
  });

  it('forwards user context headers to the proxied request', () => {
    const proxyReq = {
      setHeader: jest.fn(),
    } as any;

    const req = {
      headers: {
        'x-user-id': '9',
        'x-user-username': 'student',
        'x-user-email': 'student@example.com',
        'x-user-role': 'user',
      },
    } as unknown as Request;

    forwardUserContextHeaders(proxyReq, req);

    expect(proxyReq.setHeader).toHaveBeenCalledWith('x-user-id', '9');
    expect(proxyReq.setHeader).toHaveBeenCalledWith('x-user-username', 'student');
    expect(proxyReq.setHeader).toHaveBeenCalledWith('x-user-email', 'student@example.com');
    expect(proxyReq.setHeader).toHaveBeenCalledWith('x-user-role', 'user');
  });
});
