const { execFile } = require('child_process');

/**
 * Run a program with an argument array. Never uses a shell, so metacharacters
 * in arguments stay literal.
 */
function runFile(file, args, options = {}) {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      {
        cwd: options.cwd,
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: stdout ? String(stdout) : '',
          stderr: stderr ? String(stderr) : '',
          error,
        });
      }
    );
  });
}

module.exports = { runFile };
