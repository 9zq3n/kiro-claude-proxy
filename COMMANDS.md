# Kiro Claude Proxy - Commands Reference

## CLI Commands

### Start Server
```bash
kiro-claude-proxy start          # Start on default port 8080
kiro-claude-proxy start --debug  # Start with debug logging
kiro-claude-proxy                # Defaults to start command
```

### Help & Version
```bash
kiro-claude-proxy --help         # Show help message
kiro-claude-proxy --version      # Show version number
```

### Alternative Start Methods
```bash
npm start                        # If cloned locally
npx kiro-claude-proxy start      # Run without installing
```

---

## API Endpoints

Base URL: `http://localhost:8080`

### Health Check
```bash
GET /health
curl http://localhost:8080/health
```

### List Models
```bash
GET /v1/models
curl http://localhost:8080/v1/models
```

### Send Message
```bash
POST /v1/messages
curl -X POST http://localhost:8080/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 1000
  }'
```

### Streaming Messages
```bash
POST /v1/messages
curl -X POST http://localhost:8080/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 1000,
    "stream": true
  }'
```

---

## Environment Variables

```bash
PORT=3000 kiro-claude-proxy start     # Custom port
DEBUG=true kiro-claude-proxy start    # Enable debug logging
```

---

## Prerequisites

```bash
kiro auth                             # Authenticate Kiro CLI
kiro --help                          # Verify Kiro CLI is installed
```

---

## Available Models

- `claude-opus-4-5`
- `claude-sonnet-4-5` 
- `claude-sonnet-4`
- `claude-haiku-4-5`
- `auto`
