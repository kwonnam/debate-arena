export type DetectedSearchLanguage = 'ko' | 'en' | 'other';

export type SearchQueryLanguage = 'ko' | 'en';

export type SearchLanguageScope = 'input' | 'ko' | 'en' | 'both';

export type QueryTransformMode = 'off' | 'expand';

export interface QueryTransformOptions {
  mode?: QueryTransformMode;
  languageScope?: SearchLanguageScope;
  provider?: string;
  scope?: 'news' | 'web';
}

export interface SearchQueryVariant {
  query: string;
  language?: SearchQueryLanguage;
  source: 'original' | 'translated' | 'expanded';
}

export interface SearchPlan {
  detectedLanguage: DetectedSearchLanguage;
  llmApplied: boolean;
  queries: SearchQueryVariant[];
}
