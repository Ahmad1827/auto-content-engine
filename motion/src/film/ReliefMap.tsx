import {Img, staticFile} from 'remotion';
import {useFilm, useTime} from './Film';

type Meta = {west: number; south: number; east: number; north: number; width: number; height: number};
export type MapStop = {at: number; lon: number; lat: number; zoom: number};
export type Project = (lon: number, lat: number) => [number, number];

const mercY = (lat: number) => Math.asinh(Math.tan((lat * Math.PI) / 180));
const smooth = (p: number) => p * p * (3 - 2 * p);

// A continuous camera over the relief image made by `film.mjs terrain`. Pass the printed metadata as `meta`.
// `zoom` is screen pixels per image pixel. Children get `project` for pinning routes, ships and labels to real coordinates, in screen pixels.
export const ReliefMap: React.FC<{meta: Meta; stops: MapStop[]; children?: (project: Project) => React.ReactNode}> = ({meta, stops, children}) => {
  const {id, width, height} = useFilm();
  const t = useTime();
  const px = (lon: number, lat: number): [number, number] => {
    const x = ((lon - meta.west) / (meta.east - meta.west)) * meta.width;
    const y = ((mercY(meta.north) - mercY(lat)) / (mercY(meta.north) - mercY(meta.south))) * meta.height;
    return [x, y];
  };
  let i = 0;
  while (i < stops.length - 1 && stops[i + 1].at <= t) i++;
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  const k = b.at > a.at ? smooth(Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at)))) : 0;
  const [ax, ay] = px(a.lon, a.lat);
  const [bx, by] = px(b.lon, b.lat);
  const cx = ax + (bx - ax) * k;
  const cy = ay + (by - ay) * k;
  // Zooming in log space reads as a constant speed.
  const zoom = Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * k);
  const project: Project = (lon, lat) => {
    const [x, y] = px(lon, lat);
    return [(x - cx) * zoom + width / 2, (y - cy) * zoom + height / 2];
  };
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#d6dee8'}}>
      <Img src={staticFile(`films/${id}/relief.jpg`)} style={{position: 'absolute', left: width / 2 - cx * zoom, top: height / 2 - cy * zoom, width: meta.width * zoom, height: meta.height * zoom, maxWidth: 'none'}} />
      {children?.(project)}
    </div>
  );
};
