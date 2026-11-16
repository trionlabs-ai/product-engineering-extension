const path = require('path');
const { runTests } = require('@vscode/test-electron');

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, '..');
  const extensionTestsPath = path.resolve(__dirname, 'suite', 'index.js');
  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [
      extensionDevelopmentPath,
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
