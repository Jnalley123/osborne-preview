(() => {
  const doc = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // intro curtain: never let it outstay its welcome, even if animations are throttled
  const curtain = document.querySelector('.curtain');
  if (curtain) {
    curtain.addEventListener('animationend', (e) => e.animationName === 'lift' && curtain.remove());
    setTimeout(() => curtain.remove(), 2600);
  }

  // background films: lighter file on phones, and keep them playing.
  // Phones pause muted autoplay video when the tab is backgrounded, on slow buffering,
  // or in battery-saver modes, so nudge playback whenever the page is visible or touched.
  const films = [...document.querySelectorAll('video[autoplay]')];
  if (films.length) {
    const small = matchMedia('(max-width: 820px)').matches;
    films.forEach((v) => {
      v.muted = true;
      v.playsInline = true;
      const s = v.querySelector('source');
      if (small && s && s.src.includes('/1080p/')) { s.src = s.src.replace('/1080p/', '/720p/'); v.load(); }
    });
    const kick = () => films.forEach((v) => {
      if (document.visibilityState !== 'visible' || !v.paused) return;
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    });
    films.forEach((v) => ['canplay', 'pause', 'stalled', 'suspend'].forEach((ev) => v.addEventListener(ev, () => setTimeout(kick, 250))));
    ['visibilitychange', 'pageshow', 'focus'].forEach((ev) => addEventListener(ev, kick));
    document.addEventListener('visibilitychange', kick);
    ['touchstart', 'click', 'scroll'].forEach((ev) => addEventListener(ev, kick, { passive: true }));
    kick();
  }

  // header state
  const head = document.querySelector('.site-head');
  // the menu slides away while scrolling down and returns on the first scroll back up
  let lastY = scrollY;
  const onScroll = () => {
    if (!head) return;
    const y = Math.max(0, scrollY);
    head.classList.toggle('scrolled', y > 40);
    if (Math.abs(y - lastY) > 4) {
      head.classList.toggle('nav-hide', y > lastY && y > 90);
      lastY = y;
    }
  };
  if (head) head.addEventListener('focusin', () => head.classList.remove('nav-hide'));
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // full-screen menu
  const burger = document.querySelector('.burger');
  if (burger) {
    const toggle = (open) => {
      doc.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => toggle(!doc.classList.contains('menu-open')));
    document.querySelectorAll('.menu a').forEach((a) => a.addEventListener('click', () => toggle(false)));
    addEventListener('keydown', (e) => e.key === 'Escape' && toggle(false));
  }

  // reveal on scroll
  const targets = document.querySelectorAll('[data-reveal], .lines');
  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
    targets.forEach((el) => io.observe(el));
    // anything already on screen at load reveals without waiting on the observer
    setTimeout(() => targets.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) el.classList.add('in');
    }), 80);
  }

  // gentle parallax
  const par = [...document.querySelectorAll('[data-parallax]')];
  if (par.length && !reduce) {
    let ticking = false;
    const run = () => {
      const vh = innerHeight;
      par.forEach((el) => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const p = (r.top + r.height / 2 - vh / 2) / vh;
        el.style.transform = `translate3d(0, ${(p * Number(el.dataset.parallax || 40)).toFixed(1)}px, 0) scale(1.12)`;
      });
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
    run();
  }

  // depth: scroll-linked camera moves.
  //  --z   on photographs: pulls back from a close crop to the full frame as the picture rises into view
  //  --fly on the hero: the film pushes in while the wordmark lifts away
  //  --pin on the pinned band: a window opens onto the photograph while the camera pulls back
  const clamp = (n) => Math.min(1, Math.max(0, n));
  const zooms = [...document.querySelectorAll('.pillar .fig > img, .gallery .fig > img, .folio .fig > img')];
  const heroC = document.querySelector('.hero-c');
  const pin = document.querySelector('.pin');
  const plate = document.querySelector('[data-plate]');
  if (!reduce && (zooms.length || heroC || pin || plate)) {
    zooms.forEach((el) => el.classList.add('zoom'));
    doc.classList.add('depth');
    let queued = false;
    const move = () => {
      queued = false;
      const vh = innerHeight;
      zooms.forEach((el) => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -80 || r.top > vh + 80) return;
        el.style.setProperty('--z', clamp((vh - r.top) / (vh / 2 + r.height / 2)).toFixed(3));
      });
      if (heroC) heroC.style.setProperty('--fly', clamp(scrollY / heroC.offsetHeight).toFixed(3));
      if (plate) {
        const r = plate.getBoundingClientRect();
        plate.style.setProperty('--plate', clamp((vh - r.top) / (vh / 2 + r.height / 2)).toFixed(3));
      }
      if (pin) {
        const r = pin.getBoundingClientRect();
        const span = r.height - vh;
        const p = span > 40 ? -r.top / span : (vh - r.top) / (vh / 2 + r.height / 2);
        pin.style.setProperty('--pin', clamp(p).toFixed(3));
      }
    };
    const ask = () => { if (!queued) { queued = true; requestAnimationFrame(move); } };
    addEventListener('scroll', ask, { passive: true });
    addEventListener('resize', ask);
    move();
  }

  // residence rows: floating drawing preview
  const peek = document.querySelector('.peek');
  if (peek) {
    const img = peek.querySelector('img');
    document.querySelectorAll('.res-row[data-img]').forEach((row) => {
      row.addEventListener('mouseenter', () => { img.src = row.dataset.img; peek.classList.add('on'); });
      row.addEventListener('mouseleave', () => peek.classList.remove('on'));
      row.addEventListener('mousemove', (e) => {
        peek.style.transform = `translate(${e.clientX + 200}px, ${e.clientY - 40}px) translate(-50%, -50%)`;
      });
    });
  }

  // contact form
  const form = document.querySelector('form.form');
  if (form) {
    const res = new URLSearchParams(location.search).get('residence');
    const sel = form.querySelector('[name="interest"]');
    if (res && sel) {
      const opt = [...sel.options].find((o) => o.value === res);
      if (opt) sel.value = res;
    }
    // Where enquiries are emailed. Paste the form address from the email-forwarding service here,
    // e.g. 'https://formspree.io/f/abcdwxyz'. While empty, the forms only show the thank-you (preview mode).
    // Used by both the contact form and the private-list sign-up (form[data-list]).
    const ENDPOINT = '';

    // hidden trap field: people never see it, bots fill it in
    const trap = Object.assign(document.createElement('input'), { name: '_gotcha', tabIndex: -1, autocomplete: 'off', hidden: true });
    trap.setAttribute('aria-hidden', 'true');
    form.append(trap);
    const fail = Object.assign(document.createElement('p'), { className: 'form-error', hidden: true });
    fail.setAttribute('role', 'alert');
    fail.textContent = 'That did not send. Please try again, or call 214.449.4564.';
    form.append(fail);

    const done = () => {
      form.classList.add('sent');
      form.nextElementSibling.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      if (!ENDPOINT || data.get('_gotcha')) return done();
      const list = form.hasAttribute('data-list');
      data.append('form', list ? 'Private list sign-up' : 'Contact enquiry');
      data.append('_subject', (list ? 'Private list sign-up: ' : 'New enquiry: ') + data.get('first_name') + ' ' + data.get('last_name'));
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      fail.hidden = true;
      try {
        const r = await fetch(ENDPOINT, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error(String(r.status));
        done();
      } catch (err) {
        fail.hidden = false;
      } finally {
        btn.disabled = false;
      }
    });
  }

  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
