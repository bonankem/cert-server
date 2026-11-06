import type { Consent, DownloadSource } from '../generated/prisma/client.js';

export type AnswerMap = Record<string, string>;

/** Returned to the participant after submitting — everything needed to draw the certificate. */
export interface SubmittedResponse {
  certId: string;
  name: string;
  opco: string;
  consent: Consent;
  answers: AnswerMap;
  submittedAt: string;
  verificationCode: string;
}

/** A row in the admin lists. */
export interface ResponseSummary {
  certId: string;
  name: string;
  opco: string;
  consent: Consent;
  answers: AnswerMap;
  submittedAt: string;
  participantDownloads: number;
  lastDownloadedAt: string | null;
}

export interface DownloadEventView {
  id: string;
  source: DownloadSource;
  downloadedAt: string;
  /** Name of the admin who downloaded it (null for participants). */
  downloadedBy: string | null;
}

export interface ResponseDetail extends ResponseSummary {
  verificationCode: string;
  downloads: DownloadEventView[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface VerifyResult {
  match: { certId: string; name: string; opco: string; submittedAt: string; verificationCode: string } | null;
}
