# iOS PWA chat-header back-button fix (`/opt/memory-v2/index.html`)

VPS: `/opt/memory-v2/index.html`
Service: `memory-web.service` (static-serves the file; no restart needed)
Backup: `/opt/memory-v2/index.html.bak.backbtn`

## Bug

When the web app is installed to the iOS home screen (`apple-mobile-web-app-capable=yes`
+ `apple-mobile-web-app-status-bar-style=black-translucent` + `viewport-fit=cover`),
the chat-header's top-left "‹" back button can't be tapped on iPhone — it sits
right next to the Dynamic Island / status-bar gesture zone and the tap target
is too small.

## Root cause

`renderThreadView()` rendered the back arrow as a single `‹` character
(`U+2039`) at `font-size:16px` with `padding:4px 6px`. That's a ~24×24 tap
target — well below Apple HIG's 44×44 minimum — and visually almost invisible
since it's a thin orange glyph on a pale background. With `viewport-fit=cover`
the chat-header sat at `env(safe-area-inset-top)`, putting the button right
on the edge of iOS' system gesture zone where touches near the Dynamic Island
get eaten by the OS.

## Fix

`fixes/ios-pwa-back-button/index.html.patch` — three small changes:

1. **Add a `back` chevron SVG to the `ICONS` map** so the icon helper can render
   a proper Lucide-style left-chevron.

2. **Rebuild the chat-header back button** as a 44×44 tap target with the new
   SVG icon (24px stroke, color `var(--a)`, rounded 22px), and add explicit
   `padding-top: max(8px, calc(env(safe-area-inset-top) + 4px))` on the header
   itself so the button sits a few extra pixels below the Dynamic Island
   gesture zone.

3. **Stop double-padding `w`** — the chat-view container had its own
   `padding-top: env(safe-area-inset-top)` which would now stack with the
   header's own safe-area padding. Conditional it out only for chat
   (`padding-top: T==="chat" ? "0" : "env(safe-area-inset-top)"`). Other tabs
   keep the previous behaviour unchanged.

Nothing else about the home-screen adaptation changes: the `viewport`,
`apple-mobile-web-app-*` meta tags, bottom-nav safe-area padding, and the
rest of the layout are untouched.

## Verification

- Served HTML on `:5180/index.html` includes the new `back` icon, the new
  `min-width:44px` button styling, and the `aria-label="返回"` accessibility label.
- iOS standalone-PWA users need to **pull-to-refresh** (or close & reopen the
  PWA from the home screen) to pick up the new static HTML; no server
  restart is required.

## Re-applying

```bash
cp /opt/memory-v2/index.html /opt/memory-v2/index.html.bak.backbtn
patch -p0 /opt/memory-v2/index.html < index.html.patch
```
