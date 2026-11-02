const byId = (id) => document.getElementById(id);
const NOTE_MS = 1500;

const NO_DATA = { headline: 'No data yet', details: ['Open a GitHub tab.'] };

function render(view = NO_DATA) {
  document.documentElement.style.setProperty('--state', view.color ?? '');
  byId('headline').textContent = view.headline;
  byId('details').textContent = view.details.join('\n');
}

function renderAccountHint() {
  const isSet = byId('account').value.trim() !== '';
  byId('account-hint').textContent = isSet ? 'Chosen when Microsoft asks which account to use.' : 'Not set: a renewal fails when Microsoft asks which account to use.';
  byId('account-hint').classList.toggle('warning', !isSet);
}

byId('renew').addEventListener('click', async () => {
  for (const tab of await browser.tabs.query({ url: 'https://github.com/*', discarded: false })) {
    // A tab that has no content script yet rejects the message.
    const handled = await browser.tabs.sendMessage(tab.id, { type: 'renew-now' }).catch(() => false);
    if (handled) return;
  }
  byId('note').textContent = 'Open or reload a GitHub tab first.';
});

byId('copy-log').addEventListener('click', async () => {
  const { status, view } = await browser.storage.local.get(['status', 'view']);
  const lines = (status?.log ?? []).map(([time, id, path, message]) => `${new Date(time).toLocaleTimeString()} [${id}] ${path} | ${message}`);
  const { headline, details } = view ?? NO_DATA;
  const text = [`GitHub SSO Keeper ${browser.runtime.getManifest().version}`, headline, ...details, '', ...lines].join('\n');
  const copied = await navigator.clipboard.writeText(text).then(() => true, () => false);
  byId('copy-log').classList.toggle('done', copied);
  if (!copied) byId('note').textContent = 'Could not copy the event log.';
  setTimeout(() => {
    byId('copy-log').classList.remove('done');
    byId('note').textContent = '';
  }, NOTE_MS);
});

byId('account').addEventListener('input', (event) => {
  browser.storage.local.set({ account: event.target.value.trim() });
  renderAccountHint();
});
browser.storage.onChanged.addListener((changes) => {
  if (changes.view) render(changes.view.newValue);
});
browser.storage.local.get(['view', 'account']).then(({ view, account }) => {
  render(view);
  byId('account').value = account ?? '';
  renderAccountHint();
});
