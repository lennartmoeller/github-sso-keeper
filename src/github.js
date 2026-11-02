const NAMESPACE = 'github-sso-keeper';
const INSTANCE_ID = Math.random().toString(36).slice(2, 8);

const FORM = 'form[action*="/oidc/initiate"]';
const PROMPT_FORM = `${FORM}:not(.sso-prompt-default *)`;
const MODAL_FORM = `.sso-modal .sso-prompt-default ${FORM}`;
const RENEWAL_HASH = '#github-sso-keeper-renewal';

const RENEW_BEFORE_EXPIRY_S = 5 * 60;
// GitHub keeps the session valid this long after the `sso-expires-around` value of a page.
const GRACE_AFTER_EXPIRY_S = 10 * 60;
const ACTIVE_WITHIN_MS = 45 * 60 * 1000;
const RENEWAL_TIMEOUT_MS = 45 * 1000;
const FOREGROUND_RENEWAL_TIMEOUT_MS = 120 * 1000;
const RETRY_AFTER_FAILURE_MS = 3 * 60 * 1000;
const MODAL_COOLDOWN_MS = 5 * 1000;
const PROMPT_LOCK_MS = 30 * 1000;
const PROMPT_RETRY_MS = 15 * 1000;
const MAX_PROMPT_CLICKS = 5;
const PROMPT_CLICK_WINDOW_MS = 10 * 60 * 1000;
const ACTIVITY_WRITE_MS = 15 * 1000;
const POLL_MS = 100;
const CHECK_THROTTLE_MS = 50;
const LOG_LIMIT = 80;

const storage = (area) => ({
  get: (name, fallback = null) => JSON.parse(area.getItem(`${NAMESPACE}:${name}`)) ?? fallback,
  set: (name, value) => area.setItem(`${NAMESPACE}:${name}`, JSON.stringify(value)),
});
const shared = storage(localStorage);
const tabState = storage(sessionStorage);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nowSeconds = () => Math.floor(Date.now() / 1000);
const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

let busy = false;
let modalCooldownUntil = 0;
let promptPending = false;
let lastPromptClick = 0;
let lastRun = 0;
let lastActivityWrite = 0;
let renewalHandled = false;

function log(message) {
  console.info(`[${NAMESPACE}]`, message);
  const entries = shared.get('log', []);
  entries.push([Date.now(), INSTANCE_ID, location.pathname + location.hash, message]);
  shared.set('log', entries.slice(-LOG_LIMIT));
}

function knownSession() {
  const page = {
    expires: Number(document.querySelector('meta[name="sso-expires-around"]')?.content) || 0,
    modalUrl: document.querySelector('link[rel="sso-modal"]')?.href,
  };
  const stored = { expires: shared.get('expires', 0), modalUrl: shared.get('modal-url') };
  if (page.expires > stored.expires) shared.set('expires', page.expires);
  if (page.modalUrl && page.modalUrl !== stored.modalUrl) shared.set('modal-url', page.modalUrl);
  return { expires: Math.max(page.expires, stored.expires), modalUrl: page.modalUrl ?? stored.modalUrl };
}

// Two overlapping SSO flows invalidate each other, so prompt clicks and renewals of all tabs take turns.
function lockedByOther(owner) {
  const lock = shared.get('lock');
  return lock !== null && lock.owner !== owner && lock.until > Date.now();
}

async function acquireLock(owner, ttl) {
  if (lockedByOther(owner)) return false;
  shared.set('lock', { owner, until: Date.now() + ttl });
  await sleep(30);
  return shared.get('lock')?.owner === owner;
}

function releaseLock(owner) {
  if (shared.get('lock')?.owner === owner) shared.set('lock', null);
}

async function exclusively(task) {
  if (busy) return;
  busy = true;
  try {
    await task();
  } finally {
    busy = false;
  }
}

function openTab(url, active) {
  const tabId = browser.runtime.sendMessage({ type: 'open-tab', url, active });
  return { close: () => tabId.then((id) => browser.runtime.sendMessage({ type: 'close-tab', tabId: id })) };
}

function fail(reason) {
  log(`renewal failed: ${reason}`);
  shared.set('last-error', { time: Date.now(), message: reason });
  shared.set('retry-at', Date.now() + RETRY_AFTER_FAILURE_MS);
  return null;
}

function describeTimeout(startedAt, opened) {
  if (!opened) return 'another SSO flow held the lock the whole time';
  const last = shared.get('log', []).findLast(([time, id]) => time >= startedAt && id !== INSTANCE_ID);
  return last ? `timed out after "${last[3]}" on ${last[2]}; Microsoft may be waiting for a sign-in` : 'timed out, the renewal tab never reported back';
}

// The identity provider needs a real navigation and GitHub pages cannot be framed.
// So a background tab submits the SSO form of the tiny page /sso_modal, and the landing page /sso_complete proves the renewal.
async function renewSession({ foreground = false } = {}) {
  const timeout = foreground ? FOREGROUND_RENEWAL_TIMEOUT_MS : RENEWAL_TIMEOUT_MS;
  const owner = `${INSTANCE_ID}:renewal`;
  const startedAt = Date.now();
  let tab = null;
  try {
    while (Date.now() - startedAt < timeout) {
      const result = shared.get('renewal-result');
      if (result?.time >= startedAt) {
        if (result.error) return fail(result.error);
        shared.set('last-error', null);
        log('session renewed');
        return result;
      }
      if (!tab && (await acquireLock(owner, timeout + 15 * 1000))) {
        log(`opening the renewal tab (${foreground ? 'foreground' : 'background'})`);
        tab = openTab(knownSession().modalUrl + RENEWAL_HASH, foreground);
      }
      await sleep(POLL_MS);
    }
    return fail(describeTimeout(startedAt, tab !== null));
  } finally {
    tab?.close();
    releaseLock(owner);
  }
}

function renewProactively() {
  const { expires } = knownSession();
  if (busy || !navigator.onLine || !expires || nowSeconds() < expires - RENEW_BEFORE_EXPIRY_S) return;
  if (Date.now() - shared.get('activity', 0) > ACTIVE_WITHIN_MS) return;
  if (Date.now() < shared.get('retry-at', 0) || lockedByOther(`${INSTANCE_ID}:renewal`)) return;
  log('session expires soon, renewing it in a background tab');
  return exclusively(() => renewSession());
}

window.addEventListener('online', () => shared.set('retry-at', 0));

if (location.hash === RENEWAL_HASH) tabState.set('renewal-tab', true);
const isRenewalTab = () => tabState.get('renewal-tab', false);

function endRenewal(error, expires = 0) {
  renewalHandled = true;
  if (!error) shared.set('expires', expires);
  shared.set('renewal-result', { time: Date.now(), expires, error });
  log(error ? `renewal tab failed: ${error}` : `renewal tab landed, new expiry ${expires}`);
  browser.runtime.sendMessage({ type: 'close-this-tab' });
}

function stepRenewalTab() {
  if (renewalHandled) return;
  if (location.pathname.endsWith('/sso_modal')) {
    const form = document.querySelector(`.sso-prompt-default ${FORM}`);
    if (form?.querySelector('button')) {
      renewalHandled = true;
      form.removeAttribute('target');
      log('renewal tab submits the SSO form');
      form.submit();
    } else if (document.readyState === 'complete') {
      endRenewal('the renewal page has no SSO form');
    }
    return;
  }
  if (location.pathname.includes('/oidc/')) return;
  const landing = document.querySelector('.js-sso-modal-complete');
  if (landing) {
    const expires = Number(landing.dataset.expiresAround);
    endRenewal(landing.dataset.error || (expires ? '' : 'the landing page has no expiry'), expires);
  } else if (document.readyState === 'complete') {
    endRenewal(`unexpected landing page ${location.pathname}`);
  }
}

function releasePromptLock() {
  const owner = tabState.get('prompt-owner');
  if (!owner || location.pathname.includes('/oidc/')) return;
  tabState.set('prompt-owner', null);
  releaseLock(owner);
}

async function continuePrompt(form) {
  const button = form.querySelector('button[type="submit"]');
  const clicks = tabState.get('prompt-clicks', []).filter((time) => Date.now() - time < PROMPT_CLICK_WINDOW_MS);
  if (!button || promptPending || clicks.length >= MAX_PROMPT_CLICKS || Date.now() - lastPromptClick < PROMPT_RETRY_MS) return;
  const owner = `${INSTANCE_ID}:prompt`;
  promptPending = true;
  try {
    if (!(await acquireLock(owner, PROMPT_LOCK_MS))) return;
    if (!form.isConnected) {
      releaseLock(owner);
      return;
    }
    tabState.set('prompt-owner', owner);
    tabState.set('prompt-clicks', [...clicks, Date.now()]);
    lastPromptClick = Date.now();
    log('full-page SSO prompt: continuing');
    button.click();
  } finally {
    promptPending = false;
  }
}

// GitHub's modal only finishes when the sign-in popup calls window.external.ssoComplete on its opener, which a renewal tab is not.
async function continueModal(form) {
  log('SSO modal: renewing the session');
  const result = (await renewSession()) ?? (await renewSession({ foreground: true }));
  modalCooldownUntil = Date.now() + (result ? MODAL_COOLDOWN_MS : RETRY_AFTER_FAILURE_MS);
  if (!result) return;
  const page = window.wrappedJSObject;
  page.external.ssoComplete(cloneInto({ error: null, expiresAround: String(result.expires) }, page));
  form.closest('.sso-modal').querySelector('.sso-prompt-success button[data-close-dialog]').click();
}

function describeSession(nextRenewalMs) {
  const lock = shared.get('lock');
  const error = shared.get('last-error');
  if (busy || (lock?.until > Date.now() && lock.owner.endsWith(':renewal'))) return ['renewing', 'Renewing the session in the background…'];
  if (error) return ['warning', `The last renewal failed: ${error.message}. Next try at ${clock(shared.get('retry-at', 0))}.`];
  if (Date.now() - shared.get('activity', 0) > ACTIVE_WITHIN_MS) return ['warning', 'Auto-renewal is paused until you use GitHub again.'];
  return ['ok', `Auto-renewal is on. Next renewal at ${clock(nextRenewalMs)}.`];
}

let publishedStatus = '';

function publishStatus() {
  const { expires } = knownSession();
  if (!expires || isRenewalTab()) return;
  const endsAt = expires + GRACE_AFTER_EXPIRY_S;
  const [state, summary] = describeSession((expires - RENEW_BEFORE_EXPIRY_S) * 1000);
  const lastRenewal = shared.get('renewal-result');
  const status = {
    state,
    endsAt,
    details: [summary, `Session ends at ${clock(endsAt * 1000)}`, ...(lastRenewal && !lastRenewal.error ? [`Last renewal: ${clock(lastRenewal.time)}`] : [])],
    log: shared.get('log', []),
  };
  const serialized = JSON.stringify(status);
  if (serialized === publishedStatus) return;
  publishedStatus = serialized;
  browser.storage.local.set({ status });
}

browser.runtime.onMessage.addListener((message) => {
  if (isRenewalTab()) return undefined;
  if (message.type === 'renewal-failed') {
    shared.set('renewal-result', { time: Date.now(), expires: 0, error: message.reason });
  } else if (message.type === 'renew-now') {
    exclusively(() => renewSession());
    return Promise.resolve(true);
  }
  return undefined;
});

function check() {
  if (isRenewalTab()) return stepRenewalTab();
  releasePromptLock();
  const promptForm = document.querySelector(PROMPT_FORM);
  if (promptForm && document.body?.classList.contains('logged-in')) return continuePrompt(promptForm);
  const modalForm = document.querySelector(MODAL_FORM);
  if (modalForm) {
    if (!busy && Date.now() >= modalCooldownUntil) return exclusively(() => continueModal(modalForm));
    return undefined;
  }
  return renewProactively();
}

async function run() {
  lastRun = Date.now();
  try {
    await check();
  } catch (error) {
    console.error(`[${NAMESPACE}]`, error);
  }
}

function noteActivity() {
  if (Date.now() - lastActivityWrite < ACTIVITY_WRITE_MS) return;
  lastActivityWrite = Date.now();
  shared.set('activity', lastActivityWrite);
}

for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll']) {
  window.addEventListener(type, noteActivity, { capture: true, passive: true });
}

let checkScheduled = false;
new MutationObserver(() => {
  // Landing and prompt pages must be handled right when their markup arrives: GitHub's own scripts redirect away from them,
  // and timers in background tabs are delayed by a second or more. So run at once and only defer a burst of mutations.
  const wait = lastRun + CHECK_THROTTLE_MS - Date.now();
  if (wait <= 0) {
    run();
  } else if (!checkScheduled) {
    checkScheduled = true;
    setTimeout(() => {
      checkScheduled = false;
      run();
    }, wait);
  }
}).observe(document, { childList: true, subtree: true });

setInterval(() => {
  run();
  publishStatus();
}, 1000);
run();
