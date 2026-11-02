// GitHub's SSO modal can only be finished from the page's own world, which content scripts do not share.
window.addEventListener('message', (event) => {
  if (event.source !== window || event.data?.source !== 'github-sso-keeper') return;
  window.external.ssoComplete({ error: event.data.error, expiresAround: event.data.expiresAround });
});
