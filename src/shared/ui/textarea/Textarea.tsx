import type { TextareaHTMLAttributes } from 'react';

import { cn } from '@/shared/lib';

import styles from './Textarea.module.css';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cn(styles.textarea, className)} {...props} />;
}
