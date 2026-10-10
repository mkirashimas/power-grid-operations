import { checkUpload, isPdf, newId, type Attachment, type UploadProblem } from '../model';
import { putFile } from './db';

export class UploadError extends Error {
  constructor(readonly problem: UploadProblem) {
    super(`Upload rejected: ${problem}`);
  }
}

/**
 * Checks a file (size, type, then the `%PDF-` signature) and stores it in IndexedDB.
 * Returns the attachment to add to the report; throws UploadError when it is rejected.
 */
export const storeUpload = async (file: File, now = Date.now()): Promise<Attachment> => {
  const problem = checkUpload(file);
  if (problem) throw new UploadError(problem);
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!isPdf(head)) throw new UploadError('type');
  const attachment: Attachment = {
    id: newId('att'),
    name: file.name,
    size: file.size,
    source: 'upload',
    addedAt: now,
  };
  await putFile(attachment.id, file);
  return attachment;
};
