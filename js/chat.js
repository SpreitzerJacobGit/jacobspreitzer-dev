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
})();
