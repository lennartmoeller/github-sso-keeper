(() => {
  if (new URLSearchParams(location.search).get('redirect_uri') !== 'https://github.com/auth/oidc/callback') return;

  const CLICKS_KEY = 'github-sso-keeper:clicks';
  const ACCOUNT_TILE = '#tilesHolder [data-test-id][role="button"]:not([data-test-id$="-menu-dots"])';
  const MAX_CLICKS = 3;
  const CLICK_WINDOW_MS = 2 * 60 * 1000;
  const CLICK_GAP_MS = 3 * 1000;
  let reported = false;

  // Without a click on this page Entra waits forever, which stalls a background renewal.
  setInterval(async () => {
    const tiles = [...document.querySelectorAll(ACCOUNT_TILE)];
    if (tiles.length === 0) return;
    const { account = '' } = await browser.storage.local.get('account');
    const tile = tiles.find((candidate) => candidate.dataset.testId.toLowerCase() === account.toLowerCase());
    if (!tile) {
      if (!reported) {
        reported = true;
        const reason = account ? `Microsoft's account picker does not list ${account}` : "Microsoft asks which account to use: enter your sign-in name in the extension's popup";
        browser.runtime.sendMessage({ type: 'account-missing', reason });
      }
      return;
    }
    const clicks = JSON.parse(sessionStorage.getItem(CLICKS_KEY) ?? '[]').filter((time) => Date.now() - time < CLICK_WINDOW_MS);
    if (clicks.length >= MAX_CLICKS || Date.now() - (clicks.at(-1) ?? 0) < CLICK_GAP_MS) return;
    sessionStorage.setItem(CLICKS_KEY, JSON.stringify([...clicks, Date.now()]));
    tile.click();
  }, 250);
})();
