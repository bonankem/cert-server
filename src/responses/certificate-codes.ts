import { randomInt } from 'node:crypto';

const CERT_ID_PREFIX = 'ZC-STN';
/** Unambiguous characters (no 0/O, 1/I/L) for codes people read aloud or type. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

const randomChars = (length: number): string =>
  Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

/** "261105" (YYMMDD, UTC) */
const dateStamp = (date: Date): string =>
  String(date.getUTCFullYear()).slice(2) +
  String(date.getUTCMonth() + 1).padStart(2, '0') +
  String(date.getUTCDate()).padStart(2, '0');

/** Human-readable certificate ID, e.g. "ZC-STN-261105-K7Q2". */
export const generateCertId = (date = new Date()): string =>
  `${CERT_ID_PREFIX}-${dateStamp(date)}-${randomChars(4)}`;

/**
 * Unguessable verification code printed on the certificate, e.g. "7KQ2-M9XA-T4PZ"
 * (~59 bits of entropy). Verified by database lookup, so it can't be forged offline.
 */
export const generateVerificationCode = (): string =>
  [randomChars(4), randomChars(4), randomChars(4)].join('-');
