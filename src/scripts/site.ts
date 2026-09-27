// All client-side behaviour for the site. Bundled once by Astro; keep it small.
// 1. Nav solidifies after 80px of scroll.
// 2. Mobile menu: open/close, focus trap, Esc, focus restore.
// 3. Scroll-reveal via IntersectionObserver.
// 4. Obfuscated email links are decoded at runtime (no raw mailto in the HTML).

const nav = document.querySelector<HTMLElement>('[data-nav]');

// 1 ─ Nav background
if (nav?.classList.contains('nav--overlay')) {
  const update = () => nav.classList.toggle('is-solid', window.scrollY > 80);
  update();
  window.addEventListener('scroll', update, { passive: true });
}

// 2 ─ Mobile menu
const menu = document.querySelector<HTMLElement>('[data-nav-menu]');
const openBtn = document.querySelector<HTMLButtonElement>('[data-nav-open]');
const closeBtn = document.querySelector<HTMLButtonElement>('[data-nav-close]');

function focusables(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
}

function onMenuKey(e: KeyboardEvent) {
  if (!menu) return;
  if (e.key === 'Escape') return closeMenu();
  if (e.key !== 'Tab') return;
  const items = focusables(menu);
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function openMenu() {
  if (!menu || !openBtn) return;
  menu.hidden = false;
  openBtn.setAttribute('aria-expanded', 'true');
  document.documentElement.classList.add('menu-open');
  document.addEventListener('keydown', onMenuKey);
  focusables(menu)[0]?.focus();
}

function closeMenu() {
  if (!menu || !openBtn) return;
  menu.hidden = true;
  openBtn.setAttribute('aria-expanded', 'false');
  document.documentElement.classList.remove('menu-open');
  document.removeEventListener('keydown', onMenuKey);
  openBtn.focus();
}

openBtn?.addEventListener('click', openMenu);
closeBtn?.addEventListener('click', closeMenu);
menu?.querySelectorAll('[data-nav-link]').forEach(a => a.addEventListener('click', closeMenu));
window.matchMedia('(min-width: 900px)').addEventListener('change', e => {
  if (e.matches && menu && !menu.hidden) closeMenu();
});

// 3 ─ Scroll reveal
const reveals = document.querySelectorAll<HTMLElement>('.reveal');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduce || !('IntersectionObserver' in window)) {
  reveals.forEach(el => el.classList.add('is-visible'));
} else {
  const io = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -10% 0px' },
  );
  reveals.forEach(el => io.observe(el));
}

// 4 ─ Email decode. data-mail holds the address base64-encoded and reversed.
document.querySelectorAll<HTMLAnchorElement>('a[data-mail]').forEach(a => {
  try {
    const addr = atob(a.dataset.mail!.split('').reverse().join(''));
    a.href = `mailto:${addr}`;
    const label = a.querySelector('[data-mail-label]');
    if (label) label.textContent = addr;
  } catch {
    /* leave the fallback href */
  }
});
