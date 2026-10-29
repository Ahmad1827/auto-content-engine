import {AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop} from './components/Backdrop';
import {Captions} from './components/Captions';
import {Decor} from './components/Decor';
import {HeadlineBlock} from './components/HeadlineBlock';
import {Kicker} from './components/Kicker';
import {CompareScene, CounterScene, IllustrationScene, TitleScene} from './scenes/ArtScenes';
import {QuoteScene, TimelineScene, VersusScene} from './scenes/InfoScenes';
import {MapScene} from './scenes/MapScene';
import {THEMES, ThemeContext, useTheme} from './theme';
import type {Scene, Storyboard} from './types';

// Scene types that use the whole frame and never get a headline on top.
const FULL_FRAME = new Set(['compare', 'timeline', 'quote', 'versus']);

const SceneBody: React.FC<{scene: Scene; durationInFrames: number}> = ({scene, durationInFrames}) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 5], [0, 1], {extrapolateRight: 'clamp'});
  const fadeOut = interpolate(frame, [durationInFrames - 4, durationInFrames], [1, 0], {extrapolateLeft: 'clamp'});
  const push = interpolate(frame, [0, 8], [1.03, 1], {extrapolateRight: 'clamp'});
  const v = scene.visual;
  // Text-only scenes put the headline higher so it doesn't float under an empty top half.
  const headlineTop = v.type === 'map' ? 1010 : v.type === 'title' ? 1000 : 1080;

  return (
    <AbsoluteFill style={{opacity: Math.min(fadeIn, fadeOut), transform: `scale(${push})`}}>
      {v.type === 'map' && <MapScene visual={v} durationInFrames={durationInFrames} />}
      {v.type === 'illustration' && <IllustrationScene visual={v} compact={Boolean(scene.headline)} />}
      {v.type === 'compare' && <CompareScene visual={v} />}
      {v.type === 'counter' && <CounterScene visual={v} />}
      {v.type === 'title' && <TitleScene visual={v} raised={Boolean(scene.headline)} />}
      {v.type === 'timeline' && <TimelineScene visual={v} durationInFrames={durationInFrames} />}
      {v.type === 'quote' && <QuoteScene visual={v} durationInFrames={durationInFrames} />}
      {v.type === 'versus' && <VersusScene visual={v} />}
      {scene.headline && !FULL_FRAME.has(v.type) && <HeadlineBlock headline={scene.headline} top={headlineTop} />}
      {scene.kicker && <Kicker text={scene.kicker} />}
    </AbsoluteFill>
  );
};

const Handle: React.FC<{handle: string}> = ({handle}) => {
  const t = useTheme();
  return (
    <div style={{position: 'absolute', top: 1640, width: '100%', textAlign: 'center', fontFamily: t.fonts.mono, fontSize: 28, color: t.muted, letterSpacing: 2}}>
      —— {handle} ——
    </div>
  );
};

export const Story: React.FC<Storyboard> = (props) => {
  const {fps} = useVideoConfig();
  return (
    <ThemeContext.Provider value={THEMES[props.style] ?? THEMES.atlas}>
      <AbsoluteFill>
        <Backdrop />
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
        <Decor />
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
