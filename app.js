/* aureon — page behaviour. No innerHTML, no eval, no third-party code: compatible with the
   strict Content-Security-Policy and Trusted Types enforcement set in vercel.json. */
'use strict';
document.documentElement.classList.add('js');

(() => {
  const MEDIA = [
    { src: '/assets/aureon-field-v2.webm', type: 'video/webm; codecs="av01.0.04M.08"' },
    { src: '/assets/aureon-field-v2.mp4', type: 'video/mp4' }
  ];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const conn = navigator.connection || {};
  const lightMode = () => conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || '');

  function attachSources(video) {
    if (video.dataset.loaded) return;
    for (const m of MEDIA) {
      const s = document.createElement('source');
      s.src = m.src; s.type = m.type;
      video.appendChild(s);
    }
    video.dataset.loaded = '1';
    video.load();
  }
  const play = v => { const p = v.play(); if (p) p.catch(() => {}); };

  function init() {
    const $ = s => document.querySelector(s);
    const film = $('#film'), pause = $('#pause'), authFilm = $('#auth-film');
    let userPaused = false;

    /* ---------- background film ---------- */
    function syncPause() {
      const paused = film.paused;
      pause.firstElementChild.textContent = paused ? '▷' : 'Ⅱ';
      pause.setAttribute('aria-label', paused ? 'play background video' : 'pause background video');
      pause.setAttribute('aria-pressed', String(paused));
    }
    if (!lightMode()) {
      attachSources(film);
      if (reducedMotion.matches) film.removeAttribute('autoplay'); else play(film);
    }
    pause.addEventListener('click', () => {
      if (!film.dataset.loaded) attachSources(film);
      if (film.paused) { userPaused = false; play(film); } else { userPaused = true; film.pause(); }
    });
    film.addEventListener('play', syncPause);
    film.addEventListener('pause', syncPause);
    syncPause();

    // stop decoding while the tab is hidden; resume only if the visitor had it playing
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { film.pause(); authFilm.pause(); }
      else if (!userPaused && !auth.open && film.dataset.loaded && !reducedMotion.matches) play(film);
    });
    reducedMotion.addEventListener('change', e => { if (e.matches) { film.pause(); authFilm.pause(); } });

    // media is decorative: no context menu / drag-to-save on video or images
    const guard = e => { if (e.target.closest('video, img')) e.preventDefault(); };
    document.addEventListener('contextmenu', guard);
    document.addEventListener('dragstart', guard);

    /* ---------- scroll reveal ---------- */
    const revealables = document.querySelectorAll('.reveal, .reveal-group');
    if ('IntersectionObserver' in window && !reducedMotion.matches) {
      const io = new IntersectionObserver(entries => {
        for (const e of entries) if (e.isIntersecting) { e.target.classList.remove('is-waiting'); io.unobserve(e.target); }
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      revealables.forEach(el => {
        if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('is-waiting'); io.observe(el); }
      });
    }

    /* ---------- intelligence notes ---------- */
    const read = $('#read'), notes = $('#philosophy');
    read.addEventListener('click', () => {
      const open = notes.hidden;
      notes.hidden = !open;
      read.setAttribute('aria-expanded', String(open));
      if (open && !reducedMotion.matches && notes.animate) {
        notes.animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
    });

    /* ---------- auth dialog ---------- */
    const auth = $('#auth'), openAuth = $('#open-auth'), tabsWrap = auth.querySelector('.auth-tabs');
    const tabs = [...auth.querySelectorAll('[role=tab]')];
    const form = $('#account-form'), status = $('#auth-status'), content = $('#auth-content');
    const nameInput = $('#account-name'), emailInput = $('#account-email'), password = $('#account-password');
    const toggle = $('#toggle-password');
    let mode = 0, filmWasPlaying = false, closing = false;

    const COPY = [
      { title: 'welcome to aureon.', desc: 'create your aureon account.', submit: 'create account', status: 'account registration is not available yet. authentication service setup is required.' },
      { title: 'welcome back.', desc: 'log in to your aureon account.', submit: 'log in', status: 'account login is not available yet. authentication service setup is required.' }
    ];

    function selectAuth(i, animate) {
      const changed = mode !== i; mode = i;
      tabsWrap.dataset.active = String(i);
      tabs.forEach((t, n) => { t.setAttribute('aria-selected', String(n === i)); t.tabIndex = n === i ? 0 : -1; });
      content.setAttribute('aria-labelledby', tabs[i].id);
      $('#auth-title').textContent = COPY[i].title;
      $('#auth-description').textContent = COPY[i].desc;
      $('#submit-label').textContent = COPY[i].submit;
      status.textContent = COPY[i].status;
      auth.querySelector('.signup-only').hidden = !!i;
      nameInput.required = !i;
      password.autocomplete = i ? 'current-password' : 'new-password';
      password.minLength = i ? 1 : 12;
      password.placeholder = i ? 'your password' : 'at least 12 characters';
      $('#password-hint').hidden = !!i;
      $('#reset-password').hidden = !i;
      form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
      if (changed && animate && !reducedMotion.matches) {
        content.style.setProperty('--switch-from', i ? '10px' : '-10px');
        content.classList.remove('is-switching'); void content.offsetWidth; content.classList.add('is-switching');
      }
    }

    function resetPasswordToggle() {
      password.type = 'password'; toggle.textContent = 'show';
      toggle.setAttribute('aria-pressed', 'false'); toggle.setAttribute('aria-label', 'show password');
    }

    openAuth.addEventListener('click', () => {
      selectAuth(0, false);
      auth.showModal();
      document.documentElement.style.overflow = 'hidden';
      // one decoder at a time: hand playback from the page film to the dialog film
      filmWasPlaying = !film.paused;
      film.pause();
      if (filmWasPlaying && !lightMode() && !reducedMotion.matches) {
        attachSources(authFilm);
        try { authFilm.currentTime = film.currentTime || 0; } catch (_) {}
        play(authFilm);
      }
    });

    function closeAuth() {
      if (closing || !auth.open) return;
      if (reducedMotion.matches) { auth.close(); return; }
      closing = true;
      auth.classList.add('is-closing');
      setTimeout(() => { auth.classList.remove('is-closing'); auth.close(); closing = false; }, 190);
    }
    $('#auth-close').addEventListener('click', closeAuth);
    auth.addEventListener('cancel', e => { e.preventDefault(); closeAuth(); });
    auth.addEventListener('click', e => {
      if (e.target !== auth) return;
      const r = auth.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeAuth();
    });
    auth.addEventListener('close', () => {
      authFilm.pause();
      form.reset(); resetPasswordToggle();
      document.documentElement.style.overflow = '';
      if (filmWasPlaying && !document.hidden) play(film);
      openAuth.focus();
    });

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => selectAuth(i, true));
      t.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const n = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : 1 - i;
        selectAuth(n, true); tabs[n].focus();
      });
    });

    toggle.addEventListener('click', () => {
      const show = password.type === 'password';
      password.type = show ? 'text' : 'password';
      toggle.textContent = show ? 'hide' : 'show';
      toggle.setAttribute('aria-label', show ? 'hide password' : 'show password');
      toggle.setAttribute('aria-pressed', String(show));
    });

    // Nothing is transmitted: there is no backend, and the CSP sets form-action 'none'.
    form.addEventListener('submit', e => {
      e.preventDefault();
      const fields = [emailInput, password].concat(mode ? [] : [nameInput]);
      let firstBad = null;
      for (const f of fields) {
        const ok = f.checkValidity();
        if (ok) f.removeAttribute('aria-invalid'); else { f.setAttribute('aria-invalid', 'true'); firstBad = firstBad || f; }
      }
      if (firstBad) { status.textContent = firstBad.validationMessage || 'please check the highlighted field.'; firstBad.focus(); return; }
      password.value = '';
      status.textContent = 'authentication is not connected yet. no account was created and your details were not sent anywhere.';
    });
    $('#reset-password').addEventListener('click', () => {
      status.textContent = 'password recovery will be available when the authentication service is connected.';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
