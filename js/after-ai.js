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
      // Convert ==phrase== markers into numbered physics-word spans
      var n = 0;
      html = html.replace(/==([\s\S]*?)==/g, function (_, text) {
        n++;
        return '<span class="physics-word physics-word--' + n + '">' + text + '</span>';
      });
      container.innerHTML = html;
      document.dispatchEvent(new CustomEvent('afterai-rendered'));
    })
    .catch(function () {
      container.innerHTML = '<p class="md-loading">Content unavailable.</p>';
    });
})();
