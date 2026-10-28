import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describePickerError } from '../../../src/core/picker/errors.ts';

const googleError = (status: number, reason: string | null, message: string) =>
  Object.assign(new Error(message), {
    response: { status, data: { error: { code: status, message, status: 'PERMISSION_DENIED', details: reason ? [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason }] : [] } } },
  });

test('a disabled Picker API says so and points at the Cloud project', () => {
  const d = describePickerError(googleError(403, 'SERVICE_DISABLED', 'Photos Picker API has not been used in project 123 before or it is disabled.'));
  assert.equal(d.kind, 'apiDisabled');
  assert.equal(d.message, "The Google Photos Picker API isn't enabled for this app's Google Cloud project. Enable it in the Cloud Console, wait a few minutes, and try again.");
  assert.equal(d.status, 403);
  assert.match(d.detail, /has not been used in project 123/);
});

test('missing Photos access asks the user to sign in again and allow it', () => {
  const d = describePickerError(googleError(403, 'ACCESS_TOKEN_SCOPE_INSUFFICIENT', 'Request had insufficient authentication scopes.'));
  assert.equal(d.kind, 'scopeMissing');
  assert.equal(d.message, 'Google Photos access was not granted. Sign in again and tick the Google Photos permission.');
});

test('no HTTP response is a connection problem', () => {
  const d = describePickerError(new TypeError('fetch failed'));
  assert.equal(d.kind, 'network');
  assert.equal(d.message, "Couldn't reach Google Photos. Check your connection and try again.");
  assert.equal(d.status, null);
});

test('any other HTTP error reports the status code', () => {
  const d = describePickerError(googleError(400, null, 'Invalid argument'));
  assert.equal(d.kind, 'http');
  assert.equal(d.message, 'Google Photos returned an error (HTTP 400). Try again in a few minutes.');
  assert.equal(d.detail, 'Invalid argument');
});
