'use client';

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { ChatState, Character, Message } from '@/types/chat';
import { getOrCreateUid } from '@/lib/userId';

const PAGE_SIZE = 20;

interface ChatContextType {
  chatState: ChatState;
  selectCharacter: (character: Character) => void;
  sendMessage: (content: string) => void;
  loadMoreMessages: () => Promise<void>;
  resetChat: () => void;
}

const initialState: ChatState = {
  character: null,
  messages: [],
  isTyping: false,
  isGeneratingImage: false,
  hasMoreMessages: false,
  isLoadingMore: false,
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [chatState, setChatState] = useState<ChatState>(initialState);

  const isGeneratingRef = useRef(false);
  // 防止并发翻页:同一时刻只允许一个 loadMore 在飞
  const isLoadingMoreRef = useRef(false);

  const selectCharacter = useCallback(async (character: Character) => {
    setChatState({
      ...initialState,
      character,
      isTyping: true, // 用 typing 状态先占位，避免空白闪烁
    });

    const uid = getOrCreateUid();
    try {
      const res = await fetch(
        `/api/messages?uid=${encodeURIComponent(uid)}&characterId=${encodeURIComponent(character.id)}&limit=${PAGE_SIZE}`,
      );
      const data = await res.json();
      const history: Message[] = Array.isArray(data.messages) ? data.messages : [];
      const hasMore = Boolean(data.hasMore);
      setChatState({
        ...initialState,
        character,
        messages: history,
        hasMoreMessages: hasMore,
      });
    } catch (err) {
      console.error('Load history error:', err);
      setChatState({
        ...initialState,
        character,
      });
    }
  }, []);

  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMoreRef.current) return;
    // 用函数式读取最新状态,避免 stale closure
    let snapshot: ChatState | null = null;
    setChatState((prev) => {
      snapshot = prev;
      return prev;
    });
    if (!snapshot) return;
    const { character, messages, hasMoreMessages } = snapshot as ChatState;
    if (!character || !hasMoreMessages || messages.length === 0) return;

    // 找到当前最老的「真实库里的消息」id 作为 cursor
    // 客户端乐观插入的 id 形如 user-/char-/voice-/img-/err-,跳过这些
    const oldestRealId = (() => {
      for (const m of messages) {
        const n = Number(m.id);
        if (Number.isFinite(n) && n > 0) return n;
      }
      return null;
    })();
    if (oldestRealId === null) return;

    isLoadingMoreRef.current = true;
    setChatState((prev) => ({ ...prev, isLoadingMore: true }));

    const uid = getOrCreateUid();
    try {
      const res = await fetch(
        `/api/messages?uid=${encodeURIComponent(uid)}&characterId=${encodeURIComponent(character.id)}&limit=${PAGE_SIZE}&before=${oldestRealId}`,
      );
      const data = await res.json();
      const older: Message[] = Array.isArray(data.messages) ? data.messages : [];
      const hasMore = Boolean(data.hasMore);
      setChatState((prev) => ({
        ...prev,
        messages: [...older, ...prev.messages],
        hasMoreMessages: hasMore,
        isLoadingMore: false,
      }));
    } catch (err) {
      console.error('Load more messages error:', err);
      setChatState((prev) => ({ ...prev, isLoadingMore: false }));
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (isGeneratingRef.current) return;
    if (!chatState.character) return;

    isGeneratingRef.current = true;

    const uid = getOrCreateUid();
    const currentCharacter = chatState.character;

    // 1. 乐观更新：用户消息立刻显示
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      type: 'text',
      content,
      timestamp: Date.now(),
    };

    setChatState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isTyping: true,
    }));

    try {
      // 2. 调用 LLM（同时落库用户消息 + 角色回复）
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: currentCharacter.id,
          uid,
          content,
        }),
      });

      const chatData = await chatResponse.json();
      const text: string = chatData.text || '网络不太好，等一下再试试～';
      const imagePrompt: string | null = chatData.imagePrompt ?? null;

      // 3. 角色文字消息
      const characterMessage: Message = {
        id: `char-${Date.now()}`,
        role: 'character',
        type: 'text',
        content: text,
        timestamp: Date.now(),
      };

      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, characterMessage],
        isTyping: false,
      }));

      // 4. 并行：语音 + 图片
      fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          speaker: currentCharacter.speaker,
          uid,
          characterId: currentCharacter.id,
        }),
      })
        .then((res) => res.json())
        .then((ttsData) => {
          if (ttsData.audioUri) {
            const voiceMessage: Message = {
              id: `voice-${Date.now()}`,
              role: 'character',
              type: 'voice',
              content: text,
              audioUri: ttsData.audioUri,
              timestamp: Date.now(),
            };
            setChatState((prev) => ({
              ...prev,
              messages: [...prev.messages, voiceMessage],
            }));
          }
        })
        .catch((err) => {
          console.error('TTS error (non-blocking):', err);
        });

      if (imagePrompt) {
        setChatState((prev) => ({ ...prev, isGeneratingImage: true }));

        fetch('/api/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: imagePrompt,
            characterId: currentCharacter.id,
            uid,
          }),
        })
          .then((res) => res.json())
          .then((imageData) => {
            if (imageData.imageUri) {
              const imageMessage: Message = {
                id: `img-${Date.now()}`,
                role: 'character',
                type: 'image',
                content: imagePrompt,
                imageUri: imageData.imageUri,
                timestamp: Date.now(),
              };
              setChatState((prev) => ({
                ...prev,
                messages: [...prev.messages, imageMessage],
                isGeneratingImage: false,
              }));
            } else {
              setChatState((prev) => ({ ...prev, isGeneratingImage: false }));
            }
          })
          .catch((err) => {
            console.error('Image generation error (non-blocking):', err);
            setChatState((prev) => ({ ...prev, isGeneratingImage: false }));
          });
      }
    } catch (error) {
      console.error('Send message error:', error);
      const errorMessage: Message = {
        id: `err-${Date.now()}`,
        role: 'character',
        type: 'text',
        content: '网络不太好，等一下再试试～',
        timestamp: Date.now(),
      };
      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isTyping: false,
      }));
    } finally {
      isGeneratingRef.current = false;
    }
  }, [chatState.character]);

  const resetChat = useCallback(() => {
    isGeneratingRef.current = false;
    isLoadingMoreRef.current = false;
    setChatState(initialState);
  }, []);

  return (
    <ChatContext.Provider
      value={{ chatState, selectCharacter, sendMessage, loadMoreMessages, resetChat }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
