#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

const args = process.argv.slice(2);
const command = args[0];

function showHelp() {
  console.log(`
kiro-claude-proxy v${packageJson.version}

Proxy server for using Kiro's Claude models with Claude Code CLI.

USAGE:
  kiro-claude-proxy <command> [options]

COMMANDS:
  start                 Start the proxy server (default port: 8080)

OPTIONS:
  --help, -h            Show this help message
  --version, -v         Show version number
  --debug               Enable debug logging

ENVIRONMENT:
  PORT                  Server port (default: 8080)

EXAMPLES:
  kiro-claude-proxy start
  PORT=3000 kiro-claude-proxy start
  kiro-claude-proxy start --debug

PREREQUISITES:
  - Kiro CLI must be installed and authenticated
  - Run "kiro auth" to authenticate with AWS

CONFIGURATION:
  Claude Code CLI (~/.claude/settings.json):
    {
      "env": {
        "ANTHROPIC_BASE_URL": "http://localhost:8080",
        "ANTHROPIC_API_KEY": "dummy"
      }
    }
`);
}

function showVersion() {
  console.log(packageJson.version);
}

async function main() {
  // Handle flags
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    showVersion();
    process.exit(0);
  }

  // Handle commands
  switch (command) {
    case 'start':
    case undefined:
      // Default to starting the server
      await import('../src/index.js');
      break;

    case 'help':
      showHelp();
      break;

    case 'version':
      showVersion();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "kiro-claude-proxy --help" for usage information.');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
