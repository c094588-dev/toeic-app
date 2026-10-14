const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
// Read the canonical vocabulary (../words.json) from the repository root.
config.watchFolders = [path.resolve(__dirname, "..")];
module.exports = config;
