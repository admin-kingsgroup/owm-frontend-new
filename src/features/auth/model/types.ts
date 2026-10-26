import type { User } from '@/entities/user';

export interface AuthResponse {
  user: User;
  accessToken: string;
  /** Traded at `/auth/refresh-token` for the next pair when the access token expires. */
  refreshToken?: string;
}
