import type { BookDocument, BookSpread } from '@trek/shared';
import { bookPageSetupSchema } from '@trek/shared';
import { describe, expect, it } from 'vitest';
import { sheetBox, sheetsFor } from './bookSheets';

const spread = (role: BookSpread['role'], id: string): BookSpread => ({
  id,
  role,
  background: '#fff',
  elements: [],
  parked: [],
  entryId: null,
});
const doc = (spreads: BookSpread[]): BookDocument =>
  ({
    version: 1,
    title: 'test',
    page: bookPageSetupSchema.parse({ preset: 'square-210', pageWidth: 210, pageHeight: 210, bleed: 3 }),
    spreads,
  }) as BookDocument;

describe('book sheet geometry', () => {
  it('includes bleed and crop-mark margin', () => {
    expect(sheetBox(210, 210, 3, false)).toEqual({ width: 216, height: 216, margin: 3, bleed: 3 });
    expect(sheetBox(210, 210, 3, true)).toEqual({ width: 224, height: 224, margin: 7, bleed: 3 });
  });
  it('cuts inner spreads into two pages', () => {
    const result = sheetsFor(doc([spread('cover', 'c'), spread('inner', 'i')]), 'pages');
    expect(result.map((s) => [s.width, s.offset, s.single])).toEqual([
      [210, 0, true],
      [210, 0, true],
      [210, 210, true],
    ]);
  });
  it('keeps inner spreads whole in spread mode', () => {
    const result = sheetsFor(doc([spread('cover', 'c'), spread('inner', 'i')]), 'spreads');
    expect(result.map((s) => [s.width, s.spreadWidth, s.single])).toEqual([
      [210, 210, true],
      [420, 420, false],
    ]);
  });
});
