import axios from 'axios';

import { env } from '@/shared/config';
import { getAuthToken } from '@/shared/lib';

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  return config;
});
