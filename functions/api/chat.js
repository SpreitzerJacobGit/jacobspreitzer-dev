const ALLOWED_ORIGINS = [
  'https://jacobspreitzer.dev',
  'https://jacobspreitzer-dev.pages.dev',
  'http://localhost:8788',
  'http://localhost:8000',
];

const MAX_INPUT_CHARS   = 500;
const MAX_TOKENS        = 450;
const RATE_LIMIT_MAX    = 20;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MIN_SCORE         = 0.2;
const TOP_K             = 5;
const GENERATION_MODEL  = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const EMBEDDING_MODEL   = '@cf/baai/bge-base-en-v1.5';

// ── Helpers ───────────────────────────────────────────────────────────────────

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function sseText(text, cors) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const word of text.split(/(\s+)/)) {
        if (word) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ response: word })}\n\n`)
          );
        }
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      ...cors,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}

function jsonError(msg, status, cors) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function hashIP(ip) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode('rl:' + ip)
  );
  return Array.from(new Uint8Array(buf))
    .slice(0, 12)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

async function checkRateLimit(env, ip) {
  if (!env.RATE_LIMITS) return true; // binding not configured, fail open
  const key = await hashIP(ip);
  const now = Date.now();
  try {
    const raw = await env.RATE_LIMITS.get(key);
    let count = 1, windowStart = now;
    if (raw) {
      const data = JSON.parse(raw);
      if (now - data.windowStart < RATE_LIMIT_WINDOW) {
        if (data.count >= RATE_LIMIT_MAX) return false;
        count = data.count + 1;
        windowStart = data.windowStart;
      }
    }
    await env.RATE_LIMITS.put(
      key,
      JSON.stringify({ count, windowStart }),
      { expirationTtl: Math.ceil(RATE_LIMIT_WINDOW / 1000) }
    );
  } catch {
    // fail open
  }
  return true;
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(contextText) {
  return `You are a friendly AI assistant on Jacob Spreitzer's personal portfolio website. \
Your job is to help visitors learn about Jacob — his work, skills, projects, education, and interests.

Jacob Spreitzer is an Application Developer and ERP Engineer with five years of experience. \
He specializes in Sage X3 customizations, third-party integrations, SQL reporting, and AI-native tooling. \
He's currently at RKL eSolutions and is a certified Sage X3 developer.

Guidelines:
- Answer questions about Jacob's professional background, skills, experience, education, and hobbies
- You may briefly explain technologies Jacob uses, always tying them back to his experience with them
- Decline to share confidential client details, internal business processes, or proprietary information
- For questions completely unrelated to Jacob (e.g. "write me a poem", "what's the weather"), politely redirect
- Be warm, concise, and professional

${contextText
  ? `Context from Jacob's knowledge base — use this to answer accurately:\n\n${contextText}`
  : 'No specific context was retrieved. Answer based on what you know about Jacob from the above description, and be upfront if you lack detail on something specific.'}`;
}

// ── Request handlers ──────────────────────────────────────────────────────────

export async function onRequestOptions({ request }) {
  return new Response(null, {
    headers: corsHeaders(request.headers.get('Origin') || ''),
  });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin') || '';
  const cors = corsHeaders(origin);

  // Parse input
  let message;
  try {
    const body = await request.json();
    message = String(body.message || '').trim().slice(0, MAX_INPUT_CHARS);
  } catch {
    return jsonError('Invalid JSON', 400, cors);
  }
  if (!message) return jsonError('Message is required', 400, cors);

  // Rate limit
  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    'unknown';
  if (!(await checkRateLimit(env, ip))) {
    return sseText(
      "You've reached the message limit for now. Please wait an hour before sending more questions.",
      cors
    );
  }

  // Embed the query
  let embedResult = null;
  try {
    embedResult = await env.AI.run(EMBEDDING_MODEL, { text: [message] });
  } catch {
    // non-fatal — proceed without RAG
  }

  // RAG — retrieve relevant context chunks
  let contextText = '';
  if (embedResult?.data?.[0]) {
    try {
      const matches = await env.VECTORIZE.query(embedResult.data[0], {
        topK: TOP_K,
        returnMetadata: 'all',
      });
      const relevant = (matches.matches || []).filter(m => m.score >= MIN_SCORE);
      if (relevant.length > 0) {
        contextText = relevant
          .map(m => `[${m.metadata.source} — ${m.metadata.heading}]\n${m.metadata.text}`)
          .join('\n\n---\n\n');
      }
    } catch {
      // RAG failure is non-fatal
    }
  }

  // Generate response
  let generated;
  try {
    const result = await env.AI.run(GENERATION_MODEL, {
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: buildSystemPrompt(contextText) },
        { role: 'user', content: message },
      ],
    });
    generated = (result.response || '').trim();
  } catch {
    return sseText('Something went wrong on my end. Please try again in a moment.', cors);
  }

  if (!generated) {
    return sseText('Something went wrong on my end. Please try again in a moment.', cors);
  }

  return sseText(generated, cors);
}
