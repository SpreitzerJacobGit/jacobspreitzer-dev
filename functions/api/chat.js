const ALLOWED_ORIGINS = [
  'https://jacobspreitzer.dev',
  'https://jacobspreitzer-dev.pages.dev',
  'http://localhost:8788',
  'http://localhost:8000',
];

const MIN_SCORE = 0.3;
const TOP_K = 5;
const MAX_INPUT_CHARS = 500;
const MAX_TOKENS = 600;
const GENERATION_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function onRequestOptions({ request }) {
  return new Response(null, { headers: corsHeaders(request.headers.get('Origin') || '') });
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
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Embed the user query
  let queryVector;
  try {
    const embedResult = await env.AI.run(EMBEDDING_MODEL, { text: [message] });
    queryVector = embedResult.data[0];
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Embedding failed' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Query Vectorize for relevant context
  let contextText = '';
  try {
    const matches = await env.VECTORIZE.query(queryVector, {
      topK: TOP_K,
      returnMetadata: 'all',
    });

    const relevant = (matches.matches || []).filter(m => m.score >= MIN_SCORE);

    if (relevant.length > 0) {
      contextText = relevant
        .map(m => `[${m.metadata.source} — ${m.metadata.heading}]\n${m.metadata.text}`)
        .join('\n\n---\n\n');
    }
  } catch (err) {
    contextText = '';
  }

  const systemPrompt = `You are an AI assistant on Jacob Spreitzer's personal website (jacobspreitzer.dev). Your only job is to help visitors learn about Jacob — his professional background, work experience, technical skills, education, projects, and personal interests.

Only answer questions that are about Jacob Spreitzer. If someone asks about something unrelated — general coding questions, other people, current events, or anything else — politely decline and suggest they ask something about Jacob instead. Keep your tone warm, genuine, and conversational. You're representing Jacob, so be accurate and don't make things up.

If the provided context doesn't fully answer the question, say so honestly. Don't guess or hallucinate details.

${contextText
  ? `Here is relevant information retrieved from Jacob's knowledge base to help answer the question:\n\n--- CONTEXT ---\n${contextText}\n--- END CONTEXT ---`
  : 'No specific context was retrieved for this query. Answer only from what you know from your general training, and be upfront if you are uncertain.'
}`;

  // Generate response via Workers AI
  let result;
  try {
    result = await env.AI.run(GENERATION_MODEL, {
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Generation failed', detail: err.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Convert to SSE stream so the frontend streaming logic works unchanged
  const text = result.response ?? '';
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Emit words with a small gap so the frontend renders progressively
      const words = text.split(/(\s+)/);
      for (const word of words) {
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
