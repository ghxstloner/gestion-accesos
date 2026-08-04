import { ValidationError } from '../domain/errors/domain-error';

/**
 * Allowed MIME types and filename extensions for document uploads.
 * Whitelist-based to mitigate malicious uploads. To extend, add both the
 * MIME and the (lowercased) extension here.
 */
const ALLOWED_MIME_TO_EXTENSIONS: ReadonlyMap<string, readonly string[]> =
  new Map<string, readonly string[]>([
    ['image/jpeg', ['.jpg', '.jpeg']],
    ['image/png', ['.png']],
    ['image/webp', ['.webp']],
    ['image/gif', ['.gif']],
    ['application/pdf', ['.pdf']],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ['.docx'],
    ],
    ['application/msword', ['.doc']],
  ]);

const ALLOWED_MIME_SET = new Set(ALLOWED_MIME_TO_EXTENSIONS.keys());

/**
 * Magic-byte signatures verified *in addition* to the client-supplied MIME
 * header. The client can lie about Content-Type, but the first bytes of the
 * file cannot be forged. This prevents uploads of `.exe`, `.svg` (XSS), or
 * other risky content disguised as image/pdf.
 */
const MAGIC_SIGNATURES: ReadonlyArray<{
  offset: number;
  bytes: number[];
  mime: string;
}> = [
  // JPEG SOI marker
  { offset: 0, bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  // PNG signature
  {
    offset: 0,
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    mime: 'image/png',
  },
  // GIF8
  { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif' },
  // RIFF .... WEBP
  { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' },
  // %PDF
  { offset: 0, bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf' },
  // ZIP-based Office (DOCX/XLSX/PPTX) — PK\x03\x04
  { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04], mime: 'office-zip' },
  // Legacy OLE compound (DOC/XLS/PPT) — D0 CF 11 E0
  { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0], mime: 'office-ole' },
];

/**
 * Pure (IO-free) validator for a single uploaded file. Throws a 400
 * `ValidationError` (mapped to a problem-detail response by the global
 * exception filter) on any rejection.
 *
 * @param fields the inputs copied directly from Multer's `Express.Multer.File`
 *  plus a `head` buffer — typically the first 16 bytes of the file body.
 */
export function validateUploadedFile(fields: {
  declaredMime: string;
  originalName: string;
  size: number;
  head: Uint8Array;
  maxBytes: number;
  /** Optional override of allowed MIME set; defaults to the office+image+pdf whitelist. */
  allowedMimes?: readonly string[];
}): void {
  const { declaredMime, originalName, size, head, maxBytes } = fields;
  const allowed = fields.allowedMimes ?? Array.from(ALLOWED_MIME_SET);

  // 1. Size cap.
  if (!Number.isFinite(size) || size <= 0) {
    throw new ValidationError('Uploaded file is empty.');
  }
  if (size > maxBytes) {
    throw new ValidationError(
      `Uploaded file exceeds the maximum size (${maxBytes} bytes).`,
    );
  }

  // 2. Whitelist the client-declared MIME.
  const normalizedMime = declaredMime.toLowerCase();
  if (!allowed.includes(normalizedMime)) {
    throw new ValidationError(
      `File type ${declaredMime} is not allowed for upload.`,
    );
  }

  // 3. Extension must match the MIME whitelist.
  const extAliases = ALLOWED_MIME_TO_EXTENSIONS.get(normalizedMime);
  const lowerName = originalName.toLowerCase();
  if (extAliases && !extAliases.some((ext) => lowerName.endsWith(ext))) {
    throw new ValidationError(
      `File extension does not match the declared type ${declaredMime}.`,
    );
  }

  // 4. Magic-byte sniff must align with the declared MIME.
  const detected = detectMime(head);
  if (!detected) {
    throw new ValidationError('Uploaded file has an unrecognized file header.');
  }
  if (!mimeMatches(detected, normalizedMime)) {
    throw new ValidationError(
      `Uploaded file content (${detected}) does not match the declared type (${declaredMime}).`,
    );
  }
}

/** Map a detected magic-byte signature to the canonical MIME it represents. */
function detectMime(head: Uint8Array): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    if (head.length < sig.offset + sig.bytes.length) continue;
    let ok = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (head[sig.offset + i] !== sig.bytes[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return sig.mime;
  }
  return null;
}

/** Office docx/xls/ppt all share ZIP/OLE magic; any of them is OK if MIME matches. */
function mimeMatches(detected: string, declared: string): boolean {
  if (detected === declared) return true;
  const officeMimes = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ]);
  if (
    (detected === 'office-zip' || detected === 'office-ole') &&
    officeMimes.has(declared)
  ) {
    return true;
  }
  // WebP detection only narrows the RIFF family.
  if (detected === 'image/webp' && declared.startsWith('image/')) {
    return true;
  }
  return false;
}
