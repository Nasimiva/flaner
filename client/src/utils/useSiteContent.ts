import { useEffect, useState } from 'react';
import { DEFAULT_BANNERS, DEFAULT_BRANDS } from '../data/siteContentDefaults';
import { fetchSiteContent, type Banner, type BrandItem } from './siteContentApi';

export interface ResolvedSiteContent {
  /** false until the first answer (or failure), so the hero can hold its space instead of flashing defaults. */
  ready: boolean;
  banners: Banner[];
  brands: BrandItem[];
}

/** Loads editable banners and brands. Refetches whenever `refreshKey` changes (e.g. after leaving the admin panel). */
export function useSiteContent(refreshKey: unknown): ResolvedSiteContent {
  const [state, setState] = useState<ResolvedSiteContent>({ ready: false, banners: DEFAULT_BANNERS, brands: DEFAULT_BRANDS });

  useEffect(() => {
    let cancelled = false;
    fetchSiteContent().then(
      (content) => {
        if (cancelled) return;
        setState({ ready: true, banners: content.banners ?? DEFAULT_BANNERS, brands: content.brands ?? DEFAULT_BRANDS });
      },
      () => {
        // The storefront must never break because of this: fall back to the bundled defaults.
        if (!cancelled) setState({ ready: true, banners: DEFAULT_BANNERS, brands: DEFAULT_BRANDS });
      }
    );
    return () => { cancelled = true; };
  }, [refreshKey]);

  return state;
}
