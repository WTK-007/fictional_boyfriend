'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useChat } from '@/context/ChatContext';
import { Message } from '@/types/chat';
import { ArrowLeft, Send, Loader2, Play, Pause, X, ImageOff } from 'lucide-react';

export default function ChatScreen() {
  const { chatState, sendMessage, resetChat } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatState.messages, chatState.isTyping]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!chatState.character) return null;

  return (
    <div className="min-h-screen bg-[#EDEDED] flex flex-col">
      {/* 顶部导航 */}
      <header className="bg-[#EDEDED] border-b border-gray-200 px-3 py-2 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={resetChat}
          className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
          <Image
            src={chatState.character.avatar}
            alt={chatState.character.name}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-gray-800">
            {chatState.character.name}
          </h2>
          <p className="text-xs text-green-500">
            {chatState.isTyping ? '正在输入...' : '在线'}
          </p>
        </div>
      </header>

      {/* 聊天区域 */}
      <main className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {chatState.messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            characterAvatar={chatState.character!.avatar}
            onViewImage={setViewingImage}
          />
        ))}

        {/* 正在输入动画 */}
        {chatState.isTyping && (
          <div className="flex items-end gap-2">
            <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
              <Image
                src={chatState.character.avatar}
                alt={chatState.character.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
              <TypingDots />
            </div>
          </div>
        )}

        {/* 图片生成提示 */}
        {chatState.isGeneratingImage && (
          <div className="flex items-end gap-2">
            <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
              <Image
                src={chatState.character.avatar}
                alt={chatState.character.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-pink-400" />
              <span className="text-sm text-gray-400">正在拍照...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* 底部输入框 */}
      <footer className="bg-[#F5F5F5] border-t border-gray-200 px-3 py-2 flex items-center gap-2 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="说点什么..."
          className="flex-1 bg-white rounded-full px-4 py-2 text-sm outline-none border border-gray-200 focus:border-pink-300 focus:ring-1 focus:ring-pink-200 transition-all"
          disabled={chatState.isTyping}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || chatState.isTyping}
          className="w-9 h-9 rounded-full bg-pink-500 text-white flex items-center justify-center hover:bg-pink-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          aria-label="发送"
        >
          <Send className="w-4 h-4" />
        </button>
      </footer>

      {/* 图片全屏预览 */}
      {viewingImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
          onClick={() => setViewingImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
            onClick={() => setViewingImage(null)}
            aria-label="关闭"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative max-w-[90vw] max-h-[90vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewingImage}
              alt="大图预览"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// 消息气泡组件
function MessageBubble({
  message,
  characterAvatar,
  onViewImage,
}: {
  message: Message;
  characterAvatar: string;
  onViewImage: (uri: string) => void;
}) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end items-end gap-2">
        <div className="max-w-[70%]">
          {message.type === 'text' && (
            <div className="bg-[#95EC69] rounded-2xl rounded-br-sm px-3.5 py-2 shadow-sm">
              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                {message.content}
              </p>
            </div>
          )}
        </div>
        <div className="w-9 h-9 rounded-full bg-blue-400 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
          我
        </div>
      </div>
    );
  }

  // 角色消息
  return (
    <div className="flex items-end gap-2">
      <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
        <Image
          src={characterAvatar}
          alt="角色头像"
          fill
          className="object-cover"
          unoptimized
        />
      </div>
      <div className="max-w-[70%]">
        {message.type === 'text' && (
          <div className="bg-white rounded-2xl rounded-bl-sm px-3.5 py-2 shadow-sm">
            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
        )}
        {message.type === 'voice' && message.audioUri && (
          <VoiceBubble audioUri={message.audioUri} />
        )}
        {message.type === 'image' && (
          <ImageBubble
            imageUri={message.imageUri}
            onViewImage={onViewImage}
          />
        )}
      </div>
    </div>
  );
}

// 语音消息气泡 - 预定义的波形高度（避免渲染时调用 Math.random）
const VOICE_BAR_HEIGHTS = [12, 20, 16, 24, 10, 18, 22, 14, 20, 8, 16, 24];

function VoiceBubble({ audioUri }: { audioUri: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUri);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(Math.ceil(audio.duration));
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
    });

    return () => {
      audio.pause();
      audio.removeEventListener('ended', () => setIsPlaying(false));
    };
  }, [audioUri]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="bg-white rounded-2xl rounded-bl-sm px-3.5 py-2 shadow-sm flex items-center gap-2 min-w-[120px]">
      <button
        onClick={togglePlay}
        className="w-7 h-7 rounded-full bg-pink-50 flex items-center justify-center flex-shrink-0 hover:bg-pink-100 transition-colors"
        aria-label={isPlaying ? '暂停' : '播放'}
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5 text-pink-500" />
        ) : (
          <Play className="w-3.5 h-3.5 text-pink-500 ml-0.5" />
        )}
      </button>
      {/* 语音波形动画 */}
      <div className="flex items-center gap-0.5 flex-1">
        {VOICE_BAR_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className={`w-0.5 rounded-full transition-all duration-300 ${
              isPlaying
                ? 'bg-pink-400 animate-pulse'
                : 'bg-pink-200'
            }`}
            style={{
              height: `${h}px`,
              animationDelay: isPlaying ? `${i * 0.1}s` : undefined,
            }}
          />
        ))}
      </div>
      <span className="text-xs text-gray-400 flex-shrink-0">{duration}&quot;</span>
    </div>
  );
}

// 图片消息气泡
function ImageBubble({
  imageUri,
  onViewImage,
}: {
  imageUri?: string;
  onViewImage: (uri: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!imageUri) {
    return (
      <div className="bg-white rounded-2xl rounded-bl-sm p-3 shadow-sm flex items-center gap-2">
        <ImageOff className="w-4 h-4 text-gray-400" />
        <span className="text-xs text-gray-400">图片加载失败</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl rounded-bl-sm p-3 shadow-sm flex items-center gap-2">
        <ImageOff className="w-4 h-4 text-gray-400" />
        <span className="text-xs text-gray-400">图片加载失败</span>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-2xl rounded-bl-sm overflow-hidden shadow-sm cursor-pointer max-w-[240px]"
      onClick={() => onViewImage(imageUri)}
    >
      {!loaded && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUri}
        alt="角色发送的照片"
        className={`w-full object-cover transition-opacity duration-500 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

// 正在输入动画
function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}
