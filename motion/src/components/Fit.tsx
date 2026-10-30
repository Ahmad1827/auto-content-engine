import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {continueRender, delayRender} from 'remotion';

// Runs `measure` on every frame, and once more when web fonts finish, holding the frame until then.
function useMeasure(measure: () => void) {
  useLayoutEffect(measure);
  const latest = useRef(measure);
  latest.current = measure;
  useEffect(() => {
    const handle = delayRender('Fitting text');
    document.fonts.ready.then(() => {
      latest.current();
      continueRender(handle);
    });
  }, []);
}

// One line of type at `size`, shrunk to what it really measures. `sizer` reserves the width of text still counting up.
export const Fit: React.FC<{size: number; max: number; sizer?: string; style?: React.CSSProperties; children: React.ReactNode}> = ({size, max, sizer, style, children}) => {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const hidden = useRef<HTMLSpanElement>(null);
  useMeasure(() => {
    if (!outer.current || !inner.current) return;
    outer.current.style.fontSize = `${size}px`;
    const width = Math.max(inner.current.offsetWidth, hidden.current?.offsetWidth ?? 0);
    if (width > max) outer.current.style.fontSize = `${(size * max) / width}px`;
  });
  return (
    <div ref={outer} style={{fontSize: size, whiteSpace: 'nowrap', ...style}}>
      <span ref={inner} style={{display: 'inline-block'}}>{children}</span>
      {sizer && <span ref={hidden} style={{position: 'absolute', visibility: 'hidden'}}>{sizer}</span>}
    </div>
  );
};

// Wrapping text at `size`, stepped down until it fits `maxHeight` and its longest word fits the width.
export const FitText: React.FC<{size: number; maxHeight: number; style?: React.CSSProperties; children: React.ReactNode}> = ({size, maxHeight, style, children}) => {
  const ref = useRef<HTMLDivElement>(null);
  useMeasure(() => {
    const el = ref.current;
    if (!el) return;
    let s = size;
    el.style.fontSize = `${s}px`;
    // Layout widths, so letters still flying in don't count.
    const tooWide = () => Array.from(el.querySelectorAll('span')).some((span) => span.offsetWidth > el.clientWidth);
    for (let i = 0; i < 24 && (el.offsetHeight > maxHeight || tooWide()); i++) {
      s *= 0.92;
      el.style.fontSize = `${s}px`;
    }
  });
  return <div ref={ref} style={{fontSize: size, maxWidth: '100%', ...style}}>{children}</div>;
};

// A whole block scaled down, from its top, if it would run past `maxHeight`.
export const FitBlock: React.FC<{maxHeight: number; origin: string; style?: React.CSSProperties; children: React.ReactNode}> = ({maxHeight, origin, style, children}) => {
  const ref = useRef<HTMLDivElement>(null);
  useMeasure(() => {
    const el = ref.current;
    if (el) el.style.transform = `scale(${Math.min(1, maxHeight / Math.max(1, el.offsetHeight))})`;
  });
  return <div ref={ref} style={{transformOrigin: origin, ...style}}>{children}</div>;
};

// Layout size of an element, unaffected by the camera's transforms.
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({w: 0, h: 0});
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && (el.offsetWidth !== size.w || el.offsetHeight !== size.h)) setSize({w: el.offsetWidth, h: el.offsetHeight});
  });
  return [ref, size] as const;
}
