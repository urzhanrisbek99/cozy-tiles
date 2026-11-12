import { useEffect, useState, type RefObject } from 'react';

interface Thumb {
  size: number;
  offset: number;
}

export function ScrollHint({ target, className = '' }: { target: RefObject<HTMLElement | null>; className?: string }) {
  const [thumb, setThumb] = useState<Thumb | null>(null);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const update = () => {
      const { scrollWidth, clientWidth, scrollLeft } = el;
      setThumb(scrollWidth - clientWidth > 4 ? { size: clientWidth / scrollWidth, offset: scrollLeft / scrollWidth } : null);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [target]);

  if (!thumb) return null;
  return (
    <div className={`scroll-hint ${className}`} aria-hidden>
      <span style={{ width: `${thumb.size * 100}%`, left: `${thumb.offset * 100}%` }} />
    </div>
  );
}
