import { Link } from 'react-router-dom';

import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  return (
    <div className={styles.wrapper}>
      <h1>404</h1>
      <p>Page not found</p>
      <Link to="/">Go back home</Link>
    </div>
  );
}
