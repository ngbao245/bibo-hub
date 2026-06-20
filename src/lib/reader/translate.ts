export interface TranslateInput {
  text: string;
  source: string;
  target: string;
}

export interface DictionaryDefinition {
  definition: string;
  example?: string;
}

export interface DictionaryEntry {
  partOfSpeech: string;
  translations: string[];
  definitions: DictionaryDefinition[];
}

export interface TranslateResult {
  translated: string;
  detected: string | null;
  dictionary?: DictionaryEntry[];
}

const GOOGLE_ENDPOINT =
  'https://translate.googleapis.com/translate_a/single';

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const cleanText = (value: unknown): string =>
  asString(value)
    .replace(/<[^>]+>/g, '')
    .trim();

const uniqueStrings = (items: string[]) =>
  [...new Set(items.filter(Boolean))];

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

export async function translate(
  input: TranslateInput,
  signal?: AbortSignal,
): Promise<TranslateResult> {
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });

    if (res.ok) {
      return (await res.json()) as TranslateResult;
    }
  } catch (error) {
    if (isAbortError(error)) throw error;
  }

  return translateDirect(input, signal);
}

export async function translateDirect(
  input: TranslateInput,
  signal?: AbortSignal,
): Promise<TranslateResult> {
  const url = new URL(GOOGLE_ENDPOINT);

  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', input.source);
  url.searchParams.set('tl', input.target);

  url.searchParams.append('dt', 't');
  url.searchParams.append('dt', 'bd');
  url.searchParams.append('dt', 'md');
  url.searchParams.append('dt', 'ex');

  url.searchParams.set('q', input.text);

  const res = await fetch(url.toString(), { signal });

  if (!res.ok) {
    throw new Error(`Translate failed: HTTP ${res.status}`);
  }

  return parseGoogleResponse(await res.json());
}

function parseBaseDictionary(raw: unknown): DictionaryEntry[] {
  return asArray(raw).flatMap((item) => {
    const entry = asArray(item);

    const partOfSpeech = cleanText(entry[0]);
    const translations = uniqueStrings(
      asArray(entry[1]).map(cleanText),
    );

    if (!partOfSpeech || translations.length === 0) {
      return [];
    }

    return [
      {
        partOfSpeech,
        translations,
        definitions: [],
      },
    ];
  });
}

function parseDetailedDefinitions(raw: unknown): DictionaryEntry[] {
  return asArray(raw).flatMap((item) => {
    const entry = asArray(item);

    const partOfSpeech = cleanText(entry[0]);
    const rawDefinitions = asArray(entry[1]);

    const definitions = rawDefinitions.flatMap((item) => {
      const definitionData = asArray(item);

      const definition = cleanText(definitionData[0]);
      const example = cleanText(definitionData[2]);

      if (!definition) return [];

      return [
        {
          definition,
          ...(example ? { example } : {}),
        },
      ];
    });

    if (!partOfSpeech || definitions.length === 0) {
      return [];
    }

    return [
      {
        partOfSpeech,
        translations: [],
        definitions,
      },
    ];
  });
}

function looksLikeDetailedDefinitionBlock(value: unknown): boolean {
  return asArray(value).some((item) => {
    const entry = asArray(item);
    const definitions = asArray(entry[1]);

    return (
      typeof entry[0] === 'string' &&
      definitions.some((definition) => {
        const def = asArray(definition);

        return typeof def[0] === 'string' && typeof def[1] === 'string';
      })
    );
  });
}

function mergeDictionaryEntries(
  baseEntries: DictionaryEntry[],
  detailedEntries: DictionaryEntry[],
): DictionaryEntry[] {
  const map = new Map<string, DictionaryEntry>();

  const addEntry = (entry: DictionaryEntry) => {
    const key = entry.partOfSpeech.toLowerCase();

    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        partOfSpeech: entry.partOfSpeech,
        translations: entry.translations,
        definitions: entry.definitions,
      });
      return;
    }

    existing.translations = uniqueStrings([
      ...existing.translations,
      ...entry.translations,
    ]);

    existing.definitions = [
      ...existing.definitions,
      ...entry.definitions,
    ];
  };

  baseEntries.forEach(addEntry);
  detailedEntries.forEach(addEntry);

  return [...map.values()];
}

export function parseGoogleResponse(data: unknown): TranslateResult {
  if (!Array.isArray(data)) {
    throw new Error('Unexpected translation response');
  }

  const root = data as unknown[];

  const translationChunks = asArray(root[0]);

  const translated = translationChunks
    .map((chunk) => cleanText(asArray(chunk)[0]))
    .join('');

  if (!translated) {
    throw new Error('Translation failed: empty result');
  }

  const detected = typeof root[2] === 'string' ? root[2] : null;

  const baseDictionary = parseBaseDictionary(root[1]);

  // Google có thể trả detailed dictionary ở [12] hoặc [10].
  const detailedBlock = [root[12], root[10]].find(
    looksLikeDetailedDefinitionBlock,
  );

  const detailedDictionary = parseDetailedDefinitions(detailedBlock);

  const dictionary = mergeDictionaryEntries(
    baseDictionary,
    detailedDictionary,
  );

  return {
    translated,
    detected,
    ...(dictionary.length > 0 ? { dictionary } : {}),
  };
}