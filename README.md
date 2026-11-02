# GitHub SSO Keeper

Keeps your GitHub Enterprise SSO session alive: renews it in the background and auto-clicks SSO prompts.
Unofficial Firefox extension for GitHub Enterprise Cloud with OIDC single sign-on, built against Microsoft Entra ID and not affiliated with GitHub or Microsoft.

## Features

- Renews the SSO session in a background tab 5 minutes before it ends, while you are active on GitHub.
- Continues the full-page SSO prompt and GitHub's in-page "session expired" modal.
- Picks your account on Microsoft's "Pick an account" page.
- Shows the remaining session time on the [toolbar icon](#toolbar-icon).

## Toolbar icon

The icon's badge shows the minutes until the session ends, on every tab.
Its color is green when auto-renewal is healthy, blue while renewing, yellow when paused or the last renewal failed, and red with an exclamation mark when the session expired.
Hover it for details, including the reason of a failed renewal.
Click it to open the popup with the status, the Microsoft account setting and two icon buttons.
The circular arrows renew right away in a visible tab, and the clipboard copies the event log for a bug report.

## Install

Firefox 140 or newer is required.
Release Firefox loads unsigned extensions only temporarily: open `about:debugging#/runtime/this-firefox`, choose *Load Temporary Add-on* and pick `src/manifest.json`.
The temporary add-on disappears when Firefox restarts, so [sign it](./CONTRIBUTING.md#sign-the-extension) for a permanent install.
Allow access to `github.com` and Microsoft's login page when Firefox asks.

## Choose the Microsoft account

If several accounts are signed in, Microsoft shows "Pick an account" and waits for a click.
Enter your sign-in name from that page, for example `name@company.com`, in the *Microsoft account* field of the popup.
The extension clicks that account from then on.
Without a matching account, a background renewal fails within seconds and the popup states the reason.

## Limits

Renewal needs an open GitHub tab, because the extension runs from it.
It pauses when you have not used GitHub for 45 minutes and resumes with your next activity.
After a longer break, the next GitHub page shows the SSO prompt once, which the extension continues.

## How it works

A renewal submits GitHub's own SSO form in a background tab and waits for the landing page `sso_complete` to confirm it.
Tabs share their state through the `localStorage` of `github.com` and take turns through a lock, because overlapping SSO flows invalidate each other.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
