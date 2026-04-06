export interface InternalUser {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
}

export interface AuthHeaders {
  'x-user-id': string;
  'x-user-username': string;
  'x-user-email': string;
  'x-user-role': string;
}