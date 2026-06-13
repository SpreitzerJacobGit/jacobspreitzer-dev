(function () {
  const toggle = document.getElementById('chat-toggle');
  const panel  = document.getElementById('chat-panel');
  const messages = document.getElementById('chat-messages');
  const input  = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');

  const SUGGESTIONS = [
    "What does Jacob do for work?",
    "What tech does he specialize in?",
    "What are his hobbies?",
    "Is he available for freelance?",
  ];

  let isStreaming = false;

  // ── Open / close ──────────────────────────────────────────────────────────
  toggle.addEventListener('click', () => {
    const opening = !panel.classList.contains('open');
    toggle.classList.toggle('open');
    panel.classList.toggle('open');
    if (opening) {
      input.focus();
      scrollToBottom();
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
