import type {Storyboard} from './types';

// Preview data for `npm run studio`; real videos get their storyboard from the Python pipeline.
export const demo: Storyboard = {
  style: 'atlas',
  fps: 30,
  width: 1080,
  height: 1920,
  captions: true,
  handle: '@yourchannel',
  words: [
    {text: 'In', start: 4.2, end: 4.4},
    {text: 'Karboğazı,', start: 4.4, end: 5.1},
    {text: 'a', start: 5.1, end: 5.2},
    {text: 'French', start: 5.2, end: 5.6},
    {text: 'battalion', start: 5.6, end: 6.1},
    {text: 'marched', start: 6.1, end: 6.5},
    {text: 'into', start: 6.5, end: 6.7},
    {text: 'the', start: 6.7, end: 6.8},
    {text: 'Taurus', start: 6.8, end: 7.2},
    {text: 'mountains.', start: 7.2, end: 7.9},
  ],
  scenes: [
    {
      start: 0,
      duration: 4,
      narration: '',
      kicker: 'Turkey · May 1920',
      headline: {lines: [{text: '*44* TURKS', size: 'xl'}, {text: 'VS', size: 'm'}, {text: '~1,000 FRENCH', size: 'xl'}], banner: 'GUESS WHO SURRENDERED?'},
      visual: {type: 'map', focus: ['TUR'], markers: [{lon: 35.0, lat: 37.4, flag: 'TUR'}]},
    },
    {
      start: 4,
      duration: 4,
      narration: '',
      kicker: 'Taurus Mountains',
      visual: {
        type: 'map', focus: ['TUR', 'SYR'], highlight: ['SYR'],
        markers: [{lon: 35.0, lat: 37.4, label: 'Karboğazı', flag: 'TUR'}],
        arrows: [{from: [36.2, 36.2], to: [35.1, 37.3], label: 'French column'}],
      },
    },
    {
      start: 8,
      duration: 3,
      narration: '',
      visual: {type: 'counter', value: 1000, prefix: '~', label: 'French soldiers'},
    },
    {
      start: 11,
      duration: 4,
      narration: '',
      visual: {
        type: 'compare',
        top: {tag: 'with', label: 'rested', svg: '<svg viewBox="0 0 1000 500"><rect class="warm" x="640" y="60" width="200" height="170"/><circle cx="300" cy="140" r="40"/><path d="M300 180 L300 330 M300 220 L240 290 M300 220 L360 290 M300 330 L260 450 M300 330 L340 450"/><path d="M100 450 L900 450"/></svg>'},
        bottom: {tag: 'without', label: 'tired', svg: '<svg viewBox="0 0 1000 500"><rect class="warm" x="640" y="60" width="200" height="170"/><circle cx="330" cy="250" r="40"/><path d="M320 290 Q300 360 330 400 L420 400 L420 450 M330 300 L400 360"/><path class="accent" d="M280 190 q15 -20 30 0 q15 20 30 0 q15 -20 30 0"/><path d="M100 450 L900 450"/></svg>'},
      },
    },
  ],
};
