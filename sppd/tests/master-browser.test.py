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
    assert page.get_by_text('Rp 277.784.000',exact=True).count() >= 1
    assert page.locator('#nav').get_by_text('Ruang bendahara').count()==0
    page.locator('#hamb').click()
    assert page.locator('body').evaluate("el=>el.classList.contains('sidebar-hidden')")
    page.locator('#hamb').click()
    page.locator('#nav').get_by_text('Pegawai & pejabat').click()
    assert page.locator('#f-name').input_value()=='SEKRETARIAT DAERAH'
    assert page.locator('#f-kpaName').input_value()==''
    assert page.locator('#f-address').input_value().startswith('Jl. Ir.H.Juanda No.10')
    assert page.locator('[data-pptk-sub]').count()==1
    page.locator('#f-pptkPick-0').select_option('P1')
    assert page.locator('#f-pptkName-0').input_value()=='Pegawai Uji'
    assert page.locator('#f-pptkNip-0').input_value()==master['nip']
    assert page.locator('#numForm').count()==0
    page.locator('#nav').get_by_text('Standar biaya (SBU)').click()
    page.get_by_text('Belum ada tarif tersimpan.',exact=False).wait_for(timeout=3000)
    assert page.get_by_role('button',name='Aktifkan tarif terpilih').count()==0
    page.locator('#nav').get_by_text('Pegawai & pejabat').click()
    assert page.locator('#f-level').count()==0
    assert page.locator('#f-bendUserId').count()==0
    assert page.locator('#f-masterOpd').count()==0
    page.locator('#nav').get_by_text('Buat SPPD').click()
    page.get_by_text('Nama pejabat belum lengkap.',exact=False).wait_for(timeout=3000)
    assert page.get_by_role('button',name='Buka Pegawai & pejabat').is_visible()
    page.locator('#f-budgetKey').select_option(key)
    page.get_by_role('button',name='+ Tambah pegawai').click()
    page.locator('#f-employee-0').select_option('P1')
    assert page.locator('#grandTotal').count()==0
    assert page.locator('#f-advance-0').count()==0
    assert page.locator('#f-province').count()==0
    assert 'Rp 277.784.000' in page.locator('#budgetHint').inner_text()
    assert '1 hari · 1 pegawai' in page.locator('#daysText').inner_text()
    assert page.locator('#draftLetter').count()==1
    assert page.evaluate("window.mockRequests.filter(x=>x.action==='directory').length")==0
    # Dua versi dengan respons daftar yang berubah setelah tindakan admin.
    page.evaluate("""() => {
        const originalFetch = window.fetch;
        const versions = [
            {validFrom:'2026-01-01', name:'SBU Lama', source:'Dasar A', count:1, active:1},
            {validFrom:'2026-12-31', name:'SBU Baru', source:'Dasar B', count:1, active:0}
        ];
        window.fetch = async (u,o) => {
            const d = JSON.parse(o.body);
            if (!['rateCatalog','renameRateVersion','deleteRateVersion'].includes(d.action)) return originalFetch(u,o);
            window.mockRequests.push(d);
            let data;
            const item = versions.find(v=>v.validFrom===d.validFrom);
            if (d.action==='renameRateVersion') { item.name=d.name; data={name:d.name}; }
            else if (d.action==='deleteRateVersion') { versions.splice(versions.indexOf(item),1); data={deleted:1}; }
            else {
                const selected=item||versions.at(-1);
                data={year:d.year,validFrom:selected?.validFrom||'',versions,rows:selected?[{key:selected.validFrom,year:d.year,id:'1',name:'Tarif '+selected.validFrom,spec:'Luar Kota',unit:'OH',rate:530000,validFrom:selected.validFrom,active:!!selected.active}]:[]};
            }
            return {json:async()=>({ok:true,data})};
        };
    }""")
    page.locator('#nav').get_by_text('Standar biaya (SBU)').click()
    page.locator('.orbita-dialog button[value=ok]').click()
    page.get_by_role('button',name='Ubah nama versi').wait_for(timeout=3000)
    assert page.locator('#f-version').input_value()=='2026-12-31'
    page.get_by_role('button',name='Ubah nama versi').click()
    page.locator('#dialogValue').fill('SBU PBJ baru')
    page.locator('.orbita-dialog button[value=ok]').click()
    page.locator('#f-version option').filter(has_text='SBU PBJ baru').wait_for(state='attached',timeout=3000)
    page.locator('#f-version').select_option('2026-01-01')
    page.get_by_text('Tarif 2026-01-01',exact=True).wait_for(timeout=3000)
    assert page.get_by_role('button',name='Aktifkan tarif terpilih').count()==0
    page.locator('#f-version').select_option('2026-12-31')
    page.get_by_text('Tarif 2026-12-31',exact=True).wait_for(timeout=3000)
    page.get_by_role('button',name='Hapus versi tarif').click()
    page.locator('.orbita-dialog button[value=ok]').click()
    page.get_by_text('Tarif 2026-01-01',exact=True).wait_for(timeout=3000)
    assert page.locator('#f-version option[value]:not([value=""])').count()==1
    assert page.evaluate("window.mockRequests.filter(x=>x.action==='deleteRateVersion')[0].validFrom")=='2026-12-31'
    assert not errors,errors
    browser.close()
print('PASS: browser dashboard PBJ, formulir SPD tanpa biaya, tautan master, saldo, sidebar, dropdown rekening, versi SBU.')
