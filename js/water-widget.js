(function () {
  // Estimation basis:
  //   Llama 3.1 8B: ~0.3–0.5 Wh per complete inference (embedding + Vectorize + LLM)
  //   Data center WUE: ~1.8 L/kWh (industry average, incl. evaporative cooling towers)
  //   => 0.0005 kWh × 1800 mL/kWh = 0.9 mL; padded to 1.5 mL for full pipeline overhead
  //   Source: Li et al. (2023) "Making AI Less 'Thirsty'" + Patterson et al. (2022)
  const ML_PAGE_LOAD = 0.2;
  const ML_PER_QUERY = 1.5;

  let pageMl  = 0;
  let queryMl = 0;
  let queries = 0;
  let displayMl = 0;
  let animRaf   = null;

  const widget      = document.getElementById('water-widget');
  const compactAmt  = document.getElementById('water-compact-amount');
  const totalAmt    = document.getElementById('water-total-amount');
  const breakdown   = document.getElementById('water-breakdown');

  function fmt(ml) {
    return ml < 10 ? ml.toFixed(1) : Math.round(ml).toString();
  }

  function renderBreakdown() {
    breakdown.innerHTML =
      '<div class="water-row"><span>Page load</span><span>' + fmt(pageMl) + ' mL</span></div>' +
      '<div class="water-row"><span>Chat (' + queries + ' ' + (queries === 1 ? 'query' : 'queries') + ')</span><span>' + fmt(queryMl) + ' mL</span></div>';
  }

  function setDisplay(ml) {
    const s = fmt(ml);
    compactAmt.textContent = s;
    totalAmt.textContent   = s;
    renderBreakdown();
  }

  function animateTo(target) {
    if (animRaf) cancelAnimationFrame(animRaf);
    const from     = displayMl;
    const duration = 900;
    const t0       = performance.now();

    function tick(now) {
      const p = Math.min((now - t0) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      displayMl = from + (target - from) * e;
      setDisplay(displayMl);
      if (p < 1) { animRaf = requestAnimationFrame(tick); }
      else { displayMl = target; setDisplay(target); animRaf = null; }
    }
    animRaf = requestAnimationFrame(tick);
  }

  function addWater(ml, type) {
    if (type === 'page') pageMl  += ml;
    else                 queryMl += ml;
    animateTo(pageMl + queryMl);
    widget.classList.add('water-pulse');
    setTimeout(() => widget.classList.remove('water-pulse'), 500);
  }

  setTimeout(() => addWater(ML_PAGE_LOAD, 'page'), 1200);

  document.addEventListener('aiInference', () => {
    queries++;
    addWater(ML_PER_QUERY, 'query');
  });

  widget.addEventListener('click', (e) => {
    e.stopPropagation();
    widget.classList.toggle('water-open');
  });

  document.addEventListener('click', () => {
    widget.classList.remove('water-open');
  });
})();
