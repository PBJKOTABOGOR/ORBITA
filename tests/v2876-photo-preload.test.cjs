const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const script = fs.readFileSync(path.join(root,'assets/js/boot-loader.js'),'utf8');
const site = fs.readFileSync(path.join(root,'assets/js/site-content.js'),'utf8');
const markup = fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');

function harness(){
  const events = {};
  const timers = new Map(); let timerId=0; let now=0;
  const images=[]; const removed=[]; let loaderGone=false; const classes=[];
  const counter={textContent:'00'}, status={textContent:''};
  const loader={querySelector(selector){return selector==='[data-loader-count]'?counter:status;},classList:{add(v){classes.push(v)}},remove(){loaderGone=true}};
  const document={getElementById(id){return id==='siteLoader'?loader:null},addEventListener(t,fn){events[t]=fn},body:{classList:{remove(x){removed.push(x)}}}};
  class FakeImage{
    constructor(){images.push(this);this.complete=false;this.naturalWidth=0}
    set src(v){this._src=v}
    get src(){return this._src}
  }
  const FakeDate={now:()=>now};
  const setTimeout=(fn,delay)=>{const id=++timerId;timers.set(id,{at:now+delay,fn});return id};
  const clearTimeout=id=>timers.delete(id);
  const window={};
  vm.runInNewContext(script,{document,window,Image:FakeImage,Date:FakeDate,setTimeout,clearTimeout,console});
  function tick(ms){const until=now+ms;let count=0;while(true){const jobs=[...timers].filter(([,v])=>v.at<=until).sort((a,b)=>a[1].at-b[1].at);if(!jobs.length)break;const [id,v]=jobs[0];timers.delete(id);now=v.at;v.fn();if(++count>100)throw new Error('timer loop')}now=until}
  async function flush(){for(let i=0;i<30;i++)await Promise.resolve()}
  return {images,events,loader,counter,status,classes,removed,tick,flush,get gone(){return loaderGone}};
}

test('foto Pimpinan + Tim mulai dimuat pada splash, bukan menunggu scroll',async()=>{
  const h=harness();
  h.events['trax:content-ready']({detail:{source:'network',content:{leaders:{kabag:{photo:'https://img.test/a.jpg'},lpse:{photo:'https://img.test/b.jpg'}}},siteContent:{team:[{photo:'https://img.test/c.jpg'},{photo:'https://img.test/a.jpg'}]}}});
  assert.equal(h.images.length,3,'foto yang sama cukup diprefetch sekali');
  assert.equal(h.gone,false);
  h.images.forEach(img=>img.onload());await h.flush();
  h.tick(325);assert.ok(h.classes.includes('handoff'));assert.ok(h.removed.includes('site-booting'));
  h.tick(850);assert.equal(h.gone,true);
});
test('gagal memuat foto tidak membuat layar pembuka macet',async()=>{
  const h=harness();h.events['trax:content-ready']({detail:{source:'network',content:{leaders:{kabag:{photo:'https://img.test/missing'}}},siteContent:{team:[]}}});
  assert.equal(h.images.length,1);h.images[0].onerror();await h.flush();h.tick(350);assert.ok(h.classes.includes('handoff'));
});
test('timeout membuka website meski CMS tidak merespons',()=>{
  const h=harness();h.tick(8500);assert.ok(h.classes.includes('handoff'));h.tick(850);assert.equal(h.gone,true);
});
test('konten lokal kosong tidak melepas splash sebelum foto dari API siap',()=>{
  const h=harness();h.events['trax:content-ready']({detail:{source:'bundled',content:{leaders:{}},siteContent:{team:[]}}});
  h.tick(600);assert.equal(h.gone,false);assert.ok(!h.classes.includes('handoff'));
});
test('perubahan tidak mengaktifkan permintaan API baru, foto tim dimuat eager',()=>{
  assert.match(site,/loading="eager" fetchpriority="low" decoding="async"/);
  assert.match(markup,/data-loader-photo-status/);
  assert.match(markup,/boot-loader\.js\?v=28\.76/);
  assert.ok(!/fetch\(/.test(script));
});
