# Release

How a merge to main reaches the browser stores, and what the stores impose.

## Every release submits the extension to both stores

**Id:** ad902de2-b68f-4003-ad57-52541106c6b2
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** conversation 2026-11-22

Every merge to `main` releases, and each release builds the extension once and submits that zip to the Chrome Web Store and addons.mozilla.org, besides attaching it to the GitHub release.

**Reason:** The stores are how users get the extension, and releasing every merge is the rule of all the maintainer's public repositories, so the former filter that released only on changes under `src/` is gone.

**Consequence:** Every merged pull request, an automerged dependency update included, is a store submission, and each store listing must exist before the first upload, because the publishing CLI only submits new versions.

## A Chrome upload refused while a version is in review only warns

**Id:** 76195e6a-069c-4e32-96b1-47a96f69942c
**Type:** workaround
**Status:** active
**Evidence:** inferred
**Source:** release workflow 2026-11-22

The store job treats the Chrome Web Store's `NOT_UPDATEABLE` answer as a warning instead of a failure.

**Reason:** The Chrome Web Store refuses an upload while the previous version is still in review, and the next release carries the change anyway. The reason comes from the release workflow's own comment.

**Consequence:** A version can be skipped on Chrome, so the Chrome listing may lag behind addons.mozilla.org until the next release.

## The release line restarted at 1.0.0

**Id:** 98b76c81-7693-45d3-98a3-3a79c1da888d
**Type:** decision
**Status:** active
**Evidence:** confirmed
**Source:** conversation 2026-11-22

The releases and tags `v0.2.0` to `v0.2.5` were deleted on 2026-11-22, and the next release, from a breaking pull request title, was 1.0.0 above the remaining `v0.1.2`.

**Reason:** Their immutable tags pinned commits whose author addresses had to leave the public history, and both stores had already published 0.2.5 and accept only higher versions, while the deleted tag names can never be used again.

**Rejected alternative:** A patch release 0.1.3, which the stores would refuse.

**Rejected alternative:** A minor release 0.2.0, whose tag name can never be used again.
