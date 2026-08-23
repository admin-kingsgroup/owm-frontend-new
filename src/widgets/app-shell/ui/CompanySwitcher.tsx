import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, Check, ChevronDown, LayoutGrid } from 'lucide-react';

import type { Company } from '@/entities/company';
import { cn } from '@/shared/lib';
import { useMenuKeys } from '@/shared/hooks';

import styles from './CompanySwitcher.module.css';

interface CompanySwitcherProps {
  /**
   * Absent on the screens that sit outside a company — the selection list itself, diagnostics. The
   * control still draws there, because it is the only company control in the product.
   */
  companyId?: string;
  /**
   * Read by the shell, which needs the same list to decide the sidebar's section link. Passed in
   * rather than fetched here so entering a company costs one request, not two. `null` means the
   * list has not arrived yet; an empty array means it could not be read.
   */
  companies: Company[] | null;
}

/**
 * The one place a company is chosen, anywhere in the product.
 *
 * It began as a shortcut past the companies page and is now the only way past it: the menu bar and
 * the button bar no longer offer a second route to the same screen, so this trigger has to answer
 * every form of the question — switch to another company, and open the full selection list. Hence
 * the footer item, and hence drawing with a single company or with none open, where it used to
 * hide.
 *
 * Switching keeps you on the same screen — switch while reading Reports and you land on the other
 * company's Reports, not its dashboard.
 */
export function CompanySwitcher({ companyId, companies }: CompanySwitcherProps) {
  const navigate = useNavigate();
  const location = useLocation();

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

  /*
    Undefined outside a company, and also for a stale bookmark into one this user can no longer
    see. Neither hides the control any more: with no other way to reach the selection screen, a
    hidden switcher is not a tidy empty state, it is a dead end.
  */
  const active = companyId ? companies?.find((company) => company.id === companyId) : undefined;

  // The list has not arrived, or could not be read — there is nothing to put in the menu.
  if (!companies || companies.length === 0) return null;

  // Deactivated companies stay reachable, but sink below the ones in daily use.
  const ordered = [...companies].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'ACTIVE' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  function switchTo(company: Company) {
    setOpen(false);
    if (company.id === companyId) return;

    // Everything after /companies/:companyId is the section the user is reading. Carrying it over
    // is what makes this a switch rather than a restart. From outside a company there is no
    // section to carry, so the choice lands on that company's dashboard.
    const section = companyId ? location.pathname.slice(`/companies/${companyId}`.length) : '';
    navigate(`/companies/${company.id}${section}`);
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
        <Building2 size={14} className={styles.icon} />
        <span className={styles.name}>{active ? active.name : 'Select company'}</span>
        {active && active.status !== 'ACTIVE' && (
          <span className={styles.triggerInactive}>Deactivated</span>
        )}
        {active && <span className={styles.code}>{active.code}</span>}
        <ChevronDown size={14} className={cn(styles.chevron, open && styles.chevronOpen)} />
      </button>

      {open && (
        <div className={styles.menu} role="menu" aria-label="Switch company" ref={menuRef}>
          {ordered.map((company) => (
            <button
              key={company.id}
              type="button"
              role="menuitem"
              aria-current={company.id === companyId ? 'true' : undefined}
              className={cn(styles.option, company.id === companyId && styles.optionActive)}
              onClick={() => switchTo(company)}
            >
              <span className={styles.optionCheck}>
                {company.id === companyId && <Check size={14} />}
              </span>
              <span className={styles.optionName}>{company.name}</span>
              {/* Without this you can switch into a deactivated company and only find out from a
                  badge two screens later. */}
              {company.status !== 'ACTIVE' && (
                <span className={styles.optionInactive}>Deactivated</span>
              )}
              <span className={styles.optionCode}>{company.code}</span>
            </button>
          ))}

          {/*
            The way to the selection screen — where the group's figures sit side by side, and where
            a company is created or edited. Separated below a rule because it is not one of the
            companies: choosing it opens a screen, it does not switch anything.
          */}
          <button
            type="button"
            role="menuitem"
            className={cn(styles.option, styles.optionAll)}
            onClick={() => {
              setOpen(false);
              navigate('/companies');
            }}
          >
            <span className={styles.optionCheck}>
              <LayoutGrid size={14} />
            </span>
            <span className={styles.optionName}>All companies…</span>
          </button>
        </div>
      )}
    </div>
  );
}
