import {interpolate, useCurrentFrame} from 'remotion';
import {CastView} from '../cast/CastView';
import {stagePositions} from '../cast/poses';
import {useTheme} from '../theme';
import type {Visual} from '../types';

// Full-frame scene with people in a set; the headline (if any) sits at the top instead of the bottom.
export const CastScene: React.FC<{visual: Extract<Visual, {type: 'cast'}>}> = ({visual}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const people = visual.people.slice(0, 4);
  const xs = stagePositions(people);
  // Name tags float above heads; the 3D camera frames people a little larger.
  const tagY = t.render === '3d' ? 560 : 740;
  return (
    <>
      <div style={{position: 'absolute', inset: 0}}>
        <CastView cast={visual} W={1080} H={1920} mode="stage" />
      </div>
      {people.map((p, i) =>
        p.label ? (
          <div key={i} style={{
            position: 'absolute', top: tagY, left: 540 + xs[i] * (t.render === '3d' ? 400 : 324) - 200, width: 400, textAlign: 'center',
            opacity: interpolate(frame, [14 + i * 5, 22 + i * 5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
          }}>
            <span style={{
              display: 'inline-block', padding: '6px 16px', fontFamily: t.fonts.mono, fontWeight: 700, fontSize: 26, letterSpacing: 4,
              textTransform: 'uppercase', color: t.text, background: t.render === 'flat' ? t.bg : 'rgba(0,0,0,0.45)', border: `2px solid ${t.accent}`, borderRadius: t.render === 'pixel' ? 0 : 6,
            }}>{p.label}</span>
          </div>
        ) : null,
      )}
      {visual.label && (
        <div style={{position: 'absolute', top: 1340, left: 72, right: 72, textAlign: t.align, fontFamily: t.fonts.mono, fontWeight: 700, fontSize: 28, letterSpacing: 5, color: t.muted, textTransform: 'uppercase'}}>
          {visual.label}
        </div>
      )}
    </>
  );
};
