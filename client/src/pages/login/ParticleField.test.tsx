// ParticleField — the original login backdrop. The canvas math is thin enough
// that these tests pin the contract that matters: one canvas per variant, a
// live loop normally that is torn down with the component, and a single static
// frame (no rAF loop) under reduced motion.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '../../../tests/helpers/render';
import ParticleField from './ParticleField';

const origMatchMedia = window.matchMedia;

function stubReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  stubReducedMotion(false);
  // jsdom's getContext returns null unless the canvas package provides it —
  // stub a minimal 2D context so the effect body runs.
  const ctx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    setTransform: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  vi.restoreAllMocks();
  window.matchMedia = origMatchMedia;
});

describe('ParticleField', () => {
  it('renders the constellation canvas inside an aria-hidden wrapper', () => {
    const { container } = render(<ParticleField variant="ambient" />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    // Decorative: the wrapper hides it from assistive tech.
    expect(canvas!.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('runs a live animation loop normally and stops it on unmount', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    const caf = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const { unmount } = render(<ParticleField variant="ambient" />);
    expect(raf).toHaveBeenCalled();
    unmount();
    expect(caf).toHaveBeenCalled();
  });

  it('starts no animation loop under reduced motion', () => {
    stubReducedMotion(true);
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    render(<ParticleField variant="takeoff" />);
    // The static takeoff frame still painted, but nothing keeps animating.
    expect(raf).not.toHaveBeenCalled();
  });

  it('renders both variants as a canvas', () => {
    const { container: ambient } = render(<ParticleField variant="ambient" />);
    const { container: takeoff } = render(<ParticleField variant="takeoff" />);
    expect(ambient.querySelector('canvas')).not.toBeNull();
    expect(takeoff.querySelector('canvas')).not.toBeNull();
  });
});
