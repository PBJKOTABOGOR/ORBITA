const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(new URL('../'+p,'file://'+__filename),'utf8');
const timeline=read('assets/js/orbita-docs-timeline.js');
const css=read('assets/css/docs-timeline.css');
const html=read('profil-pbj/index.html');
const sw=read('sw.js');

test('timeline exposes title on hover without opening detail',()=>{
  assert.match(timeline,/data-doc-title=/);
  assert.match(css,/\.docs-tl-event:hover::before/);
  assert.match(css,/content:attr\(data-doc-title\)/);
});

test('agenda uses calendar marker and has no photo media detail',()=>{
  assert.match(timeline,/docs-tl-agenda-mark/);
  assert.match(timeline,/if\(isAgenda\)\{\s*host\.hidden=true;host\.innerHTML=''/);
  assert.match(css,/#docsEventPanel\[data-detail-kind="agenda"\] \.docs-event-media\{display:none!important\}/);
});

test('surat uses Drive first-page thumbnail instead of logo photo bubbles',()=>{
  assert.match(timeline,/drive\.google\.com\/thumbnail\?id=/);
  assert.match(timeline,/docs-tl-doc-thumb/);
  assert.match(timeline,/docs-surat-preview/);
  assert.match(timeline,/fileId:x\.fileId/);
  assert.match(css,/#docsEventPanel\[data-detail-kind="surat"\] \.docs-detail-bubbles\{display:none!important\}/);
});

test('surat thumbnails stay light on timeline',()=>{
  assert.match(timeline,/loading="lazy" decoding="async" fetchpriority="low"/);
  assert.match(timeline,/loading="eager" decoding="async" fetchpriority="high"/);
});


test('v27.54 assets bust old browser and service-worker cache',()=>{
  assert.match(html,/docs-timeline\.css\?v=27\.(?:54|55|56)/);
  assert.match(html,/orbita-docs-timeline\.js\?v=27\.(?:54|55|56)/);
  assert.match(sw,/orbita-pbj-shell-v27-(?:54-docs-hover-surat-preview|55-surat-action-only|56-edukasi-doc|57-constellation-bg|58-constellation-interactive|59-atomic-room)/);
  assert.match(sw,/docs-timeline\.css\?v=27\.(?:54|55|56)/);
  assert.match(sw,/orbita-docs-timeline\.js\?v=27\.(?:54|55|56)/);
});
