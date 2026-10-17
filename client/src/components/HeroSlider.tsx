import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Banner } from '../utils/siteContentApi';
import { triggerHaptic } from '../utils/telegram';
import { useI18n } from '../i18n/I18nContext';

interface HeroSliderProps {
  banners: Banner[];
  /** false while content is loading: the hero holds its space instead of flashing defaults. */
  ready: boolean;
  onCategory: (category: Banner['ctaCategory']) => void;
}

// One interval drives both the progress bar and the slide change (see .hero-seg-fill in index.css).
const INTERVAL_MS = 5000;
const SWIPE_MIN_PX = 40;
// Time the leaving image stays underneath while the next one fades in.
const CROSSFADE_MS = 1000;

const pad = (n: number) => String(n).padStart(2, '0');

export const HeroSlider: React.FC<HeroSliderProps> = ({ banners, ready, onCategory }) => {
  const { t } = useI18n();
  const slides = banners.filter((banner) => banner.active);
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [failedImages, setFailedImages] = useState<ReadonlySet<string>>(new Set());
  const rootRef = useRef<HTMLElement>(null);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const swiped = useRef(false);

  const count = slides.length;
  const current = count ? Math.min(index, count - 1) : 0;
  const paused = hovered || focused || offscreen || tabHidden || dragging;

  const goTo = (next: number) => {
    if (count < 2) return;
    const target = ((next % count) + count) % count;
    if (target === current) return;
    setPrev(current);
    setIndex(target);
  };

  // The previous image only has to stay underneath until the new one has faded in.
  useEffect(() => {
    if (prev === null) return;
    const timer = window.setTimeout(() => setPrev(null), CROSSFADE_MS);
    return () => window.clearTimeout(timer);
  }, [prev]);

  // Warm the next image so the crossfade never reveals an empty frame.
  useEffect(() => {
    if (count < 2) return;
    const next = slides[(current + 1) % count];
    if (next) new Image().src = next.imageUrl;
  }, [current, count, slides]);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting), { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [count]);

  const onPointerDown = (event: React.PointerEvent) => {
    swiped.current = false;
    // Mouse users get arrows and hover-pause; swipe is for touch and pen.
    if (event.pointerType === 'mouse') return;
    swipe.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    setDragging(true);
  };
  const endSwipe = (event: React.PointerEvent, commit: boolean) => {
    const start = swipe.current;
    if (!start || start.id !== event.pointerId) return;
    swipe.current = null;
    setDragging(false);
    if (!commit) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped.current = true;
      triggerHaptic('selection');
      goTo(current + (dx < 0 ? 1 : -1));
    }
  };

  if (!ready) {
    return (
      <div className="@container">
        <div aria-hidden="true" className="rounded-3xl overflow-hidden bg-[#EFE8DF]">
          <div className="aspect-video bg-[#E6DDD2]" />
          <div className="h-[72px]" />
        </div>
      </div>
    );
  }
  if (!count) return null;

  const multiple = count > 1;
  const active = slides[current];

  return (
    <div className="@container">
    <section
      ref={rootRef}
      aria-roledescription="carousel"
      aria-label={t('hero.region')}
      data-paused={paused}
      data-testid="hero-slider"
      className="hero-root relative rounded-3xl overflow-hidden bg-[#EFE8DF] border border-[#E4DBD1] select-none"
      style={{ touchAction: 'pan-y', ['--hero-interval' as string]: `${INTERVAL_MS}ms` }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHovered(false); }}
      // Keyboard focus pauses autoplay; a mouse click on an arrow must not leave it paused.
      onFocus={(e) => { if (e.target.matches(':focus-visible')) setFocused(true); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}
      onPointerDown={onPointerDown}
      onPointerUp={(e) => endSwipe(e, true)}
      onPointerCancel={(e) => endSwipe(e, false)}
      onClickCapture={(e) => {
        // A swipe that happened to start on the button must not also click it.
        if (swiped.current) { e.preventDefault(); e.stopPropagation(); swiped.current = false; }
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') goTo(current - 1);
        if (e.key === 'ArrowRight') goTo(current + 1);
      }}
    >
      {/* Stacked images share one box, so the hero never changes height between slides. */}
      <div className="relative aspect-video bg-[#E6DDD2] overflow-hidden">
        {slides.map((slide, i) => {
          if (failedImages.has(slide.id)) return null;
          const state = i === current ? 'active' : i === prev ? 'leaving' : 'idle';
          return (
            <img
              key={slide.id}
              src={slide.imageUrl}
              alt={slide.title}
              draggable={false}
              data-state={state}
              className="hero-img"
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : 'auto'}
              decoding="async"
              onError={() => setFailedImages((set) => new Set(set).add(slide.id))}
            />
          );
        })}
      </div>

      {/* Optional text panel: only appears when the slide has a description. */}
      {active.text && (
        <p className="px-5 pt-4 text-[15px] leading-relaxed text-[#6E5C51]" aria-live={paused ? 'polite' : 'off'}>
          {active.text}
        </p>
      )}

      {(active.ctaLabel || multiple) && (
        <div className="flex items-center gap-4 px-5 py-4">
          {multiple ? (
            <div className="flex flex-1 min-w-0 items-center gap-1.5" role="group" aria-label={t('hero.pickSlide')}>
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => { triggerHaptic('selection'); goTo(i); }}
                  aria-label={t('hero.slideN', { i: i + 1, title: slide.title })}
                  aria-current={i === current}
                  className="hero-seg group flex-1 min-w-0 h-6 flex items-center"
                  data-state={i < current ? 'done' : i === current ? 'active' : 'next'}
                >
                  <span className="relative block w-full h-[2px] overflow-hidden rounded-full bg-[#221D1A]/15 group-hover:bg-[#221D1A]/25 transition-colors duration-200">
                    <span
                      className="hero-seg-fill absolute inset-0 bg-[#221D1A]"
                      onAnimationEnd={() => { if (i === current) goTo(current + 1); }}
                    />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1" />
          )}
          {multiple && (
            <div className="flex items-center gap-1.5">
              <ArrowButton label={t('hero.prev')} onClick={() => goTo(current - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </ArrowButton>
              <ArrowButton label={t('hero.next')} onClick={() => goTo(current + 1)}>
                <ChevronRight className="w-4 h-4" />
              </ArrowButton>
            </div>
          )}
          {active.ctaLabel && <HeroCta banner={active} onCategory={onCategory} />}
        </div>
      )}
    </section>
    </div>
  );
};

const ArrowButton: React.FC<{ label: string; onClick: () => void; children: React.ReactNode }> = ({ label, onClick, children }) => (
  <button
    type="button"
    aria-label={label}
    onClick={() => { triggerHaptic('selection'); onClick(); }}
    className="w-9 h-9 shrink-0 rounded-full border border-[#221D1A]/20 text-[#221D1A] inline-flex items-center justify-center transition-[background-color,color,transform] duration-200 hover:bg-[#221D1A] hover:text-[#F9F7F5] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6E4F3E]"
    style={{ touchAction: 'manipulation' }}
  >
    {children}
  </button>
);

const ctaClass =
  'group inline-flex items-center gap-3 rounded-full bg-[#221D1A] text-[#F9F7F5] pl-6 pr-2 min-h-12 text-sm font-semibold transition-[background-color,transform] duration-200 hover:bg-[#3D3531] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6E4F3E]';

const HeroCta: React.FC<{ banner: Banner; onCategory: HeroSliderProps['onCategory'] }> = ({ banner, onCategory }) => {
  const content = (
    <>
      <span>{banner.ctaLabel}</span>
      <span className="w-8 h-8 rounded-full bg-[#F9F7F5]/15 inline-flex items-center justify-center">
        <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </>
  );
  if (banner.ctaLink) {
    return (
      <a href={banner.ctaLink} target="_blank" rel="noopener noreferrer" className={ctaClass} style={{ touchAction: 'manipulation' }}>
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic('selection'); onCategory(banner.ctaCategory); }}
      className={ctaClass}
      style={{ touchAction: 'manipulation' }}
    >
      {content}
    </button>
  );
};
