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

/**
 * Same as runFile, but writes `options.input` to stdin. A timeout or an
 * aborted signal kills the process. There is no shell.
 */
function runFileInput(file, args, options = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let cancelled = false;
    let timedOut = false;
    let timer = null;
    const child = execFile(
      file,
      Array.isArray(args) ? args : [],
      {
        cwd: options.cwd,
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve({
          ok: !error && !cancelled && !timedOut,
          stdout: stdout ? String(stdout) : '',
          stderr: stderr ? String(stderr) : '',
          timedOut,
          cancelled,
          error,
        });
      }
    );

    function stop(kind) {
      if (settled) return;
      if (kind === 'cancel') cancelled = true;
      if (kind === 'timeout') timedOut = true;
      try {
        child.kill('SIGTERM');
      } catch (_) {
        // The process may already have exited.
      }
    }

    if (options.timeoutMs > 0) timer = setTimeout(() => stop('timeout'), options.timeoutMs);

    if (options.signal) {
      const onAbort = () => stop('cancel');
      if (options.signal.aborted) onAbort();
      else options.signal.addEventListener('abort', onAbort, { once: true });
    }

    if (child.stdin) {
      child.stdin.on('error', () => {});
      if (options.input != null) child.stdin.end(String(options.input));
      else child.stdin.end();
    }
  });
}

module.exports = { runFile, runFileInput };
