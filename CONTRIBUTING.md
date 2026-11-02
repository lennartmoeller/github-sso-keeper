# Contributing

## Set up

Install Node.js and run `npm install` in the repository root.

## Run the extension

`npm start` opens a temporary Firefox with the extension from `src/`.

## Check a change

`npm run check` runs ESLint and `web-ext lint`.
Run it at the end of every implementation change, because it fails on unused symbols and unreachable code.

## Sign the extension

Release Firefox runs only signed extensions permanently, and Mozilla signs unlisted ones for free.

1. Raise `version` in `src/manifest.json`, because Mozilla rejects a version it has already signed.
2. Create API credentials at [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/) and export them as `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`.
3. Run `npm run sign`, which writes the signed `.xpi` to `web-ext-artifacts/`.
4. Open the `.xpi` in Firefox to install it.

Firefox updates an unlisted extension only when its manifest has an `update_url`, so install each new version by hand.
