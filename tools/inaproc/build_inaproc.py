#!/usr/bin/env python3
"""Build small static category + field snapshots from INAPROC GraphQL export.
Run: python build_inaproc.py /path/to/INAPROC_MODAL_*_LENGKAP.json
No authentication tokens, network access, or Sheets imports are involved.
"""
import json,csv,sys,pathlib,collections
ROOT=pathlib.Path(__file__).resolve().parents[2]
src=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'INAPROC_MODAL_LENGKAP.json'
assert src.exists(), f'JSON tidak ditemukan: {src}'
data=json.loads(src.read_text('utf-8-sig'))
assert data['summary']['metadata']['completedLeafCategories']==len(data['details'])
meta_path=ROOT/'database/import-master/PBJ_KATEGORI_META.csv'
previous={x['category_id']:x['kelompok'] for x in csv.DictReader(meta_path.open(encoding='utf-8-sig',newline=''))}
GROUPS=['Barang','Barang Material Konstruksi','Alat Kesehatan','Obat','Digital','Jasa','Jasa Telekomunikasi']
def kelompok(c):
    key=c['id']
    if key in previous:return previous[key]
    typ,sub=c['productType'],c.get('productSubType')
    return ('Konstruksi' if (typ=='SERVICE' and sub=='CONSTRUCTION') else
            'Barang Material Konstruksi' if typ=='PHYSICAL' and sub=='CONSTRUCTION' else
            'Alat Kesehatan' if typ=='PHYSICAL' and sub=='MEDICAL_DEVICES' else
            'Obat' if typ=='PHYSICAL' and sub=='PHARMACY' else
            'Digital' if typ=='DIGITAL' else 'Jasa Telekomunikasi' if sub=='TELCO' else
            'Jasa' if typ=='SERVICE' else 'Barang')
def shard_for(s):
    h=s[:2].lower();return h[0]+str(int(h[1],16)%4)
catrows=[];construction=[];shards=collections.defaultdict(dict)
for record in data['details']:
    c=record['category']; x=record['detail'];p=c['path'].split(' > ')
    if not (x and x.get('__typename')=='ProductCategory'):raise ValueError(c['id']+' missing ProductCategory')
    row={'id':c['id'],'level1':p[0] if len(p)>0 else '', 'level2':p[1] if len(p)>1 else '', 'level3':p[2] if len(p)>2 else c['name'],'path':c['path'],'productType':c['productType'],'productSubType':c.get('productSubType') or ''}
    group=kelompok(c)
    if group=='Konstruksi': construction.append(row)
    else:catrows.append({'category':group,**row})
    def fld(a):
        return [[f.get('id') or '',f.get('name') or '',f.get('type') or 'TEXT',f.get('defaultValue') or '',f.get('additionalInfo') or ''] for f in (a or [])]
    kbli=x.get('kbliCodes') or []
    shards[shard_for(c['id'])][c['id']]={'p':fld(x.get('primaryInfo')),'a':fld(x.get('additionalInfo')),'k':[[str(k.get('code') or ''),str(k.get('version') or '')] for k in kbli if k.get('code')]}
catrows.sort(key=lambda x:(GROUPS.index(x['category']) if x['category'] in GROUPS else 99,x['path'].casefold()))
construction.sort(key=lambda x:x['path'].casefold())
master={'version':data['summary']['timestamp'],'groups':GROUPS,'rows':catrows,'constructionRows':construction,'source':'INAPROC GraphQL snapshot'}
base=ROOT/'assets/data/inaproc-master';base.mkdir(parents=True,exist_ok=True)
(base/'categories.json').write_text(json.dumps(master,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
for key,records in shards.items():
    (base/(key+'.json')).write_text(json.dumps(records,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
assert len(shards)==64 and len(catrows)+len(construction)==2870
# Cache-bust the new snapshot when maintained with the next downloaded JSON.
version=''.join(ch for ch in str(data['summary']['timestamp']) if ch.isalnum())[:15]
loader=ROOT/'assets/js/category-field-store.js'
if loader.exists():
    import re
    js=loader.read_text(encoding='utf-8')
    js=re.sub(r"const version='[A-Za-z0-9]+';","const version='"+version+"';",js)
    loader.write_text(js,encoding='utf-8')
    profile=ROOT/'profil-pbj/index.html'
    html=profile.read_text(encoding='utf-8')
    html=re.sub(r'category-field-store\.js\?v=[A-Za-z0-9.]+','category-field-store.js?v='+version,html)
    profile.write_text(html,encoding='utf-8')
    sw=ROOT/'sw.js'
    w=sw.read_text(encoding='utf-8')
    w=re.sub(r'orbita-pbj-shell-v28-12-inaproc-fields(?:-[A-Za-z0-9]+)?', 'orbita-pbj-shell-v28-12-inaproc-fields-'+version,w)
    w=re.sub(r'category-field-store\.js\?v=[A-Za-z0-9.]+','category-field-store.js?v='+version,w)
    sw.write_text(w,encoding='utf-8')
print('CATEGORY',len(catrows),'CONSTRUCTION',len(construction),'SHARDS',len(shards),'FIELDS',sum(len(x['p'])+len(x['a']) for sh in shards.values() for x in sh.values()))
print('size(kB)',round(sum(f.stat().st_size for f in base.glob('*.json'))/1024),'largest-shard(KB)',round(max(f.stat().st_size for f in base.glob('*.json') if f.name!='categories.json')/1024))
