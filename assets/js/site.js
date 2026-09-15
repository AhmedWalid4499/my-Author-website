/* ------------------------------------------------------------------
   Ahmed El-Bourgy — site behaviour
   Progressive enhancement only: every page is fully readable and
   navigable with this file blocked.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  /* --------------------------------------------------------------
     CONFIG — the one line to change when a mailing-list provider is
     set up. Paste the provider's form endpoint here (Buttondown,
     Mailchimp, ConvertKit, Formspree, Kit … all give you a POST URL).
     While it is empty the signup form falls back to opening a
     pre-addressed email instead, so it still works.
     -------------------------------------------------------------- */
  var NEWSLETTER_ENDPOINT = '';
  var CONTACT_EMAIL = 'ahmedwalid4499@gmail.com';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ============================================================
     Mobile navigation
     ============================================================ */
  function initNav() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;

    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.setAttribute('data-open', String(open));
    }

    function isOpen() {
      return toggle.getAttribute('aria-expanded') === 'true';
    }

    toggle.addEventListener('click', function () {
      setOpen(!isOpen());
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Tapping outside the panel closes it.
    document.addEventListener('click', function (e) {
      if (!isOpen()) return;
      if (nav.contains(e.target) || toggle.contains(e.target)) return;
      setOpen(false);
    });

    // Following a link inside the panel closes it.
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    // Leaving the mobile breakpoint must not strand the panel open.
    var mq = window.matchMedia('(min-width: 761px)');
    var onChange = function (e) { if (e.matches) setOpen(false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);

    setOpen(false);
  }

  /* ============================================================
     Scroll reveal
     ============================================================ */
  function initReveal() {
    var targets = document.querySelectorAll('.fade-in');
    if (!targets.length) return;

    function revealAll() {
      for (var i = 0; i < targets.length; i++) targets[i].classList.add('is-visible');
    }

    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      revealAll();
      return;
    }

    var fired = false;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        fired = true;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' });

    targets.forEach(function (el) { observer.observe(el); });

    // Safety net: if the observer never reports anything (rendered off-screen,
    // printed before scrolling, an odd embedding context) the page must not be
    // left as a wall of invisible sections.
    function armSafetyNet() {
      window.setTimeout(function () { if (!fired) revealAll(); }, 1500);
    }
    if (document.readyState === 'complete') armSafetyNet();
    else window.addEventListener('load', armSafetyNet);

    window.addEventListener('beforeprint', revealAll);
  }

  /* ============================================================
     Falling sakura petals
     Only while the hero is actually on screen, and never when the
     visitor has asked for reduced motion.
     ============================================================ */
  function initPetals() {
    var hero = document.querySelector('[data-petals]');
    if (!hero) return;

    var GLYPHS = ['✿', '❀', '✾', '❁', '✽'];
    var MAX_LIVE = 14;
    var timer = null;
    var live = 0;

    function spawn() {
      if (live >= MAX_LIVE || document.hidden) return;
      var petal = document.createElement('span');
      petal.className = 'petal';
      petal.setAttribute('aria-hidden', 'true');
      petal.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      petal.style.left = (Math.random() * 100) + '%';
      petal.style.fontSize = (0.7 + Math.random() * 0.8) + 'rem';
      petal.style.color = 'rgba(200,145,90,' + (0.16 + Math.random() * 0.2).toFixed(2) + ')';

      var duration = 7 + Math.random() * 7;
      petal.style.animationDuration = duration + 's';
      petal.style.animationDelay = (Math.random() * 1.5) + 's';

      hero.appendChild(petal);
      live++;
      window.setTimeout(function () {
        petal.remove();
        live--;
      }, (duration + 2) * 1000);
    }

    function start() {
      if (timer || reduceMotion.matches) return;
      timer = window.setInterval(spawn, 1300);
      for (var i = 0; i < 4; i++) window.setTimeout(spawn, i * 500);
    }

    function stop() {
      if (!timer) return;
      window.clearInterval(timer);
      timer = null;
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? start() : stop();
      }, { threshold: 0 }).observe(hero);
    } else {
      start();
    }

    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });

    var onMotionChange = function () { reduceMotion.matches ? stop() : start(); };
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onMotionChange);
    else if (reduceMotion.addListener) reduceMotion.addListener(onMotionChange);
  }

  /* ============================================================
     Newsletter signup
     ============================================================ */
  function initSubscribe() {
    var forms = document.querySelectorAll('[data-subscribe]');
    if (!forms.length) return;

    forms.forEach(function (form) {
      var status = form.querySelector('[data-status]');
      var button = form.querySelector('button[type="submit"]');
      var note = form.parentNode.querySelector('[data-fallback-note]');

      // With no provider wired up yet, say plainly what will happen.
      if (!NEWSLETTER_ENDPOINT && note) note.hidden = false;

      function say(message, state) {
        if (!status) return;
        status.textContent = message;
        status.setAttribute('data-state', state);
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Honeypot: a real person never fills this in.
        var trap = form.querySelector('[name="company"]');
        if (trap && trap.value) return;

        var emailField = form.querySelector('input[type="email"]');
        var email = emailField ? emailField.value.trim() : '';
        if (!email) { say('Please enter an email address.', 'err'); return; }

        if (!NEWSLETTER_ENDPOINT) {
          // Fallback: open a pre-addressed message the reader can send.
          var subject = encodeURIComponent('Reading list signup');
          var body = encodeURIComponent(
            'Hello Ahmed,\n\nPlease add me to your reading list.\n\nEmail: ' + email + '\n'
          );
          window.location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + subject + '&body=' + body;
          say('Opening your email app so you can send the request…', 'ok');
          return;
        }

        if (button) { button.disabled = true; }
        say('Sending…', '');

        fetch(NEWSLETTER_ENDPOINT, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form)
        })
          .then(function (res) {
            if (!res.ok) throw new Error('Request failed');
            form.reset();
            say('Thank you — please check your inbox to confirm.', 'ok');
          })
          .catch(function () {
            say('Something went wrong. Please email ' + CONTACT_EMAIL + ' instead.', 'err');
          })
          .finally(function () {
            if (button) button.disabled = false;
          });
      });
    });
  }

  /* ============================================================
     Copy-to-clipboard (press kit bios)
     ============================================================ */
  function initCopy() {
    var buttons = document.querySelectorAll('[data-copy]');
    if (!buttons.length) return;

    // Each button carries an aria-label naming the bio it copies, so swapping
    // its visible text would not be announced. Confirmations go to a live
    // region instead, which serves sighted and screen reader users alike.
    var live = document.createElement('p');
    live.className = 'visually-hidden';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    document.body.appendChild(live);

    buttons.forEach(function (button) {
      // Without clipboard support the button would do nothing — hide it.
      if (!navigator.clipboard) { button.hidden = true; return; }

      button.addEventListener('click', function () {
        var source = document.getElementById(button.getAttribute('data-copy'));
        if (!source) return;
        var label = button.textContent;

        function flash(text, announce, ms) {
          button.textContent = text;
          live.textContent = announce;
          window.setTimeout(function () {
            button.textContent = label;
            live.textContent = '';
          }, ms);
        }

        navigator.clipboard.writeText(source.innerText.trim()).then(
          function () { flash('Copied', 'Biography copied to the clipboard.', 1800); },
          function () { flash('Press ⌘C to copy', 'Copying failed — select the text and copy it manually.', 2400); }
        );
      });
    });
  }

  /* ============================================================
     Footer year
     ============================================================ */
  function initYear() {
    var slots = document.querySelectorAll('[data-year]');
    var year = String(new Date().getFullYear());
    slots.forEach(function (el) { el.textContent = year; });
  }

  function init() {
    initNav();
    initReveal();
    initPetals();
    initSubscribe();
    initCopy();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
