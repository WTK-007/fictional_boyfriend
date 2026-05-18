'use client';

import { ChatProvider, useChat } from '@/context/ChatContext';
import ChatScreen from '@/components/ChatScreen';
import CharacterSelect from '@/components/CharacterSelect';

function ClientRouter() {
  const { chatState } = useChat();

  if (chatState.character) {
    return <ChatScreen />;
  }

  return <CharacterSelect />;
}

export default function ChatPage() {
  return (
    <ChatProvider>
      <ClientRouter />
    </ChatProvider>
  );
}
