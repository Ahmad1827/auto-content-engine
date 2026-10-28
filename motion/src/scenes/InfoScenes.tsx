import {Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {flagFile} from '../flags';
import {fitDisplay, useTheme} from '../theme';
import type {Visual} from '../types';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Vertical timeline; events appear one after another and the `active` one is highlighted.
export const TimelineScene: React.FC<{visual: Extract<Visual, {type: 'timeline'}>; durationInFrames: number}> = ({visual, durationInFrames}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const events = visual.events.slice(0, 5);
  const active = visual.active ?? events.length - 1;
  const top = 300;
  const span = 980;
  const gap = events.length > 1 ? span / (events.length - 1) : 0;
  const stagger = Math.min(18, (durationInFrames * 0.6) / Math.max(1, events.length));
  const lineP = interpolate(frame, [0, stagger * events.length], [0, 1], clamp);

  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: 140, top, width: 4, height: span * lineP, background: t.border}} />
      {events.map((e, i) => {
        const s = spring({frame: frame - i * stagger, fps, config: {damping: 14}});
        const on = i === active;
        const color = on ? t.accent : t.text;
        return (
          <div key={i} style={{position: 'absolute', left: 120, right: 72, top: top + i * gap - 30, display: 'flex', alignItems: 'center', gap: 44, opacity: on ? s : s * 0.75}}>
            <div
              style={{
                width: 44, height: 44, borderRadius: 22, flexShrink: 0, background: on ? t.accent : t.bg,
                border: `5px solid ${on ? t.accent : t.muted}`, transform: `scale(${s})`,
                boxShadow: on && t.glow > 0.5 ? `0 0 ${24 * t.glow}px ${t.accent}` : 'none',
              }}
            />
            <div style={{transform: `translateX(${(1 - s) * 60}px)`}}>
              <div style={{fontFamily: t.fonts.display, fontWeight: t.displayWeight, fontSize: fitDisplay(t, e.date, on ? 120 : 92, 760), lineHeight: 1, color, textShadow: t.shadow}}>
                {e.date}
              </div>
              <div style={{fontFamily: t.fonts.body, fontWeight: 600, fontSize: 40, lineHeight: 1.2, color: on ? t.text : t.muted, marginTop: 6}}>
                {e.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Big quote revealed word by word, with the source underneath.
export const QuoteScene: React.FC<{visual: Extract<Visual, {type: 'quote'}>; durationInFrames: number}> = ({visual, durationInFrames}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const words = visual.text.split(/\s+/);
  const shown = interpolate(frame, [6, durationInFrames * 0.7], [0, words.length], clamp);
  const size = words.length > 30 ? 56 : words.length > 18 ? 68 : words.length > 10 ? 80 : 96;
  const mark = spring({frame, fps: 30, config: {damping: 12}});

  return (
    <div style={{position: 'absolute', left: 90, right: 110, top: 380}}>
      <div style={{fontFamily: t.fonts.display, fontWeight: t.displayWeight, fontSize: 300, lineHeight: 0.6, height: 150, color: t.accent, opacity: mark, transform: `scale(${mark})`, transformOrigin: 'left top'}}>
        “
      </div>
      <div style={{fontFamily: t.fonts.body, fontWeight: 600, fontSize: size, lineHeight: 1.28, color: t.text, textShadow: t.shadow}}>
        {words.map((w, i) => (
          <span key={i} style={{opacity: interpolate(shown - i, [0, 1], [0.12, 1], clamp)}}>
            {w}{' '}
          </span>
        ))}
      </div>
      {visual.source && (
        <div style={{marginTop: 46, display: 'flex', alignItems: 'center', gap: 20, opacity: interpolate(shown, [words.length * 0.8, words.length], [0, 1], clamp)}}>
          <div style={{width: 70, height: 4, background: t.accent}} />
          <div style={{fontFamily: t.fonts.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: t.muted, textTransform: 'uppercase'}}>
            {visual.source}
          </div>
        </div>
      )}
    </div>
  );
};

const toNumber = (v: string) => {
  const n = parseFloat(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

// Side-by-side stats battle: flags and names on top, rows of numbers with bars growing from the middle.
export const VersusScene: React.FC<{visual: Extract<Visual, {type: 'versus'}>}> = ({visual}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const head = spring({frame, fps, config: {damping: 13}});
  const vs = spring({frame: frame - 8, fps, config: {damping: 8, stiffness: 220}});
  const rows = visual.rows.slice(0, 4);

  const Side: React.FC<{side: {name: string; flag?: string}; dir: 1 | -1}> = ({side, dir}) => {
    const flag = flagFile(side.flag);
    return (
      <div style={{width: 400, textAlign: 'center', transform: `translateX(${dir * (1 - head) * -300}px)`, opacity: head}}>
        {flag && <Img src={flag} style={{width: 170, height: 128, objectFit: 'cover', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.35)'}} />}
        <div style={{marginTop: 20, fontFamily: t.fonts.display, fontWeight: t.displayWeight, fontSize: fitDisplay(t, side.name, 80, 400), lineHeight: 1, color: t.text, textShadow: t.shadow}}>
          {side.name}
        </div>
      </div>
    );
  };

  return (
    <div style={{position: 'absolute', left: 72, right: 72, top: 270}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <Side side={visual.left} dir={1} />
        <div style={{fontFamily: t.fonts.display, fontWeight: t.displayWeight, fontSize: 110 * t.displayScale, color: t.accent, transform: `scale(${vs})`}}>VS</div>
        <Side side={visual.right} dir={-1} />
      </div>
      <div style={{marginTop: 70}}>
        {rows.map((r, i) => {
          const p = spring({frame: frame - 18 - i * 10, fps, config: {damping: 200}, durationInFrames: 22});
          const l = toNumber(r.left);
          const rr = toNumber(r.right);
          const max = Math.max(l, rr);
          const bars = max > 0;
          return (
            <div key={i} style={{marginBottom: 46, opacity: p}}>
              <div style={{textAlign: 'center', fontFamily: t.fonts.mono, fontWeight: 700, fontSize: 28, letterSpacing: 4, color: t.muted, textTransform: 'uppercase'}}>
                {r.label}
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6}}>
                <span style={{fontFamily: t.fonts.display, fontWeight: t.displayWeight, fontSize: fitDisplay(t, r.left, 96, 440), color: t.accent}}>{r.left}</span>
                <span style={{fontFamily: t.fonts.display, fontWeight: t.displayWeight, fontSize: fitDisplay(t, r.right, 96, 440), color: t.text}}>{r.right}</span>
              </div>
              {bars && (
                <div style={{display: 'flex', height: 14, marginTop: 8}}>
                  <div style={{flex: 1, display: 'flex', justifyContent: 'flex-end'}}>
                    <div style={{width: `${(l / max) * 100 * p}%`, background: t.accent, borderRadius: '7px 0 0 7px'}} />
                  </div>
                  <div style={{width: 6}} />
                  <div style={{flex: 1}}>
                    <div style={{width: `${(rr / max) * 100 * p}%`, height: '100%', background: t.text, opacity: 0.85, borderRadius: '0 7px 7px 0'}} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
