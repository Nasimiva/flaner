import React, { useEffect, useRef, useState } from 'react';
import type { BrandItem } from '../utils/siteContentApi';

interface BrandMarqueeProps {
  brands: BrandItem[];
  selectedBrand: string;
  onSelect: (name: string) => void;
}

// Pixels per second. Slow enough to read a name as it passes.
const SPEED_PX_S = 42;
// One copy must be wider than any screen, otherwise the loop shows a gap.
const MIN_ITEMS_PER_COPY = 8;

export const BrandMarquee: React.FC<BrandMarqueeProps> = ({ brands, selectedBrand, onSelect }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [touching, setTouching] = useState(false);
  const [offscreen, setOffscreen] = useState(false);

  const repeats = Math.max(1, Math.ceil(MIN_ITEMS_PER_COPY / Math.max(brands.length, 1)));

  // Constant speed regardless of how many brands there are: duration follows the measured width of one copy.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => {
      const copyWidth = track.scrollWidth / 2;
      if (copyWidth > 0) track.style.setProperty('--marquee-duration', `${(copyWidth / SPEED_PX_S).toFixed(1)}s`);
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(track);
    return () => observer?.disconnect();
  }, [brands, repeats]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (!brands.length) return null;

  const renderCopy = (clone: boolean) => (
    <ul
      className="marquee-copy flex shrink-0 items-center"
      data-clone={clone}
      aria-hidden={clone || undefined}
    >
      {Array.from({ length: repeats }).flatMap((_, round) =>
        brands.map((brand) => {
          const selected = selectedBrand.toLowerCase() === brand.name.toLowerCase();
          return (
            <li key={`${round}-${brand.id}`} className="flex items-center">
              <button
                type="button"
                tabIndex={clone ? -1 : undefined}
                aria-pressed={selected}
                onClick={() => onSelect(brand.name)}
                className={`px-8 md:px-10 py-3 min-h-11 whitespace-nowrap transition-colors duration-200 hover:text-[#6E4F3E] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#6E4F3E] ${
                  selected ? 'text-[#6E4F3E]' : 'text-[#2A2421]'
                }`}
                style={{ touchAction: 'manipulation' }}
              >
                {brand.logoUrl ? (
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    loading="lazy"
                    draggable={false}
                    className={`h-8 md:h-10 w-auto max-w-[160px] object-contain transition-opacity duration-200 ${selected ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
                  />
                ) : (
                  <span
                    className={`font-serif text-[1.75rem] md:text-[2.25rem] leading-none tracking-[-0.01em] ${
                      selected ? 'underline decoration-1 underline-offset-[10px]' : ''
                    }`}
                  >
                    {brand.name}
                  </span>
                )}
              </button>
              <span aria-hidden="true" className="w-px h-6 bg-[#D8CEC4]" />
            </li>
          );
        })
      )}
    </ul>
  );

  return (
    <div
      ref={rootRef}
      className="marquee"
      data-paused={touching || offscreen}
      data-testid="brand-marquee"
      // Holding a finger on the strip pauses it so a name can be read and tapped.
      onPointerDown={(e) => { if (e.pointerType !== 'mouse') setTouching(true); }}
      onPointerUp={() => setTouching(false)}
      onPointerCancel={() => setTouching(false)}
      onPointerLeave={() => setTouching(false)}
    >
      <div ref={trackRef} className="marquee-track">
        {renderCopy(false)}
        {renderCopy(true)}
      </div>
    </div>
  );
};
