import { isAxiosError } from 'axios';

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
  }

  if (error instanceof Error) return error.message;

  return fallback;
}
