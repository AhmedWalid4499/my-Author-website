/* =============================================================
   Which Pastry Are You?  ·  aoi-shiori.html

   Data is inlined by tools/render.mjs from tools/quiz.json, so nothing is
   fetched and the quiz cannot half-load. Without JavaScript the intro panel
   still reads and the playlist below is fully server-rendered.
   ============================================================= */
(function () {
  'use strict';

  var root = document.querySelector('[data-quiz]');
  var dataEl = document.getElementById('quiz-data');
  if (!root || !dataEl) return;

  var DATA;
  try { DATA = JSON.parse(dataEl.textContent); } catch (e) { return; }

  var KEYS = Object.keys(DATA.results);
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var panels = {
    intro: root.querySelector('[data-quiz-intro]'),
    play: root.querySelector('[data-quiz-play]'),
    result: root.querySelector('[data-quiz-result]')
  };
  var el = {
    subtitle: root.querySelector('[data-quiz-subtitle]'),
    row: root.querySelector('[data-dessert-row]'),
    dots: root.querySelector('[data-quiz-dots]'),
    count: root.querySelector('[data-quiz-count]'),
    question: root.querySelector('[data-quiz-question]'),
    answers: root.querySelector('[data-quiz-answers]'),
    back: root.querySelector('[data-quiz-back]'),
    status: root.querySelector('[data-result-status]')
  };

  /* ---- state ---- */
  var step = 0;          // which question we are on
  var picks = [];        // picks[i] = result key chosen for question i

  function show(name) {
    Object.keys(panels).forEach(function (k) {
      if (panels[k]) panels[k].hidden = (k !== name);
    });
  }

  function img(result, width) {
    return result.image + '-' + width + '.webp';
  }

  /* ---- intro ---- */
  el.subtitle.textContent = DATA.subtitle;

  KEYS.forEach(function (key) {
    var li = document.createElement('li');
    var i = document.createElement('img');
    i.src = img(DATA.results[key], 320);
    i.alt = '';
    i.width = 320;
    i.height = 320;
    i.loading = 'lazy';
    i.decoding = 'async';
    li.appendChild(i);
    el.row.appendChild(li);
  });

  // One dot per question.
  DATA.questions.forEach(function () {
    el.dots.appendChild(document.createElement('li'));
  });

  /* ---- shuffling ----
     Answer order is shuffled per question so the result is not readable from
     position. Fisher-Yates on a copy; the original data is never mutated. */
  function shuffled(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---- questions ---- */
  function renderQuestion() {
    var q = DATA.questions[step];
    el.question.textContent = q.q;
    el.count.textContent = (step + 1) + ' / ' + DATA.questions.length;

    [].forEach.call(el.dots.children, function (dot, i) {
      dot.removeAttribute('data-done');
      dot.removeAttribute('data-current');
      if (i < step) dot.setAttribute('data-done', '');
      if (i === step) dot.setAttribute('data-current', '');
    });

    el.answers.textContent = '';
    shuffled(q.answers).forEach(function (pair) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'answer';
      b.textContent = pair[0];
      b.addEventListener('click', function () { choose(pair[1]); });
      li.appendChild(b);
      el.answers.appendChild(li);
    });

    el.back.hidden = (step === 0);
    var first = el.answers.querySelector('.answer');
    if (first && step > 0) first.focus();
  }

  function choose(key) {
    picks[step] = key;
    if (step < DATA.questions.length - 1) {
      step++;
      renderQuestion();
    } else {
      finish();
    }
  }

  el.back.addEventListener('click', function () {
    if (step === 0) return;
    step--;
    picks.length = step;
    renderQuestion();
  });

  /* ---- scoring ----
     One point per answer; highest total wins. On a tie, the pastry chosen in
     the latest question among the tied ones wins — exactly the rule in
     quiz.json, including the tie-break, which a plain max() would get wrong. */
  function score() {
    var totals = {};
    picks.forEach(function (k) { totals[k] = (totals[k] || 0) + 1; });

    var best = -1;
    Object.keys(totals).forEach(function (k) { if (totals[k] > best) best = totals[k]; });

    var tied = Object.keys(totals).filter(function (k) { return totals[k] === best; });
    if (tied.length === 1) return tied[0];

    for (var i = picks.length - 1; i >= 0; i--) {
      if (tied.indexOf(picks[i]) !== -1) return picks[i];
    }
    return tied[0];
  }

  /* ---- result ---- */
  var current = null;

  function showResult(key) {
    var r = DATA.results[key];
    if (!r) return;
    current = key;

    var art = root.querySelector('[data-result-art]');
    art.src = img(r, 640);
    art.alt = r.name;

    root.querySelector('[data-result-name]').textContent = r.name;
    root.querySelector('[data-result-nickname]').textContent = r.nickname;
    root.querySelector('[data-result-description]').textContent = r.description;
    root.querySelector('[data-result-bookmark]').textContent = r.bookmark;
    root.querySelector('[data-result-chapter]').textContent = r.chapter;
    el.status.textContent = '';

    show('result');

    // Deep-linkable, and back/forward moves between result and quiz.
    var url = new URL(window.location.href);
    url.searchParams.set('result', key);
    history.replaceState({ result: key }, '', url);

    if (!reduceMotion.matches) {
      panels.result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function finish() { showResult(score()); }

  /* ---- controls ---- */
  root.querySelector('[data-quiz-start]').addEventListener('click', function () {
    step = 0; picks = [];
    show('play');
    renderQuestion();
    el.answers.querySelector('.answer').focus();
  });

  root.querySelector('[data-result-retake]').addEventListener('click', function () {
    step = 0; picks = []; current = null;
    var url = new URL(window.location.href);
    url.searchParams.delete('result');
    history.replaceState({}, '', url);
    show('intro');
    root.querySelector('[data-quiz-start]').focus();
  });

  /* ---- share ---- */
  root.querySelector('[data-result-share]').addEventListener('click', function () {
    var r = DATA.results[current];
    if (!r) return;
    var text = DATA.shareText
      .replace('{name}', r.name)
      .replace('{nickname}', r.nickname);
    var url = window.location.href;

    if (navigator.share) {
      navigator.share({ title: DATA.title, text: text, url: url }).catch(function () {});
      return;
    }
    var payload = text + ' ' + url;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload).then(function () {
        el.status.textContent = 'Copied — paste it wherever you like.';
      }, function () {
        el.status.textContent = payload;
      });
    } else {
      el.status.textContent = payload;
    }
  });

  /* ---- downloadable card ----
     1080×1350 portrait, which is what Instagram wants. Drawn from the same
     assets the page uses, so it needs no network and does not taint the
     canvas. */
  root.querySelector('[data-result-save]').addEventListener('click', function () {
    var r = DATA.results[current];
    if (!r) return;
    el.status.textContent = 'Drawing your bookmark…';

    var W = 1080, H = 1350;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var x = c.getContext('2d');

    // Ground
    var bg = x.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fffdf8');
    bg.addColorStop(1, '#f6ecdd');
    x.fillStyle = bg;
    x.fillRect(0, 0, W, H);

    // Hairline frame
    x.strokeStyle = 'rgba(160, 92, 34, .34)';
    x.lineWidth = 2;
    x.strokeRect(40, 40, W - 80, H - 80);

    var art = new Image();
    art.onload = function () { draw(art); };
    art.onerror = function () { draw(null); };
    art.src = img(r, 640);

    function centred(text, font, fill, y, maxWidth, lineHeight) {
      x.font = font; x.fillStyle = fill; x.textAlign = 'center';
      var words = String(text).split(' ');
      var lines = [], line = '';
      for (var i = 0; i < words.length; i++) {
        var test = line ? line + ' ' + words[i] : words[i];
        if (x.measureText(test).width > maxWidth && line) { lines.push(line); line = words[i]; }
        else line = test;
      }
      if (line) lines.push(line);
      lines.forEach(function (l, i) { x.fillText(l, W / 2, y + i * lineHeight); });
      return y + lines.length * lineHeight;
    }

    function draw(image) {
      var y = 150;

      if (image) {
        var maxW = 440, maxH = 400;
        var s = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight);
        var w = image.naturalWidth * s, h = image.naturalHeight * s;
        x.drawImage(image, (W - w) / 2, y, w, h);
        y += h + 70;
      } else {
        y += 40;
      }

      x.font = '500 40px Georgia, serif';
      x.fillStyle = '#a83f0b';
      x.textAlign = 'center';
      x.fillText('YOU ARE', W / 2, y);
      y += 72;

      y = centred(r.name, '500 72px Georgia, serif', '#2c1f14', y, W - 220, 82) + 18;
      y = centred(r.nickname, 'italic 44px Georgia, serif', '#a83f0b', y, W - 220, 56) + 56;

      // The bookmark, in the book's blue
      var bmW = 760, bmX = (W - bmW) / 2, bmTop = y;
      x.font = 'italic 40px Georgia, serif';
      var words = String(r.bookmark).split(' ');
      var lines = [], line = '';
      for (var i = 0; i < words.length; i++) {
        var test = line ? line + ' ' + words[i] : words[i];
        if (x.measureText(test).width > bmW - 110 && line) { lines.push(line); line = words[i]; }
        else line = test;
      }
      if (line) lines.push(line);
      var bmH = lines.length * 56 + 150;

      var g = x.createLinearGradient(bmX, bmTop, bmX, bmTop + bmH);
      g.addColorStop(0, '#1b4677');
      g.addColorStop(1, '#24568f');
      x.fillStyle = g;
      x.fillRect(bmX, bmTop, bmW, bmH);

      // ribbon
      x.fillStyle = '#c8915a';
      x.beginPath();
      x.moveTo(W / 2 - 13, bmTop);
      x.lineTo(W / 2 + 13, bmTop);
      x.lineTo(W / 2 + 13, bmTop + 44);
      x.lineTo(W / 2, bmTop + 31);
      x.lineTo(W / 2 - 13, bmTop + 44);
      x.closePath();
      x.fill();

      x.fillStyle = '#f0cfa0';
      x.font = 'italic 40px Georgia, serif';
      lines.forEach(function (l, i) { x.fillText(l, W / 2, bmTop + 92 + i * 56); });

      x.strokeStyle = 'rgba(240, 207, 160, .3)';
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(bmX + 55, bmTop + bmH - 58);
      x.lineTo(bmX + bmW - 55, bmTop + bmH - 58);
      x.stroke();

      x.font = '24px Helvetica, Arial, sans-serif';
      x.fillStyle = 'rgba(240, 207, 160, .88)';
      x.fillText(String(r.chapter).toUpperCase(), W / 2, bmTop + bmH - 22);

      // Footer
      x.font = 'italic 38px Georgia, serif';
      x.fillStyle = '#5a4332';
      x.fillText('The Blue Bookmark Bookshop', W / 2, H - 132);
      x.font = '26px Helvetica, Arial, sans-serif';
      x.fillStyle = '#74594a';
      x.fillText('ahmedwalid4499.github.io/my-Author-website', W / 2, H - 86);

      c.toBlob(function (blob) {
        if (!blob) { el.status.textContent = 'Could not save the image on this browser.'; return; }
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'my-bookmark-' + current + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        el.status.textContent = 'Saved. Look in your downloads.';
      }, 'image/png');
    }
  });

  /* ---- deep link: ?result=eclair opens straight on that result ---- */
  var wanted = new URLSearchParams(window.location.search).get('result');
  if (wanted && DATA.results[wanted]) showResult(wanted);

  /* ---- click-to-load embed ---- */
  var embed = document.querySelector('[data-embed]');
  if (embed) {
    var load = embed.querySelector('[data-embed-load]');
    load.addEventListener('click', function () {
      var frame = document.createElement('iframe');
      frame.src = embed.getAttribute('data-embed-src');
      frame.title = embed.getAttribute('data-embed-title');
      frame.height = '420';
      frame.loading = 'lazy';
      frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      embed.textContent = '';
      embed.appendChild(frame);
    });
  }
})();
