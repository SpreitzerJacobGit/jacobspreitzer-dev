(function () {
  var container = document.getElementById('after-ai-content');
  if (!container) return;

  fetch('/content/after-ai.md')
    .then(function (r) {
      if (!r.ok) throw new Error('fetch failed');
      return r.text();
    })
    .then(function (md) {
      container.innerHTML = marked.parse(md);
    })
    .catch(function () {
      container.innerHTML = '<p class="md-loading">Content unavailable.</p>';
    });
})();
