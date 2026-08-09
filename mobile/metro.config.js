const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// @supabase/supabase-js's dependency chain (ws, isows, @supabase/auth-js)
// trips Metro's newer "package exports" resolution — a documented,
// common gotcha wiring Supabase into Expo/React Native, not specific to
// this project. Without this, Metro fails with "Unable to resolve
// @supabase/auth-js" even though the package is genuinely on disk.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
