import type { ReactNode } from 'react';
import { CopyButton } from './CopyButton';

interface CliSetupInstructionsProps {
  apiKeyHint?: ReactNode;
}

export function CliSetupInstructions({ apiKeyHint }: CliSetupInstructionsProps) {
  const hostname = window.location.origin;

  const cliJson = `{
  "Shared_Context": {
    "type": "http",
    "url": "${hostname}/claude-code/mcp",
    "headers": {
      "Authorization": "Bearer <your-api-key>"
    }
  }
}`;

  const cliCommand = `claude mcp add --transport http Shared_Context ${hostname}/claude-code/mcp --header "Authorization: Bearer <your-api-key>"`;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Claude Code CLI</h3>
      <p className="text-sm text-gray-600 mb-3">
        Add to <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">~/.claude.json</code> under{' '}
        <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">"mcpServers"</code>:
      </p>
      <div className="relative">
        <pre className="p-4 bg-gray-900 text-gray-100 rounded-md text-sm font-mono overflow-x-auto">{cliJson}</pre>
        <div className="absolute top-2 right-2">
          <CopyButton text={cliJson} />
        </div>
      </div>
      <p className="text-sm text-gray-600 mt-3 mb-2">Or run:</p>
      <div className="relative">
        <pre className="p-4 bg-gray-900 text-gray-100 rounded-md text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all">{cliCommand}</pre>
        <div className="absolute top-2 right-2">
          <CopyButton text={cliCommand} />
        </div>
      </div>
      {apiKeyHint && (
        <p className="mt-2 text-xs text-gray-500">{apiKeyHint}</p>
      )}
    </div>
  );
}

export function WebSetupInstructions() {
  const hostname = window.location.origin;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Claude.ai Web (Projects)</h3>
      <ol className="text-sm text-gray-600 space-y-1.5 list-decimal list-inside">
        <li>Go to Claude.ai &rarr; Settings &rarr; Connectors &rarr; Add custom connector</li>
        <li>
          URL: <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">{hostname}/mcp</code>
          <CopyButton text={`${hostname}/mcp`} />
        </li>
        <li>Authorize via Clerk OAuth when prompted</li>
        <li>Tools will be available in conversations</li>
      </ol>
      <p className="mt-2 text-xs text-gray-500">
        No API key needed — Claude.ai uses OAuth to authenticate directly.
      </p>
    </div>
  );
}
