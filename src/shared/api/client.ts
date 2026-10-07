import axios from 'axios';

import { env } from '@/shared/config';
import { getAuthToken } from '@/shared/lib';
import { handleMockRequest } from './mock-adapter';

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = getAuthToken();

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  // If in demo preview token mode, use mock adapter directly for zero latency
  if (token === 'demo-preview-token') {
    const mock = handleMockRequest(config);
    if (mock) {
      config.adapter = async () => mock;
    }
  }

  return config;
});

// Response interceptor: if network request fails (e.g. backend not deployed on Vercel), seamlessly fall back to mock data
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.config) {
      const mock = handleMockRequest(error.config);
      if (mock) {
        return Promise.resolve(mock);
      }
    }
    return Promise.reject(error);
  },
);
