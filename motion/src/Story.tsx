import {useMemo} from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Ambient} from './components/Ambient';
import {Backdrop} from './components/Backdrop';
import {Captions} from './components/Captions';
import {Decor} from './components/Decor';
import {HeadlineBlock} from './components/HeadlineBlock';
import {Kicker} from './components/Kicker';
import {Transition} from './components/Transition';
import {CompareScene, CounterScene, IllustrationScene, TitleScene} from './scenes/ArtScenes';
import {CastScene, placeTags} from './scenes/CastScene';
import {QuoteScene, TimelineScene, VersusScene} from './scenes/InfoScenes';
import {MapScene} from './scenes/MapScene';
import {rnd} from './fx';
import {localizeTheme} from './language';
import {THEMES, ThemeContext, useTheme} from './theme';
import type {Scene, Storyboard} from './types';

// Scene types that use the whole frame and never get a headline on top.
const FULL_FRAME = new Set(['compare', 'timeline', 'quote', 'versus']);

const SceneBody: React.FC<{scene: Scene; durationInFrames: number}> = ({scene, durationInFrames}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const v = scene.visual;
  // The camera never stops: a slow push and drift, with a jolt when a headline lands in the punchier styles.
  const push = 1 + (frame / Math.max(1, durationInFrames)) * 0.018;
  const driftX = Math.sin(frame / 40) * 4;
  const driftY = Math.cos(frame / 53) * 3;
  const punchy = scene.headline && (t.banner === 'slash' || t.banner === 'stamp' || t.banner === 'glow');
  const jolt = punchy && frame >= 3 && frame < 14 ? (14 - frame) * 1.1 : 0;
  const shakeX = jolt ? (rnd(frame, 1) - 0.5) * jolt : 0;
  const shakeY = jolt ? (rnd(frame, 2) - 0.5) * jolt : 0;
  // Text-only scenes put the headline higher so it doesn't float under an empty top half.
  // Cast scenes fill the frame with people, so their headline goes at the top, stopping above the heads.
  const castLabel = v.type === 'cast' && v.label;
  const headlineTop = v.type === 'cast' ? (castLabel ? 270 : 215) : v.type === 'map' ? 1010 : v.type === 'title' ? 1000 : v.type === 'counter' ? 900 : 1060;
  const castFloor = v.type === 'cast' ? Math.min(880, ...placeTags(v.people.slice(0, 4), t.render === '3d', true).map((p) => p.top - 12)) : 0;
  const headlineMax = v.type === 'cast' ? castFloor - headlineTop : undefined;

  return (
    <AbsoluteFill style={{transform: `translate(${driftX + shakeX}px, ${driftY + shakeY}px) scale(${push})`}}>
      {v.type === 'map' && <MapScene visual={v} durationInFrames={durationInFrames} compact={Boolean(scene.headline)} />}
      {v.type === 'cast' && <CastScene visual={v} labelTop={scene.kicker ? 208 : 150} low={Boolean(scene.headline)} />}
      {v.type === 'illustration' && <IllustrationScene visual={v} compact={Boolean(scene.headline)} />}
      {v.type === 'compare' && <CompareScene visual={v} />}
      {v.type === 'counter' && <CounterScene visual={v} compact={Boolean(scene.headline)} />}
      {v.type === 'title' && <TitleScene visual={v} raised={Boolean(scene.headline)} />}
      {v.type === 'timeline' && <TimelineScene visual={v} durationInFrames={durationInFrames} />}
      {v.type === 'quote' && <QuoteScene visual={v} durationInFrames={durationInFrames} />}
      {v.type === 'versus' && <VersusScene visual={v} />}
      {scene.headline && !FULL_FRAME.has(v.type) && <HeadlineBlock headline={scene.headline} top={headlineTop} maxHeight={headlineMax} />}
      {scene.kicker && <Kicker text={scene.kicker} />}
    </AbsoluteFill>
  );
};

const Handle: React.FC<{handle: string}> = ({handle}) => {
  const t = useTheme();
  return (
    <div style={{position: 'absolute', top: 1640, width: '100%', textAlign: 'center', fontFamily: t.fonts.mono, fontSize: 28, color: t.decor === 'synth' ? t.text : t.muted, letterSpacing: 2, direction: 'ltr',
      // Neon's sun and peaks sit right behind the handle.
      textShadow: t.decor === 'synth' ? '0 0 6px #07061a, 0 0 6px #07061a, 0 0 12px #07061a' : undefined}}>
      —— {handle} ——
    </div>
  );
};

export const Story: React.FC<Storyboard> = (props) => {
  const {fps} = useVideoConfig();
  const theme = useMemo(() => localizeTheme(THEMES[props.style] ?? THEMES.atlas, props.language ?? 'en', JSON.stringify(props.scenes)), [props.style, props.language, props.scenes]);
  const cuts = useMemo(() => props.scenes.slice(1).map((s) => Math.round(s.start * fps)), [props.scenes, fps]);
  const ticker = useMemo(() => [...new Set(props.scenes.map((s) => s.kicker).filter((k): k is string => Boolean(k)))], [props.scenes]);
  return (
    <ThemeContext.Provider value={theme}>
      <AbsoluteFill lang={theme.language} className={theme.connected ? 'connected-script' : undefined} style={{direction: theme.rtl ? 'rtl' : 'ltr'}}>
        {theme.connected && <style>{'.connected-script, .connected-script * {letter-spacing: 0 !important}'}</style>}
        <Backdrop />
        <Ambient />
        {props.scenes.map((scene, i) => {
          const from = Math.round(scene.start * fps);
          const next = props.scenes[i + 1];
          const until = next ? Math.round(next.start * fps) : Math.round((scene.start + scene.duration) * fps);
          const durationInFrames = Math.max(1, until - from);
          return (
            <Sequence key={i} from={from} durationInFrames={durationInFrames} name={`${i + 1}. ${scene.visual.type}`}>
              <SceneBody scene={scene} durationInFrames={durationInFrames} />
            </Sequence>
          );
        })}
        <Decor ticker={ticker} />
        <Transition cuts={cuts} />
        {props.captions && (
          <Captions
            words={props.words}
            // The big headline already carries the text in those scenes.
            hidden={props.scenes.filter((s) => s.headline && !FULL_FRAME.has(s.visual.type)).map((s) => [s.start, s.start + s.duration] as [number, number])}
          />
        )}
        {props.handle && <Handle handle={props.handle} />}
        {props.audio && <Audio src={staticFile(props.audio)} />}
        {props.music && <Audio src={staticFile(props.music)} volume={0.1} />}
      </AbsoluteFill>
    </ThemeContext.Provider>
  );
};
