import type { ApprovalStatus, Consent, DownloadSource } from '../generated/prisma/client.js';

export type AnswerMap = Record<string, string>;

/** Everything needed to draw the certificate. Only ever sent once the response is approved. */
export interface CertificateRecord {
  certId: string;
  name: string;
  opco: string;
  submittedAt: string;
  verificationCode: string;
}

/**
 * What a participant can see about their own submission, through the private
 * status link: the certificate only once approved, the reason if rejected.
 */
export interface SubmissionStatus {
  accessToken: string;
  status: ApprovalStatus;
  name: string;
  opco: string;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  certificate: CertificateRecord | null;
  /** The participant's most recent update request, if any. */
  update: {
    status: ApprovalStatus;
    requestedAt: string;
    reviewedAt: string | null;
    rejectionReason: string | null;
  } | null;
}

/**
 * Result of submitting the form. One email = one response: a repeat
 * submission never creates a second certificate. For a repeat, the private
 * link is only emailed (never returned), so knowing someone's email address
 * doesn't give access to their certificate.
 */
export interface SubmitResult {
  /** created: first submission · resubmitted: replaced a not-yet-approved one · update_requested: approved, so changes await approval. */
  outcome: 'created' | 'resubmitted' | 'update_requested';
  /** Only for `created`. */
  submission: SubmissionStatus | null;
}

/** A pending change to an approved response, shown to admins next to the current details. */
export interface UpdateRequestView {
  id: string;
  name: string;
  opco: string;
  consent: Consent;
  answers: AnswerMap;
  requestedAt: string;
}

/** A row in the admin lists. */
export interface ResponseSummary {
  certId: string;
  name: string;
  email: string | null;
  opco: string;
  consent: Consent;
  answers: AnswerMap;
  submittedAt: string;
  status: ApprovalStatus;
  reviewedAt: string | null;
  autoApproved: boolean;
  rejectionReason: string | null;
  /** The participant has asked to change their approved details. */
  pendingUpdate: boolean;
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
  /** Name of the admin who approved or rejected it (null when automatic or not reviewed). */
  reviewedBy: string | null;
  /** The pending update request, with the details the participant wants. */
  updateRequest: UpdateRequestView | null;
  downloads: DownloadEventView[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface VerifyResult {
  match: {
    certId: string;
    name: string;
    opco: string;
    submittedAt: string;
    verificationCode: string;
    /** Always "approved" on the public page; admins also see pending and rejected ones. */
    status: ApprovalStatus;
  } | null;
}

export interface ReviewResult {
  /** How many responses changed status. */
  updated: number;
}
