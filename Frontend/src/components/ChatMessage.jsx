import React, { useEffect, useState } from 'react';
import { Copy, Check, Code } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * ChatMessage - Affiche un message avec support markdown, code blocks, etc.
 */
const ChatMessage = ({ message, isStreaming }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const components = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';

      if (inline) {
        return (
          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-green-700">
            {children}
          </code>
        );
      }

      return (
        <div className="relative my-4 bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
            <span className="text-xs text-gray-600 font-mono">{language || 'code'}</span>
            <button
              onClick={() => copyToClipboard(String(children).replace(/\n$/, ''))}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-white hover:bg-gray-200 text-gray-700 rounded transition border border-gray-300"
            >
              {copied ? (
                <>
                  <Check size={14} /> Copié
                </>
              ) : (
                <>
                  <Copy size={14} /> Copier
                </>
              )}
            </button>
          </div>
          <SyntaxHighlighter
            language={language}
            style={oneLight}
            customStyle={{
              margin: 0,
              padding: '1rem',
              fontSize: '0.875rem',
              background: '#f9fafb'
            }}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      );
    },

    table({ children }) {
      return (
        <div className="overflow-x-auto my-4">
          <table className="w-full border-collapse border border-gray-300">
            {children}
          </table>
        </div>
      );
    },

    th({ children }) {
      return (
        <th className="border border-gray-300 bg-gray-100 px-4 py-2 text-left text-gray-800 font-semibold">
          {children}
        </th>
      );
    },

    td({ children }) {
      return (
        <td className="border border-gray-300 px-4 py-2 text-gray-700">
          {children}
        </td>
      );
    },

    h1({ children }) {
      return (
        <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-2">
          {children}
        </h1>
      );
    },

    h2({ children }) {
      return (
        <h2 className="text-xl font-bold text-green-700 mt-3 mb-2">
          {children}
        </h2>
      );
    },

    h3({ children }) {
      return (
        <h3 className="text-lg font-semibold text-green-600 mt-2 mb-1">
          {children}
        </h3>
      );
    },

    ul({ children }) {
      return (
        <ul className="list-disc list-inside my-2 space-y-1 text-gray-700">
          {children}
        </ul>
      );
    },

    ol({ children }) {
      return (
        <ol className="list-decimal list-inside my-2 space-y-1 text-gray-700">
          {children}
        </ol>
      );
    },

    li({ children }) {
      return <li>{children}</li>;
    },

    p({ children }) {
      return <p className="text-gray-700 my-2 leading-relaxed">{children}</p>;
    },

    blockquote({ children }) {
      return (
        <blockquote className="border-l-4 border-green-500 pl-4 my-2 italic text-gray-600">
          {children}
        </blockquote>
      );
    },

    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-600 hover:text-green-700 underline"
        >
          {children}
        </a>
      );
    },

    strong({ children }) {
      return <strong className="text-gray-900 font-semibold">{children}</strong>;
    },

    em({ children }) {
      return <em className="italic text-gray-600">{children}</em>;
    }
  };

  return (
    <div
      className={`flex gap-3 mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-bold">
            🤖
          </div>
        </div>
      )}

      <div
        className={`max-w-2xl rounded-lg px-4 py-3 shadow-sm ${
          isUser
            ? 'bg-green-600 text-white'
            : 'bg-white text-gray-800 border border-gray-200'
        }`}
      >
        {isUser ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown components={components}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {isStreaming && !isUser && (
          <div className="flex items-center gap-1 mt-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
        )}

        <span className="text-xs text-gray-400 mt-1 block">
          {new Date(message.createdAt || Date.now()).toLocaleTimeString()}
        </span>
      </div>

      {isUser && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-bold">
            👤
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;