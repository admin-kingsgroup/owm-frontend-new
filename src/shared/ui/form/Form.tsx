import type { FormHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/shared/lib';

import styles from './Form.module.css';

export interface FieldProps {
  /** The visible label. */
  label: ReactNode;
  /** The id of the control this labels. Required — a label pointing at nothing labels nothing. */
  htmlFor: string;
  /** Guidance shown beneath the control, before anything has gone wrong. */
  hint?: ReactNode;
  /** What is wrong with this field. Replaces the hint while it is set. */
  error?: string | null;
  /** Marks the field as safe to leave blank, in words rather than by an absent asterisk. */
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A labelled control, with its hint and its fault.
 *
 * The error replaces the hint rather than joining it: guidance about how to fill a field in is not
 * what a reader needs once they have filled it in wrongly, and two lines of small print under one
 * control is how a form starts looking like a warning.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional = false,
  className,
  children,
}: FieldProps) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;

  return (
    <div className={cn(styles.field, className)}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {optional && <span className={styles.optional}> · optional</span>}
      </label>
      {children}
      {error ? (
        /*
          Announced when it appears. A fault that is only drawn is a fault nobody hears about if
          they are not looking at that part of the form when it arrives.
        */
        <p className={styles.fieldError} id={describedBy} role="alert">
          {error}
        </p>
      ) : (
        hint !== undefined && (
          <p className={styles.hint} id={describedBy}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Fields that sit side by side where there is room, and stack where there is not. */
export function FormRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(styles.row, className)}>{children}</div>;
}

/**
 * What went wrong with the whole form — what the server refused, usually.
 *
 * A live region, so a submission that failed is announced rather than only drawn: the button
 * returns to its resting state either way, and without this the two outcomes are indistinguishable
 * to anyone not watching that spot.
 */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p className={styles.formError} role="alert">
      {children}
    </p>
  );
}

/** The confirming and cancelling buttons. Full width and stacked on a phone. */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  children: ReactNode;
}

/** A column of fields. */
export function Form({ className, children, ...props }: FormProps) {
  return (
    <form className={cn(styles.form, className)} {...props}>
      {children}
    </form>
  );
}
