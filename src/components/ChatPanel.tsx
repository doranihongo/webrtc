import React, { useState, useRef, useEffect } from 'react';
import { Send, X, MessageCircle, ChevronDown } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onClearMessages?: () => void;
  unreadCount?: number;
  onMarkAsRead?: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  unreadCount = 0,
  onMarkAsRead,
}) => {
  const [inputText, setInputText] = useState('');
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const prevIsOpenRef = useRef<boolean>(false);
  const isAutoScrollingRef = useRef<boolean>(false);
  const [firstUnreadIndex, setFirstUnreadIndex] = useState<number | null>(null);

  const checkScrollState = () => {
    if (!scrollContainerRef.current || isAutoScrollingRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isScrollable = scrollHeight > clientHeight + 10;
    if (!isScrollable) {
      setShowScrollBottomBtn(false);
      return;
    }
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottomBtn(distanceFromBottom > 60);
  };

  const scrollToBottomInstant = () => {
    if (!scrollContainerRef.current) return;
    isAutoScrollingRef.current = true;
    setShowScrollBottomBtn(false);
    scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    setTimeout(() => {
      isAutoScrollingRef.current = false;
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        if (scrollHeight <= clientHeight + 10) {
          setShowScrollBottomBtn(false);
        }
      }
    }, 50);
  };

  // Handle panel opening and initial scroll position & auto-focus input
  useEffect(() => {
    if (isOpen) {
      // Auto focus chat input ONLY on desktop devices (fine pointer & hover supported)
      const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (isDesktop) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
      }

      if (!prevIsOpenRef.current) {
        if (unreadCount > 0 && messages.length > 0) {
          const targetIdx = Math.max(0, messages.length - unreadCount);
          setFirstUnreadIndex(targetIdx);
          requestAnimationFrame(() => {
            firstUnreadRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
            checkScrollState();
            onMarkAsRead?.();
          });
        } else {
          setFirstUnreadIndex(null);
          requestAnimationFrame(() => {
            scrollToBottomInstant();
            onMarkAsRead?.();
          });
        }
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, unreadCount, messages.length, onMarkAsRead]);

  // Handle new incoming/outgoing messages when chat is already open
  useEffect(() => {
    if (isOpen && prevIsOpenRef.current) {
      requestAnimationFrame(() => {
        if (!scrollContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isScrollable = scrollHeight > clientHeight + 15;
        if (!isScrollable) {
          setShowScrollBottomBtn(false);
          return;
        }

        const lastMsg = messages[messages.length - 1];
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 140;

        if (lastMsg?.isMe || isNearBottom) {
          scrollToBottomInstant();
        } else {
          checkScrollState();
        }
      });
    }
  }, [messages.length, isOpen]);

  const handleScroll = () => {
    checkScrollState();
  };

  const scrollToBottom = () => {
    isAutoScrollingRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottomBtn(false);
    setTimeout(() => {
      isAutoScrollingRef.current = false;
      checkScrollState();
    }, 350);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
    
    if (inputRef.current) {
      inputRef.current.focus();
    }

    requestAnimationFrame(() => {
      scrollToBottomInstant();
    });
  };

  if (!isOpen) return null;

  return (
    <div className="w-full h-full bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
      {/* Panel Header */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm tracking-wide">
          <MessageCircle className="w-4 h-4 text-blue-400" />
          <span>TRÒ CHUYỆN</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            title="Đóng"
            className="cursor-pointer p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 active:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages List Area */}
      <div className="relative flex-1 overflow-hidden flex flex-col">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 p-4 overflow-y-auto space-y-2 font-sans text-xs sm:text-sm no-scrollbar"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-8">
              <MessageCircle className="w-10 h-10 stroke-[1.5] mb-2 opacity-40 text-slate-500" />
              <p className="text-xs">Chưa có tin nhắn nào.</p>
              <p className="text-[11px] text-slate-600 mt-1">Gửi tin nhắn để bắt đầu trò chuyện trong phòng gọi.</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isFirstUnread = firstUnreadIndex !== null && index === firstUnreadIndex;
              const isLastInGroup =
                index === messages.length - 1 ||
                messages[index + 1].timestamp !== msg.timestamp;

              return (
                <div
                  key={msg.id}
                  ref={isFirstUnread ? firstUnreadRef : undefined}
                  className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl break-words leading-relaxed shadow-sm ${
                      msg.isMe
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : 'bg-slate-800 border border-slate-700/80 text-slate-100 rounded-bl-xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                  {isLastInGroup && (
                    <div className="text-[10px] text-slate-400 mt-0.5 px-1 font-mono select-none">
                      {msg.timestamp}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Floating Down Arrow Button */}
        {showScrollBottomBtn && (
          <button
            onClick={scrollToBottom}
            title="Cuộn xuống tin nhắn mới nhất"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 p-2 bg-slate-800/95 hover:bg-slate-700 backdrop-blur-md text-blue-400 border border-slate-700 rounded-full shadow-xl transition-all flex items-center justify-center z-10 hover:scale-105 active:scale-95"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Nhập tin nhắn..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-[16px] sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="cursor-pointer p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition-all shadow-md shadow-blue-600/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
