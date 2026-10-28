import countries from 'i18n-iso-countries';
import {staticFile} from 'remotion';

// Flag SVG for an ISO alpha-3 ("TUR") or alpha-2 ("TR") code; files are copied to public/flags on install.
export function flagFile(code?: string): string | undefined {
  if (!code) return undefined;
  const a2 = code.length === 3 ? countries.alpha3ToAlpha2(code.toUpperCase()) : code.toUpperCase();
  return a2 ? staticFile(`flags/${a2.toLowerCase()}.svg`) : undefined;
}
