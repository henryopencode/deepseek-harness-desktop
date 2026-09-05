# Agent Note: Web runtime settings template

Status: implemented

English | [中文](2026-09-05-web-runtime-settings-template.zh.md)

## Problem

The Web runtime release carried the executable and frontend but did not provide the model route configuration needed by a fresh deployment. Users had to reconstruct the provider and model entries manually, including the image capability declarations, while credentials must remain outside the release archive.

## Decision

`apps/cli/config/settings.example.yaml` is the versioned, credential-free model template. It selects `codex-relay/gpt-5.6-sol` by default and declares the `codex-relay` OpenAI Responses route at `https://sub2.neurix.cn` with GPT-5.6 Sol and GPT-5.6 Terra models, both accepting text and image input. The Web packaging script copies the template to the release root and includes the installer helper. A release `install.mjs` creates `$DSH_HOME/settings.yaml` with an exclusive file create after runtime dependencies are ready; an existing file, including an empty file, is preserved. The updater synchronizes the helper and template with the other stable runtime files, while user settings remain outside the archive. The template contains only the `CODEX_RELAY_API_KEY` reference; the credential value is supplied through the Models page, the environment, or the managed credentials store.

## Alternatives considered

**Put the route only in the bundle composition.** Rejected because the route and model catalog are deployment settings that must remain editable and must not require rebuilding the runtime or changing plugin composition.

**Copy the template on every install or update.** Rejected because an update must never replace a user's settings document, and an empty document can be an intentional user choice.

**Ship a real API key in the release.** Rejected because release archives are distributable artifacts and credentials belong to the user's credential store or environment.

## Consequences

Fresh Web runtime installations have an immediately visible model configuration and can authenticate by setting the referenced credential. Existing deployments retain their settings across installation and updates. The template is intentionally specific to this repository's Codex relay route; deployments using another endpoint or model can edit or replace the generated settings document.

## Verification

The settings template test parses the YAML, checks the route, both model modalities, and the absence of credential values. Installer tests verify first creation, repeated installation, and preservation of an existing empty document.
