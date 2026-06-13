import { createHash } from 'crypto';
import { readdir, readFile } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const INDEX_NAME = 'jacobspreitzer-knowledge';
const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';
const MAX_CHUNK_CHARS = 1500;

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = join(__dirname, '..', 'knowledge');

async function embedText(text) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${EMBED_MODEL}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: [text] }),
    }
  );
  const data = await res.json();
  if (!data.success) throw new Error(`Embedding failed: ${JSON.stringify(data.errors)}`);
  return data.result.data[0];
}

async function upsertVectors(vectors) {
  const ndjson = vectors.map(v => JSON.stringify(v)).join('\n');
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/v2/indexes/${INDEX_NAME}/upsert`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/x-ndjson',
      },
      body: ndjson,
    }
  );
  const data = await res.json();
  if (!data.success) throw new Error(`Upsert failed: ${JSON.stringify(data.errors)}`);
  return data.result;
}

function chunkMarkdown(content, source) {
  const chunks = [];
  const lines = content.split('\n');

  let currentHeading = 'Overview';
  let currentBody = [];

  const flush = () => {
    const body = currentBody.join('\n').trim();
    if (body) chunks.push(...splitByParagraph(currentHeading, body, source));
    currentBody = [];
  };

  for (const line of lines) {
    if (/^#{1,2} /.test(line)) {
      flush();
      currentHeading = line.replace(/^#{1,2} /, '').trim();
    } else {
      currentBody.push(line);
    }
  }
  flush();

  return chunks;
}

function splitByParagraph(heading, body, source) {
  const fullText = `${heading}\n\n${body}`;
  if (fullText.length <= MAX_CHUNK_CHARS) {
    return [{ heading, text: fullText, source }];
  }

  const paragraphs = body.split(/\n\n+/);
  const results = [];
  let current = '';
  let chunkIndex = 0;
  let prevPara = '';

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > MAX_CHUNK_CHARS && current) {
      const label = chunkIndex === 0 ? heading : `${heading} (continued)`;
      results.push({ heading: label, text: `${label}\n\n${current}`, source });
      chunkIndex++;
      current = prevPara ? `${prevPara}\n\n${para}` : para; // 1-paragraph overlap
    } else {
      current = candidate;
    }
    prevPara = para;
  }

  if (current) {
    const label = chunkIndex === 0 ? heading : `${heading} (continued)`;
    results.push({ heading: label, text: `${label}\n\n${current}`, source });
  }

  return results;
}

function chunkId(source, heading, index) {
  return createHash('sha256')
    .update(`${source}::${heading}::${index}`)
    .digest('hex')
    .slice(0, 32);
}

async function ingest() {
  if (!ACCOUNT_ID || !API_TOKEN) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set in environment');
  }

  const files = (await readdir(KNOWLEDGE_DIR)).filter(f => f.endsWith('.md'));
  console.log(`\nFound ${files.length} knowledge file(s) in knowledge/\n`);

  let totalChunks = 0;

  for (const file of files) {
    const content = await readFile(join(KNOWLEDGE_DIR, file), 'utf-8');
    const source = basename(file);
    const chunks = chunkMarkdown(content, source);

    console.log(`  ${source}: ${chunks.length} chunk(s)`);

    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      process.stdout.write(`    [${i + 1}/${chunks.length}] Embedding "${chunk.heading}"...`);
      const embedding = await embedText(chunk.text);
      vectors.push({
        id: chunkId(source, chunk.heading, i),
        values: embedding,
        metadata: {
          source: chunk.source,
          heading: chunk.heading,
          text: chunk.text,
        },
      });
      process.stdout.write(' done\n');
    }

    // Upsert in batches of 100 (Vectorize limit)
    const BATCH = 100;
    for (let i = 0; i < vectors.length; i += BATCH) {
      const batch = vectors.slice(i, i + BATCH);
      await upsertVectors(batch);
      console.log(`    → Upserted ${batch.length} vector(s)`);
    }

    totalChunks += chunks.length;
    console.log();
  }

  console.log(`✓ Ingestion complete. Total chunks: ${totalChunks}`);
}

ingest().catch(err => {
  console.error('\n✗ Ingestion failed:', err.message);
  process.exit(1);
});
