// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// CocoaPods output is native-only and full of symlinks; crawling it can exhaust Metro's memory.
config.resolver.blockList = [...[].concat(config.resolver.blockList ?? []), /[/\\]ios[/\\]Pods[/\\].*/, /[/\\]ios[/\\]build[/\\].*/];

module.exports = config;
