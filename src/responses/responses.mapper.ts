import type { DownloadEvent, Response, ResponseUpdate, User } from '../generated/prisma/client.js';
import type {
  AnswerMap,
  CertificateRecord,
  ResponseDetail,
  ResponseSummary,
  SubmissionStatus,
  UpdateRequestView,
} from './responses.types.js';

const answersOf = (value: { answers: unknown }): AnswerMap => (value.answers ?? {}) as AnswerMap;

export const toCertificate = (r: Response): CertificateRecord => ({
  certId: r.certId,
  name: r.name,
  opco: r.opco,
  submittedAt: r.submittedAt.toISOString(),
  verificationCode: r.verificationCode,
});

/** The participant's view. The certificate (and its codes) only appear once approved. */
export const toSubmissionStatus = (
  r: Response & { accessToken: string },
  latestUpdate: ResponseUpdate | null = null,
): SubmissionStatus => ({
  accessToken: r.accessToken,
  status: r.status,
  name: r.name,
  opco: r.opco,
  submittedAt: r.submittedAt.toISOString(),
  reviewedAt: r.reviewedAt?.toISOString() ?? null,
  rejectionReason: r.status === 'rejected' ? r.rejectionReason : null,
  certificate: r.status === 'approved' ? toCertificate(r) : null,
  update: latestUpdate && {
    status: latestUpdate.status,
    requestedAt: latestUpdate.requestedAt.toISOString(),
    reviewedAt: latestUpdate.reviewedAt?.toISOString() ?? null,
    rejectionReason: latestUpdate.status === 'rejected' ? latestUpdate.rejectionReason : null,
  },
});

/** Response with the count of its pending update requests (see `pendingUpdatesCount`). */
type WithUpdateCount = Response & { _count?: { updates: number } };

export const toSummary = (r: WithUpdateCount): ResponseSummary => ({
  certId: r.certId,
  name: r.name,
  email: r.email,
  opco: r.opco,
  consent: r.consent,
  answers: answersOf(r),
  submittedAt: r.submittedAt.toISOString(),
  status: r.status,
  reviewedAt: r.reviewedAt?.toISOString() ?? null,
  autoApproved: r.autoApproved,
  rejectionReason: r.rejectionReason,
  pendingUpdate: (r._count?.updates ?? 0) > 0,
  participantDownloads: r.participantDownloads,
  lastDownloadedAt: r.lastDownloadedAt?.toISOString() ?? null,
});

export const toUpdateRequest = (u: ResponseUpdate): UpdateRequestView => ({
  id: u.id,
  name: u.name,
  opco: u.opco,
  consent: u.consent,
  answers: answersOf(u),
  requestedAt: u.requestedAt.toISOString(),
});

type ResponseWithRelations = WithUpdateCount & {
  reviewedBy: Pick<User, 'name'> | null;
  downloads: (DownloadEvent & { user: Pick<User, 'name'> | null })[];
  updates: ResponseUpdate[];
};

export const toDetail = (r: ResponseWithRelations): ResponseDetail => ({
  ...toSummary(r),
  verificationCode: r.verificationCode,
  reviewedBy: r.reviewedBy?.name ?? null,
  updateRequest: r.updates[0] ? toUpdateRequest(r.updates[0]) : null,
  downloads: r.downloads.map((d) => ({
    id: d.id,
    source: d.source,
    downloadedAt: d.downloadedAt.toISOString(),
    downloadedBy: d.user?.name ?? null,
  })),
});
