import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, ArrowRight, Pencil, Power } from 'lucide-react';

import { listCompanies, updateCompany, companyStatusVariant } from '@/entities/company';
import type { Company } from '@/entities/company';
import { CreateCompanyForm, EditCompanyForm } from '@/features/company';
import { Button, Modal, Loading, EmptyState, Badge } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './CompaniesPage.module.css';

export function CompaniesPage() {
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
    setCreateModalOpen(false);
    navigate(`/companies/${company.id}`);
  }

  function handleEdited(company: Company) {
    setEditingCompany(null);
    setCompanies((current) => current?.map((c) => (c.id === company.id ? company : c)) ?? current);
  }

  async function handleToggleStatus(company: Company) {
    if (company.status === 'ACTIVE') {
      const confirmed = window.confirm(
        `Deactivate ${company.name}? It will be hidden from day-to-day use, but nothing is deleted — you can reactivate it any time.`,
      );
      if (!confirmed) return;
    }

    setTogglingId(company.id);
    setError(null);
    try {
      const updated = await updateCompany(company.id, {
        status: company.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      setCompanies(
        (current) => current?.map((c) => (c.id === updated.id ? updated : c)) ?? current,
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update company status'));
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Companies</h1>
          <p className={styles.subtitle}>Every company gets its own chart of accounts and books.</p>
        </div>
        <Button type="button" variant="primary" onClick={() => setCreateModalOpen(true)}>
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
            <div key={company.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardCode}>{company.code}</span>
                <Badge variant={companyStatusVariant(company.status)}>{company.status}</Badge>
              </div>
              <p className={styles.cardName}>{company.name}</p>
              <p className={styles.cardMeta}>
                {company.baseCurrency} · {company.country}
              </p>
              <div className={styles.cardFooter}>
                <button
                  type="button"
                  className={styles.cardLink}
                  onClick={() => navigate(`/companies/${company.id}`)}
                >
                  Open <ArrowRight size={14} />
                </button>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label="Edit company"
                    onClick={() => setEditingCompany(company)}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={
                      company.status === 'ACTIVE' ? 'Deactivate company' : 'Activate company'
                    }
                    disabled={togglingId === company.id}
                    onClick={() => handleToggleStatus(company)}
                  >
                    <Power size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="New company">
        <CreateCompanyForm onCreated={handleCreated} onCancel={() => setCreateModalOpen(false)} />
      </Modal>

      <Modal
        open={editingCompany !== null}
        onClose={() => setEditingCompany(null)}
        title="Edit company"
      >
        {editingCompany && (
          <EditCompanyForm
            company={editingCompany}
            onSaved={handleEdited}
            onCancel={() => setEditingCompany(null)}
          />
        )}
      </Modal>
    </div>
  );
}
