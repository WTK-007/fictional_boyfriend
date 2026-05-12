'use client';

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { ChatState, Character, Message } from '@/types/chat';
import { parseReply } from '@/utils/parseReply';

interface ChatContextType {
  chatState: ChatState;
  selectCharacter: (character: Character) => void;
  sendMessage: (content: string) => void;
  resetChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [chatState, setChatState] = useState<ChatState>({
    character: null,
    messages: [],
    isTyping: false,
    isGeneratingImage: false,
  });

  const isGeneratingRef = useRef(false);

  const selectCharacter = useCallback((character: Character) => {
    setChatState({
      character,
      messages: [],
      isTyping: false,
      isGeneratingImage: false,
    });
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (isGeneratingRef.current) return;
    if (!chatState.character) return;

    isGeneratingRef.current = true;

    // 1. 添加用户消息
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      type: 'text',
      content,
      timestamp: Date.now(),
    };

    const currentCharacter = chatState.character;
    const prevMessages = chatState.messages;

    setChatState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isTyping: true,
    }));

    try {
      // 2. 调用 LLM
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: currentCharacter.id,
          messages: [...prevMessages, userMessage].map((msg) => ({
            role: msg.role === 'character' ? 'assistant' : 'user',
            content: msg.content,
          })),
        }),
      });

      const chatData = await chatResponse.json();
      const reply: string = chatData.reply || '网络不太好，等一下再试试～';

      // 3. 解析回复
      const { text, imagePrompt } = parseReply(reply);

      // 4. 添加角色文字消息
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

      // 5. 并行：生成语音 + 生成图片（如果有）
      const uid = `user-${Date.now()}`;

      // 语音生成
      fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          speaker: currentCharacter.speaker,
          uid,
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

      // 图片生成
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
  }, [chatState.character, chatState.messages]);

  const resetChat = useCallback(() => {
    isGeneratingRef.current = false;
    setChatState({
      character: null,
      messages: [],
      isTyping: false,
      isGeneratingImage: false,
    });
  }, []);

  return (
    <ChatContext.Provider
      value={{ chatState, selectCharacter, sendMessage, resetChat }}
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
