// Small frame-pure helpers shared by the animated layers. Nothing here may use Math.random: frames render out of order.
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const ramp = (frame: number, from: number, to: number) => clamp01((frame - from) / (to - from));
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeIn = (x: number) => x * x * x;
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// Repeatable random number in 0..1 for item `i`; `k` picks an independent stream.
export const rnd = (i: number, k = 0) => {
  const x = Math.sin((i + k * 13.37) * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
