import { useRegisterSW } from 'virtual:pwa-register/react';

import { Button } from '@/shared/ui';

import styles from './PwaUpdatePrompt.module.css';

/**
 * Offers the new build once a deploy has landed behind an open tab.
 *
 * A service worker that has fetched a newer version cannot install it over a page that is still
 * using the old one, so it waits. The alternative to asking is `registerType: 'autoUpdate'`, which
 * takes the page over on its own — and this product is one people type vouchers into, where an
 * uninvited reload costs whatever was half-entered. So it waits until someone says now.
 *
 * Renders nothing at all until there is something to offer, which is almost always.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className={styles.prompt} role="status" aria-live="polite">
      <p className={styles.message}>A new version of OWM is available.</p>
      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={() => setNeedRefresh(false)}>
          Later
        </Button>
        {/*
          `true` reloads the page once the waiting worker has taken over. Dismissing instead leaves
          that worker waiting, so the next full page load picks the version up regardless.
        */}
        <Button type="button" onClick={() => void updateServiceWorker(true)}>
          Reload
        </Button>
      </div>
    </div>
  );
}
