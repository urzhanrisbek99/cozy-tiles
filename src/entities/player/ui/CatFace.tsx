import { useId } from 'react';

export const CAT_COATS = [
  { fur: '#fdf6ec', patch: '#8d817a', ear: '#f4b6c2', line: '#5a4650', label: 'Молочко' },
  { fur: '#3b3442', patch: '#2c2632', ear: '#e79bb0', line: '#f6eaf2', label: 'Уголёк' },
  { fur: '#f3b46e', patch: '#e2914a', ear: '#f8c4b4', line: '#6b3f2a', label: 'Персик' },
  { fur: '#bdb6c9', patch: '#8f88a1', ear: '#f2b8c6', line: '#4b4458', label: 'Туман' },
  { fur: '#b08f74', patch: '#7e6352', ear: '#f0b9a8', line: '#3f2d24', label: 'Какао' },
  { fur: '#ffffff', patch: '#f1c38c', ear: '#f7c1cc', line: '#6a5560', label: 'Зефир' },
];

export function CatFace({ coat = 0, awake = false, className }: { coat?: number; awake?: boolean; className?: string }) {
  const c = CAT_COATS[coat] ?? CAT_COATS[0];
  const clip = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <clipPath id={clip}>
          <ellipse cx="50" cy="58" rx="38" ry="31" />
        </clipPath>
      </defs>
      <path d="M17 44 L23 9 L47 30 Z" fill={c.fur} />
      <path d="M83 44 L77 9 L53 30 Z" fill={c.fur} />
      <path d="M23 36 L26 18 L38 30 Z" fill={c.ear} />
      <path d="M77 36 L74 18 L62 30 Z" fill={c.ear} />
      <ellipse cx="50" cy="58" rx="38" ry="31" fill={c.fur} />
      <g clipPath={`url(#${clip})`}>
        <ellipse cx="70" cy="36" rx="20" ry="15" fill={c.patch} />
      </g>
      {awake ? (
        <>
          <ellipse cx="35" cy="58" rx="4" ry="5" fill={c.line} />
          <ellipse cx="65" cy="58" rx="4" ry="5" fill={c.line} />
          <circle cx="36.3" cy="56.3" r="1.4" fill="#fff" />
          <circle cx="66.3" cy="56.3" r="1.4" fill="#fff" />
        </>
      ) : (
        <>
          <path d="M29 58 q6 5 12 0" stroke={c.line} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M59 58 q6 5 12 0" stroke={c.line} strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      )}
      <ellipse cx="25" cy="69" rx="6" ry="3.6" fill="#f59fb2" opacity="0.55" />
      <ellipse cx="75" cy="69" rx="6" ry="3.6" fill="#f59fb2" opacity="0.55" />
      <path d="M47.5 64 h5 l-2.5 3 z" fill="#ef8ea4" />
      <path d="M44 69 q3 4 6 0 q3 4 6 0" stroke={c.line} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
