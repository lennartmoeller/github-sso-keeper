const byId = (id) => document.getElementById(id);

async function render() {
  const { status } = await browser.storage.local.get('status');
  const [[red, green, blue], title] = await Promise.all([browser.action.getBadgeBackgroundColor({}), browser.action.getTitle({})]);
  byId('dot').style.background = status ? `rgb(${red}, ${green}, ${blue})` : 'gray';
  byId('details').textContent = status ? title : 'No data yet. Open a GitHub tab.';
  byId('log').textContent = (status?.log ?? [])
    .map(([time, id, path, message]) => `${new Date(time).toLocaleTimeString()} [${id}] ${path} | ${message}`)
    .join('\n');
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

byId('account').addEventListener('input', (event) => browser.storage.local.set({ account: event.target.value.trim() }));
browser.storage.local.get('account').then(({ account }) => {
  byId('account').value = account ?? '';
});
browser.storage.onChanged.addListener((changes) => {
  if (changes.status) render();
});
render();
