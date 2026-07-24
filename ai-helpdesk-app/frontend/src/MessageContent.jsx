import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { copyText } from "./clipboard.js";

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyText(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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
  const nodes = [];
  let listBuffer = [];

  function flushList() {
    if (listBuffer.length > 0) {
      nodes.push(<ul className="msg-list" key={`${keyPrefix}-list-${nodes.length}`}>{listBuffer}</ul>);
      listBuffer = [];
    }
  }

  lines.forEach((line, i) => {
    const headingMatch = line.match(/^(#{1,4})\s+(.*)/);
    const listMatch = line.match(/^[-*]\s+(.*)/);

    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const Tag = level <= 2 ? "h3" : "h4";
      nodes.push(
        <Tag className="msg-heading" key={`${keyPrefix}-h-${i}`}>
          {renderInline(headingMatch[2], `${keyPrefix}-h-${i}`)}
        </Tag>
      );
    } else if (listMatch) {
      listBuffer.push(
        <li key={`${keyPrefix}-li-${i}`}>{renderInline(listMatch[1], `${keyPrefix}-li-${i}`)}</li>
      );
    } else {
      flushList();
      if (line.trim() === "") {
        nodes.push(<div className="msg-spacer" key={`${keyPrefix}-sp-${i}`} />);
      } else {
        nodes.push(
          <div className="msg-line" key={`${keyPrefix}-line-${i}`}>
            {renderInline(line, `${keyPrefix}-${i}`)}
          </div>
        );
      }
    }
  });

  flushList();
  return nodes;
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
