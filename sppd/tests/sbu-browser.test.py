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
trip = {'id':'T1','purpose':'Perjalanan uji','destination':'Jakarta','origin':'Kota Bogor','province':'','category':'','start':'2026-11-25','end':'2026-11-26','days':2,'year':'2026','people':1,'costsRecorded':False,'status':'SIAP_CETAK','total':0,'budgetKey':key,'updated':'U1','participants':[dict(master,employeeId='P1',number='1',daily=0,total=0,advance=0,costs=[{'label':'Bensin','amount':0,'note':''}])], 'files':[], 'history':[{'actor':'Admin Uji (USR-TEST-123)','at':'2026-11-25T07:37:31.513Z','action':'Nomor dicatat'}]}
bandung=dict(trip,id='T2',destination='Bandung',purpose='Perjalanan Bandung')
draft=dict(trip,id='T3',purpose='Draft Uji',status='DRAFT',spdOnly=True)
boot['trips']=[trip,bandung,draft]
boot['rates']=[dict(boot['rates'][0],validFrom='2026-12-31'),dict(boot['rates'][0],key='R2',name='Uang Harian Perjalanan Dinas Luar Daerah Jawa Barat',rate=430000,validFrom='2026-01-01'),dict(boot['rates'][0],key='R3',name='Uang Harian Perjalanan Dinas Luar Daerah Jawa Barat',spec='Diklat',rate=130000,validFrom='2026-01-01')]
boot['rates'].append({'key':'BANDUNG-ROAD','year':'2026','validFrom':'2026-01-01','name':'Biaya Transportasi dari Kota Bogor dengan kendaraan ke Kota Bandung','spec':'Kota Bandung','unit':'Kendaraan','rate':1080000})
fixtures['detail']=trip
fixtures['T2']=bandung
fixtures['T3']=draft
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
    page.evaluate('''fixtures=>{const store=new Map();Object.defineProperty(window,'sessionStorage',{value:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}});window.SPPD_CONFIG={apiUrl:'mock',pollMs:15000,portalUrl:'../profil-pbj/'};window.SPPD_SESSION={token:()=> 'mock',restore:()=> 'mock',classify:()=> 'connection',clear:()=>{}};if(!crypto.randomUUID) crypto.randomUUID=()=> '12345678-1234-1234-1234-123456789012';window.mockRequests=[];window.fetch=async(u,o)=>{const d=JSON.parse(o.body);window.mockRequests.push(d);return {json:async()=>({ok:true,data:d.action==='detail'&&fixtures[d.id]?fixtures[d.id]:fixtures[d.action]??true})}};}''',fixtures)
    page.locator('body').evaluate("el=>{window.Intl.DateTimeFormat=function(){return {format:()=> '2026-11-25'}}}")
    page.add_script_tag(content=(root/'assets/app.js').read_text())
    page.get_by_role('heading',name='Perjalanan Dinas',exact=True).wait_for(timeout=8000)
    page.get_by_role('button',name='Buka',exact=True).first.click()
    page.get_by_text('Admin Uji · 25 Nov 2026, 14.37.31 WIB',exact=True).wait_for(timeout=3000)
    assert 'USR-TEST' not in page.locator('.history').inner_text()
    page.locator('#nav').get_by_text('Ringkasan').click()
    page.get_by_role('button',name='Buka',exact=True).first.click()
    page.get_by_role('button',name='Buat kuitansi & rincian biaya').wait_for(timeout=3000)
    assert page.evaluate("window.mockRequests.filter(x=>x.action==='detail').length")==1
    page.get_by_role('button',name='Buat kuitansi & rincian biaya').click()
    assert page.locator('#f-costProvince').input_value()=='DKI Jakarta'
    assert '31 Des 2026' in page.locator('#costRateHint').inner_text()
    assert '530.000' in page.locator('#costRateHint').inner_text()
    assert 'Belum lengkap' in page.locator('#costTotal').inner_text()
    assert page.locator('#f-costCity').input_value()=='Jakarta'
    page.locator('#f-costProvince').select_option('Jawa Barat')
    assert page.locator('#f-costCity option').filter(has_text='Jakarta').count()==0
    page.locator('#f-costCity').select_option('Kota Bandung')
    assert 'Provinsi tujuan harus sesuai' in page.locator('#costRateHint').inner_text()
    page.locator('#nav').get_by_text('Ringkasan').click()
    page.get_by_role('button',name='Buka',exact=True).nth(1).click()
    page.get_by_role('button',name='Buat kuitansi & rincian biaya').click()
    assert page.locator('#f-costProvince').input_value()=='Jawa Barat'
    page.locator('#f-costCity').select_option('Kota Bandung')
    assert '430.000' in page.locator('#costRateHint').inner_text()
    assert '860.000' in page.locator('#daily-0').inner_text()
    page.locator('#f-costCategory').select_option('Diklat')
    assert '130.000' in page.locator('#costRateHint').inner_text()
    assert '260.000' in page.locator('#costTotal').inner_text()
    page.locator('#f-adj-0-0').fill('100000')
    assert '360.000' in page.locator('#costTotal').inner_text()
    assert page.locator('#f-adj-0-0').input_value()=='100.000'
    assert '980.000' in page.locator('#transportSummary').inner_text()
    assert page.locator('#f-adv-0').count()==0
    page.locator('#f-adj-0-0').fill('1080001')
    assert page.locator('#f-adj-0-0').input_value()=='1.080.001'
    assert page.locator('#costSub-0').evaluate("el=>el.classList.contains('money-over')")
    assert page.locator('[data-act=saveAdjustment]').is_disabled()
    page.locator('#f-adj-0-0').fill('100000')
    assert not page.locator('[data-act=saveAdjustment]').is_disabled()
    assert page.locator('[data-cost-row]').count()==5
    assert page.locator('.cost-group h4').all_text_contents()==['2. Transportasi','3. Penginapan']
    assert page.locator('#f-adjLabel-0-4').input_value()=='Penginapan'
    page.locator('[data-act=addCost][data-kind=road]').click()
    assert page.locator('[data-cost-row]').count()==6
    page.locator('#f-adjLabel-0-3').fill('Parkir tambahan')
    page.locator('#f-adj-0-3').fill('980001')
    assert page.locator('#costSub-0').evaluate("el=>el.classList.contains('money-over')")
    assert page.locator('[data-act=saveAdjustment]').is_disabled()
    page.locator('[data-act=removeCost][data-j="3"]').click()
    assert page.locator('#f-adj-0-0').input_value()=='100.000'
    assert '980.000' in page.locator('#road-0').inner_text()
    page.locator('[data-act=removeCost][data-j="4"]').click()
    assert page.locator('[data-cost-row]').count()==4
    page.locator('[data-act=addCost][data-kind=lodging]').click()
    assert page.locator('#f-adjLabel-0-4').input_value()=='Penginapan'
    assert page.locator('#f-adj-0-0').input_value()=='100.000'
    assert '260.000' in page.locator('#daily-0').inner_text()
    assert not page.locator('[data-act=saveAdjustment]').is_disabled()
    page.locator('#nav').get_by_text('Riwayat SPPD').click()
    page.get_by_role('row').filter(has_text='Draft Uji').get_by_role('button',name='Buka').click()
    page.get_by_role('button',name='Ubah draft').click()
    page.get_by_role('heading',name='Ubah draft SPD').wait_for(timeout=3000)
    page.locator('#nav').get_by_text('Monitoring pagu').click()
    page.locator('#nav').get_by_text('Riwayat SPPD').click()
    page.get_by_role('row').filter(has_text='Draft Uji').get_by_role('button',name='Buka').click()
    page.get_by_role('button',name='Ubah draft').click()
    page.get_by_role('heading',name='Ubah draft SPD').wait_for(timeout=3000)
    assert page.evaluate("window.mockRequests.filter(x=>x.action==='detail'&&x.id==='T3').length")==1
    assert not errors,errors
    browser.close()
print('PASS: jam WIB, ID tersembunyi, detail cache tanpa request ulang, Jakarta dan Jabar terpisah, pilihan kota, validasi tujuan, tarif masa depan, Diklat, total realtime.')
