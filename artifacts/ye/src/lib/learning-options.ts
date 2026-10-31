/** Translations are labels only: answers always use the original option value. */
export function validEnglishOptions(value: unknown, options: string[]): value is string[] {
  return Array.isArray(value) && (value.length === 0 ||
    (value.length === options.length && value.every(v => typeof v === 'string' && v.trim().length > 0)));
}

export function optionLabel(options: string[], optionsEn: string[], index: number, english: boolean): string {
  if (!english) return options[index];
  if (optionsEn.length === options.length && optionsEn[index]?.trim()) return optionsEn[index];
  // Numbers, symbols and existing English labels need no translation.
  return /[\u0600-\u06ff]/.test(options[index]) ? 'English translation unavailable' : options[index];
}

export function hasEnglishOptions(options: string[], optionsEn: string[]): boolean {
  return options.every((_, index) => optionLabel(options, optionsEn, index, true) !== 'English translation unavailable');
}
