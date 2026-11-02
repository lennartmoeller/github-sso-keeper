const COLORS = { ok: '#1a7f37', renewing: '#0969da', warning: '#9a6700', expired: '#d1242f' };
const EXPIRED_DETAIL = 'The session has expired. The next GitHub page load shows the SSO prompt, which is clicked for you.';

async function renderAction() {
  const { status } = await browser.storage.local.get('status');
  if (!status) return;
  const secondsLeft = status.endsAt - Math.floor(Date.now() / 1000);
  const expired = secondsLeft <= 0;
  const minutes = Math.floor(secondsLeft / 60);
  await Promise.all([
    browser.action.setBadgeText({ text: expired ? '!' : String(minutes) }),
    browser.action.setBadgeBackgroundColor({ color: COLORS[expired ? 'expired' : status.state] }),
    browser.action.setTitle({
      title: [`GitHub SSO Keeper: ${expired ? 'session expired' : `${minutes} min left`}`, ...(expired ? [EXPIRED_DETAIL] : status.details)].join('\n'),
    }),
  ]);
}

browser.storage.onChanged.addListener((changes) => {
  if (changes.status) renderAction();
});
browser.alarms.onAlarm.addListener(renderAction);
browser.alarms.get('tick').then((alarm) => alarm ?? browser.alarms.create('tick', { periodInMinutes: 1 }));
renderAction();

// Content scripts cannot manage tabs, so they ask for it.
browser.runtime.onMessage.addListener((message, sender) => {
  switch (message.type) {
    case 'open-tab': {
      const url = new URL(message.url);
      if (url.origin !== 'https://github.com') throw new Error(`refusing to open ${url.origin}`);
      return browser.tabs.create({ url: url.href, active: message.active }).then((tab) => tab.id);
    }
    case 'close-tab':
      return browser.tabs.remove(message.tabId).catch(() => {});
    case 'close-this-tab':
      return browser.tabs.remove(sender.tab.id);
    default:
      throw new Error(`unknown message ${message.type}`);
  }
});
