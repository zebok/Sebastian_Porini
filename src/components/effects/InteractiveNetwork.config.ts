export interface NetworkRenderPolicy {
  particleCount: number;
  animateContinuously: boolean;
}

export const NETWORK_MAX_PARTICLE_COUNT = 720;

const RESPONSIVE_PARTICLE_BUDGETS = [
  { maxWidth: 680, particleCount: 600 },
  { maxWidth: 1100, particleCount: 660 },
  { maxWidth: Number.POSITIVE_INFINITY, particleCount: 720 },
] as const;

/**
 * The 600-particle floor preserves the complete cortical structure plus every
 * primary skill neuron. Wider viewports progressively receive ambient detail.
 */
export const getNetworkRenderPolicy = (
  viewportWidth: number,
  prefersReducedMotion: boolean
): NetworkRenderPolicy => {
  const responsiveBudget =
    RESPONSIVE_PARTICLE_BUDGETS.find(
      ({ maxWidth }) => viewportWidth <= maxWidth
    )?.particleCount ?? NETWORK_MAX_PARTICLE_COUNT;

  return {
    particleCount: prefersReducedMotion
      ? Math.min(responsiveBudget, 600)
      : responsiveBudget,
    animateContinuously: !prefersReducedMotion,
  };
};
