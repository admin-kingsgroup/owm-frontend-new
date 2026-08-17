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

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<ApiSuccessResponse<User>>('/auth/me');
  return data.data;
}
