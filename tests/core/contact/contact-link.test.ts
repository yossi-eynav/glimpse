import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTACT_EMAIL, contactLink } from '../../../src/core/contact/contact-link.ts';

test('the contact link opens a new Gmail message to the developer', () => {
  const url = new URL(contactLink({ appVersion: '0.1.0', osVersion: '15.1' }));
  assert.equal(url.origin + url.pathname, 'https://mail.google.com/mail/');
  assert.equal(url.searchParams.get('view'), 'cm');
  assert.equal(url.searchParams.get('fs'), '1');
  assert.equal(url.searchParams.get('to'), CONTACT_EMAIL);
  assert.equal(url.searchParams.get('su'), 'Glimpse feedback');
});

test('the body carries the app and macOS versions, safely encoded', () => {
  const url = new URL(contactLink({ appVersion: '1.2.3 & beta', osVersion: '14.6' }));
  const body = url.searchParams.get('body') ?? '';
  assert.match(body, /Glimpse 1\.2\.3 & beta/);
  assert.match(body, /macOS 14\.6/);
  assert.ok(!url.search.includes(' '), 'spaces are encoded');
});
