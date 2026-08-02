import React, { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";
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
        <div className="code-block__dots">
          <span className="dot dot--red" />
          <span className="dot dot--yellow" />
          <span className="dot dot--green" />
          <span className="code-block__lang">
            <Terminal size={11} />
            {language || "bash"}
          </span>
        </div>
        <button type="button" className="code-block__copy" onClick={handleCopy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? "Copied" : "Copy code"}</span>
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
  let numListBuffer = [];

  function flushLists() {
    if (listBuffer.length > 0) {
      nodes.push(<ul className="msg-list" key={`${keyPrefix}-ul-${nodes.length}`}>{listBuffer}</ul>);
      listBuffer = [];
    }
    if (numListBuffer.length > 0) {
      nodes.push(<ol className="msg-num-list" key={`${keyPrefix}-ol-${nodes.length}`}>{numListBuffer}</ol>);
      numListBuffer = [];
    }
  }

  lines.forEach((line, i) => {
    const headingMatch = line.match(/^(#{1,4})\s+(.*)/);
    const bulletMatch = line.match(/^[-*]\s+(.*)/);
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    const quoteMatch = line.match(/^>\s+(.*)/);

    if (headingMatch) {
      flushLists();
      const level = headingMatch[1].length;
      const Tag = level <= 2 ? "h3" : "h4";
      nodes.push(
        <Tag className="msg-heading" key={`${keyPrefix}-h-${i}`}>
          {renderInline(headingMatch[2], `${keyPrefix}-h-${i}`)}
        </Tag>
      );
    } else if (bulletMatch) {
      if (numListBuffer.length > 0) flushLists();
      listBuffer.push(
        <li key={`${keyPrefix}-li-${i}`}>{renderInline(bulletMatch[1], `${keyPrefix}-li-${i}`)}</li>
      );
    } else if (numMatch) {
      if (listBuffer.length > 0) flushLists();
      numListBuffer.push(
        <li key={`${keyPrefix}-nli-${i}`}>{renderInline(numMatch[2], `${keyPrefix}-nli-${i}`)}</li>
      );
    } else if (quoteMatch) {
      flushLists();
      nodes.push(
        <blockquote className="msg-quote" key={`${keyPrefix}-q-${i}`}>
          {renderInline(quoteMatch[1], `${keyPrefix}-q-${i}`)}
        </blockquote>
      );
    } else {
      flushLists();
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

  flushLists();
  return nodes;
}

const CODE_BLOCK_PATTERN = /```(\w*)\n?([\s\S]*?)```/g;

/**
 * Renders assistant message text with enhanced markdown support:
 * **bold**, *italic*, `inline code`, bullet & numbered lists, blockquotes, and ```fenced code blocks```.
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

