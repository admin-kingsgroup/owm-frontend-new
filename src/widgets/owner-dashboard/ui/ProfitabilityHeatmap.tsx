import type { Business, Branch, FinancialStatus } from '@/entities/owner-portfolio';
import { formatCrLakh } from '@/entities/owner-portfolio';
import styles from './ProfitabilityHeatmap.module.css';

interface HeatmapEntry {
  id: string;
  name: string;
  type: 'Business' | 'Branch';
  status: FinancialStatus;
  statusText: string;
  profit: number;
  businessId?: string;
  branchId?: string;
}

interface ProfitabilityHeatmapProps {
  businesses: Business[];
  branches: Branch[];
  onSelectBusiness?: (id: string) => void;
  onSelectBranch?: (id: string) => void;
}

export function ProfitabilityHeatmap({
  businesses,
  branches,
  onSelectBusiness,
  onSelectBranch,
}: ProfitabilityHeatmapProps) {
  // Ordered exactly as requested in requirement 12:
  // Travkings 🟢 Strong, MHUB 🟢 Strong, BOM 🟢 Good, DAR 🔴 Loss, FBM 🟢 Strong, NBO 🟢 Good, QuinALiza 🟢 Good, Kings Logistic 🟢 Good, Hotel Kings 🔴 Loss, Techkings 🟢 Strong
  const travkings = businesses.find((b) => b.id === 'biz-travkings');
  const quinaliza = businesses.find((b) => b.id === 'biz-quinaliza');
  const kingsLogistic = businesses.find((b) => b.id === 'biz-kings-logistic');
  const hotelKings = businesses.find((b) => b.id === 'biz-hotel-kings');
  const techkings = businesses.find((b) => b.id === 'biz-techkings');

  const mhub = branches.find((b) => b.code === 'MHUB');
  const bom = branches.find((b) => b.code === 'BOM');
  const dar = branches.find((b) => b.code === 'DAR');
  const fbm = branches.find((b) => b.code === 'FBM');
  const nbo = branches.find((b) => b.code === 'NBO');

  const items: HeatmapEntry[] = [
    travkings && {
      id: travkings.id,
      name: travkings.name,
      type: 'Business',
      status: 'STRONG',
      statusText: 'Strong',
      profit: travkings.profit,
      businessId: travkings.id,
    },
    mhub && {
      id: mhub.id,
      name: 'MHUB Branch',
      type: 'Branch',
      status: 'STRONG',
      statusText: 'Strong',
      profit: mhub.profit,
      branchId: mhub.id,
    },
    bom && {
      id: bom.id,
      name: 'BOM Branch',
      type: 'Branch',
      status: 'GOOD',
      statusText: 'Good',
      profit: bom.profit,
      branchId: bom.id,
    },
    dar && {
      id: dar.id,
      name: 'DAR Branch',
      type: 'Branch',
      status: 'LOSS',
      statusText: 'Loss',
      profit: dar.profit,
      branchId: dar.id,
    },
    fbm && {
      id: fbm.id,
      name: 'FBM Branch',
      type: 'Branch',
      status: 'STRONG',
      statusText: 'Strong',
      profit: fbm.profit,
      branchId: fbm.id,
    },
    nbo && {
      id: nbo.id,
      name: 'NBO Branch',
      type: 'Branch',
      status: 'GOOD',
      statusText: 'Good',
      profit: nbo.profit,
      branchId: nbo.id,
    },
    quinaliza && {
      id: quinaliza.id,
      name: quinaliza.name,
      type: 'Business',
      status: 'GOOD',
      statusText: 'Good',
      profit: quinaliza.profit,
      businessId: quinaliza.id,
    },
    kingsLogistic && {
      id: kingsLogistic.id,
      name: kingsLogistic.name,
      type: 'Business',
      status: 'GOOD',
      statusText: 'Good',
      profit: kingsLogistic.profit,
      businessId: kingsLogistic.id,
    },
    hotelKings && {
      id: hotelKings.id,
      name: hotelKings.name,
      type: 'Business',
      status: 'LOSS',
      statusText: 'Loss',
      profit: hotelKings.profit,
      businessId: hotelKings.id,
    },
    techkings && {
      id: techkings.id,
      name: techkings.name,
      type: 'Business',
      status: 'STRONG',
      statusText: 'Strong',
      profit: techkings.profit,
      businessId: techkings.id,
    },
  ].filter(Boolean) as HeatmapEntry[];

  function handleClick(item: HeatmapEntry) {
    if (item.branchId) {
      onSelectBranch?.(item.branchId);
    } else if (item.businessId) {
      onSelectBusiness?.(item.businessId);
    }
  }

  function getBadgeClass(status: FinancialStatus) {
    switch (status) {
      case 'STRONG':
        return styles.badgeStrong;
      case 'GOOD':
        return styles.badgeGood;
      case 'LOSS':
        return styles.badgeLoss;
      default:
        return '';
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Profitability Heatmap</h3>
        <div className={styles.legend}>
          <span className={styles.legendDot}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#15803d' }} />
            Profitable
          </span>
          <span className={styles.legendDot}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#b91c1c' }} />
            Loss-Making
          </span>
        </div>
      </div>

      <div className={styles.grid}>
        {items.map((item) => (
          <div
            key={item.id}
            className={styles.item}
            onClick={() => handleClick(item)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleClick(item)}
          >
            <div className={styles.nameGroup}>
              <span className={styles.name}>{item.name}</span>
              <span className={styles.typeLabel}>{item.type}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span className={`${styles.badge} ${getBadgeClass(item.status)}`}>
                <span className={styles.statusIndicator} />
                {item.statusText}
              </span>
              <span
                className={styles.amount}
                style={{ color: item.profit < 0 ? 'var(--danger-fg)' : 'var(--success-fg)' }}
              >
                {formatCrLakh(item.profit, { forceSign: true })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
