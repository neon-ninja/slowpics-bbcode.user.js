# slow.pics BBCode

A userscript for [slow.pics](https://slow.pics) that lists the comparisons in a collection and
exports them as BBCode, ready to paste into a forum post. It works in Tampermonkey,
Violentmonkey and Greasemonkey.

```
[comparison=Remux, RandomBytes]
https://i.slow.pics/p/Sk1ZW5EQ.webp, https://i.slow.pics/p/pjI8r1C3.webp
https://i.slow.pics/p/JOLqfSor.webp, https://i.slow.pics/p/Iz917EAi.webp
[/comparison]
```

## Install

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/),
   [Violentmonkey](https://violentmonkey.github.io/) or
   [Greasemonkey](https://www.greasespot.net/).
2. Open
   [slowpics-bbcode.user.js](https://raw.githubusercontent.com/neon-ninja/slow.pics.CLI/main/slowpics-bbcode.user.js).
   Your userscript manager will offer to install it, and it will pick up updates from the same
   address.

## Usage

Open any comparison on slow.pics (a `https://slow.pics/c/...` page). Then click **BBCode** in the
bar at the bottom of the page, next to **Slider comparison**. A panel opens with the following
parts:

- **Collection** shows which collection you're working with. It starts as the one you're
  viewing. To export a different one, paste its full URL (`https://slow.pics/c/xnkAHiN5`) or just
  its key (`xnkAHiN5`) and press **Load** or Enter.
- **Comparisons** lists every comparison in the collection, numbered, each with a ↗ link to open
  it. Untick the ones you don't want, or use **All** and **None**.
- **Images in each comparison** lists the sources, such as `Remux` and `Encode`. Untick a source
  to leave it out, for example to get two images per line from a three-way comparison.
- **Format** offers two styles:
  - a `[comparison=...]` block, with one comparison per line and its images separated by commas;
  - one `[img]...[/img]` tag per image, like slow.pics shows after uploading an image collection.
- **Header names** sets the names in `[comparison=...]`. By default these are the image names,
  without the frame type that vs-preview adds, such as `(B)`. Untick the checkbox below to keep
  the frame type, or type your own names separated by commas.
- **Copy to clipboard** copies the BBCode, which is also shown in the box below.

Typing inside the panel doesn't trigger slow.pics' keyboard shortcuts, and Escape closes the panel.

## How it works

Every slow.pics comparison page includes the whole collection as data: its comparisons, and the
name and file of every image. The script reads that data, so it needs no API and makes no extra
requests for the collection you're viewing. Image links are built the same way the page builds
them: `https://i.slow.pics/` followed by the image's path.

Loading another collection fetches that collection's page from your browser, the same as opening
it in a tab. This means Cloudflare treats it like normal browsing.

## Development

The tests serve a saved slow.pics page (`test/fixtures/comparison.html`) locally, inject the
userscript into it, and drive it in headless Chromium with Playwright.

```bash
npm ci
npx playwright install chromium
npm test
```
