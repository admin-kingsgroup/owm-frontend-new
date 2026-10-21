import { FileSpreadsheet, Printer, Download } from 'lucide-react';
import type { Business, Branch } from '@/entities/owner-portfolio';
import {
  exportBusinessReportCsv,
  exportBranchReportCsv,
  exportPartnerDistributionCsv,
  triggerExecutivePrint,
} from '@/entities/owner-portfolio';
import styles from './ReportsSection.module.css';

interface ReportsSectionProps {
  businesses: Business[];
  branches: Branch[];
}

export function ReportsSection({ businesses, branches }: ReportsSectionProps) {
  function handleDownloadBusinessReport() {
    exportBusinessReportCsv(businesses);
  }

  function handleDownloadBranchReport() {
    exportBranchReportCsv(branches);
  }

  function handleDownloadPartnerReport() {
    exportPartnerDistributionCsv(businesses);
  }

  function handlePrintExecutive() {
    triggerExecutivePrint();
  }

  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Financial Reports &amp; Exports</h2>
        </div>
        <span className={styles.subtitle}>
          Generate audited owner statements, regional branch schedules, and 4-partner dividend exports
        </span>
      </div>

      <div className={styles.grid}>
        {/* Report 1: Travkings Monthly Business Report */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrap}>
              <FileSpreadsheet size={20} />
            </div>
            <div className={styles.cardTitles}>
              <h4 className={styles.reportName}>Travkings — Monthly Business Report</h4>
              <span className={styles.reportMeta}>5 Hubs · Revenue ₹11.8 Cr · Profit ₹2.4 Cr</span>
            </div>
          </div>
          <p className={styles.description}>
            Comprehensive operational statement including hub revenues, vehicle fleet maintenance costs, fuel surcharges, and partner net dividend allocations.
          </p>
          <div className={styles.actionsRow}>
            <button
              type="button"
              className={`${styles.downloadBtn} ${styles.primaryBtn}`}
              onClick={handleDownloadBranchReport}
            >
              <Download size={13} /> Export Excel / CSV
            </button>
            <button
              type="button"
              className={styles.downloadBtn}
              onClick={handlePrintExecutive}
            >
              <Printer size={13} /> Print PDF
            </button>
          </div>
        </div>

        {/* Report 2: MHUB Branch Performance Report */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrap}>
              <FileSpreadsheet size={20} />
            </div>
            <div className={styles.cardTitles}>
              <h4 className={styles.reportName}>MHUB — Branch Performance Report</h4>
              <span className={styles.reportMeta}>Top Performer · ₹60L Profit · 50% ROI</span>
            </div>
          </div>
          <p className={styles.description}>
            Granular terminal and fleet economics for the flagship MHUB regional center, tracking 6-month revenue progression and driver crew expense line items.
          </p>
          <div className={styles.actionsRow}>
            <button
              type="button"
              className={`${styles.downloadBtn} ${styles.primaryBtn}`}
              onClick={handleDownloadBranchReport}
            >
              <Download size={13} /> Download Report
            </button>
            <button
              type="button"
              className={styles.downloadBtn}
              onClick={handlePrintExecutive}
            >
              <Printer size={13} /> Export PDF
            </button>
          </div>
        </div>

        {/* Report 3: Partner Profit Distribution Report */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrap}>
              <FileSpreadsheet size={20} />
            </div>
            <div className={styles.cardTitles}>
              <h4 className={styles.reportName}>Partner Profit Distribution Report</h4>
              <span className={styles.reportMeta}>4 Partners · 25% Equal Share · All 5 Entities</span>
            </div>
          </div>
          <p className={styles.description}>
            Formal dividend schedule demonstrating dynamic 25% equal allocation of portfolio net profits, including loss contributions for underperforming units.
          </p>
          <div className={styles.actionsRow}>
            <button
              type="button"
              className={`${styles.downloadBtn} ${styles.primaryBtn}`}
              onClick={handleDownloadPartnerReport}
            >
              <Download size={13} /> Export Excel / CSV
            </button>
            <button
              type="button"
              className={styles.downloadBtn}
              onClick={handlePrintExecutive}
            >
              <Printer size={13} /> Print Summary
            </button>
          </div>
        </div>

        {/* Report 4: Master Portfolio Valuation & Statement */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrap}>
              <FileSpreadsheet size={20} />
            </div>
            <div className={styles.cardTitles}>
              <h4 className={styles.reportName}>Master Portfolio Business Statement</h4>
              <span className={styles.reportMeta}>₹12.8 Cr Capital · ₹17.4 Cr Valuation</span>
            </div>
          </div>
          <p className={styles.description}>
            Executive summary for private family office, bank covenants, and tax advisors covering Travkings, QuinALiza, Kings Logistic, Hotel Kings Palace, and Techkings.
          </p>
          <div className={styles.actionsRow}>
            <button
              type="button"
              className={`${styles.downloadBtn} ${styles.primaryBtn}`}
              onClick={handleDownloadBusinessReport}
            >
              <Download size={13} /> Export Master Excel
            </button>
            <button
              type="button"
              className={styles.downloadBtn}
              onClick={handlePrintExecutive}
            >
              <Printer size={13} /> Print Executive PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
