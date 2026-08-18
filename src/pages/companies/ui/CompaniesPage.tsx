import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, ArrowRight } from 'lucide-react';

import { listCompanies, companyStatusVariant } from '@/entities/company';
import type { Company } from '@/entities/company';
import { CreateCompanyForm } from '@/features/company';
import { Button, Modal, Loading, EmptyState, Badge } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './CompaniesPage.module.css';

export function CompaniesPage() {
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    listCompanies()
      .then((result) => {
        if (!cancelled) setCompanies(result);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load companies'));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreated(company: Company) {
    setModalOpen(false);
    navigate(`/companies/${company.id}`);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Companies</h1>
          <p className={styles.subtitle}>Every company gets its own chart of accounts and books.</p>
        </div>
        <Button type="button" variant="primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> New company
        </Button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {!companies ? (
        <Loading label="Loading companies…" />
      ) : companies.length === 0 ? (
        <EmptyState
          icon={<Building2 size={32} />}
          title="No companies yet"
          description="Create your first company to auto-generate its chart of accounts, ledgers, and voucher types."
        />
      ) : (
        <div className={styles.grid}>
          {companies.map((company) => (
            <button
              key={company.id}
              type="button"
              className={styles.card}
              onClick={() => navigate(`/companies/${company.id}`)}
            >
              <div className={styles.cardHeader}>
                <span className={styles.cardCode}>{company.code}</span>
                <Badge variant={companyStatusVariant(company.status)}>{company.status}</Badge>
              </div>
              <p className={styles.cardName}>{company.name}</p>
              <p className={styles.cardMeta}>
                {company.baseCurrency} · {company.country}
              </p>
              <span className={styles.cardLink}>
                Open <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New company">
        <CreateCompanyForm onCreated={handleCreated} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}
