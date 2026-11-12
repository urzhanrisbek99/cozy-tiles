import { memo, useEffect, type RefObject } from 'react';
import { audio } from '@/shared/lib/audio/engine';
import { useTimeLeft } from '../model/useTimeLeft';

const HURRY_SECONDS = 10;
const URGENT_SECONDS = 3;

export const TimerRing = memo(function TimerRing({ deadline, total }: { deadline: number; total: number }) {
  const left = useTimeLeft(deadline);
  return (
    <svg className="ring" viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="18" pathLength="1" style={{ strokeDashoffset: 1 - Math.min(1, left / (total * 1000)) }} />
    </svg>
  );
});

export const SecondsLeft = memo(function SecondsLeft({ deadline }: { deadline: number }) {
  const seconds = Math.ceil(useTimeLeft(deadline) / 1000);
  return <span className={`secs ${seconds <= HURRY_SECONDS ? 'low' : ''}`}> · {seconds}с</span>;
});

export const Countdown = memo(function Countdown({ deadline, root }: { deadline: number; root: RefObject<HTMLElement | null> }) {
  const seconds = Math.ceil(useTimeLeft(deadline) / 1000);
  const hurry = seconds > 0 && seconds <= HURRY_SECONDS;

  useEffect(() => {
    if (hurry) audio.clock(seconds <= URGENT_SECONDS);
  }, [seconds, hurry]);

  useEffect(() => {
    const el = root.current;
    el?.classList.toggle('hurry', hurry);
    return () => el?.classList.remove('hurry');
  }, [hurry, root]);

  if (!hurry) return null;
  return (
    <div className="countdown" key={seconds} aria-hidden>
      {seconds}
    </div>
  );
});
