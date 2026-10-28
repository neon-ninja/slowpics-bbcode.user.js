// ==UserScript==
// @name         slow.pics BBCode
// @namespace    https://github.com/neon-ninja/slowpics-bbcode.user.js
// @version      1.0.2
// @description  List the comparisons in a slow.pics collection and copy them as BBCode ([comparison] block or [img] tags).
// @license      MIT
// @match        https://slow.pics/c/*
// @icon         https://slow.pics/favicon-32x32.png
// @grant        none
// @run-at       document-idle
// @homepageURL  https://github.com/neon-ninja/slowpics-bbcode.user.js
// @supportURL   https://github.com/neon-ninja/slowpics-bbcode.user.js/issues
// @downloadURL  https://raw.githubusercontent.com/neon-ninja/slowpics-bbcode.user.js/main/slowpics-bbcode.user.js
// @updateURL    https://raw.githubusercontent.com/neon-ninja/slowpics-bbcode.user.js/main/slowpics-bbcode.user.js
// ==/UserScript==

(function () {
  'use strict';

  const DEFAULT_CDN_URL = 'https://i.slow.pics/';
  // vs-preview prefixes image names with the frame type, e.g. "(B) Remux".
  const FRAME_TYPE_RE = /^\([A-Za-z?]\)\s*/;

  // ---------------------------------------------------------------------------
  // Reading collection data from a slow.pics page
  // ---------------------------------------------------------------------------

  // Returns the source text of the object literal starting at `start`, walking braces so strings
  // containing "{", "}" or ";" don't cut it short.
  function objectLiteralAt(source, start) {
    let depth = 0;
    let inString = false;
    for (let i = start; i < source.length; i++) {
      const ch = source[i];
      if (inString) {
        if (ch === '\\') i++;
        else if (ch === '"') inString = false;
      } else if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}' && --depth === 0) {
        return source.slice(start, i + 1);
      }
    }
    return null;
  }

  // slow.pics embeds page data in an inline script as JSON assigned to a global, e.g. the collection
  // shown on the page. Returns the first such assignment to `name` that holds valid JSON.
  function extractJsonVar(source, name) {
    const pattern = new RegExp(`\\bvar\\s+${name}\\s*=\\s*\\{`, 'g');
    for (let match; (match = pattern.exec(source)); ) {
      const literal = objectLiteralAt(source, pattern.lastIndex - 1);
      if (!literal) continue;
      try {
        return JSON.parse(literal);
      } catch {
        // Not JSON (or cut off), so keep looking.
      }
    }
    return null;
  }

  function extractStringVar(source, name) {
    const match = new RegExp(`\\bvar\\s+${name}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*")`).exec(source);
    return match ? JSON.parse(match[1]) : null;
  }

  function parseCollectionPage(source) {
    const data = extractJsonVar(source, 'collection');
    if (!data) throw new Error('No comparison data was found on this page.');
    if (!Array.isArray(data.comparisons)) throw new Error('This collection has no comparisons.');

    let cdnUrl = extractStringVar(source, 'cdnUrl') || DEFAULT_CDN_URL;
    if (!cdnUrl.endsWith('/')) cdnUrl += '/';

    return {
      key: data.key,
      name: data.name || '',
      comparisons: data.comparisons.map((comp) => ({
        key: comp.key,
        name: comp.name || '',
        images: (comp.images || []).map((img) => ({
          name: img.name || '',
          url: cdnUrl + (img.path || img.publicFileName),
        })),
      })),
    };
  }

  function currentPageCollection() {
    return parseCollectionPage(Array.from(document.scripts, (script) => script.textContent).join('\n'));
  }

  function parseKey(value) {
    value = value.trim();
    if (/^[A-Za-z0-9]+$/.test(value)) return value;
    const match = /^(?:https?:\/\/)?(?:www\.)?slow\.pics\/[cs]\/([A-Za-z0-9]+)(?:[/?#].*)?$/i.exec(value);
    if (match) return match[1];
    throw new Error(`"${value}" is not a slow.pics URL or key (e.g. https://slow.pics/c/xnkAHiN5 or xnkAHiN5).`);
  }

  async function fetchCollection(key) {
    const response = await fetch(`${location.origin}/c/${encodeURIComponent(key)}`, { credentials: 'include' });
    if (!response.ok) throw new Error(`slow.pics returned HTTP ${response.status} for "${key}".`);
    return parseCollectionPage(await response.text());
  }

  // ---------------------------------------------------------------------------
  // BBCode
  // ---------------------------------------------------------------------------

  function imgTag(img) {
    return `[img]${img.url}[/img]`;
  }

  function comparisonBBCode(rows, labels, wrapImages) {
    const image = wrapImages ? imgTag : (img) => img.url;
    return [
      `[comparison=${labels.join(', ')}]`,
      ...rows.map((row) => row.map(image).join(', ')),
      '[/comparison]',
    ].join('\n');
  }

  function imgBBCode(rows) {
    return rows.flat().map(imgTag).join('\n');
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  const CSS = `
    #spbb-panel {
      position: fixed; top: 4rem; right: 1rem; z-index: 2000;
      width: min(42rem, calc(100vw - 2rem)); max-height: calc(100vh - 6rem); overflow: auto;
      padding: 1rem; border: 1px solid #495057; border-radius: .5rem;
      background: #212529; color: #dee2e6; box-shadow: 0 .5rem 1.5rem rgba(0, 0, 0, .6);
      font-size: .9rem; text-align: left;
    }
    #spbb-panel[hidden] { display: none; }
    #spbb-panel h6 { margin: 1rem 0 .4rem; font-weight: bold; }
    #spbb-panel h6 span { font-weight: normal; font-size: .85rem; }
    #spbb-panel a { color: #6ea8fe; }
    #spbb-panel label { margin: 0; cursor: pointer; }
    #spbb-panel .spbb-row input[type=text] { flex: 1 1 12rem; width: auto; min-width: 0; }
    #spbb-panel textarea { width: 100%; font-family: monospace; font-size: .8rem; white-space: pre; }
    #spbb-panel .spbb-row { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
    #spbb-panel .spbb-list { max-height: 11rem; overflow: auto; border: 1px solid #495057; border-radius: .25rem; padding: .25rem .5rem; }
    #spbb-panel .spbb-list label { display: block; }
    #spbb-panel .spbb-error { color: #ea868f; margin-top: .5rem; }
    #spbb-panel .spbb-muted { color: #adb5bd; }
    #spbb-floating-button { position: fixed; right: 1rem; bottom: 4rem; z-index: 2000; }
  `;

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (key === 'class') node.className = value;
      else if (key in node) node[key] = value;
      else node.setAttribute(key, value);
    }
    node.append(...children.filter((child) => child != null));
    return node;
  }

  function checkbox(labelText, checked, onChange) {
    const input = el('input', { type: 'checkbox', checked, class: 'form-check-input me-1', onchange: onChange });
    return { input, label: el('label', {}, input, labelText) };
  }

  const state = {
    collection: null,
    comparisons: new Set(), // indices of selected comparisons
    columns: new Set(), // indices of selected images within each comparison
    format: 'comparison',
    wrapImages: true, // [img] tags around each URL in a [comparison] block
    stripFrameType: true,
  };

  const ui = {};

  function columnNames(collection) {
    const names = [];
    for (const comp of collection.comparisons) {
      comp.images.forEach((img, i) => {
        if (names[i] === undefined) names[i] = img.name || `Image ${i + 1}`;
      });
    }
    return names;
  }

  function selectedColumns() {
    return [...state.columns].sort((a, b) => a - b);
  }

  function selectedRows() {
    const columns = selectedColumns();
    return state.collection.comparisons
      .filter((_, i) => state.comparisons.has(i))
      .map((comp) => columns.map((i) => comp.images[i]).filter(Boolean));
  }

  function autoLabels() {
    const names = columnNames(state.collection);
    return selectedColumns().map((i) => {
      const name = state.stripFrameType ? names[i].replace(FRAME_TYPE_RE, '') : names[i];
      return name || `Image ${i + 1}`;
    });
  }

  function renderOutput() {
    const auto = autoLabels();
    ui.labels.placeholder = auto.join(', ');
    ui.labels.disabled = ui.strip.disabled = ui.wrap.disabled = state.format !== 'comparison';

    const rows = selectedRows().filter((row) => row.length);
    if (!rows.length) {
      ui.output.value = '';
      ui.hint.textContent = 'Select at least one comparison and one image.';
      return;
    }
    ui.hint.textContent = '';
    const custom = ui.labels.value.trim();
    const labels = custom ? custom.split(',').map((label) => label.trim()) : auto;
    ui.output.value = state.format === 'img' ? imgBBCode(rows) : comparisonBBCode(rows, labels, state.wrapImages);
  }

  function renderCollection() {
    const collection = state.collection;
    const names = columnNames(collection);
    const url = `${location.origin}/c/${collection.key}`;

    ui.info.replaceChildren(
      el('a', { href: url }, collection.name || collection.key),
      el('span', { class: 'spbb-muted' },
        ` (${collection.comparisons.length} comparisons, ${names.length} images each)`),
    );

    ui.comparisonList.replaceChildren(
      ...collection.comparisons.map((comp, i) => {
        const { label } = checkbox(`${i + 1}. ${comp.name || '(unnamed)'} `, state.comparisons.has(i), (event) => {
          if (event.target.checked) state.comparisons.add(i);
          else state.comparisons.delete(i);
          renderOutput();
        });
        if (comp.key) {
          label.append(el('a', { href: `${location.origin}/c/${comp.key}`, title: 'Open this comparison' }, '↗'));
        }
        return label;
      }),
    );

    ui.columnList.replaceChildren(
      ...names.map((name, i) =>
        checkbox(name, state.columns.has(i), (event) => {
          if (event.target.checked) state.columns.add(i);
          else state.columns.delete(i);
          renderOutput();
        }).label,
      ),
    );

    renderOutput();
  }

  function setCollection(collection) {
    state.collection = collection;
    state.comparisons = new Set(collection.comparisons.map((_, i) => i));
    state.columns = new Set(columnNames(collection).map((_, i) => i));
    ui.source.value = `${location.origin}/c/${collection.key}`;
    ui.labels.value = '';
    renderCollection();
  }

  function setAllComparisons(selected) {
    state.comparisons = new Set(selected ? state.collection.comparisons.map((_, i) => i) : []);
    renderCollection();
  }

  async function loadFromInput() {
    ui.error.textContent = '';
    let key;
    try {
      key = parseKey(ui.source.value);
    } catch (error) {
      ui.error.textContent = error.message;
      return;
    }
    ui.load.disabled = true;
    ui.load.textContent = 'Loading…';
    try {
      setCollection(await fetchCollection(key));
    } catch (error) {
      ui.error.textContent = `Could not load "${key}": ${error.message}`;
    } finally {
      ui.load.disabled = false;
      ui.load.textContent = 'Load';
    }
  }

  async function copyOutput() {
    const text = ui.output.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      ui.output.select();
      document.execCommand('copy');
    }
    ui.copied.textContent = 'Copied!';
    setTimeout(() => (ui.copied.textContent = ''), 2000);
  }

  function buildPanel() {
    ui.source = el('input', {
      type: 'text',
      class: 'form-control form-control-sm',
      placeholder: 'https://slow.pics/c/xnkAHiN5 or xnkAHiN5',
      onkeydown: (event) => event.key === 'Enter' && loadFromInput(),
    });
    ui.load = el('button', { type: 'button', class: 'btn btn-sm btn-primary', onclick: loadFromInput }, 'Load');
    ui.error = el('div', { class: 'spbb-error' });
    ui.info = el('div', { class: 'mt-2' });
    ui.comparisonList = el('div', { class: 'spbb-list' });
    ui.columnList = el('div', { class: 'spbb-row' });
    ui.labels = el('input', { type: 'text', class: 'form-control form-control-sm', oninput: renderOutput });
    const optionCheckbox = (key) =>
      el('input', {
        type: 'checkbox',
        checked: state[key],
        class: 'form-check-input me-1',
        onchange: (event) => {
          state[key] = event.target.checked;
          renderOutput();
        },
      });
    ui.wrap = optionCheckbox('wrapImages');
    ui.strip = optionCheckbox('stripFrameType');
    ui.output = el('textarea', { readOnly: true, rows: 7, class: 'form-control', spellcheck: false });
    ui.hint = el('span', { class: 'spbb-muted' });
    ui.copied = el('span', { class: 'text-success' });

    const formatRadio = (value, text) =>
      el('label', {},
        el('input', {
          type: 'radio',
          name: 'spbb-format',
          value,
          checked: state.format === value,
          class: 'form-check-input me-1',
          onchange: () => {
            state.format = value;
            renderOutput();
          },
        }),
        text,
      );

    ui.panel = el('div', { id: 'spbb-panel', hidden: true },
      el('div', { class: 'spbb-row' },
        el('strong', { style: 'flex: 1 1 auto' }, 'BBCode export'),
        el('button', { type: 'button', class: 'btn-close btn-close-white', title: 'Close', onclick: togglePanel }, ''),
      ),
      el('div', { class: 'spbb-row mt-2' }, 'Collection:', ui.source, ui.load),
      ui.error,
      ui.info,
      el('h6', {}, 'Comparisons ',
        el('button', { type: 'button', class: 'btn btn-sm btn-outline-light ms-2', onclick: () => setAllComparisons(true) }, 'All'),
        el('button', { type: 'button', class: 'btn btn-sm btn-outline-light ms-1', onclick: () => setAllComparisons(false) }, 'None'),
      ),
      ui.comparisonList,
      el('h6', {}, 'Images in each comparison'),
      ui.columnList,
      el('h6', {}, 'Format'),
      el('div', { class: 'spbb-row' },
        formatRadio('comparison', '[comparison] block, one comparison per line'),
        formatRadio('img', '[img] tag per image'),
      ),
      el('div', { class: 'mt-1' }, el('label', {}, ui.wrap, 'Wrap each image in [img] tags')),
      el('div', { class: 'spbb-row mt-2' }, 'Header names:', ui.labels),
      el('div', { class: 'mt-1' }, el('label', {}, ui.strip, 'Remove frame type such as "(B)" from header names')),
      el('h6', {}, 'BBCode ',
        el('button', { type: 'button', class: 'btn btn-sm btn-success ms-2', onclick: copyOutput }, 'Copy to clipboard'),
        ' ',
        ui.copied,
        ui.hint,
      ),
      ui.output,
    );

    // Keep typing in the panel from triggering slow.pics' keyboard shortcuts (arrows, number keys).
    for (const type of ['keydown', 'keyup', 'keypress']) {
      ui.panel.addEventListener(type, (event) => {
        if (type === 'keydown' && event.key === 'Escape') togglePanel();
        event.stopPropagation();
      });
    }
    return ui.panel;
  }

  function togglePanel(event) {
    if (event) event.preventDefault();
    ui.panel.hidden = !ui.panel.hidden;
  }

  function addButton() {
    const button = el('a', { href: '#', id: 'spbb-button', class: 'btn btn-warning me-2', style: 'white-space: nowrap', onclick: togglePanel },
      el('i', { class: 'fa fa-code' }), ' BBCode');
    const sliderLink = document.getElementById('slider-link');
    if (sliderLink) {
      sliderLink.after(button);
    } else {
      button.id = 'spbb-floating-button';
      document.body.append(button);
    }
  }

  let collection;
  try {
    collection = currentPageCollection();
  } catch {
    return; // Not a comparison page (e.g. an upload form), so stay out of the way.
  }
  document.head.append(el('style', { textContent: CSS }));
  document.body.append(buildPanel());
  addButton();
  setCollection(collection);
})();
