import { toCsv, type CsvColumn } from '../common/utils/csv.js';
import { QUESTIONS } from '../form-config/form-config.js';
import type { Response } from '../generated/prisma/client.js';

const answer = (r: Response, id: string) => (r.answers as Record<string, string> | null)?.[id] ?? '';

const COLUMNS: CsvColumn<Response>[] = [
  { title: 'Full name', value: (r) => r.name },
  { title: 'OpCo', value: (r) => r.opco },
  { title: 'Consent', value: (r) => r.consent },
  ...QUESTIONS.map((q) => ({ title: `${q.id.toUpperCase()} ${q.csvLabel}`, value: (r: Response) => answer(r, q.id) })),
  { title: 'Certificate ID', value: (r) => r.certId },
  { title: 'Verification code', value: (r) => r.verificationCode },
  { title: 'Submitted at (UTC)', value: (r) => r.submittedAt.toISOString() },
  { title: 'Participant downloads', value: (r) => r.participantDownloads },
  { title: 'Last downloaded (UTC)', value: (r) => r.lastDownloadedAt?.toISOString() ?? '' },
];

export const responsesToCsv = (rows: Response[]): string => toCsv(COLUMNS, rows);
