export type ClientErrorKind = 'RENDER' | 'UNHANDLED_REJECTION' | 'UNCAUGHT';

/** One browser-side fault, as an administrator reads it. */
export interface ClientError {
  id: string;
  /** What the person who hit it was shown, and what they would quote. */
  reference: string;
  kind: ClientErrorKind;
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent?: string;
  userId?: string;
  companyId?: string;
  createdAt: string;
}

export interface ClientErrorListQuery {
  kind?: ClientErrorKind;
  companyId?: string;
  page?: number;
  limit?: number;
}

export interface ClientErrorList {
  items: ClientError[];
  total: number;
  page: number;
  limit: number;
}
