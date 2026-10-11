const debugBase = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9222';
const appUrl = process.env.CHECKUP_APP_URL || 'http://127.0.0.1:4173/';
const timeoutMs = 12 * 60 * 1000;

const targetsResponse = await fetch(`${debugBase}/json`);
if (!targetsResponse.ok) throw new Error(`Chrome DevTools returned HTTP ${targetsResponse.status}`);
const targets = await targetsResponse.json();
const target = targets.find(item => item.type === 'page' && item.webSocketDebuggerUrl);
if (!target) throw new Error('No Chrome page target is available for the checkup flow test.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Timed out connecting to Chrome DevTools.')), 8_000);
  socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
  socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Could not connect to Chrome DevTools.')); }, { once: true });
});

socket.addEventListener('message', event => {
  let message;
  try { message = JSON.parse(String(event.data)); } catch { return; }
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
      reject(new Error(`DevTools command timed out: ${method}`));
    }, 10_000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const r = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.result?.exceptionDetails) {
    throw new Error(r.result.result.exceptionDetails.text || 'Browser evaluation failed');
  }
  return r.result?.result?.value;
}

async function waitFor(expression, description, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await evaluate(expression);
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function clickAndWait(expression, description) {
  const result = await evaluate(expression);
  if (!result) throw new Error(`Could not perform UI action: ${description}`);
  console.log(`PASS: ${description}`);
}

try {
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Page.navigate', { url: appUrl });
  await waitFor(`document.readyState === 'complete' && !!document.querySelector('#root')`, 'landing page', 20_000);

  await clickAndWait(
    `(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /^Inspect .*Checkup/i.test(x.textContent.trim())); if (!b) return false; b.click(); return true; })()`,
    'select a clearly labeled synthetic demo profile'
  );

  await waitFor(
    `document.body.innerText.includes('How much time per day are you willing to train?')`,
    'daily practice question'
  );
  const recommended = await evaluate(
    `(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('15–30 min')); return Boolean(b && b.getAttribute('aria-pressed') === 'true'); })()`
  );
  if (!recommended) throw new Error('The recommended 15–30 minute training budget is not selected by default.');
  console.log('PASS: daily practice question, recommended default, and selectable option cards render.');

  await clickAndWait(
    `(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Next'); if (!b) return false; b.click(); return true; })()`,
    'advance to rating-goal selection'
  );
  await waitFor(`document.body.innerText.includes('Where do you want to be?')`, 'rating goal question');

  await clickAndWait(
    `(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Show me the gap'); if (!b) return false; b.click(); return true; })()`,
    'confirm goal and start the real analysis path'
  );

  await waitFor(`document.body.innerText.includes('SCANNING YOUR GAMES')`, 'live analysis progress dashboard', 10_000);
  console.log('PASS: post-setup analysis screen appears with progress and rating-gap visual.');

  let lastLoggedPercent = -1;
  const analysisDeadline = Date.now() + timeoutMs;
  let resultFound = false;
  while (Date.now() < analysisDeadline) {
    const state = await evaluate(`(() => {
      const text = document.body.innerText;
      const match = text.match(/SCANNING YOUR GAMES\\s+(\\d+)%/);
      return {
        progress: match ? Number(match[1]) : null,
        isResult: text.includes('MOVEWISELY CHECKUP'),
        isError: text.includes('Checkup analysis failed') || text.includes('The chess engine could not complete')
      };
    })()`);
    if (state?.isError) throw new Error('The checkup flow showed an engine analysis error.');
    if (state?.progress !== null && state?.progress !== undefined && state.progress !== lastLoggedPercent) {
      lastLoggedPercent = state.progress;
      console.log(`Analysis progress observed: ${state.progress}%`);
    }
    if (state?.isResult) { resultFound = true; break; }
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  if (!resultFound) throw new Error('The real browser checkup did not reach the report screen before timeout.');
  await waitFor(`document.body.innerText.includes('MOVEWISELY CHECKUP')`, 'result intro card', 5_000);
  console.log('PASS: full demo analysis completed and result intro card rendered.');

  async function advanceStory(expectedText, description) {
    await clickAndWait(
      `(() => { const box = Array.from(document.querySelectorAll('div')).find(x => typeof x.className === 'string' && x.className.includes('max-w-[440px]') && x.className.includes('h-[100dvh]')); if (!box) return false; const rect = box.getBoundingClientRect(); box.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.right - 8, clientY: rect.top + Math.min(240, rect.height / 2) })); return true; })()`,
      `navigate to ${description}`
    );
    await waitFor(`document.body.innerText.includes(${JSON.stringify(expectedText)})`, description, 5_000);
    console.log(`PASS: ${description} is displayed.`);
  }

  await advanceStory('YOUR ACCURACY', 'accuracy story card');
  await advanceStory('BLUNDERS PER GAME', 'blunders story card');
  await advanceStory('OPENING DISCIPLINE', 'opening-errors story card');
  await advanceStory('PERSONALIZED ROADMAP', 'personalized roadmap');
  const planText = await evaluate('document.body.innerText');
  if (!planText.includes('Your available training time: 15–30 min per day')) {
    throw new Error('The final plan does not reflect the daily practice budget selected in setup.');
  }
  if (!planText.includes('Session One Checklist')) {
    throw new Error('The final report is missing the action-plan checklist.');
  }
  console.log('PASS: roadmap includes session checklist and the selected daily training budget.');
  console.log('PASS: complete checkup setup → actual engine analysis → results-story smoke test passed.');
} finally {
  socket.close();
}
