import React from 'react';

// Helper to render text with LaTeX and Markdown support
export const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  // 1. Handle paragraphs/newlines first
  const paragraphs = text.split(/\n\n+/);

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, pIdx) => (
        <p key={pIdx} className="whitespace-pre-wrap break-words leading-relaxed">
           <FormattedParagraph text={paragraph} />
        </p>
      ))}
    </div>
  );
};

const FormattedParagraph: React.FC<{ text: string }> = ({ text }) => {
  // 2. Split by LaTeX delimiters
  const latexParts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

  return (
    <>
      {latexParts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const formula = part.slice(2, -2);
          try {
            const render = (window as any).katex?.renderToString 
              ? (window as any).katex.renderToString(formula, { displayMode: true, throwOnError: false })
              : formula;
            return <span key={index} dangerouslySetInnerHTML={{ __html: render }} className="block my-2" />;
          } catch (e) {
            return <span key={index}>{part}</span>;
          }
        } else if (part.startsWith('$') && part.endsWith('$')) {
          const formula = part.slice(1, -1);
          try {
            const render = (window as any).katex?.renderToString 
              ? (window as any).katex.renderToString(formula, { displayMode: false, throwOnError: false })
              : formula;
            return <span key={index} dangerouslySetInnerHTML={{ __html: render }} />;
          } catch (e) {
            return <span key={index}>{part}</span>;
          }
        } else {
          // 3. Parse Markdown within text parts
          return <span key={index}>{parseMarkdown(part)}</span>;
        }
      })}
    </>
  );
};

// Simple Markdown Parser for **bold**, *italic*, and ==highlight==
const parseMarkdown = (txt: string) => {
    // Split by highlight (==text==)
    const highlightParts = txt.split(/(==.*?==)/g);
    
    return highlightParts.map((hPart, hIdx) => {
        if (hPart.startsWith('==') && hPart.endsWith('==')) {
             return <mark key={hIdx} className="bg-yellow-200 dark:bg-yellow-800 text-slate-900 dark:text-yellow-100 px-1 rounded">{hPart.slice(2, -2)}</mark>;
        }

        // Split by bold (**text**)
        const boldParts = hPart.split(/(\*\*.*?\*\*)/g);
        return (
            <span key={hIdx}>
                {boldParts.map((bPart, bIdx) => {
                    if (bPart.startsWith('**') && bPart.endsWith('**')) {
                        return <strong key={bIdx} className="font-bold">{bPart.slice(2, -2)}</strong>;
                    }
                    
                    // Split by italic (*text*) inside non-bold parts
                    const italicParts = bPart.split(/(\*.*?\*)/g);
                    return (
                        <span key={bIdx}>
                            {italicParts.map((iPart, iIdx) => {
                                if (iPart.startsWith('*') && iPart.endsWith('*') && iPart.length > 2) {
                                    return <em key={iIdx} className="italic">{iPart.slice(1, -1)}</em>;
                                }
                                return iPart;
                            })}
                        </span>
                    );
                })}
            </span>
        );
    });
};