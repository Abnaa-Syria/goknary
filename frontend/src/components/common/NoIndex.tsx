import { useEffect } from 'react';

/** Marks the current page `noindex, nofollow` while mounted (authenticated previews are not public content). */
const NoIndex: React.FC = () => {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = meta?.getAttribute('content') ?? null;
    const created = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');
    return () => {
      if (created) meta?.remove();
      else if (previous !== null) meta?.setAttribute('content', previous);
    };
  }, []);

  return null;
};

export default NoIndex;
