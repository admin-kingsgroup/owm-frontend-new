// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { isLetterBinding, isTypingTarget, matchesBinding } from './button-bar';

/**
 * A keyboard event as the shell sees it. `code` is what a letter binding is matched on, because
 * `key` for Alt+B is '∫' on macOS and layout-dependent elsewhere.
 */
const press = (init: Partial<KeyboardEvent>) =>
  ({
    key: '',
    code: '',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...init,
  }) as KeyboardEvent;

describe('matchesBinding', () => {
  it('matches a function key by name', () => {
    expect(matchesBinding('F5', press({ key: 'F5' }))).toBe(true);
    expect(matchesBinding('F5', press({ key: 'F6' }))).toBe(false);
  });

  it('matches a letter on its physical key, whatever the layout reports', () => {
    expect(matchesBinding('Alt+B', press({ key: '∫', code: 'KeyB', altKey: true }))).toBe(true);
  });

  it('requires the modifiers the binding names, and no others', () => {
    expect(matchesBinding('Alt+B', press({ code: 'KeyB' }))).toBe(false);
    expect(matchesBinding('Alt+B', press({ code: 'KeyB', altKey: true, ctrlKey: true }))).toBe(
      false,
    );
    expect(matchesBinding('Ctrl+P', press({ code: 'KeyP', ctrlKey: true }))).toBe(true);
    expect(matchesBinding('Ctrl+P', press({ code: 'KeyP', altKey: true, ctrlKey: true }))).toBe(
      false,
    );
  });

  it('treats Cmd as Ctrl, so the same bar works on a Mac', () => {
    expect(matchesBinding('Ctrl+P', press({ code: 'KeyP', metaKey: true }))).toBe(true);
  });

  it('does not let Shift through — Ctrl+Shift+P is not Ctrl+P', () => {
    expect(matchesBinding('Ctrl+P', press({ code: 'KeyP', ctrlKey: true, shiftKey: true }))).toBe(
      false,
    );
  });

  it('matches a named key behind a modifier', () => {
    expect(matchesBinding('Ctrl+Enter', press({ key: 'Enter', ctrlKey: true }))).toBe(true);
    expect(matchesBinding('Ctrl+Enter', press({ key: 'Enter' }))).toBe(false);
  });
});

describe('isLetterBinding', () => {
  it('is true only for bindings that end in a letter', () => {
    expect(isLetterBinding('Ctrl+A')).toBe(true);
    expect(isLetterBinding('Alt+B')).toBe(true);
    expect(isLetterBinding('F5')).toBe(false);
    expect(isLetterBinding('Ctrl+Enter')).toBe(false);
  });
});

describe('isTypingTarget', () => {
  it('recognises the fields a shortcut must not steal a keystroke from', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it('counts a contenteditable element as a field', () => {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    // jsdom does not derive isContentEditable from the attribute.
    Object.defineProperty(editable, 'isContentEditable', { value: true });

    expect(isTypingTarget(editable)).toBe(true);
  });
});
