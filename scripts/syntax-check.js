const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SKIP = new Set(['node_modules', '.git', 'out', 'dist', '.vscode-test']);

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

const files = walk(process.cwd(), []);
files.forEach((file) => {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
});
console.log('Syntax OK (' + files.length + ' files)');
