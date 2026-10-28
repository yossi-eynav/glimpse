const notarize = process.env.APPLE_TEAM_ID && process.env.NOTARY_KEYCHAIN_PROFILE;

export default {
  packagerConfig: {
    name: 'Google Photos Wallpaper',
    appBundleId: 'com.example.photowallpaper',
    extendInfo: { LSUIElement: true },
    extraResource: ['build/pw-helper', 'build/PhotoWallpaperSaver.saver', 'config/google.json'],
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
