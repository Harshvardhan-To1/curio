import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { AppConfig } from '../config/configuration';

export interface ChunkInput {
  sourceUrl: string;
  pageTitle: string;
  markdown: string;
  crawledAt: string;
}

export interface CorpusChunk {
  chunkId: string;
  sourceUrl: string;
  pageTitle: string;
  headingPath: string[];
  position: number;
  text: string;
  tokenEstimate: number;
  crawledAt: string;
}

/** Rough token count without a tokenizer dependency (~4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

interface Section {
  headingPath: string[];
  body: string;
}

@Injectable()
export class ChunkerService {
  private readonly target: number;
  private readonly overlap: number;

  constructor(config: ConfigService<AppConfig, true>) {
    this.target = config.get('chunkTargetTokens', { infer: true });
    this.overlap = config.get('chunkOverlapTokens', { infer: true });
  }

  chunk(input: ChunkInput): CorpusChunk[] {
    const sections = this.splitByHeadings(input.markdown);
    const chunks: CorpusChunk[] = [];
    let position = 0;

    for (const section of sections) {
      for (const text of this.splitSection(section.body)) {
        const trimmed = text.trim();
        if (!trimmed) continue;
        chunks.push({
          chunkId: this.chunkId(input.sourceUrl, position, trimmed),
          sourceUrl: input.sourceUrl,
          pageTitle: input.pageTitle,
          headingPath: section.headingPath,
          position,
          text: trimmed,
          tokenEstimate: estimateTokens(trimmed),
          crawledAt: input.crawledAt,
        });
        position++;
      }
    }
    return chunks;
  }

  /** Break markdown into sections keyed by their heading path (h1>h2>h3...). */
  private splitByHeadings(markdown: string): Section[] {
    const lines = markdown.split('\n');
    const sections: Section[] = [];
    const stack: { level: number; text: string }[] = [];
    let buffer: string[] = [];

    const flush = () => {
      const body = buffer.join('\n').trim();
      if (body) sections.push({ headingPath: stack.map((s) => s.text), body });
      buffer = [];
    };

    for (const line of lines) {
      const m = /^(#{1,6})\s+(.*)$/.exec(line);
      if (m) {
        flush();
        const level = m[1].length;
        while (stack.length && stack[stack.length - 1].level >= level) {
          stack.pop();
        }
        stack.push({ level, text: m[2].trim() });
      } else {
        buffer.push(line);
      }
    }
    flush();
    return sections.length ? sections : [{ headingPath: [], body: markdown }];
  }

  /**
   * Greedy paragraph packing into ~target-token chunks with token overlap.
   * Oversized paragraphs recurse into sentences, then words.
   */
  private splitSection(body: string): string[] {
    const units = this.atomicUnits(body);
    const chunks: string[] = [];
    let current: string[] = [];
    let currentTokens = 0;

    const push = () => {
      if (current.length) chunks.push(current.join('\n\n'));
    };

    for (const unit of units) {
      const t = estimateTokens(unit);
      if (currentTokens + t > this.target && current.length) {
        push();
        const carry = this.overlapTail(current);
        current = carry ? [carry] : [];
        currentTokens = carry ? estimateTokens(carry) : 0;
      }
      current.push(unit);
      currentTokens += t;
    }
    push();
    return chunks;
  }

  /** Paragraphs, but any paragraph over target is broken down recursively. */
  private atomicUnits(body: string): string[] {
    const paragraphs = body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    const units: string[] = [];
    for (const p of paragraphs) {
      if (estimateTokens(p) <= this.target) {
        units.push(p);
      } else {
        units.push(...this.breakLarge(p));
      }
    }
    return units;
  }

  private breakLarge(text: string): string[] {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const out: string[] = [];
    let buf = '';
    for (const s of sentences) {
      const piece = s.length > this.target * 4 ? this.breakByWords(s) : [s];
      for (const part of piece) {
        if (estimateTokens(buf + ' ' + part) > this.target && buf) {
          out.push(buf.trim());
          buf = '';
        }
        buf += (buf ? ' ' : '') + part;
      }
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  private breakByWords(text: string): string[] {
    const words = text.split(/\s+/);
    const out: string[] = [];
    let buf = '';
    for (const w of words) {
      if (estimateTokens(buf + ' ' + w) > this.target && buf) {
        out.push(buf.trim());
        buf = '';
      }
      buf += (buf ? ' ' : '') + w;
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  /** Take the last ~overlap tokens of a chunk to prepend to the next one. */
  private overlapTail(units: string[]): string | null {
    if (this.overlap <= 0) return null;
    const text = units.join('\n\n');
    const approxChars = this.overlap * 4;
    if (text.length <= approxChars) return text;
    const tail = text.slice(text.length - approxChars);
    const space = tail.indexOf(' ');
    return space > 0 ? tail.slice(space + 1) : tail;
  }

  private chunkId(url: string, position: number, text: string): string {
    return createHash('sha1')
      .update(`${url}::${position}::${text}`)
      .digest('hex')
      .slice(0, 16);
  }
}
