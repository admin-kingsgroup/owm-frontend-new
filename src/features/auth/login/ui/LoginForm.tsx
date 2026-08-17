import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { Button, Input } from '@/shared/ui';

import { useAuthStore } from '../../model/auth-store';
import styles from './LoginForm.module.css';

export function LoginForm() {
  const login = useAuthStore((state) => state.login);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    login(email, password).catch(() => {
      // error is already reflected in the store
    });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <Input
        type="email"
        placeholder="Email"
        autoComplete="email"
        value={email}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        value={password}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
        required
      />
      {error && <p className={styles.error}>{error}</p>}
      <Button type="submit" variant="primary" disabled={status === 'loading'}>
        {status === 'loading' ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
