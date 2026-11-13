export const CONTACT_EMAIL = 'yossi.eynav@gmail.com';

/**
 * A Gmail "new message" link to the developer. The person reviews and sends it from their own
 * account, so the app itself sends nothing.
 */
export function contactLink(info: { appVersion: string; osVersion: string }): string {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: CONTACT_EMAIL,
    su: 'Glimpse feedback',
    body: `\n\n—\nGlimpse ${info.appVersion} · macOS ${info.osVersion}`,
  });
  return `https://mail.google.com/mail/?${params.toString().replaceAll('+', '%20')}`;
}
