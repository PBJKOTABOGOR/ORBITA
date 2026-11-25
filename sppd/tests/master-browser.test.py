from pathlib import Path
import re
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
admin = {'id':'A','name':'Admin Uji','grants':[{'opd':'*','roles':['SUPERADMIN','ADMIN_SHS']}]}
master = {'id':'P1','name':'Pegawai Uji','nip':'123456789012345678','rank':'III/a','position':'Staf'}
key = '2026|4.01.03.2.03.0001|5.1.02.04.001.00001|1.1'
account = {'key':key,'year':'2026','sub':'4.01.03.2.03.0001','activity':'Pengelolaan Pengadaan Barang dan Jasa','account':'5.1.02.04.001.00001','fundName':'PAD','pagu':288944000,'confirmed':True,'opening':10000000,'used':1160000,'draft':0,'remaining':277784000}
boot = {'revision':'R1','budgetVersion':'B1','budget':{'accounts':[account],'unmatched':0},'trips':[], 'masters':{'employees':[master],'office':{'name':'SEKRETARIAT DAERAH','unit':'Bagian Pengadaan Barang dan Jasa','kpaName':'KPA Uji','pptkName':'PPTK Uji','bendName':'Bendahara Uji'},'number':[]},'rates':[{'key':'R','year':'2026','validFrom':'2026-01-01','name':'Uang Harian Perjalanan Dinas Luar Daerah DKI Jakarta','spec':'Luar Kota','rate':530000,'source':'SBU Uji'}]}
fixtures = {'init':{'user':admin,'offices':['PBJ'],'selected':'PBJ','boot':boot},'boot':boot,'pulse':{'revision':'R1','budgetVersion':'B1'}}
html = (root/'index.html').read_text()
html = re.sub(r'<script[^>]*src=[^>]*></script>','',html)
html = re.sub(r'<link[^>]*>','',html)
html = html.replace('</head>','<style>'+(root/'assets/style.css').read_text()+'</style></head>')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.set_content(html)
    page.evaluate('''fixtures=>{const store=new Map();Object.defineProperty(window,'sessionStorage',{value:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}});window.SPPD_CONFIG={apiUrl:'mock',pollMs:15000,portalUrl:'../profil-pbj/'};window.SPPD_SESSION={token:()=> 'mock',restore:()=> 'mock',classify:()=> 'connection',clear:()=>{}};window.mockRequests=[];window.fetch=async(u,o)=>{const d=JSON.parse(o.body);window.mockRequests.push(d);return {json:async()=>({ok:true,data:fixtures[d.action]??true})}};}''',fixtures)
    page.locator('body').evaluate("el=>{window.Intl.DateTimeFormat=function(){return {format:()=> '2026-11-25'}}}")
    page.add_script_tag(content=(root/'assets/app.js').read_text())
    page.get_by_role('heading',name='Perjalanan Dinas',exact=True).wait_for(timeout=8000)
    assert page.get_by_text('Rp 277.784.000',exact=True).count() >= 1
    assert page.locator('#nav').get_by_text('Ruang bendahara').count()==0
    page.locator('#hamb').click()
    assert page.locator('body').evaluate("el=>el.classList.contains('sidebar-hidden')")
    page.locator('#hamb').click()
    page.locator('#nav').get_by_text('Pegawai & pejabat').click()
    assert page.locator('#f-kpaName').input_value()=='KPA Uji'
    assert page.locator('#f-bendUserId').count()==0
    assert page.locator('#f-masterOpd').count()==0
    page.locator('#nav').get_by_text('Buat SPPD').click()
    page.locator('#f-budgetKey').select_option(key)
    page.locator('#f-province').select_option('DKI Jakarta')
    page.get_by_role('button',name='+ Tambah pegawai').click()
    page.locator('#f-employee-0').select_option('P1')
    assert 'Rp 530.000' in page.locator('#grandTotal').inner_text()
    assert 'Rp 277.254.000' in page.locator('#budgetHint').inner_text()
    assert page.locator('#draftLetter').count()==1
    assert page.evaluate("window.mockRequests.filter(x=>x.action==='directory').length")==0
    assert not errors,errors
    browser.close()
print('PASS: browser dashboard PBJ, saldo, sidebar, pejabat manual, dropdown rekening, hitung lokal, surat perintah opsional.')
