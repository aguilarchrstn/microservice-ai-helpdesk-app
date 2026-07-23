import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — fail quietly.
    }
  }

  return (
    <div className="code-block">
      <div className="code-block__header">
        <span>{language || "code"}</span>
        <button type="button" className="code-block__copy" onClick={handleCopy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Bold (**x**), inline code (`x`), and italic (*x*) — checked in that order
// so ** isn't mistaken for two italic markers.
const INLINE_PATTERN = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;

function renderInline(text, keyPrefix) {
  return text
    .split(INLINE_PATTERN)
    .filter((part) => part.length > 0)
    .map((part, i) => {
      const key = `${keyPrefix}-${i}`;
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={key}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={key} className="inline-code">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={key}>{part.slice(1, -1)}</em>;
      }
      return <React.Fragment key={key}>{part}</React.Fragment>;
    });
}

function renderTextChunk(chunk, keyPrefix) {
  const lines = chunk.split("\n");
  return lines.map((line, i) => (
    <React.Fragment key={`${keyPrefix}-line-${i}`}>
      {renderInline(line, `${keyPrefix}-${i}`)}
      {i < lines.length - 1 && <br />}
    </React.Fragment>
  ));
}

const CODE_BLOCK_PATTERN = /```(\w*)\n?([\s\S]*?)```/g;

/**
 * Renders assistant message text with light markdown support:
 * **bold**, *italic*, `inline code`, and ```fenced code blocks``` (with a
 * copy button). Everything else renders as plain text, line breaks intact.
 */
export function renderMessageContent(text) {
  const nodes = [];
  let lastIndex = 0;
  let match;
  let blockIndex = 0;

  CODE_BLOCK_PATTERN.lastIndex = 0;
  while ((match = CODE_BLOCK_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...renderTextChunk(text.slice(lastIndex, match.index), `t${blockIndex}`));
    }
    nodes.push(
      <CodeBlock key={`code-${blockIndex}`} language={match[1]} code={match[2].replace(/\n$/, "")} />
    );
    lastIndex = match.index + match[0].length;
    blockIndex++;
  }

  if (lastIndex < text.length) {
    nodes.push(...renderTextChunk(text.slice(lastIndex), `tail-${blockIndex}`));
  }

  return nodes;
}
