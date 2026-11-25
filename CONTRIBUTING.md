# Contributing

## Local setup

1. Install [mise](https://mise.jdx.dev/getting-started.html).
2. Run `mise trust` and `mise install` in the repository root to install every tool in the version [`mise.toml`](./mise.toml) pins.

## Try a change

Run `npm start` to load the extension from [`src/`](./src/) into a temporary Firefox profile.

## Check a change

Run `mise run check`, the quality gate that CI runs as the required `Quality` check on every pull request.

## Release

A manual run of the `Release` workflow on `main` runs [`release-from-conventional-commits`](https://github.com/lennartmoeller/release-from-conventional-commits) action to release a new version.
