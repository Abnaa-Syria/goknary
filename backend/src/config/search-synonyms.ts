export const SEARCH_SYNONYMS: Record<string, string[]> = {
  'موبايل': ['تليفون', 'هاتف', 'phone', 'mobile'],
  'لاب توب': ['laptop', 'كمبيوتر محمول', 'نوت بوك'],
  'تلفزيون': ['شاشة', 'tv', 'تليفزيون'],
  'ثلاجة': ['فريدجيدير', 'براد'],
};

/**
 * Expands a query term into its synonyms (if defined in the dictionary).
 * Returns an array containing the original query plus all configured synonyms.
 */
export const expandWithSynonyms = (query: string): string[] => {
  const normalized = query.toLowerCase().trim();
  const terms = [query];

  for (const [key, synonyms] of Object.entries(SEARCH_SYNONYMS)) {
    if (key === normalized || synonyms.some(s => s.toLowerCase() === normalized)) {
      if (!terms.includes(key)) terms.push(key);
      synonyms.forEach(syn => {
        if (!terms.includes(syn)) terms.push(syn);
      });
    }
  }
  return terms;
};
