import type { ChatMessage } from '@core/types';
import { useDraggable } from '@/shared/lib/useDraggable';
import { Chat } from './Chat';

interface Props {
  messages: ChatMessage[];
  you: string;
  send: (text: string) => Promise<boolean>;
  onClose: () => void;
}

export function FloatingChat({ messages, you, send, onClose }: Props) {
  const { ref, style, handle } = useDraggable('cozy-tiles:chat-position');
  return (
    <div className="chat-float" ref={ref} style={style}>
      <Chat
        messages={messages}
        you={you}
        send={send}
        title="Чат"
        hint="Напиши что-нибудь друзьям — сообщение увидят все за столом"
        onClose={onClose}
        headerProps={handle}
        autoFocus={window.matchMedia('(hover: hover)').matches}
      />
    </div>
  );
}
