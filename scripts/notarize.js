const { notarize } = require("@electron/notarize");
const { build } = require("../package.json");

const notarizeMacos = async context => {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== "darwin") return;
  
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.warn("Skipping notarizing step. Missing Apple credentials");
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  await notarize({
    tool: "notarytool",
    appBundleId: build.appId,
    appPath: `${appOutDir}/${appName}.app`,
    teamId: process.env.APPLE_TEAM_ID,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    verbose: true,
  });
  console.log("--- notarization completed ---");
};

exports.default = notarizeMacos;