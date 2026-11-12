export function SleepyCat({ awake }: { awake: boolean }) {
  return (
    <svg viewBox="0 0 220 140" className={`sleepy-cat ${awake ? 'awake' : ''}`} aria-hidden>
      <ellipse cx="110" cy="122" rx="104" ry="18" fill="#e9a3b4" />
      <ellipse cx="110" cy="116" rx="98" ry="16" fill="#f4bccb" />
      <g className="cat-body">
        <path d="M168 104 q34 -6 26 -32 q-4 -10 -12 -6 q8 18 -18 26 z" fill="#3b3442" />
        <ellipse cx="118" cy="92" rx="62" ry="30" fill="#3b3442" />
        <g className="cat-head">
          <path d="M44 74 L50 40 L72 60 Z" fill="#3b3442" />
          <path d="M102 74 L96 40 L76 60 Z" fill="#3b3442" />
          <path d="M51 63 L54 49 L64 59 Z" fill="#e79bb0" />
          <path d="M95 63 L92 49 L82 59 Z" fill="#e79bb0" />
          <ellipse cx="73" cy="84" rx="36" ry="27" fill="#3b3442" />
          {awake ? (
            <>
              <ellipse cx="60" cy="82" rx="4" ry="5" fill="#f6e3a1" />
              <ellipse cx="86" cy="82" rx="4" ry="5" fill="#f6e3a1" />
              <ellipse cx="60" cy="82" rx="1.6" ry="4" fill="#2c2632" />
              <ellipse cx="86" cy="82" rx="1.6" ry="4" fill="#2c2632" />
            </>
          ) : (
            <>
              <path d="M54 83 q6 5 12 0" stroke="#f6eaf2" strokeWidth="2.6" fill="none" strokeLinecap="round" />
              <path d="M80 83 q6 5 12 0" stroke="#f6eaf2" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            </>
          )}
          <ellipse cx="51" cy="93" rx="5.5" ry="3" fill="#f59fb2" opacity="0.5" />
          <ellipse cx="95" cy="93" rx="5.5" ry="3" fill="#f59fb2" opacity="0.5" />
          <path d="M70 92 q3 3 6 0" stroke="#f6eaf2" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
        <ellipse cx="96" cy="112" rx="14" ry="7" fill="#463e4f" />
      </g>
      {!awake && (
        <g className="zzz" fill="#fff8ef">
          <text x="120" y="46" fontSize="16">z</text>
          <text x="134" y="32" fontSize="12">z</text>
          <text x="145" y="20" fontSize="9">z</text>
        </g>
      )}
    </svg>
  );
}

export function Mug() {
  return (
    <svg viewBox="0 0 120 140" className="mug" aria-hidden>
      <g className="steam" stroke="#fff8ef" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.8">
        <path d="M44 48 q-10 -12 0 -24 q10 -12 0 -22" />
        <path d="M66 50 q-10 -12 0 -24 q10 -12 0 -22" />
      </g>
      <path d="M86 78 q24 0 22 20 q-2 18 -24 16" stroke="#f2e6dc" strokeWidth="9" fill="none" />
      <path d="M22 64 h68 v50 q0 20 -20 20 h-28 q-20 0 -20 -20 z" fill="#fbf3ea" />
      <ellipse cx="56" cy="64" rx="34" ry="7" fill="#7a4e36" />
      <path d="M56 112 s-12 -7 -12 -15 c0 -4 3 -7 6 -7 3 0 5 2 6 3 1 -1 3 -3 6 -3 3 0 6 3 6 7 0 8 -12 15 -12 15z" fill="#f08aa2" />
    </svg>
  );
}
