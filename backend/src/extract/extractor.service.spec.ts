import { ExtractorService } from './extractor.service';

const svc = new ExtractorService();

const html = `<!DOCTYPE html><html><head><title>Hello Page</title></head>
<body>
  <nav><a href="/skip" rel="nofollow">skip me</a></nav>
  <article>
    <h1>Main Heading</h1>
    <p>This is the first real paragraph with enough text to be extracted by readability heuristics so the article is not discarded as boilerplate.</p>
    <h2>Subsection</h2>
    <ul><li>point one</li><li>point two</li></ul>
    <p>Another substantial paragraph of content to give the extractor enough signal to keep this page and convert it to markdown cleanly.</p>
    <a href="/about">About us</a>
    <script>window.evil = 'should not appear';</script>
  </article>
</body></html>`;

describe('ExtractorService', () => {
  it('extracts title, markdown and headings', () => {
    const r = svc.extract(html, 'https://a.com/page');
    expect(r).not.toBeNull();
    // Readability sources the title from <title>; headings live in the markdown.
    expect(r!.title).toContain('Hello Page');
    expect(r!.markdown).toMatch(/Main Heading/);
    expect(r!.markdown).toMatch(/point one/);
  });

  it('strips script content from the output', () => {
    const r = svc.extract(html, 'https://a.com/page');
    expect(r!.markdown).not.toMatch(/window.evil|should not appear/);
  });

  it('harvests follow links but excludes nofollow', () => {
    const r = svc.extract(html, 'https://a.com/page');
    expect(r!.links).toContain('https://a.com/about');
    expect(r!.links).not.toContain('https://a.com/skip');
  });

  it('returns null for near-empty pages', () => {
    expect(
      svc.extract('<html><body><p>hi</p></body></html>', 'https://a.com'),
    ).toBeNull();
  });
});
