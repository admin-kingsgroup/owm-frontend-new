// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { LoginForm } from './LoginForm';

/**
 * The way into the application, so the last screen that should be unreadable.
 *
 * Both fields were placeholder-only for a long time — no label, no id, no aria-label — which a
 * screen reader announces as an unnamed edit box, and which stops being a visual label the moment
 * anyone types. It went unnoticed because nothing here ever asked for these fields by name; asking
 * for them by name is exactly what this does.
 */
describe('the sign-in form', () => {
  afterEach(cleanup);

  it('offers both fields by name', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
  });

  it('keeps the types that decide the keyboard and the masking', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i).getAttribute('type')).toBe('email');
    expect(screen.getByLabelText(/password/i).getAttribute('type')).toBe('password');
  });

  it('tells a password manager which field is which', () => {
    // Without these a manager has only the input type to go on, and offers to save the wrong pair.
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i).getAttribute('autocomplete')).toBe('email');
    expect(screen.getByLabelText(/password/i).getAttribute('autocomplete')).toBe(
      'current-password',
    );
  });

  it('names the submit action', () => {
    expect(render(<LoginForm />) && screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
  });
});
