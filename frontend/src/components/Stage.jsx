import { useRef } from 'react';

// A section with the background effect: fine grid + a cyan grid that lights up around the cursor.
// blobs = the two moving colored lights.   fixed = cover the whole screen (pages without sections).
// fade  = fade the effect out toward the bottom edge.
// edge  = glowing line on the top edge (cyan, brightest in the middle).
// snap  = scroll "stops" at the start of this section.
export default function Stage({ blobs = false, fixed = false, fade = false, edge = false, snap = false, className = '', children }) {
  const lit = useRef(null);

  // Cursor position inside this block, written as CSS variables on the lit grid.
  const move = (e) => {
    const box = lit.current.getBoundingClientRect();
    lit.current.style.setProperty('--mx', `${e.clientX - box.left}px`);
    lit.current.style.setProperty('--my', `${e.clientY - box.top}px`);
  };

  // fixed: the background starts under the navbar (4.1rem), like on Home, so the navbar looks the same on every page.
  return (
      <div onMouseMove={move}
           className={`relative isolate ${fixed ? '' : 'overflow-hidden'} ${snap ? 'snap-section' : ''} ${className}`}>
        <div aria-hidden
             className={`pointer-events-none -z-10 overflow-hidden ${fixed ? 'fixed inset-x-0 bottom-0 top-[4.1rem]' : 'absolute inset-0'} ${fade ? 'fade-b' : ''}`}>
          {blobs && (
              <>
                <div className="blob-a absolute -left-40 -top-40 h-[620px] w-[620px] rounded-full bg-violet/25 blur-[150px] will-change-transform" />
                <div className="blob-b absolute -bottom-40 -right-40 h-[620px] w-[620px] rounded-full bg-accent-strong/20 blur-[150px] will-change-transform" />
              </>
          )}
          <div className="bg-grid absolute inset-0" />
          <div ref={lit} className="bg-grid-lit absolute inset-0" />
          <div className="bg-noise absolute inset-0" />
          {edge && (
              <>
                <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
                <div className="edge-glow absolute inset-x-0 top-0 h-40" />
                <div className="edge-line absolute inset-x-0 top-0 h-px" />
              </>
          )}
        </div>
        {children}
      </div>
  );
}
