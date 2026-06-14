const ALLOWED_ORIGINS = [
  'https://jacobspreitzer.dev',
  'https://jacobspreitzer-dev.pages.dev',
  'http://localhost:8788',
  'http://localhost:8000',
];

const MAX_INPUT_CHARS = 500;
const MAX_TOKENS_MAIN = 350;
const MAX_TOKENS_CLASSIFY = 8;
const MAX_TOKENS_VALIDATE = 4;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MIN_SCORE = 0.3;
const TOP_K = 5;
const GENERATION_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const CLASSIFIER_MODEL  = '@cf/meta/llama-3.2-3b-instruct';
const EMBEDDING_MODEL   = '@cf/baai/bge-base-en-v1.5';

const MSG = {
  OFF_TOPIC:
    "I'm here to help you learn about Jacob Spreitzer! Feel free to ask about his work experience, skills, education, hobbies, or how to get in touch.",
  SENSITIVE:
    "That's not something I'm able to share details about. I'm happy to tell you about Jacob's professional background, skills, and interests — what would you like to know?",
  RATE_LIMITED:
    "You've reached the message limit for now. Please wait an hour before sending more questions.",
  ERROR: "Something went wrong on my end. Please try again in a moment.",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// Emit text as word-by-word SSE so the frontend streaming animation works unchanged.
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

// ── LAYER 1: Rate limiting (KV) ───────────────────────────────────────────────
// 20 requests per IP per rolling hour window. Key is a hashed IP for privacy.
// Fails open on KV errors so a storage hiccup never blocks legitimate users.

async function checkRateLimit(env, ip) {
  const key = await hashIP(ip);
  const now = Date.now();
  try {
    const raw = await env.RATE_LIMITS.get(key);
    let count = 1;
    let windowStart = now;
    if (raw) {
      const data = JSON.parse(raw);
      if (now - data.windowStart < RATE_LIMIT_WINDOW_MS) {
        if (data.count >= RATE_LIMIT_MAX) return false;
        count = data.count + 1;
        windowStart = data.windowStart;
      }
    }
    await env.RATE_LIMITS.put(
      key,
      JSON.stringify({ count, windowStart }),
      { expirationTtl: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) }
    );
  } catch {
    // fail open
  }
  return true;
}

// ── LAYER 2: Input pre-classification ────────────────────────────────────────
// Runs before main generation. Blocks clearly off-topic or sensitive probes
// without spending the full token budget. Uses semantic understanding — no
// hardcoded keywords or employer names. Fails open on model errors.

async function classifyInput(env, message) {
  try {
    const result = await env.AI.run(CLASSIFIER_MODEL, {
      max_tokens: MAX_TOKENS_CLASSIFY,
      messages: [
        {
          role: 'system',
          content: 'You are a content classifier. Reply with one word only: SAFE, SENSITIVE, or OFFTOPIC.',
        },
        {
          role: 'user',
          content:
            'Classify this question into exactly one category:\n' +
            "SAFE — about Jacob Spreitzer's work history, skills, education, hobbies, contact info, or technologies he uses\n" +
            'SENSITIVE — probing internal employer business processes, trade secrets, confidential client details, or proprietary information\n' +
            'OFFTOPIC — unrelated to Jacob Spreitzer, or harmful, political, or inappropriate\n\n' +
            `Question: "${message}"\n` +
            'Classification:',
        },
      ],
    });
    const label = (result.response || '').trim().toUpperCase();
    if (label.startsWith('SENSITIVE')) return 'SENSITIVE';
    if (label.startsWith('OFFTOPIC')) return 'OFFTOPIC';
    return 'SAFE';
  } catch {
    return 'SAFE'; // fail open
  }
}

// ── LAYER 3: Hardened system prompt ──────────────────────────────────────────
// The model's primary guardrail. Defines exact scope, explicit prohibitions,
// and a mandatory self-check the model must perform before every response.

function buildSystemPrompt(contextText) {
  return `You are an AI assistant on Jacob Spreitzer's personal website (jacobspreitzer.dev). \
Your only purpose is helping visitors learn about Jacob in a warm, accurate, and professional way.

YOU MAY DISCUSS:
- Jacob's work history and the types of projects and responsibilities he has had
- His technical skills, tools, and certifications
- His education
- His personal interests and hobbies
- How to contact Jacob and his availability for work
- Brief factual explanations of technologies Jacob works with — keep these concise and always tie them back to Jacob's experience with them

YOU MUST NEVER:
- Reveal or describe internal business processes, workflows, procedures, or methodologies of any employer or client
- Disclose specific client names, client project details, or any information about an employer's clients beyond what Jacob has made publicly available on his resume or website
- Share proprietary systems, internal tooling, trade secrets, or any confidential operational detail of any organization Jacob has worked for
- Discuss internal pricing, contracts, business strategies, or any commercially sensitive information
- Comment on or take positions on politics, religion, social issues, or any controversial topic
- Generate harmful, inappropriate, adult, or violent content
- Answer general programming questions, write code, or assist with tasks unrelated to learning about Jacob
- Pretend to be Jacob or speak in first person as Jacob

BEFORE WRITING EACH RESPONSE, YOU MUST VERIFY:
1. Does my response reveal anything about internal employer operations, client specifics, or trade secrets? If any doubt exists, decline.
2. Is this question genuinely about Jacob Spreitzer? If not, decline warmly and redirect.
3. Is my tone positive, helpful, and professional?

When declining, always be friendly and redirect to what you can help with. Never be curt or dismissive.

${contextText
    ? `RETRIEVED CONTEXT FROM JACOB'S KNOWLEDGE BASE:\n\n--- BEGIN ---\n${contextText}\n--- END ---`
    : 'No specific context retrieved. Answer only from clearly established facts about Jacob. Be upfront if you are uncertain about a detail.'}`;
}

// ── LAYER 4: Output validation ────────────────────────────────────────────────
// Inspects the full buffered response before it reaches the user. Uses the model
// to semantically check for leakage rather than keyword matching. Fails open so
// a validator error never silently swallows a legitimate response.

async function validateOutput(env, text) {
  try {
    const result = await env.AI.run(CLASSIFIER_MODEL, {
      max_tokens: MAX_TOKENS_VALIDATE,
      messages: [
        {
          role: 'system',
          content: 'You are a safety checker. Reply with YES or NO only.',
        },
        {
          role: 'user',
          content:
            'Does this response contain any of the following? Answer YES or NO.\n' +
            '- Internal employer business processes or operational details\n' +
            '- Confidential client information or trade secrets\n' +
            '- Inappropriate, political, or harmful content\n\n' +
            `Response: "${text.slice(0, 600)}"\n\n` +
            'Answer:',
        },
      ],
    });
    return !(result.response || '').trim().toUpperCase().startsWith('YES');
  } catch {
    return true; // fail open
  }
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

  // Parse and validate input
  let message;
  try {
    const body = await request.json();
    message = String(body.message || '').trim().slice(0, MAX_INPUT_CHARS);
  } catch {
    return jsonError('Invalid JSON', 400, cors);
  }
  if (!message) return jsonError('Message is required', 400, cors);

  // LAYER 1 — Rate limit
  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    'unknown';
  if (!(await checkRateLimit(env, ip))) {
    return sseText(MSG.RATE_LIMITED, cors);
  }

  // LAYER 2 — Pre-classify input (parallel with embedding to save latency)
  const [classification, embedResult] = await Promise.all([
    classifyInput(env, message),
    env.AI.run(EMBEDDING_MODEL, { text: [message] }).catch(() => null),
  ]);

  if (classification === 'SENSITIVE') return sseText(MSG.SENSITIVE, cors);
  if (classification === 'OFFTOPIC') return sseText(MSG.OFF_TOPIC, cors);

  // RAG — retrieve context using the embedding computed above
  let contextText = '';
  if (embedResult) {
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

  // LAYER 3 — Main generation (buffered so Layer 4 can inspect before returning)
  let generated;
  try {
    const result = await env.AI.run(GENERATION_MODEL, {
      max_tokens: MAX_TOKENS_MAIN,
      messages: [
        { role: 'system', content: buildSystemPrompt(contextText) },
        { role: 'user', content: message },
      ],
    });
    generated = (result.response || '').trim();
  } catch {
    return sseText(MSG.ERROR, cors);
  }

  if (!generated) return sseText(MSG.ERROR, cors);

  // LAYER 4 — Output validation before anything reaches the user
  if (!(await validateOutput(env, generated))) {
    return sseText(MSG.SENSITIVE, cors);
  }

  return sseText(generated, cors);
}
