export interface InternalUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
}

export interface AuthHeaders {
  'x-user-id': string;
  'x-user-username': string;
  'x-user-email': string;
  'x-user-role': string;
}
