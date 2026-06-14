(function () {
  const toggle  = document.getElementById('chat-toggle');
  const panel   = document.getElementById('chat-panel');
  const messages = document.getElementById('chat-messages');
  const input   = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const ticker  = document.getElementById('fun-facts-ticker');
  const tickerText = document.getElementById('fun-facts-text');

  const FACTS = [
    "Likes 30–90 mile bike rides on road and gravel",
    "Brews tea the long way — gongfu style, every time",
    "Serves with a Stiga Legacy Carbon blade",
    "Switches between pickleball and table tennis depending on the day",
    "Has an opinion on every pu’erh tea he’s ever tried",
    "Thinks in systems, even outside of work",
    "Prefers split ergo keyboards with lots of layers",
    "Certified Sage X3 Developer",
    "Minored in both Math and Big Data",
    "Heavy Claude power user",
  ];

  let factIndex = Math.floor(Math.random() * FACTS.length);
  let factTimer = null;

  function showFact(text) {
    tickerText.textContent = text;
    ticker.classList.remove('fading');
    ticker.classList.add('visible');
  }

  function rotateFact() {
    ticker.classList.add('fading');
    ticker.classList.remove('visible');
    setTimeout(() => {
      factIndex = (factIndex + 1) % FACTS.length;
      showFact(FACTS[factIndex]);
    }, 520);
  }

  function startTicker() {
    if (factTimer) return;
    showFact(FACTS[factIndex]);
    factTimer = setInterval(rotateFact, 5000);
  }

  function stopTicker() {
    ticker.classList.remove('visible');
    ticker.classList.add('fading');
    clearInterval(factTimer);
    factTimer = null;
  }

  setTimeout(startTicker, 1200);

  let isStreaming = false;

  // ── Open / close ──────────────────────────────────────────────────────────
  toggle.addEventListener('click', () => {
    const opening = !panel.classList.contains('open');
    toggle.classList.toggle('open');
    panel.classList.toggle('open');
    if (opening) {
      stopTicker();
      input.focus();
      scrollToBottom();
    } else {
      setTimeout(startTicker, 400);
    }
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('open')) {
      toggle.classList.remove('open');
      panel.classList.remove('open');
    }
  });

  // ── Suggested prompt chips ────────────────────────────────────────────────
  document.querySelectorAll('.chat-suggestion').forEach(btn => {
    btn.addEventListener('click', () => {
      if (isStreaming) return;
      input.value = btn.textContent;
      sendMessage();
    });
  });

  // ── Send controls ─────────────────────────────────────────────────────────
  sendBtn.addEventListener('click', sendMessage);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-grow textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 96) + 'px';
  });

  // ── Core send / stream ────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.value.trim();
    if (!text || isStreaming) return;

    // Hide suggestions after first message
    const suggestions = document.querySelector('.chat-suggestions');
    if (suggestions) suggestions.style.display = 'none';

    appendMessage(text, 'user');
    input.value = '';
    input.style.height = 'auto';
    setStreaming(true);

    const thinking = appendThinking();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      thinking.remove();

      if (!res.ok) {
        appendMessage('Something went wrong. Please try again.', 'assistant');
        return;
      }

      await streamResponse(res);
    } catch (err) {
      thinking.remove();
      appendMessage('Connection error. Please try again.', 'assistant');
    } finally {
      setStreaming(false);
    }
  }

  async function streamResponse(res) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const bubble = appendMessage('', 'assistant');
    bubble.classList.add('streaming');

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;

        let event;
        try { event = JSON.parse(raw); } catch { continue; }

        // Workers AI SSE: { response: "token" }
        if (event.response) {
          bubble.textContent += event.response;
          scrollToBottom();
        }
      }
    }

    bubble.classList.remove('streaming');
    scrollToBottom();
    document.dispatchEvent(new CustomEvent('aiInference'));
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────
  function appendMessage(text, role) {
    const el = document.createElement('div');
    el.className = `chat-msg chat-msg-${role}`;
    el.textContent = text;
    messages.appendChild(el);
    scrollToBottom();
    return el;
  }

  function appendThinking() {
    const el = document.createElement('div');
    el.className = 'chat-thinking';
    el.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(el);
    scrollToBottom();
    return el;
  }

  function setStreaming(val) {
    isStreaming = val;
    input.disabled = val;
    sendBtn.disabled = val;
  }

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  // ── Drag and resize ───────────────────────────────────────────────────────
  (function () {
    const header  = panel.querySelector('.chat-header');
    const MIN_W   = 300;
    const MIN_H   = 300;
    const CURSORS = {
      n: 'ns-resize',   s: 'ns-resize',
      e: 'ew-resize',   w: 'ew-resize',
      nw: 'nwse-resize', ne: 'nesw-resize',
      sw: 'nesw-resize', se: 'nwse-resize',
    };
    let pinned = true;
    let drag = null, resize = null;

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    function pin2free() {
      if (!pinned) return;
      pinned = false;
      const r = panel.getBoundingClientRect();
      panel.style.bottom = 'auto';
      panel.style.right  = 'auto';
      panel.style.left   = r.left   + 'px';
      panel.style.top    = r.top    + 'px';
      panel.style.width  = r.width  + 'px';
      panel.style.height = r.height + 'px';
    }

    // Drag via header
    header.addEventListener('mousedown', e => {
      if (e.button !== 0 || e.target.closest('button, .chat-resize')) return;
      e.preventDefault();
      pin2free();
      drag = {
        x0: e.clientX, y0: e.clientY,
        l0: parseFloat(panel.style.left),
        t0: parseFloat(panel.style.top),
      };
      document.body.style.cursor = 'move';
    });

    // Resize via edge/corner handles injected into the panel
    ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].forEach(dir => {
      const el = document.createElement('div');
      el.className = `chat-resize chat-resize-${dir}`;
      panel.appendChild(el);
      el.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        pin2free();
        const r = panel.getBoundingClientRect();
        resize = {
          dir,
          x0: e.clientX, y0: e.clientY,
          l0: r.left, t0: r.top, w0: r.width, h0: r.height,
        };
        document.body.style.cursor = CURSORS[dir];
      });
    });

    document.addEventListener('mousemove', e => {
      if (drag) {
        const dx = e.clientX - drag.x0;
        const dy = e.clientY - drag.y0;
        panel.style.left = clamp(drag.l0 + dx, 0, window.innerWidth  - panel.offsetWidth) + 'px';
        panel.style.top  = clamp(drag.t0 + dy, 0, window.innerHeight - 60) + 'px';
      }

      if (resize) {
        const { dir, x0, y0, l0, t0, w0, h0 } = resize;
        const dx = e.clientX - x0;
        const dy = e.clientY - y0;
        let L = l0, T = t0, W = w0, H = h0;

        if (dir.includes('e')) W = w0 + dx;
        if (dir.includes('s')) H = h0 + dy;
        if (dir.includes('w')) W = w0 - dx;
        if (dir.includes('n')) H = h0 - dy;

        W = clamp(W, MIN_W, window.innerWidth  - 16);
        H = clamp(H, MIN_H, window.innerHeight - 16);

        // Re-anchor left/top for w/n directions after clamping
        if (dir.includes('w')) L = l0 + w0 - W;
        if (dir.includes('n')) T = t0 + h0 - H;

        L = clamp(L, 0, window.innerWidth  - W);
        T = clamp(T, 0, window.innerHeight - H);

        panel.style.left   = L + 'px';
        panel.style.top    = T + 'px';
        panel.style.width  = W + 'px';
        panel.style.height = H + 'px';
      }
    });

    const endInteraction = () => {
      drag = null;
      resize = null;
      document.body.style.cursor = '';
    };
    document.addEventListener('mouseup',    endInteraction);
    document.addEventListener('mouseleave', endInteraction);
  })();
})();
