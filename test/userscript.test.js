// End-to-end tests: serve a saved slow.pics page locally, inject the userscript and drive it with Playwright.
const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const SCRIPT = path.join(__dirname, '..', 'slowpics-bbcode.user.js');
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'comparison.html'), 'utf8');
const FIXTURE_COLLECTION = JSON.parse(/var collection = (.*);/.exec(FIXTURE)[1]);

const OTHER_COLLECTION = {
  key: 'OtherKey1',
  name: 'Other <b>collection</b>',
  comparisons: [
    {
      key: 'CmpOne01',
      name: 'Frame 100',
      images: [
        { name: '(I) Source', publicFileName: 'UTc3iAI1.png', path: 'UTc3iAI1.png' },
        { name: '(I) <img src=x onerror="window.pwned=1">', publicFileName: 'OaZd0ndk.png', path: 'OaZd0ndk.png' },
      ],
    },
    {
      key: 'CmpTwo02',
      name: 'Frame 200',
      images: [
        { name: '(P) Source', publicFileName: 'EbVure2F.png' },
        { name: '(P) Encode', publicFileName: 'MuGsudEN.png' },
      ],
    },
  ],
};

function withCollection(collection) {
  const json = JSON.stringify(collection).replace(/\//g, '\\/');
  return FIXTURE.replace(/var collection = .*;/, () => `var collection = ${json};`);
}

const PAGES = {
  '/c/xnkAHiN5': [200, FIXTURE],
  '/c/V9aGy6PA': [200, FIXTURE],
  '/c/OtherKey1': [200, withCollection(OTHER_COLLECTION)],
  '/c/Blocked1': [403, '<html><title>Attention Required! | Cloudflare</title></html>'],
  '/c/NoData01': [200, '<html><body><a id="slider-link" href="#">Slider</a></body></html>'],
};

let server;
let origin;
let browser;
let context;
let page;
let pageErrors;

before(async () => {
  server = http.createServer((req, res) => {
    const [status, body] = PAGES[req.url] || [404, 'not found'];
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  server.close();
});

beforeEach(async () => {
  context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  // Keep the tests offline: the saved page references images on i.slow.pics.
  await context.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
  page = await context.newPage();
  pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
});

afterEach(async () => {
  await context.close();
  assert.deepEqual(pageErrors, []);
});

async function openPage(pagePath = '/c/xnkAHiN5') {
  await page.goto(origin + pagePath);
  await page.addScriptTag({ path: SCRIPT });
}

async function openPanel() {
  await openPage();
  await page.click('#spbb-button');
  await page.waitForSelector('#spbb-panel', { state: 'visible' });
}

const output = () => page.inputValue('#spbb-panel textarea');
const labelFor = (text) => page.locator('#spbb-panel label', { hasText: text });
const urlsOf = (comp) => comp.images.map((img) => `https://i.slow.pics/${img.path}`).join(', ');

test('adds a BBCode button next to the slider link, with the panel closed', async () => {
  await openPage();
  assert.equal(await page.evaluate(() => document.getElementById('slider-link').nextElementSibling.id), 'spbb-button');
  assert.equal(await page.isVisible('#spbb-panel'), false);
});

test('defaults to a [comparison] block with every comparison, one per line', async () => {
  await openPanel();
  const lines = (await output()).split('\n');
  assert.equal(lines[0], '[comparison=Remux, RandomBytes, W4NK3R]');
  assert.equal(
    lines[1],
    'https://i.slow.pics/p/Sk1ZW5EQ.webp, https://i.slow.pics/p/pjI8r1C3.webp, https://i.slow.pics/p/OanuEXyE.webp',
  );
  assert.deepEqual(lines.slice(1, -1), FIXTURE_COLLECTION.comparisons.map(urlsOf));
  assert.equal(lines.at(-1), '[/comparison]');
});

test('lists the comparisons and images of the collection', async () => {
  await openPanel();
  assert.match(await page.textContent('#spbb-panel'), /RB Alien DC \(10 comparisons, 3 images each\)/);
  assert.equal(await page.inputValue('#spbb-panel input[type=text]'), `${origin}/c/V9aGy6PA`);

  const comparisons = page.locator('#spbb-panel .spbb-list label');
  assert.equal(await comparisons.count(), 10);
  assert.equal((await comparisons.nth(0).textContent()).trim(), '1. 0:02:40.201 / 3841 ↗');
  assert.equal(await comparisons.nth(9).locator('a').getAttribute('href'), `${origin}/c/WJDnEWui`);
  assert.deepEqual(await page.locator('#spbb-panel .spbb-row label').allTextContents(), [
    '(B) Remux',
    '(B) RandomBytes',
    '(B) W4NK3R',
    '[comparison] block, one comparison per line',
    '[img] tag per image',
  ]);
});

test('only includes the chosen comparisons and images', async () => {
  await openPanel();
  await page.click('#spbb-panel button:text-is("None")');
  assert.equal(await output(), '');
  assert.match(await page.textContent('#spbb-panel'), /Select at least one comparison and one image/);

  await labelFor('2. 0:05:37.378').locator('input').check();
  await labelFor('3. 0:07:07.718').locator('input').check();
  await labelFor('(B) W4NK3R').locator('input').uncheck();
  const [, second, third] = FIXTURE_COLLECTION.comparisons;
  assert.equal(
    await output(),
    [
      '[comparison=Remux, RandomBytes]',
      `https://i.slow.pics/${second.images[0].path}, https://i.slow.pics/${second.images[1].path}`,
      `https://i.slow.pics/${third.images[0].path}, https://i.slow.pics/${third.images[1].path}`,
      '[/comparison]',
    ].join('\n'),
  );

  await page.click('#spbb-panel button:text-is("All")');
  assert.equal((await output()).split('\n').length, 12);
});

test('supports [img] tags, custom header names and keeping the frame type', async () => {
  await openPanel();
  await labelFor('[img] tag per image').locator('input').check();
  const lines = (await output()).split('\n');
  assert.equal(lines.length, 30);
  assert.equal(lines[0], '[img]https://i.slow.pics/p/Sk1ZW5EQ.webp[/img]');
  assert.equal(lines[1], '[img]https://i.slow.pics/p/pjI8r1C3.webp[/img]');
  assert.equal(await page.locator('#spbb-panel input[type=text]').nth(1).isDisabled(), true);

  await labelFor('[comparison] block').locator('input').check();
  await labelFor('Remove frame type').locator('input').uncheck();
  assert.match(await output(), /^\[comparison=\(B\) Remux, \(B\) RandomBytes, \(B\) W4NK3R\]\n/);

  await page.fill('#spbb-panel input[type=text] >> nth=1', 'BD, Encode ,Other');
  assert.match(await output(), /^\[comparison=BD, Encode, Other\]\n/);
});

test('loads another collection from its URL or key', async () => {
  await openPanel();
  await page.fill('#spbb-panel input[type=text] >> nth=0', 'https://slow.pics/c/OtherKey1');
  await page.click('#spbb-panel button:text-is("Load")');
  await page.waitForFunction(() => document.querySelectorAll('#spbb-panel .spbb-list label').length === 2);

  assert.match(await page.textContent('#spbb-panel'), /Other <b>collection<\/b> \(2 comparisons, 2 images each\)/);
  assert.equal(
    await output(),
    [
      '[comparison=Source, <img src=x onerror="window.pwned=1">]',
      'https://i.slow.pics/UTc3iAI1.png, https://i.slow.pics/OaZd0ndk.png',
      'https://i.slow.pics/EbVure2F.png, https://i.slow.pics/MuGsudEN.png',
      '[/comparison]',
    ].join('\n'),
  );
  assert.equal(await page.evaluate(() => window.pwned), undefined);

  await page.fill('#spbb-panel input[type=text] >> nth=0', 'xnkAHiN5');
  await page.press('#spbb-panel input[type=text] >> nth=0', 'Enter');
  await page.waitForFunction(() => document.querySelectorAll('#spbb-panel .spbb-list label').length === 10);
});

test('reports bad input and failed loads without losing the current collection', async () => {
  await openPanel();
  const before = await output();
  const error = page.locator('#spbb-panel .spbb-error');
  const source = '#spbb-panel input[type=text] >> nth=0';

  await page.fill(source, 'https://example.com/c/abc');
  await page.click('#spbb-panel button:text-is("Load")');
  assert.match(await error.textContent(), /is not a slow\.pics URL or key/);

  await page.fill(source, 'Blocked1');
  await page.click('#spbb-panel button:text-is("Load")');
  await page.waitForFunction(() => /HTTP 403/.test(document.querySelector('#spbb-panel .spbb-error').textContent));

  await page.fill(source, 'NoData01');
  await page.click('#spbb-panel button:text-is("Load")');
  await page.waitForFunction(() => /No comparison data/.test(document.querySelector('#spbb-panel .spbb-error').textContent));

  assert.equal(await output(), before);
});

test('copies the BBCode to the clipboard', async () => {
  await openPanel();
  await page.click('#spbb-panel button:text-is("Copy to clipboard")');
  await page.waitForSelector('#spbb-panel :text-is("Copied!")');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await output());
});

test('keeps keystrokes in the panel away from the page, and Escape closes it', async () => {
  await openPanel();
  await page.evaluate(() => {
    window.pageKeys = 0;
    document.addEventListener('keydown', () => window.pageKeys++);
  });
  await page.focus('#spbb-panel input[type=text] >> nth=1');
  await page.keyboard.type('1 2 ArrowRight');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => window.pageKeys), 0);

  await page.keyboard.press('Escape');
  assert.equal(await page.isVisible('#spbb-panel'), false);
});

test('stays out of the way on pages without comparison data', async () => {
  await openPage('/c/NoData01');
  assert.equal(await page.locator('#spbb-button, #spbb-floating-button, #spbb-panel').count(), 0);
});
