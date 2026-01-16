import React from 'react';
import { Message, Sender } from '../types';
import { Bot, User, Cpu } from 'lucide-react';
import Markdown from 'react-markdown';
import ThoughtsPanel from './ThoughtsPanel';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.sender === Sender.User;
  const isSystem = message.sender === Sender.System;

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {message.text}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}>

        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-blue-600' : 'bg-indigo-600'}`}>
          {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
        </div>

        {/* Bubble */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          {/* Thoughts Panel - only for AI messages with thoughts */}
          {!isUser && message.thoughts && message.thoughts.length > 0 && (
            <ThoughtsPanel thoughts={message.thoughts} />
          )}
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm overflow-hidden ${isUser
              ? 'bg-blue-600 text-white rounded-tr-none'
              : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
              }`}
          >
            {message.isThinking ? (
              <div className="flex items-center gap-2 text-indigo-500">
                <Cpu size={14} className="animate-pulse" />
                <span className="text-xs font-medium">正在分析...</span>
              </div>
            ) : (
              <div className="markdown-body">
                <Markdown
                  components={{
                    // Paragraphs
                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                    // Bold text - adjust color based on background
                    strong: ({ node, ...props }) => (
                      <span className={`font-bold ${isUser ? 'text-white' : 'text-indigo-900'}`} {...props} />
                    ),
                    // Unordered lists
                    ul: ({ node, ...props }) => (
                      <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />
                    ),
                    // Ordered lists
                    ol: ({ node, ...props }) => (
                      <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />
                    ),
                    // List items
                    li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                    // Blockquotes
                    blockquote: ({ node, ...props }) => (
                      <blockquote className={`border-l-4 pl-3 py-1 my-2 italic ${isUser ? 'border-white/50' : 'border-indigo-200 bg-gray-50'}`} {...props} />
                    ),
                    // Links
                    a: ({ node, ...props }) => (
                      <a
                        className={`underline hover:no-underline ${isUser ? 'text-white' : 'text-indigo-600'}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        {...props}
                      />
                    )
                  }}
                >
                  {message.text}
                </Markdown>
              </div>
            )}
          </div>
          <span className="text-[10px] text-gray-400 mt-1 px-1">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;