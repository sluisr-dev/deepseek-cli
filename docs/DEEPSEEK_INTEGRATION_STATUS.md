# DeepSeek Native Integration Status

This document summarizes the progress of adding native DeepSeek API support to the Gemini CLI.

## Changes Implemented

### 1. Core Authentication & Configuration
- **File**: `packages/core/src/core/contentGenerator.ts`
    - Added `AuthType.USE_DEEPSEEK = 'deepseek-api-key'`.
    - Updated `getAuthTypeFromEnv` to detect `DEEPSEEK_API_KEY`.
    - Updated `createContentGenerator` to instantiate `DeepSeekContentGenerator` when the auth type is detected.
- **File**: `packages/cli/src/config/auth.ts` & `settings.ts`
    - Added environment variable whitelisting for `DEEPSEEK_API_KEY`.
    - Added validation logic for DeepSeek auth.
- **File**: `packages/core/src/config/models.ts`
    - Defined `DEEPSEEK_CHAT_MODEL` ('deepseek-chat') and `DEEPSEEK_REASONER_MODEL` ('deepseek-reasoner').

### 2. DeepSeek Bridge Implementation
- **File**: `packages/core/src/core/deepseekContentGenerator.ts` [NEW]
    - Implemented `ContentGenerator` interface.
    - **Mapping**: Converts Google GenAI `GenerateContentParameters` to DeepSeek/OpenAI format.
    - **System Instructions**: Correctky maps system instructions to the 'system' role.
    - **Streaming**: Implemented a manual SSE (Server-Sent Events) parser using `fetch` and `ReadableStream` to support real-time responses in the CLI interface.

## Current Status & Issues

### The "Model Not Exist" Bug (HTTP 400)
When running the CLI with `DEEPSEEK_API_KEY`, the execution fails during the **Routing** phase.

**Root Cause**:
The CLI uses an internal `ModelRouterService` with strategies like `NumericalClassifierStrategy`. This strategy attempts to call `generateContent` or `generateJson` to "classify" the query. However, it defaults to using Gemini models (e.g., `gemini-2.5-pro`) for these internal classification tasks. 

Since the `ContentGenerator` is now `DeepSeekContentGenerator`, it sends the request to `api.deepseek.com` with `model: "gemini-2.5-pro"`, which DeepSeek rejects with:
`{"error":{"message":"Model Not Exist","type":"invalid_request_error"...}}`

### Next Steps for the Next AI:
1.  **Fix Routing**: Modify `packages/core/src/routing/modelRouterService.ts` or the individual strategies to:
    - Check the `authType`.
    - If using DeepSeek, bypass the `NumericalClassifierStrategy` or force it to use `deepseek-chat` instead of a Gemini model.
2.  **Global Model Settings**: Ensure that if the user doesn't specify a model via `--model`, it defaults to `deepseek-chat` when `DEEPSEEK_API_KEY` is present.
3.  **Request Mapping**: Expand `DeepSeekContentGenerator.mapGoogleToDeepSeek` to support parameters like `temperature`, `topP`, and `maxOutputTokens` from the `request.config`.

## Verification Command
```bash
DEEPSEEK_API_KEY=your_key GEMINI_DEBUG=true node packages/cli/dist/index.js --prompt "Hola"
```
