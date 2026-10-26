import { apiClient } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';
import type { User } from '@/entities/user';

import type { AuthResponse } from '../model/types';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<ApiSuccessResponse<AuthResponse>>('/auth/login', {
    email,
    password,
  });
  return data.data;
}

/** Sends this device's refresh token so the server revokes it, not just forgets the access token. */
export async function logout(refreshToken?: string): Promise<void> {
  await apiClient.post('/auth/logout', refreshToken ? { refreshToken } : undefined);
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<ApiSuccessResponse<User>>('/auth/me');
  return data.data;
}
