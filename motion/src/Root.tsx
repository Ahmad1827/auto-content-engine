import {CalculateMetadataFunction, Composition} from 'remotion';
import {demo} from './demo';
import {Story} from './Story';
import type {Storyboard} from './types';

const calculateMetadata: CalculateMetadataFunction<Storyboard> = ({props}) => {
  const last = props.scenes[props.scenes.length - 1];
  const seconds = last ? last.start + last.duration : 10;
  return {durationInFrames: Math.ceil(seconds * props.fps), fps: props.fps, width: props.width, height: props.height};
};

export const Root: React.FC = () => (
  <Composition
    id="Story"
    component={Story}
    defaultProps={demo}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    calculateMetadata={calculateMetadata}
  />
);
