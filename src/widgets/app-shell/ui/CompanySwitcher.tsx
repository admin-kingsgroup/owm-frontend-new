import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, Check, ChevronDown } from 'lucide-react';

import { listCompanies } from '@/entities/company';
import type { Company } from '@/entities/company';
import { cn } from '@/shared/lib';

import styles from './CompanySwitcher.module.css';

interface CompanySwitcherProps {
  companyId: string;
}

/**
 * Switching company used to mean navigating back to /companies and picking again. This keeps the
 * switch in reach from anywhere inside a company, and — the part that matters day to day — keeps
 * you on the same screen: switch while reading Reports and you land on the other company's
 * Reports, not its overview.
 */
export function CompanySwitcher({ companyId }: CompanySwitcherProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    listCompanies()
      .then((result) => {
        if (!cancelled) setCompanies(result);
      })
      .catch(() => {
        // The switcher is a convenience. If the list cannot be loaded the shell still works, so
        // this falls back to showing nothing rather than pushing an error into the chrome.
        if (!cancelled) setCompanies([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const active = companies?.find((company) => company.id === companyId);

  // Nothing to switch between, or the list has not arrived — the trigger would be a dead control.
  if (!companies || companies.length < 2 || !active) return null;

  function switchTo(company: Company) {
    setOpen(false);
    if (company.id === companyId) return;

    // Everything after /companies/:companyId is the section the user is reading. Carrying it over
    // is what makes this a switch rather than a restart.
    const section = location.pathname.slice(`/companies/${companyId}`.length);
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
        <span className={styles.name}>{active.name}</span>
        <span className={styles.code}>{active.code}</span>
        <ChevronDown size={14} className={cn(styles.chevron, open && styles.chevronOpen)} />
      </button>

      {open && (
        <div className={styles.menu} role="menu" aria-label="Switch company">
          {companies.map((company) => (
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
              <span className={styles.optionCode}>{company.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
