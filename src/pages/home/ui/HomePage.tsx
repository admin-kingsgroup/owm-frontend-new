import { LoginForm, LogoutButton, useAuthStore } from '@/features/auth';

import { PinwheelLogo } from './PinwheelLogo';
import styles from './HomePage.module.css';

export function HomePage() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const hydrated = useAuthStore((state) => state.hydrated);

  return (
    <div className={styles.wrapper}>
      <div className={styles.content}>
        <PinwheelLogo />
        <h1 className={styles.title}>KBiz360 OWM</h1>
        <p className={styles.subtitle}>Owner Wealth &amp; Group Oversight</p>
        <p className={styles.selectProfile}>Select Profile</p>

        {!hydrated ? null : status === 'authenticated' && user ? (
          <div className={styles.profile}>
            <p className={styles.profileName}>{user.name}</p>
            <p className={styles.profileEmail}>{user.email}</p>
            <LogoutButton />
          </div>
        ) : (
          <LoginForm />
        )}
      </div>

      <footer className={styles.footer}>
        <p>
          KBiz360 OWM · Owner Wealth &amp; Group Oversight
          <br />
          <span className={styles.footerConfidential}>· Confidential ·</span> 2.0.1
        </p>
      </footer>
    </div>
  );
}
