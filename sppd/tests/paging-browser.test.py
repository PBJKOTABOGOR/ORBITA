from pathlib import Path
import re
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
admin = {'id':'A','name':'Admin Uji','grants':[{'opd':'*','roles':['SUPERADMIN','ADMIN_SHS']}]}
master = {'id':'P1','name':'Pegawai Uji','nip':'123456789012345678','rank':'III/a','position':'Staf'}
key = '2026|4.01.03.2.03.0001|5.1.02.04.001.00001|1.1'
account = {'key':key,'year':'2026','sub':'4.01.03.2.03.0001','activity':'Pengelolaan Pengadaan Barang dan Jasa','account':'5.1.02.04.001.00001','fundName':'PAD','pagu':288944000,'confirmed':True,'opening':10000000,'used':1160000,'draft':0,'remaining':277784000}
boot = {'revision':'R1','budgetVersion':'B1','budget':{'accounts':[account],'unmatched':0},'trips':[], 'masters':{'employees':[master],'office':None,'number':[]},'rates':[{'key':'R','year':'2026','validFrom':'2026-01-01','name':'Uang Harian Perjalanan Dinas Luar Daerah DKI Jakarta','spec':'Luar Kota','rate':530000,'source':'SBU Uji'}]}
fixtures = {'init':{'user':admin,'offices':['PBJ'],'selected':'PBJ','boot':boot},'boot':boot,'pulse':{'revision':'R1','budgetVersion':'B1'},'rates':[],'rateCatalog':{'year':'2026','validFrom':'','versions':[],'rows':[]}}
html = (root/'index.html').read_text()
html = re.sub(r'<script[^>]*src=[^>]*></script>','',html)
html = re.sub(r'<link[^>]*>','',html)
html = html.replace('</head>','<style>'+(root/'assets/style.css').read_text()+'</style></head>')
boot['masters']['employees'] = [dict(master,id=f'P{i}',name=f'Pegawai {i:03}') for i in range(1,126)]
boot['trips'] = [dict(id=f'T{i}',purpose=f'Kegiatan {i:03}',destination='Jakarta',start='2026-11-25',end='2026-11-25',status='DRAFT' if i%2 else 'SIAP_CETAK',people=1,total=0,costsRecorded=False) for i in range(1,126)]
fixtures['rateCatalog'] = dict(year='2026',validFrom='2026-01-01',versions=[dict(validFrom='2026-01-01',name='SBU',source='Uji',count=2129,active=2129)],rows=[dict(key=f'R{i}',id=str(i),name=f'Tarif {i:04}',spec='Luar Kota',unit='OH',rate=530000,validFrom='2026-01-01',active=True) for i in range(1,2130)])
fixtures['previewNumbers'] = {'numbers':['SPD/31/2026'], 'provisional':True}
fixtures['register'] = [{'number':'SPD/30/2026','year':'2026','mode':'auto','created':'2026-11-25T08:28:00.000Z'}]
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.set_content(html)
    page.evaluate('''fixtures=>{const store=new Map();Object.defineProperty(window,'sessionStorage',{value:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}});window.SPPD_CONFIG={apiUrl:'mock',pollMs:15000,portalUrl:'../profil-pbj/'};window.SPPD_SESSION={token:()=> 'mock',restore:()=> 'mock',classify:()=> 'connection',clear:()=>{}};if(!crypto.randomUUID) crypto.randomUUID=()=> '12345678-1234-1234-1234-123456789012';window.mockRequests=[];window.fetch=async(u,o)=>{const d=JSON.parse(o.body);window.mockRequests.push(d);return {json:async()=>({ok:true,data:fixtures[d.action]??true})}};}''',fixtures)
    page.locator('body').evaluate("el=>{window.Intl.DateTimeFormat=function(){return {format:()=> '2026-11-25'}}}")
    page.add_script_tag(content=(root/'assets/app.js').read_text())
    page.get_by_role('heading',name='Perjalanan Dinas',exact=True).wait_for(timeout=8000)
    page.locator('#nav').get_by_text('Standar biaya (SBU)').click()
    page.locator('#rateList tbody tr').first.wait_for(timeout=5000)
    assert page.locator('#rateList tbody tr').count()==10
    page.locator('[data-page-size=rates]').select_option('100')
    assert page.locator('#rateList tbody tr').count()==100
    page.locator('#rateList [data-step="1"]').click()
    assert 'Tarif 0101' in page.locator('#rateList tbody tr').first.inner_text()
    page.locator('#rateQuery').fill('Tarif 2129')
    assert page.locator('#rateList tbody tr').count()==1
    assert 'Tarif 2129' in page.locator('#rateList tbody tr').first.inner_text()
    assert '1 dari 2129 item' == page.locator('#rateCount').inner_text()
    page.locator('#nav').get_by_text('Riwayat SPPD').click()
    assert page.locator('#listRows tbody tr').count()==10
    page.locator('[data-page-size=list]').select_option('50')
    page.locator('#listRows [data-step="1"]').click()
    assert 'Kegiatan 051' in page.locator('#listRows tbody tr').first.inner_text()
    page.locator('#listQuery').fill('Kegiatan 125')
    assert page.locator('#listRows tbody tr').count()==1
    page.locator('#listStatus').select_option('SIAP_CETAK')
    assert page.locator('#listRows tbody tr').count()==0
    page.locator('#nav').get_by_text('Pegawai & pejabat').click()
    assert page.locator('#employeeRows tbody tr').count()==10
    page.locator('[data-page-size=employees]').select_option('20')
    page.locator('#employeeRows [data-step="1"]').click()
    assert 'Pegawai 021' in page.locator('#employeeRows tbody tr').first.inner_text()
    page.locator('#employeeSearch').fill('Pegawai 125')
    assert page.locator('#employeeRows tbody tr').count()==1
    page.locator('#employeeRows').get_by_role('button',name='Ubah').click()
    assert page.locator('#f-emp-name').input_value()=='Pegawai 125'
    page.locator('#nav').get_by_text('Buat SPPD').click()
    assert page.locator('#f-mode').count()==0
    page.get_by_role('button',name='+ Tambah pegawai').click()
    page.locator('#f-employee-0').select_option('P1')
    page.locator('#f-number-0').fill('SPRINT/31/2026')
    assert page.get_by_role('button',name='Ambil Nomor SPD').count()==0
    page.locator('#nav').get_by_text('Register SPD').click()
    page.locator('.orbita-dialog').wait_for()
    page.locator('.orbita-dialog .dialog-actions button[value=cancel]').click()
    assert page.locator('#f-employee-0').input_value()=='P1'
    page.locator('#nav').get_by_text('Register SPD').click()
    page.locator('.orbita-dialog button[value=ok]').click()
    page.get_by_text('25 November 2026, 15:28',exact=True).wait_for(timeout=5000)
    assert not errors,errors
    browser.close()
print('PASS: paging 2129 tarif, 125 riwayat, 125 pegawai, pencarian lintas halaman, filter status, nomor manual, dialog batal/lanjut, tanggal register WIB.')
