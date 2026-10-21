import { Link } from 'react-router-dom';
import { Keyboard } from 'lucide-react';

import type { Company } from '@/entities/company';
import { cn } from '@/shared/lib';

import type { NavItem } from '../model/nav';
import { NAV_ICONS } from './nav-icons';
import { BrandMark } from './BrandMark';
import { CompanySwitcher } from './CompanySwitcher';
import styles from './Sidebar.module.css';

interface SidebarProps {
  items: NavItem[];
  companyId?: string;
  companies: Company[] | null;
  onShortcuts: () => void;
}

const SECTIONS: Array<NavItem['section']> = ['Overview', 'Books', 'Records'];

/**
 * The dark rail down the left: the brand, the company you are in, and the seven places.
 *
 * Collapses to icons between 60rem and 75rem — a tablet held sideways — where a 14rem column of
 * labels would cost the figures the room they need. Below 60rem it is gone, and the bottom tab bar
 * carries the same places within reach of a thumb.
 */
export function Sidebar({ items, companyId, companies, onShortcuts }: SidebarProps) {
  return (
    <aside className={styles.rail} aria-label="Main navigation">
      <Link to="/companies" className={styles.brand} aria-label="KBiz360 OWM — group overview">
        <BrandMark size={30} />
        <span className={styles.brandText}>
          <b>KBiz360 OWM</b>
          <small>Owner wealth &amp; oversight</small>
        </span>
      </Link>

      <div className={styles.switcher}>
        <CompanySwitcher companyId={companyId} companies={companies} variant="rail" />
      </div>

      <nav className={styles.nav}>
        {SECTIONS.map((section) => {
          const inSection = items.filter((item) => item.section === section);
          if (inSection.length === 0) return null;
          return (
            <div className={styles.section} key={section}>
              <span className={styles.sectionLabel}>{section}</span>
              {inSection.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    className={cn(styles.item, item.active && styles.active)}
                    aria-current={item.active ? 'page' : undefined}
                    title={item.label}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span className={styles.itemLabel}>{item.label}</span>
                    {item.hint && <kbd className={styles.itemKey}>{item.hint}</kbd>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className={styles.foot}>
        <button
          type="button"
          className={styles.item}
          onClick={onShortcuts}
          title="Keyboard shortcuts"
        >
          <Keyboard size={18} aria-hidden="true" />
          <span className={styles.itemLabel}>Keyboard shortcuts</span>
          <kbd className={styles.itemKey}>?</kbd>
        </button>
      </div>
    </aside>
  );
}
