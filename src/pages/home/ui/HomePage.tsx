import { Navigate } from 'react-router-dom';

import { LoginForm, useAuthStore } from '@/features/auth';
import { BrandMark } from '@/widgets/app-shell';

import { FlowField } from './FlowField';
import styles from './HomePage.module.css';

/** What the product does, in the words a buyer of it would use. */
const FEATURES = [
  'Tally-style F-keys',
  'Live Dr/Cr balancing',
  '20+ reports with drill-down',
  'Bill-wise ageing',
  'Multi-currency',
  'Portfolio ROI ranking',
];

/**
 * The way in: what the product is on the left, the sign-in on the right, over a field of figures
 * moving through the books.
 *
 * One fixed dark scene whatever the reader's theme, because it is the product's first impression
 * and is seen before any preference can be known. On a phone the two halves stack, the sign-in
 * under the headline.
 */
export function HomePage() {
  const status = useAuthStore((state) => state.status);
  const hydrated = useAuthStore((state) => state.hydrated);

  if (hydrated && status === 'authenticated') {
    return <Navigate to="/companies" replace />;
  }

  return (
    <div className={styles.landing}>
      <FlowField />

      <section className={styles.intro}>
        <div className={styles.brand}>
          <BrandMark size={44} />
          <div>
            <b className={styles.brandName}>KBiz360 OWM</b>
            <span className={styles.brandLine}>Owner Wealth &amp; Group Oversight</span>
          </div>
        </div>

        <h1 className={styles.headline}>
          {/* Kept in two whole phrases, so a narrow column breaks after "company," rather than
              leaving "rupee," alone on a line. */}
          <span className={styles.phrase}>Every company,</span>{' '}
          <span className={styles.phrase}>every rupee,</span>
          <br />
          <em>one moving picture.</em>
        </h1>

        <p className={styles.lead}>
          Books for each company, a group view across all of them, and a portfolio that ranks every
          business against its return and margin targets.
        </p>

        <ul className={styles.features} aria-label="What it does">
          {FEATURES.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </section>

      <section className={styles.side}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Sign in</h2>
          {hydrated && <LoginForm />}
          <p className={styles.footnote}>Confidential · KBiz360 OWM 2.0.1</p>
        </div>
      </section>
    </div>
  );
}
