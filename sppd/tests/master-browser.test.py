from pathlib import Path
import json
import mimetypes
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
base='https://pbjkotabogor.github.io/ORBITA/sppd/'
admin={'id':'A','name':'Admin Uji','grants':[{'opd':'*','roles':['SUPERADMIN','ADMIN_SHS']}]}
master={'id':'P1','name':'Pegawai Uji','nip':'123456789012345678','rank':'III/a','position':'PPTK'}
requests=[]

def route(r):
    url=r.request.url
    if url.startswith('https://script.google.com/'):
        d=json.loads(r.request.post_data); requests.append(d)
        action=d['action']; opd=d.get('opd')
        boot={'revision':'R1','trips':[],'masters':{'employees':[master],'office':None,'number':[]},'rates':[]}
        data={'init':{'user':admin,'offices':[],'selected':'','boot':None},'boot':boot,'directory':{'opds':['BAGIAN PBJ','DINAS KESEHATAN'],'users':[{'id':'B1','name':'Bendahara Uji','username':'bend','opd':'BAGIAN PBJ','role':'BENDAHARA'}],'access':[]},'accessList':[],'pulse':{'revision':'R1'}}.get(action,True)
        return r.fulfill(json={'ok':True,'data':data},headers={'access-control-allow-origin':'*'})
    if url.startswith(base):
        f=root/(url[len(base):].split('?')[0] or 'index.html')
        if f.is_file():return r.fulfill(body=f.read_bytes(),content_type=mimetypes.guess_type(f)[0] or 'application/octet-stream')
    return r.fulfill(status=404,body='Not found')

with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    c=b.new_context(viewport={'width':1440,'height':900})
    page=c.new_page(); errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
    import re
    html=(root/'index.html').read_text()
    html=re.sub(r'<script[^>]*src=[^>]*></script>','',html)
    html=re.sub(r'<link[^>]*>','',html)
    html=html.replace('</head>','<style>'+(root/'assets/style.css').read_text()+'</style></head>')
    boot={'revision':'R1','trips':[],'masters':{'employees':[master],'office':None,'number':[]},'rates':[]}
    fixtures={'init':{'user':admin,'offices':[],'selected':'','boot':None},'boot':boot,'directory':{'opds':['BAGIAN PBJ','DINAS KESEHATAN'],'users':[{'id':'B1','name':'Bendahara Uji','username':'bend','opd':'BAGIAN PBJ','role':'BENDAHARA'}],'access':[]},'accessList':[],'pulse':{'revision':'R1'}}
    page.set_content(html)
    page.evaluate("""fixtures=>{const store=new Map();Object.defineProperty(window,'sessionStorage',{value:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}});window.SPPD_CONFIG={apiUrl:'mock',pollMs:15000,portalUrl:'../profil-pbj/'};window.SPPD_SESSION={token:()=> 'mock',restore:()=> 'mock',classify:()=> 'connection',clear:()=>{}};window.mockRequests=[];window.fetch=async(u,o)=>{const d=JSON.parse(o.body);window.mockRequests.push(d);return {json:async()=>({ok:true,data:fixtures[d.action]??true})}};}""",fixtures)
    page.add_script_tag(content=(root/'assets/app.js').read_text())
    page.get_by_role('button',name='Data OPD & pegawai').click(timeout=8000)
    page.locator('#f-masterOpd').wait_for(timeout=8000)
    page.locator('[data-search-select="f-masterOpd"]').fill('kesehatan')
    assert page.locator('#f-masterOpd option[value="BAGIAN PBJ"]').get_attribute('hidden') is not None
    page.locator('[data-search-select="f-masterOpd"]').fill('PBJ')
    page.locator('#f-masterOpd').select_option('BAGIAN PBJ')
    page.get_by_role('button',name='Buka data OPD').click()
    page.locator('#f-pptkEmployee').wait_for(timeout=8000)
    assert page.locator('#officeForm #f-name').input_value()=='BAGIAN PBJ'
    page.locator('#f-pptkEmployee').select_option('P1')
    assert page.locator('#f-pptkName').input_value()=='Pegawai Uji'
    assert page.locator('#f-pptkNip').input_value()==master['nip']
    page.locator('#f-bendUserId').select_option('B1')
    assert page.locator('#f-bendName').input_value()=='Bendahara Uji'
    page.screenshot(path='/tmp/sppd-master-preview.png',full_page=True)
    page.get_by_role('button',name='Hak akses').click()
    page.locator('#f-userId').select_option('B1')
    assert page.locator('#f-opd').input_value()=='BAGIAN PBJ'
    assert page.locator('input[name=roles][value=BENDAHARA]').is_checked()
    assert page.evaluate("window.mockRequests.filter(x=>x.action==='directory').length")==1
    assert not errors,errors
    b.close()
print('PASS: browser master OPD, pencarian, autofill pejabat, tautan Bendahara, role dan OPD otomatis, satu permintaan direktori')
