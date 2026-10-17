import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';

interface ProductImageProps {
  src?: string;
  alt: string;
  brand?: string;
  className?: string;
  /** Small thumbnails (cart, favourites) show only the monogram, without the caption. */
  compact?: boolean;
  loading?: 'lazy' | 'eager';
}

/**
 * Product photo with a built-in placeholder. A product without a photo, or whose photo fails to load,
 * shows a neutral tile with the brand name instead of the browser's broken-image icon.
 */
export const ProductImage: React.FC<ProductImageProps> = ({ src, alt, brand, className = '', compact = false, loading }) => {
  const { t } = useI18n();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const url = typeof src === 'string' ? src.trim() : '';

  if (!url || failedSrc === url) {
    const label = (brand || '').trim();
    return (
      <div
        role="img"
        aria-label={alt}
        data-testid="product-image-placeholder"
        className={`${className} flex flex-col items-center justify-center gap-1 bg-[#F2ECE5] text-[#8A796F] select-none`}
      >
        <span className={`font-semibold uppercase tracking-[0.18em] text-center px-2 leading-tight ${compact ? 'text-[8px]' : 'text-xs'}`}>
          {label || 'Flaner'}
        </span>
        {!compact && <span className="text-[10px] text-[#A6968B]">{t('product.noPhoto')}</span>}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      referrerPolicy="no-referrer"
      className={className}
      loading={loading}
      onError={() => setFailedSrc(url)}
    />
  );
};
