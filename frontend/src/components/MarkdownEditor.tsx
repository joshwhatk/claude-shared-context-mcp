/**
 * WYSIWYG Markdown editor using Milkdown Crepe
 */

import { useRef, useLayoutEffect, useImperativeHandle, forwardRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';

export interface MarkdownEditorRef {
  getMarkdown: () => string;
}

interface MarkdownEditorProps {
  defaultValue?: string;
  onChange?: (markdown: string) => void;
  placeholder?: string;
}

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  function MarkdownEditor({ defaultValue = '', onChange, placeholder }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<Crepe | null>(null);
    const loadingRef = useRef(false);

    // Expose getMarkdown method to parent
    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        if (editorRef.current) {
          return editorRef.current.getMarkdown();
        }
        return defaultValue;
      },
    }));

    useLayoutEffect(() => {
      if (!containerRef.current || loadingRef.current) return;

      loadingRef.current = true;

      const crepe = new Crepe({
        root: containerRef.current,
        defaultValue: defaultValue || placeholder || '',
      });

      crepe.create().then(() => {
        loadingRef.current = false;
        editorRef.current = crepe;

        // Set up change listener
        if (onChange) {
          crepe.on((listener) => {
            listener.markdownUpdated((_ctx, markdown) => {
              onChange(markdown);
            });
          });
        }
      });

      return () => {
        if (!loadingRef.current && editorRef.current) {
          editorRef.current.destroy();
          editorRef.current = null;
        }
      };
    }, []); // Only run once on mount

    return (
      <div
        ref={containerRef}
        className="milkdown-editor min-h-[400px] bg-white rounded-lg border border-gray-200 overflow-hidden"
      />
    );
  }
);
