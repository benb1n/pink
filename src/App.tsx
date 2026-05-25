import { usePinkNoise } from './hooks/usePinkNoise';
import { WaveCanvas } from './components/WaveCanvas';

const WaveIcon = () => (
  <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden="true">
    <path d="M1 7C3 3 5 1 7 7C9 13 11 13 13 7C15 1 17 1 19 7C20.2 10.2 20.8 11.6 21 12" stroke="#d4688c" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M1 11C3 8 5 7 7 11C9 15 11 15 13 11C15 7 17 7 19 11" stroke="#d4688c" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
  </svg>
);

const InfinityIcon = () => (
  <svg width="20" height="12" viewBox="0 0 20 12" fill="none" aria-hidden="true">
    <path d="M7 6C7 6 5.5 2 3.5 2C1.5 2 0.5 4 0.5 6C0.5 8 1.5 10 3.5 10C5.5 10 8 6 10 6C12 6 14.5 10 16.5 10C18.5 10 19.5 8 19.5 6C19.5 4 18.5 2 16.5 2C14.5 2 13 6 13 6" stroke="#d4688c" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const SpeakerIcon = () => (
  <svg width="18" height="16" viewBox="0 0 18 16" fill="none" aria-hidden="true">
    <path d="M2 5H5L9 1V15L5 11H2C1.4 11 1 10.6 1 10V6C1 5.4 1.4 5 2 5Z" stroke="#d4688c" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M12 2.5C13.5 3.8 14.5 5.8 14.5 8C14.5 10.2 13.5 12.2 12 13.5" stroke="#d4688c" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M14.5 0.5C16.8 2.3 18.2 5 18.2 8C18.2 11 16.8 13.7 14.5 15.5" stroke="#d4688c" strokeWidth="1.5" strokeLinecap="round" opacity="0.55"/>
  </svg>
);

export default function App() {
  const { state, play, stop } = usePinkNoise();
  const playing = state === 'playing';
  const loading = state === 'loading';

  const handleToggle = () => {
    if (playing) stop();
    else play();
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#1a0812] flex flex-col">
      <WaveCanvas playing={playing} />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-7 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <WaveIcon />
          <span
            className="text-[#d4688c] tracking-[0.2em] text-xs font-medium"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            PINK NOISE
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full transition-all duration-700"
            style={{
              background: playing ? '#d4688c' : '#5a2a40',
              boxShadow: playing ? '0 0 8px #d4688c' : 'none',
            }}
          />
          <span
            className="text-[#7a3a58] tracking-[0.18em] text-xs font-medium"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {playing ? 'PLAYING' : 'IDLE'}
          </span>
        </div>
      </div>

      {/* Center content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <h1
          className="text-[#e879a0] text-center leading-tight m-0"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 400,
            fontSize: 'clamp(52px, 10vw, 96px)',
            letterSpacing: '-0.01em',
          }}
        >
          Pink Noise
        </h1>
        <p
          className="text-[#7a3a58] tracking-[0.22em] text-sm text-center"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          SLEEP MACHINE
        </p>
        <p
          className="text-[#a05070] text-center text-base leading-relaxed max-w-xs mt-1"
          style={{ fontFamily: 'Inter, sans-serif', fontWeight: 300 }}
        >
          A smooth, balanced sound<br />to help you drift into deep sleep.
        </p>

        {/* Play / Stop button */}
        <button
          onClick={handleToggle}
          disabled={loading}
          aria-label={playing ? 'Stop' : 'Play'}
          className="mt-8 w-28 h-28 rounded-full border border-[#d4688c]/40 flex items-center justify-center transition-all duration-300 active:scale-95 focus:outline-none disabled:opacity-60"
          style={{
            background: 'rgba(180, 60, 110, 0.12)',
            boxShadow: playing
              ? '0 0 50px rgba(212,104,140,0.35), inset 0 0 20px rgba(212,104,140,0.05)'
              : '0 0 20px rgba(212,104,140,0.1)',
          }}
        >
          {loading ? (
            <svg className="animate-spin w-8 h-8 text-[#d4688c]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : playing ? (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="6" y="5" width="5" height="18" rx="2" fill="#d4688c" />
              <rect x="17" y="5" width="5" height="18" rx="2" fill="#d4688c" />
            </svg>
          ) : (
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <path d="M10 6L24 15L10 24V6Z" fill="#d4688c" />
            </svg>
          )}
        </button>

        <p
          className="text-[#7a3a58] tracking-[0.2em] text-xs mt-2"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {playing ? 'TAP TO STOP' : 'TAP TO PLAY'}
        </p>
      </div>

      {/* Bottom bar */}
      <div className="relative z-10 flex items-center justify-between px-6 pb-8 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <InfinityIcon />
          <span
            className="text-[#7a3a58] tracking-[0.18em] text-xs"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            SEAMLESS LOOP
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <SpeakerIcon />
          <span
            className="text-[#7a3a58] tracking-[0.18em] text-xs"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            OPTIMIZED FOR SLEEP
          </span>
        </div>
      </div>
    </div>
  );
}
