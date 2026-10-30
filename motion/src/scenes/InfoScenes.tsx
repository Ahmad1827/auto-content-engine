import {Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {cardStyle, Dress} from '../components/Card';
import {Fit, FitText} from '../components/Fit';
import {easeOut, ramp, rnd} from '../fx';
import {flagFile} from '../flags';
import {fitDisplay, STAGE, useTheme} from '../theme';
import type {Visual} from '../types';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Vertical timeline: a lit line runs down it, events land as cards when it reaches them, and the `active` one pulses.
export const TimelineScene: React.FC<{visual: Extract<Visual, {type: 'timeline'}>; durationInFrames: number}> = ({visual, durationInFrames}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const events = visual.events.slice(0, 5);
  const n = events.length;
  const active = visual.active ?? n - 1;
  const usable = STAGE.bottom - STAGE.top - 40;
  const rowH = Math.min(usable / n, 330);
  const gapY = 20;
  const top = STAGE.top + 20 + (usable - rowH * n) / 2;
  const stagger = Math.min(18, (durationInFrames * 0.6) / Math.max(1, n));
  const lineX = 112;
  const y = (i: number) => top + i * rowH + (rowH - gapY) / 2;
  // The lit part of the line stops at the last event that has landed, moving smoothly between them.
  const reach = interpolate(frame, [0, stagger * Math.max(1, n - 1)], [0, n - 1], clamp);
  const headY = y(0) + (y(n - 1) - y(0)) * (n > 1 ? reach / (n - 1) : 0);

  const dateSize = (on: boolean) => Math.min(rowH * 0.34, (on ? 104 : 84) * t.displayScale * 1.2);

  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', insetInlineStart: lineX - 3, top: y(0), width: 6, height: y(n - 1) - y(0), background: t.border}} />
      <div style={{position: 'absolute', insetInlineStart: lineX - 3, top: y(0), width: 6, height: headY - y(0), background: t.accent, boxShadow: t.glow > 0.5 ? `0 0 ${16 * t.glow}px ${t.accent}` : 'none'}} />
      {events.map((e, i) => {
        const s = spring({frame: frame - i * stagger, fps, config: {damping: 14}});
        const on = i === active;
        const pulse = (Math.max(0, frame - i * stagger) % 36) / 36;
        const color = on ? t.accent : t.text;
        return (
          <div key={i} style={{position: 'absolute', insetInlineStart: lineX - 26, insetInlineEnd: STAGE.right + 40, top: top + i * rowH, height: rowH - gapY, display: 'flex', alignItems: 'center', gap: 34}}>
            <div style={{position: 'relative', width: 52, height: 52, flexShrink: 0}}>
              {on && frame > i * stagger && <div style={{position: 'absolute', inset: -pulse * 34, borderRadius: t.render === 'pixel' ? 0 : '50%', border: `4px solid ${t.accent}`, opacity: 1 - pulse}} />}
              <div style={{position: 'absolute', inset: 0, borderRadius: t.render === 'pixel' ? 0 : '50%', background: on ? t.accent : t.bg, border: `6px solid ${on ? t.accent : t.muted}`, transform: `scale(${s})`, boxShadow: on && t.glow > 0.5 ? `0 0 ${24 * t.glow}px ${t.accent}` : 'none'}} />
            </div>
            <div style={{flex: 1, minWidth: 0, maxHeight: '100%', boxSizing: 'border-box', padding: '16px 26px', opacity: Math.min(1, s * 1.5), transform: `translateX(${(1 - s) * (t.rtl ? -80 : 80)}px)`, ...cardStyle(t, on)}}>
              <Fit size={dateSize(on)} max={680} style={{fontFamily: t.fonts.display, fontWeight: t.displayWeight, lineHeight: 1.1, color, textShadow: t.decor === 'ornate' || t.decor === 'press' ? 'none' : t.shadow}}>
                {e.date}
              </Fit>
              <FitText size={38} maxHeight={Math.max(50, rowH - gapY - 36 - dateSize(on) * 1.1)} style={{fontFamily: t.fonts.body, fontWeight: t.bodyWeight, lineHeight: 1.2, color: on ? t.text : t.muted, marginTop: 4}}>
                {e.label}
              </FitText>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Big quote whose words rise into place in a dressed panel, with the source underneath.
export const QuoteScene: React.FC<{visual: Extract<Visual, {type: 'quote'}>; durationInFrames: number}> = ({visual, durationInFrames}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = (t.wordGap ? visual.text.split(/\s+/) : [...visual.text]);
  const shown = interpolate(frame, [6, durationInFrames * 0.7], [0, words.length], clamp);
  const size = words.length > 30 ? 56 : words.length > 18 ? 68 : words.length > 10 ? 80 : 96;
  const mark = spring({frame, fps, config: {damping: 12}});
  const sway = Math.sin(frame / 30) * 5;

  return (
    <div style={{position: 'absolute', left: STAGE.left, right: STAGE.right, top: STAGE.top, bottom: 1920 - STAGE.bottom, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <Dress delay={0} pad={56} style={{width: '100%', boxSizing: 'border-box'}}>
        <div style={{fontFamily: t.fonts.display, fontWeight: t.displayWeight, fontSize: 260, lineHeight: 0.6, height: 130, color: t.accent, opacity: mark, transform: `scale(${mark}) rotate(${sway}deg)`, transformOrigin: t.rtl ? 'right top' : 'left top', textAlign: 'start'}}>
          {t.rtl ? '”' : '“'}
        </div>
        <FitText size={size} maxHeight={700} style={{fontFamily: t.fonts.body, fontWeight: t.bodyWeight, lineHeight: 1.28, color: t.text, textShadow: t.shadow}}>
          {words.map((w, i) => {
            const p = easeOut(interpolate(shown - i, [0, 1], [0, 1], clamp));
            return (
              <span key={i}>
                <span style={{display: 'inline-block', opacity: 0.12 + p * 0.88, transform: `translateY(${(1 - p) * 22}px)`}}>{w}</span>
                {t.wordGap}
              </span>
            );
          })}
        </FitText>
        {visual.source && (
          <div style={{marginTop: 40, display: 'flex', alignItems: 'center', gap: 20, opacity: interpolate(shown, [words.length * 0.8, words.length], [0, 1], clamp)}}>
            <div style={{width: 70, height: 4, flexShrink: 0, background: t.accent}} />
            <Fit size={30} max={660} style={{fontFamily: t.fonts.mono, fontWeight: 700, letterSpacing: 4, lineHeight: 1.3, color: t.muted, textTransform: 'uppercase'}}>
              {visual.source}
            </Fit>
          </div>
        )}
      </Dress>
    </div>
  );
};

// Reads "1,000", "1.000" and "١٠٠٠" alike: native digits become 0-9 and thousands separators go.
const toNumber = (v: string) => {
  const digits = v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x966));
  const n = parseFloat(digits.replace(/[.,٬](?=\d{3}(\D|$))/g, '').replace(/[,٫]/g, '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

// A stat while it spins: each digit runs through random values, settling from the left. Keeps the text's own format and units.
const rolling = (value: string, p: number, frame: number) => {
  if (p >= 1) return value;
  let seen = 0;
  const count = value.replace(/[^0-9]/g, '').length || 1;
  return value.replace(/[0-9]/g, (d) => (seen++ / count < p ? d : String(Math.floor(rnd(seen, frame) * 10))));
};

// Side-by-side stats battle: panels slide in from each side, flags wave, VS slams with a shockwave, and rows of numbers spin up over growing bars.
export const VersusScene: React.FC<{visual: Extract<Visual, {type: 'versus'}>}> = ({visual}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const head = spring({frame, fps, config: {damping: 13}});
  const vs = spring({frame: frame - 8, fps, config: {damping: 8, stiffness: 220}});
  const shock = ramp(frame, 8, 30);
  const rows = visual.rows.slice(0, 4);
  const headH = 300;
  const rowH = Math.min(270, (STAGE.bottom - STAGE.top - headH - 20) / Math.max(1, rows.length));
  const big = Math.min(124, rowH * 0.5);
  // The two tinted sides fade out at the foot instead of ending in a hard edge.
  const sideFade = 'linear-gradient(180deg, black 55%, transparent 100%)';

  const Side: React.FC<{side: {name: string; flag?: string}; dir: 1 | -1}> = ({side, dir}) => {
    const flag = flagFile(side.flag);
    const wave = Math.sin(frame / 9 + dir) * 3;
    return (
      <div style={{width: 370, textAlign: 'center', transform: `translateX(${dir * (1 - head) * -300}px)`, opacity: head}}>
        {flag && <Img src={flag} style={{width: 180, height: 134, objectFit: 'cover', borderRadius: t.render === 'pixel' ? 0 : 6, boxShadow: `0 8px 24px rgba(0,0,0,0.35), 0 0 ${18 * t.glow}px ${t.accent}55`, transform: `perspective(500px) rotateY(${wave * 4}deg) skewY(${wave}deg)`}} />}
        <Fit size={fitDisplay(t, side.name, 80, 370)} max={370} style={{marginTop: 18, fontFamily: t.fonts.display, fontWeight: t.displayWeight, lineHeight: 1.1, color: t.text, textShadow: t.shadow === 'none' ? 'none' : t.shadow}}>
          {side.name}
        </Fit>
      </div>
    );
  };

  return (
    // Left and right stay as written so the bars keep growing from the middle.
    <div style={{position: 'absolute', left: STAGE.left, right: STAGE.right, top: STAGE.top, direction: 'ltr'}}>
      <div style={{position: 'absolute', left: -72, top: -10, width: 540, height: STAGE.bottom - STAGE.top + 20, background: t.accent, opacity: 0.12, WebkitMaskImage: sideFade, clipPath: 'polygon(0 0, 100% 0, 88% 100%, 0 100%)', transform: `translateX(${(head - 1) * 540}px)`}} />
      <div style={{position: 'absolute', right: -72, top: -10, width: 540, height: STAGE.bottom - STAGE.top + 20, background: t.line, opacity: 0.07, WebkitMaskImage: sideFade, clipPath: 'polygon(12% 0, 100% 0, 100% 100%, 0 100%)', transform: `translateX(${(1 - head) * 540}px)`}} />
      <div style={{position: 'relative', height: headH, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <Side side={visual.left} dir={1} />
        <Side side={visual.right} dir={-1} />
        <svg width={400} height={400} viewBox="-200 -200 400 400" style={{position: 'absolute', left: 268, top: -50, overflow: 'visible'}}>
          {shock > 0 && shock < 1 && <circle r={40 + easeOut(shock) * 170} fill="none" stroke={t.accent} strokeWidth={10 * (1 - shock)} opacity={1 - shock} />}
          {Array.from({length: 12}, (_, i) => (
            <line key={i} x1={0} x2={0} y1={-62} y2={-62 - (4 + vs * 18 + Math.sin(frame / 5 + i) * 6)} stroke={t.accent} strokeWidth={4} transform={`rotate(${i * 30 + frame * 0.6})`} opacity={Math.min(1, vs) * 0.8} />
          ))}
        </svg>
        <div style={{position: 'absolute', left: 396, width: 144, textAlign: 'center', fontFamily: t.fonts.display, fontWeight: t.displayWeight, fontSize: 110 * t.displayScale, lineHeight: 1, color: t.accent, transform: `scale(${vs})`}}>VS</div>
      </div>
      <div style={{position: 'relative'}}>
        {rows.map((r, i) => {
          const delay = 18 + i * 10;
          const p = spring({frame: frame - delay, fps, config: {damping: 200}, durationInFrames: 22});
          const l = toNumber(r.left);
          const rr = toNumber(r.right);
          const max = Math.max(l, rr);
          const bars = max > 0;
          const roll = ramp(frame, delay, delay + 20);
          const value = (text: string, win: boolean, color: string) => (
            <Fit size={fitDisplay(t, text, big, 420)} max={420} sizer={text} style={{fontFamily: t.fonts.display, fontWeight: t.displayWeight, lineHeight: 1.1, color, transform: win && p >= 1 ? `scale(${1 + Math.abs(Math.sin(frame / 14)) * 0.04})` : undefined}}>
              {rolling(text, roll, frame)}
            </Fit>
          );
          return (
            <div key={i} style={{height: rowH, boxSizing: 'border-box', paddingBottom: 18, opacity: p, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
              <Fit size={28} max={780} style={{textAlign: 'center', fontFamily: t.fonts.mono, fontWeight: 700, letterSpacing: 4, lineHeight: 1.3, color: t.muted, textTransform: 'uppercase'}}>
                {r.label}
              </Fit>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 40, marginTop: 4}}>
                {value(r.left, l > rr, t.accent)}
                {value(r.right, rr > l, t.text)}
              </div>
              {bars && (
                <div style={{display: 'flex', height: 16, marginTop: 8}}>
                  <div style={{flex: 1, display: 'flex', justifyContent: 'flex-end'}}>
                    <div style={{width: `${(l / max) * 100 * p}%`, background: t.accent, borderRadius: t.render === 'pixel' ? 0 : '8px 0 0 8px', boxShadow: t.glow > 0.5 ? `0 0 ${12 * t.glow}px ${t.accent}` : 'none'}} />
                  </div>
                  <div style={{width: 6}} />
                  <div style={{flex: 1}}>
                    <div style={{width: `${(rr / max) * 100 * p}%`, height: '100%', background: t.text, opacity: 0.85, borderRadius: t.render === 'pixel' ? 0 : '0 8px 8px 0'}} />
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
