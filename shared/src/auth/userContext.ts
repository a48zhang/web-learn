import { InternalUser, AuthHeaders } from './types';

export function extractUserFromHeaders(headers: Partial<AuthHeaders>): InternalUser | null {
  const id = headers['x-user-id'];
  const username = headers['x-user-username'];
  const email = headers['x-user-email'];
  const role = headers['x-user-role'];

  if (!id || !username || !email || !role) {
    return null;
  }

  return {
    id,
    username,
    email,
    role: role as InternalUser['role'],
  };
}