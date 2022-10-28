const fs = require("node:fs");
const { domainsJsonPath, settingsJsonPath } = require("./constants");

exports.beforeServerStart = async () => {
  if (!fs.existsSync(domainsJsonPath)) {
    fs.writeFileSync(domainsJsonPath, JSON.stringify({}));
  }

  if (!fs.existsSync(settingsJsonPath)) {
    fs.writeFileSync(settingsJsonPath, JSON.stringify({}));
  }
};
