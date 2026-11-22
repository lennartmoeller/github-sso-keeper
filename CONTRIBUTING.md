# Contributing

## Local setup

1. Install [mise](https://mise.jdx.dev/getting-started.html).
2. Run `mise trust` and `mise install` in the repository root to install every tool in the version [`mise.toml`](./mise.toml) pins.

## Try a change

Run `npm start` to load the extension from [`src/`](./src/) into a temporary Firefox profile.

## Check a change

Run `mise run check`, the quality gate that CI runs as the required `Quality` check on every pull request.

## Release

Every merge to `main` releases a new version, computed by [`next-version`](https://github.com/lennartmoeller/next-version) from the pull request title in [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) form: `!` before the colon bumps the major version, `feat` the minor version, and every other type the patch version.
The release writes that version into [`src/manifest.json`](./src/manifest.json) and submits the extension to the Chrome Web Store and addons.mozilla.org.
