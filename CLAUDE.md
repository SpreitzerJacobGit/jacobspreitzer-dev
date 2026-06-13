# CLAUDE.md — AI Context for jacobspreitzer.dev

This file is read automatically by Claude Code at the start of every session. It contains everything an AI assistant needs to work on this project effectively.

## Critical instruction

**Always update this file and README.md when making changes that affect architecture, design decisions, project structure, or the knowledge base pipeline.** This documentation is the source of truth for future AI sessions. If you add a new file, change the deploy pipeline, modify the chat architecture, or introduce a new design pattern, update the relevant section here before closing the task.

---

## Project identity

**What this is:** Jacob Spreitzer's personal resume/portfolio website, live at `jacobspreitzer.dev`. It's a showcase of both Jacob's professional background and his technical ability — the site itself is meant to demonstrate frontend craft and AI engineering skill.

**Who Jacob is:** Application Developer & ERP Engineer. Five years of experience building custom Sage X3 modifications, third-party integrations (.NET, PowerShell, SFTP, web services), SQL reporting pipelines (SSRS, SSIS), and Power BI dashboards. Currently at RKL eSolutions (Apr 2023–present). Previously at Gaming Laboratories International (test engineer + SQL data analyst). Certified Sage X3 Developer. B.S. Computer Science & Engineering, University of Nevada Reno, 2021. Minors in Mathematics and Big Data.

**Design philosophy:** The site is intentionally opinionated — not a template. It should feel like a living technical environment. Animations exist to convey depth and identity, not novelty. Every interaction detail (hover direction, transition timing, type choices) is deliberate.

---

## Tech stack

- **Frontend:** Plain HTML/CSS/JS — no framework, no build step, no bundler
- **Hosting:** Cloudflare Pages (project: `jacobspreitzer-dev`, custom domain: `jacobspreitzer.dev`)
- **API:** Cloudflare Pages Functions (edge runtime, `/functions/api/`)
- **Vector DB:** Cloudflare Vectorize (index: `jacobspreitzer-knowledge`, 768d cosine)
- **Embeddings:** Cloudflare Workers AI — `@cf/baai/bge-base-en-v1.5`
- **LLM:** Cloudflare Workers AI — `@cf/meta/llama-3.1-8b-instruct` for chat (free tier, no external API key)
- **CI/CD:** GitHub Actions → wrangler CLI
- **Fonts (CDN):** Lora, DM Sans, DM Mono (Google Fonts)
- **3D:** Three.js r128 (CDN)

---

## Design system — do not deviate from this

### Color tokens (defined in `css/style.css` `:root`)

```css
--bg: #1a1f14          /* Page background — dark olive-black */
--bg-card: #222b1a     /* Card background */
--bg-card2: #293320    /* Secondary card */
--accent: #7dab5a      /* Primary green — the signature color */
--accent2: #c4874a     /* Amber — secondary, use sparingly */
--text: #f0ece0        /* Warm off-white — never use pure #fff */
--muted: #8a9178       /* Secondary text, labels */
--border: rgba(125,171,90,0.22)       /* Visible green-tinted border */
--border-subtle: rgba(240,236,224,0.08) /* Barely-there divider */
--tag-bg: rgba(125,171,90,0.12)       /* Skill/tag fill */
```

**Never introduce new hardcoded hex colors.** Always use these tokens or derive transparencies from them.

### Typography rules

- Headings (`h1`, `h2`, hero name canvas) → **Lora** serif
- Body text, UI elements → **DM Sans**
- Monospace labels, dates, nav logo, code-style text, chat input → **DM Mono**
- Do not introduce other fonts.

### Spacing and sizing patterns

- Section padding: `6rem 4rem` (desktop), `padding-left/right: 1.5rem` (mobile < 700px)
- Card border-radius: `8px`
- Transition duration: `0.2s` for hover states, `0.6s` for scroll fade-in
- Card hover: `translateX(4px)` for experience cards (directional); `translateY(-3px)` for contact/hobby cards (lift)

### New UI components must follow these conventions

- Background: `var(--bg-card)`
- Border: `1px solid var(--border-subtle)`, changes to `var(--border)` on hover
- Border-radius: `8px`
- Labels: DM Mono, `0.7rem`, `var(--accent)`, uppercase, `letter-spacing: 0.1em`

---

## File structure

```
index.html                     # All page markup
css/
  style.css                    # All global styles + CSS variables
  chat.css                     # Chat widget styles
js/
  fade-in.js                   # IntersectionObserver scroll reveal
  background.js                # Three.js: hero scene + global wireframe scene (shared renderer)
  name-animation.js            # Canvas 2D: particle name animation with wind + mouse repulsion
  chat.js                      # Chat widget: open/close, fetch streaming, SSE token render
functions/
  api/
    chat.js                    # Pages Function: embed query → Vectorize → Claude streaming
knowledge/
  about.md                     # General bio and values
  experience.md                # Work history (detailed)
  skills.md                    # Technical skills with context
  education.md                 # Degree, university, minors
  personal.md                  # Hobbies: cycling, table tennis, tea, productivity
  contact.md                   # Contact info and availability
scripts/
  ingest.js                    # Knowledge base ingestion pipeline (Node.js, REST APIs)
assets/                        # Static assets
wrangler.toml                  # Cloudflare bindings: AI + Vectorize
.dev.vars                      # Local secrets — GITIGNORED, never commit
.github/workflows/
  deploy.yml                   # Deploy on push to master
  ingest.yml                   # Re-ingest knowledge base on knowledge/** changes
README.md                      # Human-readable project docs
CLAUDE.md                      # This file — AI session context
```

---

## Cloudflare account context

- **Account ID:** `1d5aae43ba2cc8bc0817e5032247c734`
- **Pages project name:** `jacobspreitzer-dev`
- **Vectorize index:** `jacobspreitzer-knowledge` (768 dimensions, cosine metric, preset: `@cf/baai/bge-base-en-v1.5`)
- **GitHub repo:** `https://github.com/SpreitzerJacobGit/jacobspreitzer-dev`
- **GitHub Actions secrets set:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- **Pages secrets set:** none (all AI via Workers AI binding, no external keys needed)

---

## Chatbot architecture

The chat widget is a RAG pipeline. When a user sends a message:

1. `POST /api/chat` hits `functions/api/chat.js`
2. The function embeds the user query via `env.AI.run('@cf/baai/bge-base-en-v1.5', { text: message })`
3. Queries `env.VECTORIZE.query(vector, { topK: 5, returnMetadata: 'all' })`
4. Builds a system prompt with persona + guardrails + retrieved context chunks
5. Calls `env.AI.run('@cf/meta/llama-3.1-8b-instruct', { stream: true, max_tokens: 600, messages: [...] })`
6. Forwards the SSE stream directly to the browser
7. Frontend reads the stream via `response.body.getReader()` and renders tokens as they arrive

**Guardrails:** The system prompt instructs Claude to only answer questions about Jacob Spreitzer, decline off-topic requests, and be honest when context doesn't cover a question.

**Cost controls:** `max_tokens: 600`, user message capped at 500 chars, CORS locked to `jacobspreitzer.dev`.

---

## Knowledge base pipeline

The `knowledge/` directory is the single source of truth for what the chatbot knows.

**Chunking strategy in `scripts/ingest.js`:**
- Split markdown on H1/H2 headings
- If a chunk exceeds ~1600 chars, split further by paragraph with 1-paragraph overlap
- Each chunk is prefixed with its source and heading for retrieval context
- Vector ID: deterministic hash of `(source + heading + chunkIndex)` — re-runs are safe

**To update the chatbot's knowledge:**
1. Edit/add `.md` files in `knowledge/`
2. Commit and push to master
3. GitHub Actions `ingest.yml` triggers automatically
4. Done — chatbot reflects changes within minutes

**Adding a new knowledge file:** Just drop it in `knowledge/`. No code changes needed. The ingestion script reads all `*.md` files in that directory.

---

## Deployment pipeline

- **Site changes:** push to `master` → `deploy.yml` → `wrangler pages deploy .` → live in ~30s
- **Knowledge base changes:** push to `master` with changes in `knowledge/**` → `ingest.yml` → `node scripts/ingest.js` → Vectorize updated
- **Both trigger on the same push** if both code and knowledge changed

---

## Local development

```bash
# Full stack (Pages Functions + bindings)
npx wrangler pages dev .

# Knowledge base ingestion (requires CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN in env)
node scripts/ingest.js

# Static only (no chat API)
python3 -m http.server
```

No secrets are needed for local dev — Workers AI and Vectorize are accessed via the bindings defined in `wrangler.toml`, which `wrangler pages dev` resolves automatically using your logged-in Cloudflare account.

---

## What NOT to do

- Do not add npm dependencies or a build step to the frontend — it's intentionally zero-build
- Do not introduce new fonts, colors outside the design token system, or border-radius values other than `8px`
- Do not use `style=""` inline styles for new UI elements — add to `css/style.css` or `css/chat.css`
- Do not commit `.dev.vars`, `.wrangler/`, or `.claude/` — all are gitignored
- Do not hardcode the Cloudflare account ID or any API keys in source files
- Do not change the Three.js scene structure in `background.js` without testing that both the hero canvas and global canvas still render correctly
