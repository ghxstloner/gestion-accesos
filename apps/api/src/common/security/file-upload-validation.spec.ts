import { describe, expect, it } from '@jest/globals';
import { validateUploadedFile } from './file-upload-validation';
import { ValidationError } from '../domain/errors/domain-error';

function bytes(...bytes: number[]): Uint8Array {
  return Uint8Array.from(bytes);
}

describe('validateUploadedFile', () => {
  const base = {
    originalName: 'passport.jpg',
    size: 1024,
    maxBytes: 10_485_760,
  };

  it('accepts a valid JPEG', () => {
    expect(() =>
      validateUploadedFile({
        ...base,
        declaredMime: 'image/jpeg',
        head: bytes(0xff, 0xd8, 0xff, 0xe0),
      }),
    ).not.toThrow();
  });

  it('accepts a valid PDF', () => {
    expect(() =>
      validateUploadedFile({
        ...base,
        originalName: 'doc.pdf',
        declaredMime: 'application/pdf',
        head: bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34),
      }),
    ).not.toThrow();
  });

  it('rejects an empty file', () => {
    expect(() =>
      validateUploadedFile({
        ...base,
        size: 0,
        declaredMime: 'image/jpeg',
        head: bytes(0xff, 0xd8, 0xff),
      }),
    ).toThrow(ValidationError);
  });

  it('rejects oversized files', () => {
    expect(() =>
      validateUploadedFile({
        ...base,
        size: 11_000_000,
        maxBytes: 10_000_000,
        declaredMime: 'image/jpeg',
        head: bytes(0xff, 0xd8, 0xff),
      }),
    ).toThrow(/maximum size/);
  });

  it('rejects a MIME not in the whitelist', () => {
    expect(() =>
      validateUploadedFile({
        ...base,
        declaredMime: 'application/x-msdownload',
        originalName: 'evil.exe',
        head: bytes(0x4d, 0x5a),
      }),
    ).toThrow(/not allowed/);
  });

  it('rejects when extension does not match the declared MIME', () => {
    expect(() =>
      validateUploadedFile({
        ...base,
        declaredMime: 'image/jpeg',
        originalName: 'passport.png',
        head: bytes(0xff, 0xd8, 0xff),
      }),
    ).toThrow(/does not match the declared type/);
  });

  it('rejects when the body does not match the declared MIME (Content-Type spoofing)', () => {
    expect(() =>
      validateUploadedFile({
        ...base,
        declaredMime: 'image/jpeg',
        // PE executable header inside a .jpg
        head: bytes(0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00),
      }),
    ).toThrow(ValidationError);
  });

  it('rejects an unrecognized header', () => {
    expect(() =>
      validateUploadedFile({
        ...base,
        declaredMime: 'image/jpeg',
        head: bytes(0x00, 0x00, 0x00, 0x00, 0x00, 0x00),
      }),
    ).toThrow(/unrecognized file header/);
  });

  it('honors a custom allowed MIME list', () => {
    expect(() =>
      validateUploadedFile({
        ...base,
        declaredMime: 'image/jpeg',
        originalName: 'x.jpg',
        allowedMimes: ['image/png'],
        head: bytes(0xff, 0xd8, 0xff),
      }),
    ).toThrow(/not allowed/);
  });
});
