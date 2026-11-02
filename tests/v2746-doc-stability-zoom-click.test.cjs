const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const timeline=fs.readFileSync(path.join(root,'assets/js/orbita-docs-timeline.js'),'utf8');
const content=fs.readFileSync(path.join(root,'assets/js/site-content.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/docs-timeline.css'),'utf8');

test('legacy documentation renderer is disabled before site-content loads',()=>{
  assert.match(html,/window\.ORBITA_DOCS_TIMELINE_MODE=true/);
  assert.match(content,/if\(window\.ORBITA_DOCS_TIMELINE_MODE===true\)return/);
  assert.match(content,/if\(window\.ORBITA_DOCS_TIMELINE_MODE!==true\)\$\('#docsArchive'\)/);
});

test('open observer only activates once per closed-to-open transition',()=>{
  assert.match(timeline,/let wasOpen=docsModal\.classList\.contains\('open'\)/);
  assert.match(timeline,/if\(isOpen&&!wasOpen\)requestAnimationFrame\(activate\)/);
  assert.doesNotMatch(timeline,/new MutationObserver\(\(\)=>\{if\(docsModal\.classList\.contains\('open'\)\)requestAnimationFrame\(activate\)/);
});

test('timeline click is not captured by drag and zoom controls are explicitly bound',()=>{
  assert.match(timeline,/closest\('button,a,input,select,textarea,iframe,\[data-doc-event\],\[data-doc-cluster\]'\)/);
  assert.match(timeline,/renderDetail\(Number\(event\.dataset\.docEvent\)\)/);
  assert.match(timeline,/bindZoom\('#docsZoomIn',\(\)=>queueZoom\(zoomTarget\*1\.28\)\)/);
  assert.match(timeline,/bindZoom\('#docsZoomOut',\(\)=>queueZoom\(zoomTarget\/1\.28\)\)/);
  assert.match(timeline,/dblclick/);
  assert.match(css,/cursor:default!important/);
  assert.match(css,/touch-action:manipulation/);
});
