export type Role = 'admin' | 'manager' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}
