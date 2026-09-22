export interface BrainNormalizedPoint {
  x: number;
  y: number;
}

export const BRAIN_BOUNDS_SCALE_X = 0.46;
export const BRAIN_BOUNDS_SCALE_Y = 0.46;

const BRAIN_BOUNDARY_POINT_COUNT = 176;

/**
 * A clean top-view profile built as one anatomical half and reflected across
 * the longitudinal fissure. This makes bilateral symmetry a property of the
 * geometry instead of an approximation produced by trigonometric noise.
 */
const RIGHT_HEMISPHERE_KNOTS: BrainNormalizedPoint[] = [
  { x: 0, y: -1.008 },
  { x: 0.18, y: -1.02 },
  { x: 0.4, y: -0.94 },
  { x: 0.62, y: -0.82 },
  { x: 0.8, y: -0.64 },
  { x: 0.93, y: -0.4 },
  { x: 0.99, y: -0.14 },
  { x: 0.99, y: 0.12 },
  { x: 0.95, y: 0.38 },
  { x: 0.84, y: 0.62 },
  { x: 0.68, y: 0.82 },
  { x: 0.46, y: 0.96 },
  { x: 0.22, y: 1.01 },
  { x: 0, y: 1 },
];

const catmullRomCoordinate = (
  previous: number,
  start: number,
  end: number,
  following: number,
  progress: number
) => {
  const squared = progress ** 2;
  const cubed = progress ** 3;

  return 0.5 * (
    2 * start +
    (-previous + end) * progress +
    (2 * previous - 5 * start + 4 * end - following) * squared +
    (-previous + 3 * start - 3 * end + following) * cubed
  );
};

const pointOnRightHemisphere = (progress: number): BrainNormalizedPoint => {
  const segmentCount = RIGHT_HEMISPHERE_KNOTS.length - 1;
  const scaledProgress = Math.min(1, Math.max(0, progress)) * segmentCount;
  const segmentIndex = Math.min(
    segmentCount - 1,
    Math.floor(scaledProgress)
  );
  const segmentProgress = Math.min(1, scaledProgress - segmentIndex);
  const start = RIGHT_HEMISPHERE_KNOTS[segmentIndex];
  const end = RIGHT_HEMISPHERE_KNOTS[segmentIndex + 1];
  const previous =
    segmentIndex === 0
      ? { ...RIGHT_HEMISPHERE_KNOTS[1], x: -RIGHT_HEMISPHERE_KNOTS[1].x }
      : RIGHT_HEMISPHERE_KNOTS[segmentIndex - 1];
  const following =
    segmentIndex === segmentCount - 1
      ? {
          ...RIGHT_HEMISPHERE_KNOTS[segmentCount - 1],
          x: -RIGHT_HEMISPHERE_KNOTS[segmentCount - 1].x,
        }
      : RIGHT_HEMISPHERE_KNOTS[segmentIndex + 2];

  return {
    x: catmullRomCoordinate(
      previous.x,
      start.x,
      end.x,
      following.x,
      segmentProgress
    ),
    y: catmullRomCoordinate(
      previous.y,
      start.y,
      end.y,
      following.y,
      segmentProgress
    ),
  };
};

export const createBrainMaskPolygon = (): BrainNormalizedPoint[] => {
  const rightPointCount = BRAIN_BOUNDARY_POINT_COUNT / 2 + 1;
  const rightHemisphere = Array.from(
    { length: rightPointCount },
    (_, index) => pointOnRightHemisphere(index / (rightPointCount - 1))
  );
  const leftHemisphere = rightHemisphere
    .slice(1, -1)
    .reverse()
    .map((point) => ({ x: -point.x, y: point.y }));

  return [...rightHemisphere, ...leftHemisphere];
};

export const BRAIN_MASK_POLYGON = createBrainMaskPolygon();

export const isPointInPolygon = (
  x: number,
  y: number,
  polygon: readonly BrainNormalizedPoint[]
) => {
  let inside = false;

  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crosses =
      currentPoint.y > y !== previousPoint.y > y &&
      x <
        ((previousPoint.x - currentPoint.x) * (y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;

    if (crosses) inside = !inside;
  }

  return inside;
};

export const isPointInBrain = (x: number, y: number): boolean =>
  isPointInPolygon(x, y, BRAIN_MASK_POLYGON);

export const isPointInBrainInset = (
  x: number,
  y: number,
  inset: number
): boolean => {
  const scale = Math.max(0.01, 1 - inset);
  return isPointInBrain(x / scale, y / scale);
};

export const BRAIN_MASK_CLIP_PATH = `polygon(${BRAIN_MASK_POLYGON.map(
  ({ x, y }) =>
    `${50 + x * BRAIN_BOUNDS_SCALE_X * 100}% ${
      50 + y * BRAIN_BOUNDS_SCALE_Y * 100
    }%`
).join(", ")})`;
