import { readFileSync } from 'node:fs';

const dir = new URL('../fixtures/', import.meta.url);

export function fixture<T = any>(name: string): T {
  return JSON.parse(readFileSync(new URL(name, dir), 'utf8')) as T;
}

export function sampleJpeg(): Uint8Array<ArrayBuffer> {
  return new Uint8Array(readFileSync(new URL('sample.jpg', dir)));
}
