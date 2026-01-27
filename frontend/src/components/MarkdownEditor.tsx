/**
 * Markdown editor using @uiw/react-md-editor
 */

import { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';

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
    const [value, setValue] = useState(defaultValue);

    // Update value when defaultValue changes (e.g., when loading existing content)
    useEffect(() => {
      setValue(defaultValue);
    }, [defaultValue]);

    // Expose getMarkdown method to parent
    useImperativeHandle(ref, () => ({
      getMarkdown: () => value,
    }));

    const handleChange = (newValue: string | undefined) => {
      const markdown = newValue || '';
      setValue(markdown);
      onChange?.(markdown);
    };

    return (
      <div data-color-mode="light" className="md-editor-wrapper">
        <MDEditor
          value={value}
          onChange={handleChange}
          height={400}
          preview="edit"
          textareaProps={{
            placeholder: placeholder || 'Start writing...',
          }}
        />
      </div>
    );
  }
);
