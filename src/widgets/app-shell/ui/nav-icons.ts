import {
  BriefcaseBusiness,
  ChartColumnBig,
  Files,
  Gauge,
  History,
  LayoutGrid,
  Library,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { NavIcon } from '../model/nav';

/** One icon per place, shared by the sidebar and the search so a place looks the same in both. */
export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  group: LayoutGrid,
  dashboard: Gauge,
  masters: Library,
  vouchers: Files,
  reports: ChartColumnBig,
  portfolio: BriefcaseBusiness,
  audit: History,
  errors: TriangleAlert,
};
