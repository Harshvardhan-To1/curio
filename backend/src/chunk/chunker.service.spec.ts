import { ConfigService } from '@nestjs/config';
import { ChunkerService, estimateTokens } from './chunker.service';

function makeChunker(target = 60, overlap = 10): ChunkerService {
  const config = {
    get: (key: string) =>
      key === 'chunkTargetTokens'
        ? target
        : key === 'chunkOverlapTokens'
          ? overlap
          : undefined,
  } as unknown as ConfigService;
  return new ChunkerService(config as unknown as ConfigService<never, true>);
}

const crawledAt = '2026-06-29T00:00:00.000Z';

describe('ChunkerService', () => {
  it('tracks heading paths per section', () => {
    const md = `# Title\n\nIntro paragraph.\n\n## Section A\n\nBody of A.\n\n### A.1\n\nDeep body.`;
    const chunks = makeChunker(200, 0).chunk({
      sourceUrl: 'https://a.com',
      pageTitle: 'T',
      markdown: md,
      crawledAt,
    });
    const paths = chunks.map((c) => c.headingPath.join(' > '));
    expect(paths).toContain('Title');
    expect(paths).toContain('Title > Section A');
    expect(paths).toContain('Title > Section A > A.1');
  });

  it('assigns increasing positions and stable ids', () => {
    const md = Array.from(
      { length: 8 },
      (_, i) => `Paragraph number ${i} with some filler words here.`,
    ).join('\n\n');
    const c = makeChunker(40, 5);
    const a = c.chunk({
      sourceUrl: 'https://a.com',
      pageTitle: 'T',
      markdown: md,
      crawledAt,
    });
    const b = c.chunk({
      sourceUrl: 'https://a.com',
      pageTitle: 'T',
      markdown: md,
      crawledAt,
    });
    expect(a.length).toBeGreaterThan(1);
    expect(a.map((x) => x.position)).toEqual(a.map((_, i) => i));
    expect(a.map((x) => x.chunkId)).toEqual(b.map((x) => x.chunkId)); // deterministic
  });

  it('keeps chunks near the token target', () => {
    const md = Array.from(
      { length: 40 },
      () => 'lorem ipsum dolor sit amet',
    ).join(' ');
    const chunks = makeChunker(50, 10).chunk({
      sourceUrl: 'https://a.com',
      pageTitle: 'T',
      markdown: md,
      crawledAt,
    });
    for (const ch of chunks) {
      expect(ch.tokenEstimate).toBeLessThanOrEqual(50 * 1.5);
    }
  });

  it('returns nothing for empty input', () => {
    expect(
      makeChunker().chunk({
        sourceUrl: 'x',
        pageTitle: 'T',
        markdown: '   ',
        crawledAt,
      }),
    ).toHaveLength(0);
  });
});

describe('estimateTokens', () => {
  it('is roughly chars/4', () => {
    expect(estimateTokens('a'.repeat(40))).toBe(10);
    expect(estimateTokens('')).toBe(1);
  });
});
