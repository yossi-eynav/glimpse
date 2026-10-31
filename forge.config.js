const notarize = process.env.APPLE_TEAM_ID && process.env.NOTARY_KEYCHAIN_PROFILE;

export default {
  packagerConfig: {
    name: 'Glimpse',
    appBundleId: 'com.yossieynav.glimpse',
    extendInfo: { LSUIElement: true },
    extraResource: ['build/glimpse-helper', 'build/Glimpse.saver', 'config/google.json'],
    ignore: [/^\/(src|tests|specs|native|scripts|\.specify|\.claude|build|config)(\/|$)/],
    ...(notarize && {
      osxSign: {},
      osxNotarize: {
        teamId: process.env.APPLE_TEAM_ID,
        keychainProfile: process.env.NOTARY_KEYCHAIN_PROFILE,
      },
    }),
  },
  makers: [
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    { name: '@electron-forge/maker-dmg', platforms: ['darwin'] },
  ],
};
