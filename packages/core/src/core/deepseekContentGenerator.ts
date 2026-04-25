/**
 * @license
 * Copyright 2025 Google LLC
 * Copyright 2025 sluisr (DeepSeek adaptation)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import type {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
} from '@google/genai';
import type { ContentGenerator } from './contentGenerator.js';
import type { UserTierId, GeminiUserTier } from '../code_assist/types.js';
import { LlmRole } from '../telemetry/llmRole.js';
import { debugLogger } from '../utils/debugLogger.js';

const DEEPSEEK_TOOL_ENFORCEMENT = `

TOOL USAGE RULES (mandatory):
- When the user asks about files, directories, processes, system info, or anything requiring current data, ALWAYS call the appropriate tool first. Never guess or infer from context.
- "Don't read" or "just tell me" means: don't display raw file contents. It does NOT mean skip using tools — use listing/stat tools to get counts, names, sizes, etc.
- If you are unsure whether data exists or what it contains, call a tool. Prefer real data over assumptions every time.
- After receiving tool output, synthesize a concise answer. Do not repeat or dump the raw output unless asked.
- TOOL PREFERENCE ORDER for file/directory tasks: use purpose-built tools first (list_directory, read_file, glob, search_file_content) before resorting to run_shell_command. Only use shell when no specific tool covers the task.
- run_shell_command can access ANY path on the filesystem, not just the current workspace. Never refuse to check a path outside the workspace — just run the shell command.`;

const TOOL_HINTS: Record<string, string> = {
  list_directory:
    ' [PREFERRED for listing directory contents — use this instead of run_shell_command with ls]',
  read_file:
    ' [PREFERRED for reading file contents — use this instead of run_shell_command with cat]',
  write_file:
    ' [PREFERRED for writing files — use this instead of run_shell_command with echo/tee]',
  glob: ' [PREFERRED for finding files by pattern — use this instead of run_shell_command with find]',
  search_file_content:
    ' [PREFERRED for searching text in files — use this instead of run_shell_command with grep]',
  run_shell_command:
    ' [USE ONLY when no other specific tool covers the task — prefer list_directory, read_file, glob, or search_file_content first]',
};

function enrichToolDescription(name: string, description: string): string {
  return description + (TOOL_HINTS[name] ?? '');
}

export class DeepSeekContentGenerator implements ContentGenerator {
  userTier?: UserTierId;
  userTierName?: string;
  paidTier?: GeminiUserTier;

  // Cache to persist reasoning between conversation turns
  private static readonly reasoningCache = new Map<string, string>();
  private static cacheLoaded = false;
  private static readonly CACHE_FILE = path.join(
    process.cwd(),
    'deepseek_reasoning_cache.json',
  );

  private static loadCache() {
    if (this.cacheLoaded) return;
    try {
      if (fs.existsSync(this.CACHE_FILE)) {
        const data = JSON.parse(fs.readFileSync(this.CACHE_FILE, 'utf-8'));
        for (const [k, v] of Object.entries(data)) {
          this.reasoningCache.set(k, v as string);
        }
        fs.appendFileSync(
          'deepseek_payload_debug.log',
          `[CACHE] Cargadas ${this.reasoningCache.size} entradas desde disco.\n`,
        );
      }
    } catch (e) {
      // Ignore loading errors
    }
    this.cacheLoaded = true;
  }

  private static saveCache() {
    try {
      const data = Object.fromEntries(this.reasoningCache);
      fs.writeFileSync(this.CACHE_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
      // Ignore saving errors
    }
  }

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = 'https://api.deepseek.com',
  ) {
    DeepSeekContentGenerator.loadCache();
  }

  private resolveDeepSeekModel(model?: string): string {
    if (model && model.startsWith('deepseek-')) {
      return model;
    }
    return 'deepseek-chat';
  }

  /**
   * Generates a stable message signature for the cache.
   * Ignores thoughts (since the CLI core strips them) but includes text and tools.
   */
  private getMessageKey(text: string, tool_calls?: any[]): string {
    const cleanText = text.trim().replace(/\s+/g, ' ');

    const calls = tool_calls
      ?.map((tc: any) => ({
        name: tc.name || tc.function?.name,
        args:
          typeof (tc.args || tc.function?.arguments) === 'string'
            ? tc.args || tc.function?.arguments
            : JSON.stringify(tc.args || tc.function?.arguments || {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return JSON.stringify({ text: cleanText, calls });
  }

  private mapGoogleToDeepSeek(request: GenerateContentParameters): any {
    const messages: any[] = [];

    // Map system instruction if present
    if (request.config?.systemInstruction) {
      const systemInstruction = request.config.systemInstruction;
      let systemText = '';
      if (typeof systemInstruction === 'string') {
        systemText = systemInstruction;
      } else if (
        systemInstruction &&
        'parts' in systemInstruction &&
        (systemInstruction as any).parts
      ) {
        systemText = (systemInstruction as any).parts
          .map((p: any) => p.text || '')
          .join('');
      } else if (Array.isArray(systemInstruction)) {
        systemText = systemInstruction.map((p: any) => p.text || '').join('');
      } else if (systemInstruction && 'text' in (systemInstruction as any)) {
        systemText = (systemInstruction as any).text || '';
      }
      if (systemText) {
        systemText += DEEPSEEK_TOOL_ENFORCEMENT;
        messages.push({ role: 'system', content: systemText });
      } else {
        messages.push({
          role: 'system',
          content: DEEPSEEK_TOOL_ENFORCEMENT.trim(),
        });
      }
    } else {
      messages.push({
        role: 'system',
        content: DEEPSEEK_TOOL_ENFORCEMENT.trim(),
      });
    }

    // Map contents (conversation history including tool calls)
    if (request.contents) {
      const contents = Array.isArray(request.contents)
        ? request.contents
        : [request.contents];
      let toolCallCounter = 0;
      // Ordered list of pending (unmatched) tool calls; matched by name in FIFO order
      const pendingCalls: Array<{ name: string; id: string }> = [];

      for (const content of contents as any[]) {
        const parts: any[] = content.parts ?? [];
        const role = content.role;

        if (role === 'model') {
          const fnCallParts = parts.filter((p: any) => p.functionCall);
          const thoughtParts = parts.filter(
            (p: any) => p.thought || p.type === 'thought',
          );
          const textParts = parts.filter(
            (p: any) => p.text && !p.thought && p.type !== 'thought',
          );

          // Triple-Check recovery strategy with Stable Signature:
          // 1. Direct property (if it survived)
          // 2. Parts with thought flag (if the Core respected them)
          // 3. GLOBAL CACHE with Stable Signature (our definitive protection)
          const assistantText =
            textParts.map((p: any) => p.text).join('') || '';
          const tool_calls = fnCallParts.map((p: any) => ({
            name: p.functionCall.name,
            args: p.functionCall.args,
          }));

          DeepSeekContentGenerator.loadCache();
          const messageKey = this.getMessageKey(assistantText, tool_calls);
          const cachedReasoning =
            DeepSeekContentGenerator.reasoningCache.get(messageKey);

          if (cachedReasoning) {
            fs.appendFileSync(
              'deepseek_payload_debug.log',
              `[CACHE HIT] Recovered for: ${assistantText.substring(0, 30)}... (Key: ${messageKey.substring(0, 50)})\n`,
            );
          }

          const reasoning_content =
            content.reasoning_content ||
            thoughtParts
              .map((p: any) => {
                if (typeof p.thought === 'string') return p.thought;
                if (p.thought === true) return p.text || '';
                if (p.type === 'thought') return p.thought || p.text || '';
                return '';
              })
              .join('') ||
            cachedReasoning ||
            undefined;

          const assistantMessage: any = {
            role: 'assistant',
            content: assistantText || '',
          };

          if (reasoning_content) {
            assistantMessage.reasoning_content = reasoning_content;
          }

          if (fnCallParts.length > 0) {
            assistantMessage.tool_calls = fnCallParts.map((p: any) => {
              const id = `call_${toolCallCounter++}`;
              pendingCalls.push({ name: p.functionCall.name, id });
              return {
                id,
                type: 'function',
                function: {
                  name: p.functionCall.name,
                  arguments: JSON.stringify(p.functionCall.args ?? {}),
                },
              };
            });
          }
          messages.push(assistantMessage);
        } else {
          const fnRespParts = parts.filter((p: any) => p.functionResponse);
          const textParts = parts.filter((p: any) => p.text);

          if (fnRespParts.length > 0) {
            for (const p of fnRespParts) {
              const fnName = p.functionResponse.name;
              // Match the first pending call with this name (FIFO)
              const matchIdx = pendingCalls.findIndex((c) => c.name === fnName);
              const toolCallId =
                matchIdx >= 0
                  ? pendingCalls.splice(matchIdx, 1)[0].id
                  : `call_fb_${fnName}`;
              const respContent =
                typeof p.functionResponse.response === 'string'
                  ? p.functionResponse.response
                  : JSON.stringify(p.functionResponse.response ?? {});
              messages.push({
                role: 'tool',
                tool_call_id: toolCallId,
                content: respContent,
              });
            }
            if (textParts.length > 0) {
              const text = textParts.map((p: any) => p.text).join('');
              if (text) messages.push({ role: 'user', content: text });
            }
          } else {
            // Before adding a user message, flush any unanswered tool_calls with
            // synthetic cancellation responses so DeepSeek doesn't reject the request.
            for (const pending of pendingCalls.splice(0)) {
              messages.push({
                role: 'tool',
                tool_call_id: pending.id,
                content: 'Tool call was cancelled by the user.',
              });
            }
            messages.push({
              role: 'user',
              content: textParts.map((p: any) => p.text).join(''),
            });
          }
        }
      }

      // Flush any remaining unanswered tool_calls at the end (safety net)
      for (const pending of pendingCalls) {
        messages.push({
          role: 'tool',
          tool_call_id: pending.id,
          content: 'Tool call was cancelled by the user.',
        });
      }
    }

    const body: any = {
      model: this.resolveDeepSeekModel(request.model),
      messages,
      stream: false,
    };

    // Map Gemini tools to OpenAI function-calling format
    const geminiTools = request.config?.tools;

    if (Array.isArray(geminiTools) && geminiTools.length > 0) {
      const openAiTools: any[] = [];
      for (const tool of geminiTools as any[]) {
        for (const decl of tool.functionDeclarations ?? []) {
          openAiTools.push({
            type: 'function',
            function: {
              name: decl.name,
              description: enrichToolDescription(
                decl.name,
                decl.description ?? '',
              ),
              parameters: decl.parameters ?? { type: 'object', properties: {} },
            },
          });
        }
      }
      if (openAiTools.length > 0) {
        body.tools = openAiTools;
      }
    }

    if (request.config?.responseMimeType === 'application/json') {
      body.response_format = { type: 'json_object' };
    }

    if (request.config?.temperature !== undefined) {
      body.temperature = request.config.temperature;
    }

    if (request.config?.topP !== undefined) {
      body.top_p = request.config.topP;
    }

    if (request.config?.maxOutputTokens !== undefined) {
      body.max_tokens = request.config.maxOutputTokens;
    }

    return body;
  }

  private mapDeepSeekToGoogle(deepseekResponse: any): GenerateContentResponse {
    const choice = deepseekResponse.choices[0];
    const message = choice.message;
    const parts: any[] = [];

    // Map reasoning_content (thinking)
    if (message.reasoning_content) {
      parts.push({ text: message.reasoning_content, thought: true });
    } else if (message.content === null && !message.tool_calls) {
      // Safety net: if there is absolutely no content, add empty text part
      parts.push({ text: '' });
    }

    // Map tool_calls to functionCall parts
    if (message.tool_calls?.length > 0) {
      for (const tc of message.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = { _raw: tc.function.arguments };
        }
        parts.push({
          functionCall: { id: tc.id, name: tc.function.name, args },
        });
      }
    }

    // Map text content
    if (message.content) {
      parts.push({ text: message.content });
    }

    const response: any = {
      candidates: [
        {
          content: {
            role: 'model',
            parts: parts.length > 0 ? parts : [{ text: '' }],
            // Protection: Save the reasoning directly in the content object
            reasoning_content: message.reasoning_content,
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: {
        promptTokenCount: deepseekResponse.usage?.prompt_tokens,
        candidatesTokenCount: deepseekResponse.usage?.completion_tokens,
        totalTokenCount: deepseekResponse.usage?.total_tokens,
      },
    };

    // Expose functionCalls for turn.ts compatibility (plain property, not class getter)
    const fnCalls = parts
      .filter((p: any) => p.functionCall)
      .map((p: any) => p.functionCall);
    if (fnCalls.length > 0) {
      response.functionCalls = fnCalls;
    }

    // Save to cache for the next turn using the stable signature
    if (message.reasoning_content) {
      const messageKey = this.getMessageKey(
        message.content || '',
        message.tool_calls,
      );
      fs.appendFileSync(
        'deepseek_payload_debug.log',
        `[CACHE SAVE] Saving for: ${(message.content || '').substring(0, 30)}... (Key: ${messageKey.substring(0, 50)})\n`,
      );
      DeepSeekContentGenerator.reasoningCache.set(
        messageKey,
        message.reasoning_content,
      );
      // Limit cache size
      if (DeepSeekContentGenerator.reasoningCache.size > 200) {
        const firstKey = DeepSeekContentGenerator.reasoningCache
          .keys()
          .next().value;
        if (firstKey !== undefined)
          DeepSeekContentGenerator.reasoningCache.delete(firstKey);
      }
      DeepSeekContentGenerator.saveCache();
    }

    return response as GenerateContentResponse;
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
    _role: LlmRole,
  ): Promise<GenerateContentResponse> {
    const body = this.mapGoogleToDeepSeek(request);

    debugLogger.debug(
      `[DeepSeek] Sending request to ${this.baseUrl}/chat/completions`,
    );

    try {
      fs.appendFileSync(
        'deepseek_payload_debug.log',
        `--- REQUEST AT ${new Date().toISOString()} ---\n${JSON.stringify(body, null, 2)}\n\n`,
      );
    } catch (e) {
      // Ignore
    }
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = await response.json();
    return this.mapDeepSeekToGoogle(data);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
    _role: LlmRole,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const body = this.mapGoogleToDeepSeek(request);
    body.stream = true;
    const self = this;

    try {
      fs.appendFileSync(
        'deepseek_payload_debug.log',
        `--- STREAM REQUEST AT ${new Date().toISOString()} ---\n${JSON.stringify(body, null, 2)}\n\n`,
      );
    } catch (e) {
      // Ignore
    }
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('DeepSeek API error: Response body is null');
    }

    const decoder = new TextDecoder();

    async function* stream() {
      let buffer = '';
      const toolCallAcc: Record<
        number,
        { id: string; name: string; arguments: string }
      > = {};
      let hasToolCalls = false;
      let fullReasoning = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            const json = JSON.parse(trimmed.substring(6));
            const choice = json.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta ?? {};
            const deltaContent = delta.content;
            const deltaReasoning = delta.reasoning_content;
            const isFinished = choice.finish_reason != null;

            // Yield reasoning content chunks
            if (deltaReasoning) {
              fullReasoning += deltaReasoning;
              yield {
                candidates: [
                  {
                    content: {
                      role: 'model',
                      parts: [{ text: deltaReasoning, thought: true }],
                    },
                  },
                ],
              } as GenerateContentResponse;
            }

            // Accumulate streaming tool_calls deltas
            if (delta.tool_calls) {
              hasToolCalls = true;
              for (const tc of delta.tool_calls) {
                const idx: number = tc.index ?? 0;
                if (!toolCallAcc[idx]) {
                  toolCallAcc[idx] = {
                    id: tc.id ?? `call_${idx}`,
                    name: '',
                    arguments: '',
                  };
                }
                if (tc.id) toolCallAcc[idx].id = tc.id;
                if (tc.function?.name)
                  toolCallAcc[idx].name += tc.function.name;
                if (tc.function?.arguments)
                  toolCallAcc[idx].arguments += tc.function.arguments;
              }
            }

            // Yield text content chunks
            if (deltaContent) {
              fullText += deltaContent;
              yield {
                candidates: [
                  {
                    content: { role: 'model', parts: [{ text: deltaContent }] },
                  },
                ],
              } as GenerateContentResponse;
            }

            // Final chunk: yield tool calls or STOP finishReason
            if (isFinished) {
              const parts: any[] = [];
              const fnCalls: any[] = [];

              if (fullReasoning) {
                parts.push({ text: fullReasoning, thought: true });
              }

              if (hasToolCalls) {
                for (const idx of Object.keys(toolCallAcc).map(Number).sort()) {
                  const tc = toolCallAcc[idx];
                  let args = {};
                  try {
                    args = JSON.parse(tc.arguments);
                  } catch {
                    args = { _raw: tc.arguments };
                  }
                  parts.push({
                    functionCall: { id: tc.id, name: tc.name, args },
                  });
                  fnCalls.push({ id: tc.id, name: tc.name, args });
                }
              }

              const finalChunk: any = {
                candidates: [
                  {
                    content: {
                      role: 'model',
                      parts,
                      // Protection: Save the accumulated reasoning in the final object
                      reasoning_content: fullReasoning,
                    },
                    finishReason: 'STOP',
                  },
                ],
                ...(json.usage
                  ? {
                      usageMetadata: {
                        promptTokenCount: json.usage.prompt_tokens,
                        candidatesTokenCount: json.usage.completion_tokens,
                        totalTokenCount: json.usage.total_tokens,
                      },
                    }
                  : {}),
              };

              if (fnCalls.length > 0) {
                finalChunk.functionCalls = fnCalls;
              }

              // Save to cache for the next turn (Streaming) with stable signature
              if (fullReasoning) {
                // For streaming, reconstruct accumulated tool_calls if they exist
                const fnCalls = hasToolCalls
                  ? Object.keys(toolCallAcc)
                      .map(Number)
                      .sort()
                      .map((idx) => ({
                        name: toolCallAcc[idx].name,
                        args: JSON.parse(toolCallAcc[idx].arguments || '{}'),
                      }))
                  : undefined;

                const messageKey = self.getMessageKey(fullText, fnCalls);
                fs.appendFileSync(
                  'deepseek_payload_debug.log',
                  `[CACHE SAVE STREAM] Saving for: ${fullText.substring(0, 30)}... (Key: ${messageKey.substring(0, 50)})\n`,
                );
                DeepSeekContentGenerator.reasoningCache.set(
                  messageKey,
                  fullReasoning,
                );
                if (DeepSeekContentGenerator.reasoningCache.size > 200) {
                  const firstKey = DeepSeekContentGenerator.reasoningCache
                    .keys()
                    .next().value;
                  if (firstKey !== undefined)
                    DeepSeekContentGenerator.reasoningCache.delete(firstKey);
                }
                DeepSeekContentGenerator.saveCache();
              }

              yield finalChunk as GenerateContentResponse;
            }
          }
        }
      }
    }

    return stream();
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // DeepSeek doesn't have a dedicated token counting endpoint.
    // Estimate using the standard approximation: ~4 characters per token.
    // This is accurate enough for context window management.
    let charCount = 0;

    const contents = Array.isArray(request.contents)
      ? request.contents
      : request.contents
        ? [request.contents]
        : [];

    for (const content of contents as any[]) {
      for (const part of content.parts ?? []) {
        if (part.text) charCount += (part.text as string).length;
        if (part.functionCall)
          charCount += JSON.stringify(part.functionCall).length;
        if (part.functionResponse)
          charCount += JSON.stringify(part.functionResponse).length;
      }
    }

    // Also count system instruction if present
    const sysInstruction = (request as any).config?.systemInstruction;
    if (sysInstruction) {
      charCount += JSON.stringify(sysInstruction).length;
    }

    const totalTokens = Math.ceil(charCount / 4);
    return { totalTokens };
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // DeepSeek doesn't natively support embeddings.
    // Return a zero-vector so features that call embedContent don't crash.
    debugLogger.warn(
      '[DeepSeek] embedContent is not supported — returning zero vector.',
    );
    return {
      embedding: { values: new Array(256).fill(0) },
    } as unknown as EmbedContentResponse;
  }
}
