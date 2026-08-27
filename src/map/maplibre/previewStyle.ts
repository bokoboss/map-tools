export const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';
export const OPENFREEMAP_PLANET_SOURCE = 'https://tiles.openfreemap.org/planet';

/** A network-free style used by ?test=1 browser runs. */
export function createDeterministicPreviewStyle() {
  return {
    version: 8 as const,
    sources: {},
    layers: [
      {
        id: 'deterministic-background',
        type: 'background' as const,
        paint: { 'background-color': '#dbeafe' }
      }
    ]
  };
}
