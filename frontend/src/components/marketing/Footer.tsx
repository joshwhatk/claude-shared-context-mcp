import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-gray-200">
      <div className="max-w-6xl mx-auto text-center space-y-3">
        <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
          <Link to="/privacy-policy" className="text-gray-500 hover:text-gray-700 underline">Privacy Policy</Link>
          <span aria-hidden="true">&middot;</span>
          <Link to="/terms-of-use" className="text-gray-500 hover:text-gray-700 underline">Terms of Use</Link>
        </div>
        <p className="text-sm text-gray-400">
          Built on the{' '}
          <a
            href="https://modelcontextprotocol.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-700 underline"
          >
            Model Context Protocol
          </a>, an open standard by Anthropic.
        </p>
      </div>
    </footer>
  );
}
