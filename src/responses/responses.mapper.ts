import type { DownloadEvent, Response, User } from '../generated/prisma/client.js';
import type { AnswerMap, ResponseDetail, ResponseSummary, SubmittedResponse } from './responses.types.js';

const answersOf = (response: Response): AnswerMap => (response.answers ?? {}) as AnswerMap;

export const toSubmitted = (r: Response): SubmittedResponse => ({
  certId: r.certId,
  name: r.name,
  opco: r.opco,
  consent: r.consent,
  answers: answersOf(r),
  submittedAt: r.submittedAt.toISOString(),
  verificationCode: r.verificationCode,
});

export const toSummary = (r: Response): ResponseSummary => ({
  certId: r.certId,
  name: r.name,
  opco: r.opco,
  consent: r.consent,
  answers: answersOf(r),
  submittedAt: r.submittedAt.toISOString(),
  participantDownloads: r.participantDownloads,
  lastDownloadedAt: r.lastDownloadedAt?.toISOString() ?? null,
});

type ResponseWithDownloads = Response & { downloads: (DownloadEvent & { user: Pick<User, 'name'> | null })[] };

export const toDetail = (r: ResponseWithDownloads): ResponseDetail => ({
  ...toSummary(r),
  verificationCode: r.verificationCode,
  downloads: r.downloads.map((d) => ({
    id: d.id,
    source: d.source,
    downloadedAt: d.downloadedAt.toISOString(),
    downloadedBy: d.user?.name ?? null,
  })),
});
