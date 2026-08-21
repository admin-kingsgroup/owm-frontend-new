import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Monitor, Moon, Sun } from 'lucide-react';

import { useAuthStore } from '@/features/auth';
import { cn } from '@/shared/lib';
import { setTheme, useTheme, useMenuKeys } from '@/shared/hooks';
import type { ThemePreference } from '@/shared/hooks';

import styles from './UserMenu.module.css';

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  Icon: typeof Monitor;
}> = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

export function UserMenu() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const theme = useTheme();

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useMenuKeys(open, menuRef);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const initials =
    user.name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  function handleLogout() {
    setOpen(false);
    logout().catch(() => {
      // logout always clears local session, even if the request itself failed
    });
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className={styles.avatar}>{initials}</span>
        <span className={styles.name}>{user.name}</span>
        <ChevronDown size={14} className={cn(styles.chevron, open && styles.chevronOpen)} />
      </button>

      {open && (
        <div className={styles.menu} role="menu" ref={menuRef}>
          <div className={styles.menuHeader}>
            <span className={styles.menuName}>{user.name}</span>
            <span className={styles.menuEmail}>{user.email}</span>
          </div>
          <div className={styles.menuSection}>
            <span className={styles.menuSectionLabel} id="appearance-label">
              Appearance
            </span>
            {/* Left open on purpose — the menu stays put so the choice can be seen taking effect. */}
            <div className={styles.themeToggle} role="group" aria-labelledby="appearance-label">
              {THEME_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={cn(styles.themeOption, theme === value && styles.themeOptionActive)}
                  aria-pressed={theme === value}
                  onClick={() => setTheme(value)}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button type="button" role="menuitem" className={styles.menuItem} onClick={handleLogout}>
            <LogOut size={15} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
