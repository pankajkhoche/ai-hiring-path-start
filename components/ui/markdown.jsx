'use client';

import ReactMarkdown from 'react-markdown';

// Renders AI-generated text as proper markdown (bold, lists, headings) instead of
// showing raw "**bold**" / "## heading" syntax as literal characters.
export default function Markdown({ content, className = '' }) {
  return (
    <div className={`text-sm leading-relaxed space-y-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${className}`}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 my-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 my-2">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          h1: ({ children }) => <h3 className="font-display text-lg mt-3 mb-1">{children}</h3>,
          h2: ({ children }) => <h4 className="font-semibold mt-3 mb-1">{children}</h4>,
          h3: ({ children }) => <h5 className="font-semibold mt-2 mb-1">{children}</h5>,
          code: ({ children }) => <code className="bg-secondary rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>,
          a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{children}</a>,
          hr: () => <hr className="border-border my-3" />,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground">{children}</blockquote>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
