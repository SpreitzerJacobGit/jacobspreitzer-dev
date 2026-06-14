(function () {
  var container = document.getElementById('after-ai-content');
  if (!container) return;

  fetch('/content/after-ai.md')
    .then(function (r) {
      if (!r.ok) throw new Error('fetch failed');
      return r.text();
    })
    .then(function (md) {
      var html = marked.parse(md);
      // Convert ==phrase== markers into physics-animated spans
      html = html.replace(/==([\s\S]*?)==/g, '<span class="physics-word">$1</span>');
      container.innerHTML = html;
      document.dispatchEvent(new CustomEvent('afterai-rendered'));
    })
    .catch(function () {
      container.innerHTML = '<p class="md-loading">Content unavailable.</p>';
    });
})();
