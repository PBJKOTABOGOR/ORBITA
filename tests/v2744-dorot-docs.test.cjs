const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'assets/js/orbita-docs-timeline.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/docs-timeline.css'),'utf8');

test('documentation uses a dedicated Dorot-style timeline without changing core modules',()=>{
  assert.match(html,/docs-timeline-experience/);
  assert.match(html,/docsTimelineViewport/);
  assert.match(html,/docsZoomOut/);
  assert.match(html,/docsZoomIn/);
  assert.match(html,/docsZoomFit/);
  assert.match(html,/docsEventPanel/);
  assert.match(html,/orbita-docs-timeline\.js\?v=27\.(?:4[6-9]|[5-9]\d)/);
  assert.match(html,/profile\.js\?v=27\.(?:38|58|59)/);
  assert.match(html,/site-content\.js\?v=27\.34/);
});

test('timeline supports pan, zoom, event click detail, and normal browser cursor',()=>{
  assert.match(js,/queueZoom\(zoomTarget\*1\.28/);
  assert.match(js,/zoom=clamp\(next,\.75,4\.5\)/);
  assert.match(js,/pointerdown/);
  assert.match(js,/data-doc-event/);
  assert.match(js,/renderDetail\(Number\(event\.dataset\.docEvent\)\)/);
  assert.match(css,/docs-timeline-viewport,.docs-timeline-viewport\.dragging\{cursor:default!important\}/);
  assert.doesNotMatch(css,/cursor:\s*none/i);
  assert.doesNotMatch(html,/orbita-pointer/);
});

test('Dorot-like entry animation and centered event detail are present',()=>{
  assert.match(css,/docsLaneEnter/);
  assert.match(css,/docsAxisGrow/);
  assert.match(css,/docsEventPop/);
  assert.match(css,/\.docs-event-card\{/);
  assert.match(css,/border-radius:260px/);
  assert.match(css,/\.docs-event-panel\.open/);
  assert.match(js,/docs-intro-running/);
  assert.match(js,/--detail-a/);
  assert.match(js,/--detail-b/);
});
