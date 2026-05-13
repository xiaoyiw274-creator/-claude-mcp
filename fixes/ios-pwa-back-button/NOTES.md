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

`fixes/ios-pwa-back-button/index.html.patch` — two minimal changes:

1. **Add a `back` chevron SVG to the `ICONS` map** so the icon helper can render
   a proper Lucide-style left-chevron.

2. **Rebuild the chat-header back button** as a 44×44 tap target rendering the
   new SVG icon (24px stroke, `var(--a)` color, 22px corner radius,
   `aria-label="返回"`). The existing `w` container's
   `padding-top: env(safe-area-inset-top)` already handles the safe area for
   every tab, so the chat-header keeps its original `padding:10px 14px` —
   the bigger button is enough to clear the Dynamic Island gesture zone on
   its own.

(An earlier draft also conditionalised `w`'s `padding-top` and added a second
`padding-top` on the header to push it lower. That double-tweak broke the
thread-list / menu view's safe-area on iOS PWA — title "和小宝聊天" ended up
underneath the status bar — so it was reverted; only the icon + button change
remains.)

Nothing else about the home-screen adaptation changes: the `viewport`,
`apple-mobile-web-app-*` meta tags, bottom-nav safe-area padding, the `w`
container, and the rest of the layout are untouched.

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
