import {
  fitImageForOcr,
  getOcrProviders,
  readStatementPhoto,
  type OcrStatementReading,
} from '@/entities/ocr';
import { getErrorMessage, getErrorStatus } from '@/shared/lib';

import type { Progress } from './pdf';
import { checkLines, emptyLine, type ReadLines } from './statement-table';

/**
 * A photo of a bank statement, read into statement lines.
 *
 * The one kind of file this screen cannot read by itself: a CSV, a sheet, camt.053 and a PDF (even
 * a scanned one) are all read here in the browser, but a phone photo goes to the server's OCR
 * integration, which sends it to an external provider. What comes back is shaped into the same
 * lines a CSV gives, so the photo goes through the same "Check and upload" step and the same
 * matcher as every other file — nothing about it is saved until the person uploads it.
 */

/** Phone cameras write JPEG, PNG and (on an iPhone) HEIC. */
const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'heif'];

export function isStatementPhoto(file: File): boolean {
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  return file.type.startsWith('image/') || PHOTO_EXTENSIONS.includes(extension);
}

/**
 * The server's reading as lines to check. A row whose direction could not be read keeps its
 * amount in a note rather than in a column: putting it in either would be a guess, and the
 * "Needs exactly one of withdrawal or deposit" check stops it being sent until a person decides.
 */
export function photoReadingToLines(reading: OcrStatementReading): ReadLines {
  const { statement } = reading;

  const lines = statement.rows.map((row) => {
    const line = emptyLine();
    line.txnDate = row.date_iso ?? '';
    line.description = row.description ?? '';
    line.reference = row.reference ?? '';
    line.balance = row.balance ?? '';

    if (row.amount && row.direction === 'withdrawal') line.withdrawal = row.amount;
    else if (row.amount && row.direction === 'deposit') line.deposit = row.amount;
    else if (row.amount) {
      line.issues.push(
        `Read ${row.amount}, but not whether it went out or came in — enter it as a withdrawal or a deposit`,
      );
    }

    if (!row.date_iso && row.date) {
      line.issues.push(`Could not read "${row.date}" as a date — enter it`);
    }
    return line;
  });

  // The rows come back as printed; a newest-first statement is put the right way round here,
  // exactly as for any other file, and the running balance checked.
  return checkLines({
    lines,
    openingBalance: statement.opening_balance ?? undefined,
    closingBalance: statement.closing_balance ?? undefined,
  });
}

/** Reads a statement photo through the server's OCR, as lines for the check step. */
export async function readPhotoStatement(file: File, progress: Progress): Promise<ReadLines> {
  progress('Checking OCR is available…');
  let limit: number;
  try {
    const info = await getOcrProviders();
    if (!info.enabled) {
      throw new Error(
        'Reading a photo needs OCR, which is turned off on this server. Download the statement from net banking as PDF, CSV or Excel instead.',
      );
    }
    const reader =
      info.providers.find(
        (provider) => provider.configured && provider.id === info.default_provider,
      ) ?? info.providers.find((provider) => provider.configured);
    if (!reader) {
      throw new Error(
        'Reading a photo needs an OCR provider key on the server. Upload the PDF, CSV or Excel file instead.',
      );
    }
    limit = Math.min(info.max_file_size_bytes, reader.max_file_size_bytes);
  } catch (err) {
    const status = getErrorStatus(err);
    if (status === 401 || status === 403) {
      throw new Error(
        'Only an administrator can upload a photo of a statement, because it is read by an external OCR service. Upload the PDF, CSV or Excel file instead.',
        { cause: err },
      );
    }
    throw err;
  }

  progress('Preparing the photo…');
  const upload = await fitImageForOcr(file, limit);

  progress('Reading the photo with OCR… this can take up to a minute.');
  let reading: OcrStatementReading;
  try {
    reading = await readStatementPhoto(upload);
  } catch (err) {
    throw new Error(getErrorMessage(err, 'The photo could not be read'), { cause: err });
  }

  return photoReadingToLines(reading);
}
