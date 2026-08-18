import { Navigate } from 'react-router-dom';

import { LoginForm, useAuthStore } from '@/features/auth';

import { PinwheelLogo } from './PinwheelLogo';
import styles from './HomePage.module.css';

export function HomePage() {
  const status = useAuthStore((state) => state.status);
  const hydrated = useAuthStore((state) => state.hydrated);

  if (hydrated && status === 'authenticated') {
    return <Navigate to="/companies" replace />;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.content}>
        <PinwheelLogo />
        <h1 className={styles.title}>KBiz360 OWM</h1>
        <p className={styles.subtitle}>Owner Wealth &amp; Group Oversight</p>
        <p className={styles.selectProfile}>Select Profile</p>

        {hydrated && <LoginForm />}
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
