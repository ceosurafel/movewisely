const base = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9222';
const pageUrl = process.env.BROWSER_SMOKE_URL || 'http://127.0.0.1:4173/stockfish-browser-smoke.html';
const timeoutMs = 35_000;

const targetsResponse = await fetch(`${base}/json`);
if (!targetsResponse.ok) {
  throw new Error(`Chrome DevTools target endpoint returned HTTP ${targetsResponse.status}`);
}
const targets = await targetsResponse.json();
const target = targets.find(item => item.type === 'page' && item.webSocketDebuggerUrl);
if (!target) throw new Error('No Chrome page target was exposed by the DevTools endpoint.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Timed out connecting to Chrome DevTools.')), 8_000);
  socket.addEventListener('open', () => {
    clearTimeout(timer);
    resolve();
  }, { once: true });
  socket.addEventListener('error', () => {
    clearTimeout(timer);
    reject(new Error('Chrome DevTools WebSocket connection failed.'));
  }, { once: true });
});

socket.addEventListener('message', event => {
  let message;
  try {
    message = JSON.parse(String(event.data));
  } catch {
    return;
  }
  if (!message.id) return;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  clearTimeout(waiter.timer);
  if (message.error) waiter.reject(new Error(message.error.message || 'Chrome DevTools command failed'));
  else waiter.resolve(message);
});

function command(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Chrome DevTools command timed out: ${method}`));
    }, 8_000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

try {
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Page.navigate', { url: pageUrl });

  const deadline = Date.now() + timeoutMs;
  let lastStatus = '(page has not finished loading)';

  while (Date.now() < deadline) {
    const result = await command('Runtime.evaluate', {
      expression: `({ title: document.title, status: document.getElementById('status')?.textContent || '' })`,
      returnByValue: true,
      awaitPromise: false,
    });
    const value = result.result?.result?.value;
    lastStatus = value?.status || lastStatus;

    if (lastStatus.startsWith('BROWSER_SMOKE_PASS:')) {
      process.stdout.write(`PASS: ${lastStatus}\n`);
      process.stdout.write(`Browser title: ${value.title}\n`);
      break;
    }
    if (lastStatus.startsWith('BROWSER_SMOKE_FAIL:')) {
      throw new Error(lastStatus);
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  if (!lastStatus.startsWith('BROWSER_SMOKE_PASS:')) {
    throw new Error(`Browser worker did not complete before timeout. Last status: ${lastStatus}`);
  }
} finally {
  socket.close();
}
