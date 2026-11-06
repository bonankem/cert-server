import type { SectionId } from '../form-config/form-config.js';
import type { ResponseSummary } from '../responses/responses.types.js';

export interface QuestionStats {
  id: string;
  section: SectionId;
  label: string;
  text: string;
  /** One entry per option, in the question's option order (best → worst). */
  counts: { option: string; count: number }[];
  answered: number;
}

export interface DashboardStats {
  totals: {
    responses: number;
    consented: number;
    /** Certificates the participant downloaded at least once. */
    certificatesDownloaded: number;
    downloadEvents: number;
  };
  /** Daily submissions (UTC days), oldest first, zero-filled. */
  byDay: { date: string; count: number }[];
  byOpco: { opco: string; count: number }[];
  questions: QuestionStats[];
  recent: ResponseSummary[];
}
