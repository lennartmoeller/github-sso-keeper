const COLORS = { ok: '#1a7f37', renewing: '#0969da', warning: '#9a6700', expired: '#d1242f' };
const EXPIRED_DETAIL = 'The session has expired. The next GitHub page load shows the SSO prompt, which is clicked for you.';
const RENEWAL_TAB_MAX_AGE_MS = 3 * 60 * 1000;

const renewalTabKey = (tabId) => `renewal-tab:${tabId}`;

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

const closeRenewalTab = (tabId) => browser.tabs.remove(tabId).catch(() => {});

// The page that opened a renewal tab may be gone before it can close the tab, so stale tabs are swept.
async function closeStaleRenewalTabs() {
  for (const [key, tab] of Object.entries(await browser.storage.session.get(null))) {
    if (key.startsWith('renewal-tab:') && Date.now() - tab.openedAt > RENEWAL_TAB_MAX_AGE_MS) closeRenewalTab(Number(key.split(':')[1]));
  }
}

browser.storage.onChanged.addListener((changes) => {
  if (changes.status) renderAction();
});
browser.alarms.onAlarm.addListener(() => {
  renderAction();
  closeStaleRenewalTabs();
});
browser.alarms.get('tick').then((alarm) => alarm ?? browser.alarms.create('tick', { periodInMinutes: 1 }));
browser.tabs.onRemoved.addListener((tabId) => browser.storage.session.remove(renewalTabKey(tabId)));
renderAction();

// Content scripts cannot manage tabs, so they ask for it.
browser.runtime.onMessage.addListener(async (message, sender) => {
  switch (message.type) {
    case 'open-tab': {
      const url = new URL(message.url);
      if (url.origin !== 'https://github.com') throw new Error(`refusing to open ${url.origin}`);
      const tab = await browser.tabs.create({ url: url.href, active: message.active });
      await browser.storage.session.set({ [renewalTabKey(tab.id)]: { opener: sender.tab.id, foreground: message.active, openedAt: Date.now() } });
      return tab.id;
    }
    case 'close-tab':
      return closeRenewalTab(message.tabId);
    case 'close-this-tab':
      return closeRenewalTab(sender.tab.id);
    case 'account-missing': {
      const key = renewalTabKey(sender.tab.id);
      const tab = (await browser.storage.session.get(key))[key];
      // A visible renewal leaves the choice to the user.
      if (!tab || tab.foreground) return undefined;
      await browser.tabs.sendMessage(tab.opener, { type: 'renewal-failed', reason: message.reason }).catch(() => {});
      return closeRenewalTab(sender.tab.id);
    }
    default:
      throw new Error(`unknown message ${message.type}`);
  }
});
