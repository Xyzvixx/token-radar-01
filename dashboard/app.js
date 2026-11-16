// Token Radar dashboard: board, detail view per protocol, filters, live view.
// Static page, no network: every figure comes from window.RADAR (data.js).
// Farm plans are rebuilt here from the same inputs the model used (category,
// chains, TVL, age), so the plan a detail view shows is the board's own plan.
(function () {
  'use strict';
  var D = window.RADAR;
  var app = document.getElementById('app');
  if (!D || !D.rows) { app.innerHTML = '<p class="empty">No radar data loaded.</p>'; return; }
  var M = D.model;
  var DAY = 86400000;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
    return '$' + n;
  }
  function ageOf(row) {
    if (!row.a) return null;
    var d = Math.floor((Date.parse(D.as_of + 'T00:00:00Z') - Date.parse(row.a + 'T00:00:00Z')) / DAY);
    return isFinite(d) ? Math.max(0, d) : null;
  }
  function growthOf(row) {
    var g = row.g == null ? 0 : row.g;
    return Math.min(M.growth_cap, Math.max(M.growth_floor, g));
  }
  function mults(row) {
    var age = ageOf(row);
    var ageM = age == null ? M.unknown_age_days : age;
    var gm = 1 + (growthOf(row) / 100) * M.growth_weight;
    var mm = M.maturity_floor + (Math.min(Math.max(ageM, 0), M.maturity_days) / M.maturity_days) * M.maturity_range;
    return { age: age, gm: gm, mm: mm };
  }
  function chainOf(row) { return row.ch.length ? row.ch[0] : 'its main chain'; }
  function capitalOf(row) {
    if (row.t >= 5e9) return 250;
    if (row.t >= 1e9) return 150;
    if (row.t >= 1e8) return 100;
    return 50;
  }
  function holdOf(age) { if (age == null) return 45; if (age < 180) return 60; if (age < 365) return 45; return 30; }
  function actionOf(row, capital, chain) {
    var c = (row.c || '').toLowerCase(), n = row.n;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0)
      return 'Supply $' + capital + ' of USDC to ' + n + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('farm') >= 0)
      return 'Provide $' + capital + ' of liquidity to ' + n + '\'s main pool on ' + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0)
      return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + n + ' and use the bridged funds in its app.';
    if (c.indexOf('stak') >= 0 || c.indexOf('restak') >= 0)
      return 'Stake $' + capital + ' of the chain\'s staking asset through ' + n + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0)
      return 'Deposit $' + capital + ' of USDC as margin on ' + n + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + n + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('vault') >= 0)
      return 'Deposit $' + capital + ' into a ' + n + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + n + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of the protocol\'s yield asset on ' + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + n + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('basis') >= 0) return 'Deposit $' + capital + ' of USDC into ' + n + '\'s basis vault on ' + chain + ' and hold the position.';
    return 'Deposit $' + capital + ' of USDC into ' + n + ' on ' + chain + ' and keep the position open.';
  }
  // The farm plan: six steps, each action + cost + time. Same derivation as the model.
  function farmSteps(row) {
    var chain = chainOf(row), capital = capitalOf(row), hold = holdOf(ageOf(row)), gas = capital >= 150 ? 8 : 4;
    var steps = [
      ['Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', 'under $3 of gas for the first transaction', '5 minutes'],
      [actionOf(row, capital, chain), '$' + capital + ' of capital and about $' + gas + ' of gas', '15 minutes to set up'],
      ['Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', 'about $2 of gas a week', '10 minutes a week'],
      ['Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', 'the $' + capital + ' stays in the position', hold + ' days'],
      ['Before you withdraw, open the protocol\'s own points or rewards page and claim only from the link it publishes.', 'no fee to check, and never pay to claim', '10 minutes'],
      ['Write the wallet, the dates and every transaction hash in a farm log so you can repeat the position or unwind it.', 'nothing but the log', '5 minutes']
    ];
    return steps.map(function (s) { return { text: s[0], cost: s[1], time: s[2] }; });
  }

  var state = { q: '', cat: '', chain: '', wl: false, sort: 'value', live: false };
  var cats = [], chains = [];
  D.rows.forEach(function (r) {
    if (r.c && cats.indexOf(r.c) < 0) cats.push(r.c);
    r.ch.forEach(function (ch) { if (chains.indexOf(ch) < 0) chains.push(ch); });
  });
  cats.sort(); chains.sort();

  function header() {
    return '<div class="stats">' +
      '<div class="stat"><b>' + D.board_size + '</b><span>protocols ranked</span></div>' +
      '<div class="stat"><b>' + D.watchlist_size + '</b><span>watchlist covered</span></div>' +
      '<div class="stat"><b>' + D.early_size + '</b><span>early finds below the floor</span></div>' +
      '<div class="stat"><b>' + D.live_size + '</b><span>live tokens set aside</span></div>' +
      '<div class="stat"><b>' + D.global_multiple.toFixed(2) + '×</b><span>global comparable</span></div></div>' +
      '<p class="model"><b>Model ' + esc(D.model_version) + ':</b> implied value = TVL × comparable multiple ' +
      '(median market-cap/TVL of live tokens in the same category, global ' + D.global_multiple.toFixed(2) +
      '× when fewer than 3) × growth × maturity. ' +
      'Snapshot ' + esc(D.as_of) + ' · floor ' + money(D.floor_usd) + '. ' +
      '“Records no token” is what the snapshot says — never a claim a protocol has none. ' +
      'An implied value is this entry’s own claim, never make.fun’s.</p>';
  }
  function footer() {
    return '<footer>Source: ' + esc(D.source) + '. The board covers every protocol on the snapshot’s watchlist ' +
      'plus the clean pre-token protocols below its floor; wrapped, staked, bridged and exchange products are ' +
      'excluded from the ranking because their token already trades. Built for make.fun’s token-radar bounty.</footer>';
  }
  function controls() {
    var opts = '<option value="">All categories</option>' + cats.map(function (c) {
      return '<option value="' + esc(c) + '"' + (state.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
    var chopts = '<option value="">All chains</option>' + chains.map(function (c) {
      return '<option value="' + esc(c) + '"' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
    return '<div class="tabs" role="group" aria-label="Views">' +
      '<button type="button" data-view="board" aria-pressed="' + (!state.live) + '">Ranked board</button>' +
      '<button type="button" data-view="live" aria-pressed="' + state.live + '">Live tokens (' + D.live_size + ')</button></div>' +
      '<div class="controls"><input type="search" id="q" placeholder="Search name or slug…" value="' + esc(state.q) + '" aria-label="Search">' +
      '<select id="cat" aria-label="Category">' + opts + '</select>' +
      '<select id="chain" aria-label="Chain">' + chopts + '</select>' +
      '<label><input type="checkbox" id="wl"' + (state.wl ? ' checked' : '') + '> Watchlist only</label>' +
      '<select id="sort" aria-label="Sort"><option value="value"' + (state.sort === 'value' ? ' selected' : '') + '>Sort: implied value</option>' +
      '<option value="tvl"' + (state.sort === 'tvl' ? ' selected' : '') + '>Sort: TVL</option>' +
      '<option value="growth"' + (state.sort === 'growth' ? ' selected' : '') + '>Sort: 7-day growth</option>' +
      '<option value="age"' + (state.sort === 'age' ? ' selected' : '') + '>Sort: age</option></select></div>';
  }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    var rows = D.rows.filter(function (r) {
      if (state.wl && !r.w) return false;
      if (state.cat && r.c !== state.cat) return false;
      if (state.chain && r.ch.indexOf(state.chain) < 0) return false;
      if (q && r.n.toLowerCase().indexOf(q) < 0 && r.s.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    if (state.sort === 'tvl') rows.sort(function (a, b) { return b.t - a.t || a.s.localeCompare(b.s); });
    else if (state.sort === 'growth') rows.sort(function (a, b) { return (b.g == null ? -1e9 : b.g) - (a.g == null ? -1e9 : a.g) || a.s.localeCompare(b.s); });
    else if (state.sort === 'age') rows.sort(function (a, b) { return (ageOf(b) == null ? -1 : ageOf(b)) - (ageOf(a) == null ? -1 : ageOf(a)) || a.s.localeCompare(b.s); });
    else rows.sort(function (a, b) { return a.r - b.r; });
    return rows;
  }
  function growthCell(r) {
    if (r.g == null) return '<span class="flat">—</span>';
    var cls = r.g > 0 ? 'up' : r.g < 0 ? 'down' : 'flat';
    return '<span class="' + cls + '">' + (r.g > 0 ? '+' : '') + r.g.toFixed(1) + '%</span>';
  }
  function boardView() {
    var rows = filtered();
    var html = header() + controls();
    html += '<p class="count">Showing <b>' + rows.length + '</b> of ' + D.board_size + ' ranked protocols' +
      (state.wl ? ' · watchlist only' : '') + (state.cat ? ' · ' + esc(state.cat) : '') + '.</p>';
    if (!rows.length) { app.innerHTML = html + '<p class="empty">Nothing matches these filters.</p>' + footer(); return; }
    html += '<table><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th>Chains</th><th class="num">TVL</th><th class="num">7d</th><th class="num">Age</th><th class="num">Implied value</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var age = ageOf(r);
      html += '<tr data-slug="' + esc(r.s) + '" tabindex="0"><td class="rank' + (r.r <= 3 ? ' top3' : '') + '">' + r.r + '</td>' +
        '<td><span class="name">' + esc(r.n) + (r.w ? '<span class="wl">WATCHLIST</span>' : '') + '</span><small>' + esc(r.s) + '</small></td>' +
        '<td>' + esc(r.c || 'Uncategorised') + '</td><td>' + esc(r.ch.join(', ') || '—') + '</td>' +
        '<td class="num">' + money(r.t) + '</td><td class="num">' + growthCell(r) + '</td>' +
        '<td class="num">' + (age == null ? 'unknown' : age + 'd') + '</td>' +
        '<td class="num"><b>' + money(r.v) + '</b></td></tr>';
    });
    html += '</tbody></table>' + footer();
    app.innerHTML = html;
    app.setAttribute('aria-busy', 'false');
  }
  function liveView() {
    var html = header() + controls() +
      '<p class="count">Live tokens are <b>not ranked</b>: their token already trades, so the market’s own value is shown. ' +
      'They are the comparables the model prices the pre-token board against.</p>' +
      '<table><thead><tr><th>Protocol</th><th>Category</th><th>Chains</th><th class="num">TVL</th><th class="num">7d</th><th class="num">Market cap</th></tr></thead><tbody>';
    D.live.forEach(function (r) {
      html += '<tr><td><span class="name">' + esc(r.name) + '</span><small>' + esc(r.slug) + '</small></td>' +
        '<td>' + esc(r.category || 'Uncategorised') + '</td><td>' + esc(r.chains.join(', ') || '—') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + growthCell({ g: r.change_7d }) + '</td>' +
        '<td class="num"><b>' + money(r.mcap_usd) + '</b></td></tr>';
    });
    html += '</tbody></table>' + footer();
    app.innerHTML = html;
    app.setAttribute('aria-busy', 'false');
  }
  function detailView(slug) {
    var row = null;
    D.rows.forEach(function (r) { if (r.s === slug) row = r; });
    if (!row) { app.innerHTML = header() + '<p class="empty">No protocol “' + esc(slug) + '” on this board.</p><p><a href="#">← Back to the board</a></p>' + footer(); return; }
    var mm = mults(row), age = mm.age;
    var base = row.t * row.m;
    var src = row.u >= M.min_comparables
      ? 'category median over ' + row.u + ' live ' + (row.c || 'Uncategorised') + ' tokens'
      : 'global median (' + row.u + ' live ' + (row.c || 'Uncategorised') + ' token' + (row.u === 1 ? '' : 's') + ' — too few to trust alone)';
    var steps = farmSteps(row);
    var html = '<p><a class="back" href="#">← Back to the board</a></p><article class="detail">' +
      '<h1>#' + row.r + ' ' + esc(row.n) + ' <small>' + esc(row.s) + (row.w ? ' · on the watchlist' : '') + '</small></h1>' +
      '<p class="sub">' + esc(row.c || 'Uncategorised') + ' · ' + esc(row.ch.join(', ') || '—') + ' · records no token</p>' +
      '<div class="kv">' +
      '<div><b>' + money(row.v) + '</b><span>implied value</span></div>' +
      '<div><b>' + money(row.t) + '</b><span>TVL</span></div>' +
      '<div><b>' + (row.g == null ? '—' : (row.g > 0 ? '+' : '') + row.g.toFixed(1) + '%') + '</b><span>TVL change, 7 days</span></div>' +
      '<div><b>' + (age == null ? 'unknown' : age + ' days') + '</b><span>tracked since ' + esc(row.a || 'unknown') + '</span></div>' +
      '<div><b>' + row.m.toFixed(2) + '×</b><span>comparable multiple</span></div></div>' +
      '<h2>How the value is built</h2><ul class="breakdown">' +
      '<li>Base: TVL ' + money(row.t) + ' × comparable ' + row.m.toFixed(2) + '× = <code>' + money(Math.round(base)) + '</code></li>' +
      '<li>Growth: 7-day change ' + (row.g == null ? 'unreported (0%)' : row.g.toFixed(2) + '%') + ' → multiplier <code>' + mm.gm.toFixed(4) + '</code></li>' +
      '<li>Maturity: ' + (age == null ? 'age unknown, assumed ' + M.unknown_age_days + ' days' : age + ' days tracked') + ' → multiplier <code>' + mm.mm.toFixed(4) + '</code></li>' +
      '<li>Implied value: <code>' + money(row.v) + '</code> — the entry’s own claim, not a prediction of a launch.</li></ul>' +
      '<p class="note">Comparable: ' + esc(src) + '. The multiple is clamped to ' + M.multiple_floor + '–' + M.multiple_cap + '×.</p>' +
      '<h2>Farm plan — six steps</h2><ol class="steps">' +
      steps.map(function (s) {
        return '<li>' + esc(s.text) + '<div class="meta">Cost: <b>' + esc(s.cost) + '</b> · Time: <b>' + esc(s.time) + '</b></div></li>';
      }).join('') + '</ol>' +
      '<p class="note">Never pay to claim an airdrop, and never connect a wallet to a link that is not the protocol’s own page. ' +
      'A protocol that records no token may still have one its record does not carry.</p></article>' + footer();
    app.innerHTML = html;
    app.setAttribute('aria-busy', 'false');
  }
  function route() {
    var h = location.hash || '';
    if (h === '#/live') { state.live = true; liveView(); }
    else if (h.indexOf('#/') === 0 && h.length > 2) { state.live = false; detailView(decodeURIComponent(h.slice(2))); }
    else { state.live = false; boardView(); }
    window.scrollTo(0, 0);
  }
  app.addEventListener('click', function (e) {
    var tab = e.target.closest ? e.target.closest('[data-view]') : null;
    if (tab) { location.hash = tab.getAttribute('data-view') === 'live' ? '#/live' : '#'; return; }
    var tr = e.target.closest ? e.target.closest('tr[data-slug]') : null;
    if (tr) location.hash = '#/' + encodeURIComponent(tr.getAttribute('data-slug'));
  });
  app.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var tr = e.target.closest ? e.target.closest('tr[data-slug]') : null;
    if (tr) location.hash = '#/' + encodeURIComponent(tr.getAttribute('data-slug'));
  });
  app.addEventListener('input', function (e) {
    if (e.target.id === 'q') { state.q = e.target.value; var pos = e.target.selectionStart; boardView(); var q = document.getElementById('q'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } }
  });
  app.addEventListener('change', function (e) {
    if (e.target.id === 'cat') { state.cat = e.target.value; boardView(); }
    if (e.target.id === 'chain') { state.chain = e.target.value; boardView(); }
    if (e.target.id === 'wl') { state.wl = e.target.checked; boardView(); }
    if (e.target.id === 'sort') { state.sort = e.target.value; boardView(); }
  });
  window.addEventListener('hashchange', route);
  route();
})();
