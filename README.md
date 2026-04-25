# DeepSeek CLI

> **Unofficial fork** of
> [Google DeepSeek CLI](https://github.com/google-gemini/gemini-cli) adapted to
> use the [DeepSeek API](https://platform.deepseek.com). Original work © 2025
> Google LLC — Adaptations © 2026 sluisr — Apache 2.0 License.

[![License](https://img.shields.io/github/license/google-gemini/gemini-cli)](https://github.com/google-gemini/gemini-cli/blob/main/LICENSE)

DeepSeek CLI is an open-source AI agent that brings the power of DeepSeek
directly into your terminal. An unofficial adaptation of Google DeepSeek CLI by
[sluisr](https://sluisr.com).

## 🚀 Why DeepSeek CLI?

- **💰 Pay-per-use**: No daily limits, pay only for tokens used via DeepSeek
  API.
- **🧠 DeepSeek V4 models**: Features deepseek-v4-flash and deepseek-v4-pro with
  a 1M token context window.
- **🔧 Built-in tools**: File operations, shell commands, web fetching, memory
  persistence.
- **🔌 Extensible**: MCP (Model Context Protocol) support for custom
  integrations.
- **💻 Terminal-first**: Designed for developers who live in the command line.
- **🛡️ Open source**: Apache 2.0 licensed.
- **🔒 Isolated config**: Uses `~/.deepseek/` — won't conflict with official
  DeepSeek CLI.

## 📦 Installation

### Quick Install

```bash
npm install -g @sluisr/deepseek-cli
```

Then run:

```bash
deepseek
```

### Update to Latest Version

```bash
npm install -g @sluisr/deepseek-cli@latest
```

## 🔐 Authentication

Get your API key at
[platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) and set
it:

```bash
export DEEPSEEK_API_KEY="your-api-key-here"
deepseek
```

Or enter it directly when prompted on first launch.

## 🚀 Getting Started

```bash
# Start in current directory
deepseek

# Non-interactive mode
deepseek -p "Explain the architecture of this codebase"

# Include multiple directories
deepseek --include-directories ../lib,../docs
```

## 📋 Key Features

- **Agentic coding** — reads, edits, and creates files autonomously
- **Shell execution** — runs commands, installs dependencies, starts servers
- **Memory persistence** — saves context to `~/.deepseek/DEEPSEEK.md`
- **MCP support** — extend with custom tools via Model Context Protocol
- **Conversation checkpointing** — save and resume complex sessions
- **Context files** — create `DEEPSEEK.md` in any project for persistent
  instructions

## 🔨 Built-in Tools

- File system operations (read, write, edit, search)
- Shell command execution
- Web fetch
- Memory save/load (`~/.deepseek/DEEPSEEK.md`)
- MCP server integration

## 💬 Example Usage

```bash
cd my-project/
deepseek
> Build me a REST API with authentication
> Fix the bug in src/auth.ts
> Write tests for the payment module
> Explain what this codebase does
```

## ⚙ Configuration

Settings are stored in `~/.deepseek/settings.json`. MCP servers can be
configured there:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    }
  }
}
```

## 🤝 Contributing

Issues and PRs welcome at
[github.com/sluisr-dev/deepseek-cli](https://github.com/sluisr-dev/deepseek-cli).

## 📋 Legal

- **License**: [Apache License 2.0](LICENSE)
- **Original project**:
  [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)

---

<p align="center">
  Built by <a href="https://sluisr.com">sluisr</a> (<a href="https://github.com/sluisr-dev">@sluisr-dev</a>) — fork of Google DeepSeek CLI
</p>

<!-- v1.0.14-stable -->
