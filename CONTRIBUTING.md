# Contributing

## Setup

Install [mise](https://mise.jdx.dev/getting-started.html), then run `mise trust` and `mise install`.

## Run locally

Run `npm start` to load the extension into a temporary Firefox profile.

## Check

Run `mise run check`, which CI runs as the `Quality` check on every pull request.

## Release

Title pull requests as [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), whose types set the [next version](https://github.com/lennartmoeller/release-from-conventional-commits#how-the-version-is-calculated).
Run the `Release` workflow on `main` to release it.
A release also submits the extension to the Chrome Web Store and addons.mozilla.org.
