# Kiro Claude Proxy

## How It Works

```
┌──────────────────┐     ┌─────────────────────┐     ┌────────────────────────────┐
│   Claude Code    │────▶│  This Proxy Server  │────▶│  AWS CodeWhisperer         │
│   (Anthropic     │     │  (Anthropic → AWS   │     │  (codewhisperer.           │
│    API format)   │     │   CodeWhisperer)    │     │   us-east-1.amazonaws.com) │
└──────────────────┘     └─────────────────────┘     └────────────────────────────┘
```

1. Receives requests in **Anthropic Messages API format**
2. Uses OAuth tokens from Kiro CLI database
3. Transforms to AWS CodeWhisperer format
4. Sends to AWS CodeWhisperer API
5. Converts responses back to **Anthropic format** with full streaming support

## Prerequisites

- **Node.js** 18 or later
- **Kiro CLI** installed and authenticated (`kiro auth`)

---

## Installation

### Option 1: npm (Recommended)

```bash
# Run directly with npx (no install needed)
npx kiro-claude-proxy start

# Or install globally
npm install -g kiro-claude-proxy
kiro-claude-proxy start
```

### Option 2: Clone Repository

```bash
git clone <repository-url>
cd kiro-claude-proxy
npm install
npm start
```

---

## Quick Start

### 1. Authenticate Kiro CLI

Make sure Kiro CLI is installed and authenticated:

```bash
kiro auth
```

### 2. Start the Proxy Server

```bash
# If installed via npm
kiro-claude-proxy start

# If using npx
npx kiro-claude-proxy start

# If cloned locally
npm start
```

The server runs on `http://localhost:8080` by default.

### 3. Verify It's Working

```bash
# Health check
curl http://localhost:8080/health

# List available models
curl http://localhost:8080/v1/models
```

---

## Using with Claude Code CLI

### Configure Claude Code

Create or edit the Claude Code settings file:

**macOS:** `~/.claude/settings.json`  
**Linux:** `~/.claude/settings.json`  
**Windows:** `%USERPROFILE%\.claude\settings.json`

Add this configuration:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "dummy",
    "ANTHROPIC_BASE_URL": "http://localhost:8080",
    "ANTHROPIC_MODEL": "claude-opus-4-5",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-5",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-5",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5",
    "CLAUDE_CODE_SUBAGENT_MODEL": "claude-sonnet-4-5"
  }
}
```

### Load Environment Variables

Add the proxy settings to your shell profile:

**macOS / Linux:**

```bash
echo 'export ANTHROPIC_BASE_URL="http://localhost:8080"' >> ~/.zshrc
echo 'export ANTHROPIC_API_KEY="dummy"' >> ~/.zshrc
source ~/.zshrc
```

> For Bash users, replace `~/.zshrc` with `~/.bashrc`

**Windows (PowerShell):**

```powershell
Add-Content $PROFILE "`n`$env:ANTHROPIC_BASE_URL = 'http://localhost:8080'"
Add-Content $PROFILE "`$env:ANTHROPIC_API_KEY = 'dummy'"
. $PROFILE
```

**Windows (Command Prompt):**

```cmd
setx ANTHROPIC_BASE_URL "http://localhost:8080"
setx ANTHROPIC_API_KEY "dummy"
```

Restart your terminal for changes to take effect.

### Run Claude Code

```bash
# Make sure the proxy is running first
kiro-claude-proxy start

# In another terminal, run Claude Code
claude
```

---

## Available Models

| Model ID | Description |
|----------|-------------|
| `claude-opus-4-5` | Claude Opus 4.5 |
| `claude-sonnet-4-5` | Claude Sonnet 4.5 |
| `claude-sonnet-4` | Claude Sonnet 4 |
| `claude-haiku-4-5` | Claude Haiku 4.5 |
| `auto` | Let Kiro choose the best model |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/v1/messages` | POST | Anthropic Messages API |
| `/v1/models` | GET | List available models |

---

## CLI Commands

```bash
# Start server
kiro-claude-proxy start          # Default port 8080
kiro-claude-proxy start --debug  # With debug logging

# Help & version
kiro-claude-proxy --help         # Show help
kiro-claude-proxy --version      # Show version

# Environment variables
PORT=3000 kiro-claude-proxy start     # Custom port
DEBUG=true kiro-claude-proxy start    # Debug mode
```

---

## Troubleshooting

### "Kiro CLI not authenticated"

Make sure Kiro CLI is installed and authenticated:
```bash
kiro auth
```

### "Kiro CLI database not accessible"

Ensure Kiro CLI is properly installed and has created its database. Try running any Kiro command first:
```bash
kiro --help
```

### 401 Authentication Errors

Your Kiro authentication may have expired. Re-authenticate:
```bash
kiro auth
```

---

## Development

### Running in Debug Mode

```bash
kiro-claude-proxy start --debug
```

### Environment Variables

- `PORT` - Server port (default: 8080)
- `DEBUG` - Enable debug logging (set to 'true')

---

## License

MIT

---

## Credits

This project uses Kiro CLI's authentication system to access AWS CodeWhisperer models through an Anthropic-compatible API interface.
