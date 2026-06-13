# Jacob Spreitzer — Personal Site

Personal resume and portfolio site for Jacob Spreitzer, Application Developer & ERP Engineer. Live at [jacobspreitzer.dev](https://jacobspreitzer.dev).

---

## Running locally

```bash
# Static site only (no chat API)
python3 -m http.server
# Then open http://localhost:8000

# Full stack with Pages Functions (chat API + bindings)
npx wrangler pages dev .
# Then open http://localhost:8788
```

---

## Project structure

```
.
├── index.html                    # Page markup
├── wrangler.toml                 # Cloudflare bindings (AI, Vectorize)
├── css/
│   ├── style.css                 # All site styles
│   └── chat.css                  # Chat widget styles
├── js/
│   ├── fade-in.js                # Scroll-triggered fade-in observer
│   ├── background.js             # Three.js wireframe background (hero + global)
│   ├── name-animation.js         # Canvas particle animation for hero name
│   └── chat.js                   # Chat widget UI + streaming SSE logic
├── functions/
│   └── api/
│       └── chat.js               # Cloudflare Pages Function: RAG + Anthropic API
├── knowledge/                    # Markdown knowledge base (fed to the chatbot)
│   ├── about.md
│   ├── experience.md
│   ├── skills.md
│   ├── education.md
│   ├── personal.md
│   └── contact.md
├── scripts/
│   └── ingest.js                 # Ingestion pipeline: chunk → embed → Vectorize upsert
├── assets/                       # Static assets (images, icons, etc.)
└── .github/workflows/
    ├── deploy.yml                # Auto-deploy to Cloudflare Pages on push to master
    └── ingest.yml                # Auto-ingest knowledge base on changes to knowledge/**
```

---

## Design system

The site uses a dark, warm-olive aesthetic inspired by terminal greens and natural earth tones. It's intentionally opinionated — not a generic dark theme.

### Colors

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#1a1f14` | Page background |
| `--bg-card` | `#222b1a` | Card/panel backgrounds |
| `--bg-card2` | `#293320` | Secondary card backgrounds |
| `--accent` | `#7dab5a` | Primary green — links, highlights, borders on hover |
| `--accent2` | `#c4874a` | Amber — secondary accent, used sparingly |
| `--text` | `#f0ece0` | Primary text (warm off-white, not pure white) |
| `--muted` | `#8a9178` | Secondary text, labels, placeholders |
| `--border` | `rgba(125,171,90,0.22)` | Visible borders (accent-tinted) |
| `--border-subtle` | `rgba(240,236,224,0.08)` | Barely-there dividers |
| `--tag-bg` | `rgba(125,171,90,0.12)` | Skill tag fill |

### Typography

- **Lora** (serif) — headings and the hero name. Signals depth and craftsmanship, contrasts against the technical mono elements.
- **DM Sans** — body text. Clean, modern, readable at all sizes.
- **DM Mono** — labels, dates, nav logo, tag-style text. Anchors the developer identity.

### Motion & animation

Three layers of animation, each with a distinct purpose:

1. **Global wireframe background** (`js/background.js`, `#global-canvas`) — slow-orbiting Three.js wireframe polyhedra spanning the full page. Opacity 0.18 — present but never distracting. Runs at half framerate (~30fps) for performance.
2. **Hero particle field** (`js/background.js`, `#hero-canvas`) — denser polyhedra in the hero section only, mouse-reactive camera parallax. Full framerate.
3. **Name particle animation** (`js/name-animation.js`, `#name-canvas`) — the hero name rendered as a field of 2D canvas particles that sway in a simulated wind and scatter on mouse hover. Click copies the name to clipboard.
4. **Scroll fade-in** (`js/fade-in.js`) — IntersectionObserver reveals cards and sections as they enter viewport.

Design intent: the animations should feel like a living environment, not a loading screen or gimmick. They reinforce the technical identity without dominating the content.

### Interaction patterns

- Cards shift right (`translateX(4px)`) with a green left-border accent on hover — directional, intentional, not just a color change.
- Contact cards lift up (`translateY(-3px)`) on hover — signals "clickable destination."
- All transitions at `0.2s` — fast enough to feel snappy, not so fast they feel cheap.
- `prefers-reduced-motion` respected: all animations disabled.

---

## Chatbot (RAG AI assistant)

The site includes an "Ask me anything about Jacob" chat widget, powered by a full RAG pipeline:

### Architecture

```
User message
  → Pages Function (/api/chat)
    → Workers AI embedding (@cf/baai/bge-base-en-v1.5)
    → Vectorize query (top-5 semantic matches)
    → Build prompt: system persona + guardrails + retrieved context
    → Anthropic Claude API (claude-haiku-4-5, streaming)
  → SSE stream to browser
  → Token-by-token render in chat widget
```

### Knowledge base

The `knowledge/` directory contains markdown files about Jacob. Any `.md` file added here is automatically ingested into the vector database on the next push. The ingestion pipeline:

1. Parses markdown into chunks (split on H1/H2 headings, max ~1600 chars per chunk with paragraph overlap)
2. Embeds each chunk via Workers AI
3. Upserts to Cloudflare Vectorize with metadata: `{source, heading, text}`

**To update the chatbot's knowledge:** edit or add files in `knowledge/`, commit, and push. The `ingest.yml` GitHub Actions workflow runs automatically and the chatbot reflects changes within minutes.

### Cloudflare resources

| Resource | Name | Purpose |
|---|---|---|
| Pages project | `jacobspreitzer-dev` | Hosts the site + Functions |
| Vectorize index | `jacobspreitzer-knowledge` | Vector storage (768d, cosine) |
| Workers AI binding | `AI` | Generates embeddings |
| Pages secret | `ANTHROPIC_API_KEY` | Claude API access |

### GitHub Actions secrets required

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Deploy (Pages:Edit) + Ingest (AI:Read, Vectorize:Edit) |
| `CLOUDFLARE_ACCOUNT_ID` | `1d5aae43ba2cc8bc0817e5032247c734` |
| `ANTHROPIC_API_KEY` | Set as a Pages secret via wrangler, not GitHub |

---

## Deployment

Every push to `master` auto-deploys via GitHub Actions → `wrangler pages deploy` → Cloudflare Pages → live at `jacobspreitzer.dev` within ~30 seconds.

Every push that changes files in `knowledge/**` additionally triggers the ingestion workflow to re-index the knowledge base.
