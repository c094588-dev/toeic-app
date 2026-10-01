const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
// Share the canonical vocabulary with the existing web and Swift apps.
config.watchFolders = [path.resolve(__dirname, "..")];
module.exports = config;
