import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@core/types';
import { useRoomSession } from '@/features/room-session';
import { GamePage } from '@/pages/game';
import { HomePage } from '@/pages/home';
import { LobbyPage } from '@/pages/lobby';
import { CodeStep, NameStep } from '@/pages/welcome';
import { THEMES } from '@/shared/config/themes';
import { audio } from '@/shared/lib/audio/engine';
import { usePrefs } from '@/shared/lib/prefs';
import { FloatingChat } from '@/widgets/chat';
import { Controls } from '@/widgets/controls';
import { RulesDialog } from '@/widgets/rules-dialog';
import { Scene } from '@/widgets/scene';

const TOAST_MS = 3200;

function useToast() {
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const flash = useCallback((text: string) => {
    const key = Date.now();
    setToast({ text, key });
    window.setTimeout(() => setToast((current) => (current?.key === key ? null : current)), TOAST_MS);
  }, []);
  return { toast, flash };
}

export function App() {
  const [prefs, update] = usePrefs();
  const { toast, flash } = useToast();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [step, setStep] = useState<'name' | 'code' | null>(null);
  const chatState = useRef({ you: '', hidden: false });

  const onChat = useCallback((message: ChatMessage) => {
    if (message.playerId === null || message.playerId === chatState.current.you) return;
    audio.pop();
    if (chatState.current.hidden) setUnread((n) => n + 1);
  }, []);

  const room = useRoomSession({ name: prefs.name, avatar: prefs.avatar, notify: flash, onChat });
  const { view } = room;
  const inGame = view !== null && view.phase !== 'lobby';
  const named = prefs.name.trim() !== '';
  const entry = view ? null : !named || step === 'name' ? 'name' : (step ?? 'home');
  chatState.current = { you: view?.you ?? '', hidden: inGame && !chatOpen };

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    const color = THEMES.find((t) => t.id === prefs.theme)?.color ?? THEMES[0].color;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }, [prefs.theme]);

  useEffect(() => {
    audio.setVolume(prefs.volume);
    audio.sfxEnabled = prefs.sfx;
  }, [prefs.volume, prefs.sfx]);

  useEffect(() => {
    if (!prefs.music) {
      audio.stop();
      return;
    }
    if (audio.isPlaying) return;
    const events = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
    const unlock = () => {
      audio.start();
      events.forEach((name) => window.removeEventListener(name, unlock));
    };
    events.forEach((name) => window.addEventListener(name, unlock));
    return () => events.forEach((name) => window.removeEventListener(name, unlock));
  }, [prefs.music]);

  useEffect(() => {
    const wake = () => document.visibilityState === 'visible' && audio.wake();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('pointerup', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('pointerup', wake);
    };
  }, []);

  const toggleChat = () => {
    setChatOpen((open) => !open);
    setUnread(0);
  };

  const leave = async () => {
    await room.leave();
    setStep(null);
    setChatOpen(false);
    setUnread(0);
  };

  return (
    <>
      <Scene theme={prefs.theme} />
      <div className={`app ${inGame ? 'in-game' : ''}`}>
        <Controls
          prefs={prefs}
          update={update}
          onRules={() => setRulesOpen(true)}
          onLeave={view ? leave : undefined}
          confirmLeave={view?.phase === 'playing'}
          chat={inGame ? { open: chatOpen, unread, toggle: toggleChat } : undefined}
        />
        {entry === 'name' && (
          <NameStep
            name={prefs.name}
            avatar={prefs.avatar}
            greet={!named}
            onDone={(name) => {
              update({ name });
              setStep(null);
            }}
            onBack={named ? () => setStep(null) : undefined}
          />
        )}
        {entry === 'code' && (
          <CodeStep
            onDone={(code) => {
              setStep(null);
              void room.join(code);
            }}
            onBack={() => setStep(null)}
          />
        )}
        {entry === 'home' && (
          <HomePage
            prefs={prefs}
            update={update}
            onCreate={room.create}
            onJoin={room.join}
            onRename={() => setStep('name')}
            onAskCode={() => setStep('code')}
          />
        )}
        {view?.phase === 'lobby' && <LobbyPage view={view} messages={room.messages} sendChat={room.sendChat} flash={flash} />}
        {inGame && <GamePage view={view} deadline={room.deadline} onLeave={leave} flash={flash} />}
      </div>

      {inGame && chatOpen && <FloatingChat messages={room.messages} you={view.you} send={room.sendChat} onClose={toggleChat} />}
      {!room.connected && <div className="offline-banner">Связь потерялась… переподключаемся ☁️</div>}
      {toast && (
        <div className="toast" role="status" key={toast.key}>
          {toast.text}
        </div>
      )}
      {rulesOpen && <RulesDialog onClose={() => setRulesOpen(false)} />}
    </>
  );
}
