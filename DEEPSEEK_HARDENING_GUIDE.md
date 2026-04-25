# DeepSeek CLI Hardening: Architecture Guide (Stable Cache Edition)

This documentation details the changes implemented to solve the
`400 Bad Request` error in the **DeepSeek Reasoner** model, caused by the loss
of `reasoning_content` in the conversation history.

## 1. The Root Cause

The Google SDK (the core of this CLI) does not recognize the `reasoning_content`
property. Therefore, when the CLI saves the history or prepares the next turn,
it **strips or ignores** the model's thoughts. DeepSeek strictly requires that
if a message contained thoughts, they **must** be sent back in the history, or
it will reject the request with a 400 error.

## 2. The Solution: Stable Signature Cache

A two-layer cache system was implemented in `DeepSeekContentGenerator.ts`:

### A. Stable Message Signature (`getMessageKey`)

To uniquely identify an assistant message (even if it has lost its metadata), we
generate a key based on:

- **Normalized Text**: Redundant whitespace is removed and text is trimmed.
- **Tool Calls**: Function names and arguments are extracted and sorted
  alphabetically to ensure consistency.

This allows us, when reconstructing the history for the API, to say: _"This text
message matches one we have in cache; let's inject its original reasoning
content"_.

### B. Persistent Disk Storage

The cache is no longer just in memory. It is saved to
`deepseek_reasoning_cache.json` in the project root.

- **Automatic Loading**: When the generator initializes, it loads previous
  thoughts.
- **Atomic Saving**: Every time the model finishes generating a response
  (whether via stream or full block), the disk file is updated.

## 3. Data Flow Improvements

### Robust Streaming

The `generateContentStream` method was modified to accumulate both the final
text (`fullText`) and the reasoning (`fullReasoning`). Upon closing the stream,
the signature for the newly created message is generated and stored in the
persistent cache.

### History Injection (`mapGoogleToDeepSeek`)

Before sending any request to the API, the generator iterates through the
history. For each assistant message (`role: 'model'`), it attempts to recover
the reasoning via:

1. Direct property (if it survived).
2. Parts with `thought` flag (if the Core respected them).
3. **Persistent Cache Lookup** (the definitive protection).

## 4. Modified Files

- `packages/core/src/core/deepseekContentGenerator.ts`: Main logic for cache,
  persistence, and API mapping.
- `deepseek_reasoning_cache.json`: Persistent storage for thoughts (created
  automatically).
- `deepseek_payload_debug.log`: Detailed log of cache hits/saves and payloads
  sent to the API.

---

**Note:** The `deepseek-reasoner` (DeepSeek Pro) model now has tools re-enabled
and is fully stable for long and complex conversations. 🦾🚀🔥
