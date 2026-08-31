# Agent Note: Independent desktop product repository with an official mirror branch

Status: implemented
Archived: 2026-08-30

English | [中文](2026-08-27-independent-desktop-repository.zh.md)

## Problem

The customized desktop app lived in a GitHub fork, so the product branch and the upstream repository were coupled under one fork identity. That made the product repository's release assets, branch history, and upstream synchronization intent unclear.

## Decision

The product is maintained in the independent public repository [`henryopencode/deepseek-harness-desktop`](https://github.com/henryopencode/deepseek-harness-desktop). Its `master` branch contains the customized desktop product and release configuration. Its `official` branch mirrors `deepseek-ai/deepseek-harness:master`; it is refreshed from the `upstream` remote and is not edited directly. The local `origin` remote points to the independent repository, while `upstream` points to the official repository and `legacy-fork` retains the former fork as a reference.

The synchronization and packaging procedures live in [`DESKTOP_REPOSITORY.md`](../../../../DESKTOP_REPOSITORY.md). Official changes are fetched into `official`, reviewed, merged into `master`, tested, and pushed to `origin/master`. Desktop release artifacts are built on their target operating system and published only after the focused package, build, and documentation checks pass.

## Alternatives considered

**Keep using the existing fork as the product repository.** Rejected because GitHub presents the fork relationship as the repository identity, and release or branch maintenance remains mixed with upstream ownership even when local remotes are renamed.

**Copy the source into a new repository without an official branch.** Rejected because future upstream updates would require an ad hoc comparison or a second clone, with no durable branch that records the exact official source state.

**Automatically merge upstream into `master`.** Rejected because desktop packaging, native runtimes, and product UI changes need conflict review and platform checks before they become a release candidate.

## Consequences

The product repository has an explicit upstream synchronization point and a stable home for its release assets. Updating `official` uses a force-with-lease mirror push, while product work remains ordinary commits on `master`. The independent repository does not receive upstream updates automatically; maintainers must run the documented fetch, review, merge, and verification sequence.
