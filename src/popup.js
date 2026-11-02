const byId = (id) => document.getElementById(id);

async function renderStatus() {
  const { status } = await browser.storage.local.get('status');
  const [[red, green, blue], title] = await Promise.all([browser.action.getBadgeBackgroundColor({}), browser.action.getTitle({})]);
  byId('dot').style.background = status ? `rgb(${red}, ${green}, ${blue})` : 'gray';
  byId('details').textContent = status ? title : 'No data yet. Open a GitHub tab.';
  byId('log').textContent = [...(status?.log ?? [])]
    .reverse()
    .map(([time, id, path, message]) => `${new Date(time).toLocaleTimeString()} [${id}] ${path} | ${message}`)
    .join('\n');
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
    if (handled) {
      window.close();
      return;
    }
  }
  byId('note').textContent = 'Open or reload a GitHub tab first.';
});

byId('account').addEventListener('input', (event) => {
  browser.storage.local.set({ account: event.target.value.trim() });
  renderAccountHint();
});
browser.storage.onChanged.addListener((changes) => {
  if (changes.status) renderStatus();
});
browser.storage.local.get('account').then(({ account }) => {
  byId('account').value = account ?? '';
  renderAccountHint();
});
renderStatus();
