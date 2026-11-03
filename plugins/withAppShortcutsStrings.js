const fs = require('fs');
const path = require('path');
const { IOSConfig, withXcodeProject } = require('expo/config-plugins');

/**
 * Siri phrases are only localized from AppShortcuts.strings, which the `locales` field in
 * app.json can't produce (it writes InfoPlist.strings and Localizable.strings). This writes
 * one per language from locales/siri/<lang>.json, next to the ones Expo generates.
 *
 * Options: { locales: { "<lproj name>": "./path/to.json" } }
 */
const escape = (value) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

module.exports = function withAppShortcutsStrings(config, { locales }) {
  return withXcodeProject(config, (config) => {
    const { projectRoot } = config.modRequest;
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const supporting = path.join(projectRoot, 'ios', projectName, 'Supporting');
    let project = config.modResults;

    for (const [lang, file] of Object.entries(locales)) {
      const phrases = JSON.parse(fs.readFileSync(path.resolve(projectRoot, file), 'utf8'));
      const dir = path.join(supporting, `${lang}.lproj`);
      fs.mkdirSync(dir, { recursive: true });
      const target = path.join(dir, 'AppShortcuts.strings');
      fs.writeFileSync(target, Object.entries(phrases).map(([k, v]) => `"${escape(k)}" = "${escape(v)}";`).join('\n') + '\n');

      const groupName = `${projectName}/Supporting/${lang}.lproj`;
      const group = IOSConfig.XcodeUtils.ensureGroupRecursively(project, groupName);
      if (!group?.children.some(({ comment }) => comment === 'AppShortcuts.strings')) {
        project = IOSConfig.XcodeUtils.addResourceFileToGroup({
          filepath: path.relative(supporting, target),
          groupName,
          project,
          isBuildFile: true,
        });
      }
    }
    config.modResults = project;
    return config;
  });
};
