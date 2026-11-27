from playwright.sync_api import sync_playwright
from pathlib import Path
import fitz
root=Path(__file__).resolve().parent.parent
import tempfile
out=Path(tempfile.mkdtemp(prefix='sppd-print-'))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--allow-file-access-from-files'])
 page=b.new_page();import base64
 page.set_content('<html><head><title>Perjalanan Dinas | ORBITA</title><style>'+ (root/'assets/style.css').read_text()+'</style></head><body><div id="printArea"></div></body></html>');page.add_script_tag(content=(root/'assets/print.js').read_text().replace('assets/lambang-kota-bogor.png','data:image/png;base64,'+base64.b64encode((root/'assets/lambang-kota-bogor.png').read_bytes()).decode()));page.evaluate('window.print=()=>{window.didPrint=true}');
 data={'status':'SIAP_CETAK','costsRecorded':False,'office':{'name':'SEKRETARIAT DAERAH','unit':'Bagian Pengadaan Barang dan Jasa','address':'Jl. Ir.H.Juanda No.10 Telp. (0251)8321075 Fax. 8326530','kpaName':'PEJABAT CONTOH, S.E., M.Si.','kpaNip':'000000000000000000','kpaTitle':'Kepala Bagian Pengadaan Barang/Jasa selaku Kuasa Pengguna Anggaran','kpaRank':'Pembina - IV/a'},'start':'2026-11-25','end':'2026-11-25','issued':'2026-11-24','origin':'Kota Bogor Provinsi Jawa Barat','destination':'Kota Jakarta Prov. DKI Jakarta','purpose':'Menghadiri kegiatan koordinasi pengadaan barang dan jasa dalam rangka mendukung pelaksanaan program kerja, bertempat di Jakarta pada tanggal 25 November 2026.','days':1,'transport':'Mobil','activity':'Pengelolaan Layanan Pengadaan Secara Elektronik','account':'5.1.02.04.001.00001','participants':[{'name':'PEGAWAI CONTOH, S.Kom.','employeeId':'P1','number':'800.1.11.1/123-Bag. PBJ','nip':'000000000000000000','rank':'Penata Muda Tingkat I - III/b','position':'Pengelola Pengadaan Barang/Jasa Ahli Pertama'}]}
 page.evaluate('(d)=>window.printSPPD(d,"spd","P1")',data);page.wait_for_function('window.didPrint===true');assert page.title()=='SPD-PEGAWAI25112026-ORBITA',page.title();assert page.locator('#printArea img').evaluate('(i)=>i.complete && i.naturalWidth>0');page.pdf(path=str(out/'preview.pdf'),prefer_css_page_size=True,print_background=True)
 page.evaluate('window.dispatchEvent(new Event("afterprint"))');assert page.title()=='Perjalanan Dinas | ORBITA'
 data['purpose']='Menghadiri Kegiatan Business Matching Iklim Usaha di Berbagai Sektor Pengadaan dalam rangka Mendukung Program Prioritas Presiden yang diselenggarakan Deputi Bidang Pengembangan Strategi dan Kebijakan LKPP pada hari Rabu 14 Oktober 2026 Pukul 09.00 WIB s.d selesai bertempat di Hotel Pullman Jakarta Central Park Podomoro City, Jl. Let. Jend. S. Parman Kav. 28, 11470 Jakarta.'
 page.evaluate('window.didPrint=false');page.evaluate('(d)=>window.printSPPD(d,"spd","P1")',data);page.wait_for_function('window.didPrint===true');pdf=page.pdf(prefer_css_page_size=True,print_background=True);assert len(fitz.open(stream=pdf,filetype='pdf'))==2,'long purpose'
 page.evaluate('window.dispatchEvent(new Event("afterprint"))');data['participants'].append(dict(data['participants'][0],name='PESERTA KEDUA',employeeId='P2'))
 page.evaluate('window.didPrint=false');page.evaluate('(d)=>window.printSPPD(d,"spd")',data);page.wait_for_function('window.didPrint===true');assert page.title()=='SPD-PEGAWAI-ROMBONGAN25112026-ORBITA';assert len(fitz.open(stream=page.pdf(prefer_css_page_size=True),filetype='pdf'))==4,'two participants'
 page.evaluate('window.dispatchEvent(new Event("afterprint"))');data['status']='DRAFT';data['participants']=data['participants'][:1];page.evaluate('window.didPrint=false');page.evaluate('(d)=>window.printSPPD(d,"spd")',data);page.wait_for_function('window.didPrint===true');pdf=fitz.open(stream=page.pdf(prefer_css_page_size=True),filetype='pdf');assert len(pdf)==2,'draft pages';assert all('DRAFT' in x.get_text() for x in pdf)
 print('PASS: long purpose from Excel, two participants, draft marking, naming, restore title')
 b.close()
 doc=fitz.open(str(out/'preview.pdf'));print('pages',len(doc),[list(x.rect) for x in doc]);assert len(doc)==2
 for i,p in enumerate(doc):
  print(i+1,'image',len(p.get_images()),'text',len(p.get_text()));p.get_pixmap(matrix=fitz.Matrix(1.2,1.2)).save(str(out/f'preview-{i+1}.png'))
 assert len(doc[0].get_images())>0;assert 'Catatan Lain-lain' in doc[1].get_text()
