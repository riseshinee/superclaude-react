# jQuery → React Patterns

Keep the publisher's class names (`on`, `active`, `open`, `fixed`, …) — only *who toggles them* changes.
Use `clsx`/`classnames` if the project already has it; otherwise template strings.

## Core Mapping

| jQuery | React |
|---|---|
| `$(el).addClass('on').siblings().removeClass('on')` | `const [active, setActive] = useState(0)` + ``className={`tab ${i === active ? 'on' : ''}`}`` |
| `$(el).toggleClass('open')` | `const [open, setOpen] = useState(false)` + `setOpen(o => !o)` |
| `.show()` / `.hide()` / `.css('display', …)` | Conditional render `{open && …}`, or keep the element and toggle the class the CSS uses |
| `.slideToggle()` / `.slideDown()` | CSS transition on `max-height`/`grid-template-rows` toggled by a class; or `details`/`summary` |
| `.fadeIn()` / `.fadeOut()` | CSS `opacity` transition toggled by a class |
| `.animate({ scrollTop })` | `window.scrollTo({ top, behavior: 'smooth' })` / `ref.current.scrollIntoView({ behavior: 'smooth' })` |
| `.html(…)` / `.append(…)` | Render from state/data arrays |
| `.val()` | Controlled input (`value` + `onChange`) or form library already in the project |
| `.attr('aria-expanded', …)` | `aria-expanded={open}` derived from state |
| `$(document).on('click', …)` outside click | `useEffect` + `document.addEventListener('pointerdown', …)` checking `ref.current.contains(e.target)`, with cleanup |
| `$(window).scroll(…)` → `.toggleClass('fixed', y > 50)` | `useEffect` scroll listener (`{ passive: true }`) setting state, with cleanup; or `IntersectionObserver` on a sentinel |
| `$(window).resize(…)` | `matchMedia` listener or CSS media queries if purely visual |
| `$.ajax` / `$.get` | The project's data layer (TanStack Query / SWR / loaders / fetch hook) |
| `$(function(){ … })` (DOM ready) | Component render + `useEffect` for side effects |
| `setInterval` rolling banners | `useEffect` with `clearInterval` cleanup; pause on hover/focus for accessibility |
| `$('body').addClass('menu-open')` (scroll lock) | `useEffect(() => { document.body.classList.toggle('menu-open', open); return () => document.body.classList.remove('menu-open'); }, [open])` |

## Common Widgets

**Tabs**
```tsx
const [active, setActive] = useState(0);
<ul className="tab-list" role="tablist">
  {tabs.map((t, i) => (
    <li key={t.id} className={i === active ? 'on' : undefined} role="presentation">
      <button type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)}>{t.label}</button>
    </li>
  ))}
</ul>
{tabs.map((t, i) => (
  <div key={t.id} className="tab-panel" role="tabpanel" hidden={i !== active}>{t.content}</div>
))}
```
If publisher CSS hides panels by class instead of `hidden`, toggle that class instead.

**Accordion / FAQ** — state holds the open id (single) or a `Set` (multiple); keep `.on`/`.open` classes; `aria-expanded` on the trigger button.

**Modal / layer popup** — state `open`; render the publisher's markup when open (portal if z-index/overflow requires it); Esc to close, focus moves in on open and back to the trigger on close; body scroll lock class via effect. Prefer native `<dialog>` if it doesn't conflict with the publisher CSS.

**Mobile menu (GNB)** — `open` state toggles the class the CSS expects on the same element jQuery targeted; close on route change (effect on pathname).

**Dropdown / select UI** — state + outside-click effect; keyboard support (Esc, arrows) if it replaces a native `<select>`.

**Sticky header** — scroll listener or `IntersectionObserver`; toggle the same `fixed` class.

## Plugins

Check the installed version's docs (Context7) before writing code, and confirm with the user before adding a dependency.

| Publisher plugin | React option | Notes |
|---|---|---|
| Swiper | `swiper/react` (`Swiper`, `SwiperSlide`) | Map publisher options 1:1; keep publisher CSS classes if styled; import Swiper CSS modules used |
| Slick / bxSlider / Owl Carousel | Swiper (`swiper/react`) or Embla (`embla-carousel-react`) | Recreate options; publisher CSS for slick classes won't apply — restyle arrows/dots with the same look |
| AOS | Keep AOS: `useEffect(() => { AOS.init(); }, [])` + `AOS.refresh()` on route change; or IntersectionObserver adding the same classes | `data-aos` attributes survive conversion |
| GSAP / ScrollTrigger | `@gsap/react` `useGSAP` with a scope ref | Automatic cleanup on unmount |
| Lottie | `lottie-react` | Keep the JSON in `public/` |
| jQuery UI datepicker / flatpickr | The project's date picker, else `react-day-picker` | Match the displayed format |
| select2 | `react-select` | Restyle to match publisher design |
| Fancybox / Magnific / Lightbox | `yet-another-react-lightbox` | |
| fullPage.js | `@fullpage/react-fullpage` | Commercial license required — flag it |
| Bootstrap JS (modal, collapse, dropdown) | Existing UI library or small components above | Keep Bootstrap CSS if the markup relies on it |
| Isotope / Masonry | CSS grid/`columns`, or `react-masonry-css` | Filtering → state + `.filter()` |
| Chart.js / Highcharts / ECharts | `react-chartjs-2` / `highcharts-react-official` / `echarts-for-react` | |

## Generic Wrapper (when no React version exists)

```tsx
function LegacyWidget({ options }: { options: WidgetOptions }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const instance = new Widget(ref.current, options);
    return () => instance.destroy();
  }, [options]);
  return <div ref={ref} className="widget">{/* publisher markup */}</div>;
}
```
- The library must not require jQuery; if it does, prefer replacing it.
- Memoize `options` or depend on primitive values so the widget isn't recreated every render.
- Next.js App Router: this is a Client Component (`'use client'`); load browser-only libraries inside the effect or via `next/dynamic` with `ssr: false` when they touch `window` at import time.
