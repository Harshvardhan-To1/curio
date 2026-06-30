import { Injectable, Logger } from '@nestjs/common';
import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import * as cheerio from 'cheerio';

export interface ExtractResult {
  title: string;
  markdown: string;
  excerpt: string;
  /** Approximate clean-text length, used to skip near-empty pages. */
  textLength: number;
  /** Normalized in-document links discovered for BFS expansion. */
  links: string[];
}

/**
 * Turns raw HTML into clean Markdown:
 *   1. parse with jsdom, strip active/boilerplate nodes (defense-in-depth XSS),
 *   2. extract main content with Readability (falls back to <body>),
 *   3. convert to Markdown with Turndown (headings + lists preserved).
 * Links are harvested from the ORIGINAL document (not just the article) so BFS
 * can still find nav links, while content comes from the article body only.
 */
@Injectable()
export class ExtractorService {
  private readonly logger = new Logger(ExtractorService.name);
  private readonly turndown: TurndownService;

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });
    // Never carry executable or invisible nodes into the corpus.
    this.turndown.remove(['script', 'style', 'noscript', 'iframe', 'form']);
  }

  extract(html: string, sourceUrl: string): ExtractResult | null {
    const links = this.harvestLinks(html, sourceUrl);

    const virtualConsole = new VirtualConsole(); // swallow noisy CSS/JS errors
    let dom: JSDOM;
    try {
      dom = new JSDOM(html, { url: sourceUrl, virtualConsole });
    } catch (err) {
      this.logger.warn(
        `jsdom parse failed for ${sourceUrl}: ${(err as Error).message}`,
      );
      return null;
    }

    const doc = dom.window.document;
    doc
      .querySelectorAll('script, style, noscript, template, svg')
      .forEach((el) => el.remove());

    let articleHtml = '';
    let title = doc.title?.trim() ?? '';
    try {
      const reader = new Readability(doc.cloneNode(true) as Document);
      const article = reader.parse();
      if (article && article.content) {
        articleHtml = article.content;
        title = (article.title || title).trim();
      }
    } catch (err) {
      this.logger.debug(
        `Readability failed for ${sourceUrl}: ${(err as Error).message}`,
      );
    }

    // Fallback: if Readability bailed, take the <body> directly.
    if (!articleHtml) {
      articleHtml = doc.body?.innerHTML ?? '';
    }

    const markdown = this.turndown.turndown(articleHtml).trim();
    const excerpt = markdown.replace(/\s+/g, ' ').slice(0, 280);
    const textLength = markdown.replace(/[#*_>`\-\[\]()]/g, '').trim().length;

    dom.window.close();

    if (textLength < 40) return null; // effectively empty page

    return { title: title || sourceUrl, markdown, excerpt, textLength, links };
  }

  /** Collect normalized, crawlable, follow-able links from the raw HTML. */
  private harvestLinks(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html);
    const out = new Set<string>();
    $('a[href]').each((_, el) => {
      const rel = ($(el).attr('rel') ?? '').toLowerCase();
      if (rel.includes('nofollow')) return;
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const abs = new URL(href, baseUrl).toString();
        out.add(abs);
      } catch {
        /* ignore malformed hrefs */
      }
    });
    return [...out];
  }
}
