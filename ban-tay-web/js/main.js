/* ==========================================================================
   Bàn tay vô hình — Bàn tay hữu hình
   main.js — cuộn mượt, đổi chủ đề theo mục, điều hướng, câu chuyện, đồ thị
   (sân khấu 3D nằm riêng trong scene3d.js và lắng nghe các sự kiện "hands:*")
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SECTION_ORDER = ['hero', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 'quiz'];
  var root = document.documentElement;
  var currentSectionId = 'hero';
  var lenis = null;

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function emit(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail: detail })); }

  /* 1. Cuộn mượt — một phiên bản GSAP duy nhất dùng chung với scene3d.js */
  function initSmoothScroll() {
    var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
    if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    if (reduceMotion || !window.Lenis || !gsap) return;
    lenis = new window.Lenis({ duration: 1.1, smoothWheel: true, syncTouch: false });
    if (ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__cqLenis = lenis;
  }

  function scrollToSection(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: id === 'hero' ? 0 : -8, duration: 1.4 });
    else el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  /* 2. Mục đang xem → chủ đề nền, màu nhấn, điều hướng, thanh tiến độ
     Các khối có data-theme gồm cả trang đầu và đoạn chuyển chương. Đoạn chuyển chương
     có data-theme-to đổi nền giữa chừng (khi lá chớp đã phủ kín màn hình). */
  function pinProgress(el) {
    var r = el.getBoundingClientRect();
    var span = Math.max(1, el.offsetHeight - window.innerHeight);
    return Math.max(0, Math.min(1, -r.top / span));
  }
  function initSectionState() {
    var blocks = qsa('main > section[data-theme]');
    var navLinks = qsa('[data-target]');
    var counter = qs('.menu-btn__count');
    var fill = qs('.progress-fill');
    var pending = false, lastKey = '';

    function apply(block) {
      var theme = block.dataset.theme || 'night';
      if (block.dataset.themeTo && pinProgress(block) >= parseFloat(block.dataset['switch'] || '0.75')) theme = block.dataset.themeTo;
      var navId = block.dataset.nav || block.id;
      var hand = block.dataset.hand || (document.getElementById(navId) || block).dataset.hand || '';
      var k = navId + '|' + theme + '|' + hand;
      if (k === lastKey) return;
      lastKey = k;
      currentSectionId = navId;
      root.dataset.theme = theme;
      if (hand) root.dataset.hand = hand; else delete root.dataset.hand;
      navLinks.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('data-target') === navId); });
      if (counter) {
        var idx = SECTION_ORDER.indexOf(navId);
        counter.textContent = navId === 'quiz' ? 'Quiz' : idx <= 0 ? ' ' : idx + ' / 8';
      }
      emit('hands:section', { id: navId, theme: theme });
    }

    function update() {
      pending = false;
      var mid = window.innerHeight * 0.5;
      var current = blocks[0];
      for (var i = 0; i < blocks.length; i++) {
        if (blocks[i].getBoundingClientRect().top <= mid) current = blocks[i];
        else break;
      }
      apply(current);
      if (fill) {
        var doc = root, max = doc.scrollHeight - doc.clientHeight;
        fill.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0).toFixed(2) + '%';
      }
    }
    function schedule() { if (!pending) { pending = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
  }

  /* 3. Phím ↑ ↓ / PageUp PageDown khi thuyết trình: mỗi lần bấm tới một nhịp.
     Nhịp = đầu mỗi mục, cộng các điểm dừng trong đoạn được ghim (data-stops). */
  function navStops() {
    var stops = [];
    qsa('main > section').forEach(function (el) {
      var top = el.getBoundingClientRect().top + window.scrollY;
      if (el.dataset.stops) {
        var span = Math.max(1, el.offsetHeight - window.innerHeight);
        el.dataset.stops.split(',').forEach(function (p) { stops.push(Math.round(top + parseFloat(p) * span)); });
      } else {
        stops.push(Math.max(0, Math.round(top - 8)));
      }
    });
    return stops.sort(function (a, b) { return a - b; });
  }
  function goTo(y) {
    if (lenis) lenis.scrollTo(y, { duration: 1.6, easing: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; } });
    else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  function initKeyboardNav() {
    window.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      var active = document.activeElement;
      // chỉ nhường phím mũi tên cho ô chọn đáp án, ô nhập và tay kéo của đồ thị
      if (active && (/INPUT|TEXTAREA|SELECT/.test(active.tagName) || (active.getAttribute && active.getAttribute('role') === 'slider'))) return;
      var down = e.key === 'ArrowDown' || e.key === 'PageDown';
      var up = e.key === 'ArrowUp' || e.key === 'PageUp';
      if (!down && !up) return;
      e.preventDefault();
      var y = lenis ? lenis.targetScroll : window.scrollY;
      var stops = navStops(), i;
      if (down) { for (i = 0; i < stops.length; i++) if (stops[i] > y + 12) return goTo(stops[i]); }
      else { for (i = stops.length - 1; i >= 0; i--) if (stops[i] < y - 12) return goTo(stops[i]); goTo(0); }
    });
    qsa('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        if (!document.getElementById(id)) return;
        e.preventDefault();
        scrollToSection(id);
      });
    });
  }

  /* 4. Menu di động */
  function initMobileSheet() {
    var btn = qs('.menu-btn'), sheet = qs('.mobile-sheet'), closeBtn = qs('.mobile-sheet__close');
    if (!btn || !sheet) return;
    function open() { sheet.classList.add('is-open'); sheet.setAttribute('aria-hidden', 'false'); }
    function close() { sheet.classList.remove('is-open'); sheet.setAttribute('aria-hidden', 'true'); }
    btn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    sheet.addEventListener('click', function (e) { if (e.target === sheet) close(); });
    qsa('a', sheet).forEach(function (a) { a.addEventListener('click', close); });
  }

  /* 5. Hiện dần nội dung khi cuộn tới */
  function initReveal() {
    var els = qsa('.reveal');
    qsa('.reveal').forEach(function (block) {
      qsa(':scope > *, :scope tbody > tr, :scope .formula__legend > span', block).forEach(function (child, i) {
        child.style.setProperty('--n', Math.min(i, 8));
      });
    });
    if (!('IntersectionObserver' in window) || reduceMotion) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); obs.unobserve(entry.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* 6. Khối rộng đang chiếm màn hình → báo sân khấu 3D chuyển sang chế độ đọc */
  function initReadingMode() {
    var wides = qsa('.is-wide');
    if (!wides.length) return;
    var visible = new Set();
    function report() { emit('hands:reading', { on: visible.size > 0 }); }
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target);
      });
      report();
    }, { rootMargin: '-18% 0px -18% 0px', threshold: 0 });
    wides.forEach(function (el) { io.observe(el); });
  }

  /* 6b. Chuyển động gắn với cuộn (GSAP ScrollTrigger, scrub):
     - trang đầu: tiêu đề phóng to bay qua camera, luận điểm hiện dưới khe hai ngón tay
     - đoạn chuyển chương: hai dòng chữ trượt vào từ hai phía rồi phóng xuyên màn hình
     - lá chớp phủ nền giấy trước chương bàn tay hữu hình
     - tiêu đề mục: từng chữ trồi lên khỏi mặt nạ, số mục trôi chậm hơn nền */
  function splitWords(el) {
    if (!el || el.dataset.split) return [];
    el.dataset.split = '1';
    var out = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            var o = document.createElement('span'); o.className = 'w';
            var i = document.createElement('span'); i.className = 'w__in'; i.textContent = p;
            o.appendChild(i); frag.appendChild(o); out.push(i);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) walk(child);
      });
    })(el);
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.textContent);
    return out;
  }

  function initScrollMotion() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    if (!gsap || !ST || reduceMotion) return;

    // trang đầu
    var hero = qs('#hero');
    if (hero) {
      var tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom bottom', scrub: true } });
      tl.to('.hero__cue', { autoAlpha: 0, duration: 0.05 }, 0)
        .to('.hero__zoom', { scale: 3.2, duration: 0.3, ease: 'power2.in' }, 0.04)
        .to('.hero__zoom', { autoAlpha: 0, duration: 0.2 }, 0.12)
        .fromTo('.hero__sub', { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.1, ease: 'power2.out' }, 0.64)
        .to('.hero__sub', { autoAlpha: 0, y: -30, duration: 0.08 }, 0.92)
        .to({}, { duration: 0.001 }, 1);
    }

    // đoạn chuyển chương
    qsa('.interlude').forEach(function (block) {
      var a = qs('.il--a', block), b = qs('.il--b', block), type = qs('.interlude__type', block), kicker = qs('.interlude__kicker', block);
      var tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: block, start: 'top top', end: 'bottom bottom', scrub: true } });
      tl.fromTo(a, { xPercent: -70, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.28, ease: 'power3.out' }, 0)
        .fromTo(b, { xPercent: 70, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.28, ease: 'power3.out' }, 0.03)
        .fromTo(type, { scale: 0.62 }, { scale: 1, duration: 0.3, ease: 'power2.out' }, 0)
        .fromTo(kicker, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.12 }, 0.12)
        .to(kicker, { autoAlpha: 0, duration: 0.08 }, 0.46)
        .to(type, { scale: 9, duration: 0.34, ease: 'power3.in' }, 0.46)
        .to(type, { autoAlpha: 0, duration: 0.12 }, 0.66)
        .to({}, { duration: 0.001 }, 1);

      // lá chớp cho đoạn có đổi nền
      if (block.dataset.themeTo === 'paper') {
        var wipe = qs('#wipe'), bars = qsa('#wipe i');
        if (!wipe || !bars.length) return;
        var sw = parseFloat(block.dataset['switch'] || '0.74');
        var wl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: block, start: 'top top', end: 'bottom bottom', scrub: true } });
        wl.set(wipe, { visibility: 'visible' }, sw - 0.2)
          .fromTo(bars, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.14, stagger: 0.012, ease: 'power2.inOut' }, sw - 0.2)
          .to(bars, { autoAlpha: 0, duration: 0.06, stagger: 0.006 }, sw + 0.05)
          .set(wipe, { visibility: 'hidden' }, sw + 0.16)
          .to({}, { duration: 0.001 }, 1);
      }
    });

    // tiêu đề mục: từng chữ trồi lên theo cuộn; số mục trôi chậm
    qsa('.section__head').forEach(function (head) {
      var words = splitWords(qs('.section__title', head));
      if (words.length) {
        gsap.fromTo(words, { yPercent: 115, rotate: 3 }, {
          yPercent: 0, rotate: 0, duration: 1.05, ease: 'power4.out', stagger: 0.06,
          scrollTrigger: { trigger: head, start: 'top 88%', toggleActions: 'play none none reverse' }
        });
      }
      var num = qs('.section__num', head);
      if (num) gsap.fromTo(num, { yPercent: 35 }, { yPercent: -35, ease: 'none', scrollTrigger: { trigger: head, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    qsa('.subhead').forEach(function (h) {
      var words = splitWords(h);
      if (words.length) gsap.fromTo(words, { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: 'power3.out', stagger: 0.035, scrollTrigger: { trigger: h, start: 'top 92%', toggleActions: 'play none none reverse' } });
    });

    window.addEventListener('load', function () { ST.refresh(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
  }

  /* 7. Câu chuyện ba hồi */
  function initStory() {
    var story = qs('.story');
    if (!story) return;
    var tabs = qsa('.story__tab', story), texts = qsa('.story__text', story);
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var act = tab.getAttribute('data-act');
        story.setAttribute('data-act', act);
        tabs.forEach(function (t) { t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
        texts.forEach(function (tx) { tx.classList.toggle('is-active', tx.getAttribute('data-act') === act); });
        emit('hands:act', { act: Number(act) });
      });
    });
  }

  /* 8. Đồ thị cung – cầu (mục 5.1) */
  function initSupplyDemand() {
    var widget = qs('.sd-widget');
    if (!widget) return;
    qsa('.sd-demand, .sd-supply', widget).forEach(function (path) {
      if (path.getTotalLength) path.style.setProperty('--chart-length', path.getTotalLength());
    });
    var svg = qs('svg', widget), handle = qs('.sd-handle', widget), handleLine = qs('.sd-handle-line', widget);
    var gapLine = qs('.sd-gap', widget), readout = qs('.sd-readout', widget), resetBtn = qs('.sd-reset', widget);
    if (!svg || !handle || !handleLine || !gapLine || !readout) return;

    var PAD = { l: 44, t: 16, b: 34 }, VB_W = 420, VB_H = 300;
    var plotW = VB_W - PAD.l - 16, plotH = VB_H - PAD.t - PAD.b;
    var QMAX = 200, PMAX = 100, P_EQ = 200 / 4.5, curP = P_EQ;
    function xScale(q) { return PAD.l + (q / QMAX) * plotW; }
    function yScale(p) { return PAD.t + (1 - p / PMAX) * plotH; }
    function yInvert(y) { return PMAX * (1 - (y - PAD.t) / plotH); }

    function render(p) {
      curP = p;
      var y = yScale(p);
      handle.setAttribute('cy', y.toFixed(1));
      handleLine.setAttribute('y1', y.toFixed(1));
      handleLine.setAttribute('y2', y.toFixed(1));
      handle.setAttribute('aria-valuenow', Math.round(p));
      var qd = Math.max(0, Math.min(QMAX, 200 - 2 * p)), qs_ = Math.max(0, Math.min(QMAX, 2.5 * p));
      var lo = Math.min(qd, qs_), hi = Math.max(qd, qs_), axisY = yScale(0);
      gapLine.setAttribute('x1', xScale(lo).toFixed(1)); gapLine.setAttribute('x2', xScale(hi).toFixed(1));
      gapLine.setAttribute('y1', axisY.toFixed(1)); gapLine.setAttribute('y2', axisY.toFixed(1));
      var diff = Math.abs(qd - qs_);
      if (diff < 3) {
        gapLine.style.opacity = 0;
        readout.classList.remove('is-shortage');
        readout.innerHTML = 'Ở mức giá này, <b>lượng cung khớp lượng cầu</b> quanh điểm cân bằng — chợ tự thanh toán mà không cần ai can thiệp, đúng như Hồi 1 của câu chuyện.';
      } else if (qd > qs_) {
        gapLine.classList.remove('is-surplus'); gapLine.style.opacity = 1;
        readout.classList.add('is-shortage');
        readout.innerHTML = 'Giá bị ấn định <b>thấp hơn</b> mức cân bằng: lượng cầu vượt lượng cung khoảng <b class="num">' + Math.round(diff) + '</b> đơn vị bánh. Đây chính là "bánh khan" — hệ quả khi trưởng làng ấn định giá ở cuối Hồi 3.';
      } else {
        gapLine.classList.add('is-surplus'); gapLine.style.opacity = 1;
        readout.classList.remove('is-shortage');
        readout.innerHTML = 'Giá bị ấn định <b>cao hơn</b> mức cân bằng: lượng cung vượt lượng cầu khoảng <b class="num">' + Math.round(diff) + '</b> đơn vị bánh — làm ra nhiều hơn mức chợ cần, hàng tồn chất lại.';
      }
      emit('hands:price', { gap: (qd - qs_) / QMAX });
    }
    function svgY(evt) { var rect = svg.getBoundingClientRect(); return (evt.clientY - rect.top) * (VB_H / rect.height); }
    function setFromY(y) {
      y = Math.max(PAD.t + 2, Math.min(PAD.t + plotH - 2, y));
      render(Math.max(3, Math.min(97, yInvert(y))));
    }
    var dragging = false;
    function startDrag(e) {
      dragging = true;
      if (e.pointerId !== undefined && handle.setPointerCapture) { try { handle.setPointerCapture(e.pointerId); } catch (err) { /* noop */ } }
      setFromY(svgY(e));
    }
    handle.addEventListener('pointerdown', startDrag);
    handleLine.addEventListener('pointerdown', startDrag);
    svg.addEventListener('pointermove', function (e) { if (dragging) setFromY(svgY(e)); });
    window.addEventListener('pointerup', function () { dragging = false; });
    window.addEventListener('pointercancel', function () { dragging = false; });
    handle.setAttribute('tabindex', '0');
    handle.setAttribute('role', 'slider');
    handle.setAttribute('aria-label', 'Kéo để thay đổi mức giá bánh do trưởng làng ấn định');
    handle.setAttribute('aria-valuemin', '3');
    handle.setAttribute('aria-valuemax', '97');
    handle.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); render(Math.min(97, curP + 2)); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); render(Math.max(3, curP - 2)); }
    });
    if (resetBtn) resetBtn.addEventListener('click', function () { render(P_EQ); });
    render(P_EQ);
  }

  /* 9. Tiêu đề hero — chữ trồi lên lần lượt (chỉ bọc span, không đổi nội dung) */
  function initHeroTitle() {
    var h1 = qs('.hero__title');
    if (!h1 || reduceMotion) return;
    var n = 0;
    function wrap(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            var outer = document.createElement('span');
            outer.className = 'w';
            var inner = document.createElement('span');
            inner.className = 'w__in';
            inner.style.setProperty('--i', n++ * 3);
            inner.textContent = p;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          wrap(child);
        }
      });
    }
    h1.setAttribute('aria-label', h1.textContent);
    wrap(h1);
    h1.classList.add('is-split');
  }

  document.addEventListener('DOMContentLoaded', function () {
    function safe(fn) { try { fn(); } catch (err) { if (window.console) console.error(err); } }
    safe(initSmoothScroll);
    safe(initHeroTitle);
    safe(initSectionState);
    safe(initKeyboardNav);
    safe(initMobileSheet);
    safe(initReveal);
    safe(initReadingMode);
    safe(initScrollMotion);
    safe(initStory);
    safe(initSupplyDemand);
  });
})();
