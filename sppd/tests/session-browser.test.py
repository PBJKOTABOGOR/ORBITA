# Uji frontend dengan portal dan respons API simulasi, tanpa menyentuh produksi.
from pathlib import Path
import json
import mimetypes
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
base = 'https://pbjkotabogor.github.io/ORBITA/'
portal = base + 'profil-pbj/?login=1'
sppd = base + 'sppd/'
key = 'traxpbj_selection_token'
requests = []

def route(r):
    url = r.request.url
    if url.startswith('https://script.google.com/'):
        data = json.loads(r.request.post_data)
        requests.append(data)
        token = data.get('token')
        if token == 'valid':
            response = {'ok': True, 'data': {'user': {'id':'U1','name':'Admin Uji','grants':[{'opd':'*','roles':['SUPERADMIN']}]}, 'offices':[], 'selected':'', 'boot':{'trips':[], 'masters':{'employees':[], 'office':None, 'number':[]}, 'rates':[]}}}
        elif token == 'no-access':
            response = {'ok': False, 'error':'Akun belum diberi akses Perjalanan Dinas. Hubungi admin.'}
        else:
            response = {'ok':False,'error':'Sesi ORBITA tidak berlaku. Silakan masuk kembali.'}
        return r.fulfill(json=response, headers={'access-control-allow-origin':'*'})
    if url.startswith(base+'profil-pbj/'):
        return r.fulfill(content_type='text/html', body=f'''<button onclick="sessionStorage.setItem('{key}','valid')">Login simulasi</button><button onclick="window.open('{sppd}','_blank')">Buka SPPD</button>''')
    if url.startswith(sppd):
        relative = url[len(sppd):].split('?')[0] or 'index.html'
        file = root / relative
        if file.is_file():
            return r.fulfill(body=file.read_bytes(), content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
    return r.fulfill(status=404, body='Not found')

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context()
    context.route('**/*', route)
    # Tab portal yang sudah login, navigasi langsung pada tab yang sama.
    page = context.new_page()
    page.goto(portal)
    page.get_by_text('Login simulasi').click()
    page.goto(sppd)
    page.get_by_text('Admin Uji', exact=True).wait_for()
    assert requests[-1]['action'] == 'init' and requests[-1]['token'] == 'valid'
    print('PASS: sesi tab yang sama langsung diterima')
    # Tab independen tidak punya sesi. Login asli (simulasi) di popup lalu kembali otomatis.
    fresh = context.new_page()
    fresh.goto(sppd)
    fresh.get_by_role('heading', name='Sambungkan akun ORBITA').wait_for()
    with fresh.expect_popup() as p:
        fresh.get_by_role('button',name='Sambungkan akun').click()
    pop = p.value
    pop.get_by_text('Login simulasi').click()
    fresh.get_by_text('Admin Uji', exact=True).wait_for()
    assert fresh.evaluate(f"sessionStorage.getItem('{key}')") == 'valid'
    assert fresh.evaluate(f"localStorage.getItem('{key}')") is None
    print('PASS: login popup, kembali otomatis, token tidak disimpan permanen')
    # Akses belum diberikan tidak dianggap sebagai kegagalan login.
    page.goto(portal)
    page.evaluate(f"sessionStorage.setItem('{key}','no-access')")
    page.goto(sppd)
    page.get_by_role('heading',name='Akses Perjalanan Dinas belum diberikan').wait_for()
    assert page.evaluate(f"sessionStorage.getItem('{key}')") == 'no-access'
    print('PASS: hak akses dibedakan dari sesi')
    # Sesi kedaluwarsa dibersihkan.
    page.goto(portal)
    page.evaluate(f"sessionStorage.setItem('{key}','expired')")
    page.goto(sppd)
    page.get_by_role('heading',name='Sambungkan akun ORBITA').wait_for()
    assert page.evaluate(f"sessionStorage.getItem('{key}')") is None
    print('PASS: sesi kedaluwarsa dibersihkan')
    # Tab dibuka langsung dari portal, sesi bisa diwariskan oleh browser.
    page.goto(portal)
    page.get_by_text('Login simulasi').click()
    with page.expect_popup() as p:
        page.get_by_text('Buka SPPD').click()
    p.value.get_by_text('Admin Uji', exact=True).wait_for()
    print('PASS: SPPD yang dibuka langsung dari portal memakai sesi yang sama')
    browser.close()
