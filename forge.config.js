import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const notarize = process.env.APPLE_TEAM_ID && process.env.NOTARY_KEYCHAIN_PROFILE;

export default {
  packagerConfig: {
    name: 'Glimpse',
    appBundleId: 'com.yossieynav.glimpse',
    icon: 'assets/icon', // assets/icon.icns, made from assets/wallpaper.png
    extendInfo: { LSUIElement: true },
    extraResource: ['build/glimpse-helper', 'config/google.json'],
    ignore: [/^\/(src|tests|specs|native|scripts|\.specify|\.claude|build|config)(\/|$)/],
    ...(notarize && {
      osxSign: {},
      osxNotarize: {
        teamId: process.env.APPLE_TEAM_ID,
        keychainProfile: process.env.NOTARY_KEYCHAIN_PROFILE,
      },
    }),
  },
  hooks: {
    // Without a Developer ID, ad-hoc sign the whole bundle before the makers pack it, so a
    // downloaded copy gets "Open Anyway" instead of "damaged" (specs/007-ci-release-builds R1).
    postPackage: async (_config, { outputPaths }) => {
      if (notarize) return;
      for (const dir of outputPaths) {
        execFileSync('scripts/adhoc-sign.sh', [join(dir, 'Glimpse.app')], { stdio: 'inherit' });
      }
    },
  },
  makers: [
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    { name: '@electron-forge/maker-dmg', platforms: ['darwin'], config: { icon: 'assets/icon.icns' } },
  ],
};
