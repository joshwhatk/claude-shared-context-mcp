/**
 * Content renderer that auto-detects content type and renders appropriately
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { detectContentType } from '../utils/contentDetection';
import { JsonViewer } from './JsonViewer';

interface ContentRendererProps {
  content: string;
}

export function ContentRenderer({ content }: ContentRendererProps) {
  const contentType = detectContentType(content);

  if (contentType === 'json') {
    return <JsonViewer content={content} />;
  }

  return (
    <article className="prose prose-gray max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}
