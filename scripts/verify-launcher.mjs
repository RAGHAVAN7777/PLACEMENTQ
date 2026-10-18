import assert from 'node:assert/strict';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

if (process.platform !== 'win32') {
  console.log('Windows launcher check skipped on this platform.');
} else {
  const listener = net.createServer(socket => socket.end('still running'));
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  try {
    await assert.rejects(promisify(execFile)('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/start-placementiq.ps1', '-SkipInstall',
    ], { windowsHide: true, timeout: 30000, env: { ...process.env, PLACEMENTIQ_PORT: String(port) } }),
    error => /No process was stopped/.test(error.stderr));
    const received = await new Promise((resolve, reject) => {
      const socket = net.connect(port, '127.0.0.1');
      socket.on('data', data => resolve(data.toString()));
      socket.on('error', reject);
    });
    assert.equal(received, 'still running');
    console.log('PASS: launcher rejects occupied ports and leaves the listening process alive.');
  } finally { await new Promise(resolve => listener.close(resolve)); }
}
