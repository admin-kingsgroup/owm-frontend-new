import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';

import { useAuthStore } from '@/features/auth';
import { cn } from '@/shared/lib';

import styles from './UserMenu.module.css';

export function UserMenu() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
        <div className={styles.menu} role="menu">
          <div className={styles.menuHeader}>
            <span className={styles.menuName}>{user.name}</span>
            <span className={styles.menuEmail}>{user.email}</span>
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
