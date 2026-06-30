/**
 * End-to-end smoke test: enqueue a crawl against the running API, poll until it
 * finishes, then fetch the first page of corpus chunks. Run with `make seed`
 * (or `npm run seed`) once `docker-compose up` is healthy.
 *
 *   API_URL=http://localhost:8000 SEED_URL=https://example.com npm run seed
 */

const API_URL = process.env.API_URL ?? 'http://localhost:8000';
const SEED_URL = process.env.SEED_URL ?? 'https://example.com';

async function main() {
  console.log(`→ POST ${API_URL}/api/crawl  (url=${SEED_URL})`);
  const createRes = await fetch(`${API_URL}/api/crawl`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: SEED_URL,
      options: { maxPages: 5, maxDepth: 1 },
    }),
  });
  if (!createRes.ok) {
    throw new Error(
      `crawl create failed: ${createRes.status} ${await createRes.text()}`,
    );
  }
  const { jobId } = (await createRes.json()) as { jobId: string };
  console.log(`  jobId = ${jobId}`);

  const deadline = Date.now() + 120_000;
  let state = 'pending';
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const s = await (
      await fetch(`${API_URL}/api/crawl/${jobId}/status`)
    ).json();
    state = s.state;
    process.stdout.write(
      `\r  state=${state} pages=${s.pagesDone}/${s.pagesFound} chunks=${s.chunkCount}   `,
    );
    if (state === 'completed' || state === 'failed') break;
  }
  console.log('');

  if (state !== 'completed')
    throw new Error(`crawl did not complete (state=${state})`);

  const corpus = await (
    await fetch(`${API_URL}/api/crawl/${jobId}/corpus?limit=3`)
  ).json();
  console.log(`✓ corpus: ${corpus.total} chunks (mode=${corpus.embedMode})`);
  for (const c of corpus.chunks) {
    console.log(
      `  • [${c.headingPath.join(' > ') || '-'}] ${c.text.slice(0, 80)}…`,
    );
  }
  console.log('Smoke test passed.');
}

main().catch((err) => {
  console.error('Smoke test FAILED:', err.message);
  process.exit(1);
});
