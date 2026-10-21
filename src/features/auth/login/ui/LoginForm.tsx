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
      {/*
        A visible label around each field, so the whole row is the hit target and the name stays
        on screen once someone starts typing — which a placeholder alone does not do.
      */}
      <label className={styles.field}>
        Email
        <Input
          className={styles.input}
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          value={email}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className={styles.field}>
        Password
        <Input
          className={styles.input}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
          required
        />
      </label>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        className={styles.submit}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Signing in…' : 'Enter OWM'}
      </Button>
    </form>
  );
}
