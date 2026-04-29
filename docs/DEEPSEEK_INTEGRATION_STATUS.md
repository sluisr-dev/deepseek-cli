# DeepSeek Native Integration — Status

Last updated: 2026-04-29 (v1.1.0)

This document tracks the state of the native DeepSeek API integration in
DeepSeek CLI. See [`changelogs/v1.1.0-deepseek.md`](./changelogs/v1.1.0-deepseek.md)
for the full release notes of the latest stabilization.

## Status: stable

The DeepSeek v4 API path (chat + thinking mode + tool calling + streaming) is
production-ready as of `v1.1.0`. All blocking bugs from previous status reports
have been resolved.

## Architecture

### Auth & configuration

- `packages/core/src/core/contentGenerator.ts`
    - `AuthType.USE_DEEPSEEK = 'deepseek-api-key'`.
    - `getAuthTypeFromEnv` detects `DEEPSEEK_API_KEY`.
    - `createContentGenerator` instantiates `DeepSeekContentGenerator` when the
      DeepSeek auth type is selected.
- `packages/cli/src/config/auth.ts`, `settings.ts`
    - `DEEPSEEK_API_KEY` is whitelisted as a CLI environment variable.
    - DeepSeek auth validation.
- `packages/core/src/config/models.ts`
    - `DEEPSEEK_CHAT_MODEL = 'deepseek-chat'`,
      `DEEPSEEK_REASONER_MODEL = 'deepseek-reasoner'`.
    - DeepSeek v4 model identifiers used by the router
      (`deepseek-v4-flash`, `deepseek-v4-pro`).

### Bridge: `DeepSeekContentGenerator`

File: `packages/core/src/core/deepseekContentGenerator.ts`.

- Implements the `ContentGenerator` interface.
- Maps Google GenAI `GenerateContentParameters` ↔ DeepSeek/OpenAI chat format
  (`mapGoogleToDeepSeek`, `mapDeepSeekToGoogle`).
- System instructions go to the `system` role.
- Streaming via a hand-rolled SSE parser over `fetch` + `ReadableStream`.
- `stream_options.include_usage: true` so the final chunk carries token usage
  (`prompt_tokens`, `completion_tokens`, `prompt_cache_hit_tokens`).
- `prompt_cache_hit_tokens` is surfaced as Gemini-shaped
  `cachedContentTokenCount`.
- Tools are sent in stable alphabetical order to maximize DeepSeek's prompt
  cache hit rate.
- Cache and debug logs live under `~/.deepseek/`.
- Verbose logging is gated by the `DEEPSEEK_DEBUG` environment variable.

### `reasoning_content` handling

DeepSeek v4 thinking mode requires every assistant turn that used reasoning to
be replayed on the next request with its `reasoning_content` attached.
Otherwise the API returns `400 invalid_request_error`.

The bridge handles this with two cooperating mechanisms:

1. **Stable cache key.** `getMessageKey` normalizes message identity so that
   `tool_calls: undefined` and `tool_calls: []` produce the same key. The
   reasoning content is cached in `~/.deepseek/` keyed by this normalized
   identity.
2. **In-history smuggling.** When mapping an assistant message back to the
   DeepSeek wire format, `reasoning_content` is also embedded inside a hidden
   `Part` on the assistant turn. This survives the Gemini-style history filter
   that would otherwise strip any non-text fields. On the next turn the field
   is detached from the part and re-emitted at the top level of the message.

A regression test for the cache key lives in
`packages/core/src/core/deepseekContentGenerator.test.ts`.

### Routing

File: `packages/core/src/routing/strategies/deepseekClassifierStrategy.ts`.

- Calls a small DeepSeek classification request to score query complexity, then
  routes to `deepseek-v4-flash` or `deepseek-v4-pro`.
- Complexity threshold: **70** (raised from 50 in v1.1.0).
- Classification requests are sent **without** thinking mode — classification
  does not benefit from chain-of-thought, and disabling it saves tokens and
  latency.

### `exit_plan_mode`

Files:
- `packages/core/src/tools/exit-plan-mode.ts`
- `packages/core/src/tools/definitions/dynamic-declaration-helpers.ts`

The tool accepts an optional `plan_content` argument. When provided, it writes
the plan inside the validated plans directory before approval, so a model can
exit plan mode in a single tool call without a pre-existing file.

## Resolved issues

### "Model Not Exist" (HTTP 400) — RESOLVED

Routing strategies used to default to Gemini model identifiers (e.g.
`gemini-2.5-pro`) for internal classification, which DeepSeek rejected.
`DeepSeekClassifierStrategy` now uses DeepSeek model identifiers and bypasses
the Gemini-specific strategies when `AuthType.USE_DEEPSEEK` is active.

### Missing `reasoning_content` on follow-up turns (HTTP 400) — RESOLVED

See **`reasoning_content` handling** above. Fixed in v1.1.0 by cache key
normalization plus history smuggling.

### "Invalid plan" on `exit_plan_mode` approval — RESOLVED

Fixed in v1.1.0 by accepting inline `plan_content` and materializing the file
before validation.

### Path duplication from `GEMINI_CLI_HOME` — RESOLVED

Cache and logs now resolve under `~/.deepseek/` independent of any legacy
`GEMINI_CLI_HOME` override.

## Verification

```bash
# Basic
DEEPSEEK_API_KEY=sk-... deepseek --prompt "Hola"

# With reasoning + debug logs
DEEPSEEK_API_KEY=sk-... DEEPSEEK_DEBUG=1 deepseek \
  --prompt "Design a thread-safe LRU cache in Rust and explain the trade-offs."
```

Build:

```bash
npm run build:packages && npm run bundle
```

Tests:

```bash
npx tsc --noEmit -p packages/cli/tsconfig.json
npx vitest run \
  packages/cli/src/ui/components/SessionSummaryDisplay.test.tsx \
  packages/cli/src/commands/extensions/update.test.ts \
  packages/core/src/core/deepseekContentGenerator.test.ts
```
