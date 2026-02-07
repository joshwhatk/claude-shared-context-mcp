import { Link } from 'react-router-dom';
import { CliSetupInstructions, WebSetupInstructions } from '../components/SetupInstructions';
import { usePageTitle } from '../hooks/usePageTitle';

export function SetupPage() {
  usePageTitle('Setup');

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Setup</h1>
      <p className="text-gray-600 mb-6">
        There are two ways to connect to Shared Context: Claude.ai Web (uses OAuth to Sign In) or the Claude Code CLI (requires an API key as a Bearer Token).
      </p>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <WebSetupInstructions />
        <hr className="border-gray-200" />
        <CliSetupInstructions
          apiKeyHint={
            <>
              Replace <code className="px-1 py-0.5 bg-gray-100 rounded font-mono">&lt;your-api-key&gt;</code> with an API key from the{' '}
              <Link to="/app/keys" className="text-blue-600 hover:text-blue-800 underline">API Keys</Link> page.
            </>
          }
        />
      </div>

      <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Need an API key?</h3>
          <p className="text-sm text-gray-600 mt-1">
            Create and manage API keys for the Claude Code CLI.
          </p>
        </div>
        <Link
          to="/app/keys"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Manage API Keys
        </Link>
      </div>
    </div>
  );
}
