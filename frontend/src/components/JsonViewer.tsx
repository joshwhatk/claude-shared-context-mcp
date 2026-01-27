/**
 * JSON viewer component with syntax highlighting using prism-react-renderer
 */

import { Highlight, themes } from 'prism-react-renderer';

interface JsonViewerProps {
  content: string;
}

export function JsonViewer({ content }: JsonViewerProps) {
  // Pretty-print the JSON with 2-space indent
  let formattedJson: string;
  try {
    formattedJson = JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    // Fallback to original content if parsing fails
    formattedJson = content;
  }

  return (
    <Highlight theme={themes.vsLight} code={formattedJson} language="json">
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={`${className} overflow-x-auto rounded-md p-4 text-sm`}
          style={{ ...style, backgroundColor: '#f8f9fa' }}
        >
          <code>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} className="table-row">
                <span className="table-cell pr-4 text-right text-gray-400 select-none">
                  {i + 1}
                </span>
                <span className="table-cell">
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </span>
              </div>
            ))}
          </code>
        </pre>
      )}
    </Highlight>
  );
}
