const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/**
 * Makes Xcode's Run action (⌘R) build Release instead of Debug, so the app on the device
 * runs from the embedded bundle without Metro. Rewrites every shared scheme on prebuild.
 */
module.exports = function withReleaseScheme(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const ios = config.modRequest.platformProjectRoot;
      for (const project of fs.readdirSync(ios).filter((name) => name.endsWith('.xcodeproj'))) {
        const schemes = path.join(ios, project, 'xcshareddata', 'xcschemes');
        if (!fs.existsSync(schemes)) continue;
        for (const file of fs.readdirSync(schemes).filter((name) => name.endsWith('.xcscheme'))) {
          const target = path.join(schemes, file);
          const xml = fs.readFileSync(target, 'utf8');
          const next = xml.replace(/(<LaunchAction\b[^>]*?buildConfiguration\s*=\s*")Debug(")/, '$1Release$2');
          if (next !== xml) fs.writeFileSync(target, next);
        }
      }
      return config;
    },
  ]);
};
